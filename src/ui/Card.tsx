import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { PackIcon } from "@/game/iconPacks";

import { Emoji } from "./Emoji";
import { colors, radius } from "./theme";

const FLIP_MS = 260;

interface CardProps {
  index: number;
  icon: PackIcon;
  faceUp: boolean;
  matched: boolean;
  size: number;
  onPress: (index: number) => void;
}

// DESIGN.md: black in every state, square corners, no border ever — not even mid-flip. The
// flip is a pure 3D rotation; the emoji is the only thing that changes.
export const Card = memo(function Card({ index, icon, faceUp, matched, size, onPress }: CardProps) {
  const { t } = useTranslation();
  const shown = faceUp || matched;
  const rotation = useSharedValue(shown ? 180 : 0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withTiming(shown ? 180 : 0, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) });
  }, [shown, rotation]);

  useEffect(() => {
    if (!matched) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
    );
  }, [matched, scale]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { scale: scale.value }, { rotateY: `${rotation.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { scale: scale.value }, { rotateY: `${rotation.value + 180}deg` }],
  }));

  // The Unicode glyph, not the image name: screen readers say it in the player's language.
  const n = index + 1;
  const label = matched
    ? t("game.cardMatched", { n, icon: icon.glyph })
    : faceUp
      ? t("game.cardShown", { n, icon: icon.glyph })
      : t("game.cardHidden", { n });

  return (
    <Pressable
      onPress={() => onPress(index)}
      disabled={shown}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: shown, selected: faceUp }}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[styles.face, backStyle]} />
      <Animated.View style={[styles.face, frontStyle]} importantForAccessibility="no-hide-descendants">
        <Emoji asset={icon.asset} size={Math.round(size * 0.62)} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
});
