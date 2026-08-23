import {
  calendarDate,
  calendarDateKey,
  calendarDaysBetween,
  DAY,
  localCalendarDateKey,
} from "./calendar-date.ts";
import { PRACTICE_PERIOD_DAYS, type PracticeDay } from "./practice-data.ts";

export type RollingPracticeSummary = {
  days: Array<{ date: string; minutes: number; items: string[]; elapsed: boolean }>;
  periodStart: string;
  today: string;
  elapsedDays: number;
  practiceDays: number;
  daysOff: number;
  remainingDays: number;
  daily: { minimum: number; average: number; maximum: number };
  streaks: { minimum: number; average: number; maximum: number };
};

type SummaryOptions = {
  periodStart?: string | null;
  today?: string;
  windowDays?: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

export function summarizePracticePeriod(
  data: PracticeDay[],
  {
    periodStart,
    today = localCalendarDateKey(),
    windowDays = PRACTICE_PERIOD_DAYS,
  }: SummaryOptions = {},
): RollingPracticeSummary {
  const dayByDate = new Map(data.map(day => [day.date, day]));
  const start = periodStart ?? [...dayByDate.keys()].sort()[0] ?? today;
  const startMs = calendarDate(start).getTime();
  const elapsedDays = clamp(calendarDaysBetween(start, today) + 1, 0, windowDays);

  const days = Array.from({ length: windowDays }, (_, index) => {
    const date = calendarDateKey(new Date(startMs + index * DAY));
    const day = dayByDate.get(date);
    return {
      date,
      minutes: day?.minutes ?? 0,
      items: day?.items ?? [],
      elapsed: index < elapsedDays,
    };
  });

  const elapsed = days.slice(0, elapsedDays);
  const practiceMinutes = elapsed
    .filter(day => day.minutes > 0)
    .map(day => day.minutes);
  const practiceDays = practiceMinutes.length;
  const streakLengths: number[] = [];
  let currentStreak = 0;

  for (const day of elapsed) {
    if (day.minutes > 0) {
      currentStreak += 1;
    } else if (currentStreak) {
      streakLengths.push(currentStreak);
      currentStreak = 0;
    }
  }
  if (currentStreak) streakLengths.push(currentStreak);

  return {
    days,
    periodStart: start,
    today,
    elapsedDays,
    practiceDays,
    daysOff: elapsedDays - practiceDays,
    remainingDays: windowDays - elapsedDays,
    daily: {
      minimum: practiceMinutes.length ? Math.min(...practiceMinutes) : 0,
      average: average(elapsed.map(day => day.minutes)),
      maximum: practiceMinutes.length ? Math.max(...practiceMinutes) : 0,
    },
    streaks: {
      minimum: streakLengths.length ? Math.min(...streakLengths) : 0,
      average: average(streakLengths),
      maximum: streakLengths.length ? Math.max(...streakLengths) : 0,
    },
  };
}
