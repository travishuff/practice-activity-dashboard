import assert from "node:assert/strict";
import test from "node:test";
import {
  createFallbackPayload,
  fetchPracticePayload,
  parseGvizRows,
  parsePracticeDays,
  PracticeSheetError,
} from "../app/practice-sheet.ts";

function cell(value, formatted) {
  return value === null ? null : { v: value, ...(formatted ? { f: formatted } : {}) };
}

function row(values) {
  return { c: values.map(value => Array.isArray(value) ? cell(value[0], value[1]) : cell(value)) };
}

function gviz(rows) {
  return `google.visualization.Query.setResponse(${JSON.stringify({ table: { rows } })});`;
}

const practiceRows = [
  row([1, ["Date(2025,8,7)", "9-7-25"]]),
  row([null, null, "Rudiments", null, 60]),
  row([null, null, "Grooves", null, 30]),
  row([2, ["Date(2025,8,8)", "9-8-25"]]),
  row([null, null, "Day off", null, 0]),
  row([3, null]),
  row([null, null, null, null, 0]),
];

test("GViz parsing validates the response envelope", () => {
  assert.deepEqual(parseGvizRows(gviz(practiceRows)), practiceRows);
  assert.throws(
    () => parseGvizRows("not a Google Sheets response"),
    error => error instanceof PracticeSheetError && error.code === "invalid_source",
  );
});

test("a blank column-B cell with no practice remains a future day", () => {
  assert.deepEqual(parsePracticeDays(practiceRows), {
    data: [
      { date: "2025-09-07", minutes: 90, items: ["Rudiments", "Grooves"] },
      { date: "2025-09-08", minutes: 0, items: [] },
    ],
    warnings: [],
  });
});

test("undated practice is reconciled with an explicit source warning", () => {
  const rows = [...practiceRows];
  rows[6] = row([null, null, "Future practice", null, 45]);
  assert.deepEqual(parsePracticeDays(rows), {
    data: [
      { date: "2025-09-07", minutes: 90, items: ["Rudiments", "Grooves"] },
      { date: "2025-09-08", minutes: 0, items: [] },
      { date: "2025-09-09", minutes: 45, items: ["Future practice"] },
    ],
    warnings: ["Day 3 has practice time but no date; using 2025-09-09"],
  });
});

test("the live payload reconciles daily minutes against an exact G6 response", async () => {
  const fetcher = async url => {
    if (url.endsWith("range=A:E")) return new Response(gviz(practiceRows));
    if (url.endsWith("range=G6")) return new Response(gviz([row([1.5])]));
    return new Response(null, { status: 404 });
  };

  const payload = await fetchPracticePayload(
    fetcher,
    "https://example.test/sheet?range=A:E",
    "https://example.test/sheet?range=G6",
  );
  assert.equal(payload.live, true);
  assert.equal(payload.totalHours, 1.5);
  assert.equal(payload.error, null);
  assert.deepEqual(payload.warnings, []);
  assert.deepEqual(payload.data[0].items, ["Rudiments", "Grooves"]);
});

test("a G6 mismatch is classified as a reconciliation failure", async () => {
  const fetcher = async url => new Response(
    url.endsWith("range=G6") ? gviz([row([2])]) : gviz(practiceRows),
  );
  await assert.rejects(
    fetchPracticePayload(
      fetcher,
      "https://example.test/sheet?range=A:E",
      "https://example.test/sheet?range=G6",
    ),
    error => error instanceof PracticeSheetError && error.code === "reconciliation_failed",
  );
});

test("fallback responses expose a degraded state instead of claiming success", () => {
  const error = new PracticeSheetError("source_unavailable", "The live sheet is temporarily unavailable");
  const fallback = createFallbackPayload(error, [{ date: "2025-09-07", minutes: 90 }], 1.5);
  assert.deepEqual(fallback, {
    data: [{ date: "2025-09-07", minutes: 90 }],
    totalHours: 1.5,
    live: false,
    checkedAt: null,
    error: { code: "source_unavailable", message: "The live sheet is temporarily unavailable" },
    warnings: [],
  });
});
