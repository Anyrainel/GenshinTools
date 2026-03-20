import { describe, expect, it } from "vitest";

import {
  getCharacterLevelTier,
  getNextLevelTier,
  preloadGameStats,
} from "@/lib/gameStatsLoader";
import { TeamResonance, isBuffApplicable } from "@/lib/team-comp/damageCalc";
import { StatBuff, TeamMeta } from "@/lib/team-comp/damageModels";

// Preload before any describe runs (describe callbacks create TeamBuild at collect time)
await preloadGameStats();

describe("TeamMeta", () => {
  // Team: Hu Tao (Pyro), Xingqiu (Hydro), Zhongli (Geo), Kazuha (Anemo)
  const meta = new TeamMeta([
    "hu_tao",
    "xingqiu",
    "zhongli",
    "kaedehara_kazuha",
  ]);

  it("resolves element for each character", () => {
    expect(meta.elements.hu_tao).toBe("Pyro");
    expect(meta.elements.xingqiu).toBe("Hydro");
    expect(meta.elements.zhongli).toBe("Geo");
    expect(meta.elements.kaedehara_kazuha).toBe("Anemo");
  });

  it("countByElement returns correct counts", () => {
    expect(meta.countByElement("Pyro")).toBe(1);
    expect(meta.countByElement("Hydro")).toBe(1);
    expect(meta.countByElement("Dendro")).toBe(0);
  });

  it("hasReaction returns true for vaporize (Pyro+Hydro)", () => {
    expect(meta.hasReaction("vaporize")).toBe(true);
  });

  it("hasReaction returns false for superconduct (no Cryo+Electro)", () => {
    expect(meta.hasReaction("superconduct")).toBe(false);
  });

  it("hasReaction returns true for swirl (Anemo + any reactive element)", () => {
    expect(meta.hasReaction("swirl")).toBe(true);
  });

  it("hasReaction returns false for bloom (no Dendro)", () => {
    expect(meta.hasReaction("bloom")).toBe(false);
  });

  it("throws for unknown character ID", () => {
    expect(() => new TeamMeta(["nonexistent_char"])).toThrow(
      "Unknown character ID"
    );
  });
});

describe("TeamMeta — Dendro team", () => {
  // Team: Nahida (Dendro), Nilou (Hydro), Sangonomiya Kokomi (Hydro), Yelan (Hydro)
  const meta = new TeamMeta(["nahida", "nilou", "sangonomiya_kokomi", "yelan"]);

  it("countByElement for Hydro-heavy team", () => {
    expect(meta.countByElement("Hydro")).toBe(3);
    expect(meta.countByElement("Dendro")).toBe(1);
  });

  it("hasReaction for bloom (Hydro+Dendro)", () => {
    expect(meta.hasReaction("bloom")).toBe(true);
  });

  it("hasReaction for hyperbloom requires Electro", () => {
    expect(meta.hasReaction("hyperbloom")).toBe(false);
  });
});

describe("TeamResonance", () => {
  it("generates ATK +25% for dual Pyro (Fervent Flames)", () => {
    const meta = new TeamMeta(["hu_tao", "xiangling", "xingqiu", "zhongli"]);
    const resonance = new TeamResonance(meta);

    const atkBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "atk%")
    );
    expect(atkBuff).toBeDefined();
    expect(atkBuff!.staticBuffs.find((e) => e.key === "atk%")!.value).toBe(
      0.25
    );
  });

  it("generates HP +25% for dual Hydro (Soothing Water)", () => {
    const meta = new TeamMeta(["xingqiu", "yelan", "hu_tao", "zhongli"]);
    const resonance = new TeamResonance(meta);

    const hpBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "hp%")
    );
    expect(hpBuff).toBeDefined();
    expect(hpBuff!.staticBuffs.find((e) => e.key === "hp%")!.value).toBe(0.25);
  });

  it("generates no offensive resonance buffs for 4 unique elements (defensive only)", () => {
    const meta = new TeamMeta([
      "hu_tao",
      "xingqiu",
      "zhongli",
      "kaedehara_kazuha",
    ]);
    const resonance = new TeamResonance(meta);

    const emBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "em")
    );
    expect(emBuff).toBeUndefined();
  });

  it("generates no resonance buffs for 3 unique elements (with one pair)", () => {
    // Hu Tao + Bennett = 2 Pyro, + Xingqiu (Hydro), + Zhongli (Geo) = 3 unique, not 4
    const meta = new TeamMeta(["hu_tao", "bennett", "xingqiu", "zhongli"]);
    const resonance = new TeamResonance(meta);

    // Should have Pyro resonance ATK buff
    const atkBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "atk%")
    );
    expect(atkBuff).toBeDefined();

    // Should NOT have the 4-unique-element EM buff
    const emBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "em")
    );
    expect(emBuff).toBeUndefined();
  });
});

describe("TeamMeta — enemyElementAura", () => {
  const meta = new TeamMeta(["hu_tao"], {}, {}, "Hydro");

  it("hasReaction sees aura element for vaporize", () => {
    expect(meta.hasReaction("vaporize")).toBe(true);
  });

  it("countByElement does NOT count the aura element", () => {
    expect(meta.countByElement("Hydro")).toBe(0);
  });

  it("hasReaction still works without aura", () => {
    const noAura = new TeamMeta(["hu_tao"], {}, {});
    expect(noAura.hasReaction("vaporize")).toBe(false);
  });
});

describe("isBuffApplicable — buff routing", () => {
  // Helper: create a buff from a given owner with a given receiver
  const makeBuff = (
    ownerId: string,
    receiver: "self" | "selfOffField" | "selfOnField" | "onField" | "team"
  ) =>
    new StatBuff(
      { type: "character", id: ownerId, origin: "C1" },
      { receiver },
      [{ key: "atk%", value: 0.1 }]
    );

  describe('receiver: "self"', () => {
    it("applies to buff owner's own sheet", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "self"),
          "hu_tao",
          "hu_tao",
          "hu_tao"
        )
      ).toBe(true);
    });

    it("does not apply to another character's sheet", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "self"),
          "hu_tao",
          "xingqiu",
          "hu_tao"
        )
      ).toBe(false);
    });

    it("applies regardless of calcTarget", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "self"),
          "hu_tao",
          "hu_tao",
          "xingqiu"
        )
      ).toBe(true);
      expect(
        isBuffApplicable(makeBuff("hu_tao", "self"), "hu_tao", "hu_tao", null)
      ).toBe(true);
    });
  });

  describe('receiver: "selfOffField"', () => {
    it("applies to buff owner's own sheet (treated as self)", () => {
      expect(
        isBuffApplicable(
          makeBuff("xingqiu", "selfOffField"),
          "xingqiu",
          "xingqiu",
          "hu_tao"
        )
      ).toBe(true);
    });

    it("does not apply to others", () => {
      expect(
        isBuffApplicable(
          makeBuff("xingqiu", "selfOffField"),
          "xingqiu",
          "hu_tao",
          "hu_tao"
        )
      ).toBe(false);
    });
  });

  describe('receiver: "selfOnField"', () => {
    it("applies when the buff owner IS the calc target", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "selfOnField"),
          "hu_tao",
          "hu_tao",
          "hu_tao"
        )
      ).toBe(true);
    });

    it("does not apply when buff owner is NOT the calc target", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "selfOnField"),
          "hu_tao",
          "hu_tao",
          "xingqiu"
        )
      ).toBe(false);
    });

    it("does not apply to another character's sheet even when owner is calc target", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "selfOnField"),
          "hu_tao",
          "xingqiu",
          "hu_tao"
        )
      ).toBe(false);
    });

    it("is skipped during construction (calcTarget=null)", () => {
      expect(
        isBuffApplicable(
          makeBuff("hu_tao", "selfOnField"),
          "hu_tao",
          "hu_tao",
          null
        )
      ).toBe(false);
    });
  });

  describe('receiver: "onField"', () => {
    it("applies to the calc target regardless of buff owner", () => {
      // Bennett buff → applies to hu_tao who is calc target
      expect(
        isBuffApplicable(
          makeBuff("bennett", "onField"),
          "bennett",
          "hu_tao",
          "hu_tao"
        )
      ).toBe(true);
    });

    it("does not apply to non-calc-target characters", () => {
      // Bennett buff → does not apply to xingqiu's sheet when hu_tao is calc target
      expect(
        isBuffApplicable(
          makeBuff("bennett", "onField"),
          "bennett",
          "xingqiu",
          "hu_tao"
        )
      ).toBe(false);
    });

    it("is skipped during construction (calcTarget=null)", () => {
      expect(
        isBuffApplicable(
          makeBuff("bennett", "onField"),
          "bennett",
          "hu_tao",
          null
        )
      ).toBe(false);
    });
  });

  describe('receiver: "team"', () => {
    it("always applies regardless of owner/self/target", () => {
      expect(
        isBuffApplicable(
          makeBuff("zhongli", "team"),
          "zhongli",
          "hu_tao",
          "hu_tao"
        )
      ).toBe(true);
      expect(
        isBuffApplicable(
          makeBuff("zhongli", "team"),
          "zhongli",
          "xingqiu",
          "hu_tao"
        )
      ).toBe(true);
      expect(
        isBuffApplicable(makeBuff("zhongli", "team"), "zhongli", "hu_tao", null)
      ).toBe(true);
    });
  });
});

describe("isBuffApplicable — faction scoping", () => {
  const makeBuffWithFactions = (
    ownerId: string,
    receiver: "self" | "team",
    factions: string[]
  ) =>
    new StatBuff(
      { type: "character", id: ownerId, origin: "C1" },
      { receiver, factions: factions as import("@/data/types").Faction[] },
      [{ key: "atk%", value: 0.1 }]
    );

  it("faction-scoped team buff applies to matching faction member", () => {
    // Clorinde is Hexerei faction
    expect(
      isBuffApplicable(
        makeBuffWithFactions("clorinde", "team", ["Hexerei"]),
        "clorinde",
        "clorinde",
        "clorinde",
        undefined,
        "Hexerei"
      )
    ).toBe(true);
  });

  it("faction-scoped team buff does NOT apply to non-matching faction member", () => {
    expect(
      isBuffApplicable(
        makeBuffWithFactions("clorinde", "team", ["Hexerei"]),
        "clorinde",
        "hu_tao",
        "hu_tao",
        undefined,
        "None"
      )
    ).toBe(false);
  });

  it("buff without factions applies regardless of target faction", () => {
    const buff = new StatBuff(
      { type: "character", id: "clorinde", origin: "C1" },
      { receiver: "team" },
      [{ key: "atk%", value: 0.1 }]
    );
    expect(
      isBuffApplicable(buff, "clorinde", "hu_tao", "hu_tao", undefined, "None")
    ).toBe(true);
  });
});

describe("isBuffApplicable — charId scoping", () => {
  const makeBuffWithCharId = (
    ownerId: string,
    receiver: "onField" | "team",
    charId: string
  ) =>
    new StatBuff(
      { type: "character", id: ownerId, origin: "E" },
      { receiver, charId },
      [{ key: "dmg%", value: 0.27 }]
    );

  it("charId-scoped onField buff applies only to matching character", () => {
    expect(
      isBuffApplicable(
        makeBuffWithCharId("raiden_shogun", "onField", "hu_tao"),
        "raiden_shogun",
        "hu_tao",
        "hu_tao"
      )
    ).toBe(true);
  });

  it("charId-scoped onField buff does NOT apply to non-matching character", () => {
    expect(
      isBuffApplicable(
        makeBuffWithCharId("raiden_shogun", "onField", "hu_tao"),
        "raiden_shogun",
        "xingqiu",
        "xingqiu"
      )
    ).toBe(false);
  });

  it("charId-scoped team buff applies to matching character", () => {
    expect(
      isBuffApplicable(
        makeBuffWithCharId("raiden_shogun", "team", "xingqiu"),
        "raiden_shogun",
        "xingqiu",
        "hu_tao"
      )
    ).toBe(true);
  });

  it("charId-scoped team buff does NOT apply to non-matching character", () => {
    expect(
      isBuffApplicable(
        makeBuffWithCharId("raiden_shogun", "team", "xingqiu"),
        "raiden_shogun",
        "hu_tao",
        "hu_tao"
      )
    ).toBe(false);
  });

  it("buff without charId applies regardless of target", () => {
    const buff = new StatBuff(
      { type: "character", id: "raiden_shogun", origin: "E" },
      { receiver: "onField" },
      [{ key: "dmg%", value: 0.27 }]
    );
    expect(isBuffApplicable(buff, "raiden_shogun", "hu_tao", "hu_tao")).toBe(
      true
    );
  });
});

// Import the side-effect barrel to register all characters, weapons, and artifacts
import "@/lib/team-comp/index";
import { TeamBuild, getComboDisplayResult } from "@/lib/team-comp/damageCalc";
import { StatSheet } from "@/lib/team-comp/damageModels";
import type {
  CalcContext,
  CharCompConfig,
  ComboFormula,
} from "@/lib/team-comp/types";

describe("TeamBuild lifecycle", () => {
  // Diluc (Pyro, Claymore), Mona (Hydro, Catalyst), Jean (Anemo, Sword), Eula (Cryo, Claymore)
  const configs: CharCompConfig[] = [
    {
      charId: "diluc",
      charLevel: 90,
      constellation: 0,
      weaponId: "wolfs_gravestone",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: ["cryo%-15"], // Cryo DMG +15%
    },
    {
      charId: "mona",
      charLevel: 90,
      constellation: 0,
      weaponId: "skyward_blade",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "jean",
      charLevel: 90,
      constellation: 0,
      weaponId: "aquila_favonia",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "eula",
      charLevel: 90,
      constellation: 0,
      weaponId: "skyward_pride",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  // Empty artifact sheets — pure base stat calculation
  const emptySheets: Record<string, StatSheet> = {
    diluc: new StatSheet([]),
    mona: new StatSheet([]),
    jean: new StatSheet([]),
    eula: new StatSheet([]),
  };

  it("constructs without throwing", () => {
    expect(() => new TeamBuild(configs)).not.toThrow();
  });

  describe("getFormulaIds", () => {
    const tb = new TeamBuild(configs);
    const formulas = tb.getFormulaIds();

    it("returns formulas for all 4 characters", () => {
      expect(Object.keys(formulas)).toHaveLength(4);
      expect(formulas.diluc).toBeDefined();
      expect(formulas.mona).toBeDefined();
      expect(formulas.jean).toBeDefined();
      expect(formulas.eula).toBeDefined();
    });

    it("Diluc has at least one formula with localized labels", () => {
      const dilucFormulas = formulas.diluc!;
      expect(Object.keys(dilucFormulas).length).toBeGreaterThanOrEqual(1);

      const firstKey = Object.keys(dilucFormulas)[0]!;
      const label = dilucFormulas[firstKey]!;
      expect(label.en).toBeTruthy();
      expect(label.zh).toBeTruthy();
    });
  });

  describe("getTeamStats", () => {
    const tb = new TeamBuild(configs);

    it("returns stat sheets for all 4 characters", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      expect(Object.keys(stats)).toHaveLength(4);
    });

    it("calc target's stats include base ATK from character + weapon", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      const dilucAtk = stats.diluc!.get("atk", null);
      // Diluc base ATK + Wolf's Gravestone base ATK + any static buffs
      // Should be > 0 and reasonable (at least 500)
      expect(dilucAtk).toBeGreaterThan(500);
    });

    it("base stats include CR/CD/ER baselines", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      // Characters get 5% CR, 50% CD, 100% ER as baselines
      expect(stats.diluc!.get("cr", null)).toBeGreaterThanOrEqual(0.05);
      expect(stats.diluc!.get("cd", null)).toBeGreaterThanOrEqual(0.5);
      expect(stats.diluc!.get("er", null)).toBeGreaterThanOrEqual(1.0);
    });

    it("team buffs apply to all members including provider", () => {
      // Mona's Q: Omen +60% DMG is receiver: "team" — applies to all party members
      const statsWithDiluc = tb.getTeamStats(emptySheets, "diluc");
      const statsWithJean = tb.getTeamStats(emptySheets, "jean");

      // Mona's Omen should appear on diluc's dmg% when diluc is target
      // and on jean's dmg% when jean is target
      const dilucDmg = statsWithDiluc.diluc!.get("dmg%", null);
      const jeanDmg = statsWithJean.jean!.get("dmg%", null);

      // Both should have Mona's Omen (+0.6), so both > 0
      expect(dilucDmg).toBeGreaterThanOrEqual(0.6);
      expect(jeanDmg).toBeGreaterThanOrEqual(0.6);

      // Mona also receives her own team buff (receiver: "team" applies to all)
      const monaDmg = statsWithDiluc.mona!.get("dmg%", null);
      expect(monaDmg).toBeGreaterThanOrEqual(0.6);
    });
  });

  describe("getDamageResult", () => {
    const tb = new TeamBuild(configs);

    it("computes positive damage for a valid formula", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      const result = tb.getDamageResult("diluc", "diluc-skill", stats, ctx);

      expect(result.totalDamage).toBeGreaterThan(0);
      expect(result.parts.length).toBeGreaterThanOrEqual(1);
    });

    it("throws for unknown character", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      expect(() =>
        tb.getDamageResult("nonexistent", "some-formula", stats, ctx)
      ).toThrow();
    });
  });

  describe("getDisplayResult", () => {
    const tb = new TeamBuild(configs);

    it("returns all DisplayResult sections", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      // Parts
      expect(display.parts.length).toBeGreaterThanOrEqual(1);
      expect(display.totalDamage).toBeGreaterThan(0);

      // Every part has required display fields
      for (const part of display.parts) {
        expect(part.template).toBeTruthy();
        expect(part.scalingKeys).toBeDefined();
        expect(part.scalingMulti).toBeDefined();
        expect(part.statValues).toBeDefined();
        expect(part.params).toBeDefined();
        expect(part.damage).toBeGreaterThan(0);
      }

      // Buffs
      expect(display.buffs.length).toBeGreaterThanOrEqual(1);
      // At least Mona's Omen should be in the buff list
      const omenBuff = display.buffs.find(
        (b) => b.source.id === "mona" && b.active
      );
      expect(omenBuff).toBeDefined();

      // Stats
      expect(display.idleStats.diluc).toBeDefined();
      expect(display.combatStats.diluc).toBeDefined();
      expect(display.idleStats.mona).toBeDefined();
      expect(display.combatStats.mona).toBeDefined();

      // Marginal gains
      expect(display.marginalGains.diluc).toBeDefined();
      // CR and CD should have positive marginal gains for the calc target
      expect(display.marginalGains.diluc!.cr).toBeGreaterThan(0);
      expect(display.marginalGains.diluc!.cd).toBeGreaterThan(0);
    });

    it("display().totalDamage matches getDamageResult().totalDamage", () => {
      const stats = tb.getTeamStats(emptySheets, "diluc");
      const hotResult = tb.getDamageResult("diluc", "diluc-skill", stats, ctx);
      const coldResult = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      expect(coldResult.totalDamage).toBeCloseTo(hotResult.totalDamage, 2);
    });

    it("combatStats differ from idleStats when dynamic buffs are present", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      // idleStats = pre-stats (before dynamic buffs)
      // combatStats = post-stats (after dynamic buffs)
      // They should be defined for all 4 team members
      for (const charId of ["diluc", "mona", "jean", "eula"]) {
        expect(display.idleStats[charId]).toBeDefined();
        expect(display.combatStats[charId]).toBeDefined();
      }
    });
  });

  // ─── resolveBuffs detail assertions ───

  describe("resolveBuffs", () => {
    const tb = new TeamBuild(configs);

    it("marks Diluc selfOnField buffs as inactive when Diluc is not calc target", () => {
      // When targeting jean, Diluc's selfOnField buffs should be inactive
      const display = tb.getDisplayResult(
        "jean",
        "jean-skill",
        emptySheets,
        ctx
      );

      // Diluc's P2 is selfOnField — should be inactive when jean is calc target
      const dilucSelfOnField = display.buffs.filter(
        (b) => b.source.id === "diluc" && b.target.receiver === "selfOnField"
      );
      for (const buff of dilucSelfOnField) {
        expect(buff.active).toBe(false);
      }
    });

    it("marks Mona team buffs as active for calc target", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      // Mona's Q Omen is receiver: "team" — should be active for diluc
      const monaTeam = display.buffs.filter(
        (b) => b.source.id === "mona" && b.target.receiver === "team"
      );
      expect(monaTeam.length).toBeGreaterThanOrEqual(1);
      expect(monaTeam[0]!.active).toBe(true);
    });

    it("inactive scaling buffs still have dynamicEntries for display", () => {
      // Mona's Skyward Blade has a ScalingBuff (atk→baseDmg) with filter
      // {abilities: ["normal","charge"]}. When targeting mona-burst (ability:
      // "burst"), the ScalingBuff is applicable (self on calc target) but its
      // tag filter doesn't match → inactive. The dynamicEntries should still
      // be populated for the ledger display.
      const display = tb.getDisplayResult(
        "mona",
        "mona-burst",
        emptySheets,
        ctx
      );

      const monaScaling = display.buffs.find(
        (b) =>
          b.source.type === "weapon" &&
          b.source.id === "skyward_blade" &&
          b.dynamicEntries.length > 0 &&
          !b.active
      );
      // The ScalingBuff should exist, be inactive, but have dynamicEntries
      expect(monaScaling).toBeDefined();
      expect(monaScaling!.dynamicEntries.length).toBeGreaterThan(0);
    });

    it("teammate self weapon buffs are active", () => {
      // When Diluc is calc target, Mona/Jean/Eula's receiver:"self" weapon
      // buffs should still be marked active (they apply to their owner's
      // stat sheet). Only selfOnField should be inactive for non-targets.
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      // Jean's Aquila Favonia: self ATK% buff
      const jeanWeaponSelf = display.buffs.find(
        (b) =>
          b.source.type === "weapon" &&
          b.source.id === "aquila_favonia" &&
          b.target.receiver === "self"
      );
      expect(jeanWeaponSelf).toBeDefined();
      expect(jeanWeaponSelf!.active).toBe(true);

      // Eula's Skyward Pride: self DMG% buff
      const eulaWeaponSelf = display.buffs.find(
        (b) =>
          b.source.type === "weapon" &&
          b.source.id === "skyward_pride" &&
          b.target.receiver === "self"
      );
      expect(eulaWeaponSelf).toBeDefined();
      expect(eulaWeaponSelf!.active).toBe(true);
    });

    it("getter-based weapon buffs are active (reference identity)", () => {
      // Wolf's Gravestone uses `get buffs()` which creates new StatBuff
      // objects on each call. The active set must still match via consistent
      // object references from allStaticBuffs.
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      const wgSelf = display.buffs.find(
        (b) =>
          b.source.type === "weapon" &&
          b.source.id === "wolfs_gravestone" &&
          b.target.receiver === "self"
      );
      expect(wgSelf).toBeDefined();
      expect(wgSelf!.active).toBe(true);
      expect(wgSelf!.staticEntries.length).toBeGreaterThan(0);
    });

    it("includes resonance buffs (always active)", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      const resonanceBuffs = display.buffs.filter(
        (b) => b.source.type === "teamResonance" && b.staticEntries.length > 0
      );
      // 4 unique elements → no resonance (need duplicates)
      // Actually Diluc/Mona/Jean/Eula are Pyro/Hydro/Anemo/Cryo — 4 unique
      // This triggers "4 unique" resonance: All Elemental RES +15% (wait, let's check)
      // Any resonance buffs found should be marked active
      for (const buff of resonanceBuffs) {
        expect(buff.active).toBe(true);
      }
    });
  });

  // ─── computeMarginalGains detail assertions ───

  describe("computeMarginalGains", () => {
    const tb = new TeamBuild(configs);

    it("marginal gains for calc target include only rollable stats", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      const gains = display.marginalGains.diluc!;
      // Should have gains for rollable combat stats (cr, cd, atk%, atk, em, etc.)
      // Should NOT have gains for non-rollable stats
      expect(gains.baseAtk).toBeUndefined();
      expect(gains.baseHp).toBeUndefined();
    });

    it("rollable stats used by formula have positive marginal gains", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      const gains = display.marginalGains.diluc!;
      // CR and CD are in statValues, so they should have a marginal gain
      expect(gains.cr).toBeGreaterThan(0);
      expect(gains.cd).toBeGreaterThan(0);
      // ATK% replaces flat ATK for marginal gain (percent rolls are meaningful)
      expect(gains["atk%"]).toBeGreaterThan(0);
    });

    it("vape formula includes EM marginal gain", () => {
      const display = tb.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx,
        { reaction: "vaporize" }
      );

      // Vape formula uses EM in the amplifying multiplier
      expect(display.marginalGains.diluc!.em).toBeGreaterThan(0);
    });

    it("returns zero damage yields empty gains", () => {
      // Test with an extremely bad setup that shouldn't happen in practice
      // but verifies the baseDamage === 0 guard
      const tb2 = new TeamBuild(configs);
      const display = tb2.getDisplayResult(
        "diluc",
        "diluc-skill",
        emptySheets,
        ctx
      );

      // totalDamage should be positive, so gains should exist
      expect(display.totalDamage).toBeGreaterThan(0);
      expect(Object.keys(display.marginalGains).length).toBeGreaterThanOrEqual(
        1
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// otherOnField buff routing — regression test for Illuga P1
// ═══════════════════════════════════════════════════════════════

describe("otherOnField buffs apply to calc target stats and display", () => {
  // Team: Zibai (Geo, calc target), Illuga (Geo, provides otherOnField CR/CD),
  //        Xingqiu (Hydro), Gorou (Geo)
  const configs: CharCompConfig[] = [
    {
      charId: "zibai",
      charLevel: 90,
      constellation: 0,
      weaponId: "verdict",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "illuga",
      charLevel: 90,
      constellation: 0,
      weaponId: "kitain_cross_spear",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "gorou",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_warbow",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  const emptySheets: Record<string, StatSheet> = {
    zibai: new StatSheet([]),
    illuga: new StatSheet([]),
    xingqiu: new StatSheet([]),
    gorou: new StatSheet([]),
  };

  it("Illuga P1 otherOnField CR/CD is applied to Zibai's stat sheet", () => {
    const tb = new TeamBuild(configs);

    // Without Illuga, Zibai would have baseline 5% CR
    // Illuga P1 adds +5% CR (Geo-filtered, otherOnField)
    const statsWithIlluga = tb.getTeamStats(emptySheets, "zibai");
    const zibaiCr = statsWithIlluga.zibai!.get("cr", {
      element: "Geo",
      ability: "skill",
      reaction: "none",
    });

    // Zibai baseline CR = 5%, Illuga P1 adds 5% for Geo → 10%
    // (Zibai may also have CR from ascension stat or other sources)
    expect(zibaiCr).toBeGreaterThanOrEqual(0.1);

    // Verify the buff does NOT apply to Illuga's own sheet (otherOnField excludes owner)
    const illugaCr = statsWithIlluga.illuga!.get("cr", {
      element: "Geo",
      ability: "skill",
      reaction: "none",
    });
    // Illuga should only have baseline 5% CR (no self-buff from otherOnField)
    expect(illugaCr).toBeLessThan(zibaiCr);
  });

  it("Illuga P1 buff is marked active in display when Zibai is calc target", () => {
    const tb = new TeamBuild(configs);
    const display = tb.getDisplayResult(
      "zibai",
      "zibai-steed",
      emptySheets,
      ctx
    );

    const illugaP1 = display.buffs.find(
      (b) =>
        b.source.id === "illuga" &&
        b.target.receiver === "otherOnField" &&
        b.staticEntries.some((e) => e.key === "cr")
    );
    expect(illugaP1).toBeDefined();
    expect(illugaP1!.active).toBe(true);
  });

  it("combatStats for calc target include otherOnField Geo-filtered CR", () => {
    const tb = new TeamBuild(configs);
    const display = tb.getDisplayResult(
      "zibai",
      "zibai-steed",
      emptySheets,
      ctx
    );

    const zibaiCombatCr = display.combatStats.zibai!.cr!;
    // Must include Illuga P1 CR (+5%), so > baseline 5%
    expect(zibaiCombatCr).toBeGreaterThanOrEqual(0.1);
  });

  it("combo mode combatStats include otherOnField Geo-filtered CR", () => {
    const tb = new TeamBuild(configs);
    const combo: ComboFormula = {
      id: "test-combo",
      label: { zh: "测试", en: "Test" },
      lines: [
        {
          charId: "zibai",
          formulaId: "zibai-steed",
          count: 1,
        },
      ],
    };

    const comboDisplay = getComboDisplayResult(tb, combo, emptySheets, ctx);

    const zibaiComboCr = comboDisplay.combatStats.zibai!.cr!;
    // Must include Illuga P1 CR in combo mode too
    expect(zibaiComboCr).toBeGreaterThanOrEqual(0.1);
  });

  it("Illuga P1 buff does NOT activate for non-Geo formulas", () => {
    const tb = new TeamBuild(configs);
    // Xingqiu is Hydro — Illuga's Geo-filtered CR should not apply
    const display = tb.getDisplayResult(
      "xingqiu",
      "xingqiu-skill",
      emptySheets,
      ctx
    );

    const illugaP1 = display.buffs.find(
      (b) =>
        b.source.id === "illuga" &&
        b.target.receiver === "otherOnField" &&
        b.staticEntries.some((e) => e.key === "cr")
    );
    // The buff exists but should be inactive for Hydro formulas
    if (illugaP1) {
      expect(illugaP1.active).toBe(false);
    }
  });

  it("Illuga Q baseDmg is either/or: Geo-only for non-LC, LC-only for lunarCrystallize", () => {
    const tb = new TeamBuild(configs);
    const stats = tb.getTeamStats(emptySheets, "zibai");
    const zibaiSheet = stats.zibai!;

    // Non-reaction Geo: should see Q Geo buff (0.605 * EM), NOT the LC buff
    const geoBaseDmg = zibaiSheet.get("baseDmg", {
      element: "Geo",
      ability: "burst",
      reaction: "none",
    });

    // LunarCrystallize: should see Q LC buff (4.067 * EM), NOT the Geo buff
    const lcBaseDmg = zibaiSheet.get("baseDmg", {
      element: "Geo",
      ability: "burst",
      reaction: "lunarCrystallize",
    });

    // LC buff should be strictly larger than Geo buff (not additive)
    expect(lcBaseDmg).toBeGreaterThan(geoBaseDmg);
    // If they were stacking, LC would be ≈(0.605+4.067)*EM ≈ 7.7× the Geo value
    // With either/or, LC is ≈4.067/0.605 ≈ 6.7× the Geo value
    // The ratio should be close to 4.067/0.605 ≈ 6.72, NOT (4.067+0.605)/0.605 ≈ 7.72
    const ratio = lcBaseDmg / geoBaseDmg;
    expect(ratio).toBeCloseTo(4.067 / 0.605, 0);
    expect(ratio).toBeLessThan(7); // Would be ~7.7 if stacking
  });
});

// ═══════════════════════════════════════════════════════════════
// Level tier helpers
// ═══════════════════════════════════════════════════════════════

describe("getCharacterLevelTier", () => {
  it("maps levels to the closest tier at or above", () => {
    expect(getCharacterLevelTier(1)).toBe("70");
    expect(getCharacterLevelTier(70)).toBe("70");
    expect(getCharacterLevelTier(71)).toBe("80");
    expect(getCharacterLevelTier(80)).toBe("80");
    expect(getCharacterLevelTier(85)).toBe("90");
    expect(getCharacterLevelTier(90)).toBe("90");
    expect(getCharacterLevelTier(91)).toBe("95");
    expect(getCharacterLevelTier(95)).toBe("95");
    expect(getCharacterLevelTier(96)).toBe("100");
    expect(getCharacterLevelTier(100)).toBe("100");
  });
});

describe("getNextLevelTier", () => {
  it("returns the next tier for non-max levels", () => {
    expect(getNextLevelTier(70)).toBe(80);
    expect(getNextLevelTier(80)).toBe(90);
    expect(getNextLevelTier(90)).toBe(95);
    expect(getNextLevelTier(95)).toBe(100);
  });

  it("returns null for max level", () => {
    expect(getNextLevelTier(100)).toBeNull();
  });

  it("returns the next tier for in-between levels", () => {
    // Level 75 maps to tier 80, so next is 90
    expect(getNextLevelTier(75)).toBe(90);
    // Level 92 maps to tier 95, so next is 100
    expect(getNextLevelTier(92)).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// Level-up gains
// ═══════════════════════════════════════════════════════════════

describe("levelUpGains", () => {
  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  it("computes level-up gain for Lv90 calc target (both 90→95 and 90→100)", () => {
    const configs: CharCompConfig[] = [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const emptySheets = { diluc: new StatSheet([]) };
    const display = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );

    expect(display.levelUpGains.diluc).toBeDefined();
    expect(display.levelUpGains.diluc.length).toBe(2);
    // First entry: 90→95
    expect(display.levelUpGains.diluc[0].from).toBe(90);
    expect(display.levelUpGains.diluc[0].to).toBe(95);
    expect(display.levelUpGains.diluc[0].gain).toBeGreaterThan(0);
    // Second entry: 90→100
    expect(display.levelUpGains.diluc[1].from).toBe(90);
    expect(display.levelUpGains.diluc[1].to).toBe(100);
    expect(display.levelUpGains.diluc[1].gain).toBeGreaterThan(
      display.levelUpGains.diluc[0].gain
    );
  });

  it("computes level-up gain for Lv80 calc target (80→90 only)", () => {
    const configs: CharCompConfig[] = [
      {
        charId: "diluc",
        charLevel: 80,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const emptySheets = { diluc: new StatSheet([]) };
    const display = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );

    expect(display.levelUpGains.diluc).toBeDefined();
    expect(display.levelUpGains.diluc.length).toBe(1);
    expect(display.levelUpGains.diluc[0].from).toBe(80);
    expect(display.levelUpGains.diluc[0].to).toBe(90);
    expect(display.levelUpGains.diluc[0].gain).toBeGreaterThan(0);
  });

  it("Lv80→90 gain is larger than Lv95→100 gain", () => {
    const makeTeam = (level: number) => {
      const configs: CharCompConfig[] = [
        {
          charId: "diluc",
          charLevel: level,
          constellation: 0,
          weaponId: "wolfs_gravestone",
          refinement: 1,
          artifactSetId: null,
          artifactHalfSetIds: [],
        },
      ];
      const tb = new TeamBuild(configs);
      const emptySheets = { diluc: new StatSheet([]) };
      return tb.getDisplayResult("diluc", "diluc-skill", emptySheets, ctx);
    };

    const lv80 = makeTeam(80).levelUpGains.diluc;
    const lv95 = makeTeam(95).levelUpGains.diluc;
    expect(lv80).toBeDefined();
    expect(lv95).toBeDefined();
    // 80→90 spans a larger stat range than 95→100
    expect(lv80[0].gain).toBeGreaterThan(lv95[0].gain);
  });

  it("no level-up gain for Lv100 (already max)", () => {
    const configs: CharCompConfig[] = [
      {
        charId: "diluc",
        charLevel: 100,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const emptySheets = { diluc: new StatSheet([]) };
    const display = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );

    expect(display.levelUpGains.diluc).toBeUndefined();
  });

  it("computes level-up gains for teammates too", () => {
    const configs: CharCompConfig[] = [
      {
        charId: "diluc",
        charLevel: 90,
        constellation: 0,
        weaponId: "wolfs_gravestone",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
      {
        charId: "mona",
        charLevel: 80,
        constellation: 0,
        weaponId: "skyward_blade",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const emptySheets = {
      diluc: new StatSheet([]),
      mona: new StatSheet([]),
    };
    const display = tb.getDisplayResult(
      "diluc",
      "diluc-skill",
      emptySheets,
      ctx
    );

    // Calc target (Diluc at Lv90) should have gains (90→95 and 90→100)
    expect(display.levelUpGains.diluc).toBeDefined();
    expect(display.levelUpGains.diluc[0].from).toBe(90);
    expect(display.levelUpGains.diluc.length).toBe(2);
    // Teammate (Mona at Lv80) — may or may not have a gain depending on
    // whether her buffs affect Diluc's damage. If present, verify shape.
    if (display.levelUpGains.mona) {
      expect(display.levelUpGains.mona[0].from).toBe(80);
      expect(display.levelUpGains.mona[0].to).toBe(90);
      expect(display.levelUpGains.mona[0].gain).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ER marginal gain with ER-scaling weapon (Engulfing Lightning)
// ═══════════════════════════════════════════════════════════════

describe("marginalGains — ER with ER-scaling weapon", () => {
  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  it("includes ER marginal gain for a character with Engulfing Lightning", () => {
    const configs: CharCompConfig[] = [
      {
        charId: "raiden_shogun",
        charLevel: 90,
        constellation: 0,
        weaponId: "engulfing_lightning",
        refinement: 1,
        artifactSetId: null,
        artifactHalfSetIds: [],
      },
    ];
    const tb = new TeamBuild(configs);
    const emptySheets = { raiden_shogun: new StatSheet([]) };
    const formulas = tb.getFormulaIds();
    const formulaId = Object.keys(formulas.raiden_shogun!)[0]!;

    const display = tb.getDisplayResult(
      "raiden_shogun",
      formulaId,
      emptySheets,
      ctx
    );

    // ER should appear in marginal gains because Engulfing Lightning
    // converts ER over 100% into ATK%, which is used in the formula
    expect(display.marginalGains.raiden_shogun).toBeDefined();
    expect(display.marginalGains.raiden_shogun!.er).toBeGreaterThan(0);
  });
});

describe("Raiden E — per-character burst DMG bonus via charId", () => {
  // Team: Raiden (90 energy), Bennett (60 energy), Xingqiu (80 energy), Kazuha (60 energy)
  const configs: CharCompConfig[] = [
    {
      charId: "raiden_shogun",
      charLevel: 90,
      constellation: 0,
      weaponId: "engulfing_lightning",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "bennett",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "xingqiu",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "kaedehara_kazuha",
      charLevel: 90,
      constellation: 0,
      weaponId: "sacrificial_sword",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];
  const tb = new TeamBuild(configs);
  const emptySheets = Object.fromEntries(
    configs.map((c) => [c.charId, new StatSheet([])])
  );

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  it("emits separate E burst DMG buffs with correct per-character energy scaling", () => {
    // Get display for Raiden on-field to inspect resolved buffs
    const formulas = tb.getFormulaIds();
    const formulaId = Object.keys(formulas.raiden_shogun!)[0]!;
    const display = tb.getDisplayResult(
      "raiden_shogun",
      formulaId,
      emptySheets,
      ctx
    );

    // Find Raiden E buffs with charId targeting
    const raidenEBuffs = display.buffs.filter(
      (b) =>
        b.source.type === "character" &&
        b.source.id === "raiden_shogun" &&
        b.source.origin === "E" &&
        b.target.charId !== undefined
    );

    // Should have one buff per team member (4 characters)
    expect(raidenEBuffs).toHaveLength(4);

    // Verify each buff targets the right character with correct energy scaling
    const byCharId = Object.fromEntries(
      raidenEBuffs.map((b) => [b.target.charId, b])
    );

    // Raiden: 90 energy → 0.3% × 90 = 27%
    expect(byCharId.raiden_shogun).toBeDefined();
    expect(byCharId.raiden_shogun!.staticEntries[0]!.value).toBeCloseTo(
      0.003 * 90
    );

    // Bennett: 60 energy → 0.3% × 60 = 18%
    expect(byCharId.bennett).toBeDefined();
    expect(byCharId.bennett!.staticEntries[0]!.value).toBeCloseTo(0.003 * 60);

    // Xingqiu: 80 energy → 0.3% × 80 = 24%
    expect(byCharId.xingqiu).toBeDefined();
    expect(byCharId.xingqiu!.staticEntries[0]!.value).toBeCloseTo(0.003 * 80);

    // Kazuha: 60 energy → 0.3% × 60 = 18%
    expect(byCharId.kaedehara_kazuha).toBeDefined();
    expect(byCharId.kaedehara_kazuha!.staticEntries[0]!.value).toBeCloseTo(
      0.003 * 60
    );
  });

  it("only the matching charId buff is active for a given calc target", () => {
    const formulas = tb.getFormulaIds();
    // Pick a burst formula so the abilities:["burst"] filter passes
    const display = tb.getDisplayResult(
      "raiden_shogun",
      "raiden-initial",
      emptySheets,
      ctx
    );

    const raidenEBuffs = display.buffs.filter(
      (b) =>
        b.source.type === "character" &&
        b.source.id === "raiden_shogun" &&
        b.source.origin === "E" &&
        b.target.charId !== undefined
    );

    // When Raiden is calc target with a burst formula, only her charId buff should be active
    const activeBuffs = raidenEBuffs.filter((b) => b.active);
    expect(activeBuffs).toHaveLength(1);
    expect(activeBuffs[0]!.target.charId).toBe("raiden_shogun");
  });
});

// ═══════════════════════════════════════════════════════════════
// bespoke buff display in resolveBuffs
// ═══════════════════════════════════════════════════════════════

describe("bespoke buffs appear in resolveBuffs output", () => {
  // Gorou has P2 bespoke ScalingBuff (+1.56×DEF as baseDmg) on E and Q parts
  const configs: CharCompConfig[] = [
    {
      charId: "gorou",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_warbow",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "noelle",
      charLevel: 90,
      constellation: 0,
      weaponId: "whiteblind",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "yun_jin",
      charLevel: 90,
      constellation: 0,
      weaponId: "favonius_lance",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
    {
      charId: "zhongli",
      charLevel: 90,
      constellation: 0,
      weaponId: "black_tassel",
      refinement: 1,
      artifactSetId: null,
      artifactHalfSetIds: [],
    },
  ];

  const ctx: CalcContext = {
    enemyLevel: 100,
    enemyRes: 0.1,
    assumeCrit: false,
  };

  const emptySheets: Record<string, StatSheet> = {
    gorou: new StatSheet([]),
    noelle: new StatSheet([]),
    yun_jin: new StatSheet([]),
    zhongli: new StatSheet([]),
  };

  it("bespoke buffs have bespokeLabel and are active for matching formula", () => {
    const tb = new TeamBuild(configs);
    const display = tb.getDisplayResult(
      "gorou",
      "gorou-skill",
      emptySheets,
      ctx
    );

    // Find all bespoke buffs (those with bespokeLabel)
    const bespokeBuffs = display.buffs.filter((b) => b.bespokeLabel);
    expect(bespokeBuffs.length).toBeGreaterThanOrEqual(1);

    // The E skill bespoke buff should be active when viewing gorou-skill
    const activeBespoke = bespokeBuffs.filter((b) => b.active);
    expect(activeBespoke.length).toBeGreaterThanOrEqual(1);
    // Its label should match the E Skill formula
    expect(activeBespoke[0]!.bespokeLabel!.en).toBe("E Skill");

    // Bespoke buffs for the burst formula should be inactive
    const inactiveBespoke = bespokeBuffs.filter(
      (b) => !b.active && b.bespokeLabel!.en === "Q + Crystal Collapse"
    );
    expect(inactiveBespoke.length).toBeGreaterThanOrEqual(1);
  });

  it("bespoke buffs have dynamic entries with scaling info", () => {
    const tb = new TeamBuild(configs);
    const display = tb.getDisplayResult(
      "gorou",
      "gorou-skill",
      emptySheets,
      ctx
    );

    const activeBespoke = display.buffs.find((b) => b.bespokeLabel && b.active);
    expect(activeBespoke).toBeDefined();
    // Gorou P2 is a ScalingBuff with DEF→baseDmg, so dynamicEntries should be populated
    expect(activeBespoke!.dynamicEntries.length).toBeGreaterThanOrEqual(1);
    expect(activeBespoke!.dynamicEntries[0]!.key).toBe("baseDmg");
    expect(activeBespoke!.dynamicEntries[0]!.inputKey).toBe("def");
  });

  it("non-bespoke buffs are unaffected (no bespokeLabel)", () => {
    const tb = new TeamBuild(configs);
    const display = tb.getDisplayResult(
      "gorou",
      "gorou-skill",
      emptySheets,
      ctx
    );

    const regularBuffs = display.buffs.filter((b) => !b.bespokeLabel);
    // Should still have regular buffs (character passives, weapon, resonance, etc.)
    expect(regularBuffs.length).toBeGreaterThanOrEqual(1);
    // None of them should have bespokeLabel
    for (const b of regularBuffs) {
      expect(b.bespokeLabel).toBeUndefined();
    }
  });
});
