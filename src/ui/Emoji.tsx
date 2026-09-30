import { Image } from "expo-image";

import { EMOJI_IMAGES, type EmojiAsset } from "./emojiImages";

// Interface icons, from the same Fluent Emoji 3D set as the cards.
export const UI_EMOJI = {
  coin: "coin",
  medal1: "1st_place_medal",
  medal2: "2nd_place_medal",
  medal3: "3rd_place_medal",
  gift: "wrapped_gift",
  trophy: "trophy",
  moneybag: "money_bag",
  gem: "gem_stone",
  crystalball: "crystal_ball",
  lightbulb: "light_bulb",
  fire: "fire",
  calendar: "spiral_calendar",
  sparkles: "sparkles",
  crown: "crown",
  heart: "red_heart",
} as const satisfies Record<string, EmojiAsset>;

export const MEDALS: Record<number, EmojiAsset> = {
  1: UI_EMOJI.medal1,
  2: UI_EMOJI.medal2,
  3: UI_EMOJI.medal3,
};

interface EmojiProps {
  asset: EmojiAsset | string;
  size: number;
  /** Spoken label; omit for decorative icons next to text that already says it. */
  label?: string;
}

export function Emoji({ asset, size, label }: EmojiProps) {
  const source = EMOJI_IMAGES[asset as EmojiAsset] ?? EMOJI_IMAGES.prohibited;
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={0}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityRole={label ? "image" : undefined}
    />
  );
}
