import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config; this file only injects what differs per environment.
//
// FaceUp Pairs' AdMob apps. Not secrets: they are written into the app's Info.plist and
// AndroidManifest. Development builds still serve Google's test ads (ads.ts).
const ADMOB_IOS_APP_ID = "ca-app-pub-9106120973763702~7517392276";
const ADMOB_ANDROID_APP_ID = "ca-app-pub-9106120973763702~3092905415";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosAppId = process.env.ADMOB_IOS_APP_ID ?? ADMOB_IOS_APP_ID;
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? ADMOB_ANDROID_APP_ID;

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
