import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { consolidateKnowledge } from "../src/consolidation";
import { sha256File } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  ManualObservationSnapshotSchema,
  type GenshinToolsPresetSnapshot,
  type LegacyTeamSnapshot,
  type ManualObservationSnapshot,
  type SourceRegistry,
} from "../src/schemas";
import {
  validateKnowledgeRepository,
  validateManualObservationSnapshot,
} from "../src/validation";

const SOURCE_REGISTRY_SHA256 = "0".repeat(64);
const PACKAGE_PATH = "package.json";

describe("team artifact assignment plans", () => {
  it("requires at least two concrete team assignments", () => {
    const snapshot = manualSnapshot();
    const team = getManualTeam(snapshot);
    const plan = team.artifactPlans?.[0];
    if (!plan) throw new Error("Expected an artifact plan fixture");
    plan.assignments = [plan.assignments[0]];

    expect(ManualObservationSnapshotSchema.safeParse(snapshot).success).toBe(
      false,
    );
  });

  it("validates plan identity, team ownership, and artifact catalogs", async () => {
    const snapshot = manualSnapshot();
    const team = getManualTeam(snapshot);
    const firstPlan = team.artifactPlans?.[0];
    const secondPlan = team.artifactPlans?.[1];
    if (!firstPlan || !secondPlan) {
      throw new Error("Expected two artifact plan fixtures");
    }
    secondPlan.id = firstPlan.id;
    firstPlan.assignments[1].characterId =
      firstPlan.assignments[0].characterId;
    secondPlan.assignments[0] = {
      characterId: "barbara",
      artifact: { type: "4pc", setId: "unknown-four-piece" },
    };
    secondPlan.assignments[1].artifact = {
      type: "2pc+2pc",
      halfSetIds: ["unknown-half-set", "er-20"],
    };

    const diagnostics = validateManualObservationSnapshot(
      snapshot,
      await loadGameCatalogs(),
      "kqm",
    );

    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "artifact_plan.duplicate_id",
        "artifact_plan.duplicate_assignment",
        "artifact_plan.non_member_assignment",
        "catalog.unknown_artifact_set",
        "catalog.unknown_artifact_half_set",
      ]),
    );
  });

  it("preserves source plans exactly without retaining mutable references", async () => {
    const fixture = await consolidationFixture(manualSnapshot());
    const sourceTeam = getManualTeam(fixture.snapshot);
    const consolidated = fixture.repository.records.find(
      (record) => record.kind === "team",
    );
    if (!consolidated || consolidated.kind !== "team") {
      throw new Error("Expected a consolidated team fixture");
    }

    expect(consolidated.artifactPlans).toEqual(sourceTeam.artifactPlans);
    expect(consolidated.artifactPlans).not.toBe(sourceTeam.artifactPlans);
    expect(consolidated.artifactPlans?.[0]).not.toBe(
      sourceTeam.artifactPlans?.[0],
    );
    expect(consolidated.artifactPlans?.[0].conditions).not.toBe(
      sourceTeam.artifactPlans?.[0].conditions,
    );
    expect(consolidated.artifactPlans?.[0].assignments).not.toBe(
      sourceTeam.artifactPlans?.[0].assignments,
    );
    expect(consolidated.artifactPlans?.[1].assignments[1].artifact).not.toBe(
      sourceTeam.artifactPlans?.[1].assignments[1].artifact,
    );
  });

  it("applies the same semantic checks to consolidated teams", async () => {
    const snapshot = manualSnapshot();
    const sourceTeam = getManualTeam(snapshot);
    const firstPlan = sourceTeam.artifactPlans?.[0];
    const secondPlan = sourceTeam.artifactPlans?.[1];
    if (!firstPlan || !secondPlan) {
      throw new Error("Expected two artifact plan fixtures");
    }
    secondPlan.id = firstPlan.id;
    secondPlan.assignments[0] = {
      characterId: "barbara",
      artifact: { type: "4pc", setId: "unknown-four-piece" },
    };
    secondPlan.assignments[1].artifact = {
      type: "2pc+2pc",
      halfSetIds: ["unknown-half-set", "er-20"],
    };
    const fixture = await consolidationFixture(snapshot);

    const diagnostics = validateKnowledgeRepository(fixture.repository, {
      catalogs: await loadGameCatalogs(),
      sourceRegistry: fixture.sourceRegistry,
      genshinToolsSnapshot: fixture.genshinTools,
      legacySnapshot: fixture.legacy,
      manualSnapshots: [snapshot],
    });

    expect(diagnostics.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "artifact_plan.duplicate_id",
        "artifact_plan.non_member_assignment",
        "catalog.unknown_artifact_set",
        "catalog.unknown_artifact_half_set",
      ]),
    );
  });
});

function manualSnapshot(): ManualObservationSnapshot {
  return ManualObservationSnapshotSchema.parse({
    schemaVersion: 1,
    sourceId: "kqm",
    capturedAt: "2026-08-29",
    page: {
      title: "Kokomi Guide",
      url: "https://example.com/kokomi",
      publisher: "KQM",
      sourceVersion: "Luna IV",
      attributionNote: "Paraphrased test fixture.",
    },
    records: [
      {
        kind: "team",
        sourceRecordId: "kokomi-taser-example",
        locator: {
          url: "https://example.com/kokomi",
          heading: "Teams",
        },
        supportingLocators: [],
        extraction: {
          method: "manual",
          reviewStatus: "reviewed",
          reviewer: "test-fixture",
          reviewedAt: "2026-08-29",
        },
        label: "Kokomi Taser",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        members: [
          teamMember("sangonomiya_kokomi"),
          teamMember("fischl"),
          teamMember("beidou"),
          teamMember("kaedehara_kazuha"),
        ],
        artifactPlans: [
          {
            id: "kokomi-driver-distribution",
            label: "Kokomi drives",
            classification: "recommended",
            conditions: ["When Kokomi drives the team on field."],
            assignments: [
              {
                characterId: "sangonomiya_kokomi",
                artifact: { type: "4pc", setId: "oceanhued_clam" },
              },
              {
                characterId: "fischl",
                artifact: { type: "4pc", setId: "golden_troupe" },
              },
              {
                characterId: "beidou",
                artifact: {
                  type: "4pc",
                  setId: "emblem_of_severed_fate",
                },
              },
              {
                characterId: "kaedehara_kazuha",
                artifact: { type: "4pc", setId: "viridescent_venerer" },
              },
            ],
          },
          {
            id: "kokomi-support-distribution",
            classification: "conditional",
            conditions: ["When Kokomi remains off field."],
            assignments: [
              {
                characterId: "sangonomiya_kokomi",
                artifact: {
                  type: "4pc",
                  setId: "tenacity_of_the_millelith",
                },
              },
              {
                characterId: "beidou",
                artifact: {
                  type: "2pc+2pc",
                  halfSetIds: ["er-20", "electro%-15"],
                },
              },
            ],
          },
        ],
        rotations: [],
        unknowns: [],
      },
    ],
  });
}

function teamMember(characterId: string) {
  return {
    characterId,
    weaponRecommendations: [],
    artifactRecommendations: [],
    erTargets: [],
  };
}

function getManualTeam(snapshot: ManualObservationSnapshot) {
  const record = snapshot.records[0];
  if (!record || record.kind !== "team") {
    throw new Error("Expected a manual team fixture");
  }
  return record;
}

async function consolidationFixture(snapshot: ManualObservationSnapshot) {
  const packageSha256 = await sha256File(
    `${REPOSITORY_ROOT}/${PACKAGE_PATH}`,
  );
  const genshinTools = emptyGenshinToolsSnapshot(packageSha256);
  const legacy = emptyLegacySnapshot(packageSha256);
  const registry = sourceRegistry();
  const repository = consolidateKnowledge({
    sourceRegistry: registry,
    sourceRegistrySha256: SOURCE_REGISTRY_SHA256,
    genshinTools,
    legacy,
    manualSnapshots: [
      {
        expectedSourceId: "kqm",
        snapshot,
        snapshotFile: { path: PACKAGE_PATH, sha256: packageSha256 },
      },
    ],
  });
  return {
    snapshot,
    sourceRegistry: registry,
    genshinTools,
    legacy,
    repository,
  };
}

function emptyGenshinToolsSnapshot(
  sha256: string,
): GenshinToolsPresetSnapshot {
  return {
    schemaVersion: 1,
    sourceId: "genshintools-presets",
    capturedAt: "2026-08-29",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    teams: [],
    characterGuides: [],
  };
}

function emptyLegacySnapshot(sha256: string): LegacyTeamSnapshot {
  return {
    schemaVersion: 1,
    sourceId: "legacy-team-research",
    capturedAt: "2026-08-29",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    upstreamDomains: [],
    records: [],
  };
}

function sourceRegistry(): SourceRegistry {
  return {
    schemaVersion: 1,
    sources: [
      {
        id: "genshintools-presets",
        name: "GenshinTools presets",
        homepage: null,
        kind: "internal",
        status: "active",
        ingestionMode: "internal-adapter",
        permission: "internal",
        recordFormat: "genshintools-presets-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
      {
        id: "legacy-team-research",
        name: "Legacy team research",
        homepage: null,
        kind: "internal",
        status: "active",
        ingestionMode: "internal-adapter",
        permission: "internal",
        recordFormat: "legacy-team-research-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
      {
        id: "kqm",
        name: "KQM",
        homepage: "https://example.com",
        kind: "editorial",
        status: "active",
        ingestionMode: "manual-observation",
        permission: "mixed",
        recordFormat: "manual-observation-v1",
        checkedAt: "2026-08-29",
        notes: [],
      },
    ],
  };
}
