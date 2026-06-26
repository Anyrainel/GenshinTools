import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  DirectFormula as DirectFormulaClass,
  StellarDirectFormula as StellarDirectFormulaClass,
} from "@/lib/dmgcalc/core/damageFormula";
import type { createCharacter as createCharacterFn } from "@/lib/dmgcalc/core/registry";
import type { TeamMeta as TeamMetaClass } from "@/lib/dmgcalc/core/teamMeta";

const fakeCharacterStats = {
  sandrone: {
    rarity: 5,
    element: "Cryo",
    weaponType: "Catalyst",
    region: "Nod-Krai",
    releaseDate: "2026-01-01",
    levels: {
      "90": { baseHp: "12000", baseAtk: "1000", baseDef: "700" },
    },
  },
  fischl: {
    rarity: 4,
    element: "Electro",
    weaponType: "Bow",
    region: "Mondstadt",
    releaseDate: "2020-09-28",
    levels: {
      "90": { baseHp: "9000", baseAtk: "800", baseDef: "600" },
    },
  },
};

vi.mock("@/data/gameResources", () => ({
  allCharacters: [
    { id: "sandrone", rarity: 5, imagePath: "/character/sandrone.webp" },
    { id: "fischl", rarity: 4, imagePath: "/character/fischl.webp" },
  ],
  allWeapons: [],
  allArtifacts: [],
  allHalfSetIds: [],
  allHalfSets: [],
  sortedWeapons: [],
  sortedArtifacts: [],
  sortedHalfSets: [],
  charactersById: {
    sandrone: { id: "sandrone", rarity: 5 },
    fischl: { id: "fischl", rarity: 4 },
  },
  artifactsById: {},
  weaponsById: {},
  artifactHalfSetsById: {},
  artifactIdToHalfSetId: {},
  elementResourcesByName: {},
  weaponResourcesByName: {},
  getSortedCharacters: () => [],
}));

vi.mock("@/data/gameStatsLoader", () => ({
  characterStatsResource: {
    preload: async () => fakeCharacterStats,
    peek: () => fakeCharacterStats,
    use: () => fakeCharacterStats,
  },
  weaponStatsResource: {
    preload: async () => ({}),
    peek: () => ({}),
    use: () => ({}),
  },
  getCharacterLevelTier: () => "90",
  getNextLevelTier: () => null,
  getCharacterLevelStats: () => ({
    baseHp: "12000",
    baseAtk: "1000",
    baseDef: "700",
  }),
  getWeaponStatsAt90: () => undefined,
  getCharacterDisplayMeta: () => ({
    element: "Cryo",
    weaponType: "Catalyst",
    region: "Nod-Krai",
    releaseDate: "2026-01-01",
    rarity: 5,
  }),
  getWeaponDisplayMeta: () => ({
    type: undefined,
    secondaryStat: undefined,
    rarity: 5,
  }),
  resolveCharacterStats: () => [
    { key: "baseHp", value: 12000 },
    { key: "baseAtk", value: 1000 },
    { key: "baseDef", value: 700 },
    { key: "cr", value: 0.05 },
    { key: "cd", value: 0.5 },
    { key: "er", value: 1.0 },
  ],
  resolveWeaponStats: () => [],
  getTalentParam: () => 0.5,
}));

let DirectFormula: typeof DirectFormulaClass;
let StellarDirectFormula: typeof StellarDirectFormulaClass;
let createCharacter: typeof createCharacterFn;
let TeamMeta: typeof TeamMetaClass;

beforeAll(async () => {
  ({ DirectFormula, StellarDirectFormula } = await import(
    "@/lib/dmgcalc/core/damageFormula"
  ));
  ({ createCharacter } = await import("@/lib/dmgcalc/core/registry"));
  ({ TeamMeta } = await import("@/lib/dmgcalc/core/teamMeta"));
  await import("@/lib/dmgcalc/impl/character5NodKrai");
});

function createC6Sandrone(radiance: "on" | "off") {
  const teamMeta = new TeamMeta(["sandrone", "fischl"], { sandrone: 6 });
  return createCharacter("sandrone", 90, 6, teamMeta, {
    sandrone: radiance,
  });
}

describe("Sandrone C6 Cluster Beam", () => {
  it("is available as 4-hit Cryo charged damage when Radiance is off", () => {
    const sandrone = createC6Sandrone("off");
    const entry = sandrone.getFormulaEntry("sandrone-c6-cluster");
    const part = entry?.parts[0];

    expect(sandrone.formulaIds["sandrone-c6-cluster"]?.en).toBe(
      "C6 Cluster Beam"
    );
    expect(sandrone.combo["sandrone-c6-cluster"]).toBe(1);
    expect(entry?.minC).toBe(6);
    expect(part?.hits).toBe(4);
    expect(part?.formula).toBeInstanceOf(DirectFormula);
    expect(part?.formula.talentMultiplier).toBe(1.0);
    expect(part?.formula.scalingKey).toBe("atk");
    expect(part?.formula.tag).toEqual({
      element: "Cryo",
      ability: "charge",
      reaction: "none",
    });
  });

  it("keeps the Radiance path as 4-hit Stellar-Conduct charged damage", () => {
    const sandrone = createC6Sandrone("on");
    const entry = sandrone.getFormulaEntry("sandrone-c6-cluster");
    const part = entry?.parts[0];

    expect(sandrone.formulaIds["sandrone-c6-cluster"]?.en).toBe(
      "C6 Cluster Beam"
    );
    expect(sandrone.combo["sandrone-c6-cluster"]).toBe(1);
    expect(entry?.minC).toBe(6);
    expect(part?.hits).toBe(4);
    expect(part?.formula).toBeInstanceOf(StellarDirectFormula);
    expect(part?.formula.talentMultiplier).toBe(0.8);
    expect(part?.formula.scalingKey).toBe("atk");
    expect(part?.formula.tag).toEqual({
      element: "Cryo",
      ability: "charge",
      reaction: "stellarConduct",
    });
  });
});
