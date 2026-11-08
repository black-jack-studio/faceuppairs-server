import { useCallback, useEffect, useRef, useState } from "react";

import * as Haptics from "expo-haptics";

import { secretPairFx } from "@/fx/secretPairs";
import { playFx } from "@/fx/store";
import { hapticError, hapticImpact, hapticSuccess, hapticTick } from "@/lib/haptics";
import { useWallet } from "@/store/wallet";

import { elapsedMs, flip, partnerOf, resolveMismatch, type FlipResult, type GameState } from "./engine";

/** The last pair turned over, for the board's effects: where it is and how it went. */
export interface LastFlip {
  /** Grows with every pair, so effects keyed on it replay even for the same two cards. */
  id: number;
  kind: "match" | "mismatch";
  a: number;
  b: number;
  streak: number;
  complete: boolean;
  /** A miss that cost a life (Endless and Daily only). */
  costly: boolean;
}

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
  const [lastFlip, setLastFlip] = useState<LastFlip | null>(null);
  const flipId = useRef(0);

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

      if (result.kind === "match") {
        setLastFlip({
          id: ++flipId.current,
          kind: "match",
          a: partnerOf(next, index),
          b: index,
          streak: result.streak,
          complete: result.complete,
          costly: false,
        });
      } else if (result.kind === "mismatch") {
        setLastFlip({
          id: ++flipId.current,
          kind: "mismatch",
          a: next.faceUp[0],
          b: next.faceUp[1],
          streak: 0,
          complete: false,
          costly: result.memoryError && memoryErrorsCost,
        });
      }

      // One feel per outcome, the same in every mode: a tick to flip, a firm knock for a pair,
      // a soft bump for a miss, the success buzz to clear the board, the error buzz when a
      // miss costs a life.
      if (result.kind === "first") hapticTick();
      else if (result.kind === "match") {
        if (result.complete) hapticSuccess();
        else hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
        const secret = secretPairFx(useWallet.getState().activePack, result.icon);
        if (secret) playFx(secret);
      } else if (result.memoryError && memoryErrorsCost) hapticError();
      else hapticImpact(Haptics.ImpactFeedbackStyle.Soft);

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
      setLastFlip(null);
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

  return { state, press, reset, lastFlip };
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
