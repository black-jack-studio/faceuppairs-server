import * as Application from "expo-application";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text } from "react-native";

import { APP_NAME, SUPPORT_EMAIL } from "@/config/app";
import { deviceLanguage } from "@/i18n";
import { showAdPrivacyOptions, useAds } from "@/lib/ads";
import { manageSubscription, restore } from "@/lib/purchases";
import { cancelReminders, notificationStatus, requestNotifications, scheduleReminders } from "@/lib/reminders";
import { useProgress } from "@/store/progress";
import { useSettings, type Language } from "@/store/settings";
import { useWallet } from "@/store/wallet";
import { ListRow } from "@/ui/ListRow";
import { Screen } from "@/ui/Screen";
import { Segmented } from "@/ui/Segmented";
import { colors } from "@/ui/theme";

export default function Settings() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation();
  const haptics = useSettings((s) => s.haptics);
  const setHaptics = useSettings((s) => s.setHaptics);
  const reminders = useSettings((s) => s.reminders);
  const language = useSettings((s) => s.language) ?? deviceLanguage();
  const setLanguage = useSettings((s) => s.setLanguage);
  const nickname = useProgress((s) => s.nickname);
  const isPlus = useWallet((s) => s.isPlus);
  const adPrivacyRequired = useAds((s) => s.privacyOptionsRequired);
  const version = Application.nativeApplicationVersion ?? "dev";

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
          accessory={<Switch value={haptics} onValueChange={setHaptics} accessibilityLabel={t("haptics")} />}
        />
        <ListRow
          label={t("notifications")}
          accessory={<Switch value={reminders} onValueChange={toggleReminders} accessibilityLabel={t("notifications")} />}
        />
        <ListRow
          label={t("language")}
          accessory={
            <Segmented
              accessibilityLabel={t("language")}
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
        {isPlus && <ListRow label={t("manageSubscription")} onPress={manageSubscription} />}
        <ListRow
          label={t("gameRules")}
          onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "rules" } })}
        />
        <ListRow label={t("privacy")} onPress={() => router.push("/settings/privacy")} />
        {/* Google UMP: where consent applies (EEA/UK), a player must be able to change it later. */}
        {adPrivacyRequired && <ListRow label={t("adPrivacy")} onPress={showAdPrivacyOptions} />}
        <ListRow
          label={t("credits")}
          onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "credits" } })}
        />
        <ListRow label={t("feedback")} onPress={sendFeedback} />

        <Text style={styles.version}>{t("version", { version })}</Text>
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
