import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config; this file only injects what differs per environment.
//
// AdMob app ids: Google's official sample ids for development (they serve test ads only).
// A production build must get the real ones from EAS environment variables — building for the
// store with the sample ids would ship an app that never earns, so it fails loudly instead.
const SAMPLE_ADMOB_APP_IDS = {
  ios: "ca-app-pub-3940256099942544~1458507808",
  android: "ca-app-pub-3940256099942544~3347511713",
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.EAS_BUILD_PROFILE === "production";
  const iosAppId = process.env.ADMOB_IOS_APP_ID ?? SAMPLE_ADMOB_APP_IDS.ios;
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? SAMPLE_ADMOB_APP_IDS.android;
  if (production && (!process.env.ADMOB_IOS_APP_ID || !process.env.ADMOB_ANDROID_APP_ID)) {
    throw new Error("ADMOB_IOS_APP_ID and ADMOB_ANDROID_APP_ID must be set for production builds.");
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
