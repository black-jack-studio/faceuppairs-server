import { Platform } from "react-native";

// Values that differ between development and release builds. EXPO_PUBLIC_* are inlined at
// build time (.env locally, EAS environment variables for store builds). Every one of them is
// optional: a missing key turns its feature off instead of crashing the app.

/** Leaderboard API. In development the simulator reaches the Mac's localhost. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? "http://localhost:8787" : "");

// AdMob ad unit ids. Development builds use Google's test units (TestIds in ads.ts); release
// builds never do — serving test ads in production breaks AdMob policy, so no id means no ads.
export const ADMOB_UNITS = {
  rewarded: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED,
  }),
  interstitial: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL,
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL,
  }),
};

/** RevenueCat public SDK key (safe to ship in the app, it only identifies the project). */
export const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
