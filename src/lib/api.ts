import { API_URL } from "@/config/env";
import type { RunLog } from "@/game/run";

import type { Credentials } from "./account";

const TIMEOUT_MS = 10_000;
/**
 * Starting a game must never keep a player staring at a spinner: past this, the game starts
 * offline (unranked) instead.
 */
export const START_TIMEOUT_MS = 3_000;

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

export type BoardKind = "endless" | "weekly" | "daily";

export interface LeaderboardEntry {
  rank: number;
  name: string;
  ref: string;
  score: number;
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
  deleteMe: (auth: Credentials) => request<null>("DELETE", "/v1/players/me", { auth }),
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
