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
  /** Our explanation screens are shown once each, before the system prompt. */
  trackingPromptShown: boolean;
  notificationPromptShown: boolean;
}

interface SettingsState extends SettingsData {
  setHaptics: (enabled: boolean) => void;
  setLanguage: (language: Language) => void;
  setReminders: (enabled: boolean) => void;
  markTrackingPromptShown: () => void;
  markNotificationPromptShown: () => void;
  reset: () => void;
}

const initial: SettingsData = {
  haptics: true,
  language: null,
  reminders: false,
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
        trackingPromptShown: s.trackingPromptShown,
        notificationPromptShown: s.notificationPromptShown,
      }),
    },
  ),
);
