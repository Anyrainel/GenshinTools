import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatNoelleSourceLocalLowerInvestmentSliceSummary } from "../src/assemble-noelle-source-local-lower-investment-slice";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  authenticateNoelleSourceLocalLowerInvestmentSliceReport,
  buildNoelleSourceLocalLowerInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  requireComparableNoelleSourceLocalLowerInvestmentSliceReport,
  type BuildNoelleSourceLocalLowerInvestmentSliceInput,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "../src/noelleSourceLocalLowerInvestmentSlice";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-noelle-manual.json",
);
const SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const GUIDE_ID =
  "kqm:character-guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii";
const SOURCE_GUIDE_ID =
  "noelle-c0-c5-talent-9-artifact-stats-luna-viii";
const TEAM_ID =
  "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
const CONDITION =
  "Noelle is C0–C5 and her Burst Talent is Level 9.";
const CONDITIONS_SHA256 =
  "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436";
const SOURCE_PREDICATE_SHA256 =
  "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a";
const REQUEST_PREDICATE_SHA256 =
  "a5b526ea3852b0e661f06a96c1bcec5062af2bc2580bffc0b1677a7a0546c868";
const SELECTED = [
  {
    occurrenceId: `kqm:character_guide:${SOURCE_GUIDE_ID}:recommendation.mainStats.sands[0].conditions`,
    slot: "sands",
    statIds: ["atk%"],
    payloadSha256:
      "917185549050e86abe934fa610c2763e532ea9d6ca54682a8656efd9f8c6dc24",
  },
  {
    occurrenceId: `kqm:character_guide:${SOURCE_GUIDE_ID}:recommendation.mainStats.goblet[0].conditions`,
    slot: "goblet",
    statIds: ["geo%"],
    payloadSha256:
      "27b0565556c4d4cb4abe6c800046b0e1269484e769b15ce91ec7581ec6e9026a",
  },
  {
    occurrenceId: `kqm:character_guide:${SOURCE_GUIDE_ID}:recommendation.mainStats.circlet[0].conditions`,
    slot: "circlet",
    statIds: ["cr", "cd"],
    payloadSha256:
      "d227c8c1fb0defbc9cfba9365cea3a70d5ae13927f0f1438188c48dd5e437603",
  },
] as const;
const HOLDOUTS = [
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions",
    "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions",
    "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions",
    "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4",
  ],
  ...[0, 1, 2].map((index) => [
    `kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[${index}].conditions`,
    "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
  ] as const),
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[1].conditions",
    "7444217b95d562ae6cffb22b51e7c6ef6da6891851967415925d6713c254e2c6",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[1].conditions",
    "778b1c674223e02b4b58c3903c6ac809f5bab52e2c216e93003320fd1657f748",
  ],
  ...[0, 1, 2].map((index) => [
    `kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[${index}].conditions`,
    "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
  ] as const),
  [
    "kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions",
    "f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf",
  ],
] as const;

describe("Noelle source-local lower-investment slice", () => {
  it("authenticates the exact 3+12+1 source corpus and C5 plus Burst 9 request projection", async () => {
    const input = await fixture();
    const report = buildNoelleSourceLocalLowerInvestmentSliceReport(input);

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.rawInputBoundary).toMatchObject({
      status: "accepted",
      exactPathSet: true,
      byteAndParsedObjectClosure: true,
      sourceFileCount: 4,
    });
    expect(report.sourceBoundary).toMatchObject({
      status: "accepted",
      sourceVersion: "Luna VIII",
      rawRecordCount: 5,
      totalConditionArrayCount: 16,
      nonemptyConditionArrayCount: 15,
      emptyConditionArrayCount: 1,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 12,
      selectedAndHoldoutsCloseAllNonemptyNoelleConditions: true,
      emptyOccurrenceClosureExact: true,
      repositoryParity: "exact",
      samePageLineage: true,
      guideAndTeamShareExactSourceDocument: true,
      crossRecordJoinOwnedByWrapper: true,
      sourceAuthoredCrossRecordJoin: false,
      promotionEligible: false,
    });
    expect(report.summary).toEqual({
      totalConditionArrayCount: 16,
      nonemptyConditionArrayCount: 15,
      emptyConditionArrayCount: 1,
      selectedOccurrenceCount: 3,
      selectedUniqueConditionArrayCount: 1,
      holdoutOccurrenceCount: 12,
      sourceTeamCount: 1,
      sourceCellCount: 3,
      sourceMatchedCount: 0,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 3,
      contextApplicableCount: 3,
      sourceAlreadyMatchedCount: 0,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 3,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 3,
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      emptyConsumedCount: 0,
      candidateCount: 0,
      equipmentAssignmentCount: 0,
      optimizationCount: 0,
      assembledBuildCount: 0,
    });
    expect(() =>
      requireComparableNoelleSourceLocalLowerInvestmentSliceReport(report, input),
    ).not.toThrow();
    expect(formatNoelleSourceLocalLowerInvestmentSliceSummary(report)).toContain(
      "0 candidates, equipment assignments, optimizations, or builds",
    );
  });

  it("pins every selected literal, payload, source predicate, and numeric request binding", async () => {
    const report = buildNoelleSourceLocalLowerInvestmentSliceReport(await fixture());
    const slice = requiredSlice(report);

    expect(report.selectedOccurrences).toHaveLength(3);
    for (const [index, expected] of SELECTED.entries()) {
      const selected = report.selectedOccurrences[index]!;
      expect(selected).toMatchObject({
        occurrenceId: expected.occurrenceId,
        characterId: "noelle",
        mainStatSlot: expected.slot,
        conditions: [CONDITION],
        conditionsSha256: CONDITIONS_SHA256,
        payload: {
          type: "main-stat",
          slot: expected.slot,
          statIds: expected.statIds,
          priority: null,
          target: null,
        },
        payloadSha256: expected.payloadSha256,
        predicate: {
          type: "unresolved-context",
          category: "investment-threshold",
        },
        predicateSha256: SOURCE_PREDICATE_SHA256,
        sourcePredicateLeafSha256: SOURCE_PREDICATE_SHA256,
        requestPredicateSha256: REQUEST_PREDICATE_SHA256,
        repositoryParity: "exact",
        sliceDisposition: "selected",
      });
      expect(selected.requestPredicate).toEqual({
        type: "all",
        predicates: [
          {
            type: "constellation-at-most",
            characterId: "noelle",
            threshold: 5,
          },
          {
            type: "talent-level-is",
            characterId: "noelle",
            talent: "burst",
            threshold: 9,
          },
        ],
      });
      expect(slice.conditionControls[index]).toMatchObject({
        claimId: expected.occurrenceId,
        occurrenceControl: {
          claimAxis: "main-stat",
          mainStatSlot: expected.slot,
          sourceConditionsSha256: CONDITIONS_SHA256,
          sourcePredicateSha256: SOURCE_PREDICATE_SHA256,
          payloadSha256: expected.payloadSha256,
        },
        requestBindings: [
          {
            sourcePredicatePath: "predicate",
            sourcePredicateLeafSha256: SOURCE_PREDICATE_SHA256,
          },
        ],
      });
      expect(slice.sourceClaimCatalog[index]?.recommendation).toEqual({
        recommendationId: "c0-c5-talent-9-artifact-stats",
        label: "C0–C5 and Burst Talent Level 9 artifact stats",
        scope: "artifact-stats",
        roles: ["dps"],
        ordering: null,
        classification: null,
        grouping: null,
        sourceIndex: 0,
      });
    }
    expect(report.numericEvaluationBoundary).toEqual({
      sourcePredicateAstPreserved: true,
      sourceTalentLevelsEvaluated: false,
      requestOverlayOwnsNumericEvaluation: true,
      constellationDerivedTalentBehavior: false,
      requestPredicateSha256: REQUEST_PREDICATE_SHA256,
    });
  });

  it("keeps all twelve holdouts and the one empty array unconsumed", async () => {
    const report = buildNoelleSourceLocalLowerInvestmentSliceReport(await fixture());
    expect(
      report.holdoutOccurrences.map(({ occurrenceId, conditionsSha256 }) => [
        occurrenceId,
        conditionsSha256,
      ]),
    ).toEqual(HOLDOUTS);
    expect(
      report.holdoutOccurrences.every(
        ({ consumedBySlice, bindingAuthoredBySlice, energyClassificationAuthoredBySlice }) =>
          !consumedBySlice &&
          !bindingAuthoredBySlice &&
          !energyClassificationAuthoredBySlice,
      ),
    ).toBe(true);
    expect(report.emptyOccurrences).toEqual([
      expect.objectContaining({
        occurrenceId:
          "kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions",
        conditions: [],
        conditionsSha256:
          "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
        sliceDisposition: "empty-unconditional",
        consumedBySlice: false,
        bindingAuthoredBySlice: false,
        energyClassificationAuthoredBySlice: false,
      }),
    ]);
  });

  it("preserves three unresolved source cells and resolves only through scoped C5 and Burst 9 request facts", async () => {
    const report = buildNoelleSourceLocalLowerInvestmentSliceReport(await fixture());
    const slice = requiredSlice(report);
    expect(slice.sourceClaimCells[0]?.claimCells).toHaveLength(3);
    expect(
      slice.sourceClaimCells[0]?.claimCells.map(({ resolution }) => resolution),
    ).toEqual(["unresolved-context", "unresolved-context", "unresolved-context"]);
    const projections =
      slice.requestContextReport?.teamProjections[0]?.claimProjections ?? [];
    expect(projections).toHaveLength(3);
    for (const projection of projections) {
      expect(projection).toMatchObject({
        resolution: "matched",
        contextApplicability: "applicable-under-supplied-context",
        requestContextBindings: [{ result: "true" }],
      });
      expect(projection.requestContextBindings[0]?.predicateRows).toEqual([
        expect.objectContaining({
          predicateType: "constellation-at-most",
          result: "true",
          factProvenance: "request",
          factScope: {
            teamRecordId: TEAM_ID,
            characterId: "noelle",
            accountSnapshotId: null,
          },
        }),
        expect.objectContaining({
          predicateType: "talent-level-is",
          result: "true",
          factProvenance: "request",
          factScope: {
            teamRecordId: TEAM_ID,
            characterId: "noelle",
            accountSnapshotId: null,
          },
        }),
      ]);
    }
    expect(slice.requestContextReport?.context).toEqual({
      requestFactsByTeamRecordId: {
        [TEAM_ID]: {
          characterFactsById: {
            noelle: {
              constellation: 5,
              talentLevels: { burst: 9 },
            },
          },
        },
      },
    });
  });

  it("crosses no recommendation, candidate, equipment, build, optimization, damage, rotation, or ER boundary", async () => {
    const report = buildNoelleSourceLocalLowerInvestmentSliceReport(await fixture());
    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      artifactAssignmentExecuted: false,
      equipmentAssignmentExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(stableJson(report)).not.toContain("current-condition-binding-catalog");
  });

  it("fails closed on snapshot, payload, team, registry, and byte/object drift", async () => {
    const snapshotInput = await fixture();
    const snapshot = structuredClone(snapshotInput.manualSnapshotInput) as Record<
      string,
      unknown
    >;
    const manualGuide = requiredRecord(snapshot, SOURCE_GUIDE_ID);
    const recommendation = manualGuide.recommendation as Record<string, unknown>;
    const mainStats = recommendation.mainStats as Record<string, unknown>;
    const sands = mainStats.sands as Array<Record<string, unknown>>;
    sands[0]!.statIds = ["def%"];
    replaceJsonInput(
      snapshotInput,
      SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      snapshot,
    );
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(snapshotInput)
        .comparisonStatus,
    ).toBe("not-comparable");

    const payloadInput = await fixture();
    const repository = structuredClone(payloadInput.repositoryInput) as Record<
      string,
      unknown
    >;
    const repositoryGuide = requiredRecord(repository, GUIDE_ID);
    const recommendations = repositoryGuide.recommendations as Array<
      Record<string, unknown>
    >;
    const repositoryMainStats = recommendations[0]!.mainStats as Record<
      string,
      unknown
    >;
    const repositorySands = repositoryMainStats.sands as Array<
      Record<string, unknown>
    >;
    repositorySands[0]!.statIds = ["def%"];
    replaceJsonInput(
      payloadInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      repository,
    );
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(payloadInput)
        .comparisonStatus,
    ).toBe("not-comparable");

    const teamInput = await fixture();
    const teamRepository = structuredClone(teamInput.repositoryInput) as Record<
      string,
      unknown
    >;
    const members = requiredRecord(teamRepository, TEAM_ID).members as Array<
      Record<string, unknown>
    >;
    members[1]!.characterId = "itto";
    replaceJsonInput(
      teamInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      teamRepository,
    );
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(teamInput).comparisonStatus,
    ).toBe("not-comparable");

    const registryInput = await fixture();
    const registry = structuredClone(registryInput.sourceRegistryInput) as Record<
      string,
      unknown
    >;
    const sources = registry.sources as Array<Record<string, unknown>>;
    sources.find(({ id }) => id === "kqm")!.permission = "allowed";
    replaceJsonInput(
      registryInput,
      SOURCE_REGISTRY_RELATIVE_PATH,
      "sourceRegistryInput",
      registry,
    );
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(registryInput)
        .comparisonStatus,
    ).toBe("not-comparable");

    const objectInput = await fixture();
    (objectInput.manualSnapshotInput as Record<string, unknown>).capturedAt =
      "2099-01-01";
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(objectInput).issues[0]
        ?.message,
    ).toContain("Parsed input does not match raw bytes");
  });

  it("authenticates the durable report and rejects report or path tampering", async () => {
    const input = await fixture();
    const canonical = buildNoelleSourceLocalLowerInvestmentSliceReport(input);
    const durable = (await readJson(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH,
    )) as NoelleSourceLocalLowerInvestmentSliceReport;
    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      authenticateNoelleSourceLocalLowerInvestmentSliceReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.effectiveMatchedCount += 1;
    expect(
      authenticateNoelleSourceLocalLowerInvestmentSliceReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableNoelleSourceLocalLowerInvestmentSliceReport(changed, input),
    ).toThrow("serialized-report-mismatch");

    const missingPathInput = structuredClone(input);
    missingPathInput.generatedFrom = missingPathInput.generatedFrom.slice(1);
    expect(
      buildNoelleSourceLocalLowerInvestmentSliceReport(missingPathInput).issues[0]
        ?.message,
    ).toContain("generatedFrom path closure drifted");
  });
});

async function fixture(): Promise<BuildNoelleSourceLocalLowerInvestmentSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  };
}

function replaceJsonInput(
  input: BuildNoelleSourceLocalLowerInvestmentSliceInput,
  relativePath: string,
  field:
    | "repositoryInput"
    | "manualSnapshotInput"
    | "sourceRegistryInput",
  value: unknown,
): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  input[field] = value;
  input.sourceFiles = input.sourceFiles.map((sourceFile) =>
    sourceFile.path === relativePath
      ? { path: sourceFile.path, text }
      : sourceFile,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}

function requiredRecord(
  root: Record<string, unknown>,
  id: string,
): Record<string, unknown> {
  const records = root.records as Array<Record<string, unknown>>;
  const record = records.find(
    (candidate) => candidate.id === id || candidate.sourceRecordId === id,
  );
  if (!record) throw new Error(`Missing record ${id}.`);
  return record;
}

function requiredSlice(
  report: NoelleSourceLocalLowerInvestmentSliceReport,
): NonNullable<NoelleSourceLocalLowerInvestmentSliceReport["sourceLocalSlice"]> {
  if (!report.sourceLocalSlice) throw new Error("Expected source-local slice.");
  return report.sourceLocalSlice;
}
