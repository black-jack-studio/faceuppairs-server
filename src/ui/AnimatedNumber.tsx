import { useEffect, useRef } from "react";
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { EASE_COUNT, EASE_OUT, RESULT_ROLL_MS, SCORE_ROLL_MS, SOFT_SPRING } from "@/fx/motion";
import { formatScore } from "@/lib/format";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Same grouping as formatScore (Intl), redone by hand: Intl isn't available inside a worklet.
function group(n: number, separator: string, prefix: string): string {
  "worklet";
  const digits = String(Math.round(Math.abs(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += separator;
    out += digits[i];
  }
  return prefix + (n < 0 ? "-" : "") + out;
}

interface AnimatedNumberProps {
  value: number;
  language: string;
  style: StyleProp<TextStyle>;
  prefix?: string;
  /** Count up from 0 on mount (a result screen); otherwise the first value shows as is. */
  fromZero?: boolean;
  delay?: number;
  /** A small swell each time the number goes up (the live score). */
  bump?: boolean;
  /** How long the roll takes. Defaults: the live score's roll, or the result screens' longer one. */
  duration?: number;
  textAlign?: "left" | "center";
  accessibilityLabel?: string;
}

/**
 * A number that rolls to its new value on the UI thread instead of jumping. The digits are drawn
 * by a read-only TextInput driven from a worklet, so the screen never re-renders per frame; an
 * invisible copy of the final text gives the box its width, so nothing around it moves.
 */
export function AnimatedNumber({
  value,
  language,
  style,
  prefix = "",
  fromZero = false,
  delay = 0,
  bump = false,
  duration,
  textAlign = "left",
  accessibilityLabel,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(fromZero && !reduced ? 0 : value);
  const scale = useSharedValue(1);
  const previous = useRef(value);
  const separator = language === "fr" ? " " : ",";

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (reduced) {
      shown.set(value);
      return;
    }
    if (from === value && !fromZero) return;
    const roll = duration ?? (fromZero ? RESULT_ROLL_MS : SCORE_ROLL_MS);
    shown.set(withDelay(delay, withTiming(value, { duration: roll, easing: EASE_COUNT })));
    if (bump && value > from) {
      // Swells as the count starts, settles on a spring while it rolls.
      scale.set(withSequence(withTiming(1.12, { duration: 160, easing: EASE_OUT }), withSpring(1, SOFT_SPRING)));
    } else if (fromZero && value > 0) {
      // A result total lands with a thud when the count reaches it.
      scale.set(
        withDelay(delay + roll * 0.92, withSequence(withTiming(1.12, { duration: 130, easing: EASE_OUT }), withSpring(1, SOFT_SPRING))),
      );
    }
    // fromZero and delay only matter for the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  const animatedProps = useAnimatedProps(() => {
    const text = group(shown.get(), separator, prefix);
    return { text, defaultValue: text } as never;
  });
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const final = prefix + formatScore(value, language);
  return (
    <Animated.View
      style={[bumpStyle, { transformOrigin: textAlign === "left" ? "left center" : "center" }]}
      accessible
      accessibilityLabel={accessibilityLabel ?? final}
    >
      <Text style={[style, styles.sizer]} importantForAccessibility="no" accessibilityElementsHidden>
        {final}
      </Text>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          animatedProps={animatedProps}
          defaultValue={group(fromZero && !reduced ? 0 : value, separator, prefix)}
          style={[style, styles.input, { textAlign }]}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sizer: {
    opacity: 0,
  },
  input: {
    padding: 0,
    margin: 0,
    width: "100%",
  },
});
