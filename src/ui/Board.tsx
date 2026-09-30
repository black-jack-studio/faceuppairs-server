import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { GRID_COLUMNS } from "@/game/board";
import type { GameState } from "@/game/engine";
import { getPack, iconFor } from "@/game/iconPacks";
import { useWallet } from "@/store/wallet";

import { Card } from "./Card";
import { space } from "./theme";

interface BoardProps {
  state: GameState;
  /** Changes whenever a new board is dealt, so cards remount face down instead of flipping back. */
  boardKey: string | number;
  onCardPress: (index: number) => void;
  /** Peek booster: every card shown face up (and not tappable) for a moment. */
  revealAll?: boolean;
}

const BOARD_TOP_PADDING = 8;

// Cards are as large as the space allows while staying perfectly square, 4 per row.
export function Board({ state, boardKey, onCardPress, revealAll = false }: BoardProps) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const pack = getPack(useWallet((s) => s.activePack));
  const rows = state.icons.length / GRID_COLUMNS;
  const gap = space.gridGap;

  const size = area
    ? Math.floor(
        Math.min((area.width - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS, (area.height - BOARD_TOP_PADDING - gap * (rows - 1)) / rows),
      )
    : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

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
              faceUp={revealAll || state.faceUp.includes(i)}
              matched={state.matched[i]}
              onPress={onCardPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Anchored under the HUD: the eye goes there first, and the free space falls to the boosters.
  area: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: BOARD_TOP_PADDING,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
