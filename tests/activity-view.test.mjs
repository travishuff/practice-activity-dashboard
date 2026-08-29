import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivityView,
  practiceLevel,
} from "../app/activity-view.ts";

const PERIOD_START = "2025-09-07";
const TODAY = "2025-09-10";
const data = [
  { date: "2025-09-07", minutes: 30, items: ["Rudiments"] },
  // Sep 8 is deliberately absent. It must still appear as an elapsed day off.
  { date: "2025-09-09", minutes: 60, items: ["Grooves"] },
  { date: "2025-09-10", minutes: 180, items: ["Reading"] },
  // A future row remains in the calendar, but is not an elapsed practice day.
  { date: "2025-09-11", minutes: 240, items: ["Preplanned"] },
];

test("the dashboard calendar is a complete 53-week Sunday-to-Saturday grid", () => {
  const view = buildActivityView(data, PERIOD_START, TODAY);

  assert.equal(view.weeks, 53);
  assert.equal(view.cells.length, 53 * 7);
  assert.equal(view.cells[0].date, PERIOD_START);
  assert.equal(view.cells.at(-1).date, "2026-09-12");

  for (let index = 0; index < view.cells.length; index += 7) {
    assert.equal(
      new Date(`${view.cells[index].date}T00:00:00Z`).getUTCDay(),
      0,
      `week ${index / 7 + 1} should begin on Sunday`,
    );
  }
});

test("the heatmap partitions cells into elapsed, future, and outside states", () => {
  const view = buildActivityView(data, PERIOD_START, TODAY);
  const inRange = view.cells.filter(cell => cell.inRange);

  assert.equal(inRange.length, 365);
  assert.equal(inRange.filter(cell => cell.elapsed).length, 4);
  assert.equal(inRange.filter(cell => !cell.elapsed).length, 361);
  assert.equal(view.cells.filter(cell => !cell.inRange).length, 6);

  const missingElapsedDay = inRange.find(cell => cell.date === "2025-09-08");
  assert.deepEqual(missingElapsedDay, {
    date: "2025-09-08",
    minutes: 0,
    items: [],
    inRange: true,
    elapsed: true,
  });

  const futurePractice = inRange.find(cell => cell.date === "2025-09-11");
  assert.equal(futurePractice.elapsed, false);
  assert.equal(futurePractice.minutes, 240);
});

test("the heatmap and KPI summary are derived from the same canonical period", () => {
  const view = buildActivityView(data, PERIOD_START, TODAY);
  const elapsed = view.cells.filter(cell => cell.inRange && cell.elapsed);

  assert.equal(view.summary.elapsedDays, elapsed.length);
  assert.equal(view.summary.practiceDays, elapsed.filter(cell => cell.minutes > 0).length);
  assert.equal(view.summary.daysOff, elapsed.filter(cell => cell.minutes === 0).length);
  assert.equal(view.summary.remainingDays, 365 - elapsed.length);
  assert.equal(
    view.summary.practiceDays
      + view.summary.daysOff
      + view.summary.remainingDays,
    365,
  );
  assert.deepEqual(view.summary.daily, {
    minimum: 30,
    average: 67.5,
    maximum: 180,
  });
  assert.deepEqual(view.summary.streaks, {
    minimum: 1,
    average: 1.5,
    maximum: 2,
  });
});

test("month and year labels align with their first visible week", () => {
  const view = buildActivityView(data, PERIOD_START, TODAY);

  assert.deepEqual(view.years, [
    { label: "2025", column: 1 },
    { label: "2026", column: 18 },
  ]);
  assert.deepEqual(view.months, [
    { label: "Sep", column: 1 },
    { label: "Oct", column: 5 },
    { label: "Nov", column: 9 },
    { label: "Dec", column: 14 },
    { label: "Jan", column: 18 },
    { label: "Feb", column: 22 },
    { label: "Mar", column: 26 },
    { label: "Apr", column: 31 },
    { label: "May", column: 35 },
    { label: "Jun", column: 40 },
    { label: "Jul", column: 44 },
    { label: "Aug", column: 48 },
    { label: "Sep", column: 53 },
  ]);
});

test("practice intensity uses the documented minute thresholds", () => {
  assert.deepEqual(
    [0, 1, 59, 60, 119, 120, 179, 180, 240].map(practiceLevel),
    [0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
});
