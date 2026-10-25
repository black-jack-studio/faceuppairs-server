import * as TrackingTransparency from "expo-tracking-transparency";
import { Alert, AppState, Platform } from "react-native";

import i18n from "@/i18n";
import { useSettings } from "@/store/settings";

// App Tracking Transparency. Asked on first launch, right after Google's consent form and before
// the ad SDK starts, so no ad request goes out while the choice is still open (App Review
// rejected 1.0 (9) for asking only after a finished game). Our explanation comes first, then
// Apple's prompt.

// After the splash has lifted, so the explanation lands on the home screen.
const ASK_DELAY_MS = 1500;

async function shouldAskTracking(): Promise<boolean> {
  if (Platform.OS !== "ios" || !TrackingTransparency.isAvailable()) return false;
  const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
  return status === "undetermined";
}

/** iOS drops the prompt silently unless the app is in the foreground. */
function whenActive(): Promise<void> {
  if (AppState.currentState === "active") return Promise.resolve();
  return new Promise((resolve) => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      sub.remove();
      resolve();
    });
  });
}

/** Once in the app's life: the explanation, then Apple's prompt. Resolves when it's answered. */
export async function askTrackingOnce(): Promise<void> {
  const settings = useSettings.getState();
  if (settings.trackingPromptShown || !(await shouldAskTracking())) return;
  await new Promise((resolve) => setTimeout(resolve, ASK_DELAY_MS));
  await whenActive();
  settings.markTrackingPromptShown();
  await new Promise<void>((resolve) => {
    Alert.alert(i18n.t("tracking.title"), i18n.t("tracking.body"), [
      {
        text: i18n.t("tracking.continue"),
        onPress: () => {
          TrackingTransparency.requestTrackingPermissionsAsync()
            .catch(() => {})
            .finally(resolve);
        },
      },
    ]);
  });
}
