import type { PracticeDay } from "./practice-data";

const DAY = 86_400_000;

export type RollingPracticeSummary = {
  days: Array<{ date: string; minutes: number; occurred: boolean }>;
  occurredDays: number;
  practiceDays: number;
  daysOff: number;
  futureDays: number;
  daily: { minimum: number; average: number; maximum: number };
  streaks: { minimum: number; average: number; maximum: number };
};

export function summarizePracticePeriod(data: PracticeDay[], windowDays = 365): RollingPracticeSummary {
  const minutesByDate = new Map(data.map(day => [day.date, day.minutes]));
  const firstDate = [...minutesByDate.keys()].sort()[0];
  const start = firstDate ? Date.parse(`${firstDate}T00:00:00Z`) : Date.now();
  const days = Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(start + index * DAY).toISOString().slice(0, 10);
    return { date, minutes: minutesByDate.get(date) ?? 0, occurred: minutesByDate.has(date) };
  });
  const occurred = days.filter(day => day.occurred);
  const practiced = occurred.filter(day => day.minutes > 0);
  const daysOff = occurred.filter(day => day.minutes === 0);
  const practiceMinutes = practiced.map(day => day.minutes);
  const streakLengths: number[] = [];
  let currentStreak = 0;

  days.forEach(day => {
    if (day.occurred && day.minutes > 0) {
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
    occurredDays: occurred.length,
    practiceDays: practiced.length,
    daysOff: daysOff.length,
    futureDays: windowDays - occurred.length,
    daily: {
      minimum: practiceMinutes.length ? Math.min(...practiceMinutes) : 0,
      average: average(occurred.map(day => day.minutes)),
      maximum: practiceMinutes.length ? Math.max(...practiceMinutes) : 0,
    },
    streaks: {
      minimum: streakLengths.length ? Math.min(...streakLengths) : 0,
      average: average(streakLengths),
      maximum: streakLengths.length ? Math.max(...streakLengths) : 0,
    },
  };
}
