import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";


export type Stars = 1 | 2 | 3;

interface ProgressData {
  /** Best stars per level number. */
  stars: Record<number, Stars>;
  bestEndless: number;
  endlessRuns: number;
  nickname: string | null;
  nicknameChangedAt: number | null;
  /** Chosen offline: pushed to the server on the next launch with a connection. */
  nicknamePendingSync: boolean;
  /** The first-launch nickname prompt has been shown (answered or skipped). */
  nicknamePrompted: boolean;
  /** A nickname chosen offline turned out to be taken: ask again, saying why. */
  nicknameTakenNotice: boolean;
  /** Leaderboard players this player chose to hide (public refs) — Apple 1.2 "block". */
  hiddenRefs: string[];
  reviewRequested: boolean;
}

interface ProgressState extends ProgressData {
  recordLevel: (level: number, stars: Stars) => void;
  /** Returns true when the score is a new personal best. */
  recordEndless: (score: number) => boolean;
  setNickname: (nickname: string) => void;
  setNicknamePendingSync: (pending: boolean) => void;
  clearNickname: () => void;
  /** Offline nickname rejected by the server: forget it and re-ask on the home screen. */
  rejectNickname: () => void;
  markNicknamePrompted: () => void;
  hidePlayer: (ref: string) => void;
  unhideAll: () => void;
  markReviewRequested: () => void;
  reset: () => void;
}

const initial: ProgressData = {
  stars: {},
  bestEndless: 0,
  endlessRuns: 0,
  nickname: null,
  nicknameChangedAt: null,
  nicknamePendingSync: false,
  nicknamePrompted: false,
  nicknameTakenNotice: false,
  hiddenRefs: [],
  reviewRequested: false,
};

// Progress lives on the device only (no account). AsyncStorage is part of Android Auto Backup,
// so it also follows a player to a new Android phone.
export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordLevel: (level, stars) =>
        set((s) => ({ stars: { ...s.stars, [level]: Math.max(s.stars[level] ?? 0, stars) as Stars } })),
      recordEndless: (score) => {
        const isBest = score > get().bestEndless;
        set((s) => ({ endlessRuns: s.endlessRuns + 1, bestEndless: Math.max(s.bestEndless, score) }));
        return isBest;
      },
      // The change cooldown only starts on a *change*: picking the first nickname must not stop
      // a player from fixing a typo a minute later.
      setNickname: (nickname) =>
        set((s) => ({ nickname, nicknameChangedAt: s.nickname === null ? null : Date.now() })),
      setNicknamePendingSync: (nicknamePendingSync) => set({ nicknamePendingSync }),
      clearNickname: () => set({ nickname: null, nicknameChangedAt: null, nicknamePendingSync: false }),
      rejectNickname: () =>
        set({
          nickname: null,
          nicknameChangedAt: null,
          nicknamePendingSync: false,
          nicknamePrompted: false,
          nicknameTakenNotice: true,
        }),
      markNicknamePrompted: () => set({ nicknamePrompted: true, nicknameTakenNotice: false }),
      hidePlayer: (ref) => set((s) => (s.hiddenRefs.includes(ref) ? s : { hiddenRefs: [...s.hiddenRefs, ref] })),
      unhideAll: () => set({ hiddenRefs: [] }),
      markReviewRequested: () => set({ reviewRequested: true }),
      reset: () => set(initial),
    }),
    {
      name: "faceup-pairs.progress",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        stars: s.stars,
        bestEndless: s.bestEndless,
        endlessRuns: s.endlessRuns,
        nickname: s.nickname,
        nicknameChangedAt: s.nicknameChangedAt,
        nicknamePendingSync: s.nicknamePendingSync,
        nicknamePrompted: s.nicknamePrompted,
        nicknameTakenNotice: s.nicknameTakenNotice,
        hiddenRefs: s.hiddenRefs,
        reviewRequested: s.reviewRequested,
      }),
    },
  ),
);

export function highestUnlockedLevel(stars: Record<number, Stars>): number {
  let level = 1;
  while (stars[level]) level++;
  return level;
}

export function totalStars(stars: Record<number, Stars>): number {
  return Object.values(stars).reduce<number>((sum, n) => sum + n, 0);
}

export const NICKNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
