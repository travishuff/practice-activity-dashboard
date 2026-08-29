import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSavedPracticeSources,
  practicePeriodEnd,
  practiceSourceLabel,
  removePracticeSource,
  resolveSavedPracticeSource,
  upsertPracticeSource,
} from "../app/practice-sources.ts";

const fallback = {
  url: "https://docs.google.com/spreadsheets/d/original/edit?gid=0",
  periodStart: "2025-09-07",
};

test("practice sources are labeled by their complete 365-day range", () => {
  assert.equal(practicePeriodEnd("2025-09-07"), "2026-09-06");
  assert.equal(
    practiceSourceLabel(fallback),
    "Sep 7, 2025 – Sep 6, 2026",
  );
});

test("adding a source normalizes its URL, replaces duplicates, and sorts newest first", () => {
  const sources = upsertPracticeSource([fallback], {
    url: "https://docs.google.com/spreadsheets/d/next-year/edit#gid=12",
    periodStart: "2026-09-07",
  });
  const replaced = upsertPracticeSource(sources, {
    url: "https://docs.google.com/spreadsheets/d/next-year/edit?usp=sharing&gid=12",
    periodStart: "2026-09-08",
  });

  assert.deepEqual(replaced, [
    {
      url: "https://docs.google.com/spreadsheets/d/next-year/edit?gid=12",
      periodStart: "2026-09-08",
    },
    fallback,
  ]);
});

test("removing a source accepts alternate Google Sheets URL forms", () => {
  const archive = {
    url: "https://docs.google.com/spreadsheets/d/archive/edit?gid=5",
    periodStart: "2024-09-07",
  };

  assert.deepEqual(
    removePracticeSource(
      [fallback, archive],
      "https://docs.google.com/spreadsheets/d/archive/edit#gid=5",
    ),
    [fallback],
  );
  assert.deepEqual(removePracticeSource([fallback], archive.url), [fallback]);
});

test("saved sources tolerate malformed browser data and always retain the default", () => {
  const saved = JSON.stringify([
    { url: "not a sheet", periodStart: "2027-09-07" },
    { url: "https://docs.google.com/spreadsheets/d/archive/edit#gid=5", periodStart: "2024-09-07" },
    { url: "https://docs.google.com/spreadsheets/d/bad-date/edit", periodStart: "September 7" },
  ]);
  const sources = parseSavedPracticeSources(saved, fallback);

  assert.deepEqual(sources, [
    fallback,
    {
      url: "https://docs.google.com/spreadsheets/d/archive/edit?gid=5",
      periodStart: "2024-09-07",
    },
  ]);
  assert.deepEqual(parseSavedPracticeSources("{broken", fallback), [fallback]);
});

test("the remembered selection is used only when it still belongs to a saved source", () => {
  const sources = [
    fallback,
    {
      url: "https://docs.google.com/spreadsheets/d/archive/edit?gid=5",
      periodStart: "2024-09-07",
    },
  ];

  assert.equal(
    resolveSavedPracticeSource(
      sources,
      "https://docs.google.com/spreadsheets/d/archive/edit#gid=5",
      fallback.url,
    ),
    sources[1].url,
  );
  assert.equal(resolveSavedPracticeSource(sources, "not a sheet", fallback.url), fallback.url);
});
