import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_ICONS, iconProgress, type AppIconDef } from "@/game/appIcons";
import {
  applyAppIcon,
  collectEarnedAppIcons,
  currentAppIconId,
  playRecord,
} from "@/lib/appIcons";
import { formatScore } from "@/lib/format";
import { hapticSuccess, hapticTick } from "@/lib/haptics";
import { useWallet } from "@/store/wallet";
import { AppButton, CloseButton } from "@/ui/AppButton";
import { colors, space } from "@/ui/theme";

// Leave the sheet's dismissal animation time before opening the next screen.
const SHEET_CLOSE_MS = 350;

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
const COLUMNS = 2;
const COLUMN_GAP = 20;
// Extra room the glass capsule adds around its label.
const BUTTON_CHROME = 44;
const ACTION_HEIGHT = 54;
// Buttons sized to their words, not to the column.
const MAX_BUTTON_LABEL_WIDTH = 104;

export default function AppIconGallery() {
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const ownedIds = useWallet((s) => s.ownedAppIcons);
  const [current, setCurrent] = useState(currentAppIconId);
  const record = playRecord();
  const tile = Math.floor(
    (width - space.screen * 2 - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS,
  );
  const iconSize = Math.round(tile * 0.7);
  const buttonWidth = Math.min(tile - BUTTON_CHROME, MAX_BUTTON_LABEL_WIDTH);

  // Icons earned by playing: the button shows how far along you are and takes you where
  // that progress is made.
  const progressLabel = (icon: AppIconDef) => {
    const progress = iconProgress(icon, record);
    if (!progress) return "";
    const { current: done, target } = progress;
    if (icon.unlock.kind === "level")
      return t("appIcons.levelProgress", {
        level: icon.unlock.level,
        current: done,
        target,
      });
    if (icon.unlock.kind === "streak")
      return t("appIcons.streakProgress", { current: done, target });
    return t("appIcons.allStarsProgress", { current: done, target });
  };
  const goEarn = (icon: AppIconDef) => {
    hapticTick();
    const destination = icon.unlock.kind === "streak" ? "/chest" : "/career";
    router.back();
    setTimeout(() => router.push(destination), SHEET_CLOSE_MS);
  };

  // A streak reached since the last visit is locked in before showing the grid.
  useEffect(() => {
    collectEarnedAppIcons();
  }, []);

  const owns = (icon: AppIconDef) =>
    icon.unlock.kind === "free" || ownedIds.includes(icon.id);

  const switchTo = async (icon: AppIconDef) => {
    if (await applyAppIcon(icon)) {
      setCurrent(icon.id);
      hapticSuccess();
    }
  };

  const onPress = (icon: AppIconDef) => {
    if (icon.id === current) return;
    if (owns(icon)) return void switchTo(icon);
    if (icon.unlock.kind !== "coins") return;
    const price = icon.unlock.amount;
    const name = t(`appIcons.names.${icon.id}`);
    Alert.alert(
      t("appIcons.buyTitle", { name }),
      t("appIcons.buyBody", { price: formatScore(price, i18n.language) }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("appIcons.buy"),
          onPress: () => {
            const wallet = useWallet.getState();
            if (!wallet.spendCoins(price)) {
              Alert.alert(
                t("boosters.notEnough"),
                t("boosters.notEnoughBody", { price }),
                [
                  {
                    text: t("boosters.toShop"),
                    onPress: () => router.push("/shop"),
                  },
                  { text: t("cancel"), style: "cancel" },
                ],
              );
              return;
            }
            wallet.unlockAppIcons([icon.id]);
            void switchTo(icon);
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.sheet} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t("appIcons.title")}
        </Text>
        <CloseButton label={t("close")} />
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {APP_ICONS.map((icon) => {
          const owned = owns(icon);
          const inUse = icon.id === current;
          const name = t(`appIcons.names.${icon.id}`);
          return (
            <View key={icon.id} style={[styles.tile, { width: tile }]}>
              <Image
                source={PREVIEWS[icon.id]}
                style={[
                  {
                    width: iconSize,
                    height: iconSize,
                    borderRadius: iconSize * 0.225,
                  },
                  !owned && styles.locked,
                ]}
                contentFit="cover"
                transition={0}
                accessibilityLabel={name}
              />
              <Text style={styles.name}>{name}</Text>
              <View style={styles.action}>
                {owned || icon.unlock.kind === "free" ? (
                  <AppButton
                    label={inUse ? t("appIcons.inUse") : t("appIcons.use")}
                    variant={inUse ? "secondary" : "primary"}
                    width={buttonWidth}
                    disabled={inUse}
                    onPress={() => onPress(icon)}
                  />
                ) : icon.unlock.kind === "coins" ? (
                  <AppButton
                    label={t("appIcons.buyFor", {
                      price: formatScore(icon.unlock.amount, i18n.language),
                    })}
                    variant="primary"
                    width={buttonWidth}
                    onPress={() => onPress(icon)}
                  />
                ) : (
                  <AppButton
                    label={progressLabel(icon)}
                    width={buttonWidth}
                    onPress={() => goEarn(icon)}
                  />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.board,
    paddingHorizontal: space.screen,
    paddingTop: 32,
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
    rowGap: 40,
    paddingBottom: 48,
  },
  tile: {
    alignItems: "center",
    gap: 12,
  },
  // Fixed slot: a native button first laid out off screen (further down the scroll) could
  // measure short and spill over the name above it.
  action: {
    height: ACTION_HEIGHT,
    marginTop: 4,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  locked: {
    opacity: 0.35,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
