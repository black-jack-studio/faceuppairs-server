import { parseSave, pickLike, shouldRestore, type SaveData } from "../saveFormat";

const save = (stars: Record<number, number>, endlessRuns: number, coins = 100): SaveData => ({
  version: 1,
  progress: { stars, endlessRuns, bestEndless: 0 },
  wallet: { coins },
});

describe("pickLike", () => {
  const template = { coins: 0, ownedPacks: [] as string[], boosters: { peek: 0 }, playedDay: null as string | null };

  it("keeps only known fields with the expected shape", () => {
    expect(
      pickLike({ coins: 420, ownedPacks: ["party"], boosters: { peek: 2 }, playedDay: "2026-10-06", extra: 1 }, template),
    ).toEqual({ coins: 420, ownedPacks: ["party"], boosters: { peek: 2 }, playedDay: "2026-10-06" });
  });

  it("drops fields of the wrong kind instead of letting them into the stores", () => {
    expect(pickLike({ coins: "lots", ownedPacks: "party", boosters: [1], playedDay: null }, template)).toEqual({
      playedDay: null,
    });
    expect(pickLike(null, template)).toEqual({});
  });
});

describe("parseSave", () => {
  it("accepts a well-formed save and rejects anything else", () => {
    expect(parseSave(save({ 1: 3 }, 0))).not.toBeNull();
    expect(parseSave(null)).toBeNull();
    expect(parseSave({ version: 1, progress: {} })).toBeNull();
    expect(parseSave({ progress: {}, wallet: {} })).toBeNull();
  });
});

describe("shouldRestore", () => {
  const fresh = save({}, 0);

  it("restores onto a fresh install, even a save with only coins in it", () => {
    expect(shouldRestore(fresh, save({ 1: 3, 2: 2 }, 12))).toBe(true);
    expect(shouldRestore(fresh, save({}, 0, 8_000))).toBe(true);
  });

  it("keeps the device's progress when it got further than the server's", () => {
    expect(shouldRestore(save({ 1: 3, 2: 3 }, 0), save({ 1: 3 }, 50))).toBe(false);
    expect(shouldRestore(save({ 1: 3 }, 9), save({ 1: 3 }, 4))).toBe(false);
  });

  it("takes the server's when it has more stars, or as many with at least as many games", () => {
    expect(shouldRestore(save({ 1: 1 }, 30), save({ 1: 3 }, 0))).toBe(true);
    expect(shouldRestore(save({ 1: 3 }, 4), save({ 1: 3 }, 4))).toBe(true);
  });
});
