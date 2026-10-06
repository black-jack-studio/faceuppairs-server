import { API_URL } from "@/config/env";
import type { RunLog } from "@/game/run";

import type { Credentials } from "./account";

const TIMEOUT_MS = 10_000;
/**
 * How long a game start waits for the server before playing offline (unranked). Truly offline
 * fails at once; this only covers a slow server, which on Render's free plan can take several
 * seconds to wake up (see wakeServer).
 */
export const START_TIMEOUT_MS = 8_000;
const WAKE_TIMEOUT_MS = 60_000;
const WAKE_INTERVAL_MS = 4 * 60_000;

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data?: Record<string, unknown> };

async function request<T>(
  method: string,
  path: string,
  { body, auth, timeoutMs = TIMEOUT_MS }: { body?: unknown; auth?: Credentials | null; timeoutMs?: number } = {},
): Promise<ApiResult<T>> {
  if (!API_URL) return { ok: false, status: 0, error: "not_configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: `Bearer ${auth.id}.${auth.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.ok) return { ok: true, status: res.status, data: data as T };
    return { ok: false, status: res.status, error: data?.error ?? "http_error", data: data ?? undefined };
  } catch {
    // Offline, timed out, or the server is down: callers treat all three the same.
    return { ok: false, status: 0, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}

let lastWake = 0;

/**
 * Render's free plan puts the API to sleep after 15 idle minutes, and waking it takes longer
 * than a game start waits — which made online games start unranked. Pinging it on launch and
 * on the home screen means it's awake by the time a game starts.
 */
export function wakeServer() {
  const now = Date.now();
  if (now - lastWake < WAKE_INTERVAL_MS) return;
  lastWake = now;
  void request("GET", "/health", { timeoutMs: WAKE_TIMEOUT_MS });
}

export type BoardKind = "endless" | "weekly" | "daily";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  ref: string;
  score: number;
  /** Owns Pairs+: a crown next to the name. */
  plus?: boolean;
  isMe: boolean;
}

export interface Leaderboard {
  board: BoardKind;
  endsAt: string | null;
  total: number;
  entries: LeaderboardEntry[];
  me: { rank: number; score: number; name: string } | null;
}

export const api = {
  register: (timeoutMs?: number) => request<Credentials>("POST", "/v1/players", { timeoutMs }),
  me: (auth: Credentials) => request<{ nickname: string | null; displayName: string; moderated: boolean }>("GET", "/v1/players/me", { auth }),
  setNickname: (auth: Credentials, nickname: string) =>
    request<{ nickname: string }>("PUT", "/v1/players/me/nickname", { auth, body: { nickname } }),
  syncPlus: (auth: Credentials) => request<{ plus: boolean }>("POST", "/v1/players/me/plus", { auth }),
  deleteMe: (auth: Credentials) => request<null>("DELETE", "/v1/players/me", { auth }),
  getSave: (auth: Credentials) => request<{ save: unknown; updatedAt: string | null }>("GET", "/v1/players/me/save", { auth }),
  putSave: (auth: Credentials, save: object) =>
    request<{ updatedAt: string }>("PUT", "/v1/players/me/save", { auth, body: { save } }),
  startRun: (auth: Credentials, mode: "endless" | "daily", timeoutMs = START_TIMEOUT_MS) =>
    request<{ runId: string; seed: number; day: string | null }>("POST", "/v1/runs", { auth, body: { mode }, timeoutMs }),
  /** `queued`: sent late from the offline queue, so the server skips its wall-clock check. */
  finishRun: (auth: Credentials, runId: string, log: Pick<RunLog, "boards" | "reviveAt">, queued = false) =>
    request<{ accepted: boolean; score?: number; reason?: string }>("POST", `/v1/runs/${runId}/finish`, {
      auth,
      body: { ...log, queued },
    }),
  leaderboard: (kind: BoardKind, auth: Credentials | null) => request<Leaderboard>("GET", `/v1/leaderboards/${kind}`, { auth }),
  report: (auth: Credentials, ref: string) => request<{ ok: true }>("POST", "/v1/reports", { auth, body: { ref } }),
};
