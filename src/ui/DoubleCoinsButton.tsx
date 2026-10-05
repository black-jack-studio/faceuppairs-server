import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "./AppButton";
import { PlayBadge } from "./ButtonIcons";
import { colors } from "./theme";

// Label width of the glass button behind the overlay; the button adds its own padding to it.
const BUTTON_WIDTH = 64;

interface DoubleCoinsButtonProps {
  doubled: boolean;
  /** An ad is ready and the coins haven't been doubled yet. */
  canDouble: boolean;
  onDouble: () => void;
}

/**
 * Small "×2" button under the stats: watch an ad, get the coins twice. The play tile and the
 * "×2" are one block centred over an empty native button, so they sit in the middle of it.
 */
export function DoubleCoinsButton({ doubled, canDouble, onDouble }: DoubleCoinsButtonProps) {
  const { t } = useTranslation();
  if (doubled) return <Text style={styles.doubled}>{t("results.doubled")}</Text>;
  if (!canDouble) return null;
  return (
    <View accessible accessibilityRole="button" accessibilityLabel={t("results.double")}>
      <AppButton label={" "} size="large" width={BUTTON_WIDTH} onPress={onDouble} />
      <View style={styles.overlay} pointerEvents="none">
        <PlayBadge pulse />
        <Text style={styles.times}>{t("results.double")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  times: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  doubled: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
