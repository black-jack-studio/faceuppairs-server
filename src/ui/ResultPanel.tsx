import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { colors } from "./theme";

interface ResultPanelProps {
  title: string;
  headline?: ReactNode;
  stats: { label: string; value: string }[];
  children: ReactNode;
  /** Buttons, set lower than `children`. The block above them keeps its place. */
  footer?: ReactNode;
}

// How far `footer` sits below `children`. The same amount of top padding cancels the upward
// shift that vertical centring would otherwise give everything above it.
const FOOTER_DROP = 36;

// Covers the finished board. Opaque board-gray rather than a translucent glass sheet: glass is
// for controls only, never for content (DESIGN.md).
export function ResultPanel({ title, headline, stats, children, footer }: ResultPanelProps) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={[styles.overlay, footer ? { paddingTop: FOOTER_DROP } : null]}
      accessibilityViewIsModal
    >
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {headline}
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>{children}</View>
      {footer && <View style={[styles.actions, { marginTop: FOOTER_DROP - 12 }]}>{footer}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.board,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  stats: {
    flexDirection: "row",
    gap: 40,
  },
  stat: {
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
  actions: {
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
});
