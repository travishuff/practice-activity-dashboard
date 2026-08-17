import assert from "node:assert/strict";
import test from "node:test";
import { snapshot, snapshotTotalHours } from "../app/practice-data.ts";
import { summarizePracticePeriod } from "../app/practice-metrics.ts";

test("snapshot has one value for every calendar day", () => {
  assert.equal(snapshot.length, 344);
  assert.equal(new Set(snapshot.map(day => day.date)).size, snapshot.length);

  const start = Date.UTC(2025, 8, 7);
  snapshot.forEach((day, index) => {
    assert.equal(day.date, new Date(start + index * 86_400_000).toISOString().slice(0, 10));
  });
});

test("daily values reconcile to the corrected G6 total", () => {
  const totalMinutes = snapshot.reduce((sum, day) => sum + day.minutes, 0);
  assert.equal(totalMinutes, 33_771);
  assert.equal(Number((totalMinutes / 60).toFixed(2)), snapshotTotalHours);
  assert.equal(snapshotTotalHours, 562.85);
});

test("corrected source dates retain their daily minutes", () => {
  assert.deepEqual(snapshot.find(day => day.date === "2026-06-12"), { date: "2026-06-12", minutes: 75 });
  assert.deepEqual(snapshot.find(day => day.date === "2026-08-07"), { date: "2026-08-07", minutes: 135 });
});

test("rolling summary uses exactly 365 calendar days", () => {
  const summary = summarizePracticePeriod(snapshot);
  assert.equal(summary.days.length, 365);
  assert.equal(summary.practiceDays + summary.daysOff + summary.futureDays, 365);
  assert.equal(summary.occurredDays, 344);
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
