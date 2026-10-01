import { Button, Host, HStack, Image, Text as SwiftText } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, font, foregroundStyle, monospacedDigit } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatScore } from "@/lib/format";
import { useWallet } from "@/store/wallet";

import { USE_LIQUID_GLASS } from "./AppButton";
import { Emoji, UI_EMOJI } from "./Emoji";
import { colors } from "./theme";

const COIN_SIZE = 20;
// The glass button's own leading padding: the coin emoji (which SwiftUI can't draw) is laid
// over a transparent placeholder of the same size at this offset.
const GLASS_LEADING = 24;

/** Coin balance; opens the shop. */
export function CoinsPill() {
  const { t, i18n } = useTranslation();
  const coins = useWallet((s) => s.coins);
  const amount = formatScore(coins, i18n.language);
  const open = () => router.push("/shop");
  const a11y = `${t("coinsA11y", { count: coins })}, ${t("home.shop")}`;

  if (USE_LIQUID_GLASS) {
    return (
      <View accessible accessibilityRole="button" accessibilityLabel={a11y} onAccessibilityTap={open}>
        <Host matchContents>
          <Button onPress={open} modifiers={[buttonStyle("glass"), controlSize("large")]}>
            <HStack spacing={6}>
              <Image systemName="circle.fill" size={COIN_SIZE} color="#00000000" />
              <SwiftText modifiers={[font({ size: 16, weight: "bold" }), monospacedDigit(), foregroundStyle(colors.text)]}>
                {amount}
              </SwiftText>
            </HStack>
          </Button>
        </Host>
        <View style={styles.coinOverlay} pointerEvents="none">
          <Emoji asset={UI_EMOJI.coin} size={COIN_SIZE} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Emoji asset={UI_EMOJI.coin} size={COIN_SIZE} />
      <Text style={styles.value}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  coinOverlay: {
    ...StyleSheet.absoluteFill,
    left: GLASS_LEADING,
    right: undefined,
    width: COIN_SIZE,
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: 0.7,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
