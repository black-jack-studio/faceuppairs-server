import { validateUsername, type UsernameError } from "@/moderation/usernameFilter";
import { useProgress } from "@/store/progress";

import { ensureAccount } from "./account";
import { api } from "./api";

export type NicknameError = UsernameError | "sameAsCurrent" | "taken" | "cooldown";

export type NicknameResult = { ok: true } | { ok: false; error: NicknameError; days?: number };

/**
 * Validates and saves a nickname: on the server when reachable (it owns uniqueness and the
 * cooldown), otherwise on the device only, synced on the next launch with a connection.
 */
export async function saveNickname(raw: string): Promise<NicknameResult> {
  const name = raw.trim();
  const invalid = validateUsername(name);
  if (invalid) return { ok: false, error: invalid };
  const { nickname: current, setNickname, setNicknamePendingSync } = useProgress.getState();
  if (name === current) return { ok: false, error: "sameAsCurrent" };

  const credentials = await ensureAccount();
  if (credentials) {
    const res = await api.setNickname(credentials, name);
    if (res.ok) {
      setNickname(name);
      setNicknamePendingSync(false);
      return { ok: true };
    }
    if (res.status !== 0 && res.status < 500) {
      const error = (res.error as NicknameError) ?? "notAllowed";
      return { ok: false, error, days: typeof res.data?.days === "number" ? res.data.days : undefined };
    }
  }
  setNickname(name);
  setNicknamePendingSync(true);
  return { ok: true };
}

/** Pushes a nickname chosen while offline. A name taken meanwhile is re-asked on the home screen. */
export async function flushNickname(): Promise<void> {
  const { nickname, nicknamePendingSync, setNicknamePendingSync, rejectNickname } = useProgress.getState();
  if (!nickname || !nicknamePendingSync) return;
  const credentials = await ensureAccount();
  if (!credentials) return;
  const res = await api.setNickname(credentials, nickname);
  if (res.ok || res.error === "sameAsCurrent") setNicknamePendingSync(false);
  else if (res.status === 409 || res.status === 400) rejectNickname();
}
