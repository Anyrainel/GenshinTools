import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toGOODArtifact } from "@/providers/scanner/companion/instructions";
import { convertGOODToAccountData } from "@/providers/scanner/formats/goodConversion";
import fixture from "../../../fixtures/goodscanner-v3.json";

// Independent wire contract from GOODScanner's Rust serde definitions in
// genshin/src/scanner/common/models.rs (GoodExport/GoodArtifact/GoodSubStat).
// The fixture is curated from that contract, not claimed as a captured export.
// Keep producer field names here: importing site DTO schemas would hide drift.
const substat = z.strictObject({
  key: z.string(),
  value: z.number(),
  initialValue: z.number().optional(),
  rolls: z.array(z.number()).optional(),
});
const artifact = z.strictObject({
  setKey: z.string(),
  slotKey: z.string(),
  level: z.number().int(),
  rarity: z.number().int(),
  mainStatKey: z.string(),
  substats: z.array(substat),
  location: z.string(),
  lock: z.boolean(),
  astralMark: z.boolean().optional(),
  elixirCrafted: z.boolean().optional(),
  unactivatedSubstats: z.array(substat).optional(),
  totalRolls: z.number().int().optional(),
});
const exportedData = z.strictObject({
  format: z.literal("GOOD"),
  version: z.literal(3),
  source: z.literal("yas-GOODScanner"),
  characters: z
    .array(
      z.strictObject({
        key: z.string(),
        level: z.number().int(),
        constellation: z.number().int(),
        ascension: z.number().int(),
        talent: z.strictObject({
          auto: z.number().int(),
          skill: z.number().int(),
          burst: z.number().int(),
        }),
        element: z.string().optional(),
      })
    )
    .optional(),
  weapons: z
    .array(
      z.strictObject({
        key: z.string(),
        level: z.number().int(),
        ascension: z.number().int(),
        refinement: z.number().int(),
        location: z.string(),
        lock: z.boolean(),
      })
    )
    .optional(),
  artifacts: z.array(artifact).optional(),
  achievements: z.array(z.number().int().nonnegative()).optional(),
});

describe("GGScanner GOOD v3 wire contract", () => {
  it("accepts producer field names and preserves extensions at conversion", () => {
    const parsed = exportedData.parse(fixture);
    const result = convertGOODToAccountData(parsed);
    expect(result.warnings).toEqual([]);
    expect(result.earnedAchievementIds).toEqual([81001]);
    expect(result.data.characters[0].artifacts.flower).toMatchObject({
      astralMark: true,
      elixirCrafted: false,
      totalRolls: 9,
      initialValues: { "atk%": 5.8 },
    });
    expect(result.data.extraArtifacts[0]).toMatchObject({
      astralMark: false,
      elixirCrafted: true,
      totalRolls: 3,
      initialValues: { cd: 7.8 },
      unactivatedSubstats: { cr: 3.9 },
    });
  });

  it("serializes scanner instructions with producer keys and extended metadata", () => {
    const imported = convertGOODToAccountData(exportedData.parse(fixture));
    const wire: unknown = JSON.parse(
      JSON.stringify(toGOODArtifact(imported.data.extraArtifacts[0]))
    );
    const parsed = artifact.parse(wire);
    expect(parsed).toMatchObject({
      setKey: "CrimsonWitchOfFlames",
      slotKey: "plume",
      mainStatKey: "atk",
      location: "",
      lock: false,
      astralMark: false,
      elixirCrafted: true,
      totalRolls: 3,
      unactivatedSubstats: [{ key: "critRate_", value: 3.9 }],
    });
    expect(parsed.substats).toContainEqual({
      key: "critDMG_",
      value: 7.8,
      initialValue: 7.8,
    });
  });
});
