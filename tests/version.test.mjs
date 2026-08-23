import assert from "node:assert/strict";
import test from "node:test";
import packageJson from "../package.json" with { type: "json" };
import { APP_VERSION } from "../app/version.ts";

test("the displayed app version matches the packaged installer version", () => {
  assert.equal(APP_VERSION, packageJson.version);
});
