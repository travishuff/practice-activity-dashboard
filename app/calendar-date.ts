export const DAY = 86_400_000;

export function calendarDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function calendarDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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
