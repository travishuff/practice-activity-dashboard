import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSheetDataFeed,
  calculateTotalHours,
  fetchPracticePayload,
  parseGvizRows,
  parsePracticeDays,
  PracticeSheetError,
} from "../app/practice-sheet.ts";
import { PRACTICE_PERIOD_DAYS } from "../app/practice-data.ts";

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
    periodStart: "2025-09-07",
  });
});

test("undated practice is retained with an explicit source warning", () => {
  const rows = [...practiceRows];
  rows[6] = row([null, null, "Future practice", null, 45]);
  assert.deepEqual(parsePracticeDays(rows), {
    data: [
      { date: "2025-09-07", minutes: 90, items: ["Rudiments", "Grooves"] },
      { date: "2025-09-08", minutes: 0, items: [] },
      { date: "2025-09-09", minutes: 45, items: ["Future practice"] },
    ],
    warnings: ["Day 3 has practice time but no date; using 2025-09-09"],
    periodStart: "2025-09-07",
  });
});

test("a stray number in the day column no longer truncates the day", () => {
  // Column A holds 999 partway through day 1. The header scan ignores it (it is
  // not a day number), so the item loop must not treat it as a boundary either.
  const rows = [
    row([1, ["Date(2025,8,7)", "9-7-25"]]),
    row([null, null, "Rudiments", null, 60]),
    row([999, null, "TOTALS", null, 60]),
    row([null, null, "Grooves", null, 45]),
    row([2, ["Date(2025,8,8)", "9-8-25"]]),
    row([null, null, "Fills", null, 30]),
  ];

  assert.deepEqual(parsePracticeDays(rows), {
    data: [
      // 60 + 45. The 60 on the TOTALS row is deliberately not counted.
      { date: "2025-09-07", minutes: 105, items: ["Rudiments", "Grooves"] },
      { date: "2025-09-08", minutes: 30, items: ["Fills"] },
    ],
    warnings: ["Day 1: ignored a row whose day column reads 999"],
    periodStart: "2025-09-07",
  });
});

test("a trailing totals row is reported rather than silently swallowing practice", () => {
  const rows = [
    row([1, ["Date(2025,8,7)", "9-7-25"]]),
    row([null, null, "Rudiments", null, 60]),
    row([0, null, "Grand total", null, 60]),
  ];
  const parsed = parsePracticeDays(rows);

  assert.deepEqual(parsed.data, [
    { date: "2025-09-07", minutes: 60, items: ["Rudiments"] },
  ]);
  assert.deepEqual(parsed.warnings, [
    "Day 1: ignored a row whose day column reads 0",
  ]);
});

test("repeated identical anomalies collapse into one warning", () => {
  const rows = [
    row([1, ["Date(2025,8,7)", "9-7-25"]]),
    row([999, null, "TOTALS", null, 10]),
    row([null, null, "Rudiments", null, 60]),
    row([999, null, "TOTALS", null, 10]),
  ];
  const parsed = parsePracticeDays(rows);

  assert.equal(parsed.data[0].minutes, 60);
  assert.equal(parsed.warnings.length, 1);
});

test("the live payload calculates total hours from daily minutes", async () => {
  const fetcher = async url => {
    if (url.endsWith("range=A:E")) return new Response(gviz(practiceRows));
    return new Response(null, { status: 404 });
  };

  const payload = await fetchPracticePayload(
    fetcher,
    "https://example.test/sheet?range=A:E",
  );
  assert.equal(payload.live, true);
  assert.equal(payload.periodStart, "2025-09-07");
  assert.equal(payload.totalHours, 1.5);
  assert.equal(payload.error, null);
  assert.deepEqual(payload.warnings, []);
  assert.deepEqual(payload.data[0].items, ["Rudiments", "Grooves"]);
});

test("total hours are derived from every occurred day's minutes", () => {
  assert.equal(
    calculateTotalHours([
      { date: "2025-09-07", minutes: 90 },
      { date: "2025-09-08", minutes: 0 },
      { date: "2025-09-09", minutes: 45 },
    ]),
    2.25,
  );
});

test("every parsed date lands inside the summary window", () => {
  // Day numbers are bounded by PRACTICE_PERIOD_DAYS and each date is pinned to
  // periodStart + (day - 1), so parsed data can never fall outside the window
  // the dashboard renders. Rows outside that range are reported, not accepted.
  const rows = [row([1, ["Date(2025,0,1)", "1-1-25"]]), row([null, null, "X", null, 60])];
  for (const dayColumn of [PRACTICE_PERIOD_DAYS, PRACTICE_PERIOD_DAYS + 1, 400, 0, -1, 1.5]) {
    rows.push(row([dayColumn, null]), row([null, null, "Y", null, 30]));
  }

  const parsed = parsePracticeDays(rows);
  const start = Date.parse(`${parsed.periodStart}T00:00:00Z`);
  const offsets = parsed.data.map(
    day => (Date.parse(`${day.date}T00:00:00Z`) - start) / 86_400_000,
  );

  assert.deepEqual(offsets, [0, PRACTICE_PERIOD_DAYS - 1]);
  assert.ok(Math.max(...offsets) < PRACTICE_PERIOD_DAYS);
  assert.ok(parsed.data.length <= PRACTICE_PERIOD_DAYS);
});

test("Google Sheets sharing URLs become A:E feeds", () => {
  assert.equal(
    buildSheetDataFeed("https://docs.google.com/spreadsheets/d/example-sheet/edit?usp=sharing#gid=42"),
    "https://docs.google.com/spreadsheets/d/example-sheet/gviz/tq?tqx=out:json&gid=42&range=A:E",
  );
  assert.equal(
    buildSheetDataFeed("https://docs.google.com/spreadsheets/d/example-sheet/edit?gid=7"),
    "https://docs.google.com/spreadsheets/d/example-sheet/gviz/tq?tqx=out:json&gid=7&range=A:E",
  );
  assert.throws(
    () => buildSheetDataFeed("https://example.com/not-a-sheet"),
    error => error instanceof PracticeSheetError && error.code === "invalid_source",
  );
});
