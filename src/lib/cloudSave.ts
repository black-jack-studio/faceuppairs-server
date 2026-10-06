import AsyncStorage from "@react-native-async-storage/async-storage";

import { useProgress } from "@/store/progress";
import { useWallet } from "@/store/wallet";

import { getCredentials, type Credentials } from "./account";
import { api } from "./api";
import { parseSave, pickLike, SAVE_VERSION, shouldRestore, type SaveData } from "./saveFormat";

// Cloud save. Progress and wallet live in AsyncStorage, which iOS wipes on uninstall, while the
// account survives in the Keychain (account.ts). The server keeps a copy of the save tied to that
// account: a reinstall, or a new phone with the Keychain synced, gets everything back.
//
// Nothing is sent before this install has read the server's copy once (CHECKED_KEY): a fresh
// install must never overwrite a real save with its starting wallet.

/** The account whose server save this install already read. Wiped with the app, on purpose. */
const CHECKED_KEY = "faceup-pairs.cloud-save-checked";
const PUSH_DELAY_MS = 3_000;

type ProgressState = ReturnType<typeof useProgress.getState>;
type WalletState = ReturnType<typeof useWallet.getState>;

// What the save carries, with the expected shape of each field. Left out: purchases (RevenueCat
// gives them back), the nickname (the server already has it), and per-device state (ad pacing,
// celebrations not yet shown).
const PROGRESS_FIELDS: Pick<ProgressState, "stars" | "bestEndless" | "endlessRuns" | "hiddenRefs" | "reviewRequested"> = {
  stars: {},
  bestEndless: 0,
  endlessRuns: 0,
  hiddenRefs: [],
  reviewRequested: false,
};

const WALLET_FIELDS: Pick<
  WalletState,
  | "coins"
  | "boosters"
  | "streak"
  | "ownedPacks"
  | "activePack"
  | "hasPurchased"
  | "daily"
  | "ownedAppIcons"
  | "playedDay"
  | "secretClaimDay"
  | "freeCoins"
> = {
  coins: 0,
  boosters: { peek: 0, hint: 0 },
  streak: { lastClaimDay: null, streak: 0 },
  ownedPacks: [],
  activePack: "",
  hasPurchased: false,
  daily: { day: null, played: false, bestScore: 0 },
  ownedAppIcons: [],
  playedDay: null,
  secretClaimDay: null,
  freeCoins: { day: null, count: 0 },
};

function snapshot(): SaveData {
  return {
    version: SAVE_VERSION,
    progress: pickLike(useProgress.getState(), PROGRESS_FIELDS),
    wallet: pickLike(useWallet.getState(), WALLET_FIELDS),
  };
}

let checkedFor: string | null | undefined;
let lastSent: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> | null = null;

async function readChecked(): Promise<string | null> {
  if (checkedFor === undefined) checkedFor = await AsyncStorage.getItem(CHECKED_KEY).catch(() => null);
  return checkedFor;
}

async function markChecked(id: string) {
  checkedFor = id;
  await AsyncStorage.setItem(CHECKED_KEY, id).catch(() => {});
}

function restore(save: SaveData) {
  useProgress.setState(pickLike(save.progress, PROGRESS_FIELDS));
  useWallet.setState(pickLike(save.wallet, WALLET_FIELDS));
}

/** The nickname lives on the server; only the device's copy was lost with the app. */
async function restoreNickname(credentials: Credentials) {
  if (useProgress.getState().nickname !== null) return;
  const res = await api.me(credentials);
  if (!res.ok || !res.data.nickname) return;
  useProgress.setState({
    nickname: res.data.nickname,
    nicknamePendingSync: false,
    nicknamePrompted: true,
    nicknameTakenNotice: false,
  });
}

/**
 * Called with every server sync (launch, back to foreground). The first time on this install it
 * reads the server's save and takes it if it got further; after that it only sends changes.
 */
export async function syncCloudSave(credentials: Credentials): Promise<void> {
  if ((await readChecked()) !== credentials.id) {
    const res = await api.getSave(credentials);
    // Offline or server down: try again on the next sync, and send nothing meanwhile.
    if (!res.ok) return;
    const remote = parseSave(res.data.save);
    if (remote && shouldRestore(snapshot(), remote)) restore(remote);
    await restoreNickname(credentials);
    await markChecked(credentials.id);
  }
  await flushCloudSave();
}

/** Sends the save now if it changed since the last successful send. */
export async function flushCloudSave(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  // One send at a time; a change made meanwhile is picked up by the next one.
  if (pushing) await pushing;
  pushing = (async () => {
    const credentials = await getCredentials();
    if (!credentials || (await readChecked()) !== credentials.id) return;
    const save = snapshot();
    const json = JSON.stringify(save);
    if (json === lastSent) return;
    const res = await api.putSave(credentials, save);
    if (res.ok) lastSent = json;
  })().finally(() => {
    pushing = null;
  });
  await pushing;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flushCloudSave(), PUSH_DELAY_MS);
}

/** Sends the save a few seconds after any change (a finished level, coins spent, a purchase…). */
export function startCloudSave(): () => void {
  const unsubscribers = [useProgress.subscribe(schedulePush), useWallet.subscribe(schedulePush)];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
