export const DAY = 86_400_000;

export function calendarDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function calendarDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

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
