import type { ReactNode } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors, space } from "./theme";

interface ResultPanelProps {
  title: string;
  /** Above the title (an icon, say). */
  lead?: ReactNode;
  headline?: ReactNode;
  stats: { label: string; value: string; icon?: ReactNode }[];
  /** Under the stats: coins earned, a status line. */
  children?: ReactNode;
  /** Buttons, pinned to the bottom edge where the thumb rests. */
  footer?: ReactNode;
}

// What the glass buttons add around a label width, and the gap between side-by-side buttons.
const BUTTON_CHROME = 40;
const BUTTON_GAP = 14;
const MAX_FULL_WIDTH = 360;
const STAT_WIDTH = 112;

/**
 * Label widths that make a full-width button and two half-width ones span the same edges: the
 * stacked buttons at the foot of every result screen line up with each other.
 */
export function useResultWidths() {
  const { width } = useWindowDimensions();
  const full = Math.min(width - 2 * space.screen, MAX_FULL_WIDTH) - BUTTON_CHROME;
  const half = (full + BUTTON_CHROME - BUTTON_GAP) / 2 - BUTTON_CHROME;
  return { full, half };
}

// Covers the finished board. Opaque board-gray rather than a translucent glass sheet: glass is
// for controls only, never for content (DESIGN.md).
export function ResultPanel({ title, lead, headline, stats, children, footer }: ResultPanelProps) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.body}>
        {lead}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {headline}
        {stats.length > 0 && (
          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <View style={styles.statValueRow}>
                  {stat.icon}
                  <Text style={styles.statValue}>{stat.value}</Text>
                </View>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}
        {children}
      </View>
      {footer && <View style={styles.footer}>{footer}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.board,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  // Equal columns: with three stats the middle one sits exactly on the screen's centre.
  stats: {
    flexDirection: "row",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stat: {
    width: STAT_WIDTH,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  footer: {
    alignItems: "center",
    gap: BUTTON_GAP,
    paddingBottom: 16,
  },
});
