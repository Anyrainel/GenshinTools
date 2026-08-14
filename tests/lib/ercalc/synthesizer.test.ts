import { describe, expect, it } from "vitest";
import { particles } from "@/lib/ercalc/constants";
import { analyzeRotation } from "@/lib/ercalc/rotationHints";
import {
  compileHighLevelRotation,
  type HighLevelRotation,
} from "@/lib/ercalc/synthesizer";
import type { ERTimeline } from "@/lib/ercalc/types";

const BURSTS = new Set(["Q", "specialQ"]);
const SKILLS = new Set(["E", "holdE", "specialE"]);

const NATIONAL: HighLevelRotation = {
  teamCharIds: ["xiangling", "bennett", "sucrose", "xingqiu"],
  casts: {
    bennett: { skillCount: 1, burstCount: 1 },
    xiangling: { skillCount: 1, burstCount: 1 },
    xingqiu: { skillCount: 2, burstCount: 1 },
    sucrose: { skillCount: 2, burstCount: 1, normalAttackCount: 6 },
  },
  funnels: [
    { sourceCharId: "bennett", targetCharId: "xiangling", castIndex: 0 },
  ],
  driverCharId: "sucrose",
};

/** First index at which a character performs an action of their own. */
function firstOwnAction(timeline: ERTimeline, charId: string): number {
  return timeline.actions.findIndex(
    (a) => a.char === charId && (SKILLS.has(a.action) || BURSTS.has(a.action))
  );
}

function countAction(
  timeline: ERTimeline,
  charId: string,
  match: Set<string>
): number {
  return timeline.actions.filter(
    (a) => a.char === charId && match.has(a.action)
  ).length;
}

describe("compileHighLevelRotation — action order", () => {
  it("puts every character's skill before their first burst", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const deployed = new Set<string>();
    for (const act of timeline.actions) {
      if (SKILLS.has(act.action)) deployed.add(act.char);
      if (BURSTS.has(act.action)) {
        expect(
          deployed.has(act.char),
          `${act.char} bursts before casting their skill`
        ).toBe(true);
      }
    }
  });

  it("emits E -> wait -> Q for a self-absorbing character", () => {
    const timeline = compileHighLevelRotation({
      teamCharIds: ["raiden_shogun"],
      casts: { raiden_shogun: { skillCount: 1, burstCount: 1 } },
      funnels: [],
    });
    expect(timeline.actions).toEqual([
      { char: "raiden_shogun", action: "E" },
      { char: "raiden_shogun", action: "wait" },
      { char: "raiden_shogun", action: "Q" },
    ]);
  });

  it("swaps the funnel target in to absorb, still after the source's skill", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const bennettE = timeline.actions.findIndex(
      (a) => a.char === "bennett" && a.action === "E"
    );
    expect(bennettE).toBeGreaterThanOrEqual(0);
    expect(timeline.actions[bennettE + 1]).toEqual({
      char: "xiangling",
      action: "wait",
    });
  });

  it("produces no burst-before-skill hints for a standard 4-character team", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const hints = analyzeRotation(timeline, NATIONAL.teamCharIds);
    const burstFirst = hints.filter((h) =>
      h.messageEn.includes("bursts before using skill")
    );
    expect(burstFirst).toEqual([]);
  });
});

describe("compileHighLevelRotation — cast counts", () => {
  it("honours burstCount instead of collapsing it to one Q", () => {
    const timeline = compileHighLevelRotation({
      teamCharIds: ["xiangling", "bennett"],
      casts: {
        xiangling: { skillCount: 2, burstCount: 2 },
        bennett: { skillCount: 1, burstCount: 1 },
      },
      funnels: [],
    });
    expect(countAction(timeline, "xiangling", BURSTS)).toBe(2);
    expect(countAction(timeline, "bennett", BURSTS)).toBe(1);
  });

  it("splits the skill casts across sub-phases so each burst has a window", () => {
    const timeline = compileHighLevelRotation({
      teamCharIds: ["xiangling"],
      casts: { xiangling: { skillCount: 2, burstCount: 2 } },
      funnels: [],
    });
    expect(timeline.actions.map((a) => a.action)).toEqual([
      "E",
      "wait",
      "Q",
      "E",
      "wait",
      "Q",
    ]);
  });

  it("emits every skill cast requested", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    expect(countAction(timeline, "xingqiu", SKILLS)).toBe(2);
    expect(countAction(timeline, "sucrose", SKILLS)).toBe(2);
  });

  it("does not double-emit a burst pulled forward onto a funnel", () => {
    // Xiangling deploys first here, so Bennett's funnel can pull her Q forward.
    const timeline = compileHighLevelRotation({
      teamCharIds: ["xiangling", "bennett"],
      casts: {
        xiangling: { skillCount: 1, burstCount: 1 },
        bennett: { skillCount: 1, burstCount: 1 },
      },
      funnels: [
        { sourceCharId: "bennett", targetCharId: "xiangling", castIndex: 0 },
      ],
    });
    expect(countAction(timeline, "xiangling", BURSTS)).toBe(1);
  });
});

describe("compileHighLevelRotation — driver normal attacks", () => {
  it("interleaves driver NAs between character phases instead of one block", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const naIndices = timeline.actions
      .map((a, i) => (a.action === "NA" ? i : -1))
      .filter((i) => i >= 0);
    expect(naIndices).toHaveLength(6);
    for (const i of naIndices) {
      expect(timeline.actions[i].char).toBe("sucrose");
    }
    // Not one uninterrupted chain: at least one non-NA action splits them.
    const contiguous = naIndices.every((v, k) => v === naIndices[0] + k);
    expect(contiguous).toBe(false);
  });

  it("ignores normalAttackCount for characters that are not the driver", () => {
    const timeline = compileHighLevelRotation({
      teamCharIds: ["bennett", "sucrose"],
      casts: {
        bennett: { skillCount: 1, burstCount: 1, normalAttackCount: 5 },
        sucrose: { skillCount: 1, burstCount: 1, normalAttackCount: 2 },
      },
      funnels: [],
      driverCharId: "sucrose",
    });
    expect(countAction(timeline, "bennett", new Set(["NA"]))).toBe(0);
    expect(countAction(timeline, "sucrose", new Set(["NA"]))).toBe(2);
  });
});

describe("compileHighLevelRotation — periodic procs", () => {
  it("never places a proc before the action that deploys it", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    expect(timeline.periodic.length).toBeGreaterThan(0);
    for (const proc of timeline.periodic) {
      const triggers = proc.trigger === "E" ? SKILLS : BURSTS;
      const deployIdx = timeline.actions.findIndex(
        (a) => a.char === proc.sourceChar && triggers.has(a.action)
      );
      expect(deployIdx).toBeGreaterThanOrEqual(0);
      expect(proc.targetIndex).toBeGreaterThanOrEqual(deployIdx);
      expect(proc.targetIndex).toBeLessThan(timeline.actions.length);
    }
  });

  it("places the full default proc count per deployment", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const expected = particles.xiangling.periodic?.E?.procs ?? 0;
    expect(expected).toBeGreaterThan(0);
    const placed = timeline.periodic.filter(
      (p) => p.sourceChar === "xiangling" && p.trigger === "E"
    );
    expect(placed).toHaveLength(expected);
  });

  it("does not pile the overflow onto the final index", () => {
    // Fischl deploys Oz last here, with fewer following slots than procs.
    const timeline = compileHighLevelRotation({
      teamCharIds: ["fischl", "bennett"],
      casts: {
        bennett: { skillCount: 1, burstCount: 1, normalAttackCount: 4 },
        fischl: { skillCount: 1, burstCount: 1 },
      },
      funnels: [],
      driverCharId: "bennett",
    });
    const targets = timeline.periodic
      .filter((p) => p.sourceChar === "fischl")
      .map((p) => p.targetIndex);
    expect(targets.length).toBeGreaterThan(0);
    const lastIndex = timeline.actions.length - 1;
    expect(targets.filter((t) => t === lastIndex).length).toBeLessThan(
      targets.length
    );
    expect(new Set(targets).size).toBeGreaterThan(1);
  });
});

describe("compileHighLevelRotation — swap order", () => {
  it("orders sustain -> off-field -> driver regardless of team slot order", () => {
    const timeline = compileHighLevelRotation(NATIONAL);
    const order = ["bennett", "xingqiu", "xiangling", "sucrose"].map((c) =>
      firstOwnAction(timeline, c)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is deterministic for the same input", () => {
    const a = compileHighLevelRotation(NATIONAL);
    const b = compileHighLevelRotation(NATIONAL);
    expect(a).toEqual(b);
  });

  it("skips characters with no cast entry", () => {
    const timeline = compileHighLevelRotation({
      teamCharIds: ["bennett", "xiangling"],
      casts: { bennett: { skillCount: 1, burstCount: 1 } },
      funnels: [],
    });
    expect(timeline.actions.some((a) => a.char === "xiangling")).toBe(false);
  });
});
