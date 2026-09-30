import { partnerOf, type FlipLogEntry, type GameState } from "../engine";
import { boardClearPoints, pairPoints, STARTING_LIVES } from "../endless";
import { dailySeed, runBoard, scoreRun, suspicion, utcDay, type RunLog } from "../run";

/** Plays a board perfectly from full knowledge (what a cheater with the seed would do). */
function perfectBoard(state: GameState, start: number, step = 400): FlipLogEntry[] {
  const log: FlipLogEntry[] = [];
  const done = new Set<number>();
  let t = start;
  for (let i = 0; i < state.icons.length; i++) {
    if (done.has(i)) continue;
    const j = partnerOf(state, i);
    done.add(i).add(j);
    log.push({ index: i, t: (t += step) }, { index: j, t: (t += step) });
  }
  return log;
}

/**
 * A blind miss that reveals card A's partner, then `errors` knowing misses (A with the wrong
 * card while its partner is known), each costing a life.
 */
function losingFlips(state: GameState, errors: number): FlipLogEntry[] {
  const a = 0;
  const partner = partnerOf(state, a);
  const other = state.icons.findIndex((icon, i) => i !== a && i !== partner && icon !== state.icons[a]);
  const flips: FlipLogEntry[] = [
    { index: partner, t: 100 },
    { index: other, t: 500 },
  ];
  let t = 500;
  for (let k = 0; k < errors; k++) {
    flips.push({ index: a, t: (t += 800) }, { index: other, t: (t += 400) });
  }
  return flips;
}

describe("scoreRun", () => {
  it("scores a cleared board like the client does", () => {
    const board = runBoard(7, 0);
    const flips = perfectBoard(board, 1000);
    const result = scoreRun({ seed: 7, boards: [flips], reviveAt: null });
    let expected = 0;
    for (let streak = 1; streak <= 8; streak++) expected += pairPoints(streak);
    expected += boardClearPoints(8, flips[flips.length - 1].t - flips[0].t);
    expect(result.valid).toBe(true);
    expect(result.score).toBe(expected);
    expect(result.boardsCleared).toBe(1);
  });

  it("rejects flips on matched cards and out-of-order times", () => {
    const board = runBoard(3, 0);
    const flips = perfectBoard(board, 0);
    expect(scoreRun({ seed: 3, boards: [[...flips, flips[0]]], reviveAt: null }).valid).toBe(false);
    const swapped = [flips[1], flips[0], ...flips.slice(2)];
    expect(scoreRun({ seed: 3, boards: [swapped], reviveAt: null }).valid).toBe(false);
  });

  it("rejects a second board after an unfinished one", () => {
    const board = runBoard(3, 0);
    const flips = perfectBoard(board, 0);
    const result = scoreRun({ seed: 3, boards: [flips.slice(0, 4), perfectBoard(runBoard(3, 1), 99999)], reviveAt: null });
    expect(result.valid).toBe(false);
  });

  it("ends the run on the last life, and allows exactly one revive at that point", () => {
    const board = runBoard(11, 0);
    const flips = losingFlips(board, STARTING_LIVES);
    const lost = scoreRun({ seed: 11, boards: [flips], reviveAt: null });
    expect(lost.valid).toBe(true);
    expect(lost.lost).toBe(true);
    expect(lost.livesLeft).toBe(0);

    const revived = scoreRun({ seed: 11, boards: [flips], reviveAt: flips.length });
    expect(revived.valid).toBe(true);
    expect(revived.lost).toBe(false);
    expect(revived.livesLeft).toBe(1);

    expect(scoreRun({ seed: 11, boards: [flips.slice(0, 4)], reviveAt: 4 }).valid).toBe(false);
  });
});

/**
 * An honest player with a perfect memory but no knowledge of the deck: flips an unseen card,
 * then its partner if already seen, otherwise another unseen card.
 */
function honestBoard(state: GameState, start: number, rand: () => number): FlipLogEntry[] {
  const log: FlipLogEntry[] = [];
  const seen = new Set<number>();
  const matched = new Set<number>();
  let t = start;
  const pickUnseen = (exclude: number) => {
    const pool = state.icons.map((_, i) => i).filter((i) => !seen.has(i) && !matched.has(i) && i !== exclude);
    return pool[Math.floor(rand() * pool.length)];
  };
  while (matched.size < state.icons.length) {
    // A known pair (both seen, unmatched) is taken first.
    const known = [...seen].find((i) => !matched.has(i) && seen.has(partnerOf(state, i)));
    let a: number;
    let b: number;
    if (known !== undefined) {
      a = known;
      b = partnerOf(state, known);
    } else {
      a = pickUnseen(-1);
      seen.add(a);
      const p = partnerOf(state, a);
      b = seen.has(p) ? p : pickUnseen(a);
    }
    seen.add(a).add(b);
    log.push({ index: a, t: (t += 350) }, { index: b, t: (t += 350) });
    if (state.icons[a] === state.icons[b]) matched.add(a).add(b);
    else t += 900;
  }
  return log;
}

describe("suspicion", () => {
  it("never flags an honest player, even one with a perfect memory", () => {
    let flagged = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let x = seed * 9301 + 49297;
      const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      let t = 0;
      const boards = [0, 1, 2, 3, 4].map((b) => {
        const flips = honestBoard(runBoard(seed, b), t, rand);
        t = flips[flips.length - 1].t + 1000;
        return flips;
      });
      const log: RunLog = { seed, boards, reviveAt: null };
      const result = scoreRun(log);
      expect(result.valid).toBe(true);
      if (suspicion(log, result)) flagged++;
    }
    expect(flagged).toBe(0);
  });

  it("flags a run played with knowledge of the deck", () => {
    let t = 0;
    const boards = [0, 1, 2].map((b) => {
      const flips = perfectBoard(runBoard(21, b), t);
      t = flips[flips.length - 1].t + 1000;
      return flips;
    });
    const log: RunLog = { seed: 21, boards, reviveAt: null };
    const result = scoreRun(log);
    expect(result.valid).toBe(true);
    expect(suspicion(log, result)).toBe("impossible luck");
  });

  it("flags inhuman tapping speed", () => {
    const flips = perfectBoard(runBoard(5, 0), 0, 10).slice(0, 2);
    const log: RunLog = { seed: 5, boards: [flips], reviveAt: null };
    expect(suspicion(log, scoreRun(log))).toBe("inhuman speed");
  });
});

describe("daily", () => {
  it("gives everyone the same seed on a given day, a different one the next", () => {
    expect(dailySeed("2026-09-30")).toBe(dailySeed("2026-09-30"));
    expect(dailySeed("2026-09-30")).not.toBe(dailySeed("2026-10-01"));
    expect(utcDay(new Date("2026-09-30T23:59:59Z"))).toBe("2026-09-30");
  });
});
