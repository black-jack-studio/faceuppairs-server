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

  it("gets harder: never fewer pairs; inside a grid size, a shorter reveal and tighter stars every level", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const [prev, level] = [LEVELS[i - 1], LEVELS[i]];
      expect(level.board.pairs).toBeGreaterThanOrEqual(prev.board.pairs);
      if (level.board.pairs !== prev.board.pairs) continue;
      expect(level.board.revealMs).toBeLessThan(prev.board.revealMs);
      expect(level.moves3).toBeLessThanOrEqual(prev.moves3);
      expect(level.moves2).toBeLessThanOrEqual(prev.moves2);
      expect(level.seconds3).toBeLessThanOrEqual(prev.seconds3);
    }
  });

  it("feels the difference across a grid size: level 12 is clearly harder than level 1", () => {
    const [first, last] = [getLevel(1)!, getLevel(12)!];
    expect(first.board.revealMs - last.board.revealMs).toBeGreaterThanOrEqual(400);
    expect(last.moves3).toBeLessThan(first.moves3);
    expect(last.seconds3).toBeLessThan(first.seconds3);
  });

  it("keeps 3 rows for the first 12 levels, then grows a row every 18 levels", () => {
    const cards = (n: number) => getLevel(n)!.board.pairs * 2;
    expect(cards(1)).toBe(12);
    expect(cards(12)).toBe(12);
    expect(cards(13)).toBe(16);
    expect(cards(30)).toBe(16);
    expect(cards(31)).toBe(20);
    expect(cards(85)).toBe(32);
    expect(cards(100)).toBe(32);
  });

  it("never ends: levels past 100 exist, on the biggest grid, still tightening within each run of 18", () => {
    const l101 = getLevel(101)!;
    const l118 = getLevel(118)!;
    const l500 = getLevel(500)!;
    expect(l101.board.pairs).toBe(16);
    expect(l500.board.pairs).toBe(16);
    expect(l118.board.revealMs).toBeLessThan(l101.board.revealMs);
    expect(l118.moves3).toBeLessThanOrEqual(l101.moves3);
    expect(l500.board.revealMs).toBeGreaterThanOrEqual(300);
    expect(getLevel(0)).toBeUndefined();
    expect(getLevel(1.5)).toBeUndefined();
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
