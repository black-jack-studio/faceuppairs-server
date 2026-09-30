import * as TrackingTransparency from "expo-tracking-transparency";
import { Platform } from "react-native";

// App Tracking Transparency. Like FaceUp, the system prompt is only ever shown right after our
// own explanation screen, at a calm moment (after a finished game) — never at launch, where an
// instinctive "no" burns the one ask we get.

export async function shouldAskTracking(): Promise<boolean> {
  if (Platform.OS !== "ios" || !TrackingTransparency.isAvailable()) return false;
  const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
  return status === "undetermined";
}

export async function requestTracking(): Promise<void> {
  await TrackingTransparency.requestTrackingPermissionsAsync().catch(() => {});
}
