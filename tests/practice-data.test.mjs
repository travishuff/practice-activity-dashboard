import assert from "node:assert/strict";
import test from "node:test";
import { snapshot, snapshotTotalHours } from "../app/practice-data.ts";
import { summarizePracticePeriod } from "../app/practice-metrics.ts";

test("snapshot has one value for every occurred source date", () => {
  assert.equal(snapshot.length, 343);
  assert.equal(new Set(snapshot.map(day => day.date)).size, snapshot.length);
  assert.equal(snapshot[0].date, "2025-09-07");
  assert.equal(snapshot.at(-1).date, "2026-08-16");
  assert.equal(snapshot.some(day => day.date === "2026-07-10"), false);
});

test("daily values reconcile to the corrected G6 total", () => {
  const totalMinutes = snapshot.reduce((sum, day) => sum + day.minutes, 0);
  assert.equal(totalMinutes, 33_846);
  assert.equal(Number((totalMinutes / 60).toFixed(2)), snapshotTotalHours);
  assert.equal(snapshotTotalHours, 564.1);
});

test("corrected source dates retain their daily minutes", () => {
  assert.deepEqual(snapshot.find(day => day.date === "2026-06-12"), { date: "2026-06-12", minutes: 75 });
  assert.deepEqual(snapshot.find(day => day.date === "2026-08-07"), { date: "2026-08-07", minutes: 135 });
});

test("rolling summary uses exactly 365 calendar days", () => {
  const summary = summarizePracticePeriod(snapshot);
  assert.equal(summary.days.length, 365);
  assert.equal(summary.practiceDays + summary.daysOff + summary.futureDays, 365);
  assert.equal(summary.occurredDays, 343);
  assert.equal(summary.practiceDays, summary.days.filter(day => day.occurred && day.minutes > 0).length);
  assert.equal(summary.daysOff, summary.days.filter(day => day.occurred && day.minutes === 0).length);
  assert.equal(summary.futureDays, summary.days.filter(day => !day.occurred).length);
  assert.equal(summary.daily.minimum, 15);
  assert.equal(summary.daily.maximum, 210);
  assert.equal(Number((summary.daily.average / 60).toFixed(2)), 1.64);
});

test("streak summary reports shortest, average, and longest runs", () => {
  const summary = summarizePracticePeriod(snapshot);
  assert.equal(summary.streaks.minimum, 1);
  assert.ok(summary.streaks.average >= summary.streaks.minimum);
  assert.ok(summary.streaks.average <= summary.streaks.maximum);
  assert.equal(summary.streaks.maximum, 39);
});
