import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config; this file only injects what differs per environment.
//
// AdMob app ids. iOS uses FaceUp Pairs' real app (not a secret: it is written into the app's
// Info.plist; ads.ts still serves test ads in development). Android has no AdMob app yet and
// falls back to Google's sample id, which a store build refuses below.
const ADMOB_IOS_APP_ID = "ca-app-pub-9106120973763702~7517392276";
const SAMPLE_ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.EAS_BUILD_PROFILE === "production";
  const iosAppId = process.env.ADMOB_IOS_APP_ID ?? ADMOB_IOS_APP_ID;
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? SAMPLE_ADMOB_ANDROID_APP_ID;
  // Android has no AdMob app yet: a store build must not go out on Google's sample id.
  if (production && !process.env.ADMOB_ANDROID_APP_ID) {
    throw new Error("ADMOB_ANDROID_APP_ID must be set for production builds.");
  }

  const plugins = (config.plugins ?? []).map((plugin) =>
    plugin === "react-native-google-mobile-ads"
      ? [
          "react-native-google-mobile-ads",
          {
            iosAppId,
            androidAppId,
            // Google's own network id; add mediation partners' ids here when mediation is added.
            skAdNetworkItems: ["cstr6suwn9.skadnetwork"],
          },
        ]
      : plugin,
  );

  return { ...config, name: config.name ?? "FaceUp Pairs", slug: config.slug ?? "faceup-pairs", plugins } as ExpoConfig;
};
