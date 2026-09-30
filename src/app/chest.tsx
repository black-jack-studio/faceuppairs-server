import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { canClaimDaily, localDay, nextStreakDay, STREAK_BONUS_DAY, STREAK_REWARDS } from "@/game/economy";
import { showRewarded, useAds } from "@/lib/ads";
import { track } from "@/lib/analytics";
import { formatCountdown, nextLocalMidnight } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { requestNotifications, scheduleReminders } from "@/lib/reminders";
import { useSettings } from "@/store/settings";
import { useWallet } from "@/store/wallet";
import { AppButtonGroup, CloseButton } from "@/ui/AppButton";
import { Emoji, UI_EMOJI } from "@/ui/Emoji";
import { colors, space } from "@/ui/theme";

export default function Chest() {
  const { t, i18n } = useTranslation();
  const today = localDay();
  const streak = useWallet((s) => s.streak);
  const rewardedReady = useAds((s) => s.rewardedReady);
  const [claimed, setClaimed] = useState<{ coins: number; bonusHint: boolean } | null>(null);
  const [doubled, setDoubled] = useState(false);
  const claimable = canClaimDaily(streak, today);
  // Day of the 7-day cycle being claimed (or just claimed).
  const currentDay = nextStreakDay(streak, today);

  const claim = () => {
    const result = useWallet.getState().claimDaily(today);
    if (result.coins === 0) return;
    setClaimed(result);
    hapticSuccess();
    track("chest_claimed", { day: currentDay, coins: result.coins });
    afterClaim();
  };

  // Reminders are offered here, right after a reward — the one moment they obviously help —
  // and only once, with our own explanation before the system prompt (FaceUp's approach).
  const afterClaim = () => {
    const settings = useSettings.getState();
    if (settings.reminders) {
      scheduleReminders(t);
      return;
    }
    if (settings.notificationPromptShown) return;
    settings.markNotificationPromptShown();
    setTimeout(() => {
      Alert.alert(t("notifications.title"), t("notifications.body"), [
        { text: t("notifications.later"), style: "cancel" },
        {
          text: t("notifications.allow"),
          onPress: async () => {
            if (await requestNotifications()) {
              useSettings.getState().setReminders(true);
              scheduleReminders(t);
            }
          },
        },
      ]);
    }, 600);
  };

  const double = async () => {
    if (!claimed || doubled) return;
    if (await showRewarded("daily_chest")) {
      useWallet.getState().addCoins(claimed.coins);
      setDoubled(true);
    }
  };

  return (
    <SafeAreaView style={styles.sheet} edges={["top"]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t("chest.title")}
        </Text>
        <CloseButton label={t("close")} />
      </View>
      <View style={styles.hero}>
        <Emoji asset={UI_EMOJI.gift} size={88} />
        <Text style={styles.subtitle}>{t("chest.subtitle")}</Text>
      </View>

      <View style={styles.days} accessibilityRole="list">
        {STREAK_REWARDS.map((coins, i) => {
          const day = i + 1;
          const done = day < currentDay || (day === currentDay && !claimable);
          const isToday = day === currentDay;
          return (
            <View
              key={day}
              style={[styles.day, isToday && styles.dayToday]}
              accessible
              accessibilityLabel={`${t("chest.day", { n: day })}, ${t("chest.reward", { count: coins })}`}
            >
              <Text style={[styles.dayLabel, done && styles.dayDone]}>{t("chest.day", { n: day })}</Text>
              {!done && <Emoji asset={UI_EMOJI.coin} size={18} />}
              <Text style={[styles.dayCoins, done && styles.dayDone]}>{done ? "✓" : coins}</Text>
              {day === STREAK_BONUS_DAY && <Text style={styles.dayBonus}>+1</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.streak}>{t("chest.streak", { count: streak.streak })}</Text>

      {claimed && (
        <View style={styles.reward}>
          <Text style={styles.rewardCoins}>{t("chest.reward", { count: doubled ? claimed.coins * 2 : claimed.coins })}</Text>
          {claimed.bonusHint && <Text style={styles.rewardBonus}>{t("chest.bonusHint")}</Text>}
        </View>
      )}

      <View style={styles.actions}>
        {claimable ? (
          <AppButtonGroup buttons={[{ label: t("chest.claim"), variant: "primary", size: "large", onPress: claim }]} />
        ) : claimed && !doubled && rewardedReady ? (
          <AppButtonGroup buttons={[{ label: t("chest.doubleAd"), size: "large", onPress: double }]} />
        ) : (
          <Text style={styles.subtitle}>
            {t("chest.claimed")} · {formatCountdown(nextLocalMidnight(), i18n.language)}
          </Text>
        )}
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
    gap: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  hero: {
    alignItems: "center",
    gap: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    textAlign: "center",
  },
  days: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  // Same object as a grid card: black, square corners (DESIGN.md).
  day: {
    flex: 1,
    aspectRatio: 0.7,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: colors.text,
  },
  dayLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  dayCoins: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  dayDone: {
    color: colors.faint,
  },
  dayBonus: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
  },
  streak: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  reward: {
    alignItems: "center",
    gap: 4,
  },
  rewardCoins: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  rewardBonus: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
  },
  actions: {
    alignItems: "center",
    marginTop: 8,
  },
});
