import type { TFunction } from "i18next";
import { Alert } from "react-native";

import { useSettings } from "@/store/settings";

import { afterGameFinished } from "./ads";
import { requestTracking, shouldAskTracking } from "./tracking";

/**
 * Leaving a finished game: the capped interstitial (if due), then — once in the app's life —
 * the tracking explanation right before Apple's prompt, then wherever the player was going.
 */
export async function leaveFinishedGame(t: TFunction, go: () => void): Promise<void> {
  await afterGameFinished();
  const settings = useSettings.getState();
  if (!settings.trackingPromptShown && (await shouldAskTracking())) {
    settings.markTrackingPromptShown();
    await new Promise<void>((resolve) => {
      Alert.alert(t("tracking.title"), t("tracking.body"), [
        {
          text: t("tracking.continue"),
          onPress: () => {
            requestTracking().finally(resolve);
          },
        },
      ]);
    });
  }
  go();
}
