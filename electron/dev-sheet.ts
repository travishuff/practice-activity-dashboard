/**
 * Dev-only selection of which Practice Log to open.
 *
 * Kept free of any `electron` import so it can be unit tested in plain Node.
 * The electron-facing wrapper in dev-environment.ts supplies the file contents
 * and gates the whole feature on the app being unpackaged.
 */

export const DEV_SHEET_URL_KEY = "PRACTICE_SHEET_URL";

/**
 * A deliberately small .env reader: `KEY=value`, one per line, `#` comments,
 * optional `export` prefix, optional surrounding quotes. Anything stranger
 * belongs in a real dotenv dependency, which this feature does not justify.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).replace(/^export\s+/, "").trim();
    if (!key) continue;

    const raw = trimmed.slice(separator + 1).trim();
    const quoted = raw.match(/^(["'])(.*)\1$/);
    values[key] = quoted ? quoted[2] : raw;
  }

  return values;
}

/**
 * Per-use beats default: an explicit environment variable wins over any file,
 * and earlier files win over later ones. A blank value counts as unset, so
 * `PRACTICE_SHEET_URL= pnpm dev` falls back rather than selecting nothing.
 */
export function pickDevSheetUrl(
  env: NodeJS.ProcessEnv,
  fileContents: Array<string | null>,
): string | null {
  const fromEnv = env[DEV_SHEET_URL_KEY]?.trim();
  if (fromEnv) return fromEnv;

  for (const contents of fileContents) {
    if (!contents) continue;
    const fromFile = parseEnvFile(contents)[DEV_SHEET_URL_KEY]?.trim();
    if (fromFile) return fromFile;
  }

  return null;
}
