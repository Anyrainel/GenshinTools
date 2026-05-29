import { describe, expect, it } from "vitest";
import type { CharacterData } from "@/data/types";
import { mergeEnkaImportWithInventory } from "@/lib/account-data/import/mergeEnkaImport";
import {
  artifactFingerprint,
  artifactStatFingerprint,
  findEquivalentArtifactGroups,
} from "@/lib/artifact/artifactIdentity";
import {
  createAccountData,
  createArtifactData,
  createCharacterData,
  MOCK_ARTIFACTS,
} from "../../fixtures";

describe("artifactFingerprint", () => {
  it("returns same string for identical artifacts (ignores id and lock)", () => {
    const a = createArtifactData({ id: "art-1", lock: false });
    const b = createArtifactData({ id: "art-99", lock: true });
    expect(artifactFingerprint(a)).toBe(artifactFingerprint(b));
  });

  it("ignores mutable metadata like astralMark during fingerprinting", () => {
    const a = createArtifactData({ astralMark: false });
    const b = createArtifactData({ astralMark: true });
    expect(artifactFingerprint(a)).toBe(artifactFingerprint(b));
  });

  it("returns different string when setKey differs", () => {
    const a = createArtifactData({ setKey: "crimson_witch_of_flames" });
    const b = createArtifactData({ setKey: "emblem_of_severed_fate" });
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
  });

  it("returns different string when slotKey differs", () => {
    const a = createArtifactData({ slotKey: "flower" });
    const b = createArtifactData({ slotKey: "plume" });
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
  });

  it("returns different string when level, rarity, or mainStatKey differs", () => {
    const base = createArtifactData();
    expect(artifactFingerprint(base)).not.toBe(
      artifactFingerprint(createArtifactData({ ...base, level: 0 }))
    );
    expect(artifactFingerprint(base)).not.toBe(
      artifactFingerprint(createArtifactData({ ...base, rarity: 4 }))
    );
    expect(artifactFingerprint(base)).not.toBe(
      artifactFingerprint(createArtifactData({ ...base, mainStatKey: "atk%" }))
    );
  });

  it("returns different string when substats differ", () => {
    const a = createArtifactData({ substats: { cr: 10, cd: 20 } });
    const b = createArtifactData({ substats: { cr: 5, cd: 25 } });
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
  });

  it("encodes substat order in exact artifact fingerprints", () => {
    const a = createArtifactData({
      substats: { cd: 21, cr: 10.5, em: 23, atk: 35 },
    });
    const b = createArtifactData({
      substats: { atk: 35, cr: 10.5, cd: 21, em: 23 },
    });
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
  });

  it("keeps order-insensitive stat matching diagnostic-only", () => {
    const a = createArtifactData({
      id: "ordered-a",
      substats: { cd: 21, cr: 10.5, em: 23, atk: 35 },
    });
    const b = createArtifactData({
      id: "ordered-b",
      substats: { atk: 35, cr: 10.5, cd: 21, em: 23 },
    });
    const c = createArtifactData({
      id: "different-stat",
      substats: { cd: 14, cr: 10.5, em: 23, atk: 35 },
    });

    expect(artifactStatFingerprint(a)).toBe(artifactStatFingerprint(b));
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));

    const groups = findEquivalentArtifactGroups([a, b, c]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.artifacts.map((artifact) => artifact.id)).toEqual([
      "ordered-a",
      "ordered-b",
    ]);
  });

  it("includes optional totalRolls in fingerprint", () => {
    const a = createArtifactData({ totalRolls: 4 });
    const b = createArtifactData({ totalRolls: 5 });
    const c = createArtifactData({}); // no totalRolls
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(c));
  });

  it("includes immutable elixirCrafted in fingerprint", () => {
    const a = createArtifactData({ elixirCrafted: true });
    const b = createArtifactData({ elixirCrafted: false });
    expect(artifactFingerprint(a)).not.toBe(artifactFingerprint(b));
  });

  it("normalizes rounded incoming substats through the solver before fingerprinting", () => {
    const precise = createArtifactData({
      substats: { cr: 10.5, cd: 20.98, em: 23, atk: 35 },
    });
    const rounded = createArtifactData({
      substats: { cr: 10.5, cd: 21.0, em: 23, atk: 35 },
    });
    expect(artifactFingerprint(precise)).toBe(artifactFingerprint(rounded));
  });
});

describe("mergeEnkaImportWithInventory", () => {
  it("returns previous extraArtifacts when newData has same equipped set (no new inventory)", () => {
    const art = createArtifactData(MOCK_ARTIFACTS.crimsonFlower);
    const char: CharacterData = {
      ...createCharacterData({ key: "hu_tao" }),
      artifacts: { flower: art },
    };
    const previous = createAccountData({
      characters: [char],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [{ ...char, artifacts: { flower: art } }],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(0);
  });

  it("moves previously equipped artifact to inventory when new import has different equip", () => {
    const oldEquip = createArtifactData({
      id: "old",
      setKey: "crimson_witch_of_flames",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { cr: 5, cd: 10 },
    });
    const newEquip = createArtifactData({
      id: "new",
      setKey: "emblem_of_severed_fate",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { er: 15, atk: 10 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: oldEquip },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: newEquip },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
    expect(artifactFingerprint(merged[0]!)).toBe(artifactFingerprint(oldEquip));
  });

  it("keeps existing extraArtifacts and adds demoted equips without duplicate", () => {
    const inInv = createArtifactData({
      id: "inv-1",
      setKey: "emblem_of_severed_fate",
      slotKey: "sands",
      mainStatKey: "er",
      substats: { cr: 3, cd: 7 },
    });
    const oldEquip = createArtifactData({
      id: "old",
      setKey: "crimson_witch_of_flames",
      slotKey: "flower",
      substats: { cr: 10, cd: 20 },
    });
    const newEquip = createArtifactData({
      id: "new",
      setKey: "emblem_of_severed_fate",
      slotKey: "flower",
      substats: { er: 20 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: oldEquip },
        },
      ],
      extraArtifacts: [inInv],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: newEquip },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(inInv);
    expect(artifactFingerprint(merged[1]!)).toBe(artifactFingerprint(oldEquip));
  });

  it("does not add artifact already in inventory (same fingerprint)", () => {
    const sameArt = createArtifactData({
      id: "a",
      setKey: "gladiators_finale",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { cr: 6, cd: 14 },
    });
    const sameArtCopy = createArtifactData({
      id: "b",
      setKey: "gladiators_finale",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { cr: 6, cd: 14 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: sameArt },
        },
      ],
      extraArtifacts: [sameArtCopy],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: createArtifactData(MOCK_ARTIFACTS.emblemSands) },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
    expect(artifactFingerprint(merged[0]!)).toBe(artifactFingerprint(sameArt));
  });

  it("dedupes when same artifact was on two characters (identical fingerprint)", () => {
    const sharedArt = createArtifactData({
      id: "art-1",
      setKey: "noblesse_oblige",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { er: 11, cr: 3 },
    });
    const sharedArt2 = createArtifactData({
      id: "art-2",
      setKey: "noblesse_oblige",
      slotKey: "flower",
      mainStatKey: "hp",
      substats: { er: 11, cr: 3 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "bennett" }),
          artifacts: { flower: sharedArt },
        },
        {
          ...createCharacterData({ key: "xingqiu" }),
          artifacts: { flower: sharedArt2 },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "bennett" }),
          artifacts: {
            flower: createArtifactData(MOCK_ARTIFACTS.crimsonFlower),
          },
        },
        {
          ...createCharacterData({ key: "xingqiu" }),
          artifacts: {
            flower: createArtifactData(MOCK_ARTIFACTS.crimsonPlume),
          },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
  });

  it("treats newData extraArtifacts as part of equipped set (same fingerprint not re-added)", () => {
    const art = createArtifactData(MOCK_ARTIFACTS.emblemSands);
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { sands: art },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: {}, // unequipped
        },
      ],
      extraArtifacts: [art],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(0);
  });

  it("when newData has no characters, all previously seen artifacts go to inventory", () => {
    const art = createArtifactData(MOCK_ARTIFACTS.crimsonFlower);
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: art },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
    expect(artifactFingerprint(merged[0]!)).toBe(artifactFingerprint(art));
  });

  it("previous with only extraArtifacts and newData with different equips leaves inventory unchanged", () => {
    const inInv = createArtifactData(MOCK_ARTIFACTS.emblemSands);
    const previous = createAccountData({
      characters: [],
      extraArtifacts: [inInv],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: {
            flower: createArtifactData(MOCK_ARTIFACTS.crimsonFlower),
          },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(inInv);
  });

  it("multiple characters: only unequipped-from-this-import artifacts are added", () => {
    const hutaoOld = createArtifactData({
      id: "h1",
      setKey: "crimson_witch_of_flames",
      slotKey: "flower",
      substats: { cr: 5 },
    });
    const xqOld = createArtifactData({
      id: "x1",
      setKey: "emblem_of_severed_fate",
      slotKey: "flower",
      substats: { er: 10 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: hutaoOld },
        },
        {
          ...createCharacterData({ key: "xingqiu" }),
          artifacts: { flower: xqOld },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: {
            flower: createArtifactData(MOCK_ARTIFACTS.crimsonPlume),
          },
        },
        {
          ...createCharacterData({ key: "xingqiu" }),
          artifacts: { flower: xqOld },
        },
      ],
      extraArtifacts: [],
    });
    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(1);
    expect(artifactFingerprint(merged[0]!)).toBe(artifactFingerprint(hutaoOld));
  });

  it("does not duplicate when previous precise values match a rounded UID import artifact", () => {
    const previousEquip = createArtifactData({
      id: "old",
      substats: { cr: 10.5, cd: 20.98, em: 23, atk: 35 },
    });
    const previous = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: { flower: previousEquip },
        },
      ],
      extraArtifacts: [],
    });
    const newData = createAccountData({
      characters: [
        {
          ...createCharacterData({ key: "hu_tao" }),
          artifacts: {
            flower: createArtifactData({
              id: "new",
              substats: { cr: 10.5, cd: 21.0, em: 23, atk: 35 },
            }),
          },
        },
      ],
      extraArtifacts: [],
    });

    const merged = mergeEnkaImportWithInventory(previous, newData);
    expect(merged).toHaveLength(0);
  });
});
