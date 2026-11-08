import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { hapticImpact, hapticSuccess } from "@/lib/haptics";

import { colors } from "./theme";

/** First star lands this long after the panel shows, then one every STAR_STEP_MS. */
export const STAR_START_MS = 450;
export const STAR_STEP_MS = 480;
/** About when the spring first reaches full size: the hit, where the knock goes. */
const STAR_LAND_MS = 230;
const STAR_SPRING = { duration: 700, dampingRatio: 0.5 } as const;
/** When the last earned star has landed: what comes after it on the panel waits for this. */
export function starsLandedAt(earned: number): number {
  return STAR_START_MS + Math.max(earned - 1, 0) * STAR_STEP_MS + STAR_LAND_MS;
}

// Monochrome on purpose (DESIGN.md: no color near the grid): earned stars are white, the rest faint.
// With `animate`, the earned ones slam down one at a time, each with its knock.
export function StarRow({ earned, size, animate = false }: { earned: number; size: number; animate?: boolean }) {
  return (
    <View style={styles.row} accessible={false}>
      {[1, 2, 3].map((n) =>
        animate && n <= earned ? (
          <SlamStar key={n} size={size} delay={STAR_START_MS + (n - 1) * STAR_STEP_MS} final={n === earned} big={n === 3} />
        ) : (
          <Text key={n} style={{ fontSize: size, color: n <= earned ? colors.text : colors.faint }}>
            ★
          </Text>
        ),
      )}
    </View>
  );
}

function SlamStar({ size, delay, final, big }: { size: number; delay: number; final: boolean; big: boolean }) {
  const reduced = useReducedMotion();
  const from = big ? 2.6 : 2.1;
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reduced ? 1 : from);
  const turn = useSharedValue(reduced ? 0 : -25);

  useEffect(() => {
    opacity.set(withDelay(delay, withTiming(1, { duration: 140 })));
    if (!reduced) {
      scale.set(withDelay(delay, withSpring(1, STAR_SPRING)));
      turn.set(withDelay(delay, withSpring(0, STAR_SPRING)));
    }
    // The knock fires as the star hits, not when the panel opens.
    const timer = setTimeout(() => {
      if (final && big) hapticSuccess();
      else hapticImpact(final ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    }, delay + STAR_LAND_MS);
    return () => clearTimeout(timer);
    // Plays once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }, { rotate: `${turn.get()}deg` }],
  }));

  return (
    <View>
      {/* The empty star stays underneath, so the row never changes width. */}
      <Text style={{ fontSize: size, color: colors.faint }}>★</Text>
      <Animated.Text style={[StyleSheet.absoluteFill, { fontSize: size, color: colors.text }, style]}>★</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
  },
});
