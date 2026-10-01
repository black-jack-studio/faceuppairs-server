import type { TFunction } from "i18next";

// End-of-game lines, picked at random so the same result rarely reads the same twice.
// A lost run gets roasted; a great one gets cheered.

/** Endless / Daily score bands for the roast. */
const RUN_BANDS = { mid: 1_500, high: 6_000 } as const;

function pick(t: TFunction, key: string, seed: number): string {
  const lines = t(key, { returnObjects: true }) as unknown;
  return Array.isArray(lines) && lines.length > 0 ? String(lines[Math.floor(seed * lines.length) % lines.length]) : "";
}

export function levelQuip(t: TFunction, stars: number, seed: number): string {
  return pick(t, `quips.level.${Math.min(Math.max(stars, 1), 3)}`, seed);
}

export function runQuip(t: TFunction, score: number, seed: number): string {
  const band = score >= RUN_BANDS.high ? "high" : score >= RUN_BANDS.mid ? "mid" : "low";
  return pick(t, `quips.run.${band}`, seed);
}
