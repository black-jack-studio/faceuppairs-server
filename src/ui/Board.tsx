import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { Banner, FloatLabel } from "@/fx/BoardFx";
import { DEAL_STEP_MS, FINALE_START_MS, FINALE_STEP_MS } from "@/fx/motion";
import { GRID_COLUMNS } from "@/game/board";
import type { GameState } from "@/game/engine";
import { getPack, iconFor } from "@/game/iconPacks";
import type { LastFlip } from "@/game/useBoardGame";
import { useWallet } from "@/store/wallet";

import { Card, type CardFinale } from "./Card";
import { space } from "./theme";

interface BoardProps {
  state: GameState;
  /** Changes whenever a new board is dealt, so cards remount face down instead of flipping back. */
  boardKey: string | number;
  onCardPress: (index: number) => void;
  /** Peek booster: every card shown face up (and not tappable) for a moment. */
  revealAll?: boolean;
  /** Hint booster: one card shown face up for a moment. */
  flashIndex?: number | null;
  /** The last pair played, for the rewards drawn on the grid. */
  lastFlip?: LastFlip | null;
  /** What rises from a pair ("+300", "×3"), or null for nothing. */
  matchLabel?: (flip: LastFlip) => string | null;
  /** Set once the board is done: a wave of pops, or the cards flying out ("clear"). */
  finale?: CardFinale | null;
  /** With a "clear" finale: the bonus shown in the middle of the grid. */
  banner?: { title: string; caption?: string } | null;
}

/** How long the "clear" finale runs, from the last pair to the last card gone. */
export const CLEAR_FINALE_MS = 1650;

const BOARD_TOP_PADDING = 8;

// Cards are as large as the space allows while staying perfectly square, 4 per row.
export function Board({
  state,
  boardKey,
  onCardPress,
  revealAll = false,
  flashIndex = null,
  lastFlip = null,
  matchLabel,
  finale = null,
  banner = null,
}: BoardProps) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const pack = getPack(useWallet((s) => s.activePack));
  const rows = state.icons.length / GRID_COLUMNS;
  const gap = space.gridGap;

  const size = area
    ? Math.floor(
        Math.min((area.width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS, (area.height - BOARD_TOP_PADDING * 2 - gap * (rows - 1)) / rows),
      )
    : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const step = size + gap;
  const center = (i: number) => ({
    x: (i % GRID_COLUMNS) * step + size / 2,
    y: Math.floor(i / GRID_COLUMNS) * step + size / 2,
  });
  const at = lastFlip ? { x: (center(lastFlip.a).x + center(lastFlip.b).x) / 2, y: (center(lastFlip.a).y + center(lastFlip.b).y) / 2 } : null;
  // The finale wave runs out from the last pair, one card-width at a time.
  const finaleDelay = (i: number) => {
    if (!at || !step) return FINALE_START_MS;
    const c = center(i);
    return FINALE_START_MS + Math.round((Math.hypot(c.x - at.x, c.y - at.y) / step) * FINALE_STEP_MS);
  };
  const label = lastFlip?.kind === "match" && !(lastFlip.complete && banner) ? matchLabel?.(lastFlip) : null;

  return (
    <View style={styles.area} onLayout={onLayout}>
      {size > 0 && (
        <View style={[styles.grid, { width: size * GRID_COLUMNS + gap * (GRID_COLUMNS - 1), gap }]}>
          {state.icons.map((slot, i) => (
            <Card
              key={`${boardKey}-${i}`}
              index={i}
              icon={iconFor(pack, slot)}
              size={size}
              faceUp={revealAll || i === flashIndex || state.faceUp.includes(i)}
              matched={state.matched[i]}
              onPress={onCardPress}
              dealDelay={(Math.floor(i / GRID_COLUMNS) + (i % GRID_COLUMNS)) * DEAL_STEP_MS}
              shakeKey={lastFlip?.costly && (i === lastFlip.a || i === lastFlip.b) ? lastFlip.id : 0}
              finale={finale}
              finaleDelay={finale ? finaleDelay(i) : 0}
            />
          ))}
          {label && at && lastFlip && <FloatLabel key={lastFlip.id} x={at.x} y={at.y} text={label} strong={lastFlip.streak >= 5} />}
          {finale === "clear" && banner && (
            <Banner key={`banner-${boardKey}`} title={banner.title} caption={banner.caption} delay={FINALE_START_MS - 120} holdMs={850} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Centred in the space left between the HUD and the bottom: a short board (3–4 rows) no
  // longer leaves a big empty band under it.
  area: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: BOARD_TOP_PADDING,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
