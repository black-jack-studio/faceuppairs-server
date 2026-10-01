import fs from "node:fs";
import path from "node:path";

import { dealHome, HOME_CARD_COUNT, SECRET_BOARD } from "../homeDeal";
import { ICON_PACKS } from "../iconPacks";
import { SEASON_PAIRS, seasonOn } from "../seasons";
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

describe("seasons", () => {
  it("dresses the home cards for each occasion, and only around it", () => {
    expect(seasonOn(new Date(2026, 9, 31))).toBe("halloween");
    expect(seasonOn(new Date(2026, 9, 23))).toBeNull();
    expect(seasonOn(new Date(2026, 11, 24))).toBe("christmas");
    expect(seasonOn(new Date(2026, 11, 31))).toBe("newYear");
    expect(seasonOn(new Date(2027, 0, 1))).toBe("newYear");
    expect(seasonOn(new Date(2027, 1, 14))).toBe("valentine");
    expect(seasonOn(new Date(2026, 6, 14))).toBeNull();
    const { cards } = dealHome(createRng(3), SEASON_PAIRS.halloween);
    expect(cards.filter((c) => c !== null).map((c) => c!.asset).sort()).toEqual(["ghost", "jack_o_lantern"]);
  });

  it("ships an image for every seasonal emoji", () => {
    for (const pair of Object.values(SEASON_PAIRS)) {
      for (const icon of pair) expect(fs.existsSync(path.join(__dirname, `../../../assets/emoji/${icon.asset}.webp`))).toBe(true);
    }
  });
});
