import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { formatKleeTeamScopedClaimJoinWitnessSummary } from "../src/assemble-klee-team-scoped-claim-join-witness";
import { sha256File, sha256Text, stableJson, readJson } from "../src/io";
import {
  authenticateKleeTeamScopedClaimJoinWitnessReport,
  buildKleeTeamScopedClaimJoinWitnessReport,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS,
  requireComparableKleeTeamScopedClaimJoinWitnessReport,
  type BuildKleeTeamScopedClaimJoinWitnessInput,
  type KleeTeamScopedClaimJoinWitnessReport,
} from "../src/kleeTeamScopedClaimJoinWitness";
import { KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "../src/kleeSourceLocalConditionSlice";
import { MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH } from "../src/manualConditionArrayCoverageReport";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const KLEE_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-klee-manual.json",
);
const KLEE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/klee-source-local-condition-slice.json";
const MANUAL_COVERAGE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/manual-condition-array-coverage.json";
const FURINA_TEAM_ID =
  "kqm:team:klee-furina-albedo-xilonen-example-luna-iv";
const OVERLOAD_TEAM_ID =
  "kqm:team:klee-chevreuse-durin-fischl-overload-example-luna-iv";
const MARECHAUSSEE_CLAIM_ID =
  "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions";

let baseInput: BuildKleeTeamScopedClaimJoinWitnessInput;

beforeAll(async () => {
  baseInput = await loadFixture();
});

describe("Klee team-scoped claim-join witness", () => {
  it("emits one flat four-claim witness and one exact Overload control", () => {
    const report = buildKleeTeamScopedClaimJoinWitnessReport(fixture());

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.summary).toEqual({
      positiveWitnessCount: 1,
      positiveClaimCount: 4,
      positiveSourceRecordCount: 2,
      negativeControlTeamCount: 1,
      negativeControlApplicableClaimCount: 3,
      negativeControlInapplicableClaimCount: 1,
      crossLinkedCoverageOccurrenceCount: 4,
      assembledBuildCount: 0,
      candidateCount: 0,
    });
    expect(report.positiveWitness).toMatchObject({
      witnessKind: "flat-same-team-independent-applicability-evidence-set",
      team: { teamRecordId: FURINA_TEAM_ID },
      independentlyApplicableClaimCount: 4,
      sourceAlreadyMatchedClaimCount: 1,
      requestContextResolvedClaimCount: 3,
      crCdPreservedAsOneUnchosenPayloadGroup: true,
      jointPayloadCompatibilityEstablished: false,
      completenessEstablished: false,
      optimalityEstablished: false,
    });
    expect(report.positiveWitness?.claims).toHaveLength(4);
    expect(report.positiveWitness?.claims[0]?.sourceClaim.payload).toEqual({
      type: "main-stat",
      slot: "circlet",
      statIds: ["cr", "cd"],
      priority: null,
      target: null,
    });
    expect(report.negativeControl).toMatchObject({
      team: { teamRecordId: OVERLOAD_TEAM_ID },
      sourceDefinitelyInapplicableClaimIds: [MARECHAUSSEE_CLAIM_ID],
      positiveWitnessConstructed: false,
      rosterConditionedClaimExcludedFromWitness: true,
    });
    expect(formatKleeTeamScopedClaimJoinWitnessSummary(report)).toContain(
      "0 builds and 0 candidates assembled",
    );
  });

  it("cross-links every flat row to exact selected, coverage, claim, and control evidence", () => {
    const report = buildKleeTeamScopedClaimJoinWitnessReport(fixture());
    const positive = report.positiveWitness;
    if (!positive) throw new Error("Expected positive witness.");

    expect(report.upstreamBoundary).toMatchObject({
      status: "accepted",
      klee: {
        freshlyAuthenticated: true,
        selectedOccurrenceCount: 4,
        holdoutOccurrenceCount: 11,
        sourceTeamCount: 2,
      },
      manualCoverage: {
        currentBoundaryAuthenticated: true,
        corpusOccurrenceCount: 142,
        bindingOccurrenceCount: 53,
        kleeSourceLocalOccurrenceCount: 4,
        typedBindingMeansConditionTruth: false,
      },
      exactCrossLinkedOccurrenceCount: 4,
    });
    expect(new Set(report.upstreamBoundary.exactCrossLinkedOccurrenceIds)).toHaveLength(
      4,
    );
    for (const row of positive.claims) {
      expect(row.claimId).toBe(row.selectedOccurrence.occurrenceId);
      expect(row.claimId).toBe(row.coverageOccurrence.occurrenceId);
      expect(row.claimId).toBe(row.sourceClaim.claimId);
      expect(row.claimId).toBe(row.conditionControl.claimId);
      expect(row.selectedOccurrenceSha256).toBe(hashValue(row.selectedOccurrence));
      expect(row.coverageOccurrenceSha256).toBe(hashValue(row.coverageOccurrence));
      expect(row.sourceClaimSha256).toBe(hashValue(row.sourceClaim));
      expect(row.conditionControlSha256).toBe(hashValue(row.conditionControl));
      expect(row.sourceCellSha256).toBe(hashValue(row.sourceCell));
      expect(row.requestProjectionSha256).toBe(
        hashValue(row.requestProjection),
      );
      expect(row.coverageOccurrence).toMatchObject({
        subject: "klee",
        bindingClassification: "typed-bound",
        displayStatus: "typed-bound",
        nonStructuralBindingCoverageEligible: true,
        energyClassification: "not-energy-deferred",
        bindingEvidence: {
          kind: "klee-source-local-typed-predicate-ast",
          selectedOccurrenceId: row.claimId,
        },
      });
      expect(row.coverageOccurrence.bindingEvidence).toMatchObject({
        selectedOccurrenceSha256: row.selectedOccurrenceSha256,
        payloadSha256: row.selectedOccurrence.payloadSha256,
        occurrenceControlSha256: row.conditionControlSha256,
      });
    }
  });

  it("preserves source truth separately from exact request-scoped role resolution", () => {
    const report = buildKleeTeamScopedClaimJoinWitnessReport(fixture());
    const positive = report.positiveWitness;
    const negative = report.negativeControl;
    if (!positive || !negative) throw new Error("Expected witness and control.");

    expect(
      positive.claims.map(
        ({ applicabilityProvenance }) => applicabilityProvenance,
      ),
    ).toEqual([
      {
        sourceResolution: "unresolved-context",
        contextApplicability: "applicable-under-supplied-context",
        effectiveResolution: "matched",
        requestContextBindingCount: 1,
        sourceControlPreserved: true,
      },
      {
        sourceResolution: "unresolved-context",
        contextApplicability: "applicable-under-supplied-context",
        effectiveResolution: "matched",
        requestContextBindingCount: 1,
        sourceControlPreserved: true,
      },
      {
        sourceResolution: "unresolved-context",
        contextApplicability: "applicable-under-supplied-context",
        effectiveResolution: "matched",
        requestContextBindingCount: 1,
        sourceControlPreserved: true,
      },
      {
        sourceResolution: "matched",
        contextApplicability: "source-already-matched",
        effectiveResolution: "matched",
        requestContextBindingCount: 0,
        sourceControlPreserved: true,
      },
    ]);
    for (const row of positive.claims.slice(0, 3)) {
      expect(
        row.requestProjection.requestContextBindings[0]?.predicateRows[0]
          ?.factScope,
      ).toEqual({
        accountSnapshotId: null,
        characterId: "klee",
        teamRecordId: FURINA_TEAM_ID,
      });
    }
    const negativeMarechaussee = negative.claimControls.find(
      ({ claimId }) => claimId === MARECHAUSSEE_CLAIM_ID,
    );
    expect(negativeMarechaussee?.applicabilityProvenance).toEqual({
      sourceResolution: "inapplicable",
      contextApplicability: "source-definitely-inapplicable",
      effectiveResolution: "inapplicable",
      requestContextBindingCount: 0,
      sourceControlPreserved: true,
    });
    expect(negativeMarechaussee?.requestProjection.requestContextBindings).toEqual(
      [],
    );
  });

  it("exposes only the evidence-join operation and no guide or computation capability", () => {
    const report = buildKleeTeamScopedClaimJoinWitnessReport(fixture());
    expect(report).toMatchObject({
      sameTeamIndependentApplicabilityJoinExecuted: true,
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsCompatibilityClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      playerFacingRecommendations: false,
      conditionTruthEstablishedFromRecommendationMetadata: false,
      typedBindingTreatedAsApplicabilityTruth: false,
      payloadCompatibilityEvaluated: false,
      jointOptimalityEvaluated: false,
      recommendationCompositionExecuted: false,
      crossProductExecuted: false,
      payloadAxisExpansionExecuted: false,
      choiceSelectionExecuted: false,
      rankingExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      assembledBuildCount: 0,
      candidateCount: 0,
      authorshipBoundary: {
        crossRecordJoinAuthoredBy: "guide-factory",
        sourceAuthoredCrossRecordJoin: false,
        sourceAuthoredBuild: false,
        sourceAuthoredCrossRecordOrdering: false,
        requestRoleFactsAuthoredBy: "guide-factory-explicit-fixture",
        recommendationMetadataUsedAsConditionTruth: false,
      },
    });
  });

  it("authenticates the durable report against a fresh current rebuild", async () => {
    const input = fixture();
    const canonical = buildKleeTeamScopedClaimJoinWitnessReport(input);
    const durable = (await readJson(
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH,
    )) as KleeTeamScopedClaimJoinWitnessReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      authenticateKleeTeamScopedClaimJoinWitnessReport(durable, input),
    ).toMatchObject({ authenticated: true });
    expect(() =>
      requireComparableKleeTeamScopedClaimJoinWitnessReport(durable, input),
    ).not.toThrow();
  });

  it("rejects capability, alternative-collapse, and provenance forgeries in the durable witness", async () => {
    const input = fixture();
    const durable = (await readJson(
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH,
    )) as KleeTeamScopedClaimJoinWitnessReport;

    const capabilityForgery = structuredClone(durable) as any;
    capabilityForgery.supportsBuildRecommendations = true;
    capabilityForgery.assembledBuildCount = 1;
    expect(
      authenticateKleeTeamScopedClaimJoinWitnessReport(capabilityForgery, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });

    const collapsedAlternative = structuredClone(durable) as any;
    collapsedAlternative.positiveWitness.claims[0].sourceClaim.payload.statIds = [
      "cr",
    ];
    collapsedAlternative.positiveWitness.claims[0].sourceClaimSha256 = hashValue(
      collapsedAlternative.positiveWitness.claims[0].sourceClaim,
    );
    expect(() =>
      requireComparableKleeTeamScopedClaimJoinWitnessReport(
        collapsedAlternative,
        input,
      ),
    ).toThrow("serialized-report-mismatch");

    const provenanceForgery = structuredClone(durable) as any;
    const excluded = provenanceForgery.negativeControl.claimControls[3];
    excluded.requestProjection.contextApplicability = "source-already-matched";
    excluded.requestProjection.resolution = "matched";
    excluded.applicabilityProvenance.sourceResolution = "matched";
    excluded.applicabilityProvenance.contextApplicability =
      "source-already-matched";
    excluded.applicabilityProvenance.effectiveResolution = "matched";
    excluded.requestProjectionSha256 = hashValue(excluded.requestProjection);
    expect(() =>
      requireComparableKleeTeamScopedClaimJoinWitnessReport(
        provenanceForgery,
        input,
      ),
    ).toThrow("serialized-report-mismatch");
  });

  it("fails closed on a locally rehashed stale Klee durable report", () => {
    const input = fixture();
    const klee = structuredClone(
      input.kleeDurableReportInput as Record<string, any>,
    );
    klee.summary.contextApplicableCount += 1;
    replaceSourceObject(
      input,
      KLEE_REPORT_RELATIVE_PATH,
      "kleeDurableReportInput",
      klee,
    );

    const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.positiveWitness).toBeNull();
    expect(report.issues[0]?.message).toContain(
      "Fresh Klee source-local authentication failed",
    );
  });

  it("fails closed on a locally rehashed stale coverage occurrence", () => {
    const input = fixture();
    const coverage = structuredClone(
      input.manualCoverageDurableReportInput as Record<string, any>,
    );
    const row = coverage.occurrences.find(
      ({ bindingEvidence }: any) =>
        bindingEvidence?.kind === "klee-source-local-typed-predicate-ast",
    );
    if (!row) throw new Error("Expected Klee coverage row.");
    row.bindingEvidence.payloadSha256 = "0".repeat(64);
    replaceSourceObject(
      input,
      MANUAL_COVERAGE_REPORT_RELATIVE_PATH,
      "manualCoverageDurableReportInput",
      coverage,
    );

    const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.upstreamBoundary.status).toBe("rejected");
    expect(report.issues[0]?.message).toContain(
      "Pinned current condition occurrence rows drifted",
    );
  });

  it("fails closed when parsed report input does not match the authenticated file bytes", () => {
    const input = fixture();
    const klee = structuredClone(
      input.kleeDurableReportInput as Record<string, any>,
    );
    klee.summary.contextApplicableCount += 1;
    input.kleeDurableReportInput = klee;

    const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.issues[0]?.message).toContain(
      "source-file bytes and parsed input disagree",
    );
  });

  it("fails closed on generatedFrom or source-file path/hash boundary drift", () => {
    const missingGeneratedPath = fixture();
    missingGeneratedPath.generatedFrom =
      missingGeneratedPath.generatedFrom.slice(1);
    expect(
      buildKleeTeamScopedClaimJoinWitnessReport(missingGeneratedPath).issues[0]
        ?.message,
    ).toContain("generatedFrom path/hash closure drifted");

    const reorderedSourcePaths = fixture();
    reorderedSourcePaths.sourceFiles = [
      reorderedSourcePaths.sourceFiles[1]!,
      reorderedSourcePaths.sourceFiles[0]!,
      ...reorderedSourcePaths.sourceFiles.slice(2),
    ];
    expect(
      buildKleeTeamScopedClaimJoinWitnessReport(reorderedSourcePaths).issues[0]
        ?.message,
    ).toContain("source-file exact path closure drifted");

    const forgedSourceHash = fixture();
    const targetPath = forgedSourceHash.sourceFiles[0]!.path;
    forgedSourceHash.generatedFrom = forgedSourceHash.generatedFrom.map(
      (entry) =>
        entry.path === targetPath
          ? { ...entry, sha256: "0".repeat(64) }
          : entry,
    );
    expect(
      buildKleeTeamScopedClaimJoinWitnessReport(forgedSourceHash).issues[0]
        ?.message,
    ).toContain("source-file byte hash drifted");
  });

  it("does not promote a same-text holdout into the selected witness", () => {
    const input = fixture();
    const klee = structuredClone(
      input.kleeDurableReportInput as Record<string, any>,
    );
    const sameTextHoldout = klee.holdoutOccurrences.find(
      ({ conditions }: any) => conditions[0]?.includes("on-field DPS"),
    );
    if (!sameTextHoldout) throw new Error("Expected same-text Klee holdout.");
    klee.selectedOccurrences[0] = {
      ...sameTextHoldout,
      sliceDisposition: "selected",
      bindingAuthoredBySlice: true,
      sliceBindingClassification: "typed-bound",
      energyClassificationAuthoredBySlice: true,
      sliceEnergyClassification: "not-energy-deferred",
    };
    replaceSourceObject(
      input,
      KLEE_REPORT_RELATIVE_PATH,
      "kleeDurableReportInput",
      klee,
    );

    const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.summary.positiveClaimCount).toBe(0);
    expect(report.issues[0]?.message).toContain(
      "Fresh Klee source-local authentication failed",
    );
  });

  it("does not treat typed bindings as truth when source/request projections are missing", () => {
    const input = fixture();
    const klee = structuredClone(
      input.kleeDurableReportInput as Record<string, any>,
    );
    klee.sourceLocalSlice.sourceClaimCells = [];
    klee.sourceLocalSlice.requestContextReport.teamProjections = [];
    replaceSourceObject(
      input,
      KLEE_REPORT_RELATIVE_PATH,
      "kleeDurableReportInput",
      klee,
    );

    const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.positiveWitness).toBeNull();
    expect(report.upstreamBoundary.exactCrossLinkedOccurrenceCount).toBe(0);
  });
});

async function loadFixture(): Promise<BuildKleeTeamScopedClaimJoinWitnessInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    kleeDurableReportInput,
    manualCoverageDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KLEE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
    readJson(MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH),
    Promise.all(
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS.map(
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
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS.map(
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
    kleeDurableReportInput,
    manualCoverageDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildKleeTeamScopedClaimJoinWitnessInput {
  return structuredClone(baseInput);
}

function replaceSourceObject(
  input: BuildKleeTeamScopedClaimJoinWitnessInput,
  relativePath: string,
  field: "kleeDurableReportInput" | "manualCoverageDurableReportInput",
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

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
