export function formatDuration(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function formatScore(score: number, language: string): string {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US").format(score);
}

/** Time left until `target`, coarse on purpose: "2 j 5 h", "3 h 12 min", "8 min". */
export function formatCountdown(target: Date | string, language: string, now = Date.now()): string {
  const ms = Math.max(0, new Date(target).getTime() - now);
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const d = language === "fr" ? "j" : "d";
  if (days > 0) return `${days} ${d} ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${Math.max(mins, 1)} min`;
}

/** Next local midnight — when the daily chest rolls over. */
export function nextLocalMidnight(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Next midnight UTC — when the Daily Challenge rolls over. */
export function nextUtcMidnight(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
