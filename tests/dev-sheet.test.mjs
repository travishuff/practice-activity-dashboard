import assert from "node:assert/strict";
import test from "node:test";
import {
  DEV_SHEET_URL_KEY,
  parseEnvFile,
  pickDevSheetUrl,
} from "../electron/dev-sheet.ts";

const SHEET = "https://docs.google.com/spreadsheets/d/from-file/edit";
const OTHER = "https://docs.google.com/spreadsheets/d/from-env/edit";
const file = `# Practice Log used by pnpm dev\n${DEV_SHEET_URL_KEY}=${SHEET}\n`;

test("env file parsing handles comments, blanks, quotes, and export", () => {
  assert.deepEqual(
    parseEnvFile([
      "# a comment",
      "",
      "  ",
      `${DEV_SHEET_URL_KEY}="${SHEET}"`,
      "export OTHER_KEY = plain ",
      "SINGLE='quoted'",
      "not-a-pair",
      "=novalue",
    ].join("\n")),
    {
      [DEV_SHEET_URL_KEY]: SHEET,
      OTHER_KEY: "plain",
      SINGLE: "quoted",
    },
  );
});

test("a value containing = survives, since URLs carry query strings", () => {
  const withQuery = "https://docs.google.com/spreadsheets/d/x/edit?gid=7&a=b";
  assert.equal(
    parseEnvFile(`${DEV_SHEET_URL_KEY}=${withQuery}`)[DEV_SHEET_URL_KEY],
    withQuery,
  );
});

test("the default comes from the file when nothing is in the environment", () => {
  assert.equal(pickDevSheetUrl({}, [file]), SHEET);
});

test("a per-use environment variable beats the configured default", () => {
  assert.equal(
    pickDevSheetUrl({ [DEV_SHEET_URL_KEY]: OTHER }, [file]),
    OTHER,
  );
});

test("earlier files win, so .env.local overrides .env", () => {
  const fallback = `${DEV_SHEET_URL_KEY}=${OTHER}`;
  assert.equal(pickDevSheetUrl({}, [file, fallback]), SHEET);
  assert.equal(pickDevSheetUrl({}, [null, fallback]), OTHER);
});

test("a blank environment value falls back instead of selecting nothing", () => {
  assert.equal(pickDevSheetUrl({ [DEV_SHEET_URL_KEY]: "   " }, [file]), SHEET);
});

test("no configuration anywhere selects nothing", () => {
  assert.equal(pickDevSheetUrl({}, [null, null]), null);
  assert.equal(pickDevSheetUrl({}, [`${DEV_SHEET_URL_KEY}=`]), null);
});

test("surrounding whitespace is trimmed off a configured URL", () => {
  assert.equal(
    pickDevSheetUrl({ [DEV_SHEET_URL_KEY]: `  ${OTHER}  ` }, []),
    OTHER,
  );
});
