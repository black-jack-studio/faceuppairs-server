import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { saveNickname, type NicknameError } from "@/lib/nickname";
import { USERNAME_MAX } from "@/moderation/usernameFilter";
import { NICKNAME_CHANGE_COOLDOWN_MS, useProgress } from "@/store/progress";
import { AppButton, CloseButton } from "@/ui/AppButton";
import { colors, radius, space } from "@/ui/theme";

// Same rules as FaceUp's ChangeUsernameModal. The server has the last word (uniqueness,
// cooldown); the local cooldown check just answers instantly when it's obvious.
export default function Username() {
  const { t } = useTranslation("settings");
  const current = useProgress((s) => s.nickname);
  const changedAt = useProgress((s) => s.nicknameChangedAt);
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<{ code: NicknameError; days?: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const cooldownDays = () => {
    if (!current || changedAt === null) return 0;
    const remaining = changedAt + NICKNAME_CHANGE_COOLDOWN_MS - Date.now();
    return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
  };

  const save = async () => {
    if (saving) return;
    const days = cooldownDays();
    if (days > 0 && value.trim() !== current) return setError({ code: "cooldown", days });
    setSaving(true);
    const result = await saveNickname(value);
    setSaving(false);
    if (result.ok) router.back();
    else setError({ code: result.error, days: result.days });
  };

  return (
    <SafeAreaView style={styles.sheet} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t("username.title")}
        </Text>
        <CloseButton label={t("common:close")} />
      </View>
      <Text style={styles.subtitle}>{t("username.subtitle")}</Text>

      <TextInput
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        onSubmitEditing={save}
        placeholder={t("username.placeholder")}
        placeholderTextColor={colors.faint}
        maxLength={USERNAME_MAX}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="nickname"
        returnKeyType="done"
        accessibilityLabel={t("username.label")}
        style={styles.input}
      />
      <Text style={[styles.help, error && styles.error]} accessibilityLiveRegion="polite">
        {error ? t(`username.errors.${error.code}`, { days: error.days ?? cooldownDays() }) : t("username.rules")}
      </Text>

      <View style={styles.actions}>
        <AppButton label={t("username.save")} variant="primary" size="large" onPress={save} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.board,
    paddingHorizontal: space.screen,
    paddingTop: 32,
    gap: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    marginBottom: 8,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: 17,
  },
  help: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
  },
  actions: {
    alignItems: "center",
    marginTop: 16,
  },
});
