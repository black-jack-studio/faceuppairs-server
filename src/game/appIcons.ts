import { LEVEL_COUNT } from "./levels";

// Home-screen icons. Some are free, some cost coins, the rest are earned by playing — the
// gallery shows how far each one is, so there's always a next one to go for.
export type AppIconUnlock =
  | { kind: "free" }
  | { kind: "coins"; amount: number }
  | { kind: "level"; level: number }
  | { kind: "streak"; days: number }
  | { kind: "allStars" };

export interface AppIconDef {
  id: string;
  /** Name given to the native module (app.json); null is the default icon. */
  native: string | null;
  unlock: AppIconUnlock;
}

export const APP_ICONS: readonly AppIconDef[] = [
  { id: "original", native: null, unlock: { kind: "free" } },
  { id: "night", native: "Night", unlock: { kind: "free" } },
  { id: "blue", native: "Blue", unlock: { kind: "coins", amount: 2_000 } },
  { id: "red", native: "Red", unlock: { kind: "coins", amount: 2_500 } },
  { id: "candy", native: "Candy", unlock: { kind: "coins", amount: 3_000 } },
  { id: "mint", native: "Mint", unlock: { kind: "level", level: 25 } },
  { id: "violet", native: "Violet", unlock: { kind: "streak", days: 7 } },
  { id: "gold", native: "Gold", unlock: { kind: "allStars" } },
];

export interface PlayRecord {
  stars: Record<number, number>;
  /** Current daily-chest streak. */
  streak: number;
}

/** How far the player is towards an icon earned by playing; null for free / coin icons. */
export function iconProgress(icon: AppIconDef, record: PlayRecord): { current: number; target: number } | null {
  const { unlock } = icon;
  if (unlock.kind === "level") {
    let finished = 0;
    while (finished < unlock.level && record.stars[finished + 1]) finished++;
    return { current: finished, target: unlock.level };
  }
  if (unlock.kind === "streak") return { current: Math.min(record.streak, unlock.days), target: unlock.days };
  if (unlock.kind === "allStars") {
    let perfect = 0;
    for (let level = 1; level <= LEVEL_COUNT; level++) if (record.stars[level] === 3) perfect++;
    return { current: perfect, target: LEVEL_COUNT };
  }
  return null;
}

/** Earned by playing right now (free icons count as earned). Coin icons never are. */
export function earnedByPlay(icon: AppIconDef, record: PlayRecord): boolean {
  if (icon.unlock.kind === "free") return true;
  const progress = iconProgress(icon, record);
  return progress !== null && progress.current >= progress.target;
}

export function getAppIcon(id: string): AppIconDef | undefined {
  return APP_ICONS.find((icon) => icon.id === id);
}
