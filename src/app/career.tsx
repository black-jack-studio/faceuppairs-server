import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from "react-native";

import { LEVELS } from "@/game/levels";
import { highestUnlockedLevel, useProgress } from "@/store/progress";
import { Screen } from "@/ui/Screen";
import { StarRow } from "@/ui/StarRow";
import { colors, space } from "@/ui/theme";

const COLUMNS = 4;

export default function Career() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const stars = useProgress((s) => s.stars);
  const unlocked = highestUnlockedLevel(stars);
  const cell = Math.floor((width - space.screen * 2 - space.gridGap * (COLUMNS - 1)) / COLUMNS);

  return (
    <Screen title={t("career.title")}>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {LEVELS.map((level) => {
          const locked = level.number > unlocked;
          const earned = stars[level.number] ?? 0;
          return (
            <Pressable
              key={level.number}
              disabled={locked}
              onPress={() => router.push({ pathname: "/play/level/[n]", params: { n: String(level.number) } })}
              accessibilityRole="button"
              accessibilityState={{ disabled: locked }}
              accessibilityLabel={
                locked
                  ? t("career.locked", { n: level.number })
                  : `${t("career.level", { n: level.number })}, ${t("career.starsA11y", { count: earned })}`
              }
              style={({ pressed }) => [
                styles.cell,
                { width: cell, height: cell },
                locked && styles.locked,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.number, locked && styles.numberLocked]}>{level.number}</Text>
              {!locked && <StarRow earned={earned} size={11} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.gridGap,
    paddingTop: 8,
    paddingBottom: 32,
  },
  cell: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  locked: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  number: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  numberLocked: {
    color: colors.muted,
  },
});
