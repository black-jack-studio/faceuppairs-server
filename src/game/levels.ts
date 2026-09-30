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

export const LEVEL_COUNT = 60;

// With perfect memory, clearing n pairs takes about 1.6n moves on average; 3 stars asks for
// close to that, 2 stars leaves room for a few slips.
function rowsFor(level: number): number {
  if (level <= 2) return 3;
  if (level <= 25) return 4;
  if (level <= 45) return 5;
  return 6;
}

function buildLevel(number: number): Level {
  const pairs = (rowsFor(number) * 4) / 2;
  const progress = (number - 1) / (LEVEL_COUNT - 1);
  const lookalikeRatio = number <= 5 ? 0 : Math.min(0.2 + progress * 0.8, 1);
  const revealMs = Math.round(900 - progress * 450);

  return {
    number,
    board: { pairs, lookalikeRatio, revealMs },
    moves3: Math.ceil(pairs * 1.75),
    moves2: Math.ceil(pairs * 2.5),
    seconds3: pairs * 4,
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
