import assert from "node:assert/strict";
import test from "node:test";
import { snapshot, snapshotTotalHours } from "../app/practice-data.ts";

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
