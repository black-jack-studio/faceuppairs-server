import { createGame, type GameState } from "./engine";
import { pickIcons } from "./icons";
import { createRng } from "./rng";

export interface BoardConfig {
  pairs: number;
  /** Share of icons drawn from look-alike groups (0..1). */
  lookalikeRatio: number;
  /** How long a mismatched pair stays visible before flipping back. */
  revealMs: number;
}

export const GRID_COLUMNS = 4;

/** Same seed + same config always yields the same board, on the device and on the server. */
export function setupBoard(seed: number, config: BoardConfig): GameState {
  const rng = createRng(seed);
  const icons = pickIcons(config.pairs, config.lookalikeRatio, rng);
  return createGame(icons, rng);
}
