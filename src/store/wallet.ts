import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  BOOSTER_PRICES,
  claimDaily as claimDailyReward,
  PLUS_DAILY_COINS,
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
  starterPackBought: boolean;
  gamesSinceInterstitial: number;
  lastInterstitialAt: number | null;
  /** Daily Challenge: one ranked attempt per UTC day. */
  daily: { day: string | null; played: boolean; bestScore: number };
}

interface WalletState extends WalletData {
  addCoins: (amount: number) => void;
  /** Returns false (and changes nothing) when the balance is too low. */
  spendCoins: (amount: number) => boolean;
  addBoosters: (id: BoosterId, count: number) => void;
  /** Uses one owned booster, buying it with coins if none is left. */
  consumeBooster: (id: BoosterId) => boolean;
  /** Chest of the day; `plusCoins` is the extra Pairs+ daily grant included in `coins`. */
  claimDaily: (today: string) => { coins: number; bonusHint: boolean; plusCoins: number };
  unlockPack: (id: string) => void;
  setActivePack: (id: string) => void;
  setEntitlements: (e: { adsRemoved?: boolean; isPlus?: boolean; hasPurchased?: boolean; starterPackBought?: boolean }) => void;
  noteGameFinished: () => void;
  noteInterstitialShown: (at: number) => void;
  recordDaily: (day: string, score: number) => void;
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
  starterPackBought: false,
  gamesSinceInterstitial: 0,
  lastInterstitialAt: null,
  daily: { day: null, played: false, bestScore: 0 },
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
        if (coins === 0) return { coins: 0, bonusHint: false, plusCoins: 0 };
        const plusCoins = get().isPlus ? PLUS_DAILY_COINS : 0;
        set((s) => ({
          streak: next,
          coins: s.coins + coins + plusCoins,
          boosters: bonusHint ? { ...s.boosters, hint: s.boosters.hint + 1 } : s.boosters,
        }));
        return { coins: coins + plusCoins, bonusHint, plusCoins };
      },
      unlockPack: (id) => set((s) => (s.ownedPacks.includes(id) ? s : { ownedPacks: [...s.ownedPacks, id] })),
      setActivePack: (id) => set({ activePack: id }),
      setEntitlements: (e) =>
        set((s) => ({
          adsRemoved: e.adsRemoved ?? s.adsRemoved,
          isPlus: e.isPlus ?? s.isPlus,
          hasPurchased: e.hasPurchased ?? s.hasPurchased,
          starterPackBought: e.starterPackBought ?? s.starterPackBought,
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
      reset: () => set(initial),
    }),
    {
      name: "faceup-pairs.wallet",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => {
        const { addCoins, spendCoins, addBoosters, consumeBooster, claimDaily, unlockPack, setActivePack, setEntitlements, noteGameFinished, noteInterstitialShown, recordDaily, reset, ...data } = s;
        return data;
      },
    },
  ),
);
