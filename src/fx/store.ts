import { create } from "zustand";

/** Full-screen emoji effects, drawn above every screen by <FxLayer />. */
export type Fx =
  /** Perfect board: emojis rain until the screen is full, then a tap blows them away. */
  | { kind: "perfect"; emojis: readonly string[] }
  /** One emoji crosses the screen, with an optional sparkle trail. */
  | { kind: "flyby"; sprite: string; trail?: string }
  /** A burst thrown up from the bottom that falls back under gravity. */
  | { kind: "fountain"; sprites: readonly string[] }
  /** Emojis drifting down from the top. */
  | { kind: "rain"; sprites: readonly string[] };

interface FxState {
  current: (Fx & { id: number }) | null;
  play: (fx: Fx) => void;
  done: (id: number) => void;
}

let nextId = 1;

export const useFx = create<FxState>((set) => ({
  current: null,
  // The perfect-board celebration owns the screen until it's blown away: a secret pair found
  // on the very last move must not cut it short.
  play: (fx) =>
    set((s) => (s.current?.kind === "perfect" && fx.kind !== "perfect" ? s : { current: { ...fx, id: nextId++ } })),
  done: (id) => set((s) => (s.current?.id === id ? { current: null } : s)),
}));

export const playFx = (fx: Fx) => useFx.getState().play(fx);
