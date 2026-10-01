import mobileAds, {
  AdEventType,
  AdsConsent,
  AdsConsentPrivacyOptionsRequirementStatus,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { create } from "zustand";

import { ADMOB_UNITS } from "@/config/env";
import { shouldShowInterstitial } from "@/game/economy";
import { highestUnlockedLevel, useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";

import { track } from "./analytics";

// MONETISATION.md §2: rewarded ads are the backbone and always the player's choice;
// interstitials are capped by shouldShowInterstitial. No banners.

const rewardedUnit = __DEV__ ? TestIds.REWARDED : ADMOB_UNITS.rewarded;
const interstitialUnit = __DEV__ ? TestIds.INTERSTITIAL : ADMOB_UNITS.interstitial;

export type RewardPlacement = "revive" | "double_coins" | "hint" | "peek" | "daily_chest" | "free_coins";

interface AdsState {
  /** A rewarded ad is loaded and can be shown right now. Buttons hide otherwise. */
  rewardedReady: boolean;
  /** Europe (UMP): the privacy options form must stay reachable from Settings. */
  privacyOptionsRequired: boolean;
  /**
   * The consent step is over (form answered, not needed, or failed). Other first-launch prompts
   * wait for it: iOS shows one modal at a time, and a dropped consent form means no ads at all.
   */
  consentSettled: boolean;
  /**
   * UMP answered, so privacyOptionsRequired reflects the player's region. False when consent
   * couldn't be gathered (offline, no ad units): other consent decisions then assume it applies.
   */
  consentRegionKnown: boolean;
}

export const useAds = create<AdsState>(() => ({
  rewardedReady: false,
  privacyOptionsRequired: false,
  consentSettled: false,
  consentRegionKnown: false,
}));

let initialized = false;
let rewarded: RewardedAd | null = null;
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;

/**
 * Consent first (Google's UMP form, shown only where the law requires it), then the SDK.
 * Nothing is requested before consent allows it — same order as FaceUp.
 */
export async function initAds(): Promise<void> {
  if (initialized) return;
  if (!rewardedUnit) {
    useAds.setState({ consentSettled: true });
    return;
  }
  try {
    const consent = await AdsConsent.gatherConsent();
    useAds.setState({
      privacyOptionsRequired: consent.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
      consentSettled: true,
      consentRegionKnown: true,
    });
    if (!consent.canRequestAds) return;
    await mobileAds().initialize();
    initialized = true;
    loadRewarded();
    loadInterstitial();
  } catch {
    // No ads this session (offline at launch, consent service down). The game is unaffected.
  } finally {
    useAds.setState({ consentSettled: true });
  }
}

export async function showAdPrivacyOptions(): Promise<void> {
  await AdsConsent.showPrivacyOptionsForm().catch(() => {});
}

function loadRewarded() {
  if (!rewardedUnit) return;
  rewarded = RewardedAd.createForAdRequest(rewardedUnit);
  const unsubscribe = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    useAds.setState({ rewardedReady: true });
    unsubscribe();
  });
  const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, () => {
    unsubscribeError();
    // Retry later rather than hammering the network on no-fill.
    setTimeout(loadRewarded, 60_000);
  });
  rewarded.load();
}

/** Resolves true only if the player watched to the end and earned the reward. */
export function showRewarded(placement: RewardPlacement): Promise<boolean> {
  const ad = rewarded;
  if (!ad || !useAds.getState().rewardedReady) return Promise.resolve(false);
  useAds.setState({ rewardedReady: false });
  track("ad_rewarded_shown", { placement });

  return new Promise((resolve) => {
    let earned = false;
    const subs = [
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => finish()),
      ad.addAdEventListener(AdEventType.ERROR, () => finish()),
    ];
    const finish = () => {
      subs.forEach((unsubscribe) => unsubscribe());
      if (earned) track("ad_rewarded_earned", { placement });
      resolve(earned);
      loadRewarded();
    };
    ad.show().catch(() => finish());
  });
}

function loadInterstitial() {
  if (!interstitialUnit) return;
  interstitialLoaded = false;
  interstitial = InterstitialAd.createForAdRequest(interstitialUnit);
  const unsubscribe = interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    unsubscribe();
  });
  const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
    unsubscribeError();
    setTimeout(loadInterstitial, 60_000);
  });
  interstitial.load();
}

/**
 * Call when the player leaves a finished game. Counts the game, and shows an interstitial only
 * if every rule allows it (never for payers, never early in the game, capped). Resolves once
 * the ad is closed, so navigation happens after it.
 */
export async function afterGameFinished(): Promise<void> {
  const wallet = useWallet.getState();
  wallet.noteGameFinished();
  const now = Date.now();
  const allowed = shouldShowInterstitial({
    adsRemoved: wallet.adsRemoved || wallet.hasPurchased,
    highestLevel: highestUnlockedLevel(useProgress.getState().stars),
    gamesSinceLast: useWallet.getState().gamesSinceInterstitial,
    lastShownAt: wallet.lastInterstitialAt,
    now,
  });
  const ad = interstitial;
  if (!allowed || !ad || !interstitialLoaded) return;

  await new Promise<void>((resolve) => {
    const subs = [
      ad.addAdEventListener(AdEventType.CLOSED, () => done()),
      ad.addAdEventListener(AdEventType.ERROR, () => done()),
    ];
    const done = () => {
      subs.forEach((unsubscribe) => unsubscribe());
      resolve();
      loadInterstitial();
    };
    useWallet.getState().noteInterstitialShown(now);
    track("ad_interstitial_shown");
    ad.show().catch(() => done());
  });
}
