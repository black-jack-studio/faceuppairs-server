import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/ui/theme";

import { EASE_COUNT, EASE_IN_OUT, EASE_OUT, SETTLE_SPRING } from "./motion";

const FLOAT_WIDTH = 160;
const FLOAT_RISE = 56;
const FLOAT_MS = 1350;

/**
 * "+300" or "×3" rising from between the two cards of a pair, white on the board, then gone.
 * Drawn over the grid without taking touches, so the next tap is never blocked.
 */
export function FloatLabel({ x, y, text, strong = false }: { x: number; y: number; text: string; strong?: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const pop = useSharedValue(reduced ? 1 : 0.7);

  useEffect(() => {
    t.set(withTiming(1, { duration: FLOAT_MS, easing: EASE_COUNT }));
    if (!reduced)
      pop.set(withSequence(withTiming(strong ? 1.3 : 1.15, { duration: 180, easing: EASE_OUT }), withSpring(1, SETTLE_SPRING)));
  }, [t, pop, reduced, strong]);

  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      // Fades in over the first moment, holds, fades over the last third.
      opacity: p < 0.08 ? p / 0.08 : p < 0.62 ? 1 : 1 - (p - 0.62) / 0.38,
      transform: [{ translateY: reduced ? 0 : -p * FLOAT_RISE }, { scale: pop.get() }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.float, { left: x - FLOAT_WIDTH / 2, top: y - 24 }, style]}
    >
      <Text style={[styles.floatText, strong && styles.floatStrong]} allowFontScaling={false}>
        {text}
      </Text>
    </Animated.View>
  );
}

const BANNER_IN_MS = 260;

/** A cleared board: the bonus lands in the middle of the grid while the cards fly out. */
export function Banner({ title, caption, delay, holdMs }: { title: string; caption?: string; delay: number; holdMs: number }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduced ? 1 : 1.5);

  useEffect(() => {
    opacity.set(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: BANNER_IN_MS, easing: EASE_OUT }),
          withDelay(holdMs, withTiming(0, { duration: 260, easing: EASE_IN_OUT })),
        ),
      ),
    );
    if (!reduced) scale.set(withDelay(delay, withSpring(1, SETTLE_SPRING)));
  }, [opacity, scale, delay, holdMs, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));

  return (
    <View style={styles.bannerArea} pointerEvents="none">
      <Animated.View style={[styles.banner, style]}>
        <Text style={styles.bannerTitle} allowFontScaling={false}>
          {title}
        </Text>
        {caption ? <Text style={styles.bannerCaption}>{caption}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: "absolute",
    width: FLOAT_WIDTH,
    alignItems: "center",
  },
  floatText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  floatStrong: {
    fontSize: 32,
  },
  bannerArea: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    alignItems: "center",
    gap: 4,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 56,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  bannerCaption: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "700",
  },
});
