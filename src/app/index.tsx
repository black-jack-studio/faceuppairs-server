import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_NAME } from "@/config/app";
import { canClaimDaily, localDay } from "@/game/economy";
import { dealHome } from "@/game/homeDeal";
import { SEASON_PAIRS, seasonOn, type SeasonId } from "@/game/seasons";
import { utcDay } from "@/game/run";
import { LEVEL_COUNT } from "@/game/levels";
import { useAds } from "@/lib/ads";
import { formatScore } from "@/lib/format";
import { hapticImpact } from "@/lib/haptics";
import { promptNickname } from "@/lib/promptNickname";
import { totalStars, useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButtonGroup, IconButton } from "@/ui/AppButton";
import { CoinsPill } from "@/ui/CoinsPill";
import { UI_EMOJI } from "@/ui/Emoji";
import { HomePreviewCard } from "@/ui/HomePreviewCard";
import { NotificationDot } from "@/ui/NotificationDot";
import { colors, space } from "@/ui/theme";

// Dealt once per launch (module scope): two face-up icons from one pack (or the occasion's,
// around Halloween, Christmas…), two face-down cards, one of which secretly opens the 8×4 board.
const season = seasonOn(new Date());
const launchDeal = dealHome(Math.random, season ? SEASON_PAIRS[season] : undefined);
const PREVIEW_CARD_SIZE = 52;
// Label width of the two main buttons, so Career and Endless are exactly the same size.
const HERO_BUTTON_WIDTH = 240;
const HERO_OFFSET = 96;
const SECONDARY_BUTTON_WIDTH = 126;
// Lets the home screen appear first, so the alert lands on the game rather than a blank screen.
const FIRST_PROMPT_DELAY_MS = 600;
const CONSENT_WAIT_MAX_MS = 8_000;

export default function Home() {
  const { t, i18n } = useTranslation();
  const bestEndless = useProgress((s) => s.bestEndless);
  const stars = useProgress((s) => s.stars);
  const nickname = useProgress((s) => s.nickname);
  const nicknamePrompted = useProgress((s) => s.nicknamePrompted);
  const markNicknamePrompted = useProgress((s) => s.markNicknamePrompted);
  const chestReady = useWallet((s) => canClaimDaily(s.streak, localDay()));
  const dailyOpen = useWallet((s) => !(s.daily.day === utcDay() && s.daily.played));
  // Development: `/?season=halloween` previews an occasion's cards.
  const { season: seasonPreview } = useLocalSearchParams<{ season?: SeasonId }>();
  const homeDeal = useMemo(
    () => (__DEV__ && seasonPreview && SEASON_PAIRS[seasonPreview] ? dealHome(Math.random, SEASON_PAIRS[seasonPreview]) : launchDeal),
    [seasonPreview],
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
    const timer = setTimeout(() => setConsentWaitOver(true), CONSENT_WAIT_MAX_MS);
    return () => clearTimeout(timer);
  }, []);
  const takenNotice = useProgress((s) => s.nicknameTakenNotice);

  useEffect(() => {
    if (nickname !== null || nicknamePrompted || !(consentSettled || consentWaitOver)) return;
    const timer = setTimeout(() => {
      markNicknamePrompted();
      promptNickname(t, takenNotice ? t("settings:username.errors.taken") : undefined);
    }, FIRST_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [nickname, nicknamePrompted, markNicknamePrompted, t, consentSettled, consentWaitOver, takenNotice]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <CoinsPill />
          <View>
            <IconButton
              label={chestReady ? t("chest.ready") : t("home.chest")}
              systemImage="gift.fill"
              fallbackGlyph="🎁"
              emoji={UI_EMOJI.gift}
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
      {/* Title near the top; stats and the two main buttons in the middle of the screen; the
          Daily / Leaderboard pills pinned at the bottom. */}
      <View style={styles.hero}>
        <View style={styles.preview} accessible={false}>
          {homeDeal.cards.map((icon, i) =>
            icon ? (
              <HomePreviewCard key={`${i}-${icon.asset}`} asset={icon.asset} size={PREVIEW_CARD_SIZE} />
            ) : i === homeDeal.secretIndex ? (
              <Pressable
                key={i}
                style={styles.previewCard}
                accessible={false}
                onPress={() => {
                  hapticImpact();
                  router.push("/play/secret");
                }}
              />
            ) : (
              <View key={i} style={styles.previewCard} />
            ),
          )}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {APP_NAME}
        </Text>
      </View>

      <View style={styles.center}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatScore(bestEndless, i18n.language)}</Text>
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

      <View style={styles.actions}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  hero: {
    alignItems: "center",
    gap: 12,
    marginTop: 24,
    // Moves the cards and title down without shifting the sections below them.
    transform: [{ translateY: HERO_OFFSET }],
  },
  preview: {
    flexDirection: "row",
    gap: space.gridGap,
    marginBottom: 20,
  },
  previewCard: {
    width: 52,
    height: 52,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "800",
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
});
