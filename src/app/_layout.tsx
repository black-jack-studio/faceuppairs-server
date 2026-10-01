import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { applyLanguage } from "@/i18n";
import { ensureAccount, flushPendingDeletion } from "@/lib/account";
import { initAds, useAds } from "@/lib/ads";
import { identify, setAnalyticsEnabled } from "@/lib/analytics";
import { flushNickname } from "@/lib/nickname";
import { FxLayer } from "@/fx/FxLayer";
import { wakeServer } from "@/lib/api";
import { initPurchases } from "@/lib/purchases";
import { scheduleReminders } from "@/lib/reminders";
import { flushRuns } from "@/lib/runQueue";
import { useProgress } from "@/store/progress";
import { analyticsAllowed, useSettings } from "@/store/settings";
import { useWallet } from "@/store/wallet";
import { colors } from "@/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const STORES = [useProgress, useSettings, useWallet];

// Progress, settings and wallet come back from disk asynchronously. Keeping the splash up until
// they have means the level map never flashes "only level 1 unlocked" and coins never read 0.
function useStoresHydrated(): boolean {
  const isHydrated = () => STORES.every((store) => store.persist.hasHydrated());
  const [hydrated, setHydrated] = useState(isHydrated);

  useEffect(() => {
    const check = () => setHydrated(isHydrated());
    const unsubscribers = STORES.map((store) => store.persist.onFinishHydration(check));
    check();
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  return hydrated;
}

/** Everything that needs the network, retried whenever the app comes back to the foreground. */
async function syncWithServer() {
  wakeServer();
  await flushPendingDeletion();
  const account = await ensureAccount();
  if (!account) return;
  identify(account.id);
  await flushNickname();
  await flushRuns();
}

export default function RootLayout() {
  const hydrated = useStoresHydrated();
  const language = useSettings((s) => s.language);
  const analyticsChoice = useSettings((s) => s.analytics);
  const consent = useAds(
    useShallow((s) => ({
      consentSettled: s.consentSettled,
      consentRegionKnown: s.consentRegionKnown,
      privacyOptionsRequired: s.privacyOptionsRequired,
    })),
  );
  const { t } = useTranslation();

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  // GDPR / CNIL: usage statistics only with consent where the law requires it.
  const analyticsOn = analyticsAllowed(analyticsChoice, consent);
  useEffect(() => {
    setAnalyticsEnabled(analyticsOn);
  }, [analyticsOn]);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => {});
    // Order matters for ads: consent (inside initAds) comes before any ad request.
    initAds();
    initPurchases();
    syncWithServer();
    if (useSettings.getState().reminders) scheduleReminders(t);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncWithServer();
    });
    return () => sub.remove();
  }, [hydrated, t]);

  if (!hydrated) return null;

  const sheet = {
    presentation: "formSheet" as const,
    sheetGrabberVisible: true,
    contentStyle: { backgroundColor: colors.board },
  };

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.board },
        }}
      >
        {/* A swipe-back mid-game would drop the board without the quit confirmation. */}
        <Stack.Screen name="play/level/[n]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="play/endless" options={{ gestureEnabled: false }} />
        <Stack.Screen name="play/daily" options={{ gestureEnabled: false }} />
        <Stack.Screen name="play/secret" options={{ gestureEnabled: false }} />
        <Stack.Screen name="legal/[doc]" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
        <Stack.Screen name="settings/username" options={{ ...sheet, sheetAllowedDetents: [0.6] }} />
        <Stack.Screen name="chest" options={{ ...sheet, sheetAllowedDetents: "fitToContents" }} />
        <Stack.Screen name="app-icon" options={{ ...sheet, sheetAllowedDetents: [0.92] }} />
        <Stack.Screen name="icon-unlocked" options={{ ...sheet, sheetAllowedDetents: "fitToContents" }} />
      </Stack>
      <FxLayer />
    </>
  );
}
