// All coin amounts in one place, so balancing never means hunting through screens.
// Rule (MONETISATION.md): every level can be finished without paying; boosters only go faster.

export type BoosterId = "peek" | "hint";

export const BOOSTER_PRICES: Record<BoosterId, number> = {
  peek: 60,
  hint: 80,
};

/** Endless / Daily: one revive per run, by watching an ad or paying coins. */
export const REVIVE_PRICE = 150;

/** How long the "peek" booster shows every card at the start of a level. */
export const PEEK_MS = 1200;

export function levelCoins(stars: number, previousStars: number): number {
  if (previousStars === 0) return 10 + stars * 10;
  if (stars > previousStars) return (stars - previousStars) * 10;
  return 2;
}

export function endlessCoins(score: number): number {
  return Math.floor(score / 250);
}

export const DAILY_CHALLENGE_COINS = 50;

/** Easter-egg board, first clear per app launch. */
export const SECRET_BOARD_COINS = 50;


/** Login streak rewards, day 1 → day 7, then the cycle restarts. Day 7 also gives a hint. */
export const STREAK_REWARDS = [20, 30, 40, 50, 60, 80, 150] as const;
export const STREAK_BONUS_DAY = 7;

/**
 * The player's own calendar day ("2026-09-30") for the chest and the streak, so they roll over
 * at the player's midnight. The Daily Challenge deliberately stays on UTC (run.ts utcDay):
 * everyone must get the same board on the same day.
 */
export function localDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface StreakState {
  /** UTC day of the last claimed reward ("2026-09-30"), or null if never claimed. */
  lastClaimDay: string | null;
  /** Consecutive days claimed so far, 0 before the first claim. */
  streak: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function canClaimDaily(state: StreakState, today: string): boolean {
  return state.lastClaimDay !== today;
}

/**
 * Claiming on the day after the last claim continues the streak; missing a day restarts it.
 * Returns the new state and the coins for the day being claimed.
 */
export function claimDaily(state: StreakState, today: string): { next: StreakState; coins: number; bonusHint: boolean } {
  if (!canClaimDaily(state, today)) return { next: state, coins: 0, bonusHint: false };
  const continues = state.lastClaimDay !== null && daysBetween(state.lastClaimDay, today) === 1;
  const streak = continues ? state.streak + 1 : 1;
  const dayInCycle = ((streak - 1) % STREAK_REWARDS.length) + 1;
  return {
    next: { lastClaimDay: today, streak },
    coins: STREAK_REWARDS[dayInCycle - 1],
    bonusHint: dayInCycle === STREAK_BONUS_DAY,
  };
}

/** The day of the cycle (1–7) the next claim would land on — for the streak display. */
export function nextStreakDay(state: StreakState, today: string): number {
  const continues =
    state.lastClaimDay !== null &&
    (state.lastClaimDay === today || daysBetween(state.lastClaimDay, today) === 1);
  const streak = continues ? (state.lastClaimDay === today ? state.streak : state.streak + 1) : 1;
  return ((streak - 1) % STREAK_REWARDS.length) + 1;
}

// Interstitials (MONETISATION.md §2B): never before level 5 is reached, at most one every
// three finished games, at least two minutes apart, never for anyone who paid.
export const INTERSTITIAL_RULES = {
  minLevelReached: 5,
  gamesBetween: 3,
  minIntervalMs: 120_000,
} as const;

export function shouldShowInterstitial(input: {
  adsRemoved: boolean;
  highestLevel: number;
  gamesSinceLast: number;
  lastShownAt: number | null;
  now: number;
}): boolean {
  if (input.adsRemoved) return false;
  if (input.highestLevel < INTERSTITIAL_RULES.minLevelReached) return false;
  if (input.gamesSinceLast < INTERSTITIAL_RULES.gamesBetween) return false;
  if (input.lastShownAt !== null && input.now - input.lastShownAt < INTERSTITIAL_RULES.minIntervalMs) return false;
  return true;
}
