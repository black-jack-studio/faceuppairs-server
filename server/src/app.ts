import { randomUUID } from "node:crypto";

import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";

import { validateUsername } from "../../src/moderation/usernameFilter";
import { dailySeed, scoreRun, suspicion, type RunLog } from "../../src/game/run";
import { randomSeed } from "../../src/game/rng";

import { boardEndsAt, boardKey, isoWeek, utcDayOf, type BoardKind } from "./boards";
import type { Db } from "./db";
import { renderLegalPage } from "./legal";
import { hashToken, newPublicRef, newToken, placeholderName, RateLimiter, tokenMatches } from "./security";

export const NICKNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Qualified reporters needed before a nickname is hidden pending review. Only accounts at least
 * a day old that have played a ranked game count, so a burst of throwaway accounts can't wipe
 * someone else's name.
 */
export const REPORTS_TO_MODERATE = 5;
export const REPORTER_MIN_AGE_MS = 24 * 60 * 60 * 1000;
/** Far above the longest real run (MAX_FLIPS_PER_RUN flips as JSON). */
const MAX_BODY_BYTES = 256 * 1024;
/**
 * A board of a real game can't average faster than this per flip: it covers seeing, deciding
 * and tapping. Stops a client from compressing its timestamps to farm the speed bonus.
 */
export const MIN_AVERAGE_FLIP_MS = 200;
/** A live submission may not claim to have lasted much less than what the server measured. */
const MAX_UNACCOUNTED_MS = 3 * 60 * 1000;
/** A run must be finished within this long after it was started. */
const RUN_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_FLIPS_PER_RUN = 20_000;
const LEADERBOARD_LIMIT = 100;

interface Player {
  id: string;
  token_hash: string;
  public_ref: string;
  nickname: string | null;
  nickname_changed_at: string | Date | null;
  moderated: boolean;
}

type Env = { Variables: { player: Player } };

export interface AppOptions {
  db: Db;
  now?: () => Date;
  /** Behind Render's proxy the client address is in x-forwarded-for. */
  trustProxy?: boolean;
  /** New accounts per client address per hour (tests raise it: they all share one address). */
  registrationsPerHour?: number;
}

function displayName(p: { nickname: string | null; moderated: boolean; public_ref: string }): string {
  return p.nickname && !p.moderated ? p.nickname : placeholderName(p.public_ref);
}

export function createApp({ db, now = () => new Date(), trustProxy = false, registrationsPerHour = 10 }: AppOptions) {
  const app = new Hono<Env>();
  const ipLimiter = new RateLimiter(120, 60_000);
  const registerLimiter = new RateLimiter(registrationsPerHour, 60 * 60_000);
  const runLimiter = new RateLimiter(60, 60 * 60_000);
  const reportLimiter = new RateLimiter(30, 24 * 60 * 60_000);

  // Render's proxy *appends* the address it saw to x-forwarded-for, so the last entry is the
  // real client; the first one is whatever the client chose to send.
  const clientIp = (c: Context) =>
    (trustProxy ? c.req.header("x-forwarded-for")?.split(",").pop()?.trim() : undefined) || "local";

  app.use("*", secureHeaders());
  app.use("/v1/*", async (c, next) => {
    if (!ipLimiter.allow(clientIp(c))) return c.json({ error: "rate_limited" }, 429);
    await next();
  });
  app.use("/v1/*", bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "too_large" }, 413) }));

  // "Authorization: Bearer <playerId>.<token>"
  const auth = async (c: Context<Env>, next: () => Promise<void>) => {
    const header = c.req.header("authorization") ?? "";
    const [id, token] = header.replace(/^Bearer\s+/i, "").split(".");
    if (!id || !token) return c.json({ error: "unauthorized" }, 401);
    const [player] = await db
      .query<Player>("select * from players where id = $1", [id])
      .catch(() => [] as Player[]);
    if (!player || !tokenMatches(token, player.token_hash)) return c.json({ error: "unauthorized" }, 401);
    c.set("player", player);
    await db.query("update players set last_seen_at = now() where id = $1", [id]);
    await next();
  };

  app.get("/health", (c) => c.json({ ok: true }));

  // Public legal pages: App Store Connect and Play Console need real URLs for these.
  app.get("/legal/:doc", (c) => {
    const html = renderLegalPage(c.req.param("doc"), c.req.query("lang") === "en" ? "en" : "fr");
    return html ? c.html(html) : c.notFound();
  });

  // ── Players ────────────────────────────────────────────────────────────────────────────
  app.post("/v1/players", async (c) => {
    if (!registerLimiter.allow(clientIp(c))) return c.json({ error: "rate_limited" }, 429);
    const id = randomUUID();
    const token = newToken();
    const at = now().toISOString();
    await db.query(
      "insert into players (id, token_hash, public_ref, created_at, last_seen_at) values ($1, $2, $3, $4, $4)",
      [id, hashToken(token), newPublicRef(), at],
    );
    return c.json({ id, token }, 201);
  });

  app.get("/v1/players/me", auth, (c) => {
    const p = c.get("player");
    return c.json({ nickname: p.nickname, displayName: displayName(p), moderated: p.moderated });
  });

  app.put("/v1/players/me/nickname", auth, async (c) => {
    const p = c.get("player");
    const body = await c.req.json<{ nickname?: string }>().catch(() => ({}) as { nickname?: string });
    const nickname = (body.nickname ?? "").trim();
    const error = validateUsername(nickname);
    if (error) return c.json({ error }, 400);
    if (p.nickname === nickname) return c.json({ error: "sameAsCurrent" }, 400);

    // The cooldown applies to changes, never to picking a first nickname (matches the app).
    if (p.nickname && p.nickname_changed_at) {
      const remaining = new Date(p.nickname_changed_at).getTime() + NICKNAME_COOLDOWN_MS - now().getTime();
      if (remaining > 0) return c.json({ error: "cooldown", days: Math.ceil(remaining / 86_400_000) }, 429);
    }

    const [taken] = await db.query("select 1 from players where lower(nickname) = lower($1) and id <> $2", [nickname, p.id]);
    if (taken) return c.json({ error: "taken" }, 409);

    try {
      await db.query("update players set nickname = $1, nickname_changed_at = $2, moderated = false where id = $3", [
        nickname,
        p.nickname ? now().toISOString() : null,
        p.id,
      ]);
    } catch (e) {
      // Two players claiming the same name between the check above and this update.
      if ((e as { code?: string }).code === "23505") return c.json({ error: "taken" }, 409);
      throw e;
    }
    // A new nickname starts clean: old reports were about the old name.
    await db.query("delete from reports where target_id = $1", [p.id]);
    return c.json({ nickname });
  });

  // Apple 5.1.1(v) / Google Play: deleting from the app deletes everything server-side.
  app.delete("/v1/players/me", auth, async (c) => {
    await db.query("delete from players where id = $1", [c.get("player").id]);
    return c.body(null, 204);
  });

  // ── Runs ───────────────────────────────────────────────────────────────────────────────
  app.post("/v1/runs", auth, async (c) => {
    const p = c.get("player");
    if (!runLimiter.allow(p.id)) return c.json({ error: "rate_limited" }, 429);
    const body = await c.req.json<{ mode?: string }>().catch(() => ({}) as { mode?: string });
    const mode = body.mode === "daily" ? "daily" : body.mode === "endless" ? "endless" : null;
    if (!mode) return c.json({ error: "bad_mode" }, 400);

    const today = utcDayOf(now());
    if (mode === "daily") {
      const [played] = await db.query<{ score: number }>(
        "select score from runs where player_id = $1 and mode = 'daily' and day = $2 and status = 'accepted'",
        [p.id, today],
      );
      // The score lets the app show "already played" on a new phone or after a reinstall.
      if (played) return c.json({ error: "daily_already_played", score: played.score }, 409);
    }
    const seed = mode === "daily" ? dailySeed(today) : randomSeed();
    const id = randomUUID();
    await db.query("insert into runs (id, player_id, mode, seed, day, started_at) values ($1, $2, $3, $4, $5, $6)", [
      id,
      p.id,
      mode,
      seed,
      mode === "daily" ? today : null,
      now().toISOString(),
    ]);
    return c.json({ runId: id, seed, day: mode === "daily" ? today : null }, 201);
  });

  app.post("/v1/runs/:id/finish", auth, async (c) => {
    const p = c.get("player");
    const [run] = await db.query<{ id: string; mode: string; seed: string | number; day: string | Date | null; started_at: string | Date; status: string }>(
      "select id, mode, seed, day, started_at, status from runs where id = $1 and player_id = $2",
      [c.req.param("id"), p.id],
    );
    if (!run) return c.json({ error: "not_found" }, 404);
    if (run.status !== "started") return c.json({ error: "already_finished" }, 409);

    const finishedAt = now();
    if (finishedAt.getTime() - new Date(run.started_at).getTime() > RUN_TTL_MS) {
      await reject(run.id, "expired");
      return c.json({ accepted: false, reason: "expired" });
    }

    const body = await c.req.json<{ boards?: unknown; reviveAt?: unknown; queued?: unknown }>().catch(() => null);
    const log = parseRunLog(Number(run.seed), body);
    if (!log) {
      await reject(run.id, "malformed");
      return c.json({ error: "malformed" }, 400);
    }

    const result = scoreRun(log);
    const serverElapsedMs = finishedAt.getTime() - new Date(run.started_at).getTime();
    const reason = result.valid
      ? (suspicion(log, result) ?? timingSuspicion(log, result.durationMs, serverElapsedMs, body?.queued === true))
      : (result.reason ?? "invalid");
    if (reason) {
      await reject(run.id, reason);
      return c.json({ accepted: false, reason });
    }

    try {
      await db.query("update runs set status = 'accepted', finished_at = $1, score = $2 where id = $3", [
        finishedAt.toISOString(),
        result.score,
        run.id,
      ]);
    } catch (e) {
      // Two daily runs finishing at once: the "one daily per day" index lets only one through.
      if ((e as { code?: string }).code === "23505") {
        await reject(run.id, "daily_already_played");
        return c.json({ accepted: false, reason: "daily_already_played" });
      }
      throw e;
    }

    const boards =
      run.mode === "daily"
        ? [`daily:${typeof run.day === "string" ? run.day.slice(0, 10) : utcDayOf(run.day as Date)}`]
        : ["endless", `week:${isoWeek(finishedAt)}`];
    for (const board of boards) {
      await db.query(
        `insert into best_scores (board, player_id, score, achieved_at) values ($1, $2, $3, $4)
         on conflict (board, player_id) do update set score = excluded.score, achieved_at = excluded.achieved_at
         where excluded.score > best_scores.score`,
        [board, p.id, result.score, finishedAt.toISOString()],
      );
    }
    return c.json({ accepted: true, score: result.score, boardsCleared: result.boardsCleared });
  });

  async function reject(runId: string, reason: string) {
    await db.query("update runs set status = 'rejected', finished_at = now(), reject_reason = $1 where id = $2", [
      reason,
      runId,
    ]);
  }

  // ── Leaderboards ───────────────────────────────────────────────────────────────────────
  app.get("/v1/leaderboards/:kind", async (c) => {
    const kind = c.req.param("kind") as BoardKind;
    if (!["endless", "weekly", "daily"].includes(kind)) return c.json({ error: "bad_board" }, 400);
    const at = now();
    const board = boardKey(kind, at);

    const top = await db.query<{ score: number; public_ref: string; nickname: string | null; moderated: boolean; player_id: string }>(
      `select b.score, b.player_id, p.public_ref, p.nickname, p.moderated
         from best_scores b join players p on p.id = b.player_id
        where b.board = $1
        order by b.score desc, b.achieved_at asc
        limit $2`,
      [board, LEADERBOARD_LIMIT],
    );

    // "Me" is optional: the leaderboard is public, the caller's own rank needs their token.
    // `name` lets the app show the player's own row below the top 100.
    let me: { rank: number; score: number; name: string } | null = null;
    let meId: string | null = null;
    const header = c.req.header("authorization");
    if (header) {
      const [id, token] = header.replace(/^Bearer\s+/i, "").split(".");
      const [player] = await db.query<Player>("select * from players where id = $1", [id]).catch(() => [] as Player[]);
      if (player && token && tokenMatches(token, player.token_hash)) {
        meId = player.id;
        const [mine] = await db.query<{ score: number; achieved_at: string | Date }>(
          "select score, achieved_at from best_scores where board = $1 and player_id = $2",
          [board, player.id],
        );
        if (mine) {
          const [ahead] = await db.query<{ n: string | number }>(
            `select count(*) as n from best_scores
              where board = $1 and (score > $2 or (score = $2 and achieved_at < $3))`,
            [board, mine.score, new Date(mine.achieved_at).toISOString()],
          );
          me = { rank: Number(ahead.n) + 1, score: mine.score, name: displayName(player) };
        }
      }
    }

    const [{ n: total }] = await db.query<{ n: string | number }>(
      "select count(*) as n from best_scores where board = $1",
      [board],
    );

    return c.json({
      board: kind,
      endsAt: boardEndsAt(kind, at),
      total: Number(total),
      entries: top.map((row, i) => ({
        rank: i + 1,
        name: displayName(row),
        ref: row.public_ref,
        score: row.score,
        isMe: row.player_id === meId,
      })),
      me,
    });
  });

  // ── Moderation ─────────────────────────────────────────────────────────────────────────
  app.post("/v1/reports", auth, async (c) => {
    const p = c.get("player");
    if (!reportLimiter.allow(p.id)) return c.json({ error: "rate_limited" }, 429);
    const body = await c.req.json<{ ref?: string }>().catch(() => ({}) as { ref?: string });
    const [target] = await db.query<{ id: string }>("select id from players where public_ref = $1", [body.ref ?? ""]);
    if (!target) return c.json({ error: "not_found" }, 404);
    if (target.id === p.id) return c.json({ error: "self" }, 400);

    await db.query(
      "insert into reports (reporter_id, target_id) values ($1, $2) on conflict do nothing",
      [p.id, target.id],
    );
    // Every report is kept for review, but only established players count toward the automatic
    // rename: account older than a day, at least one accepted ranked game.
    const [{ n }] = await db.query<{ n: string | number }>(
      `select count(*) as n from reports r join players rp on rp.id = r.reporter_id
        where r.target_id = $1
          and rp.created_at <= $2
          and exists (select 1 from runs where runs.player_id = rp.id and runs.status = 'accepted')`,
      [target.id, new Date(now().getTime() - REPORTER_MIN_AGE_MS).toISOString()],
    );
    if (Number(n) >= REPORTS_TO_MODERATE) {
      await db.query("update players set moderated = true where id = $1", [target.id]);
    }
    return c.json({ ok: true });
  });

  return app;
}

/**
 * Timestamps come from the phone, so they are checked against what a person can do: no board
 * played faster than MIN_AVERAGE_FLIP_MS per flip on average, and — when the run is sent as soon
 * as it ends — no claim of having played minutes less than the time the server saw pass.
 * Runs queued offline are sent late, so only the first check applies to them.
 */
export function timingSuspicion(log: RunLog, durationMs: number, serverElapsedMs: number, queued: boolean): string | null {
  for (const board of log.boards) {
    if (board.length < 4) continue;
    const span = board[board.length - 1].t - board[0].t;
    if (span / (board.length - 1) < MIN_AVERAGE_FLIP_MS) return "inhuman pace";
  }
  if (!queued && durationMs < serverElapsedMs - MAX_UNACCOUNTED_MS) return "time mismatch";
  return null;
}

function parseRunLog(seed: number, body: { boards?: unknown; reviveAt?: unknown } | null): RunLog | null {
  if (!body || !Array.isArray(body.boards)) return null;
  let flips = 0;
  const boards: RunLog["boards"] = [];
  for (const board of body.boards) {
    if (!Array.isArray(board)) return null;
    const entries = [];
    for (const e of board) {
      if (typeof e !== "object" || e === null) return null;
      const { index, t } = e as { index?: unknown; t?: unknown };
      if (!Number.isInteger(index) || typeof t !== "number" || !Number.isFinite(t)) return null;
      entries.push({ index: index as number, t });
      if (++flips > MAX_FLIPS_PER_RUN) return null;
    }
    boards.push(entries);
  }
  const reviveAt = body.reviveAt === null || body.reviveAt === undefined ? null : body.reviveAt;
  if (reviveAt !== null && !Number.isInteger(reviveAt)) return null;
  return { seed, boards, reviveAt: reviveAt as number | null };
}
