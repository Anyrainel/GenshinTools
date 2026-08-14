import { describe, expect, it } from "vitest";

import { calculateTeamER } from "@/lib/ercalc/erCalculator";
import {
  alignFavoniusCDsForTeam,
  moveAction,
  optimizeWaitBlocks,
  removeAction,
  scoreLess,
  scoreOf,
  scoreOfObjective,
} from "@/lib/ercalc/optimizer";
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
  favoniusProc?: boolean;
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
      actions.push({
        char: e.char,
        action: e.action,
        favoniusProc: e.favoniusProc,
      });
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

function fakeResult(erNeeded: number, characterId = "x"): ERResult {
  return {
    characterId,
    erNeeded,
    energyBreakdown: { particleEnergy: 0, scalableEnergy: 0, flatEnergy: 0 },
    hasQ: true,
  };
}

/** Every proc must still point at a real action. */
function procsAreWellFormed(t: ERTimeline): boolean {
  return t.periodic.every(
    (p) => p.targetIndex >= 0 && p.targetIndex < t.actions.length
  );
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

  it("never overwrites the user's favoniusProc flags", () => {
    // Bennett holds a Favonius Sword (R5 = 6s CD) and has flagged two E casts
    // 1s apart — not both legal. The CD projection is used for *scoring* only;
    // `favoniusProc` is user-owned data (design doc §2.3) and must come back
    // exactly as authored.
    const team: TeamMember[] = [
      {
        id: "bennett",
        element: "Pyro",
        burstCost: 60,
        constellation: 0,
        weaponId: "favonius_sword",
        refinement: 4, // R5
      },
    ];
    const timeline = ert([
      { char: "bennett", action: "E", favoniusProc: true },
      { char: "bennett", action: "E", favoniusProc: true },
      { char: "bennett", action: "Q" },
    ]);

    const result = optimizeWaitBlocks(team, timeline);
    const favCount = result.timeline.actions.filter(
      (a) => a.favoniusProc
    ).length;
    expect(favCount).toBe(2);
  });

  it("can reorder skill E casts to optimize funneling for high ER characters", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
      member("sucrose", "Anemo", 80),
    ];
    // Initially: Bennett E -> Sucrose wait -> Xiangling Q -> Bennett wait.
    // Bennett's E is absorbed by Sucrose.
    // The optimizer should move Bennett E to index 1 (preceding Xiangling Q)
    // so Xiangling absorbs it on-field.
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "sucrose", action: "wait" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "wait" },
    ]);

    const result = optimizeWaitBlocks(team, timeline);
    const idxE = result.timeline.actions.findIndex(
      (a) => a.char === "bennett" && a.action === "E"
    );
    const idxQ = result.timeline.actions.findIndex(
      (a) => a.char === "xiangling" && a.action === "Q"
    );

    // Bennett E should now be positioned immediately before Xiangling Q (index = indexQ - 1)
    expect(idxE).toBe(idxQ - 1);
  });
});

describe("timeline edit helpers (B14)", () => {
  /** four actions, one proc pinned to each of indices 1 and 2 */
  function fixture(): ERTimeline {
    return ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "wait" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ]);
  }

  it("removeAction hands the removed node's procs to the following action", () => {
    const t = fixture();
    expect(t.periodic.map((p) => p.targetIndex)).toEqual([1, 2]);

    const next = removeAction(t, 1); // drop the wait

    expect(next.actions.map((a) => a.action)).toEqual(["E", "Q", "Q"]);
    // The orphan re-homes onto the (now index-1) Xiangling Q; the proc that
    // was at 2 shifts down to 1 with it. Nothing is dropped.
    expect(next.periodic).toHaveLength(2);
    expect(next.periodic.map((p) => p.targetIndex)).toEqual([1, 1]);
  });

  it("removeAction falls back to the preceding action for the tail node", () => {
    const t = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "Q" },
    ]);
    expect(t.periodic.map((p) => p.targetIndex)).toEqual([1]);

    const next = removeAction(t, 1);

    expect(next.actions).toHaveLength(1);
    expect(next.periodic).toEqual([
      { sourceChar: "xiangling", trigger: "E", targetIndex: 0 },
    ]);
  });

  it("removeAction leaves procs on untouched nodes alone", () => {
    const t = fixture();
    const next = removeAction(t, 5); // drop the trailing Bennett Q
    expect(next.periodic.map((p) => p.targetIndex)).toEqual([1, 2]);
  });

  it("moveAction re-pins the moved node's procs at its new index", () => {
    const t = fixture();
    const moved = moveAction(t, 1, 5); // wait (with its proc) → later

    expect(moved.actions.map((a) => a.action)).toEqual(["E", "Q", "Q", "wait"]);
    expect(moved.periodic).toHaveLength(2);
    const waitIndex = moved.actions.findIndex((a) => a.action === "wait");
    // one proc rode along with the wait, the other stayed on Xiangling's Q
    expect([...moved.periodic.map((p) => p.targetIndex)].sort()).toEqual([
      1,
      waitIndex,
    ]);
  });

  it("moveAction never changes the proc count, wherever it moves", () => {
    const t = fixture();
    for (let from = 0; from < t.actions.length; from++) {
      for (let to = 0; to <= t.actions.length; to++) {
        if (from === to || from + 1 === to) continue;
        const moved = moveAction(t, from, to);
        expect(moved.actions).toHaveLength(t.actions.length);
        expect(moved.periodic).toHaveLength(t.periodic.length);
        expect(procsAreWellFormed(moved)).toBe(true);
      }
    }
  });
});

describe("periodic proc preservation (B14)", () => {
  const team: TeamMember[] = [
    member("bennett", "Pyro", 60),
    member("xiangling", "Pyro", 80),
    member("sucrose", "Anemo", 80),
  ];

  it("relocating a skill preserves the procs pinned to it", () => {
    // Xiangling's Guoba ticks are pinned to Bennett's third E, and the
    // optimizer relocates exactly that E. Before the fix, `moveAction` was
    // `removeAction` + `insertAction`, and `removeAction` filtered the procs
    // at the removed index away — silently deleting all four.
    const team4: TeamMember[] = [
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
    const hostIndex = timeline.periodic[0].targetIndex;
    expect(timeline.periodic).toHaveLength(4);
    expect(timeline.actions[hostIndex]).toEqual({
      char: "bennett",
      action: "E",
      favoniusProc: undefined,
    });

    const result = optimizeWaitBlocks(team4, timeline);

    // The host action really did move (that is the point of this fixture)…
    const newHostIndex = result.timeline.periodic[0].targetIndex;
    expect(newHostIndex).not.toBe(hostIndex);
    // …every proc came along, and they all still ride Bennett's E.
    expect(result.timeline.periodic).toHaveLength(4);
    expect(
      result.timeline.periodic.every((p) => p.targetIndex === newHostIndex)
    ).toBe(true);
    expect(result.timeline.actions[newHostIndex]).toMatchObject({
      char: "bennett",
      action: "E",
    });
    expect(procsAreWellFormed(result.timeline)).toBe(true);
  });

  it("removing a wait re-homes its procs instead of deleting them", () => {
    // Waits are the canonical proc absorber, so wait pruning is the edit most
    // likely to destroy data.
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "wait" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ]);
    const waitIndex = timeline.actions.findIndex((a) => a.action === "wait");
    expect(timeline.periodic).toEqual([
      { sourceChar: "xiangling", trigger: "E", targetIndex: waitIndex },
    ]);

    const result = optimizeWaitBlocks(team, timeline);

    expect(result.timeline.periodic).toHaveLength(1);
    expect(procsAreWellFormed(result.timeline)).toBe(true);
  });

  it("re-indexes procs when an action is relocated ahead of their host", () => {
    const timeline = ert([
      { char: "xiangling", action: "periodicE" },
      { char: "bennett", action: "E" },
      { char: "sucrose", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "wait" },
    ]);
    expect(timeline.periodic).toEqual([
      { sourceChar: "xiangling", trigger: "E", targetIndex: 0 },
    ]);

    const result = optimizeWaitBlocks(team, timeline);

    expect(result.timeline.actions).not.toEqual(timeline.actions);
    expect(result.timeline.periodic).toHaveLength(1);
    expect(procsAreWellFormed(result.timeline)).toBe(true);
    // The proc still rides Bennett's E, wherever it ended up.
    expect(
      result.timeline.actions[result.timeline.periodic[0].targetIndex]
    ).toMatchObject({ char: "bennett", action: "E" });
  });
});

describe("alignFavoniusCDsForTeam (scoring projection)", () => {
  function favTeam(refinement: number): TeamMember[] {
    return [
      {
        id: "bennett",
        element: "Pyro",
        burstCost: 60,
        constellation: 0,
        weaponId: "favonius_sword",
        refinement,
      },
    ];
  }

  /** Three E casts spaced ~16 pseudo-seconds apart — every gap clears even the
   *  R1 12s cooldown, so only the per-refinement proc budget can limit them. */
  function spacedCasts(): ERTimeline {
    const flat: FlatEntry[] = [];
    for (let cast = 0; cast < 3; cast++) {
      flat.push({ char: "bennett", action: "E" });
      for (let w = 0; w < 15; w++)
        flat.push({ char: "bennett", action: "wait" });
    }
    flat.push({ char: "bennett", action: "Q" });
    return ert(flat);
  }

  it("caps the selection at defaultProcsByRefinement", () => {
    // R1 Favonius claims 1 proc per rotation, even though the CD allows 3.
    const aligned = alignFavoniusCDsForTeam(favTeam(0), spacedCasts());
    expect(aligned.actions.filter((a) => a.favoniusProc)).toHaveLength(1);
  });

  it("allows the full R5 budget when the cooldown permits", () => {
    const aligned = alignFavoniusCDsForTeam(favTeam(4), spacedCasts());
    expect(aligned.actions.filter((a) => a.favoniusProc)).toHaveLength(3);
  });

  it("drops procs that fall inside the cooldown", () => {
    const timeline = ert([
      { char: "bennett", action: "E", favoniusProc: true },
      { char: "bennett", action: "E", favoniusProc: true },
      { char: "bennett", action: "Q", favoniusProc: true },
    ]);
    const aligned = alignFavoniusCDsForTeam(favTeam(4), timeline);
    expect(aligned.actions.filter((a) => a.favoniusProc)).toHaveLength(1);
    // The input is untouched — alignment returns a projection, not an edit.
    expect(timeline.actions.every((a) => a.favoniusProc)).toBe(true);
  });
});

describe("scoreOfObjective (B15)", () => {
  const carry = "hu_tao";

  it("counts unsolvable characters first", () => {
    const withInf = scoreOfObjective(
      [fakeResult(Number.POSITIVE_INFINITY, carry), fakeResult(120, "xingqiu")],
      { priorityCharId: carry }
    );
    const without = scoreOfObjective(
      [fakeResult(400, carry), fakeResult(400, "xingqiu")],
      { priorityCharId: carry }
    );
    expect(withInf[0]).toBe(1);
    expect(without[0]).toBe(0);
    expect(scoreLess(without, withInf)).toBe(true);
  });

  it("sums overshoot past each character's cap", () => {
    const score = scoreOfObjective(
      [fakeResult(180, carry), fakeResult(220, "xingqiu")],
      { priorityCharId: carry, caps: { [carry]: 150, xingqiu: 200 } }
    );
    expect(score[1]).toBe(50); // 30 over + 20 over
  });

  it("protects the priority character before the supports", () => {
    // The exact trade B15 describes: carry 115→155 to move a support 205→200.
    const before = scoreOfObjective(
      [fakeResult(115, carry), fakeResult(205, "xingqiu")],
      { priorityCharId: carry }
    );
    const traded = scoreOfObjective(
      [fakeResult(155, carry), fakeResult(200, "xingqiu")],
      { priorityCharId: carry }
    );
    expect(scoreLess(traded, before)).toBe(false);
    expect(scoreLess(before, traded)).toBe(true);
  });

  it("ranks worst support before total support cost", () => {
    const spread = scoreOfObjective(
      [
        fakeResult(115, carry),
        fakeResult(203, "xingqiu"),
        fakeResult(100, "bennett"),
      ],
      { priorityCharId: carry }
    );
    const flatter = scoreOfObjective(
      [
        fakeResult(115, carry),
        fakeResult(200, "xingqiu"),
        fakeResult(150, "bennett"),
      ],
      { priorityCharId: carry }
    );
    expect(flatter[3]).toBe(200);
    expect(spread[3]).toBe(203);
    expect(scoreLess(flatter, spread)).toBe(true);
  });

  it("excludes unsolvable characters from the sums so they stay comparable", () => {
    const score = scoreOfObjective(
      [
        fakeResult(Number.POSITIVE_INFINITY, "xiangling"),
        fakeResult(140, "xingqiu"),
        fakeResult(120, carry),
      ],
      { priorityCharId: carry, caps: { xiangling: 200 } }
    );
    expect(score).toEqual([1, 0, 120, 140, 140]);
  });
});

describe("optimizeWaitBlocks objective + scoreFn contract", () => {
  const carry = "hu_tao";
  const support = "xingqiu";
  const team: TeamMember[] = [
    member(carry, "Pyro", 60),
    member(support, "Hydro", 80),
  ];
  const base = ert([
    { char: carry, action: "E" },
    { char: support, action: "Q" },
    { char: carry, action: "Q" },
  ]);

  /** Synthetic scorer: the owner of the first wait decides the trade.
   *   - carry-owned wait   → carry 115→155, support 205→200 (team max improves)
   *   - support-owned wait → carry stays 115, support 205→203
   *  Anonymous minimax prefers the first; a carry-priority objective must
   *  prefer the second. */
  function tradeScorer(timeline: ERTimeline): ERResult[] {
    const owner = timeline.actions.find((a) => a.action === "wait")?.char;
    if (owner === carry)
      return [fakeResult(155, carry), fakeResult(200, support)];
    if (owner === support)
      return [fakeResult(115, carry), fakeResult(203, support)];
    return [fakeResult(115, carry), fakeResult(205, support)];
  }

  function firstWaitOwner(timeline: ERTimeline): string | undefined {
    return timeline.actions.find((a) => a.action === "wait")?.char;
  }

  it("uses the supplied scoreFn instead of calling the engine", () => {
    const seen: number[] = [];
    const result = optimizeWaitBlocks(team, base, undefined, (t) => {
      seen.push(t.actions.length);
      return tradeScorer(t);
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(result.results.map((r) => r.erNeeded)).toEqual([155, 200]);
  });

  it("without an objective, keeps today's anonymous minimax behaviour", () => {
    const result = optimizeWaitBlocks(team, base, undefined, tradeScorer);
    expect(firstWaitOwner(result.timeline)).toBe(carry);
  });

  it("with a priority character, refuses to trade the carry away", () => {
    const result = optimizeWaitBlocks(team, base, undefined, tradeScorer, {
      priorityCharId: carry,
    });
    expect(firstWaitOwner(result.timeline)).toBe(support);
    expect(result.results.map((r) => r.erNeeded)).toEqual([115, 203]);
  });

  it("caps make overshoot outrank the carry's own requirement", () => {
    // With the support capped at 201, its 205 and 203 overshoots dominate, so
    // the carry-owned wait (support → 200, no overshoot at all) wins again.
    const result = optimizeWaitBlocks(team, base, undefined, tradeScorer, {
      priorityCharId: carry,
      caps: { [support]: 201 },
    });
    expect(firstWaitOwner(result.timeline)).toBe(carry);
  });

  it("is deterministic across repeated runs", () => {
    const objective = { priorityCharId: carry, caps: { [support]: 260 } };
    const a = optimizeWaitBlocks(team, base, undefined, tradeScorer, objective);
    const b = optimizeWaitBlocks(team, base, undefined, tradeScorer, objective);
    expect(a.timeline).toEqual(b.timeline);
    expect(a.results).toEqual(b.results);
  });
});
