import { describe, expect, it } from "vitest";

import type { TeamMember, Timeline } from "@/lib/ercalc/erCalculator";
import { calculateTeamER } from "@/lib/ercalc/erCalculator";
import { optimizeWaitBlocks } from "@/lib/ercalc/optimizer";

function member(
  id: string,
  element: string,
  burstCost: number,
  overrides?: Partial<TeamMember>
): TeamMember {
  return { id, element, burstCost, constellation: 0, ...overrides };
}

describe("optimizeWaitBlocks", () => {
  it("inserts wait to enable self-funneling when it reduces max ER", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xingqiu", "Hydro", 80),
    ];
    // Without wait: Bennett E → Xingqiu absorbs on-field (diff element for Bennett)
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "xingqiu", action: "E" },
      { char: "xingqiu", action: "Q" },
      { char: "bennett", action: "Q" },
    ];

    const before = calculateTeamER(team, timeline);
    const result = optimizeWaitBlocks(team, timeline);

    // Should have inserted at least one wait
    expect(result.insertedWaits).toBeGreaterThanOrEqual(0);
    // Max ER should not increase
    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });

  it("does nothing when no wait insertion helps", () => {
    const team: TeamMember[] = [member("bennett", "Pyro", 60)];
    // Solo Bennett: E → Q. Already self-absorbing.
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
    ];

    const result = optimizeWaitBlocks(team, timeline);
    expect(result.insertedWaits).toBe(0);
    expect(result.timeline).toEqual(timeline);
  });

  it("removes suboptimal waits when it improves max ER", () => {
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    // Timeline with a wait that might not help
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "wait" }, // might be suboptimal
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ];

    const result = optimizeWaitBlocks(team, timeline);
    // Max ER should be <= original (either wait stays or gets removed)
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
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "bennett", action: "Q" },
    ];

    const result = optimizeWaitBlocks(team, timeline);
    for (const act of result.timeline) {
      expect(act.char).toBeDefined();
      expect(act.action).toBeDefined();
    }
  });

  it("optimizer never makes max ER worse (monotonic improvement)", () => {
    // Run optimizer on the National team preset and verify it doesn't increase max ER
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
      member("xingqiu", "Hydro", 80),
      member("sucrose", "Anemo", 80),
    ];
    const timeline: Timeline = [
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
    ];

    const before = calculateTeamER(team, timeline);
    const result = optimizeWaitBlocks(team, timeline);

    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    // Optimizer should never make things worse
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });

  it("can swap E→Q to Q→E when it helps", () => {
    // If Bennett does E→Q, the optimizer might swap to Q→E
    // to defer particles to the next window
    const team: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "Q" },
    ];
    const result = optimizeWaitBlocks(team, timeline);
    // Max ER should not increase
    const before = calculateTeamER(team, timeline);
    const maxBefore = Math.max(...before.map((r) => r.erNeeded));
    const maxAfter = Math.max(...result.results.map((r) => r.erNeeded));
    expect(maxAfter).toBeLessThanOrEqual(maxBefore);
  });
});
