import { Platform } from "react-native";

// Values that differ between development and release builds. EXPO_PUBLIC_* are inlined at
// build time (.env locally, EAS environment variables for store builds). Every one of them is
// optional: a missing key turns its feature off instead of crashing the app.

/** Leaderboard API. In development the simulator reaches the Mac's localhost. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? "http://localhost:8787" : "");

// AdMob ad unit ids (not secrets: they ship inside the app anyway). Development builds always
// use Google's test units instead (TestIds in ads.ts), so clicking around is never a policy risk.
export const ADMOB_UNITS = {
  rewarded: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED ?? "ca-app-pub-9106120973763702/7971939419",
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED ?? "ca-app-pub-9106120973763702/4214415392",
  }),
  interstitial: Platform.select({
    ios: process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL ?? "ca-app-pub-9106120973763702/4891403941",
    android: process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL ?? "ca-app-pub-9106120973763702/2378414534",
  }),
};

/** RevenueCat public SDK key (safe to ship in the app, it only identifies the project). */
export const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
