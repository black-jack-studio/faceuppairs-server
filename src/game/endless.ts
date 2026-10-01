import type { BoardConfig } from "./board";

export const STARTING_LIVES = 5;

export const SCORING = {
  pointsPerPair: 100,
  maxMultiplier: 5,
  boardClearBonus: 500,
  /** Seconds under which the speed bonus starts paying, per pair on the board. */
  speedTargetSecondsPerPair: 4,
  speedBonusPerSecond: 20,
} as const;

/** Board N of an endless run (0-based): same 4×4 grid, harder icons, shorter reveal. */
export function endlessBoardConfig(boardIndex: number): BoardConfig {
  const ramp = Math.min(boardIndex / 12, 1);
  return {
    pairs: 8,
    lookalikeRatio: 0.15 + ramp * 0.85,
    revealMs: Math.round(850 - ramp * 500),
  };
}

/** Points for a match, given the streak including this match (1 = first in a row). */
export function pairPoints(streak: number): number {
  return SCORING.pointsPerPair * Math.min(Math.max(streak, 1), SCORING.maxMultiplier);
}

export function boardClearPoints(pairs: number, elapsedMs: number): number {
  const target = pairs * SCORING.speedTargetSecondsPerPair;
  const secondsUnder = Math.max(0, target - elapsedMs / 1000);
  return SCORING.boardClearBonus + Math.round(secondsUnder * SCORING.speedBonusPerSecond);
}
