// Pure helpers for the cloud save (cloudSave.ts): no storage, no network, so they can be tested.

export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  progress: Record<string, unknown>;
  wallet: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Same kind of value as `model`. A null model stands for "nothing yet": a day string, a number or null. */
function sameShape(value: unknown, model: unknown): boolean {
  if (model === null) return value === null || typeof value === "string" || typeof value === "number";
  if (Array.isArray(model)) return Array.isArray(value);
  if (isRecord(model)) return isRecord(value);
  return typeof value === typeof model;
}

/**
 * Copies from `source` only the keys `template` has, and only when the value has the same shape.
 * A save written by another app version (or tampered with) can't put garbage in the stores.
 */
export function pickLike<T extends object>(source: unknown, template: T): Partial<T> {
  if (!isRecord(source)) return {};
  const out: Partial<T> = {};
  for (const key of Object.keys(template) as (keyof T & string)[]) {
    if (key in source && sameShape(source[key], template[key])) out[key] = source[key] as T[keyof T & string];
  }
  return out;
}

export function parseSave(value: unknown): SaveData | null {
  if (!isRecord(value) || typeof value.version !== "number") return null;
  if (!isRecord(value.progress) || !isRecord(value.wallet)) return null;
  return { version: value.version, progress: value.progress, wallet: value.wallet };
}

/** How far a save got: stars first (the Career), then games played. */
function advancement(save: SaveData): [number, number] {
  const stars = isRecord(save.progress.stars)
    ? Object.values(save.progress.stars).reduce<number>((sum, n) => sum + (typeof n === "number" ? n : 0), 0)
    : 0;
  const runs = typeof save.progress.endlessRuns === "number" ? save.progress.endlessRuns : 0;
  return [stars, runs];
}

/**
 * On a fresh install the server's save wins, unless this device already got further. A tie goes
 * to the server: a brand-new install holds nothing but the starting wallet.
 */
export function shouldRestore(local: SaveData, remote: SaveData): boolean {
  const [localStars, localRuns] = advancement(local);
  const [remoteStars, remoteRuns] = advancement(remote);
  if (localStars !== remoteStars) return remoteStars > localStars;
  return remoteRuns >= localRuns;
}
