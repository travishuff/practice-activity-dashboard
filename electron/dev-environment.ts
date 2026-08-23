import { app } from "electron";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pickDevSheetUrl } from "./dev-sheet.ts";

/** Checked in order, so a personal .env.local overrides a shared .env. */
const ENV_FILES = [".env.local", ".env"];

let cachedSheetUrl: string | null | undefined;

/** True only when running from source; a packaged app is never in dev. */
export function isDevEnvironment() {
  return !app.isPackaged;
}

/**
 * Give dev its own settings and cache directory.
 *
 * Without this, `pnpm dev` reads and writes the same userData as the installed
 * app, so connecting a test sheet overwrites the real Practice Log setup.
 * Must run before the app is ready and before anything resolves userData.
 */
export function applyDevUserDataDirectory() {
  if (!isDevEnvironment()) return;
  app.setPath("userData", `${app.getPath("userData")}-dev`);
}

/**
 * The Practice Log dev should open, or null to fall back to saved settings.
 *
 * Returns null in a packaged app, so none of this can affect a real install
 * even if an env file ships alongside it.
 */
export function devSheetUrl(): string | null {
  if (!isDevEnvironment()) return null;
  if (cachedSheetUrl !== undefined) return cachedSheetUrl;

  const contents = ENV_FILES.map(name => {
    try {
      return readFileSync(path.join(process.cwd(), name), "utf8");
    } catch {
      return null;
    }
  });

  cachedSheetUrl = pickDevSheetUrl(process.env, contents);
  return cachedSheetUrl;
}
