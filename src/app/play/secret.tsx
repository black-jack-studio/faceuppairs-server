import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { setupBoard } from "@/game/board";
import { localDay, SECRET_BOARD_COINS } from "@/game/economy";
import { SECRET_BOARD } from "@/game/homeDeal";
import { getPack } from "@/game/iconPacks";
import { playFx } from "@/fx/store";
import { randomSeed } from "@/game/rng";
import { useBoardGame, useElapsed } from "@/game/useBoardGame";
import { track } from "@/lib/analytics";
import { formatDuration, formatScore } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { leaveFinishedGame } from "@/lib/postGame";
import { END_OF_GAME_DELAY_MS, useDelayedTrue } from "@/lib/useDelayedTrue";
import { useLeaveGuard } from "@/lib/useLeaveGuard";
import { useWallet } from "@/store/wallet";
import { AppButton } from "@/ui/AppButton";
import { Board } from "@/ui/Board";
import { CoinIcon } from "@/ui/ButtonIcons";
import { ResultPanel, useResultWidths } from "@/ui/ResultPanel";
import { Screen } from "@/ui/Screen";
import { colors } from "@/ui/theme";

export default function SecretBoardScreen() {
  const { t, i18n } = useTranslation();
  const [initial] = useState(() => setupBoard(randomSeed(), SECRET_BOARD));
  const { state, press } = useBoardGame(initial, { revealMs: SECRET_BOARD.revealMs });
  const elapsed = useElapsed(state);
  const widths = useResultWidths();
  // The prize is collected once per local day (saved on the phone), however often the app restarts.
  const [rewarded] = useState(() => useWallet.getState().secretClaimDay !== localDay());
  const recorded = useRef(false);

  const complete = state.phase === "complete";
  const showResults = useDelayedTrue(complete, END_OF_GAME_DELAY_MS);
  const leave = useLeaveGuard(state.moves > 0 && !complete);

  useEffect(() => {
    track("secret_board_opened");
  }, []);

  useEffect(() => {
    if (!complete || recorded.current) return;
    recorded.current = true;
    hapticSuccess();
    useWallet.getState().markPlayed(localDay());
    track("secret_board_complete", { moves: state.moves });
    if (state.memoryErrors === 0) {
      playFx({ kind: "perfect", emojis: getPack(useWallet.getState().activePack).icons.map((i) => i.asset) });
    }
    if (rewarded) useWallet.getState().claimSecret(localDay());
  }, [complete, rewarded, state.moves, state.memoryErrors]);

  return (
    <Screen
      title={t("secret.title")}
      onBack={leave}
      compact
      trailing={<Text style={styles.clock}>{formatDuration(elapsed)}</Text>}
    >
      <View style={styles.hud}>
        <Text style={styles.hudText}>
          {t("game.moves")} {state.moves}
        </Text>
        <Text style={styles.hudText}>{t("game.pairs", { found: state.pairsFound, total: state.icons.length / 2 })}</Text>
      </View>

      <View style={styles.boardArea}>
        <Board state={state} boardKey="secret" onCardPress={press} />
      </View>

      {showResults && (
        <ResultPanel
          title={t("secret.done")}
          stats={[
            { label: t("game.moves"), value: String(state.moves) },
            { label: t("game.time"), value: formatDuration(elapsed) },
            ...(rewarded
              ? [{ label: t("shop.coins"), value: `+${formatScore(SECRET_BOARD_COINS, i18n.language)}`, icon: <CoinIcon /> }]
              : []),
          ]}
          footer={
            <AppButton
              label={t("endless.menu")}
              variant="primary"
              size="large"
              width={widths.full}
              onPress={() => leaveFinishedGame(t, () => router.back())}
            />
          }
        >
          {!rewarded && <Text style={styles.caption}>{t("secret.noCoins")}</Text>}
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
    paddingBottom: 12,
  },
  caption: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
});
