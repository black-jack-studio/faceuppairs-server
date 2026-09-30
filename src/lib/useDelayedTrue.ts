import { useEffect, useState } from "react";

/**
 * True only once `value` has stayed true for `delayMs`; false again immediately when it turns
 * false. Used so an end-of-game panel lets the last card finish flipping (and the player see
 * it) before covering the board.
 */
export function useDelayedTrue(value: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => {
      clearTimeout(timer);
      setDelayed(false);
    };
  }, [value, delayMs]);

  return value && delayed;
}

/** Card flip (260 ms) plus a beat to take in the finished board. */
export const END_OF_GAME_DELAY_MS = 900;
