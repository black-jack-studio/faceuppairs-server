import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

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
  /** Content runs to the top edge and scrolls under the header; it must pad itself with `useHeaderInset()`. */
  overlayHeader?: boolean;
  children: ReactNode;
}

export const HEADER_HEIGHT = 56;

/** Top padding for `overlayHeader` content: status bar plus header. */
export function useHeaderInset() {
  return useSafeAreaInsets().top + HEADER_HEIGHT;
}

export function Screen({
  title,
  onBack,
  showBack = true,
  trailing,
  compact = false,
  overlayHeader = false,
  children,
}: ScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.screen} edges={overlayHeader ? ["bottom"] : ["top", "bottom"]}>
      {(showBack || title || trailing) && (
        <View style={[styles.header, overlayHeader && [styles.headerOverlay, { top: insets.top }]]}>
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
    height: HEADER_HEIGHT,
    paddingHorizontal: space.screen - 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1,
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
