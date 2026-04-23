import { describe, expect, it } from "vitest";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { TeamBuffLedger } from "@/lib/dmgcalc/core/teamBuffLedger";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";

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

const CHAR_IDS = NATIONAL_TEAM.map((c) => c.charId);

function buildLedger(configs = NATIONAL_TEAM): TeamBuffLedger {
  const tb = new TeamBuild(configs);
  return tb.buffLedger;
}

describe("TeamBuffLedger", () => {
  describe("construction and allBuffs", () => {
    it("indexes all buffs from team composition", () => {
      const ledger = buildLedger();
      expect(ledger.allBuffs.length).toBeGreaterThan(0);
      for (const ib of ledger.allBuffs) {
        expect(ib.buffKey).toBeTruthy();
        expect(ib.providerCharId).toBeTruthy();
        expect(ib.buff).toBeDefined();
      }
    });

    it("stores charIds and teamMeta references", () => {
      const ledger = buildLedger();
      expect(ledger.charIds).toEqual(CHAR_IDS);
      expect(ledger.teamMeta.characters).toEqual(CHAR_IDS);
    });

    it("each buff has a unique buffKey within provider scope", () => {
      const ledger = buildLedger();
      const keys = ledger.allBuffs.map((ib) => ib.buffKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe("getBuffByKey", () => {
    it("returns the indexed buff for a known key", () => {
      const ledger = buildLedger();
      const firstBuff = ledger.allBuffs[0];
      const found = ledger.getBuffByKey(firstBuff.buffKey);
      expect(found).toBe(firstBuff);
    });

    it("returns undefined for an unknown key", () => {
      const ledger = buildLedger();
      expect(ledger.getBuffByKey("nonexistent-key")).toBeUndefined();
    });
  });

  describe("getStackLimitedBuffs", () => {
    it("returns only buffs with maxStacks", () => {
      const ledger = buildLedger();
      const stackLimited = ledger.getStackLimitedBuffs();
      for (const ib of stackLimited) {
        expect(ib.buff.source.maxStacks).not.toBeNull();
        expect(ib.buff.source.maxStacks).not.toBeUndefined();
      }
    });

    it("is a subset of allBuffs", () => {
      const ledger = buildLedger();
      const stackLimited = ledger.getStackLimitedBuffs();
      const allKeys = new Set(ledger.allBuffs.map((ib) => ib.buffKey));
      for (const ib of stackLimited) {
        expect(allKeys.has(ib.buffKey)).toBe(true);
      }
    });
  });

  describe("getApplicable", () => {
    it("returns non-empty buff list for all (target, onField) pairs", () => {
      const ledger = buildLedger();
      for (const target of CHAR_IDS) {
        for (const onField of CHAR_IDS) {
          const buffs = ledger.getApplicable(target, onField);
          expect(buffs.length).toBeGreaterThan(0);
        }
      }
    });

    it("returns empty for unknown character IDs", () => {
      const ledger = buildLedger();
      expect(ledger.getApplicable("unknown", "unknown")).toEqual([]);
    });

    it("filters out excluded buff keys", () => {
      const ledger = buildLedger();
      const all = ledger.getApplicable("xiangling", "xiangling");
      expect(all.length).toBeGreaterThan(1);

      const excludeKey = all[0].buffKey;
      const filtered = ledger.getApplicable(
        "xiangling",
        "xiangling",
        new Set([excludeKey])
      );
      expect(filtered.length).toBe(all.length - 1);
      expect(filtered.some((ib) => ib.buffKey === excludeKey)).toBe(false);
    });

    it("returns same result with empty excludeKeys", () => {
      const ledger = buildLedger();
      const all = ledger.getApplicable("xiangling", "xiangling");
      const withEmpty = ledger.getApplicable(
        "xiangling",
        "xiangling",
        new Set()
      );
      expect(withEmpty).toBe(all);
    });
  });

  describe("isApplicableTo", () => {
    it("returns true for a known applicable buff", () => {
      const ledger = buildLedger();
      const applicable = ledger.getApplicable("xiangling", "xiangling");
      expect(applicable.length).toBeGreaterThan(0);
      expect(
        ledger.isApplicableTo(applicable[0].buffKey, "xiangling", "xiangling")
      ).toBe(true);
    });

    it("returns false for unknown buffKey", () => {
      const ledger = buildLedger();
      expect(
        ledger.isApplicableTo("nonexistent", "xiangling", "xiangling")
      ).toBe(false);
    });

    it("is consistent with getApplicable results", () => {
      const ledger = buildLedger();
      const applicable = ledger.getApplicable("bennett", "raiden_shogun");
      const applicableKeys = new Set(applicable.map((ib) => ib.buffKey));

      for (const ib of ledger.allBuffs) {
        const expected = applicableKeys.has(ib.buffKey);
        expect(
          ledger.isApplicableTo(ib.buffKey, "bennett", "raiden_shogun")
        ).toBe(expected);
      }
    });
  });

  describe("couldBuffApplyToChar", () => {
    it("returns true if buff applies in either field state", () => {
      const ledger = buildLedger();
      for (const ib of ledger.allBuffs) {
        const couldApply = ledger.couldBuffApplyToChar(
          ib.buff,
          ib.providerCharId,
          ib.providerCharId
        );
        const onField = ledger.isApplicableTo(
          ib.buffKey,
          ib.providerCharId,
          ib.providerCharId
        );
        const offField = CHAR_IDS.filter((id) => id !== ib.providerCharId).some(
          (onFieldId) =>
            ledger.isApplicableTo(ib.buffKey, ib.providerCharId, onFieldId)
        );
        if (onField || offField) {
          expect(couldApply).toBe(true);
        }
      }
    });
  });

  describe("isTeamApplicable", () => {
    it("returns true for buffs that apply to at least one team member", () => {
      const ledger = buildLedger();
      for (const ib of ledger.allBuffs) {
        const teamApplicable = ledger.isTeamApplicable(
          ib.buff,
          ib.providerCharId
        );
        // Every buff in allBuffs should be team-applicable (otherwise
        // it wouldn't have been added)
        expect(teamApplicable).toBe(true);
      }
    });
  });

  describe("getDynamicMid / getDynamicPost", () => {
    it("dynamic mid and post are disjoint subsets of applicable", () => {
      const ledger = buildLedger();
      for (const target of CHAR_IDS) {
        const all = ledger.getApplicable(target, target);
        const mid = ledger.getDynamicMid(target, target);
        const post = ledger.getDynamicPost(target, target);

        const allKeys = new Set(all.map((ib) => ib.buffKey));
        for (const ib of mid) {
          expect(allKeys.has(ib.buffKey)).toBe(true);
        }
        for (const ib of post) {
          expect(allKeys.has(ib.buffKey)).toBe(true);
        }

        // mid and post should be disjoint
        const midKeys = new Set(mid.map((ib) => ib.buffKey));
        for (const ib of post) {
          expect(midKeys.has(ib.buffKey)).toBe(false);
        }
      }
    });

    it("filters out excluded buff keys", () => {
      const ledger = buildLedger();
      const mid = ledger.getDynamicMid("xiangling", "xiangling");
      if (mid.length > 0) {
        const excludeKey = mid[0].buffKey;
        const filtered = ledger.getDynamicMid(
          "xiangling",
          "xiangling",
          new Set([excludeKey])
        );
        expect(filtered.length).toBe(mid.length - 1);
      }

      const post = ledger.getDynamicPost("xiangling", "xiangling");
      if (post.length > 0) {
        const excludeKey = post[0].buffKey;
        const filtered = ledger.getDynamicPost(
          "xiangling",
          "xiangling",
          new Set([excludeKey])
        );
        expect(filtered.length).toBe(post.length - 1);
      }
    });
  });

  describe("getApplicableStatic", () => {
    it("returns StatBuff[] (unwrapped from IndexedBuff)", () => {
      const ledger = buildLedger();
      const statics = ledger.getApplicableStatic("xiangling", "xiangling");
      for (const buff of statics) {
        expect(buff).toBeDefined();
        expect(buff.source).toBeDefined();
      }
    });

    it("respects excludeKeys", () => {
      const ledger = buildLedger();
      const all = ledger.getApplicable("xiangling", "xiangling");
      const allStatic = ledger.getApplicableStatic("xiangling", "xiangling");

      if (all.length > 1) {
        const excludeKey = all[0].buffKey;
        const filtered = ledger.getApplicableStatic(
          "xiangling",
          "xiangling",
          new Set([excludeKey])
        );
        expect(filtered.length).toBeLessThanOrEqual(allStatic.length);
      }
    });
  });

  describe("field-state sensitivity", () => {
    it("on-field vs off-field may yield different applicable buffs", () => {
      const ledger = buildLedger();
      // Bennett's buff is often on-field-only for the target
      const xlOnField = ledger.getApplicable("xiangling", "xiangling");
      const xlOffField = ledger.getApplicable("xiangling", "raiden_shogun");

      // At minimum, the same buff set structure should exist
      expect(xlOnField.length).toBeGreaterThan(0);
      expect(xlOffField.length).toBeGreaterThan(0);
      // The actual counts may differ due to field-dependent buffs
    });
  });
});
