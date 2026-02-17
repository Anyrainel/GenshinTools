import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  BuildGroup,
  BuildPayloadV5,
  SetConfig,
  SlotConfig,
  SubStat,
} from "@/data/types";
import {
  DEFAULT_COMPUTE_OPTIONS,
  buildRawConfigs,
  mergeConfigsAsync,
} from "@/lib/artifact-builds/computeFilters";
import { mergeConfigGroup } from "@/lib/artifact-builds/mergeUtils";
import { smartMerge } from "@/lib/artifact-builds/smartMerge";
import { describe, expect, it } from "vitest";

function makeConfig(
  substats: SubStat[],
  mustPresent: SubStat[],
  minStatCount: number,
  characterId: string,
  opts: { sands?: string[]; goblet?: string[]; circlet?: string[] } = {}
): SetConfig {
  const slot: SlotConfig = {
    mainStats: [],
    substats,
    mustPresent,
    minStatCount,
  };
  return {
    flowerPlume: { ...slot },
    sands: {
      ...slot,
      mainStats: (opts.sands ?? ["atk%"]) as SlotConfig["mainStats"],
    },
    goblet: {
      ...slot,
      mainStats: (opts.goblet ?? ["anemo%"]) as SlotConfig["mainStats"],
    },
    circlet: {
      ...slot,
      mainStats: (opts.circlet ?? ["cr"]) as SlotConfig["mainStats"],
    },
    servedCharacters: [
      { characterId, hasPerfectMerge: true, has4pcBuild: true },
    ],
  };
}

describe("mergeConfigGroup", () => {
  it("preserves shared ER when all sources have weight=100", () => {
    const merged = mergeConfigGroup([
      makeConfig(["er", "atk%", "cr", "cd"], ["er", "atk%"], 3, "a"),
      makeConfig(["er", "hp%", "cr", "cd"], ["er", "hp%"], 3, "b"),
      makeConfig(["er", "def%", "cr", "cd"], ["er", "def%"], 3, "c"),
    ]);
    expect(merged.flowerPlume.mustPresent).toContain("er");
  });

  it("drops ER when one source lacks it in mustPresent", () => {
    const merged = mergeConfigGroup([
      makeConfig(["er", "atk%"], ["er", "atk%"], 2, "a"),
      makeConfig(["er", "hp%"], ["hp%"], 2, "b"), // ER not must-present
    ]);
    // Raw intersection drops ER — this is correct for mergeConfigGroup
    expect(merged.flowerPlume.mustPresent).not.toContain("er");
  });
});

describe("smartMerge ER mustPresent", () => {
  it("promotes ER back after merging ER+scaling archetypes with mixed mustPresent", () => {
    // Within the same archetype (ER+ATK%), one config has ER must-present, the other doesn't.
    // mergeErGroup should promote ER back since archetype classification guarantees ER in pool.
    const result = smartMerge([
      makeConfig(["er", "atk%", "cr", "cd"], ["er", "atk%"], 3, "a"),
      makeConfig(["er", "atk%", "cr", "cd"], ["atk%"], 3, "x"),
      makeConfig(["er", "hp%", "cr", "cd"], ["er", "hp%"], 3, "b"),
      makeConfig(["er", "def%", "cr", "cd"], ["er", "def%"], 3, "c"),
    ]);

    for (const config of result) {
      if (config.flowerPlume.substats.includes("er")) {
        expect(config.flowerPlume.mustPresent).toContain("er");
      }
    }
  });

  it("promotes ER in mixed path (3 archetypes + other)", () => {
    const result = smartMerge([
      makeConfig(["er", "atk%", "cr", "cd"], ["er", "atk%"], 3, "a"),
      makeConfig(["er", "hp%", "cr", "cd"], ["er", "hp%"], 3, "b"),
      makeConfig(["er", "def%", "cr", "cd"], ["er", "def%"], 3, "c"),
      makeConfig(["cr", "cd", "atk%", "em"], ["cr", "cd"], 3, "other"),
    ]);

    const erConfig = result.find((c) => c.flowerPlume.substats.includes("er"));
    expect(erConfig).toBeDefined();
    expect(erConfig!.flowerPlume.mustPresent).toContain("er");
  });
});

describe("Silken Moon's Serenade preset regression", () => {
  function loadPresetBuilds(): BuildGroup[] {
    const filePath = resolve(
      __dirname,
      "../../src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
    );
    const payload: BuildPayloadV5 = JSON.parse(readFileSync(filePath, "utf-8"));
    const groups = new Map<string, BuildGroup>();
    for (const build of Object.values(payload.builds)) {
      const charId = build.characterId;
      if (!groups.has(charId)) {
        groups.set(charId, { characterId: charId, builds: [] });
      }
      groups.get(charId)!.builds.push(build);
    }
    return [...groups.values()];
  }

  it("preserves ER mustPresent in merged ER group despite 2pc builds lacking ER mustPresent", async () => {
    const buildGroups = loadPresetBuilds();
    const raw = buildRawConfigs(buildGroups, DEFAULT_COMPUTE_OPTIONS);
    const silkenRaw = raw.silken_moons_serenade;
    expect(silkenRaw).toBeDefined();

    // Verify the bug scenario exists: some configs have ER in substats but not in mustPresent
    const erInSubsNotMust = silkenRaw.filter(
      (c) =>
        c.flowerPlume.substats.includes("er") &&
        !c.flowerPlume.mustPresent.includes("er")
    );
    expect(
      erInSubsNotMust.length,
      "Test precondition: should have configs with ER in substats but not mustPresent"
    ).toBeGreaterThan(0);

    const result = await mergeConfigsAsync(
      { silken_moons_serenade: silkenRaw },
      "smartMerge",
      true,
      new AbortController().signal
    );

    const silkenResult = result.find(
      (r) => r.setId === "silken_moons_serenade"
    );
    expect(silkenResult).toBeDefined();

    // Every merged config that only serves ER characters should have ER must-present
    const nonErCharacters = new Set(["ineffa"]);
    for (const config of silkenResult!.configurations) {
      const allAreEr = config.servedCharacters.every(
        (c) => !nonErCharacters.has(c.characterId)
      );
      if (allAreEr && config.flowerPlume.substats.includes("er")) {
        expect(
          config.flowerPlume.mustPresent,
          `ER group [${config.servedCharacters.map((c) => c.characterId)}] missing ER mustPresent`
        ).toContain("er");
      }
    }
  });
});
