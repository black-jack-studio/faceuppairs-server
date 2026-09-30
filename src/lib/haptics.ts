import * as Haptics from "expo-haptics";

import { useSettings } from "@/store/settings";

// Same three levels as FaceUp (client/src/lib/haptics.ts), plus an error pulse for the one
// moment that costs something in this game: a memory error in Endless.
function enabled(): boolean {
  return useSettings.getState().haptics;
}

export function hapticTick() {
  if (enabled()) Haptics.selectionAsync().catch(() => {});
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (enabled()) Haptics.impactAsync(style).catch(() => {});
}

export function hapticSuccess() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticError() {
  if (enabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
