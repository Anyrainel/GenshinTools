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
    // Two bursts: the refund from the first is a post-cast effect, so it funds
    // the second window rather than the one that produced it.
    const timeline: ERTimeline = {
      actions: [
        { char: "jean", action: "specialQ" },
        { char: "jean", action: "specialQ" },
      ],
      periodic: [],
    };

    const [jean] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(jean.qWindows?.[0]?.burstCost).toBe(40);
    expect(jean.qWindows?.[0]?.flatEnergy).toBe(0);
    // 20% of the specialQ cost (40), not of the standard burst cost (80).
    expect(jean.qWindows?.[1]?.burstCost).toBe(40);
    expect(jean.qWindows?.[1]?.flatEnergy).toBe(8);
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

    // Sara A4 is 1.2 energy per 100% of HER ER, resolved at the assumed
    // battery ER of 250% → 3.0. The point of this test is that the generic
    // "E" entry fires on a specialE node at all.
    expect(sara.qWindows?.[0]?.scalableEnergy).toBeCloseTo(3.0);
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

    // Sword pity (base 0.10, +0.05). Two hits under the renewal model:
    //   hit 1 → 0.10
    //   hit 2 → 0.1 x 0.10 (mass that procced and reset) + 0.9 x 0.15 = 0.145
    // Total 0.245. The old single-survival model dropped the reset mass and
    // reported 0.235.
    expect(bennett?.energyBreakdown.flatEnergy).toBeCloseTo(0.245, 3);
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

  it("distributes 1 electro particle on resonanceProc with no reaction weapon in the party", () => {
    // Full party, 2 Electro → High Voltage active. Nobody holds a
    // reaction-trigger weapon: resonance must not depend on `reactionProc`,
    // which the UI only offers to such wearers.
    // Absorber of the index-0 emission is the next real action's char (charB).
    //   charB (on-field, Electro):  1 × 3.0 × 1.0 = 3.0
    //   charA (off-field, 4-char mult 0.6, Electro): 1 × 3.0 × 0.6 = 1.8
    //   charC (off-field, Pyro):    1 × 1.0 × 0.6 = 0.6
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Electro", burstCost: 60 },
      { id: "charC", element: "Pyro", burstCost: 60 },
      { id: "charD", element: "Pyro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", resonanceProc: true },
        { char: "charB", action: "Q" },
        { char: "charA", action: "Q" },
        { char: "charC", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const by = (id: string) =>
      results.find((r) => r.characterId === id)!.energyBreakdown.particleEnergy;

    expect(by("charB")).toBeCloseTo(3.0);
    expect(by("charA")).toBeCloseTo(1.8);
    expect(by("charC")).toBeCloseTo(0.6);
  });

  it("ignores reactionProc for electro resonance — it is a weapon flag", () => {
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Electro", burstCost: 60 },
      { id: "charC", element: "Pyro", burstCost: 60 },
      { id: "charD", element: "Pyro", burstCost: 60 },
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

    expect(
      results.find((r) => r.characterId === "charB")!.energyBreakdown
        .particleEnergy
    ).toBe(0);
  });

  it("enforces the 5s internal cooldown on electro resonance", () => {
    // Node clock: E = 1.0s, wait = 1.0s, Q = 1.5s.
    //   idx 0 charA E   t=0.0 → fires (absorber = charB at idx 1)
    //   idx 1 charB E   t=1.0 → within 5s of the last proc → suppressed
    //   idx 2-4 waits   t=2.0 … 4.0
    //   idx 5 charB E   t=5.0 → exactly 5s later → fires (absorber = charB)
    // charB catches both: 3.0 + 3.0 = 6.0. Without the ICD the idx-1 proc
    // would land on charB too, giving 9.0.
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Electro", burstCost: 60 },
      { id: "charC", element: "Pyro", burstCost: 60 },
      { id: "charD", element: "Pyro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", resonanceProc: true },
        { char: "charB", action: "E", resonanceProc: true },
        { char: "charB", action: "wait" },
        { char: "charB", action: "wait" },
        { char: "charB", action: "wait" },
        { char: "charB", action: "E", resonanceProc: true },
        { char: "charB", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(
      results.find((r) => r.characterId === "charB")!.energyBreakdown
        .particleEnergy
    ).toBeCloseTo(6.0);
  });

  it("requires a full party of 4 for electro resonance", () => {
    // Two Electro members but only three slots filled — Elemental Resonance
    // does not exist below a full party.
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Electro", burstCost: 60 },
      { id: "charC", element: "Pyro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", resonanceProc: true },
        { char: "charB", action: "Q" },
        { char: "charA", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(
      results.find((r) => r.characterId === "charB")!.energyBreakdown
        .particleEnergy
    ).toBe(0);
    expect(
      results.find((r) => r.characterId === "charA")!.energyBreakdown
        .particleEnergy
    ).toBe(0);
  });

  it("does not distribute electro resonance particle when the party has fewer than 2 Electro members", () => {
    const team: TeamMember[] = [
      { id: "charA", element: "Electro", burstCost: 60 },
      { id: "charB", element: "Pyro", burstCost: 60 },
      { id: "charC", element: "Pyro", burstCost: 60 },
      { id: "charD", element: "Hydro", burstCost: 60 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "charA", action: "E", resonanceProc: true },
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

  it("suppresses a self-energy trigger that repeats inside its cooldown", () => {
    // Barbara C1: 1 Energy, procs 2, cooldown 10s, anchored to E.
    //   idx 0 E  t=0.0  → trigger fires: 1 now, 1 tick queued
    //   idx 1 E  t=1.0  → 1s < 10s cooldown → no new proc-train at all
    //   idx 2 Q  t=2.0  → window closes, queued tick flushes: +1
    // Total 2. With the cooldown inert (the old behaviour) the second cast
    // started its own train and the window closed on 4.
    const team: TeamMember[] = [
      { id: "barbara", element: "Hydro", burstCost: 80, constellation: 1 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "barbara", action: "E" },
        { char: "barbara", action: "E" },
        { char: "barbara", action: "Q" },
      ],
      periodic: [],
    };

    const [barbara] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(barbara.qWindows?.[0]?.flatEnergy).toBeCloseTo(2, 6);
  });

  it("lets a cooled-down self-energy trigger fire again, procs included", () => {
    // Same entry, second cast pushed past the 10s cooldown by ten 1s waits:
    // two trigger procs (1 + 1) plus both queued ticks flushed at the burst.
    const waits = Array.from({ length: 10 }, () => ({
      char: "barbara",
      action: "wait" as const,
    }));
    const team: TeamMember[] = [
      { id: "barbara", element: "Hydro", burstCost: 80, constellation: 1 },
    ];
    const timeline: ERTimeline = {
      actions: [
        { char: "barbara", action: "E" },
        ...waits,
        { char: "barbara", action: "E" },
        { char: "barbara", action: "Q" },
      ],
      periodic: [],
    };

    const [barbara] = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });

    expect(barbara.qWindows?.[0]?.flatEnergy).toBeCloseTo(4, 6);
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
