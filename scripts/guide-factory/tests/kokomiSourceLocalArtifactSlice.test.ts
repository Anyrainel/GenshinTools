import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatKokomiSourceLocalArtifactSliceSummary } from "../src/assemble-kokomi-source-local-artifact-slice";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  authenticateKokomiSourceLocalArtifactSliceReport,
  buildKokomiSourceLocalArtifactSliceReport,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  requireComparableKokomiSourceLocalArtifactSliceReport,
  type BuildKokomiSourceLocalArtifactSliceInput,
  type KokomiSourceLocalArtifactSliceReport,
} from "../src/kokomiSourceLocalArtifactSlice";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const KOKOMI_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-kokomi-manual.json",
);
const KOKOMI_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const TEAM_ID =
  "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example";
const SOURCE_TEAM_ID =
  "kokomi-ineffa-columbina-sucrose-lunar-charged-example";
const SELECTED_OCCURRENCE_ID =
  `${TEAM_ID}:members[0].artifactRecommendations[0].conditions`;
const SELECTED_CONDITIONS_SHA256 =
  "a9c6d3b2681ecb2119368d210164542577464049656217eb1fcc296ff4fd2295";
const SELECTED_PAYLOAD_SHA256 =
  "bfd412bb94e8e50e9deec6813ef5329eb71c656fdd1af64fc8b5a2243543e1a0";
const SELECTED_PREDICATE_SHA256 =
  "2c60322cf3d1b6691dbde84bd5484364752c87bb18634bd9303fd6ec2e03dcda";
const TEAM_ROSTER = [
  "sangonomiya_kokomi",
  "ineffa",
  "columbina",
  "sucrose",
] as const;
const HOLDOUTS = [
  {
    occurrenceId:
      "kqm:character_guide:kokomi-on-field-nod-krai-artifact-delegation-luna-v:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "a2933a2e2f7adf74da82241024b08ef3cc933e97875a60ed24a995e23dff7300",
  },
  {
    occurrenceId: `${TEAM_ID}:artifactPlans[0].conditions`,
    conditionsSha256:
      "2e7b7109ed56cdbdbe8106429ff4a37bf8a76c4af7a6a96c1f71f123fbc19320",
  },
  {
    occurrenceId: `${TEAM_ID}:members[0].artifactRecommendations[1].conditions`,
    conditionsSha256:
      "345334cc6648346f0746fcee75a300703ef38cbbf2c290e80d9e0bb3ddbf12e9",
  },
  {
    occurrenceId: `${TEAM_ID}:members[2].artifactRecommendations[0].conditions`,
    conditionsSha256:
      "2b615a74c769bcf02abb64b35d64bf8baf94eefb23f5f9a6e3044b540184d50f",
  },
] as const;

describe("Kokomi source-local artifact slice", () => {
  it("authenticates the exact one-claim same-record artifact slice", async () => {
    const input = await fixture();
    const report = buildKokomiSourceLocalArtifactSliceReport(input);

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
      rawRecordCount: 2,
      totalConditionArrayCount: 5,
      nonemptyConditionArrayCount: 5,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 1,
      holdoutOccurrenceCount: 4,
      selectedAndHoldoutsCloseAllNonemptyKokomiConditions: true,
      repositoryParity: "exact",
      samePageLineage: true,
      selectedClaimsAndTeamShareExactSourceRecord: true,
      promotionEligible: false,
    });
    expect(report.summary).toEqual({
      totalConditionArrayCount: 5,
      nonemptyConditionArrayCount: 5,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 1,
      selectedUniqueConditionArrayCount: 1,
      holdoutOccurrenceCount: 4,
      sourceTeamCount: 1,
      sourceCellCount: 1,
      sourceMatchedCount: 1,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 0,
      contextApplicableCount: 0,
      sourceAlreadyMatchedCount: 1,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 1,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 1,
      holdoutConsumedCount: 0,
      holdoutBindingAuthoredCount: 0,
      holdoutEnergyClassificationAuthoredCount: 0,
      assembledBuildCount: 0,
    });
    expect(() =>
      requireComparableKokomiSourceLocalArtifactSliceReport(report, input),
    ).not.toThrow();
    expect(formatKokomiSourceLocalArtifactSliceSummary(report)).toContain(
      "4 nonempty occurrences were held out without new bindings or classifications",
    );
  });

  it("closes exactly five nonempty arrays and leaves all four holdouts unconsumed", async () => {
    const report = buildKokomiSourceLocalArtifactSliceReport(await fixture());
    expect(report.selectedOccurrences).toHaveLength(1);
    expect(report.selectedOccurrences[0]).toMatchObject({
      occurrenceId: SELECTED_OCCURRENCE_ID,
      conditionsSha256: SELECTED_CONDITIONS_SHA256,
      sliceDisposition: "selected",
    });
    expect(
      report.holdoutOccurrences.map(({ occurrenceId, conditionsSha256 }) => ({
        occurrenceId,
        conditionsSha256,
      })),
    ).toEqual(HOLDOUTS);
    expect(
      report.holdoutOccurrences.every(
        ({
          sliceDisposition,
          consumedBySlice,
          bindingAuthoredBySlice,
          energyClassificationAuthoredBySlice,
        }) =>
          sliceDisposition === "holdout" &&
          !consumedBySlice &&
          !bindingAuthoredBySlice &&
          !energyClassificationAuthoredBySlice,
      ),
    ).toBe(true);
    expect(
      new Set([
        report.selectedOccurrences[0]!.occurrenceId,
        ...report.holdoutOccurrences.map(({ occurrenceId }) => occurrenceId),
      ]).size,
    ).toBe(5);
  });

  it("preserves Ocean-Hued Clam and the ordered exact-roster conjunction without a request binding", async () => {
    const report = buildKokomiSourceLocalArtifactSliceReport(await fixture());
    const selected = report.selectedOccurrences[0]!;
    const slice = requiredSlice(report);
    const claim = slice.sourceClaimCatalog[0]!;

    expect(selected).toMatchObject({
      characterId: "sangonomiya_kokomi",
      memberIndex: 0,
      payload: {
        type: "artifact-group",
        artifacts: [{ type: "4pc", setId: "oceanhued_clam" }],
      },
      payloadSha256: SELECTED_PAYLOAD_SHA256,
      predicateSha256: SELECTED_PREDICATE_SHA256,
    });
    expect(selected.predicate).toEqual({
      type: "all",
      predicates: TEAM_ROSTER.map((characterId) => ({
        type: "exact-team-roster-includes",
        characterId,
      })),
    });
    expect(claim.recommendation).toMatchObject({
      scope: "team-member-artifact-sets",
      ordering: "unranked",
      classification: "recommended",
      grouping: "single",
      sourceIndex: 0,
    });
    expect(slice.conditionControls[0]?.requestBindings).toEqual([]);
    expect(slice.requestContextReport).toMatchObject({
      context: {},
      claimRules: [],
      sourceCellsMutated: false,
    });
  });

  it("matches only from the exact source roster and executes no composition", async () => {
    const report = buildKokomiSourceLocalArtifactSliceReport(await fixture());
    const slice = requiredSlice(report);
    const cell = slice.sourceClaimCells[0]?.claimCells[0];
    expect(slice.sourceClaimCells).toHaveLength(1);
    expect(cell).toMatchObject({
      claimId: SELECTED_OCCURRENCE_ID,
      resolution: "matched",
    });
    expect(cell?.predicateRows.map(({ result }) => result)).toEqual([
      "true",
      "true",
      "true",
      "true",
    ]);
    expect(report).toMatchObject({
      recommendationCompositionExecuted: false,
      artifactAssignmentExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
    });
  });

  it("exposes no guide, rank, damage, rotation, or ER capability", async () => {
    const report = buildKokomiSourceLocalArtifactSliceReport(await fixture());
    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
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
      conditionTruthEstablishedFromRecommendationMetadata: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.sourceLocalSlice).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      buildComposition: false,
      formulas: false,
      rotations: false,
      ER: false,
      assembledBuildCount: 0,
    });
  });

  it("fails closed on selected condition or payload drift", async () => {
    const conditionInput = await fixture();
    const conditionRepository = structuredClone(
      conditionInput.repositoryInput as Record<string, unknown>,
    );
    const conditionSnapshot = structuredClone(
      conditionInput.manualSnapshotInput as Record<string, unknown>,
    );
    selectedArtifactRecommendation(conditionRepository, TEAM_ID).conditions = [
      "Forged exact-team condition.",
    ];
    selectedArtifactRecommendation(conditionSnapshot, SOURCE_TEAM_ID).conditions = [
      "Forged exact-team condition.",
    ];
    replaceJsonInput(
      conditionInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      conditionRepository,
    );
    replaceJsonInput(
      conditionInput,
      KOKOMI_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      conditionSnapshot,
    );
    expect(
      buildKokomiSourceLocalArtifactSliceReport(conditionInput)
        .comparisonStatus,
    ).toBe("not-comparable");

    const payloadInput = await fixture();
    const payloadRepository = structuredClone(
      payloadInput.repositoryInput as Record<string, unknown>,
    );
    selectedArtifactRecommendation(payloadRepository, TEAM_ID).grouping =
      "alternatives";
    replaceJsonInput(
      payloadInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      payloadRepository,
    );
    const payloadReport = buildKokomiSourceLocalArtifactSliceReport(payloadInput);
    expect(payloadReport.comparisonStatus).toBe("not-comparable");
    expect(payloadReport.issues[0]?.message).toContain(
      "Exact source payload drifted",
    );
  });

  it("fails closed on exact roster or team-semantic drift", async () => {
    const rosterInput = await fixture();
    const rosterRepository = structuredClone(
      rosterInput.repositoryInput as Record<string, unknown>,
    );
    const rosterSnapshot = structuredClone(
      rosterInput.manualSnapshotInput as Record<string, unknown>,
    );
    teamMember(rosterRepository, TEAM_ID, 1).characterId = "fischl";
    teamMember(rosterSnapshot, SOURCE_TEAM_ID, 1).characterId = "fischl";
    replaceJsonInput(
      rosterInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      rosterRepository,
    );
    replaceJsonInput(
      rosterInput,
      KOKOMI_SNAPSHOT_RELATIVE_PATH,
      "manualSnapshotInput",
      rosterSnapshot,
    );
    expect(
      buildKokomiSourceLocalArtifactSliceReport(rosterInput).comparisonStatus,
    ).toBe("not-comparable");

    const semanticInput = await fixture();
    const semanticRepository = structuredClone(
      semanticInput.repositoryInput as Record<string, unknown>,
    );
    requiredRecord(semanticRepository, TEAM_ID).rankingClaim = "ordered";
    replaceJsonInput(
      semanticInput,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      semanticRepository,
    );
    const semanticReport = buildKokomiSourceLocalArtifactSliceReport(
      semanticInput,
    );
    expect(semanticReport.comparisonStatus).toBe("not-comparable");
    expect(semanticReport.issues[0]?.message).toContain(
      "Exact team lineage drifted",
    );
  });

  it("fails closed when the source registry no longer authenticates", async () => {
    const input = await fixture();
    const registry = structuredClone(
      input.sourceRegistryInput as Record<string, unknown>,
    );
    const sources = registry.sources as Array<Record<string, unknown>>;
    const kqm = sources.find(({ id }) => id === "kqm");
    if (!kqm) throw new Error("Missing KQM source.");
    (kqm.notes as string[]).push("Unauthenticated registry mutation.");
    replaceJsonInput(
      input,
      SOURCE_REGISTRY_RELATIVE_PATH,
      "sourceRegistryInput",
      registry,
    );

    const report = buildKokomiSourceLocalArtifactSliceReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "source-document, index, or registry boundary drifted",
    );
  });

  it("fails closed when raw bytes and parsed inputs do not authenticate each other", async () => {
    const byteInput = await fixture();
    byteInput.sourceFiles = byteInput.sourceFiles.map((sourceFile) =>
      sourceFile.path === KOKOMI_SNAPSHOT_RELATIVE_PATH
        ? { ...sourceFile, text: `${sourceFile.text}\n` }
        : sourceFile,
    );
    const byteReport = buildKokomiSourceLocalArtifactSliceReport(byteInput);
    expect(byteReport.comparisonStatus).toBe("not-comparable");
    expect(byteReport.issues[0]?.message).toContain("Raw byte hash mismatch");

    const objectInput = await fixture();
    const repository = structuredClone(
      objectInput.repositoryInput as Record<string, unknown>,
    );
    repository.schemaVersion = 999;
    objectInput.repositoryInput = repository;
    const objectReport = buildKokomiSourceLocalArtifactSliceReport(objectInput);
    expect(objectReport.comparisonStatus).toBe("not-comparable");
    expect(objectReport.issues[0]?.message).toContain(
      "Parsed input does not match raw bytes",
    );
  });

  it("authenticates the durable report and rejects report or path tampering", async () => {
    const input = await fixture();
    const canonical = buildKokomiSourceLocalArtifactSliceReport(input);
    const durable = (await readJson(
      KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
    )) as KokomiSourceLocalArtifactSliceReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      authenticateKokomiSourceLocalArtifactSliceReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.sourceMatchedCount += 1;
    expect(
      authenticateKokomiSourceLocalArtifactSliceReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableKokomiSourceLocalArtifactSliceReport(changed, input),
    ).toThrow("serialized-report-mismatch");

    const missingPathInput = structuredClone(input);
    missingPathInput.generatedFrom = missingPathInput.generatedFrom.slice(1);
    const nonComparable =
      buildKokomiSourceLocalArtifactSliceReport(missingPathInput);
    expect(nonComparable.comparisonStatus).toBe("not-comparable");
    expect(nonComparable.issues[0]?.message).toContain(
      "generatedFrom path closure drifted",
    );
  });
});

async function fixture(): Promise<BuildKokomiSourceLocalArtifactSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KOKOMI_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(
            path.join(REPOSITORY_ROOT, relativePath),
            "utf8",
          ),
        }),
      ),
    ),
    Promise.all(
      KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS.map(
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
  input: BuildKokomiSourceLocalArtifactSliceInput,
  relativePath: string,
  field: "repositoryInput" | "manualSnapshotInput" | "sourceRegistryInput",
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

function teamMember(
  root: Record<string, unknown>,
  id: string,
  memberIndex: number,
): Record<string, unknown> {
  const members = requiredRecord(root, id).members as Array<
    Record<string, unknown>
  >;
  const member = members[memberIndex];
  if (!member) throw new Error(`Missing member ${memberIndex}.`);
  return member;
}

function selectedArtifactRecommendation(
  root: Record<string, unknown>,
  id: string,
): Record<string, unknown> {
  const recommendations = teamMember(root, id, 0)
    .artifactRecommendations as Array<Record<string, unknown>>;
  const recommendation = recommendations[0];
  if (!recommendation) throw new Error("Missing artifact recommendation.");
  return recommendation;
}

function requiredSlice(
  report: KokomiSourceLocalArtifactSliceReport,
): NonNullable<KokomiSourceLocalArtifactSliceReport["sourceLocalSlice"]> {
  if (!report.sourceLocalSlice) throw new Error("Expected source-local slice.");
  return report.sourceLocalSlice;
}
