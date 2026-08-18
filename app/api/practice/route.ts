import { snapshot, snapshotTotalHours } from "../../practice-data";
import {
  buildSheetDataFeed,
  createFallbackPayload,
  fetchPracticePayload,
} from "../../practice-sheet";

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/edit#gid=0";
const NO_STORE = { "cache-control": "no-store, max-age=0" };

export async function GET() {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_URL ?? DEFAULT_SHEET_URL;
    const payload = await fetchPracticePayload(fetch, buildSheetDataFeed(sheetUrl));
    if (payload.warnings.length) console.warn("Practice sheet data warnings", payload.warnings);
    return Response.json(payload, { headers: NO_STORE });
  } catch (error) {
    console.error("Practice sheet refresh failed", error);
    return Response.json(createFallbackPayload(error, snapshot, snapshotTotalHours), {
      status: 502,
      headers: NO_STORE,
    });
  }
}
