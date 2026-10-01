import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { hapticTick } from "@/lib/haptics";

import { Emoji } from "./Emoji";
import { EMOJI_IMAGES } from "./emojiImages";
import { colors } from "./theme";

const HALF_TURN_MS = 120;
const EMOJI_SIZE = 34;
// Interface-only images that would look out of place on a card.
const NOT_ON_CARDS = new Set(["prohibited", "coin"]);
const ANY_EMOJI = Object.keys(EMOJI_IMAGES).filter((name) => !NOT_ON_CARDS.has(name));

/**
 * A face-up home card: a tap turns it edge-on, swaps in any emoji of the game, and turns it
 * back — a little fidget toy. The home deal itself always opens on a matching pair.
 */
export function HomePreviewCard({ asset, size }: { asset: string; size: number }) {
  const [shown, setShown] = useState(asset);
  const turn = useSharedValue(0);

  const flip = () => {
    hapticTick();
    turn.value = withSequence(
      withTiming(90, { duration: HALF_TURN_MS, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: HALF_TURN_MS + 40, easing: Easing.out(Easing.quad) }),
    );
    setTimeout(() => {
      setShown((current) => {
        let next = current;
        while (next === current) next = ANY_EMOJI[Math.floor(Math.random() * ANY_EMOJI.length)];
        return next;
      });
    }, HALF_TURN_MS);
  };

  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${turn.value}deg` }],
  }));

  return (
    <Pressable onPress={flip} accessible={false}>
      <Animated.View style={[styles.card, { width: size, height: size }, style]}>
        <Emoji asset={shown} size={EMOJI_SIZE} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
