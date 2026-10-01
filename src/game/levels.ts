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

export const LEVEL_COUNT = 100;

// 3 rows for the first 12 levels, then one more row of 4 cards every 18 levels:
// 12 → 16 → 20 → 24 → 28 → 32 cards (levels 1–12, 13–30, 31–48, 49–66, 67–84, 85–100).
const INTRO_LEVELS = 12;
const LEVELS_PER_SIZE = 18;
function rowsFor(level: number): number {
  if (level <= INTRO_LEVELS) return 3;
  return Math.min(4 + Math.floor((level - INTRO_LEVELS - 1) / LEVELS_PER_SIZE), 8);
}

// With perfect memory, clearing n pairs takes about 1.6n moves on average; 3 stars asks for
// close to that, 2 stars leaves room for a few slips. Star thresholds depend only on the grid
// size (same rules for every level with the same number of rows); the 3-star clock goes from
// 4 s per pair on 3 rows to 3 s on 8. Within a size, look-alikes and a shorter mismatch reveal
// carry the difficulty (look-alikes reach 100 % around level 80).
function secondsPerPair(rows: number): number {
  return 4 - (rows - 3) * 0.2;
}
function buildLevel(number: number): Level {
  const rows = rowsFor(number);
  const pairs = (rows * 4) / 2;
  const progress = (number - 1) / (LEVEL_COUNT - 1);
  const lookalikeRatio = number <= 4 ? 0 : Math.min(0.2 + progress, 1);
  const revealMs = Math.round(900 - progress * 500);

  return {
    number,
    board: { pairs, lookalikeRatio, revealMs },
    moves3: Math.ceil(pairs * 1.75),
    moves2: Math.ceil(pairs * 2.5),
    seconds3: Math.round(pairs * secondsPerPair(rows)),
  };
}

export const LEVELS: readonly Level[] = Array.from({ length: LEVEL_COUNT }, (_, i) => buildLevel(i + 1));

export function getLevel(number: number): Level | undefined {
  return LEVELS[number - 1];
}

export function starsFor(level: Level, moves: number, elapsedMs: number): 1 | 2 | 3 {
  if (moves <= level.moves3 && elapsedMs <= level.seconds3 * 1000) return 3;
  if (moves <= level.moves2) return 2;
  return 1;
}
