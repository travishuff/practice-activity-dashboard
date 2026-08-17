import type { PracticeDay } from "./practice-data";

const DAY = 86_400_000;

export type RollingPracticeSummary = {
  days: Array<{ date: string; minutes: number }>;
  practiceDays: number;
  daysOff: number;
  daily: { minimum: number; average: number; maximum: number };
  streaks: { minimum: number; average: number; maximum: number };
};

export function summarizePracticeWindow(data: PracticeDay[], endDate: string, windowDays = 365): RollingPracticeSummary {
  const minutesByDate = new Map(data.map(day => [day.date, day.minutes]));
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const days = Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(end - (windowDays - index - 1) * DAY).toISOString().slice(0, 10);
    return { date, minutes: minutesByDate.get(date) ?? 0 };
  });
  const practiced = days.filter(day => day.minutes > 0);
  const practiceMinutes = practiced.map(day => day.minutes);
  const streakLengths: number[] = [];
  let currentStreak = 0;

  days.forEach(day => {
    if (day.minutes > 0) {
      currentStreak += 1;
    } else if (currentStreak) {
      streakLengths.push(currentStreak);
      currentStreak = 0;
    }
  });
  if (currentStreak) streakLengths.push(currentStreak);

  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    days,
    practiceDays: practiced.length,
    daysOff: windowDays - practiced.length,
    daily: {
      minimum: practiceMinutes.length ? Math.min(...practiceMinutes) : 0,
      average: average(practiceMinutes),
      maximum: practiceMinutes.length ? Math.max(...practiceMinutes) : 0,
    },
    streaks: {
      minimum: streakLengths.length ? Math.min(...streakLengths) : 0,
      average: average(streakLengths),
      maximum: streakLengths.length ? Math.max(...streakLengths) : 0,
    },
  };
}
