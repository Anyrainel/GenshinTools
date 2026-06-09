import { describe, expect, it } from "vitest";

import {
  autoPlaceReactionProcs,
  calculateTeamER,
  calculateTeamERSequence,
  getActionParticles,
  getAvailableActions,
  getNodeEnergyEvents,
  hasReactionEnergyTrigger,
} from "@/lib/ercalc/erCalculator";
import type { ERTimeline, TeamMember } from "@/lib/ercalc/types";

describe("calculateTeamER", () => {
  it("uses the special burst cost for specialQ nodes", () => {
    const team: TeamMember[] = [
      {
        id: "varesa",
        element: "Electro",
        burstCost: 70,
        specialBurstCost: 30,
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        {
          char: "varesa",
          action: "grantEnergy",
          energyGrants: { varesa: { flat: 30 } },
        },
        { char: "varesa", action: "specialQ" },
      ],
      periodic: [],
    };

    const [varesa] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(varesa.erNeeded).toBe(100);
    expect(varesa.qWindows?.[0]?.burstCost).toBe(30);
    expect(varesa.energyBreakdown.flatEnergy).toBe(30);
  });

  it("keeps standard Q on the standard burst cost when special burst cost exists", () => {
    const team: TeamMember[] = [
      {
        id: "varesa",
        element: "Electro",
        burstCost: 70,
        specialBurstCost: 30,
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        {
          char: "varesa",
          action: "grantEnergy",
          energyGrants: { varesa: { flat: 30 } },
        },
        { char: "varesa", action: "Q" },
      ],
      periodic: [],
    };

    const [varesa] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(varesa.erNeeded).toBe(Number.POSITIVE_INFINITY);
    expect(varesa.qWindows?.[0]?.burstCost).toBe(70);
    expect(varesa.energyBreakdown.flatEnergy).toBe(30);
  });

  it("uses the current burst action cost for percent refunds", () => {
    const team: TeamMember[] = [
      {
        id: "jean",
        element: "Anemo",
        burstCost: 80,
        specialBurstCost: 40,
        constellation: 0,
      },
    ];
    const timeline: ERTimeline = {
      actions: [{ char: "jean", action: "specialQ" }],
      periodic: [],
    };

    const [jean] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(jean.qWindows?.[0]?.burstCost).toBe(40);
    expect(jean.qWindows?.[0]?.flatEnergy).toBe(8);
  });

  it("exposes specialQ actions and node drain from special burst cost data", () => {
    expect(getAvailableActions("varesa")).toContain("specialQ");

    const events = getNodeEnergyEvents({ char: "varesa", action: "specialQ" }, [
      {
        id: "varesa",
        element: "Electro",
        burstCost: 70,
        specialBurstCost: 30,
      },
    ]);

    expect(events.find((ev) => ev.category === "drain")?.amount).toBe(30);
  });

  it("uses exact holdE self-energy instead of also applying same-source E self-energy", () => {
    const team: TeamMember[] = [
      {
        id: "kaedehara_kazuha",
        element: "Anemo",
        burstCost: 60,
        constellation: 4,
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "kaedehara_kazuha", action: "holdE" },
        { char: "kaedehara_kazuha", action: "Q" },
      ],
      periodic: [],
    };

    const [kazuha] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(kazuha.qWindows?.[0]?.flatEnergy).toBe(4);
  });

  it("falls back from generic E self-energy to specialE when there is no exact specialE entry", () => {
    const team: TeamMember[] = [
      {
        id: "kujou_sara",
        element: "Electro",
        burstCost: 80,
        constellation: 0,
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "kujou_sara", action: "specialE" },
        { char: "kujou_sara", action: "Q" },
      ],
      periodic: [],
    };

    const [sara] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(sara.qWindows?.[0]?.scalableEnergy).toBeCloseTo(1.2);
    expect(sara.qWindows?.[0]?.particleEnergy).toBe(9);
  });

  it("offers holdE when only self-energy needs a hold action and particles fall back to E", () => {
    expect(getAvailableActions("traveler_hydro")).toContain("holdE");
    expect(
      getActionParticles("traveler_hydro", "holdE", "expected")
    ).toBeCloseTo(3.333);
  });

  it("auto-flags all skill variants for reaction-triggered weapon energy", () => {
    expect(hasReactionEnergyTrigger("lumidouce_elegy")).toBe(true);
    expect(hasReactionEnergyTrigger("favonius_lance")).toBe(false);

    const actions: ERTimeline["actions"] = [
      { char: "emilie", action: "E" },
      { char: "emilie", action: "holdE" },
      { char: "emilie", action: "specialE" },
      { char: "emilie", action: "Q" },
      { char: "bennett", action: "E" },
    ];

    autoPlaceReactionProcs(actions, "emilie");

    expect(actions.map((a) => a.reactionProc ?? false)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
  });

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

  it("credits normal-attack pity energy only to the on-field attacker", () => {
    // sword: base=0.10, dp=0.05
    // Hit 1: energy = 1.0 × 0.10 = 0.10, survival → 0.90, prob → 0.15
    // Hit 2: energy = 0.90 × 0.15 = 0.135, survival → 0.765, prob → 0.20
    // Total ≈ 0.235 for bennett; xiangling (off-field) receives nothing.
    const team: TeamMember[] = [
      { id: "bennett", element: "Pyro", burstCost: 60, weaponType: "sword" },
      {
        id: "xiangling",
        element: "Pyro",
        burstCost: 80,
        weaponType: "polearm",
      },
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

    expect(bennett?.energyBreakdown.flatEnergy).toBeCloseTo(0.235, 3);
    expect(xiangling?.energyBreakdown.flatEnergy).toBe(0);
  });

  it("NA pity resets on swap-in (sword: prob restarts from 0.10 each time character comes on-field)", () => {
    // bennett: NA (prob 0.10), swap to xiangling, swap back → pity resets to 0.10
    // Second bennett NA: energy = 0.10 again (not 0.15)
    const team: TeamMember[] = [
      { id: "bennett", element: "Pyro", burstCost: 60, weaponType: "sword" },
      {
        id: "xiangling",
        element: "Pyro",
        burstCost: 80,
        weaponType: "polearm",
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "bennett", action: "NA" }, // pity: 0.10 → contrib 0.10
        { char: "xiangling", action: "wait" }, // bennett swaps out
        { char: "bennett", action: "NA" }, // swap-in resets → pity: 0.10 → contrib 0.10
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const bennett = results.find((r) => r.characterId === "bennett");

    // Two isolated NA hits: 0.10 + 0.10 = 0.20 (pity resets between them)
    expect(bennett?.energyBreakdown.flatEnergy).toBeCloseTo(0.2, 5);
  });

  it("polearm pity uses base=0, dp=0.04 — no energy on first hit", () => {
    // polearm: base=0, so first hit contributes 0 energy
    const team: TeamMember[] = [
      {
        id: "xiangling",
        element: "Pyro",
        burstCost: 80,
        weaponType: "polearm",
      },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "xiangling", action: "NA" }, // prob=0.00, contrib=0
        { char: "xiangling", action: "NA" }, // prob=0.04, contrib=1.0×0.04
        { char: "xiangling", action: "NA" }, // prob=0.08, contrib=0.96×0.08
        { char: "xiangling", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const xiangling = results[0];

    // Hit 1: 0.00, Hit 2: 0.04, Hit 3: 0.96×0.08 = 0.0768
    expect(xiangling.energyBreakdown.flatEnergy).toBeCloseTo(
      0 + 0.04 + 0.0768,
      4
    );
  });

  it("distributes 1 electro particle on reactionProc when team has 2+ Electro members", () => {
    // 2 Electro chars → resonance active. Both have no particle data → only resonance fires.
    // charA (Electro) does E with reactionProc. Next action is charB → charB is absorber.
    // charB (on-field, Electro): 1 × 3.0 × 1.0 = 3.0 particle energy
    // charA (off-field, 2-char mult=0.8, Electro): 1 × 3.0 × 0.8 = 2.4 particle energy
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Electro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", reactionProc: true },
        { char: "charB", action: "Q" },
        { char: "charA", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const charA = results.find((r) => r.characterId === "charA")!;
    const charB = results.find((r) => r.characterId === "charB")!;

    expect(charB.energyBreakdown.particleEnergy).toBeCloseTo(3.0);
    expect(charA.energyBreakdown.particleEnergy).toBeCloseTo(2.4);
  });

  it("does not distribute electro resonance particle when team has fewer than 2 Electro members", () => {
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Pyro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", reactionProc: true },
        { char: "charB", action: "Q" },
        { char: "charA", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const charA = results.find((r) => r.characterId === "charA")!;
    const charB = results.find((r) => r.characterId === "charB")!;

    // No resonance — charA has no particle data so particleEnergy stays 0
    expect(charA.energyBreakdown.particleEnergy).toBe(0);
    expect(charB.energyBreakdown.particleEnergy).toBe(0);
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
