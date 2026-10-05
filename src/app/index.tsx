import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_NAME } from "@/config/app";
import { canOpenChest, localDay } from "@/game/economy";
import { dealHome } from "@/game/homeDeal";
import { SEASON_PAIRS, seasonOn } from "@/game/seasons";
import { utcDay } from "@/game/run";
import { LEVEL_COUNT } from "@/game/levels";
import { useAds } from "@/lib/ads";
import { wakeServer } from "@/lib/api";
import { formatCountdown, formatScore, nextLocalMidnight } from "@/lib/format";
import { hapticImpact } from "@/lib/haptics";
import { promptNickname } from "@/lib/promptNickname";
import { totalStars, useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButton, AppButtonGroup, IconButton } from "@/ui/AppButton";
import { CoinsPill } from "@/ui/CoinsPill";
import { Emoji, UI_EMOJI } from "@/ui/Emoji";
import { HomePreviewCard } from "@/ui/HomePreviewCard";
import { NotificationDot } from "@/ui/NotificationDot";
import { BottomSheetPanel, useResultWidths } from "@/ui/ResultPanel";
import { colors, space } from "@/ui/theme";

// Dealt once per launch (module scope): two face-up icons from one pack (or the occasion's,
// around Halloween, Christmas…), two face-down cards, one of which secretly opens the 8×4 board.
const season = seasonOn(new Date());
const homeDeal = dealHome(
  Math.random,
  season ? SEASON_PAIRS[season] : undefined,
);
// Below this height (iPhone SE, small Androids) the home block tightens up to fit.
const COMPACT_HEIGHT = 740;
// Label width of the two main buttons, so Career and Endless are exactly the same size.
const HERO_BUTTON_WIDTH = 240;
const SECONDARY_BUTTON_WIDTH = 126;
// Lets the home screen appear first, so the alert lands on the game rather than a blank screen.
// After the splash has lifted (about 1.1 s), so the alert lands on a settled home screen.
const FIRST_PROMPT_DELAY_MS = 1500;
const CONSENT_WAIT_MAX_MS = 8_000;
// Lets the home screen settle after the game closes before the sheet rises.
const ICON_REVEAL_DELAY_MS = 500;

export default function Home() {
  const { t, i18n } = useTranslation();
  const bestEndless = useProgress((s) => s.bestEndless);
  const stars = useProgress((s) => s.stars);
  const nickname = useProgress((s) => s.nickname);
  const nicknamePrompted = useProgress((s) => s.nicknamePrompted);
  const markNicknamePrompted = useProgress((s) => s.markNicknamePrompted);
  const chestReady = useWallet((s) => canOpenChest(s.streak, s.playedDay, localDay()));
  const { height } = useWindowDimensions();
  const widths = useResultWidths();
  const [secretNotice, setSecretNotice] = useState(false);
  const compact = height < COMPACT_HEIGHT;
  const previewSize = compact ? 44 : 52;
  const dailyOpen = useWallet(
    (s) => !(s.daily.day === utcDay() && s.daily.played),
  );

  // First launch only: ask for a nickname right away. Marked as shown when it is shown, so
  // "Later" never turns into a prompt on every launch (it stays reachable in Settings).
  // Marking it here rather than before the timer matters: the flag is a dependency, and flipping
  // it early would run the cleanup and cancel the prompt.
  // Waits for the ad-consent step: iOS shows one modal at a time (CONSENT_WAIT_MAX_MS caps the
  // wait if that step hangs).
  const consentSettled = useAds((s) => s.consentSettled);
  const [consentWaitOver, setConsentWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(
      () => setConsentWaitOver(true),
      CONSENT_WAIT_MAX_MS,
    );
    return () => clearTimeout(timer);
  }, []);
  const takenNotice = useProgress((s) => s.nicknameTakenNotice);

  // Back home after earning an app icon (level 25, all 3 stars, a 7-day streak): celebrate it.
  useFocusEffect(
    useCallback(() => {
      wakeServer();
      const timer = setTimeout(() => {
        const id = useWallet.getState().takeIconReveal();
        if (id) router.push({ pathname: "/icon-unlocked", params: { id } });
      }, ICON_REVEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }, []),
  );

  useEffect(() => {
    if (
      nickname !== null ||
      nicknamePrompted ||
      !(consentSettled || consentWaitOver)
    )
      return;
    const timer = setTimeout(() => {
      markNicknamePrompted();
      promptNickname(
        t,
        takenNotice ? t("settings:username.errors.taken") : undefined,
      );
    }, FIRST_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    nickname,
    nicknamePrompted,
    markNicknamePrompted,
    t,
    consentSettled,
    consentWaitOver,
    takenNotice,
  ]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <CoinsPill />
          <View>
            <IconButton
              label={chestReady ? t("chest.ready") : t("home.chest")}
              systemImage="flame.fill"
              fallbackGlyph="🔥"
              emoji={UI_EMOJI.flame}
              onPress={() => router.push("/chest")}
            />
            {chestReady && <NotificationDot />}
          </View>
        </View>
        <IconButton
          label={t("home.settings")}
          systemImage="gearshape.fill"
          fallbackGlyph="⚙︎"
          onPress={() => router.push("/settings")}
        />
      </View>
      {/* Cards + title, stats and the two main buttons form one block, centred in the space
          between the top bar and the Daily / Leaderboard pills, so it fits any screen height. */}
      <View style={[styles.main, { gap: compact ? 24 : 40 }]}>
        <View style={styles.hero}>
          <View style={styles.preview} accessible={false}>
            {homeDeal.cards.map((icon, i) =>
              icon ? (
                <HomePreviewCard
                  key={`${i}-${icon.asset}`}
                  asset={icon.asset}
                  size={previewSize}
                />
              ) : i === homeDeal.secretIndex ? (
                <Pressable
                  key={i}
                  style={[
                    styles.previewCard,
                    { width: previewSize, height: previewSize },
                  ]}
                  accessible={false}
                  onPress={() => {
                    // Prize already collected today: say when it comes back, until local midnight.
                    if (useWallet.getState().secretClaimDay === localDay()) {
                      hapticImpact();
                      setSecretNotice(true);
                      return;
                    }
                    hapticImpact();
                    router.push("/play/secret");
                  }}
                />
              ) : (
                <View
                  key={i}
                  style={[
                    styles.previewCard,
                    { width: previewSize, height: previewSize },
                  ]}
                />
              ),
            )}
          </View>
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            accessibilityRole="header"
          >
            {APP_NAME}
          </Text>
        </View>

        <View style={[styles.center, { gap: compact ? 24 : 36 }]}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {formatScore(bestEndless, i18n.language)}
              </Text>
              <Text style={styles.statLabel}>{t("home.bestScore")}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {totalStars(stars)}/{LEVEL_COUNT * 3}
              </Text>
              <Text style={styles.statLabel}>{t("home.stars")}</Text>
            </View>
          </View>

          <AppButtonGroup
            buttons={[
              {
                label: t("home.career"),
                variant: "primary",
                size: "hero",
                width: HERO_BUTTON_WIDTH,
                onPress: () => router.push("/career"),
              },
              {
                label: t("home.endless"),
                size: "hero",
                width: HERO_BUTTON_WIDTH,
                onPress: () => router.push("/play/endless"),
              },
            ]}
          />
        </View>
      </View>

      <View style={[styles.actions, compact && styles.actionsCompact]}>
        <View style={styles.actionsRow}>
          <View>
            <AppButtonGroup
              buttons={[
                {
                  label: t("home.daily"),
                  size: "large",
                  width: SECONDARY_BUTTON_WIDTH,
                  onPress: () => router.push("/play/daily"),
                },
              ]}
            />
            {dailyOpen && <NotificationDot />}
          </View>
          <AppButtonGroup
            buttons={[
              {
                label: t("home.leaderboard"),
                size: "large",
                width: SECONDARY_BUTTON_WIDTH,
                onPress: () => router.push("/leaderboard"),
              },
            ]}
          />
        </View>
      </View>

      {secretNotice && (
        <BottomSheetPanel
          lead={<Emoji asset={UI_EMOJI.crystalball} size={56} />}
          title={t("secret.title")}
          onDismiss={() => setSecretNotice(false)}
          footer={
            <AppButton
              label={t("secret.gotIt")}
              variant="primary"
              size="large"
              width={widths.full}
              onPress={() => setSecretNotice(false)}
            />
          }
        >
          <Text style={styles.noticeBody}>
            {t("secret.cooldownBody", { time: formatCountdown(nextLocalMidnight(), i18n.language) })}
          </Text>
        </BottomSheetPanel>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noticeBody: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.board,
    paddingHorizontal: space.screen,
  },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  // Monochrome badge: DESIGN.md keeps color off everything but the primary button.
  actionsRow: {
    flexDirection: "row",
    gap: 14,
  },
  main: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
  },
  hero: {
    alignItems: "center",
    gap: 12,
  },
  preview: {
    flexDirection: "row",
    gap: space.gridGap,
    marginBottom: 12,
  },
  previewCard: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
  },
  titleCompact: {
    fontSize: 30,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 48,
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
    paddingBottom: 24,
  },
  actionsCompact: {
    paddingBottom: 12,
  },
});
