import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { partnerOf, type FlipLogEntry, type GameState } from "../../src/game/engine";
import { runBoard } from "../../src/game/run";
import { createApp, NICKNAME_COOLDOWN_MS, REPORTS_TO_MODERATE } from "../src/app";
import { createLocalDb, migrate, type Db } from "../src/db";

let db: Db;
let clock = new Date("2026-09-30T12:00:00Z");
let app: ReturnType<typeof createApp>;

before(async () => {
  db = await createLocalDb();
  await migrate(db);
});
after(async () => db.close());
beforeEach(async () => {
  await db.exec("truncate players, runs, best_scores, reports cascade");
  clock = new Date("2026-09-30T12:00:00Z");
  app = createApp({ db, now: () => clock, registrationsPerHour: 1000 });
});

async function call(method: string, path: string, opts: { auth?: string; body?: unknown } = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.auth ? { authorization: `Bearer ${opts.auth}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function newPlayer(nickname?: string): Promise<string> {
  const { status, body } = await call("POST", "/v1/players");
  assert.equal(status, 201, "registration failed");
  const auth = `${body.id}.${body.token}`;
  if (nickname) assert.equal((await call("PUT", "/v1/players/me/nickname", { auth, body: { nickname } })).status, 200);
  return auth;
}

/** A plausible human game: blind first flips, then remembered pairs. Clears `boards` boards. */
function playRun(seed: number, boards: number): FlipLogEntry[][] {
  const out: FlipLogEntry[][] = [];
  let t = 1000;
  for (let b = 0; b < boards; b++) {
    const state: GameState = runBoard(seed, b);
    const flips: FlipLogEntry[] = [];
    // Perfect memory, no knowledge of the deck: a known pair first, otherwise the next unseen
    // card, then its partner if seen, else another unseen card. Never a memory error.
    const seen = new Set<number>();
    const matched = new Set<number>();
    const nextUnseen = (exclude: number) =>
      state.icons.findIndex((_, i) => !seen.has(i) && !matched.has(i) && i !== exclude);
    while (matched.size < state.icons.length) {
      const known = [...seen].find((i) => !matched.has(i) && seen.has(partnerOf(state, i)));
      let a: number;
      let c: number;
      if (known !== undefined) {
        a = known;
        c = partnerOf(state, known);
      } else {
        a = nextUnseen(-1);
        const p = partnerOf(state, a);
        c = seen.has(p) ? p : nextUnseen(a);
      }
      seen.add(a).add(c);
      flips.push({ index: a, t: (t += 400) }, { index: c, t: (t += 400) });
      if (state.icons[a] === state.icons[c]) matched.add(a).add(c);
      else t += 900;
    }
    out.push(flips);
    t += 1500;
  }
  return out;
}

describe("players and nicknames", () => {
  it("registers anonymously and rejects bad tokens", async () => {
    const auth = await newPlayer();
    assert.equal((await call("GET", "/v1/players/me", { auth })).status, 200);
    const [id] = auth.split(".");
    assert.equal((await call("GET", "/v1/players/me", { auth: `${id}.wrong` })).status, 401);
    assert.equal((await call("GET", "/v1/players/me")).status, 401);
  });

  it("applies the same filter as the app, case-insensitive uniqueness, and the change cooldown", async () => {
    const a = await newPlayer();
    assert.deepEqual((await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "salope" } })).body, {
      error: "notAllowed",
    });
    assert.equal((await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "admin" } })).body.error, "reserved");
    assert.equal((await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "Stan" } })).status, 200);

    const b = await newPlayer();
    assert.equal((await call("PUT", "/v1/players/me/nickname", { auth: b, body: { nickname: "STAN" } })).status, 409);

    // First pick has no cooldown; a change starts it.
    assert.equal((await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "Stan2" } })).status, 200);
    const blocked = await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "Stan3" } });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.days, 7);
    clock = new Date(clock.getTime() + NICKNAME_COOLDOWN_MS + 1000);
    assert.equal((await call("PUT", "/v1/players/me/nickname", { auth: a, body: { nickname: "Stan3" } })).status, 200);
  });

  it("deletes everything on request", async () => {
    const a = await newPlayer("Gone");
    assert.equal((await call("DELETE", "/v1/players/me", { auth: a })).status, 204);
    assert.equal((await call("GET", "/v1/players/me", { auth: a })).status, 401);
    const [row] = await db.query("select count(*)::int as n from players");
    assert.equal((row as { n: number }).n, 0);
  });
});

describe("runs and leaderboards", () => {
  it("accepts an honest run, recomputes its score, and ranks it", async () => {
    const a = await newPlayer("Alice");
    const b = await newPlayer("Bob");

    const runA = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    const finishA = await call("POST", `/v1/runs/${runA.runId}/finish`, {
      auth: a,
      body: { boards: playRun(runA.seed, 3), reviveAt: null },
    });
    assert.equal(finishA.body.accepted, true, JSON.stringify(finishA.body));
    assert.equal(finishA.body.boardsCleared, 3);

    const runB = (await call("POST", "/v1/runs", { auth: b, body: { mode: "endless" } })).body;
    const finishB = await call("POST", `/v1/runs/${runB.runId}/finish`, {
      auth: b,
      body: { boards: playRun(runB.seed, 1), reviveAt: null },
    });
    assert.equal(finishB.body.accepted, true);

    const board = await call("GET", "/v1/leaderboards/endless", { auth: b });
    assert.equal(board.body.total, 2);
    assert.equal(board.body.entries[0].name, "Alice");
    assert.equal(board.body.entries[1].isMe, true);
    assert.deepEqual(board.body.me, { rank: 2, score: finishB.body.score, name: "Bob" });
    assert.ok(!("id" in board.body.entries[0]), "player ids are never exposed");

    const weekly = await call("GET", "/v1/leaderboards/weekly");
    assert.equal(weekly.body.total, 2);
    assert.equal(weekly.body.me, null);
  });

  it("keeps only the best score and refuses to finish a run twice", async () => {
    const a = await newPlayer("Alice");
    const run1 = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    const best = (await call("POST", `/v1/runs/${run1.runId}/finish`, { auth: a, body: { boards: playRun(run1.seed, 2), reviveAt: null } })).body;
    assert.equal(
      (await call("POST", `/v1/runs/${run1.runId}/finish`, { auth: a, body: { boards: [], reviveAt: null } })).status,
      409,
    );
    const run2 = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    await call("POST", `/v1/runs/${run2.runId}/finish`, { auth: a, body: { boards: playRun(run2.seed, 1), reviveAt: null } });
    const board = await call("GET", "/v1/leaderboards/endless", { auth: a });
    assert.equal(board.body.me.score, best.score);
  });

  it("rejects a run played with knowledge of the deck", async () => {
    const a = await newPlayer("Cheater");
    const run = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    let t = 0;
    const boards = [0, 1, 2].map((b) => {
      const state = runBoard(run.seed, b);
      const flips: FlipLogEntry[] = [];
      const done = new Set<number>();
      for (let i = 0; i < state.icons.length; i++) {
        if (done.has(i)) continue;
        const j = partnerOf(state, i);
        done.add(i).add(j);
        flips.push({ index: i, t: (t += 300) }, { index: j, t: (t += 300) });
      }
      return flips;
    });
    const res = await call("POST", `/v1/runs/${run.runId}/finish`, { auth: a, body: { boards, reviveAt: null } });
    assert.deepEqual(res.body, { accepted: false, reason: "impossible luck" });
    assert.equal((await call("GET", "/v1/leaderboards/endless")).body.total, 0);
  });

  it("gives everyone the same daily seed and one ranked attempt per day", async () => {
    const a = await newPlayer("Alice");
    const b = await newPlayer("Bob");
    const runA = (await call("POST", "/v1/runs", { auth: a, body: { mode: "daily" } })).body;
    const runB = (await call("POST", "/v1/runs", { auth: b, body: { mode: "daily" } })).body;
    assert.equal(runA.seed, runB.seed);
    await call("POST", `/v1/runs/${runA.runId}/finish`, { auth: a, body: { boards: playRun(runA.seed, 1), reviveAt: null } });
    assert.equal((await call("POST", "/v1/runs", { auth: a, body: { mode: "daily" } })).status, 409);
    assert.equal((await call("GET", "/v1/leaderboards/daily")).body.total, 1);

    clock = new Date("2026-10-01T09:00:00Z");
    const tomorrow = (await call("POST", "/v1/runs", { auth: a, body: { mode: "daily" } })).body;
    assert.notEqual(tomorrow.seed, runA.seed);
  });
});

describe("moderation", () => {
  it("hides a nickname after enough distinct reports", async () => {
    const target = await newPlayer("Rude_Name");
    const run = (await call("POST", "/v1/runs", { auth: target, body: { mode: "endless" } })).body;
    await call("POST", `/v1/runs/${run.runId}/finish`, { auth: target, body: { boards: playRun(run.seed, 1), reviveAt: null } });
    const ref = (await call("GET", "/v1/leaderboards/endless")).body.entries[0].ref;
    const nameOnBoard = async () =>
      (await call("GET", "/v1/leaderboards/endless")).body.entries.find((e: { ref: string }) => e.ref === ref).name;

    // Brand-new throwaway accounts don't count, however many there are.
    for (let k = 0; k < REPORTS_TO_MODERATE + 2; k++) {
      const throwaway = await newPlayer();
      assert.equal((await call("POST", "/v1/reports", { auth: throwaway, body: { ref } })).status, 200);
    }
    assert.equal(await nameOnBoard(), "Rude_Name");

    // Established players (a ranked game, a day old) do.
    const reporters: string[] = [];
    for (let k = 0; k < REPORTS_TO_MODERATE; k++) {
      const reporter = await newPlayer();
      const r = (await call("POST", "/v1/runs", { auth: reporter, body: { mode: "endless" } })).body;
      await call("POST", `/v1/runs/${r.runId}/finish`, { auth: reporter, body: { boards: playRun(r.seed, 1), reviveAt: null } });
      reporters.push(reporter);
    }
    clock = new Date(clock.getTime() + 25 * 60 * 60 * 1000);
    for (const reporter of reporters) {
      await call("POST", "/v1/reports", { auth: reporter, body: { ref } });
      // Reporting twice counts once.
      await call("POST", "/v1/reports", { auth: reporter, body: { ref } });
    }
    assert.match(await nameOnBoard(), /^Joueur\d{4}$/);
    assert.equal((await call("POST", "/v1/reports", { auth: target, body: { ref } })).status, 400);
  });
});

describe("abuse protection", () => {
  it("refuses oversized bodies before reading them", async () => {
    const a = await newPlayer("Alice");
    const run = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    const huge = { boards: [Array.from({ length: 30_000 }, (_, i) => ({ index: 0, t: i }))], reviveAt: null };
    const res = await call("POST", `/v1/runs/${run.runId}/finish`, { auth: a, body: huge });
    assert.equal(res.status, 413);
  });

  it("rejects compressed timestamps and runs claiming far less time than the server saw", async () => {
    const a = await newPlayer("Alice");
    const run = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    // Same game, every timestamp divided by 5: plausible order, impossible pace.
    const fast = playRun(run.seed, 1).map((b) => b.map((f) => ({ ...f, t: Math.round(f.t / 5) })));
    assert.deepEqual((await call("POST", `/v1/runs/${run.runId}/finish`, { auth: a, body: { boards: fast, reviveAt: null } })).body, {
      accepted: false,
      reason: "inhuman pace",
    });

    const run2 = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    clock = new Date(clock.getTime() + 30 * 60 * 1000);
    const res = await call("POST", `/v1/runs/${run2.runId}/finish`, { auth: a, body: { boards: playRun(run2.seed, 1), reviveAt: null } });
    assert.equal(res.body.reason, "time mismatch");

    // The same late run, sent from the offline queue, is fine.
    const run3 = (await call("POST", "/v1/runs", { auth: a, body: { mode: "endless" } })).body;
    clock = new Date(clock.getTime() + 30 * 60 * 1000);
    const queued = await call("POST", `/v1/runs/${run3.runId}/finish`, {
      auth: a,
      body: { boards: playRun(run3.seed, 1), reviveAt: null, queued: true },
    });
    assert.equal(queued.body.accepted, true);
  });

  it("returns the day's score when the daily was already played, and the player's own row", async () => {
    const a = await newPlayer("Alice");
    const run = (await call("POST", "/v1/runs", { auth: a, body: { mode: "daily" } })).body;
    const done = (await call("POST", `/v1/runs/${run.runId}/finish`, { auth: a, body: { boards: playRun(run.seed, 1), reviveAt: null } })).body;
    const again = await call("POST", "/v1/runs", { auth: a, body: { mode: "daily" } });
    assert.equal(again.status, 409);
    assert.deepEqual(again.body, { error: "daily_already_played", score: done.score });
    const board = await call("GET", "/v1/leaderboards/daily", { auth: a });
    assert.deepEqual(board.body.me, { rank: 1, score: done.score, name: "Alice" });
  });
});

describe("public pages", () => {
  it("serves the privacy policy from the app's own texts", async () => {
    const res = await app.request("/legal/privacy?lang=en");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Privacy Policy/);
    assert.match(html, /help\.faceup@gmail\.com/);
    assert.equal((await app.request("/legal/nope")).status, 404);
  });
});
