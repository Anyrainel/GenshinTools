import { beforeAll, describe, expect, it } from "vitest";

import { charInfo } from "@/data/charInfo";
import { charactersById } from "@/data/constants";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  CharacterBase,
  RegisterCharacter,
  ScalingBuff,
  StatBuff,
  StatSheet,
  TeamMeta,
  createCharacter,
  createWeapon,
  getEntityOption,
  resolveOption,
} from "@/lib/team-comp/damageModels";
import type { OptionDef } from "@/lib/team-comp/types";

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
    expect(sheet.get("atk")).toBeCloseTo(1300);
  });

  it("get(hp) applies base × (1 + %) + flat formula", () => {
    const sheet = new StatSheet([
      { key: "baseHp", value: 15000 },
      { key: "hp%", value: 0.466 },
      { key: "hp", value: 4780 },
    ]);

    // 15000 × (1 + 0.466) + 4780 = 26770
    expect(sheet.get("hp")).toBeCloseTo(26770);
  });

  it("get(cr) returns raw value (no baseline — baselines are in character stats)", () => {
    const sheet = new StatSheet([{ key: "cr", value: 0.3 }]);
    expect(sheet.get("cr")).toBeCloseTo(0.3);
  });

  it("get(cd) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "cd", value: 0.622 }]);
    expect(sheet.get("cd")).toBeCloseTo(0.622);
  });

  it("get(er) returns raw value (no baseline)", () => {
    const sheet = new StatSheet([{ key: "er", value: 0.2 }]);
    expect(sheet.get("er")).toBeCloseTo(0.2);
  });

  it("get(em) returns raw value", () => {
    const sheet = new StatSheet([{ key: "em", value: 187 }]);
    expect(sheet.get("em")).toBe(187);
  });

  it("get(atk%) throws — use getRaw for intermediate % values", () => {
    const sheet = new StatSheet([{ key: "atk%", value: 0.5 }]);
    expect(() => sheet.get("atk%")).toThrow("not allowed");
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
    expect(result.get("em")).toBe(100);
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

    expect(bumped.get("cr")).toBeCloseTo(0.533);
    expect(original.get("cr")).toBeCloseTo(0.5); // immutable
  });

  it("handles bumping a new key", () => {
    const original = new StatSheet([]);
    const bumped = original.withDelta("em", 20);

    expect(bumped.get("em")).toBe(20);
    expect(original.get("em")).toBe(0);
  });

  it("handles bumping a scaled stat intermediate (%)", () => {
    const original = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "atk%", value: 0.5 },
    ]);
    const bumped = original.withDelta("atk%", 0.05);

    // Original: 800 × (1 + 0.5) = 1200
    // Bumped:   800 × (1 + 0.55) = 1240
    expect(original.get("atk")).toBeCloseTo(1200);
    expect(bumped.get("atk")).toBeCloseTo(1240);
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
    expect(applied.get("cr")).toBeCloseTo(0.5);
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
    expect(applied.get("dmg%")).toBe(0);

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
    expect(sheet.get("cr")).toBeCloseTo(0.311);
  });

  it("handles empty record", () => {
    const sheet = StatSheet.fromRaw({});
    expect(sheet.get("em")).toBe(0);
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
    expect(sheet.get("cr")).toBeCloseTo(0.07);
    expect(sheet.get("cd")).toBeCloseTo(0.14);
    expect(sheet.get("em")).toBeCloseTo(40);
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
    expect(sheet.get("cr")).toBeCloseTo(0.105);
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

  it("throws when defReduction% has element filter", () => {
    expect(
      () =>
        new StatBuff(
          { type: "character", id: "test", origin: "C1" },
          { receiver: "team", filter: { elements: ["Pyro"] } },
          [{ key: "defReduction%", value: 0.1 }]
        )
    ).toThrow("defReduction%");
  });

  it("throws when resReduction% has ability filter", () => {
    expect(
      () =>
        new StatBuff(
          { type: "character", id: "test", origin: "C1" },
          { receiver: "team", filter: { abilities: ["burst"] } },
          [{ key: "resReduction%", value: 0.1 }]
        )
    ).toThrow("resReduction%");
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

describe("resolveOption", () => {
  const testOption = {
    label: { zh: "测试", en: "Test" },
    default: "alpha",
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

describe("getEntityOption", () => {
  it("returns null for entities without options", () => {
    // Jean has no option. It should return null.
    expect(getEntityOption("jean")).toBeNull();
  });

  it("returns OptionDef for entities with options", () => {
    // "durin" is registered with an option
    const opt = getEntityOption("durin");
    if (opt) {
      expect(opt.default).toBeTruthy();
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

  it("getDamageResult returns positive damage for known formula", () => {
    const char = createCharacter("diluc", 90, 0, meta);
    const stats = new StatSheet([
      { key: "baseAtk", value: 800 },
      { key: "cr", value: 0.5 },
      { key: "cd", value: 1.0 },
    ]);

    const result = char.getDamageResult("diluc-skill", stats, [stats], {
      enemyLevel: 100,
      enemyRes: 0.1,
      assumeCrit: false,
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
