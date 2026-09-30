import { applyHint, createGame } from "../engine";
import {
  canClaimDaily,
  claimDaily,
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
  it("solves one pair without a move and can finish the board", () => {
    let state = createGame(["A"], createRng(1));
    state = applyHint(state, 50);
    expect(state.pairsFound).toBe(1);
    expect(state.moves).toBe(0);
    expect(state.phase).toBe("complete");
  });
});
