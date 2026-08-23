/**
 * Wording for the dashboard footer's "last refreshed" line.
 *
 * `checkedAt` is an instant, not a calendar date, so it is formatted in local
 * time. A failed refresh serves the cached payload, which carries the *old*
 * checkedAt: rendering that as a bare time of day made a week-old snapshot
 * indistinguishable from a five-minute-old one, so anything not from today
 * carries its date, and anything from another year carries its year.
 */
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
