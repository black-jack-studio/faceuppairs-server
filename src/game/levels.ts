import type { BoardConfig } from "./board";

// Levels fix the difficulty, not the deal: each attempt gets a fresh random board, otherwise a
// retry could be won from memory of the previous attempt.
export interface Level {
  number: number;
  board: BoardConfig;
  /** Moves allowed for 2 and 3 stars. Finishing at all is 1 star. */
  moves2: number;
  moves3: number;
  /** 3 stars also require finishing within this time. */
  seconds3: number;
}

/**
 * The first chapter: what the home screen's star count, the Gold icon and the coin ramp are
 * measured against. The Career itself never ends: levels after it are built by the same formula
 * at the biggest grid, still getting a little harder within each run of 18 levels.
 */
export const LEVEL_COUNT = 100;
/** Every this many levels, a celebration and a coin bonus (first clear only). */
export const MILESTONE_EVERY = 100;
// Past the first chapter the reveal keeps shortening per tier, but never below this tier's.
const MAX_TIER = 6;

// 3 rows for the first 12 levels, then one more row of 4 cards every 18 levels:
// 12 → 16 → 20 → 24 → 28 → 32 cards (levels 1–12, 13–30, 31–48, 49–66, 67–84, 85–100).
const INTRO_LEVELS = 12;
const LEVELS_PER_SIZE = 18;
function rowsFor(level: number): number {
  if (level <= INTRO_LEVELS) return 3;
  return Math.min(4 + Math.floor((level - INTRO_LEVELS - 1) / LEVELS_PER_SIZE), 8);
}

/** Where a level sits in its grid size: 0 on the first level of a size, 1 on the last. */
function tierProgress(level: number): { tier: number; t: number } {
  if (level <= INTRO_LEVELS) return { tier: 0, t: (level - 1) / (INTRO_LEVELS - 1) };
  let tier: number;
  let first: number;
  let last: number;
  if (level <= LEVEL_COUNT) {
    const index = Math.floor((level - INTRO_LEVELS - 1) / LEVELS_PER_SIZE);
    tier = index + 1;
    first = INTRO_LEVELS + 1 + index * LEVELS_PER_SIZE;
    last = Math.min(first + LEVELS_PER_SIZE - 1, LEVEL_COUNT);
  } else {
    // After the first chapter: runs of 18 levels starting at 101, all on the biggest grid.
    const index = Math.floor((level - LEVEL_COUNT - 1) / LEVELS_PER_SIZE);
    tier = Math.min(MAX_TIER + index, MAX_TIER);
    first = LEVEL_COUNT + 1 + index * LEVELS_PER_SIZE;
    last = first + LEVELS_PER_SIZE - 1;
  }
  return { tier, t: last === first ? 1 : (level - first) / (last - first) };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

// Every level is a little harder than the one before, inside each grid size (a "tier"):
// - a missed pair stays visible ~1 s on the first level of a size, down to ~0.5 s on the last
//   (a bit shorter on bigger grids), so the drop is felt from one level to the next; a new,
//   bigger grid starts the reveal long again, as a breather;
// - star thresholds tighten across the tier. With perfect memory a board of n pairs takes about
//   1.6n moves, so 3 stars goes from 1.9n (lenient) to 1.65n (sharp), 2 stars from 2.7n to 2.3n,
//   and the 3-star clock from 115 % to 90 % of the size's base time (4 s per pair on 3 rows,
//   3 s on 8).
// Look-alikes still rise with the level number (reaching 100 % around level 80).
function secondsPerPair(rows: number): number {
  return 4 - (rows - 3) * 0.2;
}
function buildLevel(number: number): Level {
  const rows = rowsFor(number);
  const pairs = (rows * 4) / 2;
  const progress = (number - 1) / (LEVEL_COUNT - 1);
  const { tier, t } = tierProgress(number);
  const lookalikeRatio = number <= 4 ? 0 : Math.min(0.2 + progress, 1);
  const revealMs = Math.round(lerp(1000 - tier * 40, 500 - tier * 20, t));

  return {
    number,
    board: { pairs, lookalikeRatio, revealMs },
    moves3: Math.ceil(pairs * lerp(1.9, 1.65, t)),
    moves2: Math.ceil(pairs * lerp(2.7, 2.3, t)),
    seconds3: Math.round(pairs * secondsPerPair(rows) * lerp(1.15, 0.9, t)),
  };
}

export const LEVELS: readonly Level[] = Array.from({ length: LEVEL_COUNT }, (_, i) => buildLevel(i + 1));

const laterLevels = new Map<number, Level>();

/** Any level from 1 up: the first chapter is precomputed, later ones are built on demand. */
export function getLevel(number: number): Level | undefined {
  if (!Number.isInteger(number) || number < 1) return undefined;
  if (number <= LEVEL_COUNT) return LEVELS[number - 1];
  let level = laterLevels.get(number);
  if (!level) {
    level = buildLevel(number);
    laterLevels.set(number, level);
  }
  return level;
}

export function starsFor(level: Level, moves: number, elapsedMs: number): 1 | 2 | 3 {
  if (moves <= level.moves3 && elapsedMs <= level.seconds3 * 1000) return 3;
  if (moves <= level.moves2) return 2;
  return 1;
}
