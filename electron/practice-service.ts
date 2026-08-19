import type { PracticeResult, SetupStatus } from "../app/electron-api";
import {
  buildSheetDataFeed,
  fetchPracticePayload,
  PracticeSheetError,
} from "../app/practice-sheet";
import type { PracticePayload } from "../app/practice-sheet";
import {
  readCache,
  readSettings,
  writeCache,
  writeSettings,
} from "./settings-store";

function errorResult(error: unknown): Extract<PracticeResult, { ok: false }> {
  if (error instanceof PracticeSheetError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message },
    };
  }

  console.error("Practice Log operation failed", error);
  return {
    ok: false,
    error: {
      code: "refresh_failed",
      message: "Practice Activity could not save or refresh the Practice Log",
    },
  };
}

async function fetchSheet(sheetUrl: string) {
  const feedUrl = buildSheetDataFeed(sheetUrl);
  return fetchPracticePayload(fetch, feedUrl);
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const settings = await readSettings();
  return {
    configured: Boolean(settings),
    sheetUrl: settings?.sheetUrl ?? null,
  };
}

export async function configurePracticeLog(sheetUrl: string): Promise<PracticeResult> {
  const normalizedUrl = sheetUrl.trim();

  try {
    const payload = await fetchSheet(normalizedUrl);
    await writeSettings({ sheetUrl: normalizedUrl });
    await writeCache(normalizedUrl, payload);
    return { ok: true, payload };
  } catch (error) {
    return errorResult(error);
  }
}

export async function getPracticeData(): Promise<PracticeResult> {
  const settings = await readSettings();
  if (!settings) {
    return {
      ok: false,
      error: {
        code: "not_configured",
        message: "Choose a Practice Log before opening the dashboard",
      },
    };
  }

  try {
    const payload = await fetchSheet(settings.sheetUrl);
    await writeCache(settings.sheetUrl, payload);
    return { ok: true, payload };
  } catch (error) {
    const failure = errorResult(error);
    const cached = await readCache(settings.sheetUrl);
    if (!cached) return failure;

    const payload: PracticePayload = {
      ...cached,
      live: false,
      error: failure.error,
    };
    return { ok: true, payload };
  }
}
