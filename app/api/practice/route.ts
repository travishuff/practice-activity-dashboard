import { snapshot, snapshotPeriodStart, snapshotTotalHours } from "../../practice-data";
import { DEFAULT_PRACTICE_LOG_URL } from "../../practice-sources";
import {
  buildSheetDataFeed,
  createFallbackPayload,
  fetchPracticePayload,
  normalizePracticeLogUrl,
  PracticeSheetError,
} from "../../practice-sheet";

const NO_STORE = { "cache-control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const requestedUrl = new URL(request.url).searchParams.get("url")
    ?? DEFAULT_PRACTICE_LOG_URL;
  let normalizedUrl: string | null = null;

  try {
    normalizedUrl = normalizePracticeLogUrl(requestedUrl);
    const payload = await fetchPracticePayload(fetch, buildSheetDataFeed(normalizedUrl));
    if (payload.warnings.length) console.warn("Practice sheet data warnings", payload.warnings);
    return Response.json(payload, { headers: NO_STORE });
  } catch (error) {
    console.error("Practice sheet refresh failed", error);
    const useSnapshot = normalizedUrl === DEFAULT_PRACTICE_LOG_URL;
    return Response.json(createFallbackPayload(
      error,
      useSnapshot ? snapshot : [],
      useSnapshot ? snapshotTotalHours : 0,
      useSnapshot ? snapshotPeriodStart : null,
    ), {
      status: error instanceof PracticeSheetError && error.code === "invalid_source"
        ? 400
        : 502,
      headers: NO_STORE,
    });
  }
}
