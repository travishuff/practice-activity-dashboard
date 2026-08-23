export function formatRefreshedAt(
  checkedAt: string,
  live: boolean,
  now = new Date(),
) {
  const at = new Date(checkedAt);
  if (Number.isNaN(at.getTime())) return "Refresh time unavailable";

  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const prefix = live ? "Last refreshed" : "Last successful refresh";
  if (at.toDateString() === now.toDateString()) return `${prefix} ${time}`;

  const date = at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${prefix} ${date} at ${time}`;
}
