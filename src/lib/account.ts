import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { api } from "./api";

// Anonymous player account: an id + secret token issued by the server on first launch.
// Written to two places on purpose:
//  - SecureStore: on iOS the Keychain survives an uninstall, so a reinstall keeps the account.
//  - AsyncStorage: on Android SecureStore is wiped on uninstall and excluded from Auto Backup,
//    while AsyncStorage is backed up, so a restore onto a new phone keeps the account.
const KEY = "faceup-pairs.account";
const PENDING_DELETION_KEY = "faceup-pairs.pending-deletion";
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export interface Credentials {
  id: string;
  token: string;
}

let cached: Credentials | null = null;
let registering: Promise<Credentials | null> | null = null;

function parse(raw: string | null): Credentials | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Credentials>;
    return typeof value.id === "string" && typeof value.token === "string" ? { id: value.id, token: value.token } : null;
  } catch {
    return null;
  }
}

async function save(credentials: Credentials) {
  const raw = JSON.stringify(credentials);
  await Promise.all([
    SecureStore.setItemAsync(KEY, raw, SECURE_OPTIONS).catch(() => {}),
    AsyncStorage.setItem(KEY, raw).catch(() => {}),
  ]);
}

export async function getCredentials(): Promise<Credentials | null> {
  if (cached) return cached;
  const secure = await SecureStore.getItemAsync(KEY, SECURE_OPTIONS).catch(() => null);
  const stored = parse(secure) ?? parse(await AsyncStorage.getItem(KEY).catch(() => null));
  if (stored) {
    cached = stored;
    // Re-copy to whichever store lost it (e.g. restored from an Android backup).
    await save(stored);
  }
  return stored;
}

/**
 * Returns the account, creating it on the server the first time. Null when offline.
 * `timeoutMs` keeps a game start snappy when the network is bad (see START_TIMEOUT_MS).
 */
export async function ensureAccount(timeoutMs?: number): Promise<Credentials | null> {
  const existing = await getCredentials();
  if (existing) return existing;
  registering ??= (async () => {
    const res = await api.register(timeoutMs);
    if (!res.ok) return null;
    cached = res.data;
    await save(res.data);
    return res.data;
  })().finally(() => {
    registering = null;
  });
  return registering;
}

/**
 * "Delete my data": forgets the account on this device right away, and deletes it on the
 * server now or — when offline — on the next launch that has a connection.
 */
export async function deleteAccount(): Promise<void> {
  const credentials = await getCredentials();
  cached = null;
  await Promise.all([
    SecureStore.deleteItemAsync(KEY, SECURE_OPTIONS).catch(() => {}),
    AsyncStorage.removeItem(KEY).catch(() => {}),
  ]);
  if (!credentials) return;
  const res = await api.deleteMe(credentials);
  if (!res.ok && res.status !== 401) {
    await AsyncStorage.setItem(PENDING_DELETION_KEY, JSON.stringify(credentials)).catch(() => {});
  }
}

/** Retries a server-side deletion that failed while offline. */
export async function flushPendingDeletion(): Promise<void> {
  const pending = parse(await AsyncStorage.getItem(PENDING_DELETION_KEY).catch(() => null));
  if (!pending) return;
  const res = await api.deleteMe(pending);
  if (res.ok || res.status === 401) await AsyncStorage.removeItem(PENDING_DELETION_KEY).catch(() => {});
}
