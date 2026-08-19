import assert from "node:assert/strict";
import test from "node:test";
import { summarizePracticePeriod } from "../app/practice-metrics.ts";

const fixture = [
  { date: "2026-01-01", minutes: 60 },
  { date: "2026-01-02", minutes: 90 },
  { date: "2026-01-03", minutes: 0 },
  { date: "2026-01-04", minutes: 30 },
];

test("rolling summary uses exactly 365 calendar days", () => {
  const summary = summarizePracticePeriod(fixture);
  assert.equal(summary.days.length, 365);
  assert.equal(summary.practiceDays, 3);
  assert.equal(summary.daysOff, 1);
  assert.equal(summary.futureDays, 361);
  assert.equal(summary.practiceDays + summary.daysOff + summary.futureDays, 365);
});

test("daily summary uses occurred days for its average", () => {
  const summary = summarizePracticePeriod(fixture);
  assert.equal(summary.daily.minimum, 30);
  assert.equal(summary.daily.average, 45);
  assert.equal(summary.daily.maximum, 90);
});

test("streak summary reports shortest, average, and longest runs", () => {
  const summary = summarizePracticePeriod(fixture);
  assert.deepEqual(summary.streaks, {
    minimum: 1,
    average: 1.5,
    maximum: 2,
  });
});
