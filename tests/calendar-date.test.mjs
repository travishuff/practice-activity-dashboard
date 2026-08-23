import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDate,
  calendarDateKey,
  formatCalendarDate,
} from "../app/calendar-date.ts";

test("calendar dates retain their day without depending on the local time zone", () => {
  const date = calendarDate("2026-01-01");

  assert.equal(date.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(calendarDateKey(date), "2026-01-01");
  assert.equal(
    formatCalendarDate("2026-01-01", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    "January 1, 2026",
  );
});
