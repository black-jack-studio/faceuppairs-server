import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getAppIcon } from "@/game/appIcons";
import { applyAppIcon } from "@/lib/appIcons";
import { hapticSuccess } from "@/lib/haptics";
import { AppButtonGroup, CloseButton } from "@/ui/AppButton";
import { APP_ICON_PREVIEWS } from "@/ui/appIconPreviews";
import { colors, space } from "@/ui/theme";
import { SHEET_EDGES } from "@/ui/sheet";

const ICON_SIZE = 150;
const BUTTON_WIDTH = 220;
// Leave the sheet's dismissal animation time before opening the gallery.
const SHEET_CLOSE_MS = 350;

/** "New icon unlocked": shown from the home screen right after an icon is earned. */
export default function IconUnlocked() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const icon = getAppIcon(id ?? "");

  useEffect(() => {
    if (icon) hapticSuccess();
  }, [icon]);

  if (!icon) return null;
  const name = t(`appIcons.names.${icon.id}`);

  const equip = async () => {
    await applyAppIcon(icon);
    router.back();
  };
  const openGallery = () => {
    router.back();
    setTimeout(() => router.push("/app-icon"), SHEET_CLOSE_MS);
  };

  return (
    <SafeAreaView style={styles.sheet} edges={SHEET_EDGES}>
      <View style={styles.closeRow}>
        <CloseButton label={t("close")} />
      </View>
      <Image
        source={APP_ICON_PREVIEWS[icon.id]}
        style={styles.icon}
        contentFit="cover"
        transition={0}
        accessibilityLabel={name}
      />
      <Text style={styles.title} accessibilityRole="header">
        {t("appIcons.unlockedTitle")}
      </Text>
      <AppButtonGroup
        buttons={[
          { label: t("appIcons.equip"), variant: "primary", size: "large", width: BUTTON_WIDTH, onPress: equip },
          { label: t("appIcons.gallery"), size: "large", width: BUTTON_WIDTH, onPress: openGallery },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.board,
    paddingHorizontal: space.screen,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
    gap: 24,
  },
  closeRow: {
    alignSelf: "stretch",
    alignItems: "flex-end",
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.225,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
});
