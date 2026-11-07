import { afterEach, expect, it, vi } from "vitest";
import type { ArtifactData, Build } from "@/domain/models";
import { artifactHalfSets } from "@/generated/catalog/resources";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const build: Build = {
  id: "half-set-build",
  characterId: "kaeya",
  name: "ATK and ER",
  visible: true,
  composition: "2pc+2pc",
  halfSet1: "atk%-18",
  halfSet2: "er-20",
  sandsWeights: [{ stat: "atk%", weight: 100 }],
  gobletWeights: [{ stat: "cryo%", weight: 100 }],
  circletWeights: [{ stat: "cr", weight: 100 }],
  normalizer: 0,
  substats: [
    { stat: "cr", weight: 100 },
    { stat: "cd", weight: 100 },
    { stat: "atk%", weight: 80 },
  ],
};

function artifact(
  setKey: string,
  slotKey: ArtifactData["slotKey"],
  mainStatKey: ArtifactData["mainStatKey"]
): ArtifactData {
  return {
    id: `${setKey}-${slotKey}`,
    setKey,
    slotKey,
    mainStatKey,
    level: 20,
    rarity: 5,
    lock: true,
    substats: {},
  };
}

function equippedPair(atkSet: string, erSet: string) {
  return {
    flower: artifact(atkSet, "flower", "hp"),
    plume: artifact(atkSet, "plume", "atk"),
    sands: artifact(erSet, "sands", "atk%"),
    goblet: artifact(erSet, "goblet", "cryo%"),
  };
}

it.each([true, false])(
  "keeps canonical IDs and released half-set positions with beta=%s",
  async (enabled) => {
    vi.stubEnv("__BETA_ENABLED_OVERRIDE__", String(enabled));
    vi.resetModules();
    const catalog = await import("@/domain/reference/catalog");
    expect(catalog.allHalfSets.map(({ id }) => id)).toEqual(
      artifactHalfSets.map(({ id }) => id)
    );
    expect(new Set(catalog.allHalfSetIds).size).toBe(
      catalog.allHalfSetIds.length
    );
    expect(new Set(catalog.allHalfSets.map(({ id }) => id)).size).toBe(
      catalog.allHalfSets.length
    );
    for (const released of artifactHalfSets) {
      const merged = catalog.artifactHalfSetsById[released.id]!;
      expect(merged.setIds.slice(0, released.setIds.length)).toEqual(
        released.setIds
      );
      expect(new Set(merged.setIds).size).toBe(merged.setIds.length);
    }
    for (const [setId, halfSetId] of [
      ["artifact_15049", "atk%-18"],
      ["artifact_15050", "er-20"],
      ["glacier_and_snowfield", "cryo%-15"],
    ] as const) {
      expect(catalog.artifactIdToHalfSetId[setId]).toBe(
        enabled ? halfSetId : undefined
      );
      expect(
        catalog.artifactHalfSetsById[halfSetId]!.setIds.includes(setId)
      ).toBe(enabled);
    }
    expect(catalog.artifactIdToHalfSetId.gladiators_finale).toBe("atk%-18");
    expect(catalog.artifactIdToHalfSetId.emblem_of_severed_fate).toBe("er-20");
  }
);

it.each([true, false])(
  "uses the same beta=%s memberships in scoring and computed artifact filters",
  async (enabled) => {
    vi.stubEnv("__BETA_ENABLED_OVERRIDE__", String(enabled));
    vi.resetModules();
    const { matchBuild } = await import(
      "@/domain/build/artifact/scoring/artifactScore"
    );
    const { buildRawConfigs } = await import("@/domain/build/computeFilters");
    expect(
      matchBuild(equippedPair("artifact_15049", "artifact_15050"), [build], 0)!
        .setMatched
    ).toBe(enabled);
    expect(
      matchBuild(
        equippedPair("gladiators_finale", "emblem_of_severed_fate"),
        [build],
        0
      )!.setMatched
    ).toBe(true);
    const filters = buildRawConfigs([
      { characterId: "kaeya", builds: [build], hidden: false },
    ]);
    for (const setId of ["artifact_15049", "artifact_15050"]) {
      expect(Object.hasOwn(filters, setId)).toBe(enabled);
    }
    expect(Object.hasOwn(filters, "gladiators_finale")).toBe(true);
    expect(Object.hasOwn(filters, "emblem_of_severed_fate")).toBe(true);
  }
);
