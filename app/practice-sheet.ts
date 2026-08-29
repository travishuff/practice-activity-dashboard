import { PRACTICE_PERIOD_DAYS, type PracticeDay } from "./practice-data.ts";

export type SheetCell = { v?: unknown; f?: string } | null | undefined;
export type SheetRow = { c?: SheetCell[] };
export type PracticeDataErrorCode =
  | "source_unavailable"
  | "invalid_source"
  | "refresh_failed";

export type PracticePayload = {
  data: PracticeDay[];
  periodStart: string | null;
  totalHours: number;
  live: boolean;
  checkedAt: string | null;
  error: { code: PracticeDataErrorCode; message: string } | null;
  warnings: string[];
};

export class PracticeSheetError extends Error {
  public readonly code: Exclude<PracticeDataErrorCode, "refresh_failed">;

  constructor(
    code: Exclude<PracticeDataErrorCode, "refresh_failed">,
    message: string,
  ) {
    super(message);
    this.name = "PracticeSheetError";
    this.code = code;
  }
}

function cellNumber(cell: SheetCell) {
  const raw = cell?.v;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isDayNumber(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= PRACTICE_PERIOD_DAYS;
}

function cellText(cell: SheetCell) {
  const raw = cell?.f ?? cell?.v;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date.toISOString().slice(0, 10);
}

function parseDate(cell: SheetCell) {
  const raw = typeof cell?.v === "string" ? cell.v : "";
  const serialized = raw.match(/^Date\((\d+),(\d+),(\d+)\)$/);
  if (serialized) {
    return isoDate(
      Number(serialized[1]),
      Number(serialized[2]) + 1,
      Number(serialized[3]),
    );
  }

  const displayed = cell?.f?.match(/^(\d{1,2})[-/]((?:\d{1,2}))[-/](\d{2,4})$/);
  if (!displayed) return null;
  const year = Number(displayed[3]) < 100 ? 2000 + Number(displayed[3]) : Number(displayed[3]);
  return isoDate(year, Number(displayed[1]), Number(displayed[2]));
}

export function parseGvizRows(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new PracticeSheetError("invalid_source", "Google Sheets returned an invalid response");
  }

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { table?: { rows?: unknown } };
    if (!Array.isArray(parsed.table?.rows)) throw new Error("Missing table rows");
    return parsed.table.rows as SheetRow[];
  } catch (error) {
    if (error instanceof PracticeSheetError) throw error;
    throw new PracticeSheetError("invalid_source", "Google Sheets returned an invalid response");
  }
}

export function parsePracticeDays(rows: SheetRow[]) {
  const headers = rows.flatMap((row, index) => {
    const cells = row.c ?? [];
    const day = cellNumber(cells[0]);
    if (day === null || !isDayNumber(day)) return [];
    return [{ index, day, date: parseDate(cells[1]), rawDate: cellText(cells[1]) }];
  });

  const datedHeaders = headers.filter(
    (header): header is typeof header & { date: string } => Boolean(header.date),
  );
  if (!datedHeaders.length) {
    throw new PracticeSheetError("invalid_source", "No dated practice days were found");
  }

  const anchor = datedHeaders[0];
  const periodStart = Date.parse(`${anchor.date}T00:00:00Z`) - (anchor.day - 1) * 86_400_000;
  const seenDays = new Set<number>();
  const seenDates = new Set<string>();
  const data: PracticeDay[] = [];
  const warnings: string[] = [];

  for (const header of headers) {
    if (seenDays.has(header.day)) {
      throw new PracticeSheetError("invalid_source", `Day ${header.day} appears more than once`);
    }
    seenDays.add(header.day);

    if (header.rawDate && !header.date) {
      throw new PracticeSheetError("invalid_source", `Day ${header.day} has an invalid date`);
    }

    let minutes = 0;
    const items: string[] = [];
    for (let index = header.index + 1; index < rows.length; index += 1) {
      const dayColumn = cellNumber(rows[index].c?.[0]);
      if (dayColumn !== null) {
        if (isDayNumber(dayColumn)) break;
        warnings.push(`Day ${header.day}: ignored a row whose day column reads ${dayColumn}`);
        continue;
      }
      const value = cellNumber(rows[index].c?.[4]);
      if (value === null) continue;
      if (value < 0) {
        throw new PracticeSheetError("invalid_source", `Day ${header.day} contains negative practice time`);
      }
      minutes += value;
      const item = cellText(rows[index].c?.[2]);
      if (value > 0 && item && !items.includes(item)) items.push(item);
    }

    const expectedDate = new Date(periodStart + (header.day - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    if (header.date && header.date !== expectedDate) {
      throw new PracticeSheetError("invalid_source", `Day ${header.day} does not match its calendar date`);
    }

    // A blank column-B cell with no practice remains a future day. If minutes
    // exist, the source contradicts itself because G6 includes them; preserve
    // reconciliation but expose the inferred date as a visible warning.
    if (!header.date && minutes === 0) continue;
    const resolvedDate = header.date ?? expectedDate;
    if (!header.date) {
      warnings.push(`Day ${header.day} has practice time but no date; using ${resolvedDate}`);
    }
    if (seenDates.has(resolvedDate)) {
      throw new PracticeSheetError("invalid_source", `Date ${resolvedDate} appears more than once`);
    }
    seenDates.add(resolvedDate);
    data.push({ date: resolvedDate, minutes, items });
  }

  return {
    data,
    warnings: [...new Set(warnings)],
    periodStart: new Date(periodStart).toISOString().slice(0, 10),
  };
}

export function calculateTotalHours(data: PracticeDay[]) {
  return data.reduce((sum, day) => sum + day.minutes, 0) / 60;
}

export function normalizePracticeLogUrl(sheetUrl: string) {
  let url: URL;
  try {
    url = new URL(sheetUrl.trim());
  } catch {
    throw new PracticeSheetError("invalid_source", "Enter a valid Google Sheets sharing URL");
  }

  const id = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const gid = url.searchParams.get("gid") ?? hash.get("gid") ?? "0";
  if (url.hostname !== "docs.google.com" || !id || !/^\d+$/.test(gid)) {
    throw new PracticeSheetError(
      "invalid_source",
      "The URL must point to a worksheet in Google Sheets",
    );
  }

  return `https://docs.google.com/spreadsheets/d/${id}/edit?gid=${gid}`;
}

export function buildSheetDataFeed(sheetUrl: string) {
  const normalized = new URL(normalizePracticeLogUrl(sheetUrl));
  const id = normalized.pathname.split("/")[3];
  const gid = normalized.searchParams.get("gid") ?? "0";
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}&range=A:E`;
}

export async function fetchPracticePayload(
  fetcher: typeof fetch,
  dataUrl: string,
  timeoutMs = 10_000,
): Promise<PracticePayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const options: RequestInit = {
      headers: { "user-agent": "PracticeActivityDashboard/1.0" },
      cache: "no-store",
      signal: controller.signal,
    };
    const dataResponse = await fetcher(dataUrl, options);
    if (!dataResponse.ok) {
      throw new PracticeSheetError("source_unavailable", "The live sheet is temporarily unavailable");
    }

    const dataRows = parseGvizRows(await dataResponse.text());
    const { data, warnings, periodStart } = parsePracticeDays(dataRows);
    return {
      data,
      periodStart,
      totalHours: calculateTotalHours(data),
      live: true,
      checkedAt: new Date().toISOString(),
      error: null,
      warnings,
    };
  } catch (error) {
    if (error instanceof PracticeSheetError) throw error;
    throw new PracticeSheetError("source_unavailable", "The live sheet is temporarily unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export function createFallbackPayload(
  error: unknown,
  data: PracticeDay[],
  totalHours: number,
  periodStart: string | null,
): PracticePayload {
  const knownError = error instanceof PracticeSheetError
    ? error
    : new PracticeSheetError("source_unavailable", "The live sheet is temporarily unavailable");
  return {
    data,
    periodStart,
    totalHours,
    live: false,
    checkedAt: null,
    error: { code: knownError.code, message: knownError.message },
    warnings: [],
  };
}
