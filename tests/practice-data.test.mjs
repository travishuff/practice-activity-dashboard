import assert from "node:assert/strict";
import test from "node:test";
import { summarizePracticePeriod } from "../app/practice-metrics.ts";

// Day 1 of the log, and a fixed "today" ten days in, so every expectation below
// is deterministic rather than a function of the wall clock.
const PERIOD_START = "2026-01-01";
const TODAY = "2026-01-10";
const at = overrides => ({ periodStart: PERIOD_START, today: TODAY, ...overrides });

// Jan 1-4 are recorded; Jan 5-10 have elapsed with no row in the sheet at all.
const fixture = [
  { date: "2026-01-01", minutes: 60 },
  { date: "2026-01-02", minutes: 90 },
  { date: "2026-01-03", minutes: 0 },
  { date: "2026-01-04", minutes: 30 },
];

test("the three day counts partition the 365-day window exactly", () => {
  const summary = summarizePracticePeriod(fixture, at());

  assert.equal(summary.elapsedDays, 10);
  assert.equal(summary.practiceDays, 3);
  assert.equal(summary.daysOff, 7);
  assert.equal(summary.remainingDays, 355);
  assert.equal(
    summary.practiceDays + summary.daysOff + summary.remainingDays,
    365,
  );
});

test("elapsed days with no row in the sheet count as days off, not as remaining", () => {
  const summary = summarizePracticePeriod(fixture, at());

  // Jan 3 is a recorded zero; Jan 5-10 are absent entirely. Both are days off.
  assert.equal(summary.daysOff, 7);
  assert.equal(summary.days[6].date, "2026-01-07");
  assert.equal(summary.days[6].elapsed, true);
  assert.equal(summary.days[6].minutes, 0);
});

test("the summary does not depend on whether the sheet spells out its zero days", () => {
  // The same practice history, once with explicit zero rows and once with the
  // untouched days simply missing, must produce identical numbers.
  const spelledOut = [
    ...fixture,
    ...["05", "06", "07", "08", "09", "10"].map(day => ({
      date: `2026-01-${day}`,
      minutes: 0,
    })),
  ];

  assert.deepEqual(
    summarizePracticePeriod(spelledOut, at()),
    summarizePracticePeriod(fixture, at()),
  );
});

test("the daily average spans every elapsed day, including days off", () => {
  const summary = summarizePracticePeriod(fixture, at());

  // (60 + 90 + 0 + 30) over ten elapsed days.
  assert.equal(summary.daily.average, 18);
  // The range deliberately covers practice days only, so it sits above the
  // average rather than containing it.
  assert.equal(summary.daily.minimum, 30);
  assert.equal(summary.daily.maximum, 90);
});

test("today counts as an elapsed day even before any practice is logged", () => {
  const beforePracticing = summarizePracticePeriod(fixture, at({ today: "2026-01-11" }));

  assert.equal(beforePracticing.elapsedDays, 11);
  assert.equal(beforePracticing.daysOff, 8);
  assert.equal(beforePracticing.remainingDays, 354);
});

test("streaks are measured over elapsed days only", () => {
  assert.deepEqual(summarizePracticePeriod(fixture, at()).streaks, {
    minimum: 1,
    average: 1.5,
    maximum: 2,
  });
});

test("a period that has not started yet reports no elapsed days", () => {
  const summary = summarizePracticePeriod([], at({
    periodStart: "2026-03-01",
    today: "2026-02-01",
  }));

  assert.equal(summary.elapsedDays, 0);
  assert.equal(summary.practiceDays, 0);
  assert.equal(summary.daysOff, 0);
  assert.equal(summary.remainingDays, 365);
  assert.equal(summary.daily.average, 0);
});

test("a period that has run past day 365 reports no remaining days", () => {
  const summary = summarizePracticePeriod(fixture, at({ today: "2027-06-01" }));

  assert.equal(summary.elapsedDays, 365);
  assert.equal(summary.remainingDays, 0);
  assert.equal(summary.practiceDays + summary.daysOff, 365);
});

test("payloads cached before periodStart existed fall back to the earliest day", () => {
  const summary = summarizePracticePeriod(fixture, { today: TODAY });

  assert.equal(summary.periodStart, "2026-01-01");
  assert.equal(summary.elapsedDays, 10);
});

test("the window is anchored on day 1, not on the first day carrying practice", () => {
  // The log began Jan 1; the first recorded practice is a week later.
  const lateStart = [{ date: "2026-01-08", minutes: 45 }];
  const summary = summarizePracticePeriod(lateStart, at());

  assert.equal(summary.days[0].date, "2026-01-01");
  assert.equal(summary.elapsedDays, 10);
  assert.equal(summary.practiceDays, 1);
  assert.equal(summary.daysOff, 9);
});
