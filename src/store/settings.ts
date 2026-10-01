import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Language = "en" | "fr";

interface SettingsData {
  haptics: boolean;
  /** null = follow the device language. */
  language: Language | null;
  /** Chest / streak reminders, once the system permission is granted. */
  reminders: boolean;
  /**
   * Usage statistics (PostHog). null = the player hasn't chosen: on where no consent law applies,
   * off where one does (EEA/UK, as reported by Google's UMP) — see analyticsAllowed.
   */
  analytics: boolean | null;
  /** Our explanation screens are shown once each, before the system prompt. */
  trackingPromptShown: boolean;
  notificationPromptShown: boolean;
}

interface SettingsState extends SettingsData {
  setHaptics: (enabled: boolean) => void;
  setLanguage: (language: Language) => void;
  setReminders: (enabled: boolean) => void;
  setAnalytics: (enabled: boolean) => void;
  markTrackingPromptShown: () => void;
  markNotificationPromptShown: () => void;
  reset: () => void;
}

const initial: SettingsData = {
  haptics: true,
  language: null,
  reminders: false,
  analytics: null,
  trackingPromptShown: false,
  notificationPromptShown: false,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...initial,
      setHaptics: (haptics) => set({ haptics }),
      setLanguage: (language) => set({ language }),
      setReminders: (reminders) => set({ reminders }),
      setAnalytics: (analytics) => set({ analytics }),
      markTrackingPromptShown: () => set({ trackingPromptShown: true }),
      markNotificationPromptShown: () => set({ notificationPromptShown: true }),
      reset: () => set(initial),
    }),
    {
      name: "faceup-pairs.settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        haptics: s.haptics,
        language: s.language,
        reminders: s.reminders,
        analytics: s.analytics,
        trackingPromptShown: s.trackingPromptShown,
        notificationPromptShown: s.notificationPromptShown,
      }),
    },
  ),
);

/** Whether usage statistics may be sent, given the player's choice and where consent is required. */
export function analyticsAllowed(
  choice: boolean | null,
  consent: { consentSettled: boolean; consentRegionKnown: boolean; privacyOptionsRequired: boolean },
): boolean {
  if (choice !== null) return choice;
  // No choice yet: wait for UMP to say where the player is, and stay off when it can't.
  return consent.consentSettled && consent.consentRegionKnown && !consent.privacyOptionsRequired;
}
