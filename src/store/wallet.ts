import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  BOOSTER_PRICES,
  FREE_COINS_PER_DAY,
  FREE_COINS_REWARD,
  SECRET_BOARD_COINS,
  claimDaily as claimDailyReward,
  type BoosterId,
  type StreakState,
} from "@/game/economy";
import { DEFAULT_PACK_ID } from "@/game/iconPacks";

interface WalletData {
  coins: number;
  boosters: Record<BoosterId, number>;
  streak: StreakState;
  ownedPacks: string[];
  activePack: string;
  /** Any real-money purchase: payers never see interstitials (MONETISATION.md §2B). */
  hasPurchased: boolean;
  /** "Remove ads" bought, or covered by an active Pairs+ subscription. */
  adsRemoved: boolean;
  isPlus: boolean;
  gamesSinceInterstitial: number;
  lastInterstitialAt: number | null;
  /** Daily Challenge: one ranked attempt per UTC day. */
  daily: { day: string | null; played: boolean; bestScore: number };
  /** Home-screen icons bought with coins or earned by playing (kept even if a streak breaks). */
  ownedAppIcons: string[];
  /** Icons earned but not yet celebrated: shown one by one when the player is back home. */
  pendingIconReveals: string[];
  /** Milestone level (100, 200…) cleared but not yet announced on the home screen. */
  pendingMilestone: number | null;
  /** Local day of the last finished game: the daily chest needs one played today. */
  playedDay: string | null;
  /** Local day the secret board's prize was last collected. */
  secretClaimDay: string | null;
  /** Ad-for-coins in the shop: how many were watched on `day` (local). */
  freeCoins: { day: string | null; count: number };
}

interface WalletState extends WalletData {
  addCoins: (amount: number) => void;
  /** Returns false (and changes nothing) when the balance is too low. */
  spendCoins: (amount: number) => boolean;
  addBoosters: (id: BoosterId, count: number) => void;
  /** Uses one owned booster, buying it with coins if none is left. */
  consumeBooster: (id: BoosterId) => boolean;
  claimDaily: (today: string) => { coins: number; bonusHint: boolean };
  unlockPack: (id: string) => void;
  unlockAppIcons: (ids: string[]) => void;
  queueIconReveals: (ids: string[]) => void;
  /** Credits the ad-for-coins reward; false once today's allowance is used up. */
  claimFreeCoins: (today: string) => boolean;
  /** Takes the next icon to celebrate off the queue. */
  takeIconReveal: () => string | null;
  queueMilestone: (level: number) => void;
  /** Takes the milestone to announce, if any. */
  takeMilestone: () => number | null;
  setActivePack: (id: string) => void;
  setEntitlements: (e: { adsRemoved?: boolean; isPlus?: boolean; hasPurchased?: boolean }) => void;
  noteGameFinished: () => void;
  noteInterstitialShown: (at: number) => void;
  recordDaily: (day: string, score: number) => void;
  markPlayed: (day: string) => void;
  /** Credits the secret board's prize; false when today's was already collected. */
  claimSecret: (day: string) => boolean;
  reset: () => void;
}

const initial: WalletData = {
  coins: 100,
  boosters: { peek: 1, hint: 1 },
  streak: { lastClaimDay: null, streak: 0 },
  ownedPacks: [DEFAULT_PACK_ID],
  activePack: DEFAULT_PACK_ID,
  hasPurchased: false,
  adsRemoved: false,
  isPlus: false,
  gamesSinceInterstitial: 0,
  lastInterstitialAt: null,
  daily: { day: null, played: false, bestScore: 0 },
  ownedAppIcons: [],
  pendingIconReveals: [],
  pendingMilestone: null,
  freeCoins: { day: null, count: 0 },
  playedDay: null,
  secretClaimDay: null,
};

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      ...initial,
      addCoins: (amount) => set((s) => ({ coins: s.coins + Math.max(0, Math.floor(amount)) })),
      spendCoins: (amount) => {
        if (get().coins < amount) return false;
        set((s) => ({ coins: s.coins - amount }));
        return true;
      },
      addBoosters: (id, count) => set((s) => ({ boosters: { ...s.boosters, [id]: s.boosters[id] + count } })),
      consumeBooster: (id) => {
        const s = get();
        if (s.boosters[id] > 0) {
          set({ boosters: { ...s.boosters, [id]: s.boosters[id] - 1 } });
          return true;
        }
        return get().spendCoins(BOOSTER_PRICES[id]);
      },
      claimDaily: (today) => {
        const { next, coins, bonusHint } = claimDailyReward(get().streak, today);
        if (coins === 0) return { coins: 0, bonusHint: false };
        set((s) => ({
          streak: next,
          coins: s.coins + coins,
          boosters: bonusHint ? { ...s.boosters, hint: s.boosters.hint + 1 } : s.boosters,
        }));
        return { coins, bonusHint };
      },
      unlockPack: (id) => set((s) => (s.ownedPacks.includes(id) ? s : { ownedPacks: [...s.ownedPacks, id] })),
      setActivePack: (id) => set({ activePack: id }),
      claimFreeCoins: (today) => {
        const used = get().freeCoins.day === today ? get().freeCoins.count : 0;
        if (used >= FREE_COINS_PER_DAY) return false;
        set((s) => ({ coins: s.coins + FREE_COINS_REWARD, freeCoins: { day: today, count: used + 1 } }));
        return true;
      },
      queueIconReveals: (ids) =>
        set((s) => ({ pendingIconReveals: [...s.pendingIconReveals, ...ids.filter((id) => !s.pendingIconReveals.includes(id))] })),
      queueMilestone: (level) => set({ pendingMilestone: level }),
      takeMilestone: () => {
        const level = get().pendingMilestone;
        if (level !== null) set({ pendingMilestone: null });
        return level;
      },
      takeIconReveal: () => {
        const [next, ...rest] = get().pendingIconReveals;
        if (!next) return null;
        set({ pendingIconReveals: rest });
        return next;
      },
      unlockAppIcons: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.ownedAppIcons.includes(id));
          return fresh.length ? { ownedAppIcons: [...s.ownedAppIcons, ...fresh] } : s;
        }),
      setEntitlements: (e) =>
        set((s) => ({
          adsRemoved: e.adsRemoved ?? s.adsRemoved,
          isPlus: e.isPlus ?? s.isPlus,
          hasPurchased: e.hasPurchased ?? s.hasPurchased,
        })),
      noteGameFinished: () => set((s) => ({ gamesSinceInterstitial: s.gamesSinceInterstitial + 1 })),
      noteInterstitialShown: (at) => set({ gamesSinceInterstitial: 0, lastInterstitialAt: at }),
      recordDaily: (day, score) =>
        set((s) => ({
          daily:
            s.daily.day === day
              ? { day, played: true, bestScore: Math.max(s.daily.bestScore, score) }
              : { day, played: true, bestScore: score },
        })),
      claimSecret: (day) => {
        if (get().secretClaimDay === day) return false;
        set((s) => ({ coins: s.coins + SECRET_BOARD_COINS, secretClaimDay: day }));
        return true;
      },
      markPlayed: (day) => set((s) => (s.playedDay === day ? s : { playedDay: day })),
      reset: () => set(initial),
    }),
    {
      name: "faceup-pairs.wallet",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { addCoins, spendCoins, addBoosters, consumeBooster, claimDaily, unlockPack, setActivePack, setEntitlements, noteGameFinished, noteInterstitialShown, recordDaily, markPlayed, claimSecret, queueMilestone, takeMilestone, reset, ...data } = s;
        return data;
      },
    },
  ),
);
