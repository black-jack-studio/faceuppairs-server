import { useCallback, useEffect, useRef, useState } from "react";

import { hapticError, hapticImpact, hapticSuccess, hapticTick } from "@/lib/haptics";

import { elapsedMs, flip, resolveMismatch, type FlipResult, type GameState } from "./engine";

interface Options {
  /** How long a missed pair stays visible before flipping back. */
  revealMs: number;
  /** Endless: a memory error costs a life, so it gets the error haptic instead of a light tap. */
  memoryErrorsCost?: boolean;
  onResult?: (result: FlipResult, state: GameState) => void;
}

export function useBoardGame(initial: GameState, { revealMs, memoryErrorsCost = false, onResult }: Options) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const press = useCallback(
    (index: number) => {
      const { state: next, result } = flip(stateRef.current, index, Date.now());
      if (result.kind === "ignored") return;
      // A tap during the reveal already turned the missed pair back (see flip): drop its timer
      // so it can't fire later and hide the card just flipped.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      commit(next);

      if (result.kind === "first") hapticTick();
      else if (result.kind === "match") {
        if (result.complete) hapticSuccess();
        else hapticImpact();
      } else if (result.memoryError && memoryErrorsCost) hapticError();
      else hapticTick();

      onResultRef.current?.(result, next);

      if (result.kind === "mismatch") {
        timer.current = setTimeout(() => commit(resolveMismatch(stateRef.current)), revealMs);
      }
    },
    [commit, memoryErrorsCost, revealMs],
  );

  const reset = useCallback(
    (next: GameState) => {
      if (timer.current) clearTimeout(timer.current);
      commit(next);
    },
    [commit],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { state, press, reset };
}

/** Live clock for the HUD: ticks while the board is being played, frozen once it's done. */
export function useElapsed(state: GameState): number {
  const running = state.startedAt !== null && state.finishedAt === null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  return elapsedMs(state, running ? Math.max(now, state.startedAt ?? now) : now);
}
