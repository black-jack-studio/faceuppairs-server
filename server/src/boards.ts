// Leaderboard keys (UTC): "endless" restarts every month, weekly every Monday (ISO week),
// daily every day.
export type BoardKind = "endless" | "weekly" | "daily";

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function utcMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function utcDayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function boardKey(kind: BoardKind, now: Date): string {
  if (kind === "endless") return `month:${utcMonth(now)}`;
  if (kind === "weekly") return `week:${isoWeek(now)}`;
  return `daily:${utcDayOf(now)}`;
}

/** End of the current season / day, for the countdown shown in the app. */
export function boardEndsAt(kind: BoardKind, now: Date): string {
  if (kind === "endless") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const isoWeekday = now.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  const days = kind === "daily" ? 1 : 8 - isoWeekday;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).toISOString();
}
