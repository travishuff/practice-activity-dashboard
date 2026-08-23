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
  /** Day 1 of the Practice Log, from the sheet's own day numbering. */
  periodStart?: string | null;
  /** Injectable so summaries are deterministic; defaults to the local date. */
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

/**
 * Classifies every day of the period by the calendar, never by whether the
 * sheet happens to carry a row for it. A day the user never filled in is an
 * elapsed day with zero minutes, not a day that has yet to happen.
 *
 *   elapsed   = day 1 .. today (inclusive)
 *   practiced = elapsed and minutes > 0
 *   off       = elapsed and minutes === 0 (blank or missing row)
 *   remaining = tomorrow .. day 365
 */
export function summarizePracticePeriod(
  data: PracticeDay[],
  {
    periodStart,
    today = localCalendarDateKey(),
    windowDays = PRACTICE_PERIOD_DAYS,
  }: SummaryOptions = {},
): RollingPracticeSummary {
  const dayByDate = new Map(data.map(day => [day.date, day]));
  // Prefer the period start implied by the sheet's day numbering. Payloads
  // cached before that field existed fall back to the earliest recorded day.
  const start = periodStart ?? [...dayByDate.keys()].sort()[0] ?? today;
  const startMs = calendarDate(start).getTime();

  // Day 1 is elapsed and today is inside the range, hence the +1. Clamped so a
  // period starting in the future reports 0 and one that has run past day 365
  // reports the full window.
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
    // Derived, so the three counts cannot drift apart:
    // practiceDays + daysOff + remainingDays === windowDays, always.
    daysOff: elapsedDays - practiceDays,
    remainingDays: windowDays - elapsedDays,
    daily: {
      // Range covers practice days only; an average over practiced days would
      // hide rest days, and a minimum over all days would always read 0.
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
