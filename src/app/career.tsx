import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions } from "react-native";

import { getLevel, LEVEL_COUNT, type Level } from "@/game/levels";
import { highestUnlockedLevel, useProgress } from "@/store/progress";
import { Screen } from "@/ui/Screen";
import { StarRow } from "@/ui/StarRow";
import { colors, space } from "@/ui/theme";

const COLUMNS = 4;
// Locked levels shown past the current one, once beyond the first chapter.
const LOCKED_AHEAD = COLUMNS * 2;

export default function Career() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const stars = useProgress((s) => s.stars);
  const unlocked = highestUnlockedLevel(stars);
  // The first chapter in full; past it, every level reached plus a couple of rows still locked.
  const shown = Math.max(LEVEL_COUNT, Math.ceil((unlocked + LOCKED_AHEAD) / COLUMNS) * COLUMNS);
  const levels = Array.from({ length: shown }, (_, i) => getLevel(i + 1) as Level);
  const cell = Math.floor((width - space.screen * 2 - space.gridGap * (COLUMNS - 1)) / COLUMNS);

  return (
    <Screen title={t("career.title")}>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {levels.map((level) => {
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
