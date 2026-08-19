import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPracticePayload } from "../app/electron-api";
import type { PracticePayload } from "../app/practice-sheet";

type Settings = {
  sheetUrl: string;
};

type CacheFile = {
  sheetUrl: string;
  payload: PracticePayload;
};

function dataPath(filename: string) {
  return path.join(app.getPath("userData"), filename);
}

async function readJson(filename: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(dataPath(filename), "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filename: string, value: unknown) {
  const destination = dataPath(filename);
  const temporary = `${destination}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, destination);
}

export async function readSettings(): Promise<Settings | null> {
  const value = await readJson("settings.json");
  if (!value || typeof value !== "object") return null;
  const sheetUrl = (value as Partial<Settings>).sheetUrl;
  return typeof sheetUrl === "string" && sheetUrl.length > 0 ? { sheetUrl } : null;
}

export async function writeSettings(settings: Settings) {
  await writeJson("settings.json", settings);
}

export async function readCache(sheetUrl: string): Promise<PracticePayload | null> {
  const value = await readJson("practice-cache.json");
  if (!value || typeof value !== "object") return null;
  const cache = value as Partial<CacheFile>;
  if (cache.sheetUrl !== sheetUrl || !isPracticePayload(cache.payload)) return null;
  return cache.payload;
}

export async function writeCache(sheetUrl: string, payload: PracticePayload) {
  await writeJson("practice-cache.json", { sheetUrl, payload } satisfies CacheFile);
}
