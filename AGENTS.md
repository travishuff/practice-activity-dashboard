# AGENTS.md

Working notes for anyone — human or agent — changing this repo. The
[README](README.md) covers installing and building; this file covers the rules
the code encodes, especially the ones that look like bugs but are not.

## What the app is

An Electron desktop dashboard that reads the Mark Walker Practice Log from a
public Google Sheet and renders a 365-day practice heatmap plus summary stats.
There is no backend and no database. The sheet is the only source of truth;
everything under `userData` is a cache.

## The Practice Log sheet layout

Fetched as `range=A:E` through the Google Visualization (GViz) endpoint.

| Column | Meaning |
| --- | --- |
| A | Day number within the period (integer, 1–365). Present only on a day's header row. |
| B | Calendar date for that day. May be blank. |
| C | Practiced item description. |
| D | *(unused)* |
| E | Minutes practiced for that item row. Blank means 0. |

A day is one header row (column A filled) followed by any number of item rows
(column A blank). A day's minutes are the sum of column E across its item rows.

## Period formulas — canonical

These are the definitions the app must implement. They are **calendar** facts.
They must never depend on whether the sheet happens to carry a row for a day.

Let `periodStart` be day 1 of the log and `today` be the viewer's local
calendar date.

```
elapsed   = clamp(daysBetween(periodStart, today) + 1, 0, 365)

practiced = days in [day 1 .. today] where minutes > 0
off       = days in [day 1 .. today] where minutes === 0   (blank, or no row at all)
remaining = days in [tomorrow .. day 365]                  = 365 - elapsed

average   = (sum of minutes over [day 1 .. today]) / elapsed
minimum   = min(minutes) over practiced days only
maximum   = max(minutes) over practiced days only
```

Implemented in [`app/practice-metrics.ts`](app/practice-metrics.ts).

### Invariants

- `practiced + off + remaining === 365`, always. Guaranteed structurally:
  `off` and `remaining` are **derived** (`elapsed - practiced` and
  `365 - elapsed`). Do not compute them independently — that is how the three
  counts drift apart.
- `elapsed` is clamped at both ends. A period starting in the future reports
  `elapsed = 0`; one that has run past day 365 reports `elapsed = 365`,
  `remaining = 0`.
- Today is always an elapsed day. Before you practice, today counts as a day
  off, so the average dips each morning and recovers when you log. This is
  intentional — it is what keeps the 365 invariant exact.

### The average/range asymmetry is deliberate

`average` spans **all** elapsed days including days off. `minimum` and
`maximum` span **practice days only**. So `average` is routinely *below*
`minimum`, e.g. `{ minimum: 60, average: 15, maximum: 60 }`.

This is correct, not a bug. Averaging over practice days only would hide rest
days; taking the minimum over all days would report `0m` the moment you take a
single day off. Because the two live on different populations, the UI must not
render them as one ordered min → avg → max range — the daily card shows
Shortest/Longest as a range and states the average separately with its
denominator spelled out.

**Do not "fix" this by unifying the populations.**

## Time zones

Practice Log dates are time-zone-free calendar dates, so every date in the app
is normalized to **UTC** — `calendarDate`, `calendarDateKey`, and
`formatCalendarDate` in [`app/calendar-date.ts`](app/calendar-date.ts) all pin
to UTC deliberately.

**`today` is the single exception and must come from the local clock.** Use
`localCalendarDateKey()`, never `calendarDateKey(new Date())`. At 19:30 in
Los Angeles the latter already reports tomorrow, which would age the period
forward a day every evening and manufacture a phantom day off.

## Parser rules

In [`app/practice-sheet.ts`](app/practice-sheet.ts):

- **One definition of a day-header row**, `isDayNumber`: column A holds an
  integer in 1–365. The header scan and the item loop **must** share it. When
  they disagreed — the scan requiring 1–365, the loop breaking on any number —
  a totals row or a typo ended a day early and silently discarded every item
  row after it. If you touch either site, touch both.
- **A number in column A that is not a day number** → the row is skipped and a
  warning is emitted. It deliberately does not end the day (that was the bug)
  and its column-E value is deliberately not counted (that would inflate the
  day instead). Repeated identical warnings are collapsed.
- **Blank column E** → 0 minutes for that item row.
- **Blank column B with no practice** → the row is dropped from `data`
  entirely. Harmless: the metrics layer reconstructs every elapsed day from the
  calendar and fills gaps with 0, so a dropped row and an explicit zero row
  produce identical summaries. There is a test asserting exactly that.
- **Blank column B with practice** → the date is inferred from the day number
  and a user-visible `warning` is emitted.
- **Hard failures** throw `PracticeSheetError("invalid_source", …)`: duplicate
  day number, duplicate date, a date that disagrees with its day number, an
  invalid date, negative minutes. Because negatives throw, minutes reaching the
  metrics layer are always `>= 0`, so `> 0` and `=== 0` form a clean partition.
- `periodStart` is derived from the day-number/date relationship and travels on
  the payload. **Do not re-derive the window start from the earliest date in
  `data`** — those diverge whenever leading days are skipped. The fallback to
  the earliest date exists only for payloads cached before the field existed.

## Conventions

- **Relative value imports between app modules need an explicit `.ts`
  extension.** Tests run under `node --experimental-strip-types`, which does not
  do extensionless resolution. `import type` is erased before the resolver runs,
  so type-only imports may stay extensionless. `allowImportingTsExtensions` is
  enabled in `tsconfig.json` for this reason.
- **`summarizePracticePeriod` takes an injectable `today`.** Always pass a fixed
  date in tests; a test that lets it read the wall clock will rot within a day.
- Quality gates, all currently clean:
  ```bash
  pnpm test && pnpm typecheck && pnpm lint
  ```
  Enforced by [`.github/workflows/ci.yml`](.github/workflows/ci.yml) on every
  push to `main` and every pull request, against Node 22 (the `engines` floor)
  and Node 24. CI sets `ELECTRON_SKIP_BINARY_DOWNLOAD=1`: the gates need
  Electron's bundled type definitions but never its platform binary, because
  nothing the tests import reaches `electron/`. Packaging is **not** covered —
  `pnpm package` remains a local check.

## Invariants worth not breaking

- **`PRACTICE_PERIOD_DAYS` bounds both the window and the valid day number.**
  Because day numbers are capped at it and every date is pinned to
  `periodStart + (day - 1)`, parsed data can never fall outside the window the
  dashboard renders — which is why "Total practice time" and the heatmap
  cannot disagree. Both sides import the one constant from
  [`app/practice-data.ts`](app/practice-data.ts); do not re-spell 365.
- **`checkedAt` is always present.** Nothing produces a null, so the footer has
  no "unknown time" branch. If you add a payload source, give it a timestamp.
- **`today` is state, not a render-time read.** The dashboard re-arms a
  timeout at each local midnight. Anything deriving from today must depend on
  that state so it re-renders at the rollover.

## Known open issues

None outstanding from the review that produced this file. Add new findings
here rather than letting them live only in a pull request description.
