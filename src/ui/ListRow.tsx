import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "./theme";

// Same flat list as FaceUp's Settings: bold label, hairline under each row, no icons.
interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Trailing control (switch, segmented picker) instead of a value + chevron. */
  accessory?: ReactNode;
}

export function ListRow({ label, value, onPress, destructive = false, accessory }: ListRowProps) {
  const content = (
    <>
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      {accessory ?? (
        <View style={styles.trailing}>
          {value ? <Text style={styles.value}>{value}</Text> : null}
          {onPress && !destructive ? <Text style={styles.chevron}>›</Text> : null}
        </View>
      )}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  destructive: {
    color: colors.danger,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: {
    color: colors.muted,
    fontSize: 15,
  },
  chevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: "300",
  },
});
