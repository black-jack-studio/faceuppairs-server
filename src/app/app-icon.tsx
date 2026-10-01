import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_ICONS, iconProgress, type AppIconDef } from "@/game/appIcons";
import { applyAppIcon, collectEarnedAppIcons, currentAppIconId, playRecord } from "@/lib/appIcons";
import { formatScore } from "@/lib/format";
import { hapticSuccess, hapticTick } from "@/lib/haptics";
import { useWallet } from "@/store/wallet";
import { CloseButton } from "@/ui/AppButton";
import { colors, space } from "@/ui/theme";

const PREVIEWS: Record<string, number> = {
  original: require("../../assets/images/app-icons/original-preview.png"),
  night: require("../../assets/images/app-icons/night-preview.png"),
  blue: require("../../assets/images/app-icons/blue-preview.png"),
  red: require("../../assets/images/app-icons/red-preview.png"),
  candy: require("../../assets/images/app-icons/candy-preview.png"),
  mint: require("../../assets/images/app-icons/mint-preview.png"),
  violet: require("../../assets/images/app-icons/violet-preview.png"),
  gold: require("../../assets/images/app-icons/gold-preview.png"),
};
const COLUMNS = 3;
const COLUMN_GAP = 20;

export default function AppIconGallery() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const ownedIds = useWallet((s) => s.ownedAppIcons);
  const [current, setCurrent] = useState(currentAppIconId);
  const record = playRecord();
  const tile = Math.floor((width - space.screen * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS);

  // A streak reached since the last visit is locked in before showing the grid.
  useEffect(() => {
    collectEarnedAppIcons();
  }, []);

  const owns = (icon: AppIconDef) => icon.unlock.kind === "free" || ownedIds.includes(icon.id);

  const switchTo = async (icon: AppIconDef) => {
    if (await applyAppIcon(icon)) {
      setCurrent(icon.id);
      hapticSuccess();
    }
  };

  const onPress = (icon: AppIconDef) => {
    hapticTick();
    if (icon.id === current) return;
    if (owns(icon)) return void switchTo(icon);
    if (icon.unlock.kind !== "coins") return;
    const price = icon.unlock.amount;
    const name = t(`appIcons.names.${icon.id}`);
    Alert.alert(t("appIcons.buyTitle", { name }), t("appIcons.buyBody", { price: formatScore(price, i18n.language) }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("appIcons.buy"),
        onPress: () => {
          const wallet = useWallet.getState();
          if (!wallet.spendCoins(price)) {
            Alert.alert(t("boosters.notEnough"), t("boosters.notEnoughBody", { price }), [
              { text: t("boosters.toShop"), onPress: () => router.push("/shop") },
              { text: t("cancel"), style: "cancel" },
            ]);
            return;
          }
          wallet.unlockAppIcons([icon.id]);
          void switchTo(icon);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.sheet} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t("appIcons.title")}
        </Text>
        <CloseButton label={t("close")} />
      </View>

      <View style={styles.grid}>
        {APP_ICONS.map((icon) => {
          const owned = owns(icon);
          const inUse = icon.id === current;
          const progress = owned ? null : iconProgress(icon, record);
          const status = inUse
            ? t("appIcons.inUse")
            : owned
              ? t("appIcons.available")
              : icon.unlock.kind === "coins"
                ? t("appIcons.price", { price: formatScore(icon.unlock.amount, i18n.language) })
                : icon.unlock.kind === "level"
                  ? t("appIcons.level", { level: icon.unlock.level })
                  : icon.unlock.kind === "streak"
                    ? t("appIcons.streak", { days: icon.unlock.days })
                    : t("appIcons.allStars");
          const name = t(`appIcons.names.${icon.id}`);
          return (
            <Pressable
              key={icon.id}
              onPress={() => onPress(icon)}
              style={({ pressed }) => [styles.tile, { width: tile }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${status}`}
              accessibilityState={{ selected: inUse }}
            >
              <Image
                source={PREVIEWS[icon.id]}
                style={[{ width: tile, height: tile, borderRadius: tile * 0.225 }, !owned && styles.locked]}
                contentFit="cover"
                transition={0}
              />
              <Text style={styles.name}>{name}</Text>
              <Text style={[styles.status, inUse && styles.statusInUse]} numberOfLines={2}>
                {status}
              </Text>
              {progress && (
                <View style={styles.progress}>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(progress.current / progress.target) * 100}%` }]} />
                  </View>
                  <Text style={styles.count}>
                    {progress.current}/{progress.target}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.board,
    paddingHorizontal: space.screen,
    paddingTop: 32,
    paddingBottom: 32,
    gap: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: COLUMN_GAP,
    rowGap: 24,
  },
  tile: {
    alignItems: "center",
    gap: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  locked: {
    opacity: 0.35,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  status: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  statusInUse: {
    color: colors.text,
    fontWeight: "700",
  },
  progress: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  track: {
    alignSelf: "stretch",
    height: 3,
    backgroundColor: colors.hairline,
    overflow: "hidden",
  },
  fill: {
    height: 3,
    backgroundColor: colors.text,
  },
  count: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
