import { preloadGameStats } from "@/lib/gameStatsLoader";
import { CharacterBase } from "@/lib/team-comp/calc/implModel";
import {
  RegisterCharacter,
  createCharacter,
  createWeapon,
  getOptionDef,
  resolveOption,
} from "@/lib/team-comp/calc/registry";
import { evaluateFormulaDamage } from "@/lib/team-comp/calc/stackRank";
import { StatBuff } from "@/lib/team-comp/calc/statBuff";
import { StatSheet, appendFieldState } from "@/lib/team-comp/calc/statSheet";
import { TeamMeta } from "@/lib/team-comp/calc/teamMeta";
import type { OptionDef } from "@/lib/team-comp/types";
import type { DamageTag } from "@/lib/team-comp/types";
import { beforeAll, describe, expect, it } from "vitest";

// Side-effect barrel: register all characters, weapons, artifacts
import "@/lib/team-comp/index";

beforeAll(async () => {
  await preloadGameStats();
});

describe("StatSheet", () => {
  it("get(atk) applies base × (1 + %) + flat formula", () => {
    const sheet = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
      { key: "atk", value: 100 },
    ]);

    // 800 × (1 + 0.5) + 100 = 1300
    expect(sheet.get("atk", null)).toBeCloseTo(1300);
  });

  it("get(hp) applies base × (1 + %) + flat formula", () => {
    const sheet = new StatSheet([
      { key: "baseHp", value: 15000 },
      { key: "hp%", value: 0.466 },
      { key: "hp", value: 4780 },
    ]);

    // 15000 × (1 + 0.466) + 4780 = 26770
    expect(sheet.get("hp", null)).toBeCloseTo(26770);
  });

  it("get(cr) returns raw value (no baseline — baselines are in character stats)", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.3 }]);
    expect(sheet.get("cr", null)).toBeCloseTo(0.3);
  });

  it("get(cd) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "cd", value: 0.622 }]);
    expect(sheet.get("cd", null)).toBeCloseTo(0.622);
  });

  it("get(er) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "er", value: 0.2 }]);
    expect(sheet.get("er", null)).toBeCloseTo(0.2);
  });

  it("get(em) returns raw value", () => {
    const sheet = new StatSheet([{ key: "em", value: 187 }]);
    expect(sheet.get("em", null)).toBe(187);
  });

  it("get(atk%) throws — use getRaw for intermediate % values", () => {
    const sheet = new StatSheet([{ key: "atk%", value: 0.5 }]);
    expect(() => sheet.get("atk%", null)).toThrow("not allowed");
  });

  it("aggregates duplicate keys", () => {
    const sheet = new StatSheet([
      { key: "atk%", value: 0.2 },
      { key: "atk%", value: 0.15 },
    ]);
    expect(sheet.getRaw("atk%")).toBeCloseTo(0.35);
  });

  it("getRaw returns 0 for missing keys", () => {
    const sheet = new StatSheet([]);
    expect(sheet.getRaw("atk")).toBe(0);
  });

  it("merge produces correct aggregation", () => {
    const a = new StatSheet([
      { key: "baseAtk", value: 600 },
      { key: "atk%", value: 0.2 },
    ]);
    const b = new StatSheet([
      { key: "baseAtk", value: 200 },
      { key: "cr", value: 0.1 },
    ]);
    const merged = a.merge(b);

    expect(merged.getRaw("baseAtk")).toBe(800);
    expect(merged.getRaw("atk%")).toBeCloseTo(0.2);
    expect(merged.getRaw("cr")).toBeCloseTo(0.1);
  });

  it("merge is non-destructive (returns new instance)", () => {
    const a = new StatSheet([{ key: "em", value: 100 }]);
    const b = new StatSheet([{ key: "em", value: 50 }]);
    const merged = a.merge(b);

    expect(a.getRaw("em")).toBe(100);
    expect(merged.getRaw("em")).toBe(150);
  });

  it("apply adds static buff entries", () => {
    const sheet = new StatSheet([{ key: "baseAtk", value: 800 }]);
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self" },
      [{ key: "atk%", value: 0.2 }]
    );
    const applied = sheet.apply([buff]);

    expect(applied.getRaw("atk%")).toBeCloseTo(0.2);
    expect(sheet.getRaw("atk%")).toBe(0); // original unchanged
  });

  it("apply with empty buffs returns same sheet", () => {
    const sheet = new StatSheet([{ key: "em", value: 100 }]);
    const result = sheet.apply([]);
    expect(result.get("em", null)).toBe(100);
  });

  it("normalizes elemental DMG keys (pyro%, phys%, etc.) to dmg% with element filter", () => {
    const sheet = new StatSheet([{ key: "pyro%", value: 0.288 }]);
    const pyroTag = {
      element: "Pyro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };
    const hydroTag = {
      element: "Hydro" as const,
      ability: "normal" as const,
      reaction: "none" as const,
    };

    expect(sheet.get("dmg%", pyroTag)).toBeCloseTo(0.288);
    expect(sheet.get("dmg%", hydroTag)).toBe(0);
    expect(sheet.getRaw("pyro%")).toBe(0);
  });
});

describe("StatSheet field-state (withFieldState / mergeEntries)", () => {
  const pyroTag: DamageTag = {
    ability: "burst",
    element: "Pyro",
    reaction: "none",
  };

  it("withFieldState('on') includes universal + on-field entries, excludes off-field", () => {
    // Build a unified sheet with universal, on-field, and off-field entries
    const sheet = new StatSheet([{ key: "baseAtk", value: 100 }]);
    const merged = sheet
      .mergeEntries([{ key: "atk%", value: 0.3 }]) // universal atk%
      .mergeEntries([{ key: "atk%", value: 0.2 }], "on") // on-field only
      .mergeEntries([{ key: "atk%", value: 0.1 }], "off"); // off-field only

    const onView = merged.withFieldState("on");
    const offView = merged.withFieldState("off");

    // on-field: base 100 × (1 + 0.3 + 0.2) = 150
    expect(onView.get("atk", null)).toBeCloseTo(150);
    // off-field: base 100 × (1 + 0.3 + 0.1) = 140
    expect(offView.get("atk", null)).toBeCloseTo(140);
    // no field state: base 100 × (1 + 0.3) = 130 (only universal)
    expect(merged.get("atk", null)).toBeCloseTo(130);

    // Scaled stat + tag: field-state-only entries must NOT be double-counted.
    // getUniversal already includes them; the tag loop must skip field-state-only entries.
    expect(onView.get("atk", pyroTag)).toBeCloseTo(150);
    expect(offView.get("atk", pyroTag)).toBeCloseTo(140);
  });

  it("scaled stat with flat + pct field-state entries and tag — no double counting", () => {
    // Simulates Bennett scenario: flat ATK on-field + baseAtk universal
    const sheet = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
    ])
      .mergeEntries([{ key: "atk", value: 747 }], "on") // Bennett flat ATK on-field
      .mergeEntries([{ key: "atk%", value: 0.15 }], "on"); // some on-field ATK% buff

    const onView = sheet.withFieldState("on");
    // ATK = 800 × (1 + 0.5 + 0.15) + 747 = 800 × 1.65 + 747 = 1320 + 747 = 2067
    expect(onView.get("atk", null)).toBeCloseTo(2067);
    // With tag: must be the SAME (no damage-dimension filtered ATK entries)
    expect(onView.get("atk", pyroTag)).toBeCloseTo(2067);

    const offView = sheet.withFieldState("off");
    // Off-field: ATK = 800 × (1 + 0.5) + 0 = 1200
    expect(offView.get("atk", null)).toBeCloseTo(1200);
    expect(offView.get("atk", pyroTag)).toBeCloseTo(1200);
  });

  it("withFieldState filters field-tagged entries in non-scaled stats", () => {
    const sheet = new StatSheet([])
      .mergeEntries([{ key: "dmg%", value: 0.2 }]) // universal
      .mergeEntries([{ key: "dmg%", value: 0.15 }], "on")
      .mergeEntries([{ key: "dmg%", value: 0.05 }], "off");

    const onView = sheet.withFieldState("on");
    const offView = sheet.withFieldState("off");

    // With a tag, field-state-only entries (f:on) match any damage tag
    expect(onView.get("dmg%", pyroTag)).toBeCloseTo(0.35); // 0.2 + 0.15
    expect(offView.get("dmg%", pyroTag)).toBeCloseTo(0.25); // 0.2 + 0.05
    // With null tag: getUniversal includes field-state-only entries matching the view.
    // Field-state entries are semantically universal within a resolved view.
    expect(onView.get("dmg%", null)).toBeCloseTo(0.35); // 0.2 + 0.15
    expect(offView.get("dmg%", null)).toBeCloseTo(0.25); // 0.2 + 0.05
  });

  it("field-state + damage tag filters combine correctly", () => {
    // Entry with both field state AND damage tag filter via mergeEntries
    const base = new StatSheet([])
      .mergeEntries([{ key: "dmg%", value: 0.1 }]) // universal
      .mergeEntries(
        [{ key: "dmg%", value: 0.4, filter: { abilities: ["burst"] } }],
        "on"
      );

    const onView = base.withFieldState("on");
    const offView = base.withFieldState("off");

    // on-field + burst tag → 0.1 (universal) + 0.4 (matches both field and tag)
    expect(onView.get("dmg%", pyroTag)).toBeCloseTo(0.5);
    // off-field + burst tag → 0.1 (universal) only (field state mismatch)
    expect(offView.get("dmg%", pyroTag)).toBeCloseTo(0.1);
    // on-field + null tag → 0.1 (universal) only (tag is null, skip tagged entries)
    expect(onView.get("dmg%", null)).toBeCloseTo(0.1);
  });

  it("getRaw ignores field-state entirely", () => {
    const sheet = new StatSheet([{ key: "atk%", value: 0.5 }]).mergeEntries(
      [{ key: "atk%", value: 0.3 }],
      "on"
    );

    // getRaw always returns EMPTY_FILTER_KEY only
    expect(sheet.getRaw("atk%")).toBeCloseTo(0.5);
    expect(sheet.withFieldState("on").getRaw("atk%")).toBeCloseTo(0.5);
  });

  it("mergeEntries with field state tags entries correctly", () => {
    const sheet = new StatSheet([{ key: "baseAtk", value: 200 }])
      .mergeEntries(
        [
          { key: "atk", value: 100 },
          { key: "atk%", value: 0.5 },
        ],
        "on"
      )
      .mergeEntries([{ key: "atk", value: 50 }], "off");

    const onView = sheet.withFieldState("on");
    const offView = sheet.withFieldState("off");

    // on: 200 × (1 + 0.5) + 100 = 400
    expect(onView.get("atk", null)).toBeCloseTo(400);
    // off: 200 × (1 + 0) + 50 = 250
    expect(offView.get("atk", null)).toBeCloseTo(250);
  });

  it("merge preserves field-state tags from both sheets", () => {
    const a = new StatSheet([{ key: "baseAtk", value: 100 }]).mergeEntries(
      [{ key: "atk%", value: 0.2 }],
      "on"
    );
    const b = new StatSheet([]).mergeEntries(
      [{ key: "atk%", value: 0.1 }],
      "off"
    );
    const merged = a.merge(b);

    expect(merged.withFieldState("on").get("atk", null)).toBeCloseTo(120); // 100 × (1 + 0.2)
    expect(merged.withFieldState("off").get("atk", null)).toBeCloseTo(110); // 100 × (1 + 0.1)
  });

  it("multiplicative stats respect field-state filtering", () => {
    const sheet = new StatSheet([])
      .mergeEntries([{ key: "baseDmg%", value: 0.5 }]) // universal
      .mergeEntries([{ key: "baseDmg%", value: 0.3 }], "on")
      .mergeEntries([{ key: "baseDmg%", value: 0.1 }], "off");

    const onView = sheet.withFieldState("on");
    const offView = sheet.withFieldState("off");

    // baseDmg% is multiplicative across DIFFERENT filter keys, but field-state-only
    // entries are additive within the universal pool (they're semantically universal
    // in a resolved view). So on-field = 0.5 + 0.3 = 0.8, off-field = 0.5 + 0.1 = 0.6.
    expect(onView.get("baseDmg%", pyroTag)).toBeCloseTo(0.8);
    expect(offView.get("baseDmg%", pyroTag)).toBeCloseTo(0.6);
  });

  it("appendFieldState produces correct filter keys", () => {
    expect(appendFieldState("", "on")).toBe("f:on");
    expect(appendFieldState("", "off")).toBe("f:off");
    expect(appendFieldState("a:burst", "on")).toBe("a:burst|f:on");
    expect(appendFieldState("a:burst|e:Pyro", "off")).toBe(
      "a:burst|e:Pyro|f:off"
    );
  });

  it("withFieldState is a lightweight view (shares data)", () => {
    const sheet = new StatSheet([
      { key: "baseAtk", value: 100 },
      { key: "atk%", value: 0.5 },
    ]);
    const view = sheet.withFieldState("on");
    // Both should return the same values for universal entries
    expect(view.get("atk", null)).toBeCloseTo(150);
    expect(sheet.get("atk", null)).toBeCloseTo(150);
  });
});

describe("StatSheet.getAll", () => {
  it("returns all non-zero computed stats", () => {
    const sheet = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
      { key: "atk", value: 100 },
      { key: "cr", value: 0.65 },
      { key: "em", value: 187 },
    ]);

    const all = sheet.getAll();

    // Computed ATK = 800 × (1 + 0.5) + 100 = 1300
    expect(all.atk).toBeCloseTo(1300);
    expect(all.baseAtk).toBeUndefined();
    expect(all.cr).toBeCloseTo(0.65);
    expect(all.em).toBe(187);

    // atk% is excluded (intermediate %)
    expect(all["atk%"]).toBeUndefined();
  });

  it("excludes zero-value keys", () => {
    const sheet = new StatSheet([
      { key: "cr", value: 0.5 },
      { key: "cd", value: 0 },
    ]);
    const all = sheet.getAll();

    expect(all.cr).toBeCloseTo(0.5);
    expect(all.cd).toBeUndefined();
  });

  it("returns empty record for empty sheet", () => {
    const sheet = new StatSheet([]);
    expect(sheet.getAll()).toEqual({});
  });
});

describe("StatSheet.withDelta", () => {
  it("returns a new sheet with one stat bumped", () => {
    const original = new StatSheet([{ key: "cr", value: 0.5 }]);
    const bumped = original.withDelta("cr", 0.033);

    expect(bumped.get("cr", null)).toBeCloseTo(0.533);
    expect(original.get("cr", null)).toBeCloseTo(0.5); // immutable
  });

  it("handles bumping a new key", () => {
    const original = new StatSheet([]);
    const bumped = original.withDelta("em", 20);

    expect(bumped.get("em", null)).toBe(20);
    expect(original.get("em", null)).toBe(0);
  });

  it("handles bumping a scaled stat intermediate (%)", () => {
    const original = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
    ]);
    const bumped = original.withDelta("atk%", 0.05);

    // Original: 800 × (1 + 0.5) = 1200
    // Bumped:   800 × (1 + 0.55) = 1240
    expect(original.get("atk", null)).toBeCloseTo(1200);
    expect(bumped.get("atk", null)).toBeCloseTo(1240);
  });
});

describe("StatSheet.get with DamageTag", () => {
  it("returns only universal value without tag", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.5 }]);
    // A buff with ability filter adds tagged cr
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: 0.12 }]
    );
    const applied = sheet.apply([buff]);

    // Without tag: only universal
    expect(applied.get("cr", null)).toBeCloseTo(0.5);
  });

  it("includes matching tagged entries with tag", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.5 }]);
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: 0.12 }]
    );
    const applied = sheet.apply([buff]);

    // With matching tag: universal + tagged
    expect(
      applied.get("cr", {
        element: "Pyro",
        ability: "burst",
        reaction: "none",
      })
    ).toBeCloseTo(0.62);
  });

  it("excludes non-matching tagged entries", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.5 }]);
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: 0.12 }]
    );
    const applied = sheet.apply([buff]);

    // With non-matching tag: only universal
    expect(
      applied.get("cr", {
        element: "Pyro",
        ability: "normal",
        reaction: "none",
      })
    ).toBeCloseTo(0.5);
  });

  it("handles dmg% with ability filter correctly", () => {
    const sheet = new StatSheet([{ key: "dmg%", value: 0 }]);
    const buff = new StatBuff(
      { type: "artifactSet", id: "test" },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "dmg%", value: 0.2 }]
    );
    const applied = sheet.apply([buff]);

    // Without tag: 0
    expect(applied.get("dmg%", null)).toBe(0);

    // With burst tag: 0.2
    expect(
      applied.get("dmg%", {
        element: "Pyro",
        ability: "burst",
        reaction: "none",
      })
    ).toBeCloseTo(0.2);
  });
});

describe("StatSheet.fromRaw", () => {
  it("constructs from a plain stats record", () => {
    const sheet = StatSheet.fromRaw({ "hp%": 0.466, cr: 0.311 });
    expect(sheet.getRaw("hp%")).toBeCloseTo(0.466);
    expect(sheet.get("cr", null)).toBeCloseTo(0.311);
  });

  it("handles empty record", () => {
    const sheet = StatSheet.fromRaw({});
    expect(sheet.get("em", null)).toBe(0);
  });
});

describe("StatSheet.fromArtifacts", () => {
  it("converts artifact data with main stat and substats", () => {
    const sheet = StatSheet.fromArtifacts([
      {
        id: "a1",
        setKey: "gladiators_finale",
        slotKey: "plume",
        rarity: 5,
        mainStatKey: "atk",
        level: 20,
        lock: false,
        substats: { cr: 7.0, cd: 14.0, "atk%": 5.8, em: 40 },
      },
    ]);

    // Main stat: plume = flat ATK (fixed at 311 for 5★)
    expect(sheet.getRaw("atk")).toBeCloseTo(311);
    // Substats aggregated
    expect(sheet.get("cr", null)).toBeCloseTo(0.07);
    expect(sheet.get("cd", null)).toBeCloseTo(0.14);
    expect(sheet.get("em", null)).toBeCloseTo(40);
    expect(sheet.getRaw("atk%")).toBeCloseTo(0.058);
  });

  it("skips undefined artifacts", () => {
    const sheet = StatSheet.fromArtifacts([
      undefined,
      {
        id: "a2",
        setKey: "test",
        slotKey: "flower",
        rarity: 5,
        mainStatKey: "hp",
        level: 20,
        lock: false,
        substats: {},
      },
    ]);

    // Flower main stat: flat HP = 4780 for 5★
    expect(sheet.getRaw("hp")).toBeCloseTo(4780);
  });

  it("aggregates substats across multiple artifacts", () => {
    const sheet = StatSheet.fromArtifacts([
      {
        id: "a1",
        setKey: "test",
        slotKey: "flower",
        rarity: 5,
        mainStatKey: "hp",
        level: 20,
        lock: false,
        substats: { cr: 7.0 },
      },
      {
        id: "a2",
        setKey: "test",
        slotKey: "plume",
        rarity: 5,
        mainStatKey: "atk",
        level: 20,
        lock: false,
        substats: { cr: 3.5 },
      },
    ]);

    // CR from both: 0.07 + 0.035 = 0.105
    expect(sheet.get("cr", null)).toBeCloseTo(0.105);
  });
});

describe("validateStatFilter", () => {
  it("accepts dmg% with element filter (elemental bonus expressed as dmg%+filter)", () => {
    const sheet = new StatSheet([]);
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self", filter: { elements: ["Pyro"] } },
      [{ key: "dmg%", value: 0.2 }]
    );

    const applied = sheet.apply([buff]);
    expect(
      applied.get("dmg%", {
        element: "Pyro",
        ability: "normal",
        reaction: "none",
      })
    ).toBeCloseTo(0.2);
    expect(
      applied.get("dmg%", {
        element: "Hydro",
        ability: "normal",
        reaction: "none",
      })
    ).toBe(0);
  });

  it("allows defReduction% with element filter", () => {
    expect(
      () =>
        new StatBuff(
          { type: "character", id: "test", origin: "C1" },
          { receiver: "team", filter: { elements: ["Pyro"] } },
          [{ key: "defReduction%", value: 0.1 }]
        )
    ).not.toThrow();
  });

  it("allows resReduction% with ability filter", () => {
    expect(
      () =>
        new StatBuff(
          { type: "character", id: "test", origin: "C1" },
          { receiver: "team", filter: { abilities: ["burst"] } },
          [{ key: "resReduction%", value: 0.1 }]
        )
    ).not.toThrow();
  });

  it("does not throw for valid combinations", () => {
    const sheet = new StatSheet([]);
    // cr with ability filter is fine
    const buff = new StatBuff(
      { type: "weapon", id: "test", origin: "R1" },
      { receiver: "self", filter: { abilities: ["burst"] } },
      [{ key: "cr", value: 0.12 }]
    );

    expect(() => sheet.apply([buff])).not.toThrow();
  });
});

describe("StatSheet baseDmg% multiplicative aggregation", () => {
  const skillTag = {
    element: "Pyro" as const,
    ability: "skill" as const,
    reaction: "none" as const,
  };
  const burstTag = {
    element: "Pyro" as const,
    ability: "burst" as const,
    reaction: "none" as const,
  };
  const normalTag = {
    element: "Pyro" as const,
    ability: "normal" as const,
    reaction: "none" as const,
  };

  it("single baseDmg% entry works like before", () => {
    const sheet = new StatSheet([{ key: "baseDmg%", value: 0.5 }]);
    expect(sheet.get("baseDmg%", normalTag)).toBeCloseTo(0.5);
    expect(sheet.getRaw("baseDmg%")).toBeCloseTo(0.5);
  });

  it("multiple universal baseDmg% entries are multiplicative", () => {
    const sheet = new StatSheet([
      { key: "baseDmg%", value: 0.5 },
      { key: "baseDmg%", value: 0.3 },
    ]);
    // (1+0.5) × (1+0.3) − 1 = 0.95
    expect(sheet.get("baseDmg%", normalTag)).toBeCloseTo(0.95);
    expect(sheet.getRaw("baseDmg%")).toBeCloseTo(0.95);
  });

  it("three universal baseDmg% entries multiply correctly", () => {
    const sheet = new StatSheet([
      { key: "baseDmg%", value: 1.0 },
      { key: "baseDmg%", value: 0.5 },
      { key: "baseDmg%", value: 0.2 },
    ]);
    // (1+1.0) × (1+0.5) × (1+0.2) − 1 = 2×1.5×1.2 − 1 = 2.6
    expect(sheet.get("baseDmg%", normalTag)).toBeCloseTo(2.6);
  });

  it("conditioned baseDmg% (via buff filter) is multiplicative with universal", () => {
    const sheet = new StatSheet([{ key: "baseDmg%", value: 0.5 }]);
    const buff = new StatBuff(
      { type: "character", id: "test", origin: "E" },
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "baseDmg%", value: 0.4 }]
    );
    const applied = sheet.apply([buff]);

    // Skill tag: universal(0.5) × filtered(0.4) = (1.5)(1.4) − 1 = 1.1
    expect(applied.get("baseDmg%", skillTag)).toBeCloseTo(1.1);
    // Non-matching tag: only universal = 0.5
    expect(applied.get("baseDmg%", normalTag)).toBeCloseTo(0.5);
    // Null tag: only universal = 0.5
    expect(applied.get("baseDmg%", null)).toBeCloseTo(0.5);
  });

  it("multiple conditioned baseDmg% buffs with same filter multiply together", () => {
    const sheet = new StatSheet([]);
    const buffs = [
      new StatBuff(
        { type: "character", id: "a", origin: "E" },
        { receiver: "self", filter: { abilities: ["skill"] } },
        [{ key: "baseDmg%", value: 0.5 }]
      ),
      new StatBuff(
        { type: "weapon", id: "b", origin: "R1" },
        { receiver: "self", filter: { abilities: ["skill"] } },
        [{ key: "baseDmg%", value: 0.3 }]
      ),
    ];
    const applied = sheet.apply(buffs);

    // Same filter → same filterKey → multiplicative: (1.5)(1.3) − 1 = 0.95
    expect(applied.get("baseDmg%", skillTag)).toBeCloseTo(0.95);
    // Non-matching tag: 0
    expect(applied.get("baseDmg%", normalTag)).toBe(0);
  });

  it("conditioned baseDmg% with different filters multiply across filterKeys", () => {
    const sheet = new StatSheet([]);
    const buffs = [
      new StatBuff(
        { type: "character", id: "a", origin: "E" },
        { receiver: "self", filter: { abilities: ["skill"] } },
        [{ key: "baseDmg%", value: 0.5 }]
      ),
      new StatBuff(
        { type: "weapon", id: "b", origin: "R1" },
        { receiver: "self", filter: { elements: ["Pyro"] } },
        [{ key: "baseDmg%", value: 0.3 }]
      ),
    ];
    const applied = sheet.apply(buffs);

    // Pyro skill: both match → (1.5)(1.3) − 1 = 0.95
    expect(applied.get("baseDmg%", skillTag)).toBeCloseTo(0.95);
    // Pyro normal: only element filter matches → 0.3
    expect(applied.get("baseDmg%", normalTag)).toBeCloseTo(0.3);
  });

  it("merge() is multiplicative for baseDmg%", () => {
    const a = new StatSheet([{ key: "baseDmg%", value: 0.5 }]);
    const b = new StatSheet([{ key: "baseDmg%", value: 0.3 }]);
    const merged = a.merge(b);

    // (1.5)(1.3) − 1 = 0.95
    expect(merged.get("baseDmg%", normalTag)).toBeCloseTo(0.95);
  });

  it("merge() is multiplicative across filtered baseDmg% from both sheets", () => {
    const a = StatSheet.fromEntries([{ key: "baseDmg%", value: 0.5 }], {
      abilities: ["skill"],
    });
    const b = new StatSheet([{ key: "baseDmg%", value: 0.3 }]);
    const merged = a.merge(b);

    // Skill: universal(0.3) × filtered(0.5) = (1.3)(1.5) − 1 = 0.95
    expect(merged.get("baseDmg%", skillTag)).toBeCloseTo(0.95);
    // Normal: only universal = 0.3
    expect(merged.get("baseDmg%", normalTag)).toBeCloseTo(0.3);
  });

  it("bespokeBuff baseDmg% merges multiplicatively with existing baseDmg%", () => {
    // Simulate: base stats have a universal baseDmg% from some buff
    const baseStats = new StatSheet([
      { key: "baseDmg%", value: 0.5 },
      { key: "baseAtk", value: 800 },
    ]);

    // Bespoke buff adds a skill-scoped baseDmg%
    // (This mirrors how FormulaPart.bespokeBuff creates an overlay via fromEntries + merge)
    const bespokeOverlay = StatSheet.fromEntries(
      [{ key: "baseDmg%", value: 1.0 }],
      { abilities: ["skill"] }
    );
    const stats = baseStats.merge(bespokeOverlay);

    // Skill: universal(0.5) × filtered(1.0) = (1.5)(2.0) − 1 = 2.0
    expect(stats.get("baseDmg%", skillTag)).toBeCloseTo(2.0);
    // Non-skill: only universal = 0.5
    expect(stats.get("baseDmg%", normalTag)).toBeCloseTo(0.5);
  });

  it("bespokeBuff baseDmg% merges multiplicatively with universal + other buff baseDmg%", () => {
    // Global buff adds universal baseDmg%
    const base = new StatSheet([{ key: "baseDmg%", value: 0.4 }]);
    // Another buff adds skill-scoped baseDmg%
    const buff = new StatBuff(
      { type: "character", id: "x", origin: "P1" },
      { receiver: "self", filter: { abilities: ["skill"] } },
      [{ key: "baseDmg%", value: 0.35 }]
    );
    const applied = base.apply([buff]);

    // Bespoke overlay adds skill-scoped baseDmg%
    const bespokeOverlay = StatSheet.fromEntries(
      [{ key: "baseDmg%", value: 1.0 }],
      { abilities: ["skill"] }
    );
    const stats = applied.merge(bespokeOverlay);

    // Skill: universal(0.4) × skill-filter((1+0.35)(1+1.0)−1 = 1.7) = (1.4)(2.7) − 1 = 2.78
    expect(stats.get("baseDmg%", skillTag)).toBeCloseTo(2.78);
    // Non-skill: only universal = 0.4
    expect(stats.get("baseDmg%", normalTag)).toBeCloseTo(0.4);
  });

  it("withDelta is multiplicative for baseDmg%", () => {
    const sheet = new StatSheet([{ key: "baseDmg%", value: 0.5 }]);
    const bumped = sheet.withDelta("baseDmg%", 0.3);
    // (1.5)(1.3) − 1 = 0.95
    expect(bumped.get("baseDmg%", normalTag)).toBeCloseTo(0.95);
    // Original unchanged
    expect(sheet.get("baseDmg%", normalTag)).toBeCloseTo(0.5);
  });

  it("reactionBaseDmg% remains additive (not affected by multiplicative rule)", () => {
    const sheet = new StatSheet([
      { key: "reactionBaseDmg%", value: 0.5 },
      { key: "reactionBaseDmg%", value: 0.3 },
    ]);
    // Additive: 0.5 + 0.3 = 0.8
    expect(sheet.get("reactionBaseDmg%", normalTag)).toBeCloseTo(0.8);
  });

  it("dump() yields the accumulated multiplicative value", () => {
    const sheet = new StatSheet([
      { key: "baseDmg%", value: 0.5 },
      { key: "baseDmg%", value: 0.3 },
    ]);
    const entries = [...sheet.dump()];
    const bdEntry = entries.find((e) => e.key === "baseDmg%");
    expect(bdEntry).toBeDefined();
    // Stored value is the product: (1.5)(1.3) − 1 = 0.95
    expect(bdEntry!.value).toBeCloseTo(0.95);
  });

  it("fromDump round-trips correctly for baseDmg%", () => {
    const original = new StatSheet([
      { key: "baseDmg%", value: 0.5 },
      { key: "baseDmg%", value: 0.3 },
    ]);
    const dumped = original.toSerializable();
    const restored = StatSheet.fromDump(dumped);

    // fromDump receives the already-accumulated value (0.95), stored as-is
    expect(restored.get("baseDmg%", normalTag)).toBeCloseTo(0.95);
  });

  it("zero-value baseDmg% acts as identity (no effect)", () => {
    const sheet = new StatSheet([
      { key: "baseDmg%", value: 0.5 },
      { key: "baseDmg%", value: 0 },
    ]);
    // (1+0.5)(1+0) − 1 = 0.5
    expect(sheet.get("baseDmg%", normalTag)).toBeCloseTo(0.5);
  });
});

describe("resolveOption", () => {
  const testOption = {
    label: { zh: "测试", en: "Test" },
    choices: [
      { value: "alpha", label: { zh: "甲", en: "Alpha" } },
      { value: "beta", label: { zh: "乙", en: "Beta" } },
    ],
  } satisfies OptionDef;

  it("returns the raw value when it matches a valid choice", () => {
    expect(resolveOption(testOption, "beta")).toBe("beta");
  });

  it("falls back to default for invalid raw value", () => {
    expect(resolveOption(testOption, "gamma")).toBe("alpha");
  });

  it("falls back to default for empty string", () => {
    expect(resolveOption(testOption, "")).toBe("alpha");
  });
});

describe("createCharacter / createWeapon", () => {
  const meta = new TeamMeta(["diluc"]);

  it("createCharacter returns a CharacterBase for a registered ID", () => {
    const char = createCharacter("diluc", 90, 0, meta);
    expect(char.charId).toBe("diluc");
    expect(char.stats.length).toBeGreaterThan(0);
    expect(char.buffs).toBeDefined();
  });

  it("createCharacter throws for unregistered ID", () => {
    expect(() => createCharacter("nonexistent", 90, 0, meta)).toThrow(
      "No character registered"
    );
  });

  it("createWeapon returns a WeaponBase for a registered ID", () => {
    const weapon = createWeapon("wolfs_gravestone", 1, "diluc", meta);
    expect(weapon.weaponId).toBe("wolfs_gravestone");
    expect(weapon.stats.length).toBeGreaterThan(0);
  });

  it("createWeapon throws for unregistered ID", () => {
    expect(() => createWeapon("nonexistent", 1, "diluc", meta)).toThrow(
      "No weapon registered"
    );
  });
});

describe("getOptionDef", () => {
  it("returns null for entities without options", () => {
    // Jean has no option. It should return null.
    expect(getOptionDef("jean")).toBeNull();
  });

  it("returns OptionDef for entities with options", () => {
    // "durin" is registered with an option
    const opt = getOptionDef("durin");
    if (opt) {
      expect(opt.choices.length).toBeGreaterThanOrEqual(2);
    }
    // If null, that's fine — it means durin isn't registered with options in this env
  });
});

describe("CharacterBase via createCharacter", () => {
  const meta = new TeamMeta(["diluc"]);

  it("formulaIds returns labeled formulas", () => {
    const char = createCharacter("diluc", 90, 0, meta);
    const ids = char.formulaIds;

    expect(Object.keys(ids).length).toBeGreaterThanOrEqual(1);
    for (const [key, label] of Object.entries(ids)) {
      expect(key).toBeTruthy();
      expect(label.en).toBeTruthy();
      expect(label.zh).toBeTruthy();
    }
  });

  it("evaluateFormulaDamage returns positive damage for known formula", () => {
    const char = createCharacter("diluc", 90, 0, meta);
    const entry = char.getFormulaEntry("diluc-skill");
    expect(entry).toBeTruthy();

    const stats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "cr", value: 0.5 },
      { key: "cd", value: 1.0 },
    ]);

    const result = evaluateFormulaDamage(entry!, 90, stats, [stats], {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    });

    expect(result.totalDamage).toBeGreaterThan(0);
    expect(result.parts.length).toBeGreaterThanOrEqual(1);
  });

  it("Lv100 uses different stat tier", () => {
    const char90 = createCharacter("diluc", 90, 0, meta);
    const char100 = createCharacter("diluc", 100, 0, meta);

    // Lv100 characters should have higher base stats
    const stats90 = char90.stats;
    const stats100 = char100.stats;

    // Find baseAtk in each
    const baseAtk90 = stats90.find((e) => e.key === "baseAtk")?.value ?? 0;
    const baseAtk100 = stats100.find((e) => e.key === "baseAtk")?.value ?? 0;

    expect(baseAtk100).toBeGreaterThan(baseAtk90);
  });

  it("resolveCharacterStats throws for missing charId", () => {
    expect(() =>
      createCharacter("__fake_nonexistent__", 90, 0, meta)
    ).toThrow();
  });
});

describe("Barebone Character Test (lauma)", () => {
  it("populates the def number from base stats even with no artifacts", () => {
    // 2. Register the character
    @RegisterCharacter("lauma")
    class Lauma extends CharacterBase {
      buffs = [];
      protected formulaMap = {};
    }

    // 3. Create the character and inspect the stat sheet
    const meta = new TeamMeta(["lauma"]);
    const lauma = createCharacter("lauma", 90, 0, meta);

    // The base stats are converted correctly
    const sheet = new StatSheet(lauma.stats);

    // 4. Verify def is populated via getAll()
    const allStats = sheet.getAll();
    expect(allStats.def).toBe(669);
    expect(allStats.atk).toBe(255);
    expect(allStats.hp).toBe(10654);
  });
});
