import type { PracticePayload } from "./practice-sheet";

export type PracticeResult =
  | { ok: true; payload: PracticePayload }
  | { ok: false; error: NonNullable<PracticePayload["error"]> };

export type SetupStatus = {
  configured: boolean;
  sheetUrl: string | null;
};

export interface PracticeAPI {
  getSetupStatus(): Promise<SetupStatus>;
  configurePracticeLog(sheetUrl: string): Promise<PracticeResult>;
  getPracticeData(): Promise<PracticeResult>;
  openSharingHelp(): Promise<void>;
}

export function isPracticePayload(value: unknown): value is PracticePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PracticePayload>;
  const validError = candidate.error === null || (
    Boolean(candidate.error)
    && typeof candidate.error?.code === "string"
    && typeof candidate.error?.message === "string"
  );

  return Array.isArray(candidate.data)
    && candidate.data.every(day => (
      day
      && typeof day.date === "string"
      && Number.isFinite(day.minutes)
      && (day.items === undefined || (
        Array.isArray(day.items)
        && day.items.every(item => typeof item === "string")
      ))
    ))
    && Number.isFinite(candidate.totalHours)
    && typeof candidate.live === "boolean"
    && (candidate.checkedAt === null || typeof candidate.checkedAt === "string")
    && validError
    && Array.isArray(candidate.warnings)
    && candidate.warnings.every(warning => typeof warning === "string");
}

declare global {
  interface Window {
    practiceAPI: PracticeAPI;
  }
}
