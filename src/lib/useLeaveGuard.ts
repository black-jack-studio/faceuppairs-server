import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, BackHandler } from "react-native";

/**
 * Leaving a board in progress asks first — from the on-screen back button and from Android's
 * hardware back (swipe-back is disabled for game screens in the root layout).
 */
export function useLeaveGuard(inProgress: boolean) {
  const { t } = useTranslation();

  const leave = useCallback(() => {
    if (!inProgress) {
      router.back();
      return;
    }
    Alert.alert(t("game.quitTitle"), t("game.quitBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("game.quit"), style: "destructive", onPress: () => router.back() },
    ]);
  }, [inProgress, t]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  return leave;
}
