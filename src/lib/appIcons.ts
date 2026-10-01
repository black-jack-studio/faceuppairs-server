import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";
import { router } from "expo-router";
import type { TFunction } from "i18next";
import { Alert } from "react-native";

import { APP_ICONS, earnedByPlay, type AppIconDef } from "@/game/appIcons";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";

export const appIconsSupported = supportsAlternateIcons;

export function playRecord() {
  return { stars: useProgress.getState().stars, streak: useWallet.getState().streak.streak };
}

export function ownsAppIcon(icon: AppIconDef): boolean {
  return icon.unlock.kind === "free" || useWallet.getState().ownedAppIcons.includes(icon.id);
}

/** The icon on the home screen right now. */
export function currentAppIconId(): string {
  const native = getAppIconName();
  return APP_ICONS.find((icon) => icon.native === native)?.id ?? "original";
}

export async function applyAppIcon(icon: AppIconDef): Promise<boolean> {
  try {
    await setAlternateAppIcon(icon.native as never);
    return true;
  } catch {
    return false;
  }
}

/**
 * Locks in every icon the player has just earned (a streak can break later; the icon stays)
 * and returns them.
 */
export function collectEarnedAppIcons(): AppIconDef[] {
  const record = playRecord();
  const owned = useWallet.getState().ownedAppIcons;
  const fresh = APP_ICONS.filter((icon) => icon.unlock.kind !== "free" && !owned.includes(icon.id) && earnedByPlay(icon, record));
  if (fresh.length) useWallet.getState().unlockAppIcons(fresh.map((icon) => icon.id));
  return fresh;
}

/** After a level or a chest: "New icon unlocked", with a shortcut to the gallery. */
export function announceEarnedAppIcons(t: TFunction) {
  if (!appIconsSupported) return;
  const fresh = collectEarnedAppIcons();
  if (!fresh.length) return;
  const name = t(`appIcons.names.${fresh[0].id}`);
  Alert.alert(t("appIcons.unlockedTitle"), t("appIcons.unlockedBody", { name }), [
    { text: t("appIcons.later"), style: "cancel" },
    { text: t("appIcons.see"), onPress: () => router.push("/app-icon") },
  ]);
}
