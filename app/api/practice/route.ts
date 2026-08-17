import { snapshot, snapshotTotalHours } from "../../practice-data";

const FEED = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/gviz/tq?tqx=out:json&gid=0";
type SheetRow = { c: Array<{ v?: unknown; f?: string } | null> };

function cellNumber(cell: SheetRow["c"][number]) {
  const raw = cell?.v;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function cellText(cell: SheetRow["c"][number]) {
  const raw = cell?.f ?? cell?.v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function parseRows(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Invalid Google Sheets response");
  return JSON.parse(text.slice(start, end + 1)).table.rows as SheetRow[];
}

function mergePages(pages: SheetRow[][]) {
  const rows = [...pages[0]];
  for (const page of pages.slice(1)) {
    const continuation = JSON.stringify(page[0]) === JSON.stringify(pages[0][0]) ? page.slice(1) : page;
    let overlap = 0;
    for (let start = Math.max(0, rows.length - continuation.length); start < rows.length; start += 1) {
      if (JSON.stringify(rows[start]) !== JSON.stringify(continuation[0])) continue;
      let matched = 0;
      while (start + matched < rows.length && matched < continuation.length && JSON.stringify(rows[start + matched]) === JSON.stringify(continuation[matched])) matched += 1;
      if (start + matched === rows.length) overlap = Math.max(overlap, matched);
    }
    rows.push(...continuation.slice(overlap));
  }
  return rows;
}

function parseDate(cell: SheetRow["c"][number]) {
  const raw = typeof cell?.v === "string" ? cell.v : "";
  const serialized = raw.match(/^Date\((\d+),(\d+),(\d+)\)$/);
  if (serialized) return new Date(Date.UTC(Number(serialized[1]), Number(serialized[2]), Number(serialized[3]))).toISOString().slice(0, 10);
  const displayed = cell?.f?.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!displayed) return null;
  const year = Number(displayed[3]) < 100 ? 2000 + Number(displayed[3]) : Number(displayed[3]);
  return new Date(Date.UTC(year, Number(displayed[1]) - 1, Number(displayed[2]))).toISOString().slice(0, 10);
}

function parseDays(rows: SheetRow[]) {
  const datedHeaders = rows.flatMap(row => {
    const day = cellNumber(row.c?.[0]);
    const date = parseDate(row.c?.[1]);
    return day !== null && Number.isInteger(day) && day >= 1 && day <= 365 && date ? [{ day, date }] : [];
  });
  const anchor = datedHeaders[0];
  const start = anchor ? Date.parse(`${anchor.date}T00:00:00Z`) - (anchor.day - 1) * 86_400_000 : Number.NaN;
  const lastDatedDay = Math.max(...datedHeaders.map(header => header.day));
  const data: Array<{ date: string; minutes: number; items: string[] }> = [];
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].c || [];
    const day = cellNumber(cells[0]);
    if (day === null || !Number.isInteger(day) || day < 1 || day > 365) continue;
    const date = parseDate(cells[1]) ?? (Number.isFinite(start) && day <= lastDatedDay ? new Date(start + (day - 1) * 86_400_000).toISOString().slice(0, 10) : null);
    let minutes = 0;
    const items: string[] = [];
    for (let offset = 1; i + offset < rows.length; offset += 1) {
      if (cellNumber(rows[i + offset].c?.[0]) !== null) break;
      const value = cellNumber(rows[i + offset].c?.[4]);
      const item = cellText(rows[i + offset].c?.[2]);
      if (value !== null) {
        minutes += value;
        if (value > 0 && item && !items.includes(item)) items.push(item);
      }
    }
    if (date) data.push({ date, minutes, items });
  }
  return data;
}

export async function GET() {
  try {
    const urls = [FEED, `${FEED}&tq=select%20*%20offset%201990`];
    const responses = await Promise.all(urls.map(url => fetch(url, { headers: { "user-agent": "PracticeActivityDashboard/1.0" }, cache: "no-store" })));
    if (responses.some(response => !response.ok)) throw new Error("Sheet is not publicly readable");
    const pages = await Promise.all(responses.map(async response => parseRows(await response.text())));
    const data = parseDays(mergePages(pages));
    const summaryRows = pages[0].slice(0, 6);
    const summaryHours = summaryRows.map(row => cellNumber(row.c?.[6])).find(value => value !== null) ?? Number.NaN;
    const totalHours = data.reduce((sum, day) => sum + day.minutes, 0) / 60;
    if (!Number.isFinite(summaryHours) || Math.abs(summaryHours - totalHours) >= 0.005) throw new Error("Daily values do not reconcile with G6");
    return Response.json({ data, totalHours, live: true, checkedAt: new Date().toISOString() });
  } catch {
    return Response.json({ data: snapshot, totalHours: snapshotTotalHours, live: false, checkedAt: new Date().toISOString() });
  }
}
