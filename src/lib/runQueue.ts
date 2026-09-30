import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RunLog } from "@/game/run";

import { getCredentials } from "./account";
import { api } from "./api";

// Finished ranked runs waiting for a connection. The server accepts a run up to 6 h after it
// started, so a run finished in the metro still counts once the phone is back online.
const KEY = "faceup-pairs.pending-runs";

interface PendingRun {
  runId: string;
  log: Pick<RunLog, "boards" | "reviveAt">;
}

async function read(): Promise<PendingRun[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]") as PendingRun[];
  } catch {
    return [];
  }
}

async function write(runs: PendingRun[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(runs)).catch(() => {});
}

export type SubmitOutcome = { status: "accepted"; score: number } | { status: "rejected"; reason: string } | { status: "queued" };

export async function submitRun(runId: string, log: PendingRun["log"]): Promise<SubmitOutcome> {
  const credentials = await getCredentials();
  if (!credentials) return { status: "rejected", reason: "no_account" };
  const res = await api.finishRun(credentials, runId, log);
  if (res.ok) {
    return res.data.accepted
      ? { status: "accepted", score: res.data.score ?? 0 }
      : { status: "rejected", reason: res.data.reason ?? "rejected" };
  }
  if (res.status === 0 || res.status >= 500) {
    await write([...(await read()), { runId, log }]);
    return { status: "queued" };
  }
  return { status: "rejected", reason: res.error };
}

/** Sends queued runs; keeps only those that still fail for network reasons. */
export async function flushRuns(): Promise<void> {
  const pending = await read();
  if (pending.length === 0) return;
  const credentials = await getCredentials();
  if (!credentials) return;
  const stillPending: PendingRun[] = [];
  for (const run of pending) {
    const res = await api.finishRun(credentials, run.runId, run.log, true);
    if (!res.ok && (res.status === 0 || res.status >= 500)) stillPending.push(run);
  }
  await write(stillPending);
}

export async function clearQueuedRuns() {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
