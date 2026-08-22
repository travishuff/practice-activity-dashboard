export const MAX_USER_NAME_LENGTH = 80;

export function normalizeUserName(userName: string | null | undefined) {
  const normalized = userName?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function practiceActivityTitle(userName: string | null | undefined) {
  const normalized = normalizeUserName(userName);
  return normalized ? `Practice Activity: ${normalized}` : "Practice Activity";
}
