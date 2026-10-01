import fs from "node:fs";
import path from "node:path";

import { boardClearPoints, endlessBoardConfig, pairPoints, SCORING } from "../endless";
import { ICON_PACKS } from "../iconPacks";
import { LOOKALIKE_SLOT_GROUPS, pickIcons, SLOT_COUNT } from "../icons";
import { getLevel, LEVELS, LEVEL_COUNT, starsFor } from "../levels";
import { createRng } from "../rng";

describe("levels", () => {
  it("defines every level with an even, 4-column-friendly card count", () => {
    expect(LEVELS).toHaveLength(LEVEL_COUNT);
    for (const level of LEVELS) {
      expect((level.board.pairs * 2) % 4).toBe(0);
      expect(level.moves3).toBeLessThan(level.moves2);
    }
  });

  it("gets harder: never fewer pairs, never a longer reveal", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].board.pairs).toBeGreaterThanOrEqual(LEVELS[i - 1].board.pairs);
      expect(LEVELS[i].board.revealMs).toBeLessThanOrEqual(LEVELS[i - 1].board.revealMs);
    }
  });

  it("uses the same star rules for every level with the same grid size", () => {
    const rulesBySize = new Map<number, string>();
    for (const level of LEVELS) {
      const rules = `${level.moves3}/${level.moves2}/${level.seconds3}`;
      const size = level.board.pairs;
      expect(rulesBySize.get(size) ?? rules).toBe(rules);
      rulesBySize.set(size, rules);
    }
  });

  it("awards stars on moves and time", () => {
    const level = getLevel(10)!;
    expect(starsFor(level, level.moves3, level.seconds3 * 1000)).toBe(3);
    expect(starsFor(level, level.moves3, level.seconds3 * 1000 + 1)).toBe(2);
    expect(starsFor(level, level.moves2, 0)).toBe(2);
    expect(starsFor(level, level.moves2 + 1, 0)).toBe(1);
  });
});

describe("icons", () => {
  it("picks distinct icons", () => {
    const icons = pickIcons(12, 1, createRng(1));
    expect(new Set(icons).size).toBe(12);
  });

  it("clusters look-alikes when asked", () => {
    const icons = pickIcons(8, 1, createRng(2));
    const lookalikes = icons.filter((slot) => LOOKALIKE_SLOT_GROUPS.some((g) => g.includes(Number(slot))));
    expect(lookalikes.length).toBeGreaterThanOrEqual(6);
  });

  it("gives every pack one distinct icon per slot", () => {
    for (const pack of ICON_PACKS) {
      expect(pack.icons).toHaveLength(SLOT_COUNT);
      expect(new Set(pack.icons.map((i) => i.asset)).size).toBe(SLOT_COUNT);
      expect(new Set(pack.icons.map((i) => i.glyph)).size).toBe(SLOT_COUNT);
    }
    expect(new Set(ICON_PACKS.map((p) => p.id)).size).toBe(ICON_PACKS.length);
  });

  it("ships an image for every icon", () => {
    const dir = path.join(__dirname, "../../../assets/emoji");
    for (const pack of ICON_PACKS) {
      for (const icon of pack.icons) expect(fs.existsSync(path.join(dir, `${icon.asset}.webp`))).toBe(true);
    }
  });
});

describe("endless scoring", () => {
  it("multiplies pair points by the streak, capped", () => {
    expect(pairPoints(1)).toBe(SCORING.pointsPerPair);
    expect(pairPoints(3)).toBe(SCORING.pointsPerPair * 3);
    expect(pairPoints(50)).toBe(SCORING.pointsPerPair * SCORING.maxMultiplier);
  });

  it("pays a speed bonus only under the target time", () => {
    expect(boardClearPoints(8, 60_000)).toBe(SCORING.boardClearBonus);
    expect(boardClearPoints(8, 22_000)).toBe(SCORING.boardClearBonus + 10 * SCORING.speedBonusPerSecond);
  });

  it("ramps difficulty then plateaus", () => {
    expect(endlessBoardConfig(0).revealMs).toBeGreaterThan(endlessBoardConfig(6).revealMs);
    expect(endlessBoardConfig(12)).toEqual(endlessBoardConfig(40));
  });
});
