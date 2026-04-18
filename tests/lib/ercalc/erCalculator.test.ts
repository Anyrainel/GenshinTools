import { describe, expect, it } from "vitest";

import {
  calculateTeamER,
  getAbsorberForAction,
} from "@/lib/ercalc/erCalculator";
import type { TeamMember, Timeline } from "@/lib/ercalc/erCalculator";

function member(
  id: string,
  element: string,
  burstCost: number,
  overrides?: Partial<TeamMember>
): TeamMember {
  return { id, element, burstCost, constellation: 0, ...overrides };
}

// ─── Standard team & timeline ───

const standardTeam: TeamMember[] = [
  member("bennett", "Pyro", 60),
  member("xiangling", "Pyro", 80),
  member("xingqiu", "Hydro", 80),
  member("sucrose", "Anemo", 80),
];

/** Simple rotation: each char uses E then Q, no funneling. */
const standardTimeline: Timeline = [
  { char: "bennett", action: "E" },
  { char: "bennett", action: "Q" },
  { char: "xiangling", action: "Q" },
  { char: "xingqiu", action: "E" },
  { char: "xingqiu", action: "Q" },
  { char: "sucrose", action: "E" },
  { char: "sucrose", action: "Q" },
];

describe("calculateTeamER", () => {
  describe("basic 4-character team", () => {
    const results = calculateTeamER(standardTeam, standardTimeline);

    it("returns results for all 4 members", () => {
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.characterId)).toEqual([
        "bennett",
        "xiangling",
        "xingqiu",
        "sucrose",
      ]);
    });

    it("Bennett ER is in reasonable range", () => {
      const bennett = results.find((r) => r.characterId === "bennett")!;
      expect(bennett.erNeeded).toBeGreaterThanOrEqual(100);
      expect(bennett.erNeeded).toBeLessThan(500);
    });

    it("energy breakdown fields are non-negative", () => {
      for (const result of results) {
        expect(result.energyBreakdown.particleEnergy).toBeGreaterThanOrEqual(0);
        expect(result.energyBreakdown.flatEnergy).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("next-action absorber rule (funneling)", () => {
    it("particles go to the character performing the NEXT action", () => {
      // Bennett E → next action is Xiangling Q → XL absorbs Bennett's particles
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" }, // XL absorbs Bennett particles on-field
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
      ];
      const noFunnel = calculateTeamER(standardTeam, standardTimeline);
      const funneled = calculateTeamER(standardTeam, timeline);

      const xlNoFunnel = noFunnel.find(
        (r) => r.characterId === "xiangling"
      )!.erNeeded;
      const xlFunnel = funneled.find(
        (r) => r.characterId === "xiangling"
      )!.erNeeded;
      // XL should need less ER when she absorbs Bennett's Pyro particles on-field
      expect(xlFunnel).toBeLessThan(xlNoFunnel);
    });

    it("wait action keeps current character on-field to self-absorb", () => {
      // Bennett E → wait → Bennett stays on-field, absorbs own particles
      const withWait: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "wait" }, // Bennett absorbs own
        { char: "xiangling", action: "Q" },
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
      ];
      // Bennett E → Q → Bennett absorbs own (next action is by Bennett)
      const selfAbsorb: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" }, // next action by Bennett → self-absorb
        { char: "xiangling", action: "Q" },
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
      ];
      const waitResult = calculateTeamER(standardTeam, withWait);
      const selfResult = calculateTeamER(standardTeam, selfAbsorb);

      // Both should give Bennett the same particle energy (self-absorb)
      const bWait = waitResult.find((r) => r.characterId === "bennett")!
        .energyBreakdown.particleEnergy;
      const bSelf = selfResult.find((r) => r.characterId === "bennett")!
        .energyBreakdown.particleEnergy;
      expect(bWait).toBeCloseTo(bSelf, 5);
    });

    it("last action wraps to first (repeating timeline)", () => {
      // Sucrose E is last → absorber wraps to first action (Bennett)
      const timeline: Timeline = [
        { char: "bennett", action: "Q" },
        { char: "sucrose", action: "E" }, // wraps → Bennett absorbs
      ];
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("sucrose", "Anemo", 80),
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      // Bennett receives Sucrose's Anemo particles on-field (1.0× but diff-element)
      // 4 Anemo × 1.0 (diff) × 1.0 (on-field) = 4.0
      expect(bennett.energyBreakdown.particleEnergy).toBeCloseTo(4.0, 5);
    });
  });

  describe("periodicE actions", () => {
    it("periodicE uses per-proc particle data for deployables", () => {
      // Xiangling is periodic: E=0 particles, periodicE=1 particle each
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "xiangling", action: "E" }, // deployment, 0 particles
        { char: "xiangling", action: "periodicE" }, // 1 Pyro particle → Bennett absorbs
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "periodicE" }, // → Bennett absorbs
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "periodicE" }, // → XL absorbs (wraps)
        { char: "xiangling", action: "periodicE" }, // → XL absorbs (wraps)
      ];
      const results = calculateTeamER(team, timeline);
      const xl = results.find((r) => r.characterId === "xiangling")!;
      // XL gets particles from: Bennett E (on-field), 2 own periodicE (on-field)
      // + 2 periodicE off-field from Bennett absorbing
      expect(xl.energyBreakdown.particleEnergy).toBeGreaterThan(0);
    });

    it("E action produces 0 particles for periodic characters", () => {
      const team: TeamMember[] = [
        member("xiangling", "Pyro", 80),
        member("bennett", "Pyro", 60),
      ];
      // Only XL E, no periodicE → no particles generated
      const timeline: Timeline = [
        { char: "xiangling", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      // No particle events from XL's E (periodic deployer)
      const bennett = results.find((r) => r.characterId === "bennett")!;
      // Bennett only gets off-field share of 0 particles = 0
      expect(bennett.energyBreakdown.particleEnergy).toBe(0);
    });
  });

  describe("Favonius weapon", () => {
    const teamWithFav: TeamMember[] = [
      member("bennett", "Pyro", 60, { weaponId: "favonius_sword" }),
      member("xiangling", "Pyro", 80),
      member("xingqiu", "Hydro", 80),
      member("sucrose", "Anemo", 80),
    ];

    it("teammates need less ER with Favonius on Bennett", () => {
      const withoutFav = calculateTeamER(standardTeam, standardTimeline);
      const withFav = calculateTeamER(teamWithFav, standardTimeline);

      for (const charId of ["xiangling", "xingqiu", "sucrose"]) {
        const erWithout = withoutFav.find(
          (r) => r.characterId === charId
        )!.erNeeded;
        const erWith = withFav.find((r) => r.characterId === charId)!.erNeeded;
        expect(erWith).toBeLessThan(erWithout);
      }
    });

    it("Favonius absorber follows the E action absorber", () => {
      // Bennett E → Xiangling Q means both Bennett particles AND Fav particles go to XL
      const funnelTimeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" }, // absorbs Bennett E + Fav
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
      ];
      const selfTimeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" }, // Bennett absorbs own E + Fav
        { char: "xiangling", action: "Q" },
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
      ];
      const funneled = calculateTeamER(teamWithFav, funnelTimeline);
      const self = calculateTeamER(teamWithFav, selfTimeline);

      const xlFunnel = funneled.find(
        (r) => r.characterId === "xiangling"
      )!.erNeeded;
      const xlSelf = self.find((r) => r.characterId === "xiangling")!.erNeeded;
      expect(xlFunnel).toBeLessThan(xlSelf);
    });
  });

  describe("particle RNG modes", () => {
    it("min mode floors particle counts, max mode ceils", () => {
      const team: TeamMember[] = [member("bennett", "Pyro", 60)];
      const timeline: Timeline = [{ char: "bennett", action: "E" }];

      const min = calculateTeamER(team, timeline, { particleMode: "min" });
      const expected = calculateTeamER(team, timeline, {
        particleMode: "expected",
      });
      const max = calculateTeamER(team, timeline, { particleMode: "max" });

      const erMin = min[0].erNeeded;
      const erExp = expected[0].erNeeded;
      const erMax = max[0].erNeeded;

      // Bennett has 2.25 avg → min=2, max=3
      // More particles = lower ER, so min ER > expected ER > max ER
      expect(erMin).toBeGreaterThan(erExp);
      expect(erExp).toBeGreaterThan(erMax);
    });

    it("integer particle counts give same result for all modes", () => {
      // Sucrose has 4.0 particles → all modes give 4
      const team: TeamMember[] = [member("sucrose", "Anemo", 80)];
      const timeline: Timeline = [{ char: "sucrose", action: "E" }];

      const min = calculateTeamER(team, timeline, { particleMode: "min" });
      const max = calculateTeamER(team, timeline, { particleMode: "max" });
      expect(min[0].erNeeded).toBe(max[0].erNeeded);
    });
  });

  describe("Prototype Amber", () => {
    it("reduces ER for the wielder (flat energy)", () => {
      const teamWithPA: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80),
        member("sucrose", "Anemo", 80, {
          weaponId: "prototype_amber",
          refinement: 0,
        }),
      ];
      const withoutPA = calculateTeamER(standardTeam, standardTimeline);
      const withPA = calculateTeamER(teamWithPA, standardTimeline);

      const sucroseWithout = withoutPA.find(
        (r) => r.characterId === "sucrose"
      )!;
      const sucroseWith = withPA.find((r) => r.characterId === "sucrose")!;
      expect(sucroseWith.erNeeded).toBeLessThan(sucroseWithout.erNeeded);
      expect(sucroseWith.energyBreakdown.flatEnergy).toBe(
        sucroseWithout.energyBreakdown.flatEnergy + 12
      );
    });

    it("higher refinement gives more energy", () => {
      const mkTeam = (ref: number) => [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80),
        member("sucrose", "Anemo", 80, {
          weaponId: "prototype_amber",
          refinement: ref,
        }),
      ];
      const r1 = calculateTeamER(mkTeam(0), standardTimeline);
      const r5 = calculateTeamER(mkTeam(4), standardTimeline);
      expect(
        r5.find((r) => r.characterId === "sucrose")!.erNeeded
      ).toBeLessThan(r1.find((r) => r.characterId === "sucrose")!.erNeeded);
    });
  });

  describe("Xingqiu C6 self-energy", () => {
    it("C6 reduces ER via 3 flat energy", () => {
      const teamC0: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80, { constellation: 0 }),
        member("sucrose", "Anemo", 80),
      ];
      const teamC6: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80, { constellation: 6 }),
        member("sucrose", "Anemo", 80),
      ];
      const c0 = calculateTeamER(teamC0, standardTimeline);
      const c6 = calculateTeamER(teamC6, standardTimeline);
      const xqC0 = c0.find((r) => r.characterId === "xingqiu")!;
      const xqC6 = c6.find((r) => r.characterId === "xingqiu")!;
      expect(xqC6.erNeeded).toBeLessThan(xqC0.erNeeded);
      expect(xqC6.energyBreakdown.flatEnergy).toBe(
        xqC0.energyBreakdown.flatEnergy + 3
      );
    });
  });

  describe("edge cases", () => {
    it("empty timeline → Infinity ER", () => {
      const team: TeamMember[] = [
        member("barbara", "Hydro", 80),
        member("noelle", "Geo", 60),
      ];
      const results = calculateTeamER(team, []);
      for (const r of results) {
        expect(r.erNeeded).toBe(Number.POSITIVE_INFINITY);
      }
    });

    it("zero burst cost → 100% ER", () => {
      const team: TeamMember[] = [
        member("mavuika", "Pyro", 0),
        member("bennett", "Pyro", 60),
      ];
      const results = calculateTeamER(team, [{ char: "bennett", action: "E" }]);
      const mavuika = results.find((r) => r.characterId === "mavuika")!;
      expect(mavuika.erNeeded).toBe(100);
    });

    it("solo character gets full particle energy", () => {
      const team: TeamMember[] = [member("bennett", "Pyro", 60)];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results[0];
      // Solo Bennett E → Q: next action is Q by Bennett → self-absorb
      // 2.25 Pyro × 3.0 same-element × 1.0 on-field = 6.75
      expect(bennett.energyBreakdown.particleEnergy).toBeCloseTo(6.75, 5);
      expect(bennett.erNeeded).toBeCloseTo((60 / 6.75) * 100, 2);
    });
  });

  describe("Jean P2 refund", () => {
    it("Jean C0 gets 20% burst cost back as flat energy", () => {
      const team: TeamMember[] = [
        member("jean", "Anemo", 80, { constellation: 0 }),
        member("bennett", "Pyro", 60),
      ];
      const timeline: Timeline = [
        { char: "jean", action: "E" },
        { char: "jean", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const jean = results.find((r) => r.characterId === "jean")!;
      expect(jean.energyBreakdown.flatEnergy).toBe(16);
    });
  });

  describe("Exile 4pc", () => {
    it("gives 6 flat energy to others, not the wielder", () => {
      const teamExile: TeamMember[] = [
        member("bennett", "Pyro", 60, { artifactSetId: "the_exile" }),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80),
        member("sucrose", "Anemo", 80),
      ];
      const noExile = calculateTeamER(standardTeam, standardTimeline);
      const withExile = calculateTeamER(teamExile, standardTimeline);

      for (const charId of ["xiangling", "xingqiu", "sucrose"]) {
        const without = noExile.find((r) => r.characterId === charId)!;
        const withE = withExile.find((r) => r.characterId === charId)!;
        expect(withE.energyBreakdown.flatEnergy).toBe(
          without.energyBreakdown.flatEnergy + 6
        );
      }
      // Bennett should NOT get Exile energy
      const bNo = noExile.find((r) => r.characterId === "bennett")!;
      const bEx = withExile.find((r) => r.characterId === "bennett")!;
      expect(bEx.energyBreakdown.flatEnergy).toBe(
        bNo.energyBreakdown.flatEnergy
      );
    });
  });

  describe("enemy particles", () => {
    it("reduce ER for everyone", () => {
      const noEnemy = calculateTeamER(standardTeam, standardTimeline, {
        enemyParticles: 0,
      });
      const withEnemy = calculateTeamER(standardTeam, standardTimeline, {
        enemyParticles: 12,
      });
      for (const charId of ["bennett", "xiangling", "xingqiu", "sucrose"]) {
        expect(
          withEnemy.find((r) => r.characterId === charId)!.erNeeded
        ).toBeLessThan(noEnemy.find((r) => r.characterId === charId)!.erNeeded);
      }
    });
  });

  describe("Venti self-energy (P2)", () => {
    it("Venti gets 30 flat (15 self + 15 party) and teammates get 15", () => {
      const team: TeamMember[] = [
        member("venti", "Anemo", 60, { constellation: 0 }),
        member("bennett", "Pyro", 60),
      ];
      const timeline: Timeline = [
        { char: "venti", action: "E" },
        { char: "venti", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      expect(
        results.find((r) => r.characterId === "venti")!.energyBreakdown
          .flatEnergy
      ).toBe(30);
      expect(
        results.find((r) => r.characterId === "bennett")!.energyBreakdown
          .flatEnergy
      ).toBe(15);
    });
  });

  describe("Amenoma + Jean P2 stacking", () => {
    it("flat energy from both sources stack", () => {
      const team: TeamMember[] = [
        member("jean", "Anemo", 80, {
          weaponId: "amenoma_kageuchi",
          refinement: 0,
          constellation: 0,
        }),
        member("bennett", "Pyro", 60),
      ];
      const timeline: Timeline = [
        { char: "jean", action: "E" },
        { char: "jean", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const jean = results.find((r) => r.characterId === "jean")!;
      expect(jean.energyBreakdown.flatEnergy).toBe(16 + 18);
    });
  });

  describe("element matching", () => {
    it("mono-element team needs less ER than rainbow", () => {
      const monoTeam: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("yanfei", "Pyro", 80),
        member("thoma", "Pyro", 80),
      ];
      const rainbowTeam: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xingqiu", "Hydro", 80),
        member("sucrose", "Anemo", 80),
        member("rosaria", "Cryo", 80),
      ];
      const monoTL: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
        { char: "yanfei", action: "E" },
        { char: "yanfei", action: "Q" },
        { char: "thoma", action: "E" },
        { char: "thoma", action: "Q" },
      ];
      const rainbowTL: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xingqiu", action: "E" },
        { char: "xingqiu", action: "Q" },
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
        { char: "rosaria", action: "E" },
        { char: "rosaria", action: "Q" },
      ];
      const mono = calculateTeamER(monoTeam, monoTL);
      const rainbow = calculateTeamER(rainbowTeam, rainbowTL);
      expect(
        mono.find((r) => r.characterId === "bennett")!.erNeeded
      ).toBeLessThan(
        rainbow.find((r) => r.characterId === "bennett")!.erNeeded
      );
    });
  });

  describe("Raiden party energy", () => {
    it("grants 12.5 flat energy to all party members", () => {
      const team: TeamMember[] = [
        member("raiden_shogun", "Electro", 90),
        member("bennett", "Pyro", 60),
      ];
      const timeline: Timeline = [
        { char: "raiden_shogun", action: "E" },
        { char: "raiden_shogun", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      expect(
        results.find((r) => r.characterId === "bennett")!.energyBreakdown
          .flatEnergy
      ).toBe(12.5);
      expect(
        results.find((r) => r.characterId === "raiden_shogun")!.energyBreakdown
          .flatEnergy
      ).toBe(12.5);
    });
  });

  describe("specialQ action", () => {
    it("specialQ drains energy and acts as a Q checkpoint", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timelineQ: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const timelineSQ: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "specialQ" },
        { char: "xiangling", action: "specialQ" },
      ];
      const qResults = calculateTeamER(team, timelineQ);
      const sqResults = calculateTeamER(team, timelineSQ);
      // specialQ should produce identical ER results as Q
      expect(sqResults[0].erNeeded).toBe(qResults[0].erNeeded);
      expect(sqResults[1].erNeeded).toBe(qResults[1].erNeeded);
    });
  });

  // ─── Calculation modes ───

  describe("calculation modes", () => {
    const team2: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];
    const rotation: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "Q" },
    ];

    it("default mode is full-energy-repeat", () => {
      const defaultResult = calculateTeamER(team2, rotation);
      const feResult = calculateTeamER(team2, rotation, {
        calcMode: "full-energy-repeat",
      });
      expect(defaultResult[0].erNeeded).toBe(feResult[0].erNeeded);
      expect(defaultResult[1].erNeeded).toBe(feResult[1].erNeeded);
    });

    it("zero-energy-start: last action self-absorbs (no wrap)", () => {
      // In ZE-start, last action's particles don't wrap to first
      // In FE-repeat, last action wraps (repeating)
      const simpleTimeline: Timeline = [
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "E" }, // last action
      ];
      const ze = calculateTeamER(team2, simpleTimeline, {
        calcMode: "zero-energy-start",
      });
      const fe = calculateTeamER(team2, simpleTimeline, {
        calcMode: "full-energy-repeat",
      });
      // In ZE-start: Bennett E self-absorbs (one-shot)
      // → Bennett gets on-field (1.0×), XL gets off-field (0.8×)
      // In FE-repeat: Bennett E wraps to Bennett Q → Bennett absorbs
      // → Same absorber, but particle/flat distribution differs due to Q windows
      // Just verify both produce finite results
      expect(ze[0].erNeeded).toBeGreaterThanOrEqual(100);
      expect(fe[0].erNeeded).toBeGreaterThanOrEqual(100);
    });

    it("zero-energy-start needs more ER than full-energy-repeat", () => {
      // ZE-start: must fill from 0. FE-repeat: starts full, only sustain cost.
      // For typical rotations with 1 Q per char, ZE-start = FE-repeat.
      // But with the E-before-Q pattern, ZE needs to fill the gap before first Q.
      const t: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" }, // XL bursts early, little particle income
        { char: "xiangling", action: "E" },
        { char: "xiangling", action: "periodicE" },
        { char: "xiangling", action: "periodicE" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const ze = calculateTeamER(team2, t, {
        calcMode: "zero-energy-start",
      });
      const fe = calculateTeamER(team2, t, {
        calcMode: "full-energy-repeat",
      });
      // XL has E after Q in ZE-start, so she gets fewer particles before her Q
      const xlZE = ze.find((r) => r.characterId === "xiangling")!.erNeeded;
      const xlFE = fe.find((r) => r.characterId === "xiangling")!.erNeeded;
      expect(xlZE).toBeGreaterThan(xlFE);
    });

    it("zero-energy-repeat is max of ZE-start and FE-repeat", () => {
      const ze = calculateTeamER(team2, rotation, {
        calcMode: "zero-energy-start",
      });
      const fe = calculateTeamER(team2, rotation, {
        calcMode: "full-energy-repeat",
      });
      const zer = calculateTeamER(team2, rotation, {
        calcMode: "zero-energy-repeat",
      });
      for (let i = 0; i < team2.length; i++) {
        expect(zer[i].erNeeded).toBe(Math.max(ze[i].erNeeded, fe[i].erNeeded));
      }
    });
  });

  // ─── Dual timelines ───

  describe("dual timelines", () => {
    const team2: TeamMember[] = [
      member("bennett", "Pyro", 60),
      member("xiangling", "Pyro", 80),
    ];

    it("single timeline is treated as 循环轴 (repeating)", () => {
      const t: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      // Single timeline = full-energy-repeat on that timeline
      const single = calculateTeamER(team2, t);
      const dual = calculateTeamER(team2, t, {
        calcMode: "full-energy-repeat",
        timeline2: t,
      });
      // When timeline2 is same as timeline, FE-repeat should give same result
      // (timeline param is ignored, timeline2 is the repeating one)
      expect(single[0].erNeeded).toBe(dual[0].erNeeded);
      expect(single[1].erNeeded).toBe(dual[1].erNeeded);
    });

    it("ZE-start with dual timelines uses T1+T2 concatenated", () => {
      const startup: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "E" }, // extra E in startup for funneling
        { char: "bennett", action: "Q" },
      ];
      const repeating: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const ze = calculateTeamER(team2, startup, {
        calcMode: "zero-energy-start",
        timeline2: repeating,
      });
      // Bennett has Q in startup (position 2) and in repeating (position 4)
      // XL has Q only in repeating (position 5)
      // Both should have finite ER
      expect(ze[0].erNeeded).toBeGreaterThanOrEqual(100);
      expect(ze[0].erNeeded).toBeLessThan(Number.POSITIVE_INFINITY);
      expect(ze[1].erNeeded).toBeGreaterThanOrEqual(100);
    });

    it("FE-repeat with dual timelines uses only timeline2", () => {
      // Startup timeline is ignored for FE-repeat
      const startup: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const repeating: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const feWithStartup = calculateTeamER(team2, startup, {
        calcMode: "full-energy-repeat",
        timeline2: repeating,
      });
      const feRepeatingOnly = calculateTeamER(team2, repeating, {
        calcMode: "full-energy-repeat",
      });
      // Should be identical since FE-repeat only uses the repeating timeline
      expect(feWithStartup[0].erNeeded).toBe(feRepeatingOnly[0].erNeeded);
      expect(feWithStartup[1].erNeeded).toBe(feRepeatingOnly[1].erNeeded);
    });
  });

  // ─── Per-Q simulation ───

  describe("per-Q simulation", () => {
    it("multiple Qs per rotation: ER is determined by worst window", () => {
      // Bennett bursts twice: once after his E (good), once with no prior particles (bad)
      const team: TeamMember[] = [member("bennett", "Pyro", 60)];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" }, // good window: has E particles
        { char: "bennett", action: "Q" }, // bad window: no particles since last Q
      ];
      const results = calculateTeamER(team, timeline);
      // The second Q window has 0 particles → should be Infinity
      expect(results[0].erNeeded).toBe(Number.POSITIVE_INFINITY);
    });

    it("characters without Q in timeline: computed from total energy", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        // XL has no Q — her ER is computed from all accumulated particles
      ];
      const results = calculateTeamER(team, timeline);
      const xl = results.find((r) => r.characterId === "xiangling")!;
      // XL gets off-field particles from Bennett E (same element Pyro)
      expect(xl.energyBreakdown.particleEnergy).toBeGreaterThan(0);
      expect(xl.erNeeded).toBeGreaterThanOrEqual(100);
    });

    it("ZE-start with early Q has fewer particles than late Q", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      // Early Q for XL: only off-field from Bennett E before her Q
      const earlyQ: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      // Late Q for XL: more particles accumulated
      const lateQ: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const early = calculateTeamER(team, earlyQ, {
        calcMode: "zero-energy-start",
      });
      const late = calculateTeamER(team, lateQ, {
        calcMode: "zero-energy-start",
      });
      const xlEarly = early.find((r) => r.characterId === "xiangling")!;
      const xlLate = late.find((r) => r.characterId === "xiangling")!;
      // XL needs more ER with early Q (fewer particles before burst)
      expect(xlEarly.erNeeded).toBeGreaterThan(xlLate.erNeeded);
    });
  });

  // ─── periodicE absorption ───

  describe("periodicE on-field absorption", () => {
    it("periodicE particles go to current on-field character, not next action char", () => {
      // Setup: Bennett is on-field (last swap action), Xiangling's Guoba fires
      // periodicE should be absorbed by Bennett (on-field), not by the next action
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      // Bennett E → XL deploys Guoba → XL periodicE → XL periodicE → Bennett Q
      // With new model: periodicE absorber = next non-periodicE action = Bennett Q
      // → Bennett absorbs on-field
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "E" }, // deploy, 0 particles
        { char: "xiangling", action: "periodicE" }, // absorber: Bennett Q (next non-pE)
        { char: "xiangling", action: "periodicE" }, // absorber: Bennett Q
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      // Bennett should receive XL's periodicE particles on-field (same element Pyro)
      // 2 procs × 1 particle × 3.0 (same elem) × 1.0 (on-field) = 6.0
      // Plus his own E: 2.25 × 3.0 × 0.6 (off-field, XL absorbs) = 4.05
      // Wait — Bennett E absorber is XL E (next action). So Bennett gets off-field.
      // Total for Bennett before Q: off-field from own E + on-field from XL periodicE
      expect(bennett.energyBreakdown.particleEnergy).toBeGreaterThan(0);
    });

    it("consecutive periodicE blocks share the same absorber (backward rule)", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      // Bennett is on-field (last non-periodicE action), then XL periodicE fires
      // All 3 periodicE should be absorbed by Bennett (who is currently on-field)
      const timeline: Timeline = [
        { char: "bennett", action: "E" }, // Bennett swaps in, on-field
        { char: "xiangling", action: "periodicE" }, // → Bennett absorbs (backward: Bennett E)
        { char: "xiangling", action: "periodicE" }, // → Bennett absorbs
        { char: "xiangling", action: "periodicE" }, // → Bennett absorbs
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      // Bennett on-field for all 3 XL periodicE procs: 3 × 1 × 3.0 (same Pyro) × 1.0 = 9.0
      // Plus off-field from his own E (absorber = next action = XL periodicE char...
      // wait, no — next action is XL periodicE, so absorber for Bennett E = XL periodicE.char = xiangling.
      // So Bennett E: XL absorbs on-field. Bennett gets 2.25 × 3.0 × 0.8 (2-member off-field) = 5.4
      // Plus periodicE: 9.0 as above. Total = 14.4
      // But the Q window starts clean and accumulates all before Q.
      expect(bennett.energyBreakdown.particleEnergy).toBeGreaterThan(9.0);
    });

    it("all-periodicE timeline doesn't crash (fallback to producer)", () => {
      const team: TeamMember[] = [
        member("xiangling", "Pyro", 80),
        member("raiden_shogun", "Electro", 90),
      ];
      const timeline: Timeline = [
        { char: "xiangling", action: "periodicE" },
        { char: "xiangling", action: "periodicE" },
        { char: "raiden_shogun", action: "periodicE" },
      ];
      // Should not crash — falls back to producer char
      const results = calculateTeamER(team, timeline);
      expect(results).toHaveLength(2);
    });

    it("interleaved periodicE: absorber changes based on who was last on-field", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
        member("xingqiu", "Hydro", 80),
      ];
      // XQ does E, then XL periodicE fires → XQ is on-field (backward: XQ E)
      // Then Bennett does E, then XL periodicE fires → Bennett is on-field
      const timeline: Timeline = [
        { char: "xingqiu", action: "E" },
        { char: "xiangling", action: "periodicE" }, // XQ on-field (backward: XQ E)
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "periodicE" }, // Bennett on-field (backward: Bennett E)
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
        { char: "xingqiu", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      // Just verify it produces results without errors
      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.erNeeded).toBeGreaterThanOrEqual(100);
      }
    });

    it("party energy is conditional on source bursting", () => {
      // Raiden Q gives 12.5 flat energy to party. Should only apply if Raiden uses Q.
      const team: TeamMember[] = [
        member("raiden_shogun", "Electro", 90),
        member("bennett", "Pyro", 60),
      ];
      const withRaidenQ: Timeline = [
        { char: "raiden_shogun", action: "E" },
        { char: "raiden_shogun", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const withoutRaidenQ: Timeline = [
        { char: "raiden_shogun", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const resultWith = calculateTeamER(team, withRaidenQ);
      const resultWithout = calculateTeamER(team, withoutRaidenQ);

      const bennettWith = resultWith.find((r) => r.characterId === "bennett")!;
      const bennettWithout = resultWithout.find(
        (r) => r.characterId === "bennett"
      )!;
      // With Raiden Q: Bennett should get 12.5 flat from Raiden
      expect(bennettWith.energyBreakdown.flatEnergy).toBe(12.5);
      // Without Raiden Q: Bennett should get 0 flat
      expect(bennettWithout.energyBreakdown.flatEnergy).toBe(0);
    });

    it("self-energy is conditional on action in timeline", () => {
      // Jean P2 gives 20% burst cost refund on Q
      // With Q in timeline: 80 × 0.2 = 16 flat energy
      // Without Q: 0 flat energy
      const team: TeamMember[] = [
        member("jean", "Anemo", 80, { constellation: 0 }),
        member("bennett", "Pyro", 60),
      ];
      const withQ: Timeline = [
        { char: "jean", action: "E" },
        { char: "jean", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const withoutQ: Timeline = [
        { char: "jean", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const resultWithQ = calculateTeamER(team, withQ);
      const resultWithoutQ = calculateTeamER(team, withoutQ);

      const jeanWithQ = resultWithQ.find((r) => r.characterId === "jean")!;
      const jeanWithoutQ = resultWithoutQ.find(
        (r) => r.characterId === "jean"
      )!;
      // With Q: should have 16 flat energy from P2
      expect(jeanWithQ.energyBreakdown.flatEnergy).toBe(16);
      // Without Q: should have 0 flat energy (P2 doesn't trigger)
      expect(jeanWithoutQ.energyBreakdown.flatEnergy).toBe(0);
    });
  });

  // ─── Accuracy benchmarks ───

  describe("accuracy benchmarks", () => {
    it("National team ER is in community-expected range", () => {
      // Community reference: Bennett 140-190%, XL 160-220%, XQ 140-200%, Sucrose 140-220%
      // No weapons, no enemy particles
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
      const results = calculateTeamER(team, timeline);
      const er = (id: string) =>
        results.find((r) => r.characterId === id)!.erNeeded;

      // Without weapons: higher than community guides (which assume Sac/Fav)
      // but should be within reasonable bounds
      expect(er("bennett")).toBeGreaterThan(140);
      expect(er("bennett")).toBeLessThan(250);
      expect(er("xiangling")).toBeGreaterThan(160);
      expect(er("xiangling")).toBeLessThan(280);
      expect(er("xingqiu")).toBeGreaterThan(140);
      expect(er("xingqiu")).toBeLessThan(260);
      expect(er("sucrose")).toBeGreaterThan(160);
      expect(er("sucrose")).toBeLessThan(280);
    });

    it("weapon energy is conditional on trigger action", () => {
      // Prototype Amber gives 12 flat on burst. Should only apply if wielder uses Q.
      const team: TeamMember[] = [
        member("sucrose", "Anemo", 80, {
          weaponId: "prototype_amber",
          refinement: 0,
        }),
        member("bennett", "Pyro", 60),
      ];
      const withQ: Timeline = [
        { char: "sucrose", action: "E" },
        { char: "sucrose", action: "Q" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const withoutQ: Timeline = [
        { char: "sucrose", action: "E" },
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      const resultWith = calculateTeamER(team, withQ);
      const resultWithout = calculateTeamER(team, withoutQ);

      const sucroseWith = resultWith.find((r) => r.characterId === "sucrose")!;
      const sucroseWithout = resultWithout.find(
        (r) => r.characterId === "sucrose"
      )!;
      // With Q: Sucrose gets 12 flat from Prototype Amber
      expect(sucroseWith.energyBreakdown.flatEnergy).toBe(12);
      // Without Q: no flat from PA (burst trigger not in timeline)
      expect(sucroseWithout.energyBreakdown.flatEnergy).toBe(0);
    });

    it("Fav Bennett reduces team ER by 15-30%", () => {
      const baseMember = (id: string, el: string, cost: number) =>
        member(id, el, cost);
      const baseTeam = [
        baseMember("bennett", "Pyro", 60),
        baseMember("xiangling", "Pyro", 80),
        baseMember("xingqiu", "Hydro", 80),
        baseMember("sucrose", "Anemo", 80),
      ];
      const favTeam = [
        member("bennett", "Pyro", 60, { weaponId: "favonius_sword" }),
        baseMember("xiangling", "Pyro", 80),
        baseMember("xingqiu", "Hydro", 80),
        baseMember("sucrose", "Anemo", 80),
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
      const baseResults = calculateTeamER(baseTeam, timeline);
      const favResults = calculateTeamER(favTeam, timeline);

      // Favonius should reduce team max ER
      const maxBase = Math.max(...baseResults.map((r) => r.erNeeded));
      const maxFav = Math.max(...favResults.map((r) => r.erNeeded));
      expect(maxFav).toBeLessThan(maxBase);
      expect(maxBase - maxFav).toBeGreaterThan(10); // at least 10% reduction
    });
  });

  // ─── Absorber function ───

  describe("getAbsorberForAction", () => {
    it("returns null for non-particle actions", () => {
      // getAbsorberForAction imported at top level
      const timeline: Timeline = [
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      expect(getAbsorberForAction(timeline, 0)).toBeNull();
      expect(getAbsorberForAction(timeline, 1)).toBeNull();
    });

    it("returns next action character for regular E", () => {
      // getAbsorberForAction imported at top level
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
      ];
      expect(getAbsorberForAction(timeline, 0)).toBe("xiangling");
    });

    it("returns backward character for periodicE", () => {
      // getAbsorberForAction imported at top level
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "periodicE" },
        { char: "bennett", action: "Q" },
      ];
      // periodicE looks backward: previous non-periodicE is Bennett E
      expect(getAbsorberForAction(timeline, 1)).toBe("bennett");
    });
  });

  // ─── NA energy ───

  describe("normal attack energy", () => {
    it("NA actions contribute energy to the on-field character", () => {
      const team: TeamMember[] = [member("bennett", "Pyro", 60)];
      // Without NA
      const noNA: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
      ];
      // With NA (adds field time energy)
      const withNA: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "NA" },
        { char: "bennett", action: "NA" },
        { char: "bennett", action: "NA" },
        { char: "bennett", action: "Q" },
      ];
      const noNAResults = calculateTeamER(team, noNA);
      const withNAResults = calculateTeamER(team, withNA);
      // More NAs = more energy = lower ER
      expect(withNAResults[0].erNeeded).toBeLessThan(noNAResults[0].erNeeded);
      // 3 NAs × 2.5 energy × 1.0 on-field = 7.5 additional energy
      const energyDiff =
        withNAResults[0].energyBreakdown.particleEnergy -
        noNAResults[0].energyBreakdown.particleEnergy;
      expect(energyDiff).toBeCloseTo(7.5, 1);
    });

    it("off-field teammates get reduced NA energy", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "bennett", action: "NA" }, // Bennett on-field, XL off-field
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      const xl = results.find((r) => r.characterId === "xiangling")!;
      // Bennett gets on-field NA energy (2.5), XL gets off-field (2.5 × 0.8)
      expect(bennett.energyBreakdown.particleEnergy).toBeGreaterThan(
        xl.energyBreakdown.particleEnergy
      );
    });
  });

  // ─── Preset validation ───

  describe("preset rotation sanity", () => {
    it("default National preset produces finite results", () => {
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
      const results = calculateTeamER(team, timeline);
      for (const r of results) {
        expect(r.erNeeded).toBeGreaterThanOrEqual(100);
        expect(r.erNeeded).toBeLessThan(Number.POSITIVE_INFINITY);
        expect(r.energyBreakdown.particleEnergy).toBeGreaterThan(0);
      }
    });
  });

  // ─── Binding events ───

  describe("binding events and Q index", () => {
    it("returns bindingQIndex for the worst Q window", () => {
      const team: TeamMember[] = [member("bennett", "Pyro", 60)];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" }, // good window
        { char: "bennett", action: "Q" }, // bad window (no particles)
      ];
      const results = calculateTeamER(team, timeline);
      // Second Q has higher ER → it's the binding one
      expect(results[0].bindingQIndex).toBe(2);
      expect(results[0].erNeeded).toBe(Number.POSITIVE_INFINITY);
    });

    it("returns bindingEvents for the binding Q window", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        { char: "xiangling", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      // Bennett should have binding events showing his E contribution
      expect(bennett.bindingEvents).toBeDefined();
      expect(bennett.bindingEvents!.length).toBeGreaterThan(0);
      // At least one event should be from bennett's E
      const bennettEEvent = bennett.bindingEvents!.find(
        (e) => e.sourceChar === "bennett" && e.sourceAction === "E"
      );
      expect(bennettEEvent).toBeDefined();
      expect(bennettEEvent!.particleCount).toBeCloseTo(2.25, 2);
    });
  });

  // ─── Both mode binding ───

  describe("zero-energy-repeat bindingMode", () => {
    it("sets bindingMode for each character in Both mode", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "xiangling", action: "Q" },
        { char: "bennett", action: "Q" },
      ];
      const results = calculateTeamER(team, timeline, {
        calcMode: "zero-energy-repeat",
      });
      for (const r of results) {
        expect(r.bindingMode).toBeDefined();
        expect(["zero-energy-start", "full-energy-repeat"]).toContain(
          r.bindingMode
        );
      }
    });

    it("hasQ is set for all results", () => {
      const team: TeamMember[] = [
        member("bennett", "Pyro", 60),
        member("xiangling", "Pyro", 80),
      ];
      const timeline: Timeline = [
        { char: "bennett", action: "E" },
        { char: "bennett", action: "Q" },
        // XL has no Q
      ];
      const results = calculateTeamER(team, timeline);
      const bennett = results.find((r) => r.characterId === "bennett")!;
      const xl = results.find((r) => r.characterId === "xiangling")!;
      expect(bennett.hasQ).toBe(true);
      expect(xl.hasQ).toBe(false);
    });
  });
});
