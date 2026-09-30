import { setupBoard } from "./board";
import { elapsedMs, flip, resolveMismatch, totalPairs, type FlipLogEntry, type GameState } from "./engine";
import { boardClearPoints, endlessBoardConfig, pairPoints, STARTING_LIVES } from "./endless";

// A ranked run (Endless or Daily Challenge) is a seed plus the taps. Everything else — the
// boards, the score, the lives — is derived from those, by the same code on the phone and on
// the server. The server never trusts a score, only a log.

export interface RunLog {
  seed: number;
  /** Flips per board, in order. The last board may be unfinished (the run ended on it). */
  boards: FlipLogEntry[][];
  /** Index into the combined flip sequence at which the one allowed revive happened, if any. */
  reviveAt: number | null;
}

export interface RunResult {
  valid: boolean;
  reason?: string;
  score: number;
  boardsCleared: number;
  pairsFound: number;
  memoryErrors: number;
  livesLeft: number;
  /** Whether the run ended by losing every life (as opposed to being abandoned mid-board). */
  lost: boolean;
  durationMs: number;
  /** Matches found on a card never seen before, against what luck alone would give. */
  luck: { blindMatches: number; expected: number; variance: number };
}

export function boardSeed(runSeed: number, boardIndex: number): number {
  return (runSeed + Math.imul(boardIndex, 0x9e3779b9)) >>> 0;
}

export function runBoard(runSeed: number, boardIndex: number): GameState {
  return setupBoard(boardSeed(runSeed, boardIndex), endlessBoardConfig(boardIndex));
}

/** Daily Challenge seed: the same for every player on a given UTC day ("2026-09-30"). */
export function dailySeed(day: string): number {
  let hash = 2166136261;
  for (const ch of `faceup-pairs:daily:${day}`) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function utcDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function invalid(reason: string, partial: Omit<RunResult, "valid" | "reason">): RunResult {
  return { ...partial, valid: false, reason };
}

export function scoreRun(log: RunLog): RunResult {
  const result: Omit<RunResult, "valid" | "reason"> = {
    score: 0,
    boardsCleared: 0,
    pairsFound: 0,
    memoryErrors: 0,
    livesLeft: STARTING_LIVES,
    lost: false,
    durationMs: 0,
    luck: { blindMatches: 0, expected: 0, variance: 0 },
  };
  let reviveUsed = false;
  let flipCount = 0;
  let lastT = -Infinity;
  let firstT: number | null = null;

  for (let b = 0; b < log.boards.length; b++) {
    if (result.lost) return invalid("flips after the run ended", result);
    let state = runBoard(log.seed, b);

    for (const entry of log.boards[b]) {
      if (result.lost) return invalid("flips after the run ended", result);
      if (!Number.isFinite(entry.t) || entry.t < lastT) return invalid("timestamps out of order", result);
      lastT = entry.t;
      firstT ??= entry.t;
      if (state.phase === "resolving") state = resolveMismatch(state);

      // Luck bookkeeping, measured before the flip: a second card on a never-seen card, while
      // the first card's partner has never been seen either, is a blind guess.
      const isSecond = state.faceUp.length === 1;
      let blindChance = 0;
      if (isSecond && !state.seen[entry.index]) {
        const first = state.faceUp[0];
        const partner = state.icons.findIndex((icon, i) => i !== first && icon === state.icons[first]);
        if (!state.seen[partner]) {
          const unseen = state.icons.filter((_, i) => !state.seen[i] && i !== first).length;
          blindChance = unseen > 0 ? 1 / unseen : 0;
        }
      }

      const { state: next, result: flipResult } = flip(state, entry.index, entry.t);
      if (flipResult.kind === "ignored") return invalid("illegal flip", result);
      state = next;
      flipCount++;

      if (blindChance > 0) {
        result.luck.expected += blindChance;
        result.luck.variance += blindChance * (1 - blindChance);
        if (flipResult.kind === "match") result.luck.blindMatches++;
      }

      if (flipResult.kind === "match") {
        result.pairsFound++;
        result.score += pairPoints(flipResult.streak);
      } else if (flipResult.kind === "mismatch" && flipResult.memoryError) {
        result.memoryErrors++;
        result.livesLeft--;
        if (result.livesLeft <= 0) {
          if (log.reviveAt !== null && !reviveUsed && log.reviveAt === flipCount) {
            reviveUsed = true;
            result.livesLeft = 1;
          } else {
            result.lost = true;
          }
        }
      }
    }

    if (state.phase === "complete") {
      result.boardsCleared++;
      result.score += boardClearPoints(totalPairs(state), elapsedMs(state, lastT));
    } else if (b < log.boards.length - 1) {
      return invalid("unfinished board followed by another", result);
    }
  }

  if (log.reviveAt !== null && !reviveUsed) return invalid("revive without a lost run", result);
  result.durationMs = firstT === null ? 0 : lastT - firstT;
  return { ...result, valid: true };
}

// Luck threshold: this many standard deviations above chance is not a lucky player.
const LUCK_Z_LIMIT = 5;
const LUCK_MIN_BLIND_MATCHES = 6;
/** Faster than a human can tap two different cards. */
export const MIN_FLIP_INTERVAL_MS = 60;

/** Server-side plausibility on top of a valid replay. Returns the reason to reject, or null. */
export function suspicion(log: RunLog, result: RunResult): string | null {
  const { blindMatches, expected, variance } = result.luck;
  if (blindMatches >= LUCK_MIN_BLIND_MATCHES) {
    const z = (blindMatches - expected) / Math.sqrt(Math.max(variance, 0.25));
    if (z > LUCK_Z_LIMIT) return "impossible luck";
  }
  const all = log.boards.flat();
  for (let i = 1; i < all.length; i++) {
    if (all[i].t - all[i - 1].t < MIN_FLIP_INTERVAL_MS) return "inhuman speed";
  }
  return null;
}
