import { afterGameFinished } from "./ads";

/** Leaving a finished game: the capped interstitial (if due), then wherever the player was going. */
export async function leaveFinishedGame(go: () => void): Promise<void> {
  await afterGameFinished();
  go();
}
