import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { APP_NAME } from "@/config/app";
import { hapticTick } from "@/lib/haptics";

import { Emoji, UI_EMOJI } from "./Emoji";
import { colors, space } from "./theme";

// Opening sequence: two flat black cards drop in, turn over onto the same emoji (a pair), the
// pair gives a small beat, the name fades up, then the whole thing lifts away. About 1.4 s.
const CARD_SIZE = 92;
const EMOJI_SIZE = 50;
const DROP_MS = 380;
const DROP_STAGGER_MS = 90;
const FLIP_AT_MS = 520;
const FLIP_STAGGER_MS = 80;
const HALF_TURN_MS = 110;
const MATCH_AT_MS = FLIP_AT_MS + FLIP_STAGGER_MS + 2 * HALF_TURN_MS;
const TITLE_AT_MS = 260;
const REVEAL_MS = MATCH_AT_MS + 260;
const EXIT_MS = 380;

function SplashCard({ index }: { index: number }) {
  const [faceUp, setFaceUp] = useState(false);
  const drop = useSharedValue(0);
  const turn = useSharedValue(0);

  useEffect(() => {
    const dropDelay = index * DROP_STAGGER_MS;
    const flipDelay = FLIP_AT_MS + index * FLIP_STAGGER_MS;
    drop.value = withDelay(dropDelay, withTiming(1, { duration: DROP_MS, easing: Easing.out(Easing.cubic) }));
    turn.value = withDelay(
      flipDelay,
      withSequence(
        withTiming(90, { duration: HALF_TURN_MS, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: HALF_TURN_MS, easing: Easing.out(Easing.quad) }),
      ),
    );
    const swap = setTimeout(() => setFaceUp(true), flipDelay + HALF_TURN_MS);
    return () => clearTimeout(swap);
  }, [index, drop, turn]);

  const style = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [
      { translateY: (1 - drop.value) * -22 },
      { perspective: 600 },
      { rotateY: `${turn.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.card, style]}>
      {faceUp && <Emoji asset={UI_EMOJI.heart} size={EMOJI_SIZE} />}
    </Animated.View>
  );
}

export function AppSplash({ onFinished }: { onFinished: () => void }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  const beat = useSharedValue(1);
  const title = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(onFinished, 300);
      return () => clearTimeout(timer);
    }
    title.value = withDelay(TITLE_AT_MS, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    beat.value = withDelay(
      MATCH_AT_MS,
      withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 150 })),
    );
    exit.value = withDelay(REVEAL_MS, withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }));
    const tick = setTimeout(hapticTick, MATCH_AT_MS);
    const startExit = setTimeout(() => setExiting(true), REVEAL_MS);
    const done = setTimeout(onFinished, REVEAL_MS + EXIT_MS);
    return () => {
      clearTimeout(tick);
      clearTimeout(startExit);
      clearTimeout(done);
    };
  }, [reduceMotion, onFinished, beat, title, exit]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.06 }],
  }));
  const pairStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: (1 - title.value) * 6 }],
  }));

  if (reduceMotion) return <View style={styles.root} pointerEvents="auto" />;

  return (
    <Animated.View
      style={[styles.root, rootStyle]}
      // Swallows taps until the lift starts, then lets them through to the home screen.
      pointerEvents={exiting ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.pair, pairStyle]}>
        <SplashCard index={0} />
        <SplashCard index={1} />
      </Animated.View>
      <Animated.View style={[styles.titleBlock, titleStyle]}>
        <Text style={styles.name}>{APP_NAME}</Text>
        <Text style={styles.tagline}>{t("home.tagline")}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.board,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    zIndex: 9999,
  },
  pair: {
    flexDirection: "row",
    gap: space.gridGap,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    alignItems: "center",
    gap: 7,
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  tagline: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
});
