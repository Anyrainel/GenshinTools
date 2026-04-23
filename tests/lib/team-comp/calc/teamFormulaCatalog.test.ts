import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import { describe, expect, it } from "vitest";

import "@/lib/dmgcalc";

await Promise.all([
  characterStatsResource.preload(),
  weaponStatsResource.preload(),
]);

const NATIONAL_TEAM: TeamSlotConfig[] = [
  {
    charId: "xiangling",
    charLevel: 90,
    constellation: 6,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "bennett",
    charLevel: 90,
    constellation: 6,
    weaponId: "aquila_favonia",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "noblesse_oblige" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "raiden_shogun",
    charLevel: 90,
    constellation: 0,
    weaponId: "the_catch",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
];

const KAZUHA_TEAM: TeamSlotConfig[] = [
  {
    charId: "hu_tao",
    charLevel: 90,
    constellation: 1,
    weaponId: "staff_of_homa",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "crimson_witch_of_flames" },
  },
  {
    charId: "kaedehara_kazuha",
    charLevel: 90,
    constellation: 0,
    weaponId: "iron_sting",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "viridescent_venerer" },
  },
  {
    charId: "xingqiu",
    charLevel: 90,
    constellation: 6,
    weaponId: "sacrificial_sword",
    refinement: 5,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
  {
    charId: "yelan",
    charLevel: 90,
    constellation: 0,
    weaponId: "aqua_simulacra",
    refinement: 1,
    artifactSet: { type: "4pc", setId: "emblem_of_severed_fate" },
  },
];

const CHAR_IDS = NATIONAL_TEAM.map((c) => c.charId);

describe("TeamFormulaCatalog", () => {
  describe("getFormulaIds", () => {
    it("returns formulas grouped by character", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const ids = tb.catalog.getFormulaIds();
      for (const charId of CHAR_IDS) {
        expect(ids[charId]).toBeDefined();
        expect(Object.keys(ids[charId]).length).toBeGreaterThan(0);
      }
    });

    it("includes reaction formulas under triggerer characters", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const ids = tb.catalog.getFormulaIds();
      // National team has overloaded (Pyro + Electro)
      const allFormulas = Object.values(ids).flatMap((r) => Object.keys(r));
      const rxFormulas = allFormulas.filter((f) => f.startsWith("rx-"));
      expect(rxFormulas.length).toBeGreaterThan(0);
    });
  });

  describe("getAllFormulaIds", () => {
    it("returns same characters as getFormulaIds", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const ids = tb.catalog.getFormulaIds();
      const allIds = tb.catalog.getAllFormulaIds();
      expect(Object.keys(allIds).sort()).toEqual(Object.keys(ids).sort());
    });

    it("includes minC and enabled metadata", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const allIds = tb.catalog.getAllFormulaIds();
      for (const charId of CHAR_IDS) {
        for (const [_fid, meta] of Object.entries(allIds[charId])) {
          expect(meta).toHaveProperty("label");
          expect(meta).toHaveProperty("minC");
          expect(meta).toHaveProperty("enabled");
          expect(typeof meta.minC).toBe("number");
          expect(typeof meta.enabled).toBe("boolean");
        }
      }
    });

    it("is a superset of getFormulaIds (includes constellation-locked formulas)", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const ids = tb.catalog.getFormulaIds();
      const allIds = tb.catalog.getAllFormulaIds();
      for (const charId of CHAR_IDS) {
        for (const fid of Object.keys(ids[charId])) {
          expect(allIds[charId][fid]).toBeDefined();
        }
      }
    });

    it("reaction formulas have minC=0 and enabled=true", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const allIds = tb.catalog.getAllFormulaIds();
      for (const charId of CHAR_IDS) {
        for (const [fid, meta] of Object.entries(allIds[charId])) {
          if (fid.startsWith("rx-")) {
            expect(meta.minC).toBe(0);
            expect(meta.enabled).toBe(true);
          }
        }
      }
    });
  });

  describe("getCombo / resolveCombo", () => {
    it("getCombo returns unified char + reaction counts", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const combo = tb.catalog.getCombo("xiangling");
      expect(Object.keys(combo).length).toBeGreaterThan(0);
      for (const count of Object.values(combo)) {
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    it("resolveCombo at construction constellation equals getCombo", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      for (const config of NATIONAL_TEAM) {
        const combo = tb.catalog.getCombo(config.charId);
        const resolved = tb.catalog.resolveCombo(
          config.charId,
          config.constellation
        );
        expect(resolved).toEqual(combo);
      }
    });

    it("resolveCombo at C0 may differ from getCombo at higher C", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      // Xiangling is C6 in config — resolving at C0 may lose C-gated entries
      const c6 = tb.catalog.resolveCombo("xiangling", 6);
      const c0 = tb.catalog.resolveCombo("xiangling", 0);
      // At minimum, both should have some entries
      expect(Object.keys(c6).length).toBeGreaterThan(0);
      expect(Object.keys(c0).length).toBeGreaterThan(0);
    });
  });

  describe("formulaIndex", () => {
    it("contains entries for all formula IDs from getFormulaIds", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const ids = tb.catalog.getFormulaIds();
      for (const charFormulas of Object.values(ids)) {
        for (const fid of Object.keys(charFormulas)) {
          expect(tb.catalog.formulaIndex.has(fid)).toBe(true);
        }
      }
    });

    it("each entry has owner, label, and parts", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      for (const [_fid, entry] of tb.catalog.formulaIndex) {
        expect(entry.label).toBeDefined();
        expect(entry.label.en).toBeTruthy();
        expect(Array.isArray(entry.parts)).toBe(true);
        expect(entry.owner).toBeTruthy();
      }
    });
  });

  describe("collectCharFormulaTags", () => {
    it("returns tags for each character", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const tags = tb.catalog.collectCharFormulaTags();
      for (const charId of CHAR_IDS) {
        expect(tags[charId]).toBeDefined();
        expect(tags[charId].length).toBeGreaterThan(0);
      }
    });

    it("tags have element and ability fields", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const tags = tb.catalog.collectCharFormulaTags();
      for (const charTags of Object.values(tags)) {
        for (const tag of charTags) {
          expect(tag.element).toBeTruthy();
          expect(tag.ability).toBeTruthy();
        }
      }
    });

    it("tags are deduplicated (no duplicate element|ability|reaction combos)", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const tags = tb.catalog.collectCharFormulaTags();
      for (const charTags of Object.values(tags)) {
        const keys = charTags.map(
          (t) => `${t.element}|${t.ability}|${t.reaction}`
        );
        expect(new Set(keys).size).toBe(keys.length);
      }
    });
  });

  describe("offFieldStatus / hasOffFieldParts", () => {
    it("returns 'none' for unknown formula", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      expect(tb.catalog.offFieldStatus("nonexistent")).toBe("none");
      expect(tb.catalog.hasOffFieldParts("nonexistent")).toBe(false);
    });

    it("hasOffFieldParts is consistent with offFieldStatus", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      for (const [fid] of tb.catalog.formulaIndex) {
        const status = tb.catalog.offFieldStatus(fid);
        const hasOff = tb.catalog.hasOffFieldParts(fid);
        if (status === "none") {
          expect(hasOff).toBe(false);
        } else {
          expect(hasOff).toBe(true);
        }
      }
    });
  });

  describe("getReactionComboGrid", () => {
    it("returns cached result on second call", () => {
      const tb = new TeamBuild(NATIONAL_TEAM);
      const first = tb.catalog.getReactionComboGrid();
      const second = tb.catalog.getReactionComboGrid();
      expect(first).toBe(second);
    });
  });

  describe("cross-team consistency", () => {
    it("Kazuha team formulas include vaporize-eligible entries", () => {
      const tb = new TeamBuild(KAZUHA_TEAM);
      const ids = tb.catalog.getFormulaIds();
      // Hu Tao should have formulas
      expect(Object.keys(ids.hu_tao).length).toBeGreaterThan(0);
      // Kazuha should have swirl formulas via reactions
      const kazuhaFormulas = Object.keys(ids.kaedehara_kazuha);
      const swirlFormulas = kazuhaFormulas.filter((f) =>
        f.startsWith("rx-swirl")
      );
      expect(swirlFormulas.length).toBeGreaterThan(0);
    });
  });
});
