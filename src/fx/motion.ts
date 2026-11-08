import { Easing } from "react-native-reanimated";

// One set of curves for every in-game reward, so a pair, a cleared board and a star all move
// with the same hand. No ease-in on anything the player is watching.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/**
 * Rolling numbers: a plain ease-out-cubic. The strong UI curve above does 80 % of the way in the
 * first fifth of the time, which reads as a jump, not a count.
 */
export const EASE_COUNT = Easing.bezier(0.33, 1, 0.68, 1);

/**
 * Settles with a couple of soft wobbles: what makes a pop feel like a thing landing instead of a
 * tween bouncing off a wall. The peak is reached with a timing, the way back is this spring.
 */
export const SETTLE_SPRING = { duration: 650, dampingRatio: 0.42 } as const;
/** Same, calmer: numbers, labels. */
export const SOFT_SPRING = { duration: 550, dampingRatio: 0.6 } as const;

/** A new board: cards arrive in a diagonal wave from the top-left. */
export const DEAL_STEP_MS = 48;
export const DEAL_MS = 420;

/** A finished board: a wave runs out from the last pair, one cell every this many ms. */
export const FINALE_STEP_MS = 70;
/** Lets the last pair's own sheen pass before the wave starts. */
export const FINALE_START_MS = 380;
export const VANISH_MS = 460;

/** The live score rolling to its new value, and the result screens' totals. */
export const SCORE_ROLL_MS = 850;
export const RESULT_ROLL_MS = 1600;

/** The band of light crossing a card's face when its pair is found. */
export const SHEEN_MS = 650;
