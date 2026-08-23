export const DAY = 86_400_000;

export function calendarDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function calendarDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Today as a calendar date in the viewer's own time zone.
 *
 * Practice Log dates are time-zone-free calendar dates, so every other date in
 * the app is normalized to UTC. "Today" is the one value that must not be:
 * at 19:30 in Los Angeles `calendarDateKey(new Date())` already reports
 * tomorrow, which would age the period forward a day every evening.
 */
export function localCalendarDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(candidate => candidate.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whole calendar days from `from` to `to`; negative when `to` precedes `from`. */
export function calendarDaysBetween(from: string, to: string) {
  return Math.round(
    (calendarDate(to).getTime() - calendarDate(from).getTime()) / DAY,
  );
}

export function formatCalendarDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
) {
  return calendarDate(value).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}
