import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";

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

/**
 * After a level or a chest: lock in what was just earned and queue it, so the "new icon"
 * sheet greets the player the next time they're back on the home screen (not mid-replay).
 */
export function queueEarnedAppIcons() {
  if (!appIconsSupported) return;
  const fresh = collectEarnedAppIcons();
  if (fresh.length) useWallet.getState().queueIconReveals(fresh.map((icon) => icon.id));
}
