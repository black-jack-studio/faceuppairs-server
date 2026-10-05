import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Emoji, UI_EMOJI } from "./Emoji";
import { colors } from "./theme";

const PLAY_SIZE = 24;
// The coin emoji's orange, so the reward tile and the coin read as one family.
export const COIN_ORANGE = "#F5A83A";
const COIN_ORANGE_INK = "#2B1B00";
const COIN_TILE_SIZE = 22;
// Barely there: a swell of 8 % and back, about every 0.9 s.
const PULSE_SCALE = 1.08;
const PULSE_HALF_MS = 450;

/**
 * Rounded-square play mark for buttons that start a rewarded video: the usual "watch to earn"
 * cue. `pulse` makes it breathe, to draw the eye to an offer.
 */
export function PlayBadge({
  onAccent = false,
  coin = false,
  pulse = false,
}: {
  onAccent?: boolean;
  /** Orange tile, same size as the coin emoji: for the double-your-coins offer. */
  coin?: boolean;
  pulse?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!pulse || reduceMotion) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(PULSE_SCALE, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [pulse, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.play,
        coin && styles.coinTile,
        { backgroundColor: coin ? COIN_ORANGE : onAccent ? colors.accentText : colors.text },
        style,
      ]}
    >
      <Ionicons
        name="play"
        size={coin ? 13 : 14}
        color={coin ? COIN_ORANGE_INK : onAccent ? colors.accent : colors.board}
        style={styles.playGlyph}
      />
    </Animated.View>
  );
}

export function CoinIcon() {
  return <Emoji asset={UI_EMOJI.coin} size={22} />;
}

/** Button label with the coin right after the amount ("Continue · 150 🪙"). */
export function CoinLabel({ text, fontSize = 17 }: { text: string; fontSize?: number }) {
  return (
    <View style={styles.coinLabel}>
      <Text style={[styles.coinLabelText, { fontSize }]}>{text}</Text>
      <CoinIcon />
    </View>
  );
}

const styles = StyleSheet.create({
  coinLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  coinLabelText: {
    color: colors.text,
    fontWeight: "600",
  },
  play: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  coinTile: {
    width: COIN_TILE_SIZE,
    height: COIN_TILE_SIZE,
    borderRadius: 6,
  },
  // The triangle's visual centre sits left of its box.
  playGlyph: {
    marginLeft: 2,
  },
});
