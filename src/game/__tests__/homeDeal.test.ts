import { dealHome, HOME_CARD_COUNT, SECRET_BOARD } from "../homeDeal";
import { ICON_PACKS } from "../iconPacks";
import { setupBoard } from "../board";
import { createRng } from "../rng";

describe("dealHome", () => {
  it("always shows exactly two different icons from one pack and hides two cards, one of them secret", () => {
    const positionsSeen = new Set<number>();
    for (let seed = 1; seed <= 500; seed++) {
      const { cards, secretIndex } = dealHome(createRng(seed));
      expect(cards).toHaveLength(HOME_CARD_COUNT);
      const shown = cards.filter((c) => c !== null);
      expect(shown).toHaveLength(2);
      expect(shown[0]!.asset).not.toBe(shown[1]!.asset);
      expect(ICON_PACKS.some((p) => p.icons.includes(shown[0]!) && p.icons.includes(shown[1]!))).toBe(true);
      expect(cards[secretIndex]).toBeNull();
      positionsSeen.add(secretIndex);
    }
    expect(positionsSeen.size).toBe(HOME_CARD_COUNT);
  });
});

describe("SECRET_BOARD", () => {
  it("deals 32 cards, 8 rows of 4", () => {
    expect(setupBoard(42, SECRET_BOARD).icons).toHaveLength(32);
  });
});
