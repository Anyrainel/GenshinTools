import {
  CHARACTER_LEVEL_TIERS,
  type CharacterLevelStats,
  type CharacterStats,
  type CharacterStatsMap,
  type WeaponStats,
  type WeaponStatsMap,
  getCharacterDisplayMeta,
  getCharacterLevelStats,
  getCharacterLevelTier,
  getCharacterStats,
  getCharacterStatsSync,
  getWeaponDisplayMeta,
  getWeaponStats,
  getWeaponStatsAt90,
  getWeaponStatsSync,
  preloadGameStats,
} from "@/data/gameStatsLoader";
import { beforeAll, describe, expect, it } from "vitest";

// ─── getCharacterLevelTier ───────────────────────────────────────────────────

describe("getCharacterLevelTier", () => {
  it("maps level ≤70 to '70'", () => {
    expect(getCharacterLevelTier(1)).toBe("70");
    expect(getCharacterLevelTier(70)).toBe("70");
  });

  it("maps level 71–80 to '80'", () => {
    expect(getCharacterLevelTier(71)).toBe("80");
    expect(getCharacterLevelTier(80)).toBe("80");
  });

  it("maps level 81–90 to '90'", () => {
    expect(getCharacterLevelTier(81)).toBe("90");
    expect(getCharacterLevelTier(90)).toBe("90");
  });

  it("maps level 91–95 to '95'", () => {
    expect(getCharacterLevelTier(91)).toBe("95");
    expect(getCharacterLevelTier(95)).toBe("95");
  });

  it("maps level >95 to '100'", () => {
    expect(getCharacterLevelTier(96)).toBe("100");
    expect(getCharacterLevelTier(100)).toBe("100");
  });

  it("covers all exported tier values", () => {
    expect(CHARACTER_LEVEL_TIERS).toEqual(["70", "80", "90", "95", "100"]);
  });
});

// ─── getCharacterLevelStats ──────────────────────────────────────────────────

describe("getCharacterLevelStats", () => {
  const mockData: CharacterStatsMap = {
    albedo: {
      rarity: 5,
      element: "Geo",
      weaponType: "Sword",
      region: "Mondstadt",
      releaseDate: "2020-12-22",
      levels: {
        "90": { baseHp: "13226", baseAtk: "251", baseDef: "876", em: "0" },
      },
    },
  };

  it("returns level stats when character and tier exist", () => {
    const stats = getCharacterLevelStats(mockData, "albedo", "90");
    expect(stats).toEqual({
      baseHp: "13226",
      baseAtk: "251",
      baseDef: "876",
      em: "0",
    });
  });

  it("returns undefined for a tier that is not present", () => {
    expect(getCharacterLevelStats(mockData, "albedo", "70")).toBeUndefined();
  });

  it("returns undefined for an unknown character id", () => {
    expect(
      getCharacterLevelStats(mockData, "unknown_char", "90")
    ).toBeUndefined();
  });
});

// ─── getWeaponStatsAt90 ──────────────────────────────────────────────────────

describe("getWeaponStatsAt90", () => {
  const mockData: WeaponStatsMap = {
    a_thousand_floating_dreams: {
      rarity: 5,
      type: "Catalyst",
      secondaryStat: "em",
      levels: {
        "90": { baseAtk: 542, secondaryStatValue: "265" },
      },
    },
  };

  it("returns weapon level stats at 90", () => {
    const stats = getWeaponStatsAt90(mockData, "a_thousand_floating_dreams");
    expect(stats).toEqual({ baseAtk: 542, secondaryStatValue: "265" });
  });

  it("returns undefined for an unknown weapon id", () => {
    expect(getWeaponStatsAt90(mockData, "unknown_weapon")).toBeUndefined();
  });
});

// ─── getCharacterDisplayMeta ─────────────────────────────────────────────────

describe("getCharacterDisplayMeta", () => {
  const resource = { id: "albedo", rarity: 5 as const, imagePath: "" };

  it("uses stats when available", () => {
    const stats: CharacterStats = {
      rarity: 5,
      element: "Geo",
      weaponType: "Sword",
      region: "Mondstadt",
      releaseDate: "2020-12-22",
      levels: {},
    };
    const meta = getCharacterDisplayMeta(resource, stats);
    expect(meta.element).toBe("Geo");
    expect(meta.weaponType).toBe("Sword");
    expect(meta.region).toBe("Mondstadt");
    expect(meta.releaseDate).toBe("2020-12-22");
    expect(meta.rarity).toBe(5);
  });

  it("falls back to resource.rarity when stats is undefined", () => {
    const meta = getCharacterDisplayMeta(resource, undefined);
    expect(meta.rarity).toBe(5);
    expect(meta.element).toBeUndefined();
    expect(meta.weaponType).toBeUndefined();
    expect(meta.region).toBeUndefined();
    expect(meta.releaseDate).toBeUndefined();
  });

  it("prefers stats.rarity over resource.rarity when both present", () => {
    const stats: CharacterStats = {
      rarity: 4,
      element: "Geo",
      weaponType: "Sword",
      region: "Mondstadt",
      releaseDate: "",
      levels: {},
    };
    const meta = getCharacterDisplayMeta(
      { id: "albedo", rarity: 5 as const, imagePath: "" },
      stats
    );
    expect(meta.rarity).toBe(4);
  });
});

// ─── getWeaponDisplayMeta ────────────────────────────────────────────────────

describe("getWeaponDisplayMeta", () => {
  const resource = {
    id: "a_thousand_floating_dreams",
    rarity: 5 as const,
    imagePath: "",
  };

  it("uses stats when available", () => {
    const stats: WeaponStats = {
      rarity: 5,
      type: "Catalyst",
      secondaryStat: "em",
      levels: {},
    };
    const meta = getWeaponDisplayMeta(resource, stats);
    expect(meta.type).toBe("Catalyst");
    expect(meta.secondaryStat).toBe("em");
    expect(meta.rarity).toBe(5);
  });

  it("falls back to resource.rarity when stats is undefined", () => {
    const meta = getWeaponDisplayMeta(resource, undefined);
    expect(meta.rarity).toBe(5);
    expect(meta.type).toBeUndefined();
    expect(meta.secondaryStat).toBeUndefined();
  });
});

// ─── Async loaders & sync getters ────────────────────────────────────────────

describe("async loaders and sync getters", () => {
  beforeAll(async () => {
    await preloadGameStats();
  });

  it("getCharacterStats resolves to a non-empty map", async () => {
    const data = await getCharacterStats();
    expect(typeof data).toBe("object");
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  it("getWeaponStats resolves to a non-empty map", async () => {
    const data = await getWeaponStats();
    expect(typeof data).toBe("object");
    expect(Object.keys(data).length).toBeGreaterThan(0);
  });

  it("getCharacterStatsSync returns non-null after preload", () => {
    const data = getCharacterStatsSync();
    expect(data).not.toBeNull();
  });

  it("getWeaponStatsSync returns non-null after preload", () => {
    const data = getWeaponStatsSync();
    expect(data).not.toBeNull();
  });

  it("character stats entries have expected shape", async () => {
    const data = await getCharacterStats();
    const albedo = data.albedo;
    expect(albedo).toBeDefined();
    expect(albedo.element).toBe("Geo");
    expect(albedo.weaponType).toBe("Sword");
    expect(albedo.region).toBe("Mondstadt");
    expect(typeof albedo.rarity).toBe("number");
    expect(typeof albedo.levels).toBe("object");
  });

  it("character stats levels contain numeric-string values", async () => {
    const data = await getCharacterStats();
    const albedo = data.albedo;
    const tier90 = albedo.levels["90"] as CharacterLevelStats;
    expect(tier90).toBeDefined();
    expect(Number(tier90.baseAtk)).toBeGreaterThan(0);
    expect(Number(tier90.baseHp)).toBeGreaterThan(0);
  });

  it("weapon stats entries have expected shape", async () => {
    const data = await getWeaponStats();
    const weapon = data.a_thousand_floating_dreams;
    expect(weapon).toBeDefined();
    expect(weapon.type).toBe("Catalyst");
    expect(weapon.secondaryStat).toBe("em");
    expect(typeof weapon.rarity).toBe("number");
  });

  it("weapon stats at 90 have numeric baseAtk", async () => {
    const data = await getWeaponStats();
    const stats = getWeaponStatsAt90(data, "a_thousand_floating_dreams");
    expect(stats).toBeDefined();
    expect(stats!.baseAtk).toBeGreaterThan(0);
  });

  it("getCharacterStats returns the same cached reference on repeated calls", async () => {
    const a = await getCharacterStats();
    const b = await getCharacterStats();
    expect(a).toBe(b);
  });

  it("getWeaponStats returns the same cached reference on repeated calls", async () => {
    const a = await getWeaponStats();
    const b = await getWeaponStats();
    expect(a).toBe(b);
  });
});
