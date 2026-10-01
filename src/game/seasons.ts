import type { PackIcon } from "./iconPacks";

export type SeasonId = "halloween" | "christmas" | "newYear" | "valentine";

// Around these dates the two face-up home cards show the occasion instead of a random pack.
export const SEASON_PAIRS: Record<SeasonId, readonly [PackIcon, PackIcon]> = {
  halloween: [
    { glyph: "🎃", asset: "jack_o_lantern" },
    { glyph: "👻", asset: "ghost" },
  ],
  christmas: [
    { glyph: "🎄", asset: "christmas_tree" },
    { glyph: "🎅", asset: "santa_claus" },
  ],
  newYear: [
    { glyph: "🎆", asset: "fireworks" },
    { glyph: "🍾", asset: "bottle_with_popping_cork" },
  ],
  valentine: [
    { glyph: "💘", asset: "heart_with_arrow" },
    { glyph: "🌹", asset: "rose" },
  ],
};

/** The occasion on this (local) date, if any. */
export function seasonOn(date: Date): SeasonId | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 10 && day >= 24) return "halloween";
  if (month === 12 && day >= 18 && day <= 26) return "christmas";
  if ((month === 12 && day === 31) || (month === 1 && day <= 2)) return "newYear";
  if (month === 2 && (day === 13 || day === 14)) return "valentine";
  return null;
}
