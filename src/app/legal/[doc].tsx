import { Redirect, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_NAME, COPYRIGHT_YEARS, HOSTING_PROVIDER, PUBLISHER, SUPPORT_EMAIL } from "@/config/app";
import { AppButton, CloseButton } from "@/ui/AppButton";
import { colors, space } from "@/ui/theme";

const DOCS = ["privacy", "terms", "notice", "support", "rules", "credits"] as const;
type Doc = (typeof DOCS)[number];
const WITH_COPYRIGHT: Doc[] = ["privacy", "terms", "notice"];

interface Section {
  title: string;
  body: string;
}

const VARS: Record<string, string> = {
  app: APP_NAME,
  publisher: PUBLISHER,
  email: SUPPORT_EMAIL,
  host: HOSTING_PROVIDER,
  years: COPYRIGHT_YEARS,
};

function fill(text: string): string {
  return text.replace(/{{(\w+)}}/g, (_, key: string) => VARS[key] ?? "");
}

export default function LegalDocument() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t } = useTranslation("legal");

  if (!DOCS.includes(doc as Doc)) return <Redirect href="/settings" />;
  const key = doc as Doc;
  const sections = t(`${key}.sections`, { returnObjects: true }) as Section[];

  return (
    <SafeAreaView style={styles.sheet} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t(`${key}.title`)}
        </Text>
        <CloseButton label={t("common:close")} />
      </View>
      {WITH_COPYRIGHT.includes(key) && <Text style={styles.copyright}>{fill(t("copyright"))}</Text>}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {fill(section.title)}
          </Text>
          <Text style={styles.body}>{fill(section.body)}</Text>
        </View>
      ))}

      {/* Guideline 1.2: a way to reach us that's one tap away, not just an address to copy. */}
      {key === "support" && (
        <View style={styles.contact}>
          <AppButton
            label={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(APP_NAME)}`)}
          />
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.board,
  },
  content: {
    paddingHorizontal: space.screen,
    paddingTop: 32,
    paddingBottom: 48,
    gap: 20,
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
    fontSize: 26,
    fontWeight: "800",
  },
  copyright: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -8,
  },
  section: {
    gap: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  contact: {
    alignItems: "center",
    marginTop: 8,
  },
});
