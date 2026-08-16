import { snapshot } from "../../practice-data";

const FEED = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/gviz/tq?tqx=out:json&gid=0";

function parseFeed(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Invalid Google Sheets response");
  const rows = JSON.parse(text.slice(start, end + 1)).table.rows as Array<{ c: Array<{ v?: unknown; f?: string } | null> }>;
  const days: Array<{ date: string; minutes: number }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].c || [];
    const day = cells[0]?.v;
    const formatted = cells[1]?.f || String(cells[1]?.v || "");
    const match = formatted.match(/(\d{1,2})[-/]\s*(\d{1,2})[-/]\s*(\d{2,4})/);
    if (typeof day !== "number" || !match) continue;
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
    let minutes = 0;
    for (let offset = 1; offset <= 6 && i + offset < rows.length; offset += 1) {
      const value = Number(rows[i + offset].c?.[4]?.v);
      if (Number.isFinite(value)) minutes += value;
    }
    days.push({ date, minutes });
  }
  if (!days.length) throw new Error("No practice rows found");
  return days;
}

export async function GET() {
  try {
    const response = await fetch(FEED, { headers: { "user-agent": "PracticeActivityDashboard/1.0" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
    return Response.json({ data: parseFeed(await response.text()), live: true, checkedAt: new Date().toISOString() });
  } catch {
    return Response.json({ data: snapshot, live: false, checkedAt: new Date().toISOString() });
  }
}
