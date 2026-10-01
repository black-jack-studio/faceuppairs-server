import fs from "node:fs";
import path from "node:path";

import { APP_ICONS, earnedByPlay, getAppIcon, iconProgress } from "../appIcons";

const none = { stars: {}, streak: 0 };

describe("app icons", () => {
  it("free icons are always available, coin icons never earned by play", () => {
    expect(earnedByPlay(getAppIcon("night")!, none)).toBe(true);
    expect(earnedByPlay(getAppIcon("blue")!, { stars: { 1: 3 }, streak: 99 })).toBe(false);
  });

  it("counts finished levels in order for the level icon", () => {
    const candy = getAppIcon("candy")!;
    const stars: Record<number, number> = {};
    for (let l = 1; l <= 11; l++) stars[l] = 1;
    stars[20] = 3; // a gap: level 12 isn't finished
    expect(iconProgress(candy, { stars, streak: 0 })).toEqual({ current: 11, target: 25 });
    for (let l = 1; l <= 25; l++) stars[l] = 2;
    expect(earnedByPlay(candy, { stars, streak: 0 })).toBe(true);
  });

  it("tracks the chest streak and the 3-star collection", () => {
    expect(iconProgress(getAppIcon("violet")!, { stars: {}, streak: 3 })).toEqual({ current: 3, target: 7 });
    expect(earnedByPlay(getAppIcon("violet")!, { stars: {}, streak: 7 })).toBe(true);
    const gold = getAppIcon("gold")!;
    expect(iconProgress(gold, { stars: { 1: 3, 2: 2, 3: 3 }, streak: 0 })).toEqual({ current: 2, target: 100 });
  });

  it("ships the native image and the gallery preview for every icon", () => {
    const dir = path.join(__dirname, "../../../assets/images/app-icons");
    for (const icon of APP_ICONS) {
      expect(fs.existsSync(path.join(dir, `${icon.id}-preview.png`))).toBe(true);
      if (icon.native) expect(fs.existsSync(path.join(dir, `${icon.id}.png`))).toBe(true);
    }
  });
});
