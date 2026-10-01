import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";

import { setupBoard } from "@/game/board";
import { BOOSTER_PRICES, levelCoins, PEEK_MS, type BoosterId } from "@/game/economy";
import { applyHint } from "@/game/engine";
import { getPack } from "@/game/iconPacks";
import { playFx } from "@/fx/store";
import { getLevel, LEVEL_COUNT, starsFor, type Level } from "@/game/levels";
import { randomSeed } from "@/game/rng";
import { useBoardGame, useElapsed } from "@/game/useBoardGame";
import { showRewarded, useAds } from "@/lib/ads";
import { track } from "@/lib/analytics";
import { formatDuration } from "@/lib/format";
import { hapticImpact } from "@/lib/haptics";
import { leaveFinishedGame } from "@/lib/postGame";
import { levelQuip } from "@/lib/quips";
import { announceEarnedAppIcons } from "@/lib/appIcons";
import { END_OF_GAME_DELAY_MS, useDelayedTrue } from "@/lib/useDelayedTrue";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButton, AppButtonGroup } from "@/ui/AppButton";
import { Board } from "@/ui/Board";
import { ResultPanel } from "@/ui/ResultPanel";
import { Screen } from "@/ui/Screen";
import { StarRow } from "@/ui/StarRow";
import { colors } from "@/ui/theme";

// Ask for a review only after a clearly good moment, once (same restraint as FaceUp).
const REVIEW_MIN_LEVEL = 5;
const RESULT_BUTTON_WIDTH = 220;
const APP_ICON_ANNOUNCE_DELAY_MS = 1800;

export default function LevelScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const level = getLevel(Number(n));
  const [attempt, setAttempt] = useState(0);

  if (!level) return <Redirect href="/career" />;
  return <LevelRun key={`${level.number}-${attempt}`} level={level} onRetry={() => setAttempt((a) => a + 1)} />;
}

function LevelRun({ level, onRetry }: { level: Level; onRetry: () => void }) {
  const { t } = useTranslation();
  const [initial] = useState(() => setupBoard(randomSeed(), level.board));
  const { state, press, reset } = useBoardGame(initial, { revealMs: level.board.revealMs });
  const elapsed = useElapsed(state);
  const boosters = useWallet((s) => s.boosters);
  const rewardedReady = useAds((s) => s.rewardedReady);
  const [previousStars] = useState(() => useProgress.getState().stars[level.number] ?? 0);
  const [peeking, setPeeking] = useState(false);
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
    // Finishing level 25 or the last 3-star level can unlock an app icon.
    setTimeout(() => announceEarnedAppIcons(t), APP_ICON_ANNOUNCE_DELAY_MS);
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
  }, [complete, stars, level.number, previousStars, state.moves, state.memoryErrors, t]);

  // Uses an owned booster, or buys one with coins; offers the shop (or an ad, for hints) otherwise.
  const spendBooster = async (id: BoosterId, apply: () => void) => {
    if (useWallet.getState().consumeBooster(id)) {
      track("booster_used", { booster: id, level: level.number });
      apply();
      return;
    }
    const price = BOOSTER_PRICES[id];
    Alert.alert(t("boosters.notEnough"), t("boosters.notEnoughBody", { price }), [
      ...(id === "hint" && rewardedReady
        ? [
            {
              text: t("boosters.adHint"),
              onPress: async () => {
                if (await showRewarded("hint")) {
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
  const hint = () =>
    spendBooster("hint", () => {
      reset(applyHint(state, Date.now()));
      hapticImpact();
    });

  const canPeek = state.startedAt === null && !peeking;
  const canHint = state.phase === "playing" && state.faceUp.length === 0 && !complete;
  const hasNext = level.number < LEVEL_COUNT;

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

      <View style={styles.boardArea} pointerEvents={peeking ? "none" : "auto"}>
        <Board state={state} boardKey="level" onCardPress={press} revealAll={peeking} />
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
          ]}
        >
          {coinsEarned > 0 && (
            <View style={styles.coinsRow}>
              <Text style={styles.coins}>
                {t("results.coinsEarned", { count: doubled ? coinsEarned * 2 : coinsEarned })}
                {doubled ? ` · ${t("results.doubled")}` : ""}
              </Text>
              {!doubled && rewardedReady && <AppButton label={t("results.double")} onPress={double} />}
            </View>
          )}
          {!hasNext && <Text style={styles.done}>{t("game.careerDone")}</Text>}
          {hasNext && (
            <AppButton
              label={t("game.nextLevel")}
              variant="primary"
              size="hero"
              width={RESULT_BUTTON_WIDTH}
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
              { label: t("game.retry"), onPress: () => leaveFinishedGame(t, onRetry), ...(hasNext ? {} : { variant: "primary" as const }) },
              { label: t("game.levels"), onPress: () => leaveFinishedGame(t, () => router.back()) },
            ]}
          />
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
  coinsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coins: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  done: {
    color: colors.muted,
    fontSize: 15,
  },
});
