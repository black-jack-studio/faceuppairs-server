import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Same badge as FaceUp Blackjack: red dot, white "!", slow pulse.
const SIZE = 16;
const RED = "#ef4444";
const PULSE_HALF_MS = 750;

export function NotificationDot() {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.inOut(Easing.ease);
    scale.value = withRepeat(
      withSequence(withTiming(1.2, { duration: PULSE_HALF_MS, easing: ease }), withTiming(1, { duration: PULSE_HALF_MS, easing: ease })),
      -1,
    );
  }, [reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.dot, style]} pointerEvents="none" accessible={false}>
      <Text style={styles.mark}>!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  mark: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 13,
    includeFontPadding: false,
  },
});
