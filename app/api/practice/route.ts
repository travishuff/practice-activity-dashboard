import { snapshot, snapshotTotalHours } from "../../practice-data";
import { createFallbackPayload, fetchPracticePayload } from "../../practice-sheet";

const BASE_FEED = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/gviz/tq?tqx=out:json&gid=0";
const DATA_FEED = `${BASE_FEED}&range=A:E`;
const TOTAL_FEED = `${BASE_FEED}&range=G6`;
const NO_STORE = { "cache-control": "no-store, max-age=0" };

export async function GET() {
  try {
    const payload = await fetchPracticePayload(fetch, DATA_FEED, TOTAL_FEED);
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
