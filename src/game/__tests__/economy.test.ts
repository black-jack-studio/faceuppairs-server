import { createGame, flip, hintTarget, partnerOf } from "../engine";
import {
  canClaimDaily,
  canOpenChest,
  claimDaily,
  endlessCoins,
  levelCoins,
  nextStreakDay,
  shouldShowInterstitial,
  STREAK_REWARDS,
} from "../economy";
import { createRng } from "../rng";

describe("level coins", () => {
  it("pays most for a first clear, a little for improvements, a token amount for replays", () => {
    expect(levelCoins(3, 0)).toBe(40);
    expect(levelCoins(3, 1)).toBe(20);
    expect(levelCoins(2, 2)).toBe(2);
  });

  it("pays more the harder the level, up to four times at level 100", () => {
    expect(levelCoins(3, 0, 1)).toBe(40);
    expect(levelCoins(3, 0, 50)).toBeGreaterThan(levelCoins(3, 0, 10));
    expect(levelCoins(3, 0, 100)).toBe(160);
    expect(levelCoins(3, 1, 100)).toBe(80);
    expect(levelCoins(2, 2, 100)).toBe(8);
  });
});

describe("daily streak", () => {
  it("continues on consecutive days and restarts after a gap", () => {
    let state = { lastClaimDay: null as string | null, streak: 0 };
    let claim = claimDaily(state, "2026-09-01");
    expect(claim.coins).toBe(STREAK_REWARDS[0]);
    state = claim.next;
    expect(canClaimDaily(state, "2026-09-01")).toBe(false);
    expect(claimDaily(state, "2026-09-01").coins).toBe(0);

    claim = claimDaily(state, "2026-09-02");
    expect(claim.next.streak).toBe(2);
    expect(claim.coins).toBe(STREAK_REWARDS[1]);

    claim = claimDaily(claim.next, "2026-09-05");
    expect(claim.next.streak).toBe(1);
  });

  it("gives the day-7 bonus and cycles", () => {
    let state = { lastClaimDay: null as string | null, streak: 0 };
    const days = Array.from({ length: 8 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const claims = days.map((day) => {
      const c = claimDaily(state, day);
      state = c.next;
      return c;
    });
    expect(claims[6].bonusHint).toBe(true);
    expect(claims[6].coins).toBe(150);
    expect(claims[7].coins).toBe(STREAK_REWARDS[0]);
    expect(nextStreakDay(state, "2026-09-09")).toBe(2);
    expect(nextStreakDay(state, "2026-09-20")).toBe(1);
  });
});

describe("interstitials", () => {
  const base = { adsRemoved: false, highestLevel: 10, gamesSinceLast: 3, lastShownAt: null, now: 1_000_000 };
  it("shows only when every rule allows it", () => {
    expect(shouldShowInterstitial(base)).toBe(true);
    expect(shouldShowInterstitial({ ...base, adsRemoved: true })).toBe(false);
    expect(shouldShowInterstitial({ ...base, highestLevel: 4 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, gamesSinceLast: 2 })).toBe(false);
    expect(shouldShowInterstitial({ ...base, lastShownAt: base.now - 60_000 })).toBe(false);
  });
});

describe("hint booster", () => {
  it("is unavailable before any card has been seen", () => {
    expect(hintTarget(createGame(["A", "B"], createRng(1)))).toBeNull();
  });

  it("points at the partner of the card currently face up", () => {
    const state = flip(createGame(["A", "B", "C"], createRng(1)), 0, 10).state;
    expect(hintTarget(state)).toBe(partnerOf(state, 0));
  });

  it("points at the unseen partner of a card seen earlier", () => {
    let state = createGame(["A", "B", "C"], createRng(1));
    const other = state.icons.findIndex((icon) => icon !== state.icons[0]);
    state = flip(state, 0, 10).state;
    state = flip(state, other, 20).state;
    const target = hintTarget(state, () => 0);
    expect(target).not.toBeNull();
    expect(state.seen[target!]).toBe(false);
    expect([partnerOf(state, 0), partnerOf(state, other)]).toContain(target);
  });
});

describe("daily chest needs a game played today", () => {
  const fresh = { lastClaimDay: null, streak: 0 };

  it("stays shut until something was finished today", () => {
    expect(canOpenChest(fresh, null, "2026-09-02")).toBe(false);
    expect(canOpenChest(fresh, "2026-09-01", "2026-09-02")).toBe(false);
  });

  it("opens once a game was finished today", () => {
    expect(canOpenChest(fresh, "2026-09-02", "2026-09-02")).toBe(true);
  });

  it("stays shut after being claimed, even with a game played", () => {
    const claimed = { lastClaimDay: "2026-09-02", streak: 1 };
    expect(canOpenChest(claimed, "2026-09-02", "2026-09-02")).toBe(false);
  });
});

describe("endless coins", () => {
  it("pays 1 coin per 100 points", () => {
    expect(endlessCoins(0)).toBe(0);
    expect(endlessCoins(99)).toBe(0);
    expect(endlessCoins(100)).toBe(1);
    expect(endlessCoins(4217)).toBe(42);
  });
});
