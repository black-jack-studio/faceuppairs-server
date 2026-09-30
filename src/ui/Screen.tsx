import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "./AppButton";
import { colors, space } from "./theme";

interface ScreenProps {
  title?: string;
  /** Replaces the default back action (e.g. to confirm leaving a game). */
  onBack?: () => void;
  showBack?: boolean;
  trailing?: ReactNode;
  /** Game screens: narrower side gutter so the board gets the width. */
  compact?: boolean;
  children: ReactNode;
}

export function Screen({ title, onBack, showBack = true, trailing, compact = false, children }: ScreenProps) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      {(showBack || title || trailing) && (
        <View style={styles.header}>
          <View style={styles.side}>
            {showBack && <BackButton label={t("back")} onPress={onBack ?? (() => router.back())} />}
          </View>
          {title ? (
            <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          <View style={[styles.side, styles.sideEnd]}>{trailing}</View>
        </View>
      )}
      <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.board,
  },
  header: {
    height: 56,
    paddingHorizontal: space.screen - 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  side: {
    width: 88,
    flexDirection: "row",
    alignItems: "center",
  },
  sideEnd: {
    justifyContent: "flex-end",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    paddingHorizontal: space.screen,
  },
  bodyCompact: {
    paddingHorizontal: space.gameScreen,
  },
});
