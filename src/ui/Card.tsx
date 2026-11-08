import { memo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { DEAL_MS, EASE_IN_OUT, EASE_OUT, SHEEN_MS, SOFT_SPRING, VANISH_MS } from "@/fx/motion";
import type { PackIcon } from "@/game/iconPacks";

import { Emoji } from "./Emoji";
import { colors, radius } from "./theme";

const FLIP_MS = 260;
const SHAKE_STEP_MS = 55;
/** How far a card leans under the finger, at its very edge. */
const PRESS_TILT_DEG = 7;
const PRESS_SCALE = 0.97;
const PRESS_IN = { duration: 160, dampingRatio: 0.9 } as const;
const PRESS_OUT = { duration: 420, dampingRatio: 0.55 } as const;

export type CardFinale = "wave" | "clear";

interface CardProps {
  index: number;
  icon: PackIcon;
  faceUp: boolean;
  matched: boolean;
  size: number;
  onPress: (index: number) => void;
  /** When set, the card arrives (fades and rises into place) after this many ms on mount. */
  dealDelay?: number | null;
  /** Changes to replay a "no" shake: the miss that just cost a life. */
  shakeKey?: number;
  /** The finished board: the light runs across it ("wave"), then on Endless the cards go ("clear"). */
  finale?: CardFinale | null;
  finaleDelay?: number;
}

// DESIGN.md: black in every state, square corners, no border. The card is treated as an object:
// it leans under the finger like a real card pressed on the table, and when its pair is found a
// band of light crosses its face once, the way a black metal card catches the light. Nothing ever
// grows and the emoji never moves on its own.
export const Card = memo(function Card({
  index,
  icon,
  faceUp,
  matched,
  size,
  onPress,
  dealDelay = null,
  shakeKey = 0,
  finale = null,
  finaleDelay = 0,
}: CardProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const shown = faceUp || matched;
  const rotation = useSharedValue(shown ? 180 : 0);
  const dealing = dealDelay !== null;
  const scale = useSharedValue(dealing && !reduced ? 0.9 : 1);
  const lift = useSharedValue(dealing && !reduced ? 10 : 0);
  const opacity = useSharedValue(dealing ? 0 : 1);
  const shift = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const press = useSharedValue(1);
  /** 0 → 1: the band of light crossing the face, left to right. */
  const sheen = useSharedValue(0);

  const shine = (delay: number) => {
    sheen.set(0);
    sheen.set(withDelay(delay, withTiming(1, { duration: SHEEN_MS, easing: EASE_IN_OUT })));
  };

  useEffect(() => {
    rotation.set(withTiming(shown ? 180 : 0, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }));
  }, [shown, rotation]);

  // Arrival of a new board.
  useEffect(() => {
    if (dealDelay === null) return;
    opacity.set(withDelay(dealDelay, withTiming(1, { duration: DEAL_MS, easing: EASE_OUT })));
    if (reduced) return;
    scale.set(withDelay(dealDelay, withSpring(1, { duration: DEAL_MS + 120, dampingRatio: 0.7 })));
    lift.set(withDelay(dealDelay, withSpring(0, { duration: DEAL_MS + 120, dampingRatio: 0.7 })));
    // Mount only: a board is dealt once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pair: the light crosses both faces once the card just tapped has finished turning over.
  useEffect(() => {
    if (!matched) return;
    shine(FLIP_MS * 0.8);
    // Only on becoming matched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  // The miss that cost a life shakes its head.
  useEffect(() => {
    if (!shakeKey || reduced) return;
    shift.set(
      withSequence(
        withTiming(-7, { duration: SHAKE_STEP_MS }),
        withTiming(7, { duration: SHAKE_STEP_MS }),
        withTiming(-5, { duration: SHAKE_STEP_MS }),
        withTiming(5, { duration: SHAKE_STEP_MS }),
        withTiming(-2, { duration: SHAKE_STEP_MS }),
        withSpring(0, SOFT_SPRING),
      ),
    );
  }, [shakeKey, reduced, shift]);

  // The board is done: the light runs across the grid in a wave from the last pair, and on a
  // cleared Endless board the cards then sink away (smaller, never bigger).
  useEffect(() => {
    if (!finale) return;
    shine(finaleDelay);
    if (finale === "wave") return;
    const leave = finaleDelay + SHEEN_MS * 0.6;
    opacity.set(withDelay(leave, withTiming(0, { duration: VANISH_MS, easing: EASE_OUT })));
    if (reduced) return;
    scale.set(withDelay(leave, withTiming(0.88, { duration: VANISH_MS, easing: EASE_OUT })));
    lift.set(withDelay(leave, withTiming(8, { duration: VANISH_MS, easing: EASE_OUT })));
    // Plays once, when the board finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finale]);

  // Under the finger the card leans toward the spot pressed: press near the right edge and the
  // right edge goes down, like a real card on felt. It springs back as the finger lifts.
  const onPressIn = (e: GestureResponderEvent) => {
    if (reduced) return;
    const dx = Math.max(-1, Math.min(1, (e.nativeEvent.locationX / size) * 2 - 1));
    const dy = Math.max(-1, Math.min(1, (e.nativeEvent.locationY / size) * 2 - 1));
    tiltY.set(withSpring(dx * PRESS_TILT_DEG, PRESS_IN));
    tiltX.set(withSpring(-dy * PRESS_TILT_DEG, PRESS_IN));
    press.set(withSpring(PRESS_SCALE, PRESS_IN));
  };
  const onPressOut = () => {
    tiltX.set(withSpring(0, PRESS_OUT));
    tiltY.set(withSpring(0, PRESS_OUT));
    press.set(withSpring(1, PRESS_OUT));
  };

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { perspective: 600 },
      { translateX: shift.get() },
      { translateY: lift.get() },
      { rotateX: `${tiltX.get()}deg` },
      { rotateY: `${tiltY.get()}deg` },
      { scale: scale.get() * press.get() },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotation.get()}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${rotation.get() + 180}deg` }],
  }));
  // The band starts fully off the left edge and leaves fully off the right one.
  const band = size * 0.9;
  const sheenStyle = useAnimatedStyle(() => {
    const p = sheen.get();
    return {
      opacity: p === 0 || p === 1 ? 0 : 1,
      transform: [{ translateX: -band * 1.4 + p * (size + band * 2) }, { rotate: "18deg" }],
    };
  });

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
      onPressIn={shown ? undefined : onPressIn}
      onPressOut={onPressOut}
      disabled={shown}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: shown, selected: faceUp }}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, wrapStyle]}>
        <Animated.View style={[styles.face, backStyle]} />
        <Animated.View style={[styles.face, frontStyle]} importantForAccessibility="no-hide-descendants">
          <Emoji asset={icon.asset} size={Math.round(size * 0.62)} />
        </Animated.View>
        <View pointerEvents="none" style={styles.sheenClip}>
          <Animated.View style={[styles.sheen, { width: band, height: size * 2, top: -size / 2 }, sheenStyle]} />
        </View>
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
  sheenClip: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    borderRadius: radius.card,
  },
  // Soft-edged white light, brightest down the middle of the band: a reflection, not a stripe.
  sheen: {
    position: "absolute",
    left: 0,
    experimental_backgroundImage:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.20) 50%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0) 100%)",
  },
});
