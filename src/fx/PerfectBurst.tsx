import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, type GestureResponderEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { hapticImpact, hapticSuccess, hapticTick } from "@/lib/haptics";
import { Emoji } from "@/ui/Emoji";

// Emojis fall row by row from the bottom up until the screen is full, with air between them.
// A tap (or a short wait) blows them all away from the finger.
const CELL = 62;
const SIZE = 44;
const ROW_DELAY_MS = 60;
const DROP_MS = 520;
const SETTLE_MS = 180;
const AUTO_EXPLODE_MS = 2600;
// The tap first draws everything in a little (a breath), then the burst: physics, not a
// tween — each emoji is thrown in its own direction and falls back under gravity.
const PINCH_MS = 170;
const PINCH = 0.14;
// Long enough for an emoji thrown hardest upward to fall back past the bottom edge: they leave
// by going off screen, never by fading.
const EXPLODE_SECONDS = 2.6;
const GRAVITY = 1500;

interface Particle {
  key: number;
  x: number;
  y: number;
  asset: string;
  rotation: number;
  delay: number;
  speed: number;
  spin: number;
  /** Spread around the straight-out direction, so the burst goes everywhere. */
  angle: number;
  lift: number;
}

function buildParticles(width: number, height: number, emojis: readonly string[]) {
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  const left = (width - cols * CELL) / 2 + CELL / 2;
  const top = (height - rows * CELL) / 2 + CELL / 2;
  const particles: Particle[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      particles.push({
        key: row * cols + col,
        x: left + col * CELL + (Math.random() - 0.5) * 10,
        y: top + row * CELL + (Math.random() - 0.5) * 10,
        asset: emojis[Math.floor(Math.random() * emojis.length)],
        rotation: (Math.random() - 0.5) * 36,
        delay: (rows - 1 - row) * ROW_DELAY_MS + Math.random() * 80,
        speed: 380 + Math.random() * 520,
        spin: (Math.random() - 0.5) * 900,
        angle: (Math.random() - 0.5) * 1.6,
        lift: 150 + Math.random() * 350,
      });
    }
  }
  return { particles, rows, filledAfter: (rows - 1) * ROW_DELAY_MS + 80 + DROP_MS + SETTLE_MS };
}

export function PerfectBurst({ emojis, onDone }: { emojis: readonly string[]; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const [{ particles, rows, filledAfter }] = useState(() => buildParticles(width, height, emojis));
  const pinch = useSharedValue(0);
  const boom = useSharedValue(0);
  const originX = useSharedValue(width / 2);
  const originY = useSharedValue(height / 2);
  const exploded = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const explode = (x: number, y: number) => {
    if (exploded.current) return;
    exploded.current = true;
    originX.value = x;
    originY.value = y;
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    pinch.value = withSequence(
      withTiming(1, { duration: PINCH_MS, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 120, easing: Easing.in(Easing.quad) }),
    );
    boom.value = withDelay(PINCH_MS, withTiming(1, { duration: EXPLODE_SECONDS * 1000, easing: Easing.linear }));
    timers.current.push(setTimeout(() => hapticImpact(Haptics.ImpactFeedbackStyle.Heavy), PINCH_MS));
    timers.current.push(setTimeout(onDone, PINCH_MS + EXPLODE_SECONDS * 1000 + 60));
  };

  useEffect(() => {
    const list = timers.current;
    // A light tick as each row lands, then a success buzz once the screen is full.
    for (let r = 0; r < rows; r++) list.push(setTimeout(hapticTick, r * ROW_DELAY_MS + DROP_MS));
    list.push(setTimeout(hapticSuccess, filledAfter));
    list.push(setTimeout(() => explode(width / 2, height / 2), filledAfter + AUTO_EXPLODE_MS));
    return () => list.forEach(clearTimeout);
    // Runs once: the layout is fixed for the life of the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPressIn = (e: GestureResponderEvent) => explode(e.nativeEvent.pageX, e.nativeEvent.pageY);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPressIn={onPressIn} accessibilityRole="button" accessibilityLabel="Perfect">
      {particles.map((p) => (
        <FillParticle key={p.key} p={p} pinch={pinch} boom={boom} originX={originX} originY={originY} />
      ))}
    </Pressable>
  );
}

function FillParticle({
  p,
  pinch,
  boom,
  originX,
  originY,
}: {
  p: Particle;
  pinch: SharedValue<number>;
  boom: SharedValue<number>;
  originX: SharedValue<number>;
  originY: SharedValue<number>;
}) {
  const { height } = useWindowDimensions();
  const drop = useSharedValue(-(p.y + SIZE + 40 + height * 0.1));

  useEffect(() => {
    drop.value = withDelay(
      p.delay,
      withSequence(
        withTiming(0, { duration: DROP_MS, easing: Easing.in(Easing.quad) }),
        withTiming(-10, { duration: SETTLE_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: SETTLE_MS / 2, easing: Easing.in(Easing.quad) }),
      ),
    );
  }, [drop, p.delay]);

  const style = useAnimatedStyle(() => {
    const dx = p.x - originX.value;
    const dy = p.y - originY.value;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    // Straight away from the finger, turned by this emoji's own angle.
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const ux = (dx / distance) * cos - (dy / distance) * sin;
    const uy = (dx / distance) * sin + (dy / distance) * cos;
    const s = boom.value * EXPLODE_SECONDS;
    const burstX = ux * p.speed * s;
    const burstY = (uy * p.speed - p.lift) * s + 0.5 * GRAVITY * s * s;
    return {
      transform: [
        { translateX: p.x - SIZE / 2 - dx * PINCH * pinch.value + burstX },
        { translateY: p.y - SIZE / 2 + drop.value - dy * PINCH * pinch.value + burstY },
        { rotate: `${p.rotation + boom.value * p.spin}deg` },
        { scale: 1 - pinch.value * 0.15 + boom.value * 0.2 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.sprite, style]} pointerEvents="none">
      <Emoji asset={p.asset} size={SIZE} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sprite: {
    position: "absolute",
    left: 0,
    top: 0,
    width: SIZE,
    height: SIZE,
  },
});
