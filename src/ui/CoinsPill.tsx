import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

import { formatScore } from "@/lib/format";
import { useWallet } from "@/store/wallet";

import { Emoji, UI_EMOJI } from "./Emoji";
import { colors } from "./theme";

/** Coin balance; opens the shop. */
export function CoinsPill() {
  const { t, i18n } = useTranslation();
  const coins = useWallet((s) => s.coins);
  return (
    <Pressable
      onPress={() => router.push("/shop")}
      accessibilityRole="button"
      accessibilityLabel={`${t("coinsA11y", { count: coins })}, ${t("home.shop")}`}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <Emoji asset={UI_EMOJI.coin} size={20} />
      <Text style={styles.value}>{formatScore(coins, i18n.language)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
