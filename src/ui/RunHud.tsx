import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { EASE_IN_OUT, EASE_OUT, SETTLE_SPRING } from "@/fx/motion";

import { Emoji, UI_EMOJI } from "./Emoji";

const HEART_FALL_MS = 900;

/**
 * One heart of the lives row. Losing it: the heart swells, then a copy tumbles out of the header
 * while its slot dims to the usual 20 %. The very last heart beats, so the tension is felt.
 */
export function LifeHeart({ lost, last, size }: { lost: boolean; last: boolean; size: number }) {
  const reduced = useReducedMotion();
  const [falls, setFalls] = useState(0);
  const wasLost = useRef(lost);
  const beat = useSharedValue(1);

  useEffect(() => {
    if (lost && !wasLost.current) setFalls((n) => n + 1);
    wasLost.current = lost;
  }, [lost]);

  useEffect(() => {
    if (!last || lost || reduced) {
      cancelAnimation(beat);
      beat.set(withTiming(1, { duration: 150 }));
      return;
    }
    // Lub-dub, then a rest: a heartbeat, not a pulse.
    beat.set(
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 110, easing: EASE_OUT }),
          withTiming(1, { duration: 130, easing: EASE_IN_OUT }),
          withTiming(1.07, { duration: 100, easing: EASE_OUT }),
          withTiming(1, { duration: 160, easing: EASE_IN_OUT }),
          withTiming(1, { duration: 650 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(beat);
  }, [last, lost, reduced, beat]);

  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));

  return (
    <View>
      <Animated.View style={[beatStyle, lost && styles.lost]}>
        <Emoji asset={UI_EMOJI.heart} size={size} />
      </Animated.View>
      {falls > 0 && !reduced && <FallingHeart key={falls} size={size} />}
    </View>
  );
}

function FallingHeart({ size }: { size: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withTiming(1, { duration: HEART_FALL_MS }));
  }, [t]);

  // Thrown a little up and sideways, then down under gravity, turning as it goes.
  const style = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4,
      transform: [
        { translateX: -p * 14 },
        { translateY: -18 * p + 120 * p * p },
        { rotate: `${-p * 40}deg` },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Emoji asset={UI_EMOJI.heart} size={size} />
    </Animated.View>
  );
}

/**
 * "Streak ×3" in the HUD: it slams a little bigger at each pair in a row, and when the streak
 * breaks, the old value falls off so the loss is seen.
 */
export function StreakCounter({
  streak,
  text,
  style,
  idleStyle,
}: {
  streak: number;
  text: (n: number) => string;
  style: StyleProp<TextStyle>;
  idleStyle: StyleProp<TextStyle>;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const previous = useRef(streak);
  const [broken, setBroken] = useState<{ key: number; value: number } | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = streak;
    if (reduced) return;
    if (streak > from && streak >= 2) {
      const peak = Math.min(1.18 + (streak - 2) * 0.06, 1.4);
      scale.set(withSequence(withTiming(peak, { duration: 160, easing: EASE_OUT }), withSpring(1, SETTLE_SPRING)));
    } else if (streak < from && from >= 2) {
      setBroken({ key: Date.now(), value: from });
    }
  }, [streak, reduced, scale]);

  const style2 = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <View>
      <Animated.View style={[style2, { transformOrigin: "right center" }]}>
        <Text style={[style, streak < 2 && idleStyle]}>{text(Math.max(streak, 1))}</Text>
      </Animated.View>
      {broken && <FallingText key={broken.key} text={text(broken.value)} style={style} />}
    </View>
  );
}

function FallingText({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withTiming(1, { duration: 850 }));
  }, [t]);
  const anim = useAnimatedStyle(() => {
    const p = t.get();
    return {
      opacity: 1 - p,
      transform: [{ translateY: 70 * p * p }, { rotate: `${p * 18}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.fallingText, anim]}>
      <Text style={style} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

/** A label that lands with a stamp when it appears (the "New best" line). */
export function Stamp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 1.8);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withDelay(delay, withTiming(1, { duration: 180 })));
    if (!reduced) scale.set(withDelay(delay, withSpring(1, SETTLE_SPRING)));
  }, [scale, opacity, delay, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  lost: {
    opacity: 0.2,
  },
  fallingText: {
    alignItems: "flex-end",
  },
});
