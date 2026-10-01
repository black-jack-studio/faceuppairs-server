import * as Application from "expo-application";
import { useRef, useState } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useShallow } from "zustand/react/shallow";

import { APP_NAME, SUPPORT_EMAIL } from "@/config/app";
import { deviceLanguage } from "@/i18n";
import { showAdPrivacyOptions, useAds } from "@/lib/ads";
import { analyticsAvailable } from "@/lib/analytics";
import { appIconsSupported } from "@/lib/appIcons";
import { restore } from "@/lib/purchases";
import { cancelReminders, notificationStatus, requestNotifications, scheduleReminders } from "@/lib/reminders";
import { useProgress } from "@/store/progress";
import { analyticsAllowed, useSettings, type Language } from "@/store/settings";
import { ListRow } from "@/ui/ListRow";
import { Screen } from "@/ui/Screen";
import { AppSwitch } from "@/ui/AppSwitch";
import { CreditsReveal } from "@/ui/CreditsReveal";
import { Segmented } from "@/ui/Segmented";
import { colors } from "@/ui/theme";

const LANGUAGE_PICKER_WIDTH = 124;
const VERSION_TAPS = 7;
const VERSION_TAP_WINDOW_MS = 700;

export default function Settings() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation();
  const haptics = useSettings((s) => s.haptics);
  const setHaptics = useSettings((s) => s.setHaptics);
  const reminders = useSettings((s) => s.reminders);
  const language = useSettings((s) => s.language) ?? deviceLanguage();
  const setLanguage = useSettings((s) => s.setLanguage);
  const nickname = useProgress((s) => s.nickname);
  const adPrivacyRequired = useAds((s) => s.privacyOptionsRequired);
  const consent = useAds(
    useShallow((s) => ({
      consentSettled: s.consentSettled,
      consentRegionKnown: s.consentRegionKnown,
      privacyOptionsRequired: s.privacyOptionsRequired,
    })),
  );
  const analytics = analyticsAllowed(useSettings((s) => s.analytics), consent);
  const version = Application.nativeApplicationVersion ?? "dev";
  // Seven quick taps on the version number open the credits (an easter egg, like Android's
  // developer options).
  const [creditsOpen, setCreditsOpen] = useState(false);
  const versionTaps = useRef({ count: 0, last: 0 });
  const onVersionTap = () => {
    const now = Date.now();
    const taps = versionTaps.current;
    taps.count = now - taps.last < VERSION_TAP_WINDOW_MS ? taps.count + 1 : 1;
    taps.last = now;
    if (taps.count >= VERSION_TAPS) {
      taps.count = 0;
      setCreditsOpen(true);
    }
  };

  // Same as FaceUp: the mail app opens pre-filled with version + platform, no backend needed.
  const sendFeedback = () => {
    const subject = encodeURIComponent(t("feedbackSubject", { app: APP_NAME }));
    const body = encodeURIComponent(`\n\n—\nVersion: ${version} (${Platform.OS} ${Platform.Version})`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  const toggleReminders = async (enabled: boolean) => {
    if (!enabled) {
      useSettings.getState().setReminders(false);
      await cancelReminders();
      return;
    }
    const granted = (await notificationStatus()) === "granted" || (await requestNotifications());
    if (!granted) {
      // Denied once: iOS won't ask again, only the system Settings can turn it back on.
      Alert.alert(t("notifications"), t("notificationsOffHint"), [
        { text: tc("cancel"), style: "cancel" },
        { text: t("title"), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    useSettings.getState().setReminders(true);
    await scheduleReminders(tc);
  };

  const onRestore = async () => {
    const result = await restore();
    Alert.alert(result === "restored" ? t("restoreDone") : result === "none" ? t("restoreNone") : t("restoreFailed"));
  };

  return (
    <Screen title={t("title")}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ListRow label={t("nickname")} value={nickname ?? t("nicknameUnset")} onPress={() => router.push("/settings/username")} />
        <ListRow
          label={t("haptics")}
          accessory={<AppSwitch value={haptics} onValueChange={setHaptics} label={t("haptics")} />}
        />
        <ListRow
          label={t("notifications")}
          accessory={<AppSwitch value={reminders} onValueChange={toggleReminders} label={t("notifications")} />}
        />
        {appIconsSupported && <ListRow label={t("appIcon")} onPress={() => router.push("/app-icon")} />}
        <ListRow
          label={t("language")}
          accessory={
            <Segmented
              accessibilityLabel={t("language")}
              width={LANGUAGE_PICKER_WIDTH}
              value={language}
              onChange={(lang: Language) => setLanguage(lang)}
              options={[
                { value: "en", label: "EN" },
                { value: "fr", label: "FR" },
              ]}
            />
          }
        />
        <ListRow label={t("restorePurchases")} onPress={onRestore} />
        <ListRow
          label={t("gameRules")}
          onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "rules" } })}
        />
        <ListRow label={t("privacy")} onPress={() => router.push("/settings/privacy")} />
        {/* Google UMP: where consent applies (EEA/UK), a player must be able to change it later. */}
        {adPrivacyRequired && <ListRow label={t("adPrivacy")} onPress={showAdPrivacyOptions} />}
        {analyticsAvailable && (
          <ListRow
            label={t("analytics")}
            accessory={
              <AppSwitch value={analytics} onValueChange={useSettings.getState().setAnalytics} label={t("analytics")} />
            }
          />
        )}
        <ListRow
          label={t("credits")}
          onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "credits" } })}
        />
        <ListRow label={t("feedback")} onPress={sendFeedback} />

        <Text style={styles.version} onPress={onVersionTap} suppressHighlighting>
          {t("version", { version })}
        </Text>
        <CreditsReveal visible={creditsOpen} onClose={() => setCreditsOpen(false)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  version: {
    color: colors.faint,
    fontSize: 12,
    textAlign: "center",
    marginTop: 40,
    marginBottom: 16,
  },
});
