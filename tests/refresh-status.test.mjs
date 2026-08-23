import assert from "node:assert/strict";
import test from "node:test";
import { formatRefreshedAt } from "../app/refresh-status.ts";

// Fixed local instants so the assertions do not depend on when the suite runs.
const now = new Date(2026, 7, 23, 14, 0);           // 23 Aug 2026, 14:00 local
const today = new Date(2026, 7, 23, 15, 4).toISOString();
const lastWeek = new Date(2026, 7, 18, 15, 4).toISOString();
const lastYear = new Date(2025, 7, 18, 15, 4).toISOString();

test("a live refresh from today shows the time alone", () => {
  assert.equal(
    formatRefreshedAt(today, true, now),
    "Last refreshed 3:04 PM",
  );
});

test("a stale snapshot from another day carries its date", () => {
  // This is the case that used to read "Last successful refresh 3:04 PM",
  // making a week-old cache look like a recent one.
  assert.equal(
    formatRefreshedAt(lastWeek, false, now),
    "Last successful refresh Aug 18 at 3:04 PM",
  );
});

test("a stale snapshot from an earlier year carries its year", () => {
  assert.equal(
    formatRefreshedAt(lastYear, false, now),
    "Last successful refresh Aug 18, 2025 at 3:04 PM",
  );
});

test("a cached refresh from earlier today still shows the time alone", () => {
  assert.equal(
    formatRefreshedAt(today, false, now),
    "Last successful refresh 3:04 PM",
  );
});

test("an unparseable timestamp degrades instead of rendering Invalid Date", () => {
  assert.equal(formatRefreshedAt("not a date", true, now), "Refresh time unavailable");
});
