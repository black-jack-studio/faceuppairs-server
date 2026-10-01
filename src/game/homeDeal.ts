import type { BoardConfig } from "./board";
import { ICON_PACKS, type PackIcon } from "./iconPacks";
import { pick, shuffle, type Rng } from "./rng";

export const HOME_CARD_COUNT = 4;

export interface HomeDeal {
  /** Icon per position, null for a face-down card. Always two of each. */
  cards: (PackIcon | null)[];
  /** The face-down card that opens the secret board; the other one does nothing. */
  secretIndex: number;
}

export function dealHome(rng: Rng): HomeDeal {
  const positions = shuffle(
    Array.from({ length: HOME_CARD_COUNT }, (_, i) => i),
    rng,
  );
  const shown = positions.slice(0, 2);
  const hidden = positions.slice(2);
  // Both icons from one pack (any pack, locked ones included: it doubles as a preview).
  const pack = ICON_PACKS[Math.floor(rng() * ICON_PACKS.length)];
  const icons = pick(pack.icons, shown.length, rng);
  const cards: (PackIcon | null)[] = Array.from({ length: HOME_CARD_COUNT }, () => null);
  shown.forEach((position, i) => {
    cards[position] = icons[i];
  });
  return { cards, secretIndex: hidden[Math.floor(rng() * hidden.length)] };
}

/** The easter-egg board: 8 rows of 4, free play. */
export const SECRET_BOARD: BoardConfig = { pairs: 16, lookalikeRatio: 0.3, revealMs: 800 };
