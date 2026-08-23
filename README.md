# Practice Activity

[![CI](https://github.com/travishuff/practice-activity-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/travishuff/practice-activity-dashboard/actions/workflows/ci.yml)

## ⬇️ Download the macOS installer

[**Download Practice Activity v0.3.0 for macOS (.dmg) →**](https://github.com/travishuff/practice-activity-dashboard/releases/download/v0.3.0/Practice-Activity-v0.3.0-macOS-universal.dmg)

This universal installer works on both Apple Silicon and Intel Macs. You can
also [view all releases](https://github.com/travishuff/practice-activity-dashboard/releases).

Practice Activity is a macOS desktop dashboard for the Mark Walker Practice Log.
It reads the existing Google Sheets layout and displays a 365-day practice
heatmap and summary that you refresh on demand.

## Install on macOS

The release artifact is a universal `.dmg` that works on Apple Silicon and Intel
Macs.

1. Open `Practice Activity.dmg`.
2. Drag **Practice Activity** into **Applications**.
3. Open the app.
4. Follow the first-run instructions to share and connect the Practice Log.

This development build is unsigned. The first time it is opened, macOS may say
it cannot verify the developer. Control-click **Practice Activity** in
Applications, choose **Open**, then choose **Open** again. Signing and
notarization can be added later without changing the app architecture.

The installed app includes its own runtime. End users do not need Node.js,
pnpm, Terminal, or this source repository.

## Connect a Practice Log

During first-run setup, the app explains how to make the Google Sheet readable:

1. Open the Mark Walker Practice Log in Google Sheets.
2. Click **Share**.
3. Under **General access**, choose **Anyone with the link**.
4. Keep the role set to **Viewer**.
5. Click **Copy link** and paste it into Practice Activity.

The app tests the URL and sheet layout before saving it.
You can also enter your name during setup to display it in the app heading; the
field is optional and a blank value keeps the heading as **Practice Activity**.

Anyone with the link can view the sheet, including practiced items in column C.
Viewer access does not allow them to edit it. Some managed Google Workspace
accounts may prevent link sharing.

Use **Change Practice Log** in the app to connect a different sheet. Settings and
the most recent successful response are stored in the current macOS user's
Application Support directory. Cached data is associated with its exact sheet
URL so data from a previous sheet is never used for a new one.

Use **Refresh** above the heatmap whenever you want to load the latest changes
from Google Sheets. The dashboard does not refresh automatically.

## What the dashboard shows

The Practice Log covers a 365-day period beginning at day 1 of the sheet. Every
day in that period falls into exactly one of three counts, decided by the
calendar rather than by whether the sheet has a row for it:

- **Practice days** — day 1 through today, where practice time is above zero.
- **Days off** — day 1 through today, where practice time is zero. A day left
  blank, or with no row at all, counts here.
- **Remaining** — tomorrow through day 365.

The three always add up to 365.

**Daily practice range** shows the shortest and longest of your practice days,
and states the average separately because the two are measured over different
sets: the average spans every day since you started, including days off, so it
usually sits below the shortest practice day. The card spells out both
denominators.

Today counts as a day off until you log practice, so the average dips each
morning and recovers when the sheet is updated.

## Development

Requires Node.js 22.13 or newer. The pnpm version is pinned in `package.json`
under `packageManager`; `corepack` will honour it automatically, and CI uses the
same value.

```bash
pnpm install
pnpm dev
```

The development command opens the Electron application with Vite hot reload.

### Choosing a Practice Log in development

`pnpm dev` keeps its settings and cache in a separate `Practice Activity-dev`
directory, so working on the app never touches the installed app's saved
Practice Log.

To point development at a particular sheet, copy the example file and fill it
in:

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. To use a different sheet for a single run without
editing it, set the variable inline:

```bash
PRACTICE_SHEET_URL="https://docs.google.com/spreadsheets/d/other/edit" pnpm dev
```

The environment variable wins over `.env.local`, which wins over whatever the
dev setup wizard last saved. While an override is set it applies for the whole
run, so **Change Practice Log** still writes to dev settings but the override
is what loads; unset it to exercise the first-run setup wizard. A packaged app
ignores all of this.

Quality checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm package
```

The first three run in CI on every push to `main` and every pull request,
against Node 22 and Node 24. Packaging is not covered there and stays a local
check.

## Build the macOS installer

Build a universal unsigned DMG and ZIP on a Mac:

```bash
pnpm make:mac
```

Artifacts are written under `out/make/`. DMG generation must run on macOS.

For a faster architecture-specific local build:

```bash
pnpm make
```

## Release versioning

Every newly published DMG is a release. Releases use [Semantic Versioning](https://semver.org/)
from `package.json` and matching Git tags such as `v0.1.0`:

- patch (`0.1.1`) for fixes that do not change expected behavior
- minor (`0.2.0`) for new backward-compatible features
- major (`1.0.0`) for incompatible changes; `1.0.0` also marks the first stable release

After setting the version in `package.json`, build the publishable artifacts with:

```bash
pnpm release:mac
```

This produces a versioned universal DMG and SHA-256 checksum under
`out/release/v<version>/`. The release is published with the matching
`v<version>` Git tag and both files are uploaded to GitHub Releases. Release
artifacts under `out/` are generated files and are not committed to Git.

## Architecture

Main process — Node, full privileges:

- `electron/main.ts`: application window, IPC validation, and external links
- `electron/preload.ts`: narrow, context-isolated renderer API
- `electron/practice-service.ts`: sheet refresh and cached-snapshot fallback
- `electron/settings-store.ts`: local settings and per-sheet cache
- `electron/dev-environment.ts`: development-only data directory and sheet
  override, inert in a packaged app
- `electron/dev-sheet.ts`: which Practice Log development should open

Renderer — sandboxed:

- `app/app.tsx`: top-level view state, from loading through setup to dashboard
- `app/setup-wizard.tsx`: first-run sharing and URL setup
- `app/activity-dashboard.tsx`: dashboard UI, manual refresh, midnight rollover
- `app/practice-metrics.ts`: the 365-day period statistics described above
- `app/calendar-date.ts`: time-zone-free calendar dates, plus today's local date
- `app/refresh-status.ts`: how the footer describes data freshness

Shared by both:

- `app/practice-sheet.ts`: Google GViz parsing and Practice Log validation
- `app/electron-api.ts`: the typed IPC contract and payload validation
- `app/practice-data.ts`: the practice-day shape and the period length
- `app/user-name.ts`: name normalization and the window title

The renderer is sandboxed with Node integration disabled. Google Sheets requests
run in the Electron main process, and the renderer cannot access the filesystem
or arbitrary Electron APIs.

Contributor notes, including the exact period formulas and the invariants the
code relies on, are in [AGENTS.md](AGENTS.md).
