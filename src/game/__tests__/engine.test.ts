import { setupBoard } from "../board";
import { createGame, elapsedMs, flip, partnerOf, replay, resolveMismatch, type GameState } from "../engine";
import { createRng } from "../rng";

const config = { pairs: 8, lookalikeRatio: 0, revealMs: 600 };

function firstMismatchPair(state: GameState): [number, number] {
  const other = state.icons.findIndex((icon) => icon !== state.icons[0]);
  return [0, other];
}

describe("setupBoard", () => {
  it("is deterministic for a given seed", () => {
    expect(setupBoard(42, config).icons).toEqual(setupBoard(42, config).icons);
    expect(setupBoard(42, config).icons).not.toEqual(setupBoard(43, config).icons);
  });

  it("deals every icon exactly twice", () => {
    const { icons } = setupBoard(7, { ...config, pairs: 12 });
    expect(icons).toHaveLength(24);
    const counts = new Map<string, number>();
    icons.forEach((icon) => counts.set(icon, (counts.get(icon) ?? 0) + 1));
    expect([...counts.values()].every((n) => n === 2)).toBe(true);
  });
});

describe("flip", () => {
  it("matches a pair and keeps it face up", () => {
    const game = createGame(["A", "B"], createRng(1));
    const a = 0;
    const b = partnerOf(game, a);
    const s1 = flip(game, a, 1000).state;
    const { state, result } = flip(s1, b, 1500);
    expect(result).toEqual({ kind: "match", icon: game.icons[a], streak: 1, complete: false });
    expect(state.matched[a] && state.matched[b]).toBe(true);
    expect(state.faceUp).toEqual([]);
    expect(state.moves).toBe(1);
  });

  it("ignores a second tap on the same card and taps on the shown pair", () => {
    const game = setupBoard(3, config);
    const [a, b] = firstMismatchPair(game);
    const s1 = flip(game, a, 0).state;
    expect(flip(s1, a, 10).result.kind).toBe("ignored");
    const s2 = flip(s1, b, 20).state;
    expect(s2.phase).toBe("resolving");
    expect(flip(s2, a, 25).result.kind).toBe("ignored");
  });

  it("lets a new tap cut the reveal short: the missed pair turns back, the new card flips", () => {
    const game = setupBoard(3, config);
    const [a, b] = firstMismatchPair(game);
    const s2 = flip(flip(game, a, 0).state, b, 20).state;
    const c = partnerOf(s2, a);
    const { state, result } = flip(s2, c, 30);
    expect(result.kind).toBe("first");
    expect(state.phase).toBe("playing");
    expect(state.faceUp).toEqual([c]);
  });

  it("treats a blind miss as free and a forgotten partner as a memory error", () => {
    let state = createGame(["A", "B", "C"], createRng(5));
    const at = (icon: string) => state.icons.flatMap((v, k) => (v === icon ? [k] : []));
    const [a1, a2] = at("A");
    const [b1] = at("B");
    const [c1] = at("C");
    let result;

    // A1 then B1: neither partner was ever seen, so this is a blind guess.
    ({ state } = flip(state, a1, 0));
    ({ state, result } = flip(state, b1, 100));
    expect(result).toEqual({ kind: "mismatch", memoryError: false });
    state = resolveMismatch(state);

    // C1 then A1: C's partner is still unseen — still blind, even though A1 was seen before.
    ({ state } = flip(state, c1, 200));
    ({ state, result } = flip(state, a1, 300));
    expect(result).toEqual({ kind: "mismatch", memoryError: false });
    state = resolveMismatch(state);

    // A2 then C1: A1 was already revealed, so the player could have found the pair.
    ({ state } = flip(state, a2, 400));
    ({ state, result } = flip(state, c1, 500));
    expect(result).toEqual({ kind: "mismatch", memoryError: true });
    expect(state.memoryErrors).toBe(1);
    expect(state.mismatches).toBe(3);
    expect(state.streak).toBe(0);
  });

  it("completes the board and stops the clock", () => {
    let state = createGame(["A", "B"], createRng(9));
    let t = 1000;
    for (const icon of ["A", "B"]) {
      const [i, j] = state.icons.flatMap((v, k) => (v === icon ? [k] : []));
      state = flip(state, i, t).state;
      state = flip(state, j, (t += 500)).state;
    }
    expect(state.phase).toBe("complete");
    expect(elapsedMs(state, 99999)).toBe(1000);
  });
});

describe("replay", () => {
  it("rebuilds the same final state from the flip log", () => {
    let state = setupBoard(11, config);
    const initial = state;
    let t = 0;
    // Play a full perfect game.
    for (let i = 0; i < state.icons.length; i++) {
      if (state.matched[i]) continue;
      state = flip(state, i, (t += 300)).state;
      state = flip(state, partnerOf(state, i), (t += 300)).state;
    }
    const replayed = replay(initial, state.log);
    expect(replayed.phase).toBe("complete");
    expect(replayed.moves).toBe(state.moves);
    expect(replayed.memoryErrors).toBe(state.memoryErrors);
  });
});
