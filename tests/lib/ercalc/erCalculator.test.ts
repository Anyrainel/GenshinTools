import { describe, expect, it } from "vitest";

import {
  calculateTeamER,
  calculateTeamERSequence,
} from "@/lib/ercalc/erCalculator";
import type { ERTimeline, TeamMember } from "@/lib/ercalc/types";

describe("calculateTeamER", () => {
  it("applies orb scaling and selected element to enemy orb drops", () => {
    const team: TeamMember[] = [
      { id: "bennett", element: "Pyro", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
    ];
    const timeline: ERTimeline = {
      actions: [
        {
          char: "bennett",
          action: "enemyOrb",
          orbCount: 1,
          orbElement: "Pyro",
        },
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    const bennett = results.find((r) => r.characterId === "bennett");
    const xiangling = results.find((r) => r.characterId === "xiangling");

    expect(xiangling?.energyBreakdown.particleEnergy).toBe(9);
    expect(bennett?.energyBreakdown.particleEnergy).toBeCloseTo(7.2);
  });

  it("uses different-element energy for elemental orbs caught by a mismatched element", () => {
    const team: TeamMember[] = [
      { id: "bennett", element: "Electro", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
    ];
    const timeline: ERTimeline = {
      actions: [
        {
          char: "bennett",
          action: "enemyOrb",
          orbCount: 1,
          orbElement: "Electro",
        },
        { char: "xiangling", action: "Q" },
      ],
      periodic: [],
    };

    const [_, xiangling] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(xiangling.energyBreakdown.particleEnergy).toBe(3);
  });

  it("credits normal-attack flat energy only to the on-field attacker", () => {
    const team: TeamMember[] = [
      { id: "bennett", element: "Pyro", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "bennett", action: "NA" },
        { char: "bennett", action: "NA" },
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    const bennett = results.find((r) => r.characterId === "bennett");
    const xiangling = results.find((r) => r.characterId === "xiangling");

    expect(bennett?.energyBreakdown.flatEnergy).toBe(1);
    expect(xiangling?.energyBreakdown.flatEnergy).toBe(0);
  });

  it("keeps one Q-window calculation per authored startup and repeated loop burst", () => {
    const team: TeamMember[] = [
      { id: "bennett", element: "Pyro", burstCost: 60 },
    ];
    const startup: ERTimeline = {
      actions: [{ char: "bennett", action: "Q" }],
      periodic: [],
    };
    const loop: ERTimeline = {
      actions: [{ char: "bennett", action: "Q" }],
      periodic: [],
    };

    const [bennett] = calculateTeamERSequence(
      team,
      [
        {
          timeline: startup,
          source: { kind: "startup", timelineNumber: 1 },
        },
        {
          timeline: loop,
          source: { kind: "loop", iteration: "first" },
        },
        {
          timeline: loop,
          source: { kind: "loop", iteration: "subsequent" },
        },
      ],
      { isRepeating: true }
    );

    expect(bennett.qWindows).toHaveLength(3);
    expect(bennett.qWindows?.map((w) => w.source)).toEqual([
      { kind: "startup", timelineNumber: 1, actionIndex: 0 },
      { kind: "loop", iteration: "first", actionIndex: 0 },
      { kind: "loop", iteration: "subsequent", actionIndex: 0 },
    ]);
  });
});
