import { shuffle, type Rng } from "./rng";

export type Phase = "playing" | "resolving" | "complete";

export interface FlipLogEntry {
  index: number;
  t: number;
}

export interface GameState {
  icons: string[];
  matched: boolean[];
  seen: boolean[];
  faceUp: number[];
  moves: number;
  pairsFound: number;
  streak: number;
  mismatches: number;
  memoryErrors: number;
  phase: Phase;
  startedAt: number | null;
  finishedAt: number | null;
  log: FlipLogEntry[];
}

export type FlipResult =
  | { kind: "ignored" }
  | { kind: "first" }
  | { kind: "match"; icon: string; streak: number; complete: boolean }
  | { kind: "mismatch"; memoryError: boolean };

export const GRID_COLUMNS = 4;
const SPREAD_ATTEMPTS = 200;

/** Pairs whose two cards touch (side by side or one above the other). */
export function adjacentPairs(icons: readonly string[]): number {
  let count = 0;
  icons.forEach((icon, i) => {
    if (i % GRID_COLUMNS < GRID_COLUMNS - 1 && icons[i + 1] === icon) count++;
    if (icons[i + GRID_COLUMNS] === icon) count++;
  });
  return count;
}

export function createGame(pairIcons: readonly string[], rng: Rng): GameState {
  // Pure chance leaves ~1.6 pairs touching on a 4×4 board, which reads as a lazy shuffle.
  // Reshuffle with the same rng until no pair touches: still deterministic for the server.
  let icons = shuffle([...pairIcons, ...pairIcons], rng);
  for (let attempt = 0; attempt < SPREAD_ATTEMPTS && adjacentPairs(icons) > 0; attempt++) icons = shuffle(icons, rng);
  return {
    icons,
    matched: icons.map(() => false),
    seen: icons.map(() => false),
    faceUp: [],
    moves: 0,
    pairsFound: 0,
    streak: 0,
    mismatches: 0,
    memoryErrors: 0,
    phase: "playing",
    startedAt: null,
    finishedAt: null,
    log: [],
  };
}

export function partnerOf(state: GameState, index: number): number {
  return state.icons.findIndex((icon, i) => i !== index && icon === state.icons[index]);
}

export function totalPairs(state: GameState): number {
  return state.icons.length / 2;
}

/**
 * A mismatch is a memory error when the first card's partner had already been revealed
 * before this move: the player could have known where it was. A miss between two cards whose
 * partners were never seen is a blind guess and costs nothing.
 *
 * Tapping a new card while a missed pair is still showing turns that pair back at once and
 * flips the new card: the player never has to wait out the reveal delay.
 */
export function flip(state: GameState, index: number, now: number): { state: GameState; result: FlipResult } {
  if (state.phase === "resolving" && !state.faceUp.includes(index)) state = resolveMismatch(state);
  if (
    state.phase !== "playing" ||
    index < 0 ||
    index >= state.icons.length ||
    state.matched[index] ||
    state.faceUp.includes(index)
  ) {
    return { state, result: { kind: "ignored" } };
  }

  const seenBeforeMove = state.seen;
  const next: GameState = {
    ...state,
    seen: state.seen.map((s, i) => s || i === index),
    faceUp: [...state.faceUp, index],
    startedAt: state.startedAt ?? now,
    log: [...state.log, { index, t: now }],
  };

  if (next.faceUp.length === 1) {
    return { state: next, result: { kind: "first" } };
  }

  const [a, b] = next.faceUp;
  next.moves = state.moves + 1;

  if (next.icons[a] === next.icons[b]) {
    next.matched = next.matched.map((m, i) => m || i === a || i === b);
    next.faceUp = [];
    next.pairsFound = state.pairsFound + 1;
    next.streak = state.streak + 1;
    const complete = next.pairsFound === totalPairs(next);
    if (complete) {
      next.phase = "complete";
      next.finishedAt = now;
    }
    return { state: next, result: { kind: "match", icon: next.icons[a], streak: next.streak, complete } };
  }

  const partner = partnerOf(state, a);
  const memoryError = partner !== -1 && seenBeforeMove[partner] && partner !== b;
  next.phase = "resolving";
  next.streak = 0;
  next.mismatches = state.mismatches + 1;
  next.memoryErrors = state.memoryErrors + (memoryError ? 1 : 0);
  return { state: next, result: { kind: "mismatch", memoryError } };
}

/**
 * Hint booster (Career only — ranked modes never allow it): solves one pair without costing a
 * move. Prefers a pair the player hasn't fully seen, so it actually helps.
 */
export function applyHint(state: GameState, now: number): GameState {
  if (state.phase !== "playing" || state.faceUp.length > 0) return state;
  const unmatched = state.icons.map((_, i) => i).filter((i) => !state.matched[i]);
  if (unmatched.length === 0) return state;
  const target =
    unmatched.find((i) => !state.seen[i] || !state.seen[partnerOf(state, i)]) ?? unmatched[0];
  const partner = partnerOf(state, target);

  const next: GameState = {
    ...state,
    matched: state.matched.map((m, i) => m || i === target || i === partner),
    seen: state.seen.map((s, i) => s || i === target || i === partner),
    pairsFound: state.pairsFound + 1,
    startedAt: state.startedAt ?? now,
  };
  if (next.pairsFound === totalPairs(next)) {
    next.phase = "complete";
    next.finishedAt = now;
  }
  return next;
}

/** Turns the two mismatched cards back face down once the reveal delay has elapsed. */
export function resolveMismatch(state: GameState): GameState {
  if (state.phase !== "resolving") return state;
  return { ...state, faceUp: [], phase: "playing" };
}

export function elapsedMs(state: GameState, now: number): number {
  if (state.startedAt === null) return 0;
  return (state.finishedAt ?? now) - state.startedAt;
}

/** Replays a flip log from a fresh board — the server-side score check uses the same code. */
export function replay(initial: GameState, log: readonly FlipLogEntry[]): GameState {
  let state = initial;
  for (const entry of log) {
    if (state.phase === "resolving") state = resolveMismatch(state);
    state = flip(state, entry.index, entry.t).state;
  }
  return state;
}
