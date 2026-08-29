import { calendarDate, calendarDateKey, DAY, formatCalendarDate } from "./calendar-date.ts";
import { PRACTICE_PERIOD_DAYS } from "./practice-data.ts";
import { normalizePracticeLogUrl } from "./practice-sheet.ts";

export const DEFAULT_PRACTICE_LOG_URL = "https://docs.google.com/spreadsheets/d/1oR05zGWqdEKNy1smZL2tV0WTp2uSknmo9p5riec1y7g/edit?gid=0";
export const PRACTICE_SOURCES_STORAGE_KEY = "practice-activity:sources:v1";
export const ACTIVE_PRACTICE_SOURCE_STORAGE_KEY = "practice-activity:active-source:v1";

export type PracticeSource = {
  url: string;
  periodStart: string;
};

function isCalendarDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = calendarDate(value);
  return Number.isFinite(date.getTime()) && calendarDateKey(date) === value;
}

export function practicePeriodEnd(periodStart: string) {
  return calendarDateKey(new Date(
    calendarDate(periodStart).getTime() + (PRACTICE_PERIOD_DAYS - 1) * DAY,
  ));
}

export function practiceSourceLabel(source: PracticeSource) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${formatCalendarDate(source.periodStart, options)} – ${formatCalendarDate(practicePeriodEnd(source.periodStart), options)}`;
}

export function upsertPracticeSource(
  sources: PracticeSource[],
  source: PracticeSource,
) {
  const normalized = {
    url: normalizePracticeLogUrl(source.url),
    periodStart: source.periodStart,
  };
  if (!isCalendarDateKey(normalized.periodStart)) return sources;

  return [
    ...sources.filter(candidate => (
      normalizePracticeLogUrl(candidate.url) !== normalized.url
    )),
    normalized,
  ].sort((left, right) => right.periodStart.localeCompare(left.periodStart));
}

export function removePracticeSource(
  sources: PracticeSource[],
  sourceUrl: string,
) {
  const normalizedUrl = normalizePracticeLogUrl(sourceUrl);
  return sources.filter(source => source.url !== normalizedUrl);
}

export function parseSavedPracticeSources(
  raw: string | null,
  fallback: PracticeSource,
) {
  let saved: unknown = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }

  let sources = upsertPracticeSource([], fallback);
  if (!Array.isArray(saved)) return sources;

  for (const candidate of saved) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as Partial<PracticeSource>;
    if (typeof value.url !== "string" || !isCalendarDateKey(value.periodStart)) continue;
    try {
      sources = upsertPracticeSource(sources, {
        url: value.url,
        periodStart: value.periodStart,
      });
    } catch {
      // Ignore stale or malformed local entries without blocking the dashboard.
    }
  }
  return sources;
}

export function resolveSavedPracticeSource(
  sources: PracticeSource[],
  savedUrl: string | null,
  fallbackUrl: string,
) {
  try {
    const normalized = savedUrl ? normalizePracticeLogUrl(savedUrl) : "";
    if (sources.some(source => source.url === normalized)) return normalized;
  } catch {
    // Fall through to the known source.
  }
  return normalizePracticeLogUrl(fallbackUrl);
}
