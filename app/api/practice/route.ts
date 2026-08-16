import { snapshot, snapshotAverageHours, snapshotDaysOff, snapshotPracticeDays, snapshotTotalHours } from "../../practice-data";

const FEED = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/gviz/tq?tqx=out:json&gid=0";
type SheetRow = { c: Array<{ v?: unknown; f?: string } | null> };

function parseRows(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Invalid Google Sheets response");
  return JSON.parse(text.slice(start, end + 1)).table.rows as SheetRow[];
}

function parseDays(rows: SheetRow[]) {
  const totals = new Map<number, number>();
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].c || [];
    const day = cells[0]?.v;
    if (typeof day !== "number" || day < 1 || day > 365) continue;
    let minutes = 0;
    for (let offset = 1; i + offset < rows.length; offset += 1) {
      if (typeof rows[i + offset].c?.[0]?.v === "number") break;
      const value = Number(rows[i + offset].c?.[4]?.v);
      if (Number.isFinite(value)) minutes += value;
    }
    totals.set(day, minutes);
  }
  return totals;
}

export async function GET() {
  try {
    const urls = [FEED, `${FEED}&tq=select%20*%20offset%201990`];
    const responses = await Promise.all(urls.map(url => fetch(url, { headers: { "user-agent": "PracticeActivityDashboard/1.0" }, cache: "no-store" })));
    if (responses.some(response => !response.ok)) throw new Error("Sheet is not publicly readable");
    const pages = await Promise.all(responses.map(async response => parseRows(await response.text())));
    const totals = new Map<number, number>();
    for (const page of pages) for (const [day, minutes] of parseDays(page)) totals.set(day, minutes);
    const maximumDay = Math.max(...totals.keys());
    const start = Date.UTC(2025, 8, 7);
    const data = Array.from({ length: maximumDay }, (_, index) => ({ date: new Date(start + index * 86_400_000).toISOString().slice(0, 10), minutes: totals.get(index + 1) || 0 }));
    const summaryRows = pages[0].slice(0, 6);
    const summaryHours = Number(summaryRows.find(row => typeof row.c?.[6]?.v === "number")?.c?.[6]?.v);
    const practiceDays = Number(summaryRows.find(row => Number(row.c?.[4]?.v) >= 100)?.c?.[4]?.v);
    const averageHours = Number(summaryRows.find(row => Number(row.c?.[5]?.v) > 0 && Number(row.c?.[5]?.v) < 10)?.c?.[5]?.v);
    const daysOff = Number(summaryRows.find(row => Number(row.c?.[5]?.v) >= 10)?.c?.[5]?.v);
    return Response.json({ data, totalHours: Number.isFinite(summaryHours) ? summaryHours : snapshotTotalHours, practiceDays: Number.isFinite(practiceDays) ? practiceDays : snapshotPracticeDays, averageHours: Number.isFinite(averageHours) ? averageHours : snapshotAverageHours, daysOff: Number.isFinite(daysOff) ? daysOff : snapshotDaysOff, live: true, checkedAt: new Date().toISOString() });
  } catch {
    return Response.json({ data: snapshot, totalHours: snapshotTotalHours, practiceDays: snapshotPracticeDays, averageHours: snapshotAverageHours, daysOff: snapshotDaysOff, live: false, checkedAt: new Date().toISOString() });
  }
}
