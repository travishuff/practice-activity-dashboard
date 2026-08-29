import {
  calendarDate,
  calendarDateKey,
  DAY,
} from "./calendar-date.ts";
import type { PracticeDay } from "./practice-data";
import { summarizePracticePeriod } from "./practice-metrics.ts";

export type ActivityCell = {
  date: string;
  minutes: number;
  items: string[];
  inRange: boolean;
  elapsed: boolean;
};

export function practiceLevel(minutes: number) {
  return minutes === 0
    ? 0
    : minutes < 60
      ? 1
      : minutes < 120
        ? 2
        : minutes < 180
          ? 3
          : 4;
}

export function buildActivityView(
  data: PracticeDay[],
  periodStart: string | null,
  today: string,
) {
  const summary = summarizePracticePeriod(data, { periodStart, today });
  const period = new Map(summary.days.map(day => [day.date, day]));
  const firstDay = calendarDate(summary.days[0].date);
  const periodEnd = calendarDate(summary.days[summary.days.length - 1].date);
  const calendarStart = new Date(firstDay);
  calendarStart.setUTCDate(calendarStart.getUTCDate() - calendarStart.getUTCDay());

  const cells: ActivityCell[] = [];
  for (
    let date = new Date(calendarStart);
    date <= periodEnd;
    date = new Date(date.getTime() + DAY)
  ) {
    const key = calendarDateKey(date);
    const day = period.get(key);
    cells.push({
      date: key,
      minutes: day?.minutes ?? 0,
      items: day?.items ?? [],
      inRange: Boolean(day),
      elapsed: day?.elapsed ?? false,
    });
  }

  while (cells.length % 7) {
    const date = new Date(calendarDate(cells[cells.length - 1].date).getTime() + DAY);
    cells.push({
      date: calendarDateKey(date),
      minutes: 0,
      items: [],
      inRange: false,
      elapsed: false,
    });
  }

  const weeks = cells.length / 7;
  const months: Array<{ label: string; column: number }> = [];
  const years: Array<{ label: string; column: number }> = [];
  let previousMonth = "";
  let previousYear = "";

  cells.forEach((cell, index) => {
    if (index % 7 !== 0) return;
    const date = calendarDate(cell.date);
    const month = date.toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    const column = Math.floor(index / 7) + 1;
    const year = String(date.getUTCFullYear());
    if (month !== previousMonth) {
      months.push({ label: month, column });
      previousMonth = month;
    }
    if (year !== previousYear) {
      years.push({ label: year, column });
      previousYear = year;
    }
  });

  return { cells, weeks, months, years, summary };
}
