import { describe, expect, it } from "vitest";
import type { AccountData } from "@/domain/models";
import {
  convertGOODToAccountData,
  type GOODData,
} from "@/providers/scanner/formats/goodConversion";
import { prepareContinuousImport } from "@/services/game-account/continuousImport";

const good: GOODData = {
  format: "GOOD",
  version: 3,
  source: "GOODScanner",
  characters: [
    {
      key: "Amber",
      level: 80,
      ascension: 5,
      constellation: 2,
      talent: { auto: 8, skill: 7, burst: 6 },
    },
  ],
  weapons: [
    {
      key: "FavoniusWarbow",
      level: 80,
      ascension: 5,
      refinement: 2,
      location: "Amber",
      lock: true,
    },
  ],
  artifacts: [
    {
      setKey: "GladiatorsFinale",
      slotKey: "flower",
      level: 0,
      rarity: 5,
      mainStatKey: "hp",
      location: "Amber",
      lock: true,
      substats: [
        { key: "critRate_", value: 3.9 },
        { key: "critDMG_", value: 7.8 },
        { key: "atk_", value: 5.8 },
      ],
    },
  ],
};

describe("continuous snapshot import", () => {
  it("replaces inventory repeatedly without duplicates and preserves missing talents and sections", () => {
    const existing = convertGOODToAccountData(good).data;
    const packet = {
      ...good,
      characters: good.characters!.map((c) => ({
        ...c,
        level: 90,
        talent: undefined,
      })),
      weapons: undefined,
      artifacts: undefined,
    };
    const before = structuredClone(existing);
    const first = prepareContinuousImport(packet, existing);
    const second = prepareContinuousImport(packet, first.data);
    expect(second.data).toEqual(first.data);
    expect(second.data.characters[0]).toMatchObject({
      level: 90,
      talent: { auto: 8, skill: 7, burst: 6 },
      weapon: existing.characters[0].weapon,
      artifacts: existing.characters[0].artifacts,
    });
    expect(existing).toEqual(before);
    expect(second.earnedAchievementIds).toBeUndefined();
  });
  it("preserves omitted optional artifact metadata and remaps frozen references one-to-one", () => {
    const existing = convertGOODToAccountData(good).data;
    const art = existing.characters[0].artifacts.flower!;
    art.id = "artifact-42";
    art.astralMark = true;
    art.elixirCrafted = true;
    art.totalRolls = 8;
    art.initialValues = { cr: 3.9 };
    const result = prepareContinuousImport(good, existing);
    expect(result.artifactIdMap.get("artifact-42")).toBe("artifact-0");
    expect(result.data.characters[0].artifacts.flower).toMatchObject({
      astralMark: true,
      elixirCrafted: true,
      totalRolls: 8,
      initialValues: { cr: 3.9 },
    });
    expect(prepareContinuousImport(good, result.data).data).toEqual(
      result.data
    );
  });
  it("honors explicitly empty inventories without erasing omitted inventory or achievements", () => {
    const existing = convertGOODToAccountData(good).data;
    const result = prepareContinuousImport(
      { format: "GOOD", version: 3, source: "GOODScanner", artifacts: [] },
      existing
    );
    expect(result.data.characters[0].artifacts).toEqual({});
    expect(result.data.characters[0].weapon).toEqual(
      existing.characters[0].weapon
    );
    expect(result.earnedAchievementIds).toBeUndefined();
  });
  it("does not collapse physically distinct identical items", () => {
    const empty: AccountData = {
      characters: [],
      extraArtifacts: [],
      extraWeapons: [],
    };
    const packet = {
      ...good,
      artifacts: [good.artifacts![0], { ...good.artifacts![0], location: "" }],
    };
    const result = prepareContinuousImport(packet, empty);
    expect(result.data.extraArtifacts).toHaveLength(1);
    expect(result.data.characters[0].artifacts.flower).toBeDefined();
  });
});
