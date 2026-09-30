import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { DAILY_CHALLENGE_COINS, endlessCoins, REVIVE_PRICE } from "@/game/economy";
import type { FlipLogEntry } from "@/game/engine";
import { endlessBoardConfig, STARTING_LIVES } from "@/game/endless";
import { dailySeed, runBoard, scoreRun, utcDay } from "@/game/run";
import { randomSeed } from "@/game/rng";
import { useBoardGame } from "@/game/useBoardGame";
import { ensureAccount, getCredentials } from "@/lib/account";
import { showRewarded, useAds } from "@/lib/ads";
import { track } from "@/lib/analytics";
import { api, START_TIMEOUT_MS } from "@/lib/api";
import { formatCountdown, formatScore, nextUtcMidnight } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { leaveFinishedGame } from "@/lib/postGame";
import { buy, PRODUCT_IDS, useStore } from "@/lib/purchases";
import { submitRun } from "@/lib/runQueue";
import { END_OF_GAME_DELAY_MS, useDelayedTrue } from "@/lib/useDelayedTrue";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { AppButton, AppButtonGroup } from "@/ui/AppButton";
import { Emoji, UI_EMOJI } from "@/ui/Emoji";
import { Board } from "@/ui/Board";
import { ResultPanel } from "@/ui/ResultPanel";
import { Screen } from "@/ui/Screen";
import { colors } from "@/ui/theme";

type Mode = "endless" | "daily";
const NEXT_BOARD_DELAY_MS = 700;
const LIFE_SIZE = 18;
const RESULT_BUTTON_WIDTH = 220;

interface Session {
  seed: number;
  /** Server-issued run: the score will be ranked. Null when offline (local seed, unranked). */
  runId: string | null;
}

export function RankedRunScreen({ mode }: { mode: Mode }) {
  const [attempt, setAttempt] = useState(0);
  const today = utcDay();
  const daily = useWallet((s) => s.daily);
  if (mode === "daily" && daily.day === today && daily.played) return <DailyDone score={daily.bestScore} />;
  return <RunLoader key={attempt} mode={mode} onPlayAgain={() => setAttempt((a) => a + 1)} />;
}

function RunLoader({ mode, onPlayAgain }: { mode: Mode; onPlayAgain: () => void }) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = utcDay();
      const localSeed = mode === "daily" ? dailySeed(today) : randomSeed();
      const credentials = await ensureAccount(START_TIMEOUT_MS);
      const res = credentials ? await api.startRun(credentials, mode) : null;
      if (cancelled) return;
      if (res?.ok) {
        setSession({ seed: res.data.seed, runId: res.data.runId });
      } else if (res?.error === "daily_already_played") {
        // Played today on another phone or before a reinstall: show that result instead of an
        // unranked replay (RankedRunScreen switches to DailyDone once this is recorded).
        const score = typeof res.data?.score === "number" ? res.data.score : 0;
        useWallet.getState().recordDaily(today, score);
      } else {
        setSession({ seed: localSeed, runId: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  if (!session) {
    return (
      <Screen title={mode === "daily" ? t("daily.title") : t("home.endless")}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.muted} />
        </View>
      </Screen>
    );
  }
  return <RunGame mode={mode} session={session} onPlayAgain={onPlayAgain} />;
}

type Phase = "playing" | "reviveOffer" | "over";

function RunGame({ mode, session, onPlayAgain }: { mode: Mode; session: Session; onPlayAgain: () => void }) {
  const { t, i18n } = useTranslation();
  const { seed, runId } = session;
  const [boardIndex, setBoardIndex] = useState(0);
  const [completed, setCompleted] = useState<FlipLogEntry[][]>([]);
  const [reviveAt, setReviveAt] = useState<number | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [initial] = useState(() => runBoard(seed, 0));
  const { state, press, reset } = useBoardGame(initial, {
    revealMs: endlessBoardConfig(boardIndex).revealMs,
    memoryErrorsCost: true,
  });
  const bestEndless = useProgress((s) => s.bestEndless);
  const rewardedReady = useAds((s) => s.rewardedReady);
  const reviveOfferPrice = useStore((s) => s.products[PRODUCT_IDS.reviveOffer]?.priceString);
  const coins = useWallet((s) => s.coins);

  // The score shown is computed by the very function the server uses to check it.
  const result = useMemo(
    () => scoreRun({ seed, boards: [...completed, state.log], reviveAt }),
    [seed, completed, state.log, reviveAt],
  );

  // Derived, not stored: losing the last life offers the one revive; after it (or giving up),
  // the run is over. Reviving moves reviveAt, which makes `result.lost` false again.
  const phase: Phase = gaveUp ? "over" : result.lost ? (reviveAt === null ? "reviveOffer" : "over") : "playing";
  // Giving up closes at once; losing the last life first lets the missed card flip over.
  const showOverlay = useDelayedTrue(phase !== "playing", gaveUp ? 0 : END_OF_GAME_DELAY_MS);

  // Board cleared: deal the next one after a short beat.
  useEffect(() => {
    if (state.phase !== "complete" || phase !== "playing") return;
    const timer = setTimeout(() => {
      const next = boardIndex + 1;
      setCompleted((c) => [...c, state.log]);
      setBoardIndex(next);
      reset(runBoard(seed, next));
    }, NEXT_BOARD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.log, boardIndex, phase, reset, seed]);

  const totalFlips = completed.reduce((n, b) => n + b.length, 0) + state.log.length;
  const revive = (via: "ad" | "coins" | "offer") => {
    setReviveAt(totalFlips);
    track("revive", { mode, via });
  };

  const reviveWithAd = async () => {
    if (await showRewarded("revive")) revive("ad");
  };
  const reviveWithCoins = () => {
    if (useWallet.getState().spendCoins(REVIVE_PRICE)) revive("coins");
  };
  const reviveWithOffer = async () => {
    if ((await buy(PRODUCT_IDS.reviveOffer)) === "purchased") revive("offer");
  };

  const leave = useLeaveGuard(phase === "playing" && (boardIndex > 0 || state.moves > 0));
  const lives = Math.max(result.livesLeft, 0);

  return (
    <Screen
      title={
        mode === "daily"
          ? `${t("daily.title")} · ${boardIndex + 1}`
          : t("endless.board", { n: boardIndex + 1 })
      }
      onBack={leave}
      compact
      trailing={
        <View style={styles.lives} accessible accessibilityLabel={t("endless.lives", { n: lives })}>
          {Array.from({ length: STARTING_LIVES }, (_, i) => (
            <View key={i} style={i >= lives && styles.lifeLost}>
              <Emoji asset={UI_EMOJI.heart} size={LIFE_SIZE} />
            </View>
          ))}
        </View>
      }
    >
      <View style={styles.hud}>
        <View>
          <Text style={styles.score} accessibilityLabel={`${t("endless.score")} ${result.score}`}>
            {formatScore(result.score, i18n.language)}
          </Text>
          <Text style={styles.caption}>
            {runId
              ? t("endless.best", { score: formatScore(bestEndless, i18n.language) })
              : t("results.unranked")}
          </Text>
        </View>
        <Text style={[styles.streak, state.streak < 2 && styles.streakIdle]}>
          {t("endless.streak", { n: Math.max(state.streak, 1) })}
        </Text>
      </View>

      <View style={styles.boardArea} pointerEvents={phase === "playing" ? "auto" : "none"}>
        <Board state={state} boardKey={boardIndex} onCardPress={press} />
      </View>

      {showOverlay && phase === "reviveOffer" && (
        <ResultPanel title={t("revive.title")} stats={[]}>
          <Text style={styles.caption}>{t("revive.body")}</Text>
          <AppButtonGroup
            buttons={[
              ...(rewardedReady
                ? [{ label: t("revive.watchAd"), variant: "primary" as const, size: "large" as const, onPress: reviveWithAd }]
                : []),
              ...(coins >= REVIVE_PRICE
                ? [{ label: t("revive.payCoins", { price: REVIVE_PRICE }), onPress: reviveWithCoins }]
                : []),
              ...(reviveOfferPrice
                ? [{ label: t("revive.offer", { price: reviveOfferPrice }), onPress: reviveWithOffer }]
                : []),
              { label: t("revive.giveUp"), onPress: () => setGaveUp(true) },
            ]}
          />
        </ResultPanel>
      )}

      {showOverlay && phase === "over" && (
        <RunResults
          mode={mode}
          runId={runId}
          log={{ boards: [...completed, state.log], reviveAt }}
          score={result.score}
          boardsCleared={result.boardsCleared}
          onPlayAgain={onPlayAgain}
        />
      )}
    </Screen>
  );
}

type SubmitState = "idle" | "sending" | { rank: number } | "ranked" | "queued" | "rejected" | "unranked";

function RunResults({
  mode,
  runId,
  log,
  score,
  boardsCleared,
  onPlayAgain,
}: {
  mode: Mode;
  runId: string | null;
  log: { boards: FlipLogEntry[][]; reviveAt: number | null };
  score: number;
  boardsCleared: number;
  onPlayAgain: () => void;
}) {
  const { t, i18n } = useTranslation();
  const rewardedReady = useAds((s) => s.rewardedReady);
  const [submit, setSubmit] = useState<SubmitState>(runId ? "sending" : "unranked");
  const [coinsEarned] = useState(() => endlessCoins(score) + (mode === "daily" ? DAILY_CHALLENGE_COINS : 0));
  const [doubled, setDoubled] = useState(false);
  const [bestBefore] = useState(() => useProgress.getState().bestEndless);
  const isBest = mode === "endless" && score > bestBefore;
  const finalized = useRef(false);

  // Runs once: local records, coins, analytics, then the server.
  useEffect(() => {
    if (finalized.current) return;
    finalized.current = true;
    if (mode === "endless") useProgress.getState().recordEndless(score);
    else useWallet.getState().recordDaily(utcDay(), score);
    useWallet.getState().addCoins(coinsEarned);
    track(mode === "daily" ? "daily_finished" : "run_finished", { score, boards: boardsCleared, ranked: runId !== null });
    if (score > 0) hapticSuccess();

    if (!runId) return;
    (async () => {
      const outcome = await submitRun(runId, log);
      if (outcome.status === "queued") return setSubmit("queued");
      if (outcome.status === "rejected") return setSubmit("rejected");
      const res = await api.leaderboard(mode === "daily" ? "daily" : "endless", await getCredentials());
      setSubmit(res.ok && res.data.me ? { rank: res.data.me.rank } : "ranked");
    })();
  }, [boardsCleared, coinsEarned, log, mode, runId, score]);

  const double = async () => {
    if (doubled) return;
    if (await showRewarded("double_coins")) {
      useWallet.getState().addCoins(coinsEarned);
      setDoubled(true);
    }
  };

  const status =
    submit === "sending"
      ? t("results.sending")
      : submit === "queued"
        ? t("results.queued")
        : submit === "rejected"
          ? t("results.rejected")
          : submit === "unranked"
            ? t("results.unranked")
            : typeof submit === "object"
              ? t("results.rank", { rank: submit.rank })
              : "";

  const go = (action: () => void) => leaveFinishedGame(t, action);

  return (
    <ResultPanel
      title={t("endless.gameOver")}
      headline={<Text style={styles.finalScore}>{formatScore(score, i18n.language)}</Text>}
      stats={[]}
    >
      {isBest && <Text style={styles.best}>{t("endless.newBest")}</Text>}
      {status ? <Text style={styles.caption}>{status}</Text> : null}
      <View style={styles.coinsRow}>
        <Text style={styles.coins}>
          {t("results.coinsEarned", { count: doubled ? coinsEarned * 2 : coinsEarned })}
          {doubled ? ` · ${t("results.doubled")}` : ""}
        </Text>
        {!doubled && rewardedReady && coinsEarned > 0 && <AppButton label={t("results.double")} onPress={double} />}
      </View>
      {mode === "endless" && (
        <AppButton label={t("endless.playAgain")} variant="primary" size="hero" width={RESULT_BUTTON_WIDTH} onPress={() => go(onPlayAgain)} />
      )}
      <AppButtonGroup
        direction="horizontal"
        buttons={[
          {
            label: t("home.leaderboard"),
            ...(mode === "daily" ? { variant: "primary" as const } : {}),
            onPress: () => go(() => router.replace({ pathname: "/leaderboard", params: { board: mode === "daily" ? "daily" : "endless" } })),
          },
          { label: t("endless.menu"), onPress: () => go(() => router.back()) },
        ]}
      />
    </ResultPanel>
  );
}

function DailyDone({ score }: { score: number }) {
  const { t, i18n } = useTranslation();
  return (
    <Screen title={t("daily.title")}>
      <View style={styles.center}>
        <Text style={styles.doneTitle}>{t("daily.alreadyPlayed")}</Text>
        <Text style={styles.finalScore}>{formatScore(score, i18n.language)}</Text>
        <Text style={styles.caption}>{t("daily.nextIn", { time: formatCountdown(nextUtcMidnight(), i18n.language) })}</Text>
        <AppButtonGroup
          buttons={[
            {
              label: t("daily.seeRanking"),
              variant: "primary",
              size: "large",
              onPress: () => router.replace({ pathname: "/leaderboard", params: { board: "daily" } }),
            },
          ]}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  lives: {
    flexDirection: "row",
    gap: 2,
  },
  lifeLost: {
    opacity: 0.2,
  },
  hud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 8,
  },
  score: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  streak: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  streakIdle: {
    color: colors.faint,
  },
  boardArea: {
    flex: 1,
  },
  finalScore: {
    color: colors.text,
    fontSize: 48,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  best: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
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
  doneTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
