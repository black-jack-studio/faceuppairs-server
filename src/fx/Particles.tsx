import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { hapticImpact } from "@/lib/haptics";
import { Emoji } from "@/ui/Emoji";

// Secret-pair effects. None of them catches touches: the game goes on underneath.

const FLYBY_MS = 1800;
const FLYBY_SIZE = 76;
const TRAIL_COUNT = 5;
const TRAIL_GAP_MS = 90;
const TRAIL_SIZE = 26;

/** One emoji crosses the screen on a gentle wave, sparkles trailing behind. */
export function Flyby({ sprite, trail, onDone }: { sprite: string; trail?: string; onDone: () => void }) {
  useEffect(() => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    const timer = setTimeout(onDone, FLYBY_MS + TRAIL_COUNT * TRAIL_GAP_MS + 100);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      {trail
        ? Array.from({ length: TRAIL_COUNT }, (_, i) => (
            <FlybySprite key={i} asset={trail} size={TRAIL_SIZE} delay={(i + 1) * TRAIL_GAP_MS} fade />
          ))
        : null}
      <FlybySprite asset={sprite} size={FLYBY_SIZE} delay={0} />
    </>
  );
}

function FlybySprite({ asset, size, delay, fade = false }: { asset: string; size: number; delay: number; fade?: boolean }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: FLYBY_MS, easing: Easing.linear }));
  }, [delay, t]);

  const style = useAnimatedStyle(() => {
    const wave = Math.sin(t.value * Math.PI * 4);
    return {
      opacity: t.value === 0 ? 0 : fade ? 0.85 : 1,
      transform: [
        { translateX: -FLYBY_SIZE - 20 + t.value * (width + FLYBY_SIZE * 2 + 40) },
        { translateY: height * 0.3 + wave * 22 + (FLYBY_SIZE - size) / 2 },
        { rotate: `${wave * 8}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.sprite, { width: size, height: size }, style]}>
      <Emoji asset={asset} size={size} />
    </Animated.View>
  );
}

const FOUNTAIN_COUNT = 24;
const FOUNTAIN_SECONDS = 1.6;
const GRAVITY = 2600;
const PARTICLE_SIZE = 40;

interface Throw {
  key: number;
  asset: string;
  vx: number;
  vy: number;
  spin: number;
  delay: number;
}

/** A handful of emojis thrown up from the bottom of the screen, falling back under gravity. */
export function Fountain({ sprites, onDone }: { sprites: readonly string[]; onDone: () => void }) {
  const [throws] = useState<Throw[]>(() =>
    Array.from({ length: FOUNTAIN_COUNT }, (_, i) => {
      const angle = ((-90 + (Math.random() - 0.5) * 64) * Math.PI) / 180;
      const speed = 1300 + Math.random() * 700;
      return {
        key: i,
        asset: sprites[i % sprites.length],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 160,
      };
    }),
  );

  useEffect(() => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
    const timer = setTimeout(onDone, FOUNTAIN_SECONDS * 1000 + 260);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      {throws.map((p) => (
        <Thrown key={p.key} p={p} />
      ))}
    </>
  );
}

function Thrown({ p }: { p: Throw }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(p.delay, withTiming(1, { duration: FOUNTAIN_SECONDS * 1000, easing: Easing.linear }));
  }, [p.delay, t]);

  const style = useAnimatedStyle(() => {
    const s = t.value * FOUNTAIN_SECONDS;
    return {
      opacity: t.value === 0 ? 0 : 1 - Math.max(0, (t.value - 0.8) / 0.2),
      transform: [
        { translateX: width / 2 - PARTICLE_SIZE / 2 + p.vx * s },
        { translateY: height + 10 + p.vy * s + 0.5 * GRAVITY * s * s },
        { rotate: `${p.spin * t.value}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.sprite, { width: PARTICLE_SIZE, height: PARTICLE_SIZE }, style]}>
      <Emoji asset={p.asset} size={PARTICLE_SIZE} />
    </Animated.View>
  );
}

const RAIN_COUNT = 26;
const RAIN_SPREAD_MS = 700;

interface Drop {
  key: number;
  asset: string;
  x: number;
  duration: number;
  delay: number;
  phase: number;
  size: number;
}

/** Emojis drifting down from the top, swaying a little. */
export function Rain({ sprites, onDone }: { sprites: readonly string[]; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [drops] = useState<Drop[]>(() =>
    Array.from({ length: RAIN_COUNT }, (_, i) => ({
      key: i,
      asset: sprites[i % sprites.length],
      x: Math.random() * (width - 40),
      duration: 1500 + Math.random() * 800,
      delay: Math.random() * RAIN_SPREAD_MS,
      phase: Math.random() * Math.PI * 2,
      size: 30 + Math.random() * 18,
    })),
  );

  useEffect(() => {
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    const timer = setTimeout(onDone, RAIN_SPREAD_MS + 2300 + 100);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <>
      {drops.map((d) => (
        <Falling key={d.key} d={d} />
      ))}
    </>
  );
}

function Falling({ d }: { d: Drop }) {
  const { height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(d.delay, withTiming(1, { duration: d.duration, easing: Easing.in(Easing.quad) }));
  }, [d.delay, d.duration, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1,
    transform: [
      { translateX: d.x + Math.sin(d.phase + t.value * Math.PI * 3) * 18 },
      { translateY: -d.size - 10 + t.value * (height + d.size * 2 + 20) },
      { rotate: `${Math.sin(d.phase + t.value * Math.PI * 2) * 25}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.sprite, { width: d.size, height: d.size }, style]}>
      <Emoji asset={d.asset} size={d.size} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sprite: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
