/**
 * Golden snapshot tests for the merge algorithms.
 *
 * Loads the actual preset builds, runs the full pipeline
 * (buildRawConfigs → mergeConfigsAsync) with each algorithm,
 * and compares the output against stored golden JSON files.
 *
 * To update golden files after an intentional behavioral change:
 *   UPDATE_GOLDEN=1 npm run test -- tests/lib/artifact-builds/goldenMerge.test.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { MergeAlgorithm } from "@/data/enums";
import type {
  ArtifactBuildConfigs,
  BuildGroup,
  BuildPayloadV5,
} from "@/data/types";
import { migrateBuild } from "@/lib/artifact-builds/buildMigration";
import {
  buildRawConfigs,
  DEFAULT_COMPUTE_OPTIONS,
  mergeConfigsAsync,
} from "@/lib/artifact-builds/computeFilters";

const GOLDEN_DIR = resolve(__dirname, "__golden__");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

function loadPresetBuilds(): BuildGroup[] {
  const filePath = resolve(
    __dirname,
    "../../../src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json"
  );
  const payload: BuildPayloadV5 = JSON.parse(readFileSync(filePath, "utf-8"));

  // Run build-level migrations (test bypasses buildPresetRegistry which does this)
  for (const build of Object.values(payload.builds)) {
    migrateBuild(build);
  }

  const groups = new Map<string, BuildGroup>();

  for (const build of Object.values(payload.builds)) {
    const charId = build.characterId;
    if (!groups.has(charId)) {
      groups.set(charId, { characterId: charId, builds: [], hidden: false });
    }
    groups.get(charId)!.builds.push(build);
  }

  return [...groups.values()];
}

/**
 * Deterministic serialization: sort set configs by setId, sort
 * servedCharacters by id for stability across runs.
 */
function stabilize(results: ArtifactBuildConfigs[]) {
  return results
    .sort((a, b) => a.setId.localeCompare(b.setId))
    .map((setConfigs) => ({
      setId: setConfigs.setId,
      configurations: setConfigs.configurations.map((config) => ({
        flowerPlume: config.flowerPlume,
        sands: config.sands,
        goblet: config.goblet,
        circlet: config.circlet,
        servedCharacters: [...config.servedCharacters].sort((a, b) =>
          a.characterId.localeCompare(b.characterId)
        ),
      })),
    }));
}

function goldenPath(algorithm: MergeAlgorithm): string {
  return resolve(GOLDEN_DIR, `${algorithm}.json`);
}

const ALGORITHMS: MergeAlgorithm[] = [
  "smartMerge",
  "greedyMerge",
  "bruteForce",
];

describe("Golden merge snapshots", () => {
  const buildGroups = loadPresetBuilds();
  const rawConfigs = buildRawConfigs(buildGroups, DEFAULT_COMPUTE_OPTIONS);

  for (const algorithm of ALGORITHMS) {
    it(`${algorithm} produces stable output`, async () => {
      const result = await mergeConfigsAsync(
        rawConfigs,
        algorithm,
        DEFAULT_COMPUTE_OPTIONS.normalizeFlatStats ?? true,
        new AbortController().signal
      );

      const actual = stabilize(result);
      const path = goldenPath(algorithm);

      if (UPDATE || !existsSync(path)) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(path, JSON.stringify(actual, null, 2));
        return; // First run creates the golden file
      }

      const expected = JSON.parse(readFileSync(path, "utf-8"));
      expect(actual).toEqual(expected);
    });
  }
});
