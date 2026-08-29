import { describe, expect, it } from "vitest";
import { buildArtifactChoiceSearchCoverageReport } from "../src/artifactChoiceSearchCoverage";
import { readJson, stableJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  KnowledgeRepositorySchema,
  type ArtifactChoice,
  type KnowledgeRepository,
} from "../src/schemas";

describe("artifact-choice search-space coverage", () => {
  it("measures every artifact field on current non-rejected guide and team records", async () => {
    const report = buildArtifactChoiceSearchCoverageReport(
      await loadRepository(),
    );

    expect(report).toMatchObject({
      schemaVersion: 2,
      classification: "artifact-choice-search-space-coverage",
      supportsGuideClaims: false,
      searchSpace: { catalogScope: "released" },
      summary: {
        guideBuilds: {
          total: 188,
          enumeratedInitially: 167,
          conditionallyRepresentable: 14,
          notRepresentable: 7,
        },
        teamSelectedArtifacts: {
          total: 840,
          enumeratedInitially: 820,
          conditionallyRepresentable: 7,
          notRepresentable: 13,
        },
        recommendations: {
          total: 38,
          enumeratedInitially: 31,
          conditionallyRepresentable: 0,
          notRepresentable: 7,
        },
        teamArtifactPlanAssignments: {
          total: 2,
          enumeratedInitially: 2,
          conditionallyRepresentable: 0,
          notRepresentable: 0,
        },
        all: {
          total: 1068,
          enumeratedInitially: 1020,
          conditionallyRepresentable: 21,
          notRepresentable: 27,
        },
      },
    });
    expect(report.searchSpace.initialFourPieceKeys).toHaveLength(43);
    expect(report.searchSpace.maximumConditionalTwoPieceKeys).toHaveLength(14);
    expect(report.searchSpace.initialFourPieceKeys).not.toContain(
      "glacier_and_snowfield",
    );
    expect(new Set(report.searchSpace.initialFourPieceKeys).size).toBe(43);
    expect(
      new Set(report.searchSpace.maximumConditionalTwoPieceKeys).size,
    ).toBe(14);

    const failures = report.observations
      .filter(({ outcome }) => outcome === "not-representable")
      .map(({ recordId, characterId, sourceRecordId, failureReason }) => ({
        recordId,
        characterId,
        sourceRecordId,
        failureReason,
      }));
    expect(failures).toEqual(
      expect.arrayContaining([
        baselineFailure("aino", "FwtZU5m", "non-five-star-filter"),
        baselineFailure("gorou", "oIkK5m", "non-five-star-filter"),
        baselineFailure("klee", "1pV37uu", "non-five-star-filter"),
        baselineFailure("nilou", "8VvBtLm", "non-five-star-filter"),
        baselineFailure("xilonen", "Dbspw5m", "non-five-star-filter"),
        baselineFailure(
          "freminet",
          "Apmx9Du",
          "unmapped-dynamic-half-set-family",
        ),
        baselineFailure(
          "yelan",
          "7TUW-dG",
          "unmapped-dynamic-half-set-family",
        ),
        expect.objectContaining({
          recordId:
            "kqm:character-guide:diona-support-artifact-sets-luna-viii",
          characterId: "diona",
          failureReason: "non-five-star-filter",
        }),
        expect.objectContaining({
          recordId:
            "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt",
          characterId: "bennett",
          failureReason: "non-five-star-filter",
        }),
      ]),
    );
    expect(failures).toHaveLength(27);
    expect(report.summary.byFailureReason).toEqual({
      "beta-only-artifact": 0,
      "insufficient-distinct-released-five-star-sets": 0,
      "missing-runtime-artifact": 0,
      "missing-runtime-half-set": 0,
      "no-released-five-star-set-for-half-set": 0,
      "non-five-star-filter": 21,
      "tier-list-other-filter": 1,
      "unexpected-conditional-candidate-omission": 0,
      "unexpected-initial-candidate-omission": 0,
      "unmapped-dynamic-half-set-family": 5,
    });

    const unavailableTeamSelections = report.observations.filter(
      ({ sourceKind, outcome }) =>
        sourceKind === "team-selected-artifact" &&
        outcome === "not-representable",
    );
    expect(
      unavailableTeamSelections.filter(
        ({ recordStatus, artifact }) =>
          recordStatus === "baseline" &&
          artifact.type === "4pc" &&
          artifact.setId === "instructor",
      ),
    ).toHaveLength(11);
    expect(
      unavailableTeamSelections.filter(
        ({ recordStatus, artifact }) =>
          recordStatus === "candidate" &&
          artifact.type === "4pc" &&
          artifact.setId === "the_exile",
      ),
    ).toHaveLength(2);
  });

  it("is deterministic, mutation-free, and accounts for each eligible occurrence once", async () => {
    const repository = await loadRepository();
    const before = structuredClone(repository);
    const first = buildArtifactChoiceSearchCoverageReport(repository);
    const reordered = buildArtifactChoiceSearchCoverageReport({
      ...repository,
      records: [...repository.records].reverse(),
    });

    expect(first.summary.all.total).toBe(
      countEligibleArtifactOccurrences(repository),
    );
    expect(
      new Set(first.observations.map(({ observationId }) => observationId)).size,
    ).toBe(first.observations.length);
    expect(
      first.observations.map(({ observationId }) => observationId),
    ).toEqual(
      first.observations
        .map(({ observationId }) => observationId)
        .sort((left, right) => left.localeCompare(right)),
    );
    expect(stableJson(first)).toBe(stableJson(reordered));
    expect(repository).toEqual(before);

    const firstBuild = first.observations.find(
      ({ sourceKind }) => sourceKind === "guide-build",
    );
    const sourceRecord = repository.records.find(
      ({ id }) => id === firstBuild?.recordId,
    );
    expect(firstBuild?.sourceRefs).toEqual(sourceRecord?.sourceRefs);
    expect(firstBuild?.sourceRefs).not.toBe(sourceRecord?.sourceRefs);

    const rejected = syntheticFailureRepository([
      { type: "4pc", setId: "instructor" },
    ]);
    rejected.records[0].status = "rejected";
    expect(buildArtifactChoiceSearchCoverageReport(rejected).summary.all).toEqual(
      {
        total: 0,
        enumeratedInitially: 0,
        conditionallyRepresentable: 0,
        notRepresentable: 0,
      },
    );
  });

  it("preserves hidden, constellation, and external recommendation context", async () => {
    const report = buildArtifactChoiceSearchCoverageReport(
      await loadRepository(),
    );

    expect(
      report.observations.find(
        ({ sourceKind, characterId, sourceRecordId }) =>
          sourceKind === "guide-build" &&
          characterId === "freminet" &&
          sourceRecordId === "Apmx9Du",
      ),
    ).toMatchObject({
      sourceKind: "guide-build",
      visible: false,
      outcome: "not-representable",
      failureReason: "unmapped-dynamic-half-set-family",
    });
    expect(
      report.observations.find(
        ({ sourceKind, characterId, sourceRecordId }) =>
          sourceKind === "guide-build" &&
          characterId === "yelan" &&
          sourceRecordId === "7TUW-dG",
      ),
    ).toMatchObject({ minConstellation: 6 });

    const conditionalFurina = report.observations.find(
      ({ recordId, sourceKind }) =>
        recordId === "kqm:character-guide:furina-c6-marechaussee-luna-ii" &&
        sourceKind === "character-guide-recommendation",
    );
    expect(conditionalFurina).toMatchObject({
      recordStatus: "candidate",
      characterId: "furina",
      minConstellation: 6,
      roles: ["dps"],
      classification: "conditional",
      grouping: "single",
      conditions: [
        "Furina uses her C6-enhanced attacks on-field.",
        expect.stringContaining("option rather than an automatic upgrade"),
      ],
      outcome: "enumerated-initially",
    });

    const teamInstructor = report.observations.find(
      ({ recordId, characterId, artifact }) =>
        recordId ===
          "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt" &&
        characterId === "bennett" &&
        artifact.type === "4pc" &&
        artifact.setId === "instructor",
    );
    expect(teamInstructor).toMatchObject({
      sourceKind: "team-member-recommendation",
      recordStatus: "candidate",
      conditions: ["Bennett uses a support build in this team."],
      outcome: "not-representable",
      failureReason: "non-five-star-filter",
    });

    const kleeSupportInstructor = report.observations.find(
      ({ recordId, characterId, artifact, sourceKind }) =>
        recordId ===
          "kqm:character-guide:klee-c2-off-field-support-equipment-luna-iv" &&
        characterId === "klee" &&
        sourceKind === "character-guide-recommendation" &&
        artifact.type === "4pc" &&
        artifact.setId === "instructor",
    );
    expect(kleeSupportInstructor).toMatchObject({
      recordStatus: "candidate",
      minConstellation: 2,
      classification: "recommended",
      outcome: "not-representable",
      failureReason: "non-five-star-filter",
    });

    const kokomiPlanAssignments = report.observations.filter(
      ({ recordId, sourceKind }) =>
        recordId ===
          "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example" &&
        sourceKind === "team-artifact-plan-assignment",
    );
    expect(kokomiPlanAssignments).toHaveLength(2);
    expect(kokomiPlanAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          characterId: "sangonomiya_kokomi",
          planId: "well-invested-columbina-artifact-delegation",
          planClassification: "conditional",
          planConditions: ["Columbina is well-invested."],
          artifact: {
            type: "4pc",
            setId: "silken_moons_serenade",
          },
          outcome: "enumerated-initially",
        }),
        expect.objectContaining({
          characterId: "columbina",
          planId: "well-invested-columbina-artifact-delegation",
          planClassification: "conditional",
          planConditions: ["Columbina is well-invested."],
          artifact: {
            type: "4pc",
            setId: "aubade_of_morningstar_and_moon",
          },
          outcome: "enumerated-initially",
        }),
      ]),
    );
  });

  it("distinguishes current candidate-grammar failure causes", () => {
    const report = buildArtifactChoiceSearchCoverageReport(
      syntheticFailureRepository([
        { type: "4pc", setId: "glacier_and_snowfield" },
        { type: "4pc", setId: "instructor" },
        { type: "4pc", setId: "retracing_bolide" },
        { type: "4pc", setId: "not-a-catalog-set" },
        { type: "2pc+2pc", halfSetIds: ["not-a-half-set", "atk%-18"] },
        { type: "2pc+2pc", halfSetIds: ["cr-12", "atk%-18"] },
        { type: "2pc+2pc", halfSetIds: ["hydro%-15", "hydro%-15"] },
        { type: "2pc+2pc", halfSetIds: ["def%-30", "def%-30"] },
      ]),
    );

    expect(
      report.observations.map(({ failureReason }) => failureReason),
    ).toEqual([
      "beta-only-artifact",
      "non-five-star-filter",
      "tier-list-other-filter",
      "missing-runtime-artifact",
      "missing-runtime-half-set",
      "no-released-five-star-set-for-half-set",
      "unmapped-dynamic-half-set-family",
      "insufficient-distinct-released-five-star-sets",
    ]);
  });

  it("adds no ranking, score, winner, combat-result, or energy-result fields", async () => {
    const report = buildArtifactChoiceSearchCoverageReport(
      await loadRepository(),
    );
    const prohibitedKeys = new Set([
      "rank",
      "ranking",
      "score",
      "winner",
      "damage",
      "dps",
      "er",
      "energy",
    ]);

    expect(collectKeys(report).filter((key) => prohibitedKeys.has(key))).toEqual(
      [],
    );
    expect(report.supportsGuideClaims).toBe(false);
  });
});

async function loadRepository(): Promise<KnowledgeRepository> {
  return KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH),
  );
}

function baselineFailure(
  characterId: string,
  sourceRecordId: string,
  failureReason: string,
) {
  return expect.objectContaining({
    recordId: `genshintools-presets:character-guide:${characterId}`,
    characterId,
    sourceRecordId,
    failureReason,
  });
}

function syntheticFailureRepository(
  artifacts: ArtifactChoice[],
): KnowledgeRepository {
  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: "0".repeat(64),
    generatedFrom: [],
    records: [
      {
        id: "synthetic:guide",
        kind: "character_guide",
        status: "baseline",
        characterId: "synthetic",
        builds: artifacts.map((artifact, index) => ({
          sourceRecordId: `build-${index}`,
          visible: true,
          artifact,
          sands: [],
          goblet: [],
          circlet: [],
          substats: [],
        })),
        sourceRefs: [
          {
            sourceId: "genshintools-presets",
            sourceRecordId: "synthetic:guide",
            locator: { file: "synthetic.json" },
          },
        ],
        unknowns: [],
      },
    ],
  });
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}

function countEligibleArtifactOccurrences(
  repository: KnowledgeRepository,
): number {
  let count = 0;
  for (const record of repository.records) {
    if (record.status === "rejected") continue;
    if (record.kind === "character_guide") {
      count += record.builds.length;
      count += (record.recommendations ?? []).reduce(
        (recommendationTotal, recommendation) =>
          recommendationTotal +
          (recommendation.artifactRecommendations ?? []).reduce(
            (groupTotal, group) => groupTotal + group.artifacts.length,
            0,
          ),
        0,
      );
    }
    if (record.kind === "team") {
      count += record.members.reduce(
        (memberTotal, member) =>
          memberTotal +
          (member.selectedArtifact == null ? 0 : 1) +
          (member.artifactRecommendations ?? []).reduce(
            (groupTotal, group) => groupTotal + group.artifacts.length,
            0,
          ),
        0,
      );
      count +=
        record.artifactPlans?.reduce(
          (planTotal, plan) => planTotal + plan.assignments.length,
          0,
        ) ?? 0;
    }
  }
  return count;
}
