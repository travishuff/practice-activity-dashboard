import assert from "node:assert/strict";
import test from "node:test";
import { formatRefreshedAt } from "../app/refresh-status.ts";

const now = new Date(2026, 7, 23, 14, 0);

test("a refresh from today shows the time alone", () => {
  const today = new Date(2026, 7, 23, 15, 4).toISOString();
  assert.equal(formatRefreshedAt(today, true, now), "Last refreshed 3:04 PM");
});

test("a stale refresh carries its date", () => {
  const lastWeek = new Date(2026, 7, 18, 15, 4).toISOString();
  assert.equal(
    formatRefreshedAt(lastWeek, false, now),
    "Last successful refresh Aug 18 at 3:04 PM",
  );
});
