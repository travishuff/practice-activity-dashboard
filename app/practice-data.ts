/** Length of a Practice Log period, in days. */
export const PRACTICE_PERIOD_DAYS = 365;

export type PracticeDay = {
  date: string;
  minutes: number;
  items?: string[];
};
