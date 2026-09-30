import { pick, shuffle, type Rng } from "./rng";

// Boards are dealt as icon *slots* ("0".."23"), never emojis. The emoji shown for a slot comes
// from the player's icon pack, so packs are purely cosmetic: two players on different packs
// play the exact same board, and the server can replay a run without knowing the pack.
export const SLOT_COUNT = 24;

// Slots whose icons look alike in every pack. Drawing several slots from one group is what
// makes a board harder to memorize without changing its size.
export const LOOKALIKE_SLOT_GROUPS: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14],
  [15, 16],
  [17, 18, 19],
];

const ALL_SLOTS = Array.from({ length: SLOT_COUNT }, (_, i) => i);

/**
 * Picks `pairs` distinct slots. `lookalikeRatio` (0..1) is the share of slots drawn from
 * look-alike groups, kept together so they actually sit on the same board.
 */
export function pickIcons(pairs: number, lookalikeRatio: number, rng: Rng): string[] {
  const wantedLookalikes = Math.round(pairs * Math.min(Math.max(lookalikeRatio, 0), 1));
  const chosen: number[] = [];

  for (const group of shuffle(LOOKALIKE_SLOT_GROUPS, rng)) {
    if (chosen.length >= wantedLookalikes) break;
    const room = wantedLookalikes - chosen.length;
    if (room < 2) break;
    chosen.push(...pick(group, Math.min(group.length, room), rng));
  }

  const rest = ALL_SLOTS.filter((slot) => !chosen.includes(slot));
  chosen.push(...pick(rest, pairs - chosen.length, rng));
  return chosen.map(String);
}
