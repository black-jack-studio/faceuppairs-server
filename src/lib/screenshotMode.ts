// TEMP — App Store screenshots only. Never commit: delete this file and its two call sites.
import type { BoardKind, Leaderboard } from "./api";
import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";
import { localDay } from "@/game/economy";
import { utcDay } from "@/game/run";

export const SCREENSHOT_MODE = __DEV__;

const ME = "stan";

export function seedScreenshotData() {
  if (!SCREENSHOT_MODE) return;
  // Levels 1–47 cleared, mostly 3 stars, a few 2s and one 1 for a believable map.
  const stars: Record<number, 1 | 2 | 3> = {};
  for (let n = 1; n <= 47; n++) stars[n] = n % 7 === 0 ? 2 : n % 19 === 0 ? 1 : 3;
  useProgress.setState({
    stars,
    bestEndless: 18450,
    nickname: ME,
    nicknamePrompted: true,
    nicknameTakenNotice: false,
  });
  useWallet.setState((s) => ({
    coins: 12480,
    ownedPacks: Array.from(new Set([...s.ownedPacks, "animals", "food", "nature", "ocean", "legends"])),
    activePack: "ocean",
    // Chest already collected and today's challenge played: no red dots on the home screen.
    streak: { lastClaimDay: localDay(), streak: 12 },
    playedDay: localDay(),
    daily: { day: utcDay(), played: true, bestScore: 5940 },
    pendingIconReveals: [],
    pendingMilestone: null,
  }));
}

const NAMES = [
  ["lea_mtl", 41250, true], ["Hugo", 38900, false], ["maxou", 35120, true], ["ines.b", 33870, false],
  ["Tom_92", 31400, false], ["camille", 29760, true], ["nathan", 27310, false], ["zoe_x", 25980, false],
  ["Anat16", 24120, true], ["jules", 22450, false], ["sarah", 21030, false], ["louis_ft", 19870, false],
  [ME, 18450, true], ["emma.r", 17220, false], ["noah", 16100, false], ["chloe", 15040, false],
  ["Raphael", 13980, false], ["manon", 12760, false], ["leo_7", 11520, false], ["alice", 10410, false],
] as const;

export function fakeLeaderboard(board: BoardKind): Leaderboard {
  const scale = board === "daily" ? 0.32 : 1;
  const entries = NAMES.map(([name, score, plus], i) => ({
    rank: i + 1,
    name,
    ref: `fake-${i}`,
    score: Math.round(score * scale),
    plus,
    isMe: name === ME,
  }));
  const me = entries.find((e) => e.isMe)!;
  return {
    board,
    endsAt: board === "daily" ? new Date(Date.now() + 9 * 3600_000).toISOString() : null,
    total: 4812,
    entries,
    me: { rank: me.rank, score: me.score, name: ME },
  };
}
