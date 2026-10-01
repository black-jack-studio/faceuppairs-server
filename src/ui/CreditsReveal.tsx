import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { hapticSuccess, hapticTick } from "@/lib/haptics";

import { Emoji, UI_EMOJI } from "./Emoji";
import { colors, space } from "./theme";

// Hidden behind 7 taps on the version number in Settings: four cards turn over one by one,
// two pairs, then the names of the people who made the game.
const CARDS = [UI_EMOJI.sparkles, UI_EMOJI.heart, UI_EMOJI.heart, UI_EMOJI.sparkles];
const CARD_SIZE = 60;
const FLIP_MS = 300;
const STAGGER_MS = 220;
const TEXT_DELAY_MS = STAGGER_MS * CARDS.length + FLIP_MS;

export function CreditsReveal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation("settings");

  useEffect(() => {
    if (!visible) return;
    const timers = CARDS.map((_, i) => setTimeout(hapticTick, i * STAGGER_MS + FLIP_MS / 2));
    timers.push(setTimeout(hapticSuccess, TEXT_DELAY_MS));
    return () => timers.forEach(clearTimeout);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={t("madeWithLove")}>
        <View style={styles.cards}>
          {CARDS.map((asset, i) => (
            <RevealCard key={i} asset={asset} delay={i * STAGGER_MS} />
          ))}
        </View>
        <Animated.View entering={FadeIn.delay(TEXT_DELAY_MS).duration(500)} style={styles.text}>
          <Text style={styles.caption}>{t("madeWithLove")}</Text>
          <Text style={styles.names}>Stanislas & Anatole Beaudoin</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function RevealCard({ asset, delay }: { asset: string; delay: number }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withDelay(delay, withTiming(180, { duration: FLIP_MS, easing: Easing.out(Easing.cubic) }));
  }, [delay, rotation]);

  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${rotation.value}deg` }] }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${rotation.value + 180}deg` }] }));

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.face, back]} />
      <Animated.View style={[styles.face, front]}>
        <Emoji asset={asset} size={36} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.board,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  cards: {
    flexDirection: "row",
    gap: space.gridGap,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  face: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
  },
  text: {
    alignItems: "center",
    gap: 6,
  },
  caption: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "500",
  },
  names: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
});
