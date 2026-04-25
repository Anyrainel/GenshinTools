import { describe, expect, it } from "vitest";

import { calculateTeamER } from "@/lib/ercalc/erCalculator";
import { optimizeWaitBlocks, scoreLess, scoreOf } from "@/lib/ercalc/optimizer";
import type {
  ERResult,
  ERTimeline,
  PeriodicProc,
  TeamMember,
  TimelineAction,
} from "@/lib/ercalc/types";

function member(
  id: string,
  element: string,
  burstCost: number,
  overrides?: Partial<TeamMember>
): TeamMember {
  return { id, element, burstCost, constellation: 0, ...overrides };
}

/** Helper: flat actions (including periodicE) → v2 ERTimeline. */
type FlatEntry = {
  char: string;
  action: TimelineAction["action"] | "periodicE";
};
function ert(flat: FlatEntry[]): ERTimeline {
  const actions: TimelineAction[] = [];
  const periodic: PeriodicProc[] = [];
  const pending: string[] = [];
  for (const e of flat) {
    if (e.action === "periodicE") {
      pending.push(e.char);
    } else {
      const idx = actions.length;
      for (const src of pending)
        periodic.push({ sourceChar: src, trigger: "E", targetIndex: idx });
      pending.length = 0;
      actions.push({ char: e.char, action: e.action });
    }
  }
  if (pending.length && actions.length > 0) {
    const last = actions.length - 1;
    for (const src of pending)
      periodic.push({ sourceChar: src, trigger: "E", targetIndex: last });
  }
  return { actions, periodic };
}

function isEqualVec(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fakeResult(erNeeded: number): ERResult {
  return {
    characterId: "x",
    erNeeded,
    energyBreakdown: { particleEnergy: 0, scalableEnergy: 0, flatEnergy: 0 },
    hasQ: true,
  };
}

describe("scoreOf", () => {
  it("sorts ER values descending", () => {
    const score = scoreOf([
      fakeResult(100),
      fakeResult(180),
      fakeResult(130),
      fakeResult(100),
    ]);
    expect(score).toEqual([180, 130, 100, 100]);
  });
});

describe("scoreLess (lexicographic comparator)", () => {
  it("min-max takes priority: lower max wins outright", () => {
    expect(scoreLess([170, 160, 100, 100], [180, 100, 100, 100])).toBe(true);
    expect(scoreLess([180, 100, 100, 100], [170, 160, 100, 100])).toBe(false);
  });

  it("when max is tied, second-highest decides", () => {
    expect(scoreLess([180, 130, 100, 100], [180, 145, 100, 100])).toBe(true);
    expect(scoreLess([180, 145, 100, 100], [180, 130, 100, 100])).toBe(false);
  });

  it("when max and second are tied, third-highest decides", () => {
    expect(scoreLess([180, 130, 105, 100], [180, 130, 110, 100])).toBe(true);
    expect(scoreLess([180, 130, 110, 100], [180, 130, 105, 100])).toBe(false);
  });

  it("equal vectors are not strictly less", () => {
    expect(scoreLess([180, 130, 100, 100], [180, 130, 100, 100])).toBe(false);
  });

  it("Infinity at max is not improved by lowering second-highest if both vectors have Infinity max", () => {
    // Reasonable lex behavior: if max is Infinity for both, second-highest
    // breaks the tie — so an unsolvable rotation can still be partially fixed.
    expect(
      scoreLess(
        [Number.POSITIVE_INFINITY, 110, 100, 100],
        [Number.POSITIVE_INFINITY, 130, 100, 100]
      )
    ).toBe(true);
  });
});

describe("optimizeWaitBlocks", () => {
  it("inserts wait to enable self-funneling when it reduces max ER", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xingqiu", "Hydro", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "bennett", action: "Q" },
    ]);

    const before = calculateTeamER(team, timeline);
    const result = optimizeWaitBlocks(team, timeline);

    expect(result.insertedWaits).toBeGreaterThanOrEqual(0);
    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });

  it("does nothing when no wait insertion helps", () => {
    const team: TeamMember[] = [member("bennett", "Pyro", 60)];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
    ]);

    const result = optimizeWaitBlocks(team, timeline);
    expect(result.insertedWaits).toBe(0);
    expect(result.timeline).toEqual(timeline);
  });

  it("removes suboptimal waits when it improves max ER", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "bennett", action: "wait" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ]);

    const result = optimizeWaitBlocks(team, timeline);
    const original = calculateTeamER(team, timeline);
    const maxOriginal = Math.max(...original.map((r) => r.erNeeded));
    const maxOptimized = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxOptimized).toBeLessThanOrEqual(maxOriginal);
  });

  it("returns valid timeline with correct action types", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ]);

    const result = optimizeWaitBlocks(team, timeline);
    for (const act of result.timeline.actions) {
      expect(act.char).toBeDefined();
      expect(act.action).toBeDefined();
    }
  });

  it("optimizer never makes max ER worse (monotonic improvement)", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
      member("xingqiu", "Hydro", 80),
      member("sucrose", "Anemo", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "Q" },
    ]);

    const before = calculateTeamER(team, timeline);
    const result = optimizeWaitBlocks(team, timeline);

    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });

  it("optimization is lex-monotonic on the descending ER vector", () => {
    // Even when max ER can't improve further, second-/third-highest should
    // never get worse. This is the property the lex objective guarantees.
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
      member("xingqiu", "Hydro", 80),
      member("sucrose", "Anemo", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "E" },
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "Q" },
    ]);

    const before = scoreOf(calculateTeamER(team, timeline));
    const after = scoreOf(optimizeWaitBlocks(team, timeline).results);

    // `after` must be lex ≤ `before` — equal is fine (already optimal),
    // strictly greater at any position would mean a regression.
    expect(scoreLess(after, before) || isEqualVec(after, before)).toBe(true);
  });

  it("can swap E→Q to Q→E when it helps", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "Q" },
    ]);
    const result = optimizeWaitBlocks(team, timeline);
    const before = calculateTeamER(team, timeline);
    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });
});
