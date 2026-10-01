import { StyleSheet, View } from "react-native";

// Same red as FaceUp Blackjack's notification badge.
const SIZE = 9;
const RED = "#ef4444";

export function NotificationDot() {
  return <View style={styles.dot} pointerEvents="none" accessible={false} />;
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: RED,
  },
});
