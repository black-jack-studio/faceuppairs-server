import { StyleSheet, Text, View } from "react-native";

import { colors } from "./theme";

// Monochrome on purpose (DESIGN.md: no color near the grid): earned stars are white, the rest faint.
export function StarRow({ earned, size }: { earned: number; size: number }) {
  return (
    <View style={styles.row} accessible={false}>
      {[1, 2, 3].map((n) => (
        <Text key={n} style={{ fontSize: size, color: n <= earned ? colors.text : colors.faint }}>
          ★
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
  },
});
