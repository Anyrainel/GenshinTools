import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRepository,
} from "../src/schemas";
import {
  buildMirroredWeaponCandidateDomain,
  buildWeaponChoiceSearchCoverageReport,
  type WeaponChoiceSearchCoveragePolicyInputs,
  WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
} from "../src/weaponChoiceSearchCoverage";

describe("weapon-choice candidate-policy coverage", () => {
  it("keeps the durable report byte-stable with current inputs", async () => {
    const generatedFrom = await Promise.all(
      WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    );
    const expected = buildWeaponChoiceSearchCoverageReport(
      await loadRepository(),
      generatedFrom,
    );
    const saved = await readFile(
      WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
      "utf8",
    );

    expect(saved).toBe(stableJson(expected));
  });

  it("measures every current non-ER weapon occurrence on independent axes", async () => {
    const report = buildWeaponChoiceSearchCoverageReport(
      await loadRepository(),
    );

    expect(report).toMatchObject({
      schemaVersion: 1,
      classification: "weapon-choice-candidate-policy-coverage",
      supportsGuideClaims: false,
      searchSpace: {
        catalogScope: "released",
        candidateDomainOrigin: "offline-mirror",
        counts: {
          weaponIds: 236,
          weaponRefinementPairs: 309,
          byRarity: {
            "3": { weaponIds: 24, weaponRefinementPairs: 24 },
            "4": { weaponIds: 139, weaponRefinementPairs: 139 },
            "5": { weaponIds: 73, weaponRefinementPairs: 146 },
          },
          byWeaponType: {
            Bow: { weaponIds: 47, weaponRefinementPairs: 59 },
            Catalyst: { weaponIds: 51, weaponRefinementPairs: 70 },
            Claymore: { weaponIds: 43, weaponRefinementPairs: 54 },
            Polearm: { weaponIds: 41, weaponRefinementPairs: 54 },
            Sword: { weaponIds: 54, weaponRefinementPairs: 72 },
          },
        },
        candidateDomainComparison: {
          comparedAgainst: "offline-mirror",
          supportsRuntimeEquivalenceClaim: false,
          detected: false,
          unexpectedOmissions: [],
          unexpectedCandidates: [],
          metadataMismatches: [],
        },
      },
      summary: {
        all: { total: 982 },
        bySourceKind: {
          guideWeaponOrder: 127,
          teamSelectedWeapons: 840,
          characterGuideRecommendations: 15,
          teamMemberRecommendations: 0,
        },
        weaponIdDomain: {
          inReleasedCandidateDomain: 982,
          excludedFromReleasedCandidateDomain: 0,
        },
        refinementCoverage: {
          exactCandidate: 0,
          unspecified: 982,
          excludedByPolicy: 0,
        },
        nativeTypeCompatibility: {
          compatible: 970,
          mismatched: 12,
          unknown: 0,
        },
      },
      deferredWeaponConditions: {
        analyzed: false,
        weaponConditionObjects: 3,
        explicitWeaponIdOccurrences: 4,
        categoryConditions: 1,
      },
    });
    expect(report.searchSpace.candidateWeaponIds).toHaveLength(236);
    expect(new Set(report.searchSpace.candidateWeaponIds).size).toBe(236);
    expect(
      new Set(
        report.searchSpace.candidatePairs.map(
          ({ weaponId, refinement }) => `${weaponId}@R${refinement}`,
        ),
      ).size,
    ).toBe(309);

    expect(report.summary.weaponIdDomain.byFailureReason).toEqual({
      "beta-only-weapon": 0,
      "low-rarity-filter": 0,
      "missing-weapon-stats": 0,
      "unexpected-policy-omission": 0,
    });
    expect(report.summary.refinementCoverage.byFailureReason).toEqual({
      "refinement-not-enumerated-by-policy": 0,
      "unexpected-policy-omission": 0,
      "weapon-id-outside-domain": 0,
    });
    const mismatches = report.observations.filter(
      ({ nativeTypeCompatibility }) =>
        nativeTypeCompatibility.outcome === "mismatched",
    );
    expect(mismatches).toHaveLength(12);
    expect(
      mismatches.every(
        ({ sourceKind, recordStatus, sourceRefs }) =>
          sourceKind === "team-selected-weapon" &&
          recordStatus === "candidate" &&
          sourceRefs.every(
            ({ sourceId }) => sourceId === "legacy-team-research",
          ),
      ),
    ).toBe(true);

    expect(
      report.deferredWeaponConditions.references.map(
        ({ sourceKind, weaponCondition }) => ({
          sourceKind,
          weaponCondition,
        }),
      ),
    ).toEqual([
      {
        sourceKind: "energy-guidance-target",
        weaponCondition: {
          type: "specific",
          weaponIds: ["sacrificial_bow"],
        },
      },
      {
        sourceKind: "energy-guidance-target",
        weaponCondition: {
          type: "specific",
          weaponIds: ["favonius_warbow"],
        },
      },
      {
        sourceKind: "energy-guidance-target",
        weaponCondition: {
          type: "category",
          weaponType: "Bow",
          excludedWeaponIds: ["sacrificial_bow", "favonius_warbow"],
        },
      },
    ]);
  });

  it("preserves source ordering, recommendation context, team context, and provenance", async () => {
    const repository = await loadRepository();
    const before = structuredClone(repository);
    const report = buildWeaponChoiceSearchCoverageReport(repository);

    const firstAinoWeapon = report.observations.find(
      ({ recordId, sourceKind }) =>
        recordId === "genshintools-presets:character-guide:aino" &&
        sourceKind === "guide-weapon-order",
    );
    expect(firstAinoWeapon).toMatchObject({
      characterId: "aino",
      weaponId: "flameforged_insight",
      sourceListIndex: 0,
      sourceListLength: 1,
      refinementCoverage: { outcome: "unspecified" },
      nativeTypeCompatibility: {
        outcome: "compatible",
        characterWeaponType: "Claymore",
        weaponTypeFromStats: "Claymore",
      },
    });

    const conditionalDionaWeapon = report.observations.find(
      ({ recordId, weaponId, sourceKind }) =>
        recordId ===
          "kqm:character-guide:diona-support-weapons-luna-viii" &&
        weaponId === "sacrificial_bow" &&
        sourceKind === "character-guide-recommendation",
    );
    expect(conditionalDionaWeapon).toMatchObject({
      recommendationId: "support-weapons",
      recommendationLabel: "Support weapons",
      recommendationOrdering: "unranked",
      recommendationGroupIndex: 1,
      weaponIndex: 0,
      grouping: "single",
      classification: "alternative",
      conditions: [
        "The team values Cryo batterying or Diona can appear twice per rotation.",
      ],
      roles: ["support", "sustain"],
    });

    const selectedWeapon = report.observations.find(
      ({ sourceKind }) => sourceKind === "team-selected-weapon",
    );
    expect(selectedWeapon).toMatchObject({
      sourceKind: "team-selected-weapon",
      memberIndex: 0,
      memberInvestment: { status: "unspecified" },
      teamContext: {
        reactions: ["superconduct"],
        characterIds: ["eula", "furina", "mika", "raiden_shogun"],
      },
    });
    const sourceRecord = repository.records.find(
      ({ id }) => id === selectedWeapon?.recordId,
    );
    expect(selectedWeapon?.sourceRefs).toEqual(sourceRecord?.sourceRefs);
    expect(selectedWeapon?.sourceRefs).not.toBe(sourceRecord?.sourceRefs);
    expect(repository).toEqual(before);
  });

  it("is deterministic and accounts for each eligible occurrence once", async () => {
    const repository = await loadRepository();
    const first = buildWeaponChoiceSearchCoverageReport(repository);
    const reordered = buildWeaponChoiceSearchCoverageReport({
      ...repository,
      records: [...repository.records].reverse(),
    });

    expect(first.summary.all.total).toBe(
      countEligibleWeaponOccurrences(repository),
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

    const rejected = syntheticRepository();
    rejected.records[0].status = "rejected";
    expect(
      buildWeaponChoiceSearchCoverageReport(rejected, [], {
        policyInputs: syntheticPolicyInputs(),
      }).observations.filter(
        ({ recordId }) => recordId === "synthetic:guide",
      ),
    ).toEqual([]);
  });

  it("separates beta, stats, resource, rarity, refinement, and type failures", () => {
    const report = buildWeaponChoiceSearchCoverageReport(
      syntheticRepository(),
      [],
      { policyInputs: syntheticPolicyInputs() },
    );

    expect(
      report.observations.find(({ weaponId }) => weaponId === "beta_blade"),
    ).toMatchObject({
      weaponIdDomain: {
        outcome: "excluded-from-released-candidate-domain",
        failureReason: "beta-only-weapon",
        weaponStatsAvailable: true,
        releasedResourceAvailable: false,
        betaOnly: true,
      },
    });
    expect(
      report.observations.find(
        ({ weaponId }) => weaponId === "resource_only_bow",
      ),
    ).toMatchObject({
      weaponIdDomain: {
        outcome: "excluded-from-released-candidate-domain",
        failureReason: "missing-weapon-stats",
        weaponStatsAvailable: false,
        releasedResourceAvailable: true,
      },
      nativeTypeCompatibility: { outcome: "unknown" },
    });
    expect(
      report.observations.find(
        ({ weaponId }) => weaponId === "stats_only_bow",
      ),
    ).toMatchObject({
      weaponIdDomain: {
        outcome: "in-released-candidate-domain",
        weaponStatsAvailable: true,
        releasedResourceAvailable: false,
        resolvedPolicyRarity: 4,
        candidateRefinements: [5],
      },
    });
    expect(
      report.observations.find(({ weaponId }) => weaponId === "low_bow"),
    ).toMatchObject({
      weaponIdDomain: {
        outcome: "excluded-from-released-candidate-domain",
        failureReason: "low-rarity-filter",
        resolvedPolicyRarity: 2,
      },
    });

    const exactFourStar = report.observations.find(
      ({ observationId }) =>
        observationId === "synthetic:team:member:0:selected-weapon",
    );
    expect(exactFourStar).toMatchObject({
      characterId: "bow_user",
      weaponId: "valid_bow",
      refinementCoverage: { outcome: "exact-candidate", requestedRefinement: 5 },
      nativeTypeCompatibility: { outcome: "compatible" },
    });
    const unsupportedFourStar = report.observations.find(
      ({ observationId }) =>
        observationId === "synthetic:team:member:1:selected-weapon",
    );
    expect(unsupportedFourStar).toMatchObject({
      weaponId: "valid_bow",
      weaponIdDomain: { outcome: "in-released-candidate-domain" },
      refinementCoverage: {
        outcome: "excluded-by-policy",
        requestedRefinement: 1,
        failureReason: "refinement-not-enumerated-by-policy",
      },
      nativeTypeCompatibility: { outcome: "compatible" },
    });
    const wrongType = report.observations.find(
      ({ observationId }) =>
        observationId === "synthetic:team:member:2:selected-weapon",
    );
    expect(wrongType).toMatchObject({
      weaponId: "valid_sword",
      refinementCoverage: { outcome: "exact-candidate", requestedRefinement: 1 },
      nativeTypeCompatibility: {
        outcome: "mismatched",
        characterWeaponType: "Bow",
        weaponTypeFromStats: "Sword",
      },
    });

    expect(
      report.searchSpace.candidatePairs.find(
        ({ weaponId }) => weaponId === "stats_only_bow",
      ),
    ).toEqual({
      weaponId: "stats_only_bow",
      weaponType: "Bow",
      rarity: 4,
      refinement: 5,
    });
    expect(
      report.searchSpace.candidateWeaponIds,
    ).not.toEqual(expect.arrayContaining(["beta_blade", "low_bow"]));
  });

  it("makes unexpected mirrored-policy omissions falsifiable", () => {
    const inputs = syntheticPolicyInputs();
    const completeDomain = buildMirroredWeaponCandidateDomain(inputs);
    const missingValidBow = {
      candidates: completeDomain.candidates.filter(
        ({ weaponId }) => weaponId !== "valid_bow",
      ),
    };
    const report = buildWeaponChoiceSearchCoverageReport(
      syntheticRepository(),
      [],
      { policyInputs: inputs, candidateDomain: missingValidBow },
    );

    expect(report.searchSpace).toMatchObject({
      candidateDomainOrigin: "provided-for-audit",
      candidateDomainComparison: {
        detected: true,
        unexpectedOmissions: ["valid_bow@R5"],
      },
    });
    expect(
      report.observations.find(
        ({ observationId }) =>
          observationId === "synthetic:team:member:0:selected-weapon",
      ),
    ).toMatchObject({
      weaponIdDomain: {
        outcome: "excluded-from-released-candidate-domain",
        failureReason: "unexpected-policy-omission",
      },
      refinementCoverage: {
        outcome: "excluded-by-policy",
        failureReason: "unexpected-policy-omission",
      },
    });
  });

  it("adds no score, winner, combat result, or analyzed ER target", async () => {
    const report = buildWeaponChoiceSearchCoverageReport(
      await loadRepository(),
    );
    const prohibitedKeys = new Set([
      "score",
      "winner",
      "damage",
      "dps",
      "rank",
      "minPercent",
      "maxPercent",
      "supportingCalculationPercent",
      "supportingDisplayedPercent",
    ]);

    expect(collectKeys(report).filter((key) => prohibitedKeys.has(key))).toEqual(
      [],
    );
    expect(report.supportsGuideClaims).toBe(false);
    expect(
      report.deferredWeaponConditions.references.every(
        ({ analyzed }) => analyzed === false,
      ),
    ).toBe(true);
  });
});

async function loadRepository(): Promise<KnowledgeRepository> {
  return KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH),
  );
}

function syntheticPolicyInputs(): WeaponChoiceSearchCoveragePolicyInputs {
  return {
    weaponStats: {
      beta_blade: { rarity: 4, type: "Sword" },
      stats_only_bow: { rarity: 4, type: "Bow" },
      low_bow: { rarity: 5, type: "Bow" },
      valid_bow: { rarity: 4, type: "Bow" },
      valid_sword: { rarity: 5, type: "Sword" },
    },
    characterWeaponTypes: {
      bow_user: "Bow",
      unknown_user: undefined,
    },
    releasedWeaponResources: {
      resource_only_bow: { rarity: 4 },
      low_bow: { rarity: 2 },
      valid_bow: { rarity: 4 },
      valid_sword: { rarity: 5 },
    },
    betaOnlyWeaponIds: new Set(["beta_blade"]),
  };
}

function syntheticRepository(): KnowledgeRepository {
  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: "0".repeat(64),
    generatedFrom: [],
    records: [
      {
        id: "synthetic:guide",
        kind: "character_guide",
        status: "baseline",
        characterId: "bow_user",
        weaponOrder: [
          "beta_blade",
          "resource_only_bow",
          "stats_only_bow",
          "low_bow",
        ],
        builds: [],
        sourceRefs: [sourceReference("synthetic:guide")],
        unknowns: [],
      },
      {
        id: "synthetic:team",
        kind: "team",
        status: "candidate",
        label: "Synthetic team context",
        intent: "example",
        exhaustiveness: "non-exhaustive",
        rankingClaim: "none",
        members: [
          syntheticMember("bow_user", "valid_bow", 5, 0),
          syntheticMember("bow_user", "valid_bow", 1, 2),
          syntheticMember("bow_user", "valid_sword", 1, 6),
          syntheticMember("unknown_user", "resource_only_bow", 5),
        ],
        reactions: ["frozen"],
        damagePlans: [],
        sourceRefs: [sourceReference("synthetic:team")],
        unknowns: [],
      },
    ],
  });
}

function syntheticMember(
  characterId: string,
  weaponId: string,
  refinement: number,
  constellation?: number,
) {
  return {
    characterId,
    investment:
      constellation == null
        ? { status: "unspecified" as const }
        : {
            status: "partial" as const,
            constellation,
            talentLevels: [9, 9, 9],
          },
    selectedWeapon: { weaponId, refinement },
    selectedArtifact: null,
  };
}

function sourceReference(sourceRecordId: string) {
  return {
    sourceId: "genshintools-presets",
    sourceRecordId,
    locator: { file: "synthetic.json", recordId: sourceRecordId },
  };
}

function countEligibleWeaponOccurrences(
  repository: KnowledgeRepository,
): number {
  let count = 0;
  for (const record of repository.records) {
    if (record.status === "rejected") continue;
    if (record.kind === "character_guide") {
      count += record.weaponOrder?.length ?? 0;
      count += (record.recommendations ?? []).reduce(
        (recommendationTotal, recommendation) =>
          recommendationTotal +
          (recommendation.weaponRecommendations ?? []).reduce(
            (groupTotal, group) => groupTotal + group.weaponIds.length,
            0,
          ),
        0,
      );
    }
    if (record.kind === "team") {
      count += record.members.reduce(
        (memberTotal, member) =>
          memberTotal +
          (member.selectedWeapon == null ? 0 : 1) +
          (member.weaponRecommendations ?? []).reduce(
            (groupTotal, group) => groupTotal + group.weaponIds.length,
            0,
          ),
        0,
      );
    }
  }
  return count;
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
