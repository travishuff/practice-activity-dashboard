import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeUserName,
  practiceActivityTitle,
} from "../app/user-name.ts";

test("user names are trimmed before being saved", () => {
  assert.equal(normalizeUserName("  Travis Huff  "), "Travis Huff");
});

test("blank names are treated as omitted", () => {
  assert.equal(normalizeUserName("   "), null);
  assert.equal(normalizeUserName(null), null);
});

test("the app title includes a provided user name", () => {
  assert.equal(
    practiceActivityTitle("Travis Huff"),
    "Practice Activity: Travis Huff",
  );
});

test("the app title remains generic when no name is provided", () => {
  assert.equal(practiceActivityTitle(""), "Practice Activity");
  assert.equal(practiceActivityTitle(null), "Practice Activity");
});
