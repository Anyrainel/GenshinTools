import { describe, expect, it } from "vitest";

import weaponData from "@/data/game/weapon_en.json";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { allSelfEnergy, particles } from "@/lib/ercalc/constants";
import { calculateTeamER } from "@/lib/ercalc/erCalculator";
import type {
  ERTimeline,
  TeamMember,
  TimelineAction,
} from "@/lib/ercalc/types";
import { weaponEnergyById } from "@/lib/ercalc/weaponEnergy";

/**
 * Guards against silent data drift in the ER calculator's data layer. Both
 * defects pinned here shipped at least once: a weapon registered under an id
 * that does not exist fails to an undefined lookup with no error, and a
 * self-targeted entry paired with a party-targeted twin double-credits its
 * own character.
 */
describe("energy data integrity", () => {
  it("registers every energy weapon under a real weapon id", () => {
    const known = new Set(Object.keys(weaponData as Record<string, unknown>));
    const dead = Object.keys(weaponEnergyById).filter((id) => !known.has(id));
    expect(dead).toEqual([]);
  });

  it("never pairs a self entry with an identical party entry", () => {
    // `resolveRecipients("party")` includes the source, so an entry that
    // repeats a self-targeted grant to the whole party pays the source twice.
    // Distinct clauses of one passive (different amounts/conditions) are fine.
    const doubled: string[] = [];
    for (const [charId, entries] of Object.entries(allSelfEnergy)) {
      for (const a of entries) {
        if (a.target !== "self") continue;
        for (const b of entries) {
          if (b === a || b.target !== "party") continue;
          if (a.source !== b.source || a.action !== b.action) continue;
          if (a.amount !== b.amount) continue;
          if (a.percentRefund !== b.percentRefund) continue;
          doubled.push(`${charId} → ${a.source}:${a.action} (${a.amount})`);
        }
      }
    }
    expect(doubled).toEqual([]);
  });

  it("credits Venti's A4 burst refund once, and never to a teammate", () => {
    const team: TeamMember[] = [
      { id: "venti", element: "Anemo", burstCost: 60 },
      { id: "xiangling", element: "Pyro", burstCost: 80 },
    ];
    // Two Venti bursts: A4 fires "after the effects of Wind's Grand Ode end",
    // so its 15 energy funds the second burst, not the first.
    const timeline: ERTimeline = {
      actions: [
        { char: "venti", action: "Q" },
        { char: "xiangling", action: "Q" },
        { char: "venti", action: "Q" },
      ],
      periodic: [],
    };

    const results = calculateTeamER(team, timeline, {
      calcMode: "zero-energy-start",
    });
    const venti = results.find((r) => r.characterId === "venti");
    const xiangling = results.find((r) => r.characterId === "xiangling");

    // Exactly one 15-energy grant, to Venti, landing in his second window.
    expect(venti?.qWindows?.[0]?.flatEnergy).toBe(0);
    expect(venti?.qWindows?.[1]?.flatEnergy).toBe(15);
    expect(xiangling?.energyBreakdown.flatEnergy).toBe(0);
  });

  // "Restore X Energy for every 100% Energy Recharge <the giver> has."
  // Scaled by the GIVER's ER, so it is resolved to a constant at
  // ASSUMED_BATTERY_ER (250%) rather than solved against the recipient's ER.
  // The cap applies PER CAST, matching the kit wording.
  describe("erScale sources resolve at the assumed battery ER", () => {
    // Dori A4: 5 energy per 100% ER, capped at 15 → min(15, 5 x 2.5) = 12.5
    // per cast. Solo, her E emits 2 Electro particles absorbed on-field by her
    // own Q → 2 x 3.0 = 6 energy at 100% ER.
    const doriRotation = (burstCost: number, casts = 1) =>
      calculateTeamER(
        [{ id: "dori", element: "Electro", burstCost }],
        {
          actions: [
            ...Array.from({ length: casts }, () => ({
              char: "dori",
              action: "E" as const,
            })),
            { char: "dori", action: "Q" as const },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      )[0];

    it("pays the capped amount as a constant, independent of solved ER", () => {
      // 6 particles + 12.5 flat = 18.5 covers an 18.5-cost burst at 100% ER.
      expect(doriRotation(18.5).erNeeded).toBeCloseTo(100, 1);
    });

    it("scales only the particle term with the recipient's ER", () => {
      // 24.5 = 12.5 (constant) + 6 x ER/100  →  ER = 200
      expect(doriRotation(24.5).erNeeded).toBeCloseTo(200, 1);
    });

    it("applies the erScale cap per cast, not per rotation", () => {
      // Two skill casts must give 2 x 12.5 = 25, not a single 15 cap.
      const one = doriRotation(1000, 1);
      const two = doriRotation(1000, 2);
      expect(two.energyBreakdown.scalableEnergy).toBeCloseTo(
        one.energyBreakdown.scalableEnergy * 2,
        6
      );
      expect(two.energyBreakdown.scalableEnergy).toBeCloseTo(25, 6);
    });

    it("delivers party-targeted scalable energy to teammates", () => {
      // Kujou Sara A4: 1.2 per 100% of her ER to the whole party → 3.0 at 250%.
      // Her specialE emits 3 Electro particles, absorbed on-field by Pyro
      // Bennett at the different-element rate → 3 x 1.0 = 3, plus 3.0 = 6.
      const [, bennett] = calculateTeamER(
        [
          { id: "kujou_sara", element: "Electro", burstCost: 80 },
          { id: "bennett", element: "Pyro", burstCost: 6 },
        ],
        {
          actions: [
            { char: "kujou_sara", action: "specialE" },
            { char: "bennett", action: "Q" },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      );
      expect(bennett.erNeeded).toBeCloseTo(100, 1);
    });
  });

  // An "A"-anchored entry is a PER-HIT effect whose `procs` is a cap on how
  // many hits may trigger it. It previously fired once AND enqueued procs-1 at
  // every attack node, while the queue drain paid a tick out of every live
  // entry — compounding as amount x N(N+1)/2 instead of amount x procs.
  describe("per-hit energy sources respect their proc cap", () => {
    const wandererWith = (naCount: number) => {
      const actions = [
        { char: "wanderer", action: "E" as const },
        ...Array.from({ length: naCount }, () => ({
          char: "wanderer",
          action: "NA" as const,
        })),
        { char: "wanderer", action: "Q" as const },
      ];
      return calculateTeamER(
        [
          {
            id: "wanderer",
            element: "Anemo",
            burstCost: 60,
            weaponType: "catalyst",
          },
          { id: "bennett", element: "Pyro", burstCost: 60 },
        ],
        { actions, periodic: [] },
        { calcMode: "zero-energy-start" }
      )[0];
    };

    it("grows at most linearly in the number of attack nodes", () => {
      const ten = wandererWith(10).energyBreakdown.flatEnergy;
      const twenty = wandererWith(20).energyBreakdown.flatEnergy;
      // Quadratic growth puts 20 NAs near 3.8x the 10-NA total. Slightly more
      // than 2x is expected and correct: NA pity is superlinear at low hit
      // counts (a catalyst starts at base = 0, so the first hits earn almost
      // nothing), and Wanderer's P1 is capped at 25 procs.
      expect(twenty).toBeLessThan(ten * 2.5);
    });

    it("never exceeds amount x procs for the capped source", () => {
      // Wanderer P1 is 0.8 energy per attack, capped at 25 procs = 20 energy.
      // Add NA on-hit pity energy (~0.21/hit for a catalyst) as headroom.
      const flat = wandererWith(40).energyBreakdown.flatEnergy;
      expect(flat).toBeLessThan(20 + 40 * 0.25);
    });
  });

  it("boosts Raiden's Musou restore by her A4 at the assumed battery ER", async () => {
    await characterStatsResource.preload();
    // Musou Isshin restores param17 = 2.5 per proc at Q10, to ALL nearby party
    // members (the text says "all nearby party members" with no exclusion —
    // the same kit writes "excluding the Raiden Shogun herself" elsewhere when
    // it means to exclude). P1 multiplies that by 1 + 0.006 x (250 - 100) = 1.9
    // → 4.75 per proc.
    const results = calculateTeamER(
      [
        {
          id: "raiden_shogun",
          element: "Electro",
          burstCost: 90,
          talentLevels: [10, 10, 10],
        },
        { id: "bennett", element: "Pyro", burstCost: 60 },
      ],
      {
        actions: [
          { char: "raiden_shogun", action: "Q" },
          { char: "raiden_shogun", action: "NA" },
          { char: "raiden_shogun", action: "Q" },
        ],
        periodic: [],
      },
      { calcMode: "zero-energy-start" }
    );
    const raiden = results.find((r) => r.characterId === "raiden_shogun");
    // All 5 procs land in window 1: proc #1 at the Q node, one drained on the
    // NA, and the remaining 3 flushed when the next burst closes the window.
    // 5 x 4.75 = 23.75 per party member.
    expect(raiden?.qWindows?.[1]?.scalableEnergy).toBeCloseTo(23.75, 6);
  });

  // NA on-hit energy is a renewal process: mass that procs returns to pity
  // index 0 and keeps earning. Tracking only the first proc's survival
  // probability computes P(at least one proc) and saturates near 1 energy per
  // cycle — a 20-hit sword chain read 1.10 instead of 4.18.
  describe("NA on-hit pity accumulates as a renewal process", () => {
    const chainEnergy = (weaponType: string, hits: number) =>
      calculateTeamER(
        [{ id: "bennett", element: "Pyro", burstCost: 1e6, weaponType }],
        {
          actions: [
            ...Array.from({ length: hits }, () => ({
              char: "bennett",
              action: "NA" as const,
            })),
            { char: "bennett", action: "Q" as const },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      )[0].energyBreakdown.flatEnergy;

    // Values from an independent DP over the same base/increment constants.
    it.each([
      ["sword", 10, 1.9717],
      ["sword", 20, 4.1831],
      ["polearm", 20, 2.5376],
      ["bow", 20, 2.8418],
      ["catalyst", 20, 3.9667],
    ])("%s over %i hits yields ~%f energy", (weaponType, hits, want) => {
      expect(chainEnergy(weaponType as string, hits as number)).toBeCloseTo(
        want as number,
        3
      );
    });
  });

  // Multi-proc effects used to pay out only as many ticks as there happened to
  // be attack nodes after the trigger, and leftovers survived into the next
  // loop iteration to double-deliver there. The total must depend on the
  // effect, not on how many NA chips the user typed.
  describe("multi-proc effects deliver a rotation-shape-invariant total", () => {
    const raidenWith = (naCount: number) =>
      calculateTeamER(
        [
          {
            id: "raiden_shogun",
            element: "Electro",
            burstCost: 90,
            talentLevels: [10, 10, 10],
          },
          { id: "bennett", element: "Pyro", burstCost: 60 },
        ],
        {
          actions: [
            { char: "raiden_shogun", action: "Q" },
            ...Array.from({ length: naCount }, () => ({
              char: "raiden_shogun",
              action: "NA" as const,
            })),
            { char: "raiden_shogun", action: "Q" },
            { char: "bennett", action: "Q" },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      );

    it("pays the same total with zero, one, or many attack nodes", async () => {
      await characterStatsResource.preload();
      const totals = [0, 1, 5, 12].map((n) => {
        const bennett = raidenWith(n).find((r) => r.characterId === "bennett");
        // Bennett's only scalable energy is Raiden's Musou restore. Raiden
        // bursts twice and Bennett once, so both bursts' 5 procs x 4.75 land
        // in his single window: 2 x 23.75 = 47.5 — independent of how many
        // attack nodes Raiden performed.
        return bennett?.energyBreakdown.scalableEnergy ?? -1;
      });
      for (const t of totals) expect(t).toBeCloseTo(47.5, 6);
    });
  });

  // `enemyOrb` / `grantEnergy` nodes deliver energy but put nobody on field,
  // and the UI pins their `char` to team slot 1. They must not intercept the
  // preceding action's particles on the way to the intended absorber.
  describe("pseudo-nodes do not capture particles", () => {
    const team: TeamMember[] = [
      { id: "hu_tao", element: "Pyro", burstCost: 60 },
      { id: "xingqiu", element: "Hydro", burstCost: 80 },
    ];
    const withNode = (extra: TimelineAction[]) =>
      calculateTeamER(
        team,
        {
          actions: [
            { char: "xingqiu", action: "E" },
            ...extra,
            { char: "xingqiu", action: "Q" },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      );

    it("routes particles past an interposed grantEnergy node", () => {
      const base = withNode([]);
      // Anchored to hu_tao (team slot 1) exactly as TimelineStrip does.
      const withGrant = withNode([
        { char: "hu_tao", action: "grantEnergy", energyGrants: {} },
      ]);
      const xqBase = base.find((r) => r.characterId === "xingqiu");
      const xqGrant = withGrant.find((r) => r.characterId === "xingqiu");
      expect(xqGrant?.energyBreakdown.particleEnergy).toBeCloseTo(
        xqBase?.energyBreakdown.particleEnergy ?? -1,
        6
      );
    });

    it("does not divert particles to the pseudo-node's anchor character", () => {
      const withOrb = withNode([
        { char: "hu_tao", action: "enemyOrb", orbCount: 0 },
      ]);
      const huTao = withOrb.find((r) => r.characterId === "hu_tao");
      // Hu Tao never acts here; an orb node with no orbs must give her nothing
      // beyond the off-field share she would get anyway.
      const base = withNode([]).find((r) => r.characterId === "hu_tao");
      expect(huTao?.energyBreakdown.particleEnergy).toBeCloseTo(
        base?.energyBreakdown.particleEnergy ?? -1,
        6
      );
    });
  });

  it("restricts an element-gated party grant to matching recipients", () => {
    // Xilonen C2 restores 25 Energy to ELECTRO party members. Without the
    // filter every teammate — and Geo Xilonen herself — collected it.
    const results = calculateTeamER(
      [
        { id: "xilonen", element: "Geo", burstCost: 70, constellation: 2 },
        { id: "fischl", element: "Electro", burstCost: 60 },
        { id: "bennett", element: "Pyro", burstCost: 60 },
      ],
      {
        actions: [
          { char: "xilonen", action: "E" },
          { char: "fischl", action: "Q" },
          { char: "bennett", action: "Q" },
          { char: "xilonen", action: "Q" },
        ],
        periodic: [],
      },
      { calcMode: "zero-energy-start" }
    );
    const by = (id: string) =>
      results.find((r) => r.characterId === id)?.energyBreakdown.flatEnergy ??
      -1;
    expect(by("fischl")).toBeCloseTo(25, 6);
    expect(by("bennett")).toBe(0);
    expect(by("xilonen")).toBe(0);
  });

  it("drains energy for Shimenawa's Reminiscence 4pc", () => {
    // The only 4pc that COSTS energy: -15 at the wearer's skill node. Leaving
    // it unmodelled made the tool report a requirement that was too low.
    const run = (withSet: boolean) =>
      calculateTeamER(
        [
          {
            id: "bennett",
            element: "Pyro",
            burstCost: 60,
            artifactSet: withSet
              ? { type: "4pc", setId: "shimenawas_reminiscence" }
              : null,
          },
        ],
        {
          actions: [
            { char: "bennett", action: "E" },
            { char: "bennett", action: "Q" },
          ],
          periodic: [],
        },
        { calcMode: "zero-energy-start" }
      )[0];
    expect(run(false).energyBreakdown.flatEnergy).toBe(0);
    expect(run(true).energyBreakdown.flatEnergy).toBe(-15);
    // Draining energy can only raise the requirement.
    expect(run(true).erNeeded).toBeGreaterThan(run(false).erNeeded);
  });

  it("pays Frostbreath's energy to the wearer's teammates, not the wearer", () => {
    // "regenerates N Elemental Energy for OTHER members of their party",
    // 16s CD. One trigger emits one event per teammate; those siblings share
    // an instant and must all land, while a later node stays gated.
    const results = calculateTeamER(
      [
        {
          id: "chongyun",
          element: "Cryo",
          burstCost: 40,
          weaponId: "frostbreath",
        },
        { id: "xingqiu", element: "Hydro", burstCost: 80 },
        { id: "bennett", element: "Pyro", burstCost: 60 },
      ],
      {
        actions: [
          { char: "chongyun", action: "E", reactionProc: true },
          { char: "xingqiu", action: "Q" },
          { char: "bennett", action: "Q" },
          { char: "chongyun", action: "Q" },
        ],
        periodic: [],
      },
      { calcMode: "zero-energy-start" }
    );
    const flat = (id: string) =>
      results.find((r) => r.characterId === id)?.energyBreakdown.flatEnergy ??
      -1;
    expect(flat("xingqiu")).toBeCloseTo(6, 6);
    expect(flat("bennett")).toBeCloseTo(6, 6);
    expect(flat("chongyun")).toBe(0);
  });

  it("exposes a particle element for every character the ER team picker offers", () => {
    const missing = Object.entries(particles)
      .filter(([, entry]) => !entry.element)
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });
});
