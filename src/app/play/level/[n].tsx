import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";

import { setupBoard } from "@/game/board";
import { BOOSTER_PRICES, levelCoins, PEEK_MS, type BoosterId } from "@/game/economy";
import { hintTarget } from "@/game/engine";
import { getPack } from "@/game/iconPacks";
import { playFx } from "@/fx/store";
import { getLevel, LEVEL_COUNT, starsFor, type Level } from "@/game/levels";
import { randomSeed } from "@/game/rng";
import { useBoardGame, useElapsed } from "@/game/useBoardGame";
import { showRewarded, useAds } from "@/lib/ads";
import { track } from "@/lib/analytics";
import { formatDuration, formatScore } from "@/lib/format";
import { hapticImpact } from "@/lib/haptics";
import { leaveFinishedGame } from "@/lib/postGame";
import { levelQuip } from "@/lib/quips";
import { queueEarnedAppIcons } from "@/lib/appIcons";
import { END_OF_GAME_DELAY_MS, useDelayedTrue } from "@/lib/useDelayedTrue";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButton, AppButtonGroup } from "@/ui/AppButton";
import { CoinIcon } from "@/ui/ButtonIcons";
import { DoubleCoinsButton } from "@/ui/DoubleCoinsButton";
import { Board } from "@/ui/Board";
import { ResultPanel, useResultWidths } from "@/ui/ResultPanel";
import { Screen } from "@/ui/Screen";
import { StarRow } from "@/ui/StarRow";
import { colors } from "@/ui/theme";

// Ask for a review only after a clearly good moment, once (same restraint as FaceUp).
const REVIEW_MIN_LEVEL = 5;

export default function LevelScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const level = getLevel(Number(n));
  const [attempt, setAttempt] = useState(0);

  if (!level) return <Redirect href="/career" />;
  return <LevelRun key={`${level.number}-${attempt}`} level={level} onRetry={() => setAttempt((a) => a + 1)} />;
}

function LevelRun({ level, onRetry }: { level: Level; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const [initial] = useState(() => setupBoard(randomSeed(), level.board));
  const { state, press } = useBoardGame(initial, { revealMs: level.board.revealMs });
  const elapsed = useElapsed(state);
  const boosters = useWallet((s) => s.boosters);
  const rewardedReady = useAds((s) => s.rewardedReady);
  const [previousStars] = useState(() => useProgress.getState().stars[level.number] ?? 0);
  const [peeking, setPeeking] = useState(false);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [doubled, setDoubled] = useState(false);
  const recorded = useRef(false);
  const [quipSeed] = useState(Math.random);

  const complete = state.phase === "complete";
  const showResults = useDelayedTrue(complete, END_OF_GAME_DELAY_MS);
  const stars = complete ? starsFor(level, state.moves, elapsed) : 0;
  const leave = useLeaveGuard(state.moves > 0 && !complete);

  useEffect(() => {
    if (!complete || stars === 0 || recorded.current) return;
    recorded.current = true;
    const progress = useProgress.getState();
    progress.recordLevel(level.number, stars);
    const coins = levelCoins(stars, previousStars);
    useWallet.getState().addCoins(coins);
    setCoinsEarned(coins);
    track("level_complete", { level: level.number, stars, moves: state.moves });
    // Finishing level 25 or the last 3-star level can unlock an app icon (celebrated back home).
    queueEarnedAppIcons();
    // Not a single memory slip: the full-screen celebration.
    if (state.memoryErrors === 0) {
      playFx({ kind: "perfect", emojis: getPack(useWallet.getState().activePack).icons.map((i) => i.asset) });
    }
    if (stars === 3 && level.number >= REVIEW_MIN_LEVEL && !progress.reviewRequested) {
      progress.markReviewRequested();
      StoreReview.isAvailableAsync()
        .then((available) => (available ? StoreReview.requestReview() : undefined))
        .catch(() => {});
    }
  }, [complete, stars, level.number, previousStars, state.moves, state.memoryErrors]);

  // Uses an owned booster, or buys one with coins; offers the shop (or an ad, for hints) otherwise.
  const spendBooster = async (id: BoosterId, apply: () => void) => {
    if (useWallet.getState().consumeBooster(id)) {
      track("booster_used", { booster: id, level: level.number });
      apply();
      return;
    }
    const price = BOOSTER_PRICES[id];
    Alert.alert(t("boosters.notEnough"), t("boosters.notEnoughBody", { price }), [
      ...(rewardedReady
        ? [
            {
              text: id === "hint" ? t("boosters.adHint") : t("boosters.adPeek"),
              onPress: async () => {
                if (await showRewarded(id)) {
                  track("booster_used", { booster: id, level: level.number, via: "ad" });
                  apply();
                }
              },
            },
          ]
        : []),
      { text: t("boosters.toShop"), onPress: () => router.push("/shop") },
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  // Peek: every card face up for a moment, only before the first flip (it would be meaningless later).
  const peek = () =>
    spendBooster("peek", () => {
      setPeeking(true);
      hapticImpact();
      setTimeout(() => setPeeking(false), PEEK_MS);
    });
  // Hint: flashes where the partner of a card already seen is; the player still has to tap it.
  const hint = () =>
    spendBooster("hint", () => {
      const target = hintTarget(state);
      if (target === null) return;
      setFlashIndex(target);
      hapticImpact();
      setTimeout(() => setFlashIndex(null), PEEK_MS);
    });

  const flashing = peeking || flashIndex !== null;
  const canPeek = state.startedAt === null && !flashing;
  const canHint = hintTarget(state) !== null && !flashing;
  const hasNext = level.number < LEVEL_COUNT;
  const widths = useResultWidths();

  const double = async () => {
    if (!doubled && (await showRewarded("double_coins"))) {
      useWallet.getState().addCoins(coinsEarned);
      setDoubled(true);
    }
  };

  return (
    <Screen
      title={t("career.level", { n: level.number })}
      onBack={leave}
      compact
      trailing={<Text style={styles.clock}>{formatDuration(elapsed)}</Text>}
    >
      <View style={styles.hud}>
        <Text style={styles.hudText}>
          {t("game.moves")} {state.moves}
        </Text>
        <Text style={styles.hudText}>
          {t("game.pairs", { found: state.pairsFound, total: state.icons.length / 2 })}
        </Text>
      </View>

      <View style={styles.boardArea} pointerEvents={flashing ? "none" : "auto"}>
        <Board state={state} boardKey="level" onCardPress={press} revealAll={peeking} flashIndex={flashIndex} />
      </View>

      <View style={styles.boosters}>
        <AppButtonGroup
          direction="horizontal"
          buttons={[
            {
              label: `${t("boosters.peek")} · ${boosters.peek > 0 ? boosters.peek : t("boosters.price", { price: BOOSTER_PRICES.peek })}`,
              onPress: peek,
              disabled: !canPeek,
            },
            {
              label: `${t("boosters.hint")} · ${boosters.hint > 0 ? boosters.hint : t("boosters.price", { price: BOOSTER_PRICES.hint })}`,
              onPress: hint,
              disabled: !canHint,
            },
          ]}
        />
      </View>

      {showResults && (
        <ResultPanel
          title={levelQuip(t, stars, quipSeed) || t("game.levelComplete")}
          headline={<StarRow earned={stars} size={40} />}
          stats={[
            { label: t("game.moves"), value: String(state.moves) },
            { label: t("game.time"), value: formatDuration(elapsed) },
            ...(coinsEarned > 0
              ? [
                  {
                    label: t("shop.coins"),
                    value: `+${formatScore(doubled ? coinsEarned * 2 : coinsEarned, i18n.language)}`,
                    icon: <CoinIcon />,
                  },
                ]
              : []),
          ]}
          footer={
            <>
              {hasNext && (
                <AppButton
                  label={t("game.nextLevel")}
                  variant="primary"
                  size="large"
                  width={widths.full}
                  onPress={() =>
                    leaveFinishedGame(t, () =>
                      router.replace({ pathname: "/play/level/[n]", params: { n: String(level.number + 1) } }),
                    )
                  }
                />
              )}
              <AppButtonGroup
                direction="horizontal"
                buttons={[
                  {
                    label: t("game.retry"),
                    size: "large" as const,
                    width: widths.half,
                    onPress: () => leaveFinishedGame(t, onRetry),
                    ...(hasNext ? {} : { variant: "primary" as const }),
                  },
                  {
                    label: t("game.levels"),
                    size: "large" as const,
                    width: widths.half,
                    onPress: () => leaveFinishedGame(t, () => router.back()),
                  },
                ]}
              />
            </>
          }
        >
          <DoubleCoinsButton doubled={doubled} canDouble={rewardedReady && coinsEarned > 0} onDouble={double} />
          {!hasNext && <Text style={styles.done}>{t("game.careerDone")}</Text>}
        </ResultPanel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clock: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  hudText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  boardArea: {
    flex: 1,
  },
  boosters: {
    alignItems: "center",
    paddingVertical: 12,
  },
  done: {
    color: colors.muted,
    fontSize: 15,
  },
});
