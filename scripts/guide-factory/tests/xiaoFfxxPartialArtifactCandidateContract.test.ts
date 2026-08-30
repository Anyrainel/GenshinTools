import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import type { XiaoFfxxApplicableClaimProjectionContractReport } from "../src/xiaoFfxxApplicableClaimProjectionContract";
import {
  authenticateXiaoFfxxPartialArtifactCandidateContract,
  buildXiaoFfxxPartialArtifactCandidateContractReport,
  requireComparableXiaoFfxxPartialArtifactCandidateContract,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxPartialArtifactCandidateContractInput,
  type XiaoFfxxPartialArtifactCandidateContractReport,
} from "../src/xiaoFfxxPartialArtifactCandidateContract";

const XIAO_MANUAL_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);
const XIAO_MANUAL_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const APPLICABLE_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";
const CORE_PATH =
  "scripts/guide-factory/src/xiaoFfxxPartialArtifactCandidateContract.ts";
const CLI_PATH =
  "scripts/guide-factory/src/assemble-xiao-ffxx-partial-artifact-candidate-contract.ts";
const MARECHAUSSEE_OCCURRENCE_ID =
  "kqm:character_guide:xiao-mh-artifact-branch-version-5-5:recommendation.artifactRecommendations[0].conditions";
const XIANYUN_GOBLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[3].conditions";
const C6_GOBLET_OCCURRENCE_ID =
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[4].conditions";
const SELECTED_OCCURRENCE_IDS = [
  MARECHAUSSEE_OCCURRENCE_ID,
  XIANYUN_GOBLET_OCCURRENCE_ID,
  C6_GOBLET_OCCURRENCE_ID,
] as const;
const AXIS_VOCABULARY = [
  "weapon",
  "artifact-set",
  "main-stat:sands",
  "main-stat:goblet",
  "main-stat:circlet",
  "substats",
] as const;
const TECHNICAL_COMBINATION_SHA256 =
  "ea44ea430cd50fae70491188c520d25c00eb611ff7076bcd424182e5e1631d5e";
const CANDIDATE_IDENTITY_SHA256 =
  "74775416f9e1fd158f850821c710e41a8c48375566ece39e48ae20d410d10790";
const UPSTREAM_SEMANTIC_SCOPE_SHA256 =
  "cff2a04818cf432c3ad31c71e04d9d9df2c79f11cc5f24875a65e2f0156d8461";
const SOURCE_VIEW_SHA256 =
  "0f9fa406a277932c08a33de50b4c24e7c2648bea34abb20ea1bd0cc3c485096c";
const SOURCE_BINDING_SHA256 =
  "92421f3a81e24c93d922f20bfccbf4223cf1a1c9a7d7094a345973cab4cbc05d";
const REQUEST_VIEW_SHA256 =
  "3e8bf1c525946179752b3f858061a428155d124c5502b0850205c5118d85c6d7";
const REQUEST_BINDING_SHA256 =
  "0a1b7881f168b5108a60d7bd04593415aa8a0517538667428a6dddaad78d8e2e";

let baseInput: BuildXiaoFfxxPartialArtifactCandidateContractInput;
let durableReport: XiaoFfxxPartialArtifactCandidateContractReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH,
    ) as Promise<XiaoFfxxPartialArtifactCandidateContractReport>,
  ]);
});

describe("Xiao FFXX partial artifact candidate contract", () => {
  it("rebuilds deterministically and authenticates the durable 20/20 closure", () => {
    const first = canonicalReport();
    const second = buildXiaoFfxxPartialArtifactCandidateContractReport(
      fixture(),
    );

    expect(stableJson(second)).toBe(stableJson(first));
    expect(stableJson(first)).toBe(stableJson(durableReport));
    expect(XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS).toHaveLength(20);
    expect(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS,
    ).toHaveLength(20);
    expect(first.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      jsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 20,
      generatedFromCount: 20,
      jsonInputCount: 6,
    });
    expect(first.upstreamBoundary).toMatchObject({
      status: "accepted",
      freshlyAuthenticated: true,
      semanticScopeSha256: UPSTREAM_SEMANTIC_SCOPE_SHA256,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 14,
      emptyOccurrenceCount: 4,
      sourceOnlyMatchedOccurrenceCount: 2,
      requestViewMatchedOccurrenceCount: 3,
      upstreamCandidateCount: 0,
      upstreamAssembledBuildCount: 0,
    });
    expect(
      authenticateXiaoFfxxPartialArtifactCandidateContract(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    expect(() =>
      requireComparableXiaoFfxxPartialArtifactCandidateContract(
        durableReport,
        fixture(),
      ),
    ).not.toThrow();
  });

  it("constructs one canonical candidate with exactly two present and four missing axes", () => {
    const report = canonicalReport();
    const candidate = requiredCandidate(report);

    expect(candidate).toMatchObject({
      candidateId:
        "guide-factory:xiao-ffxx:partial-artifact:marechaussee-hunter-anemo-goblet",
      technicalCombinationSha256: TECHNICAL_COMBINATION_SHA256,
      candidateIdentitySha256: CANDIDATE_IDENTITY_SHA256,
      authoredBy: "guide-factory",
      sourceAuthored: false,
      sourcePublishedWholeCandidate: false,
      compositionKind: "syntactic-singleton-axis-join",
      completionStatus: "partial",
      materializableAsGuideBuildRecommendation: false,
      runtimeArtifactGenerationCandidate: false,
      jointPayloadCompatibility: "not-evaluated",
      sourceConstellation: "unspecified",
      wrapperRequestFactExcludedFromCandidateIdentity: true,
      axisVocabulary: [...AXIS_VOCABULARY],
      presentAxisIds: ["artifact-set", "main-stat:goblet"],
      missingAxisIds: [
        "weapon",
        "main-stat:sands",
        "main-stat:circlet",
        "substats",
      ],
      completeness: {
        axisCount: 6,
        presentAxisCount: 2,
        missingAxisCount: 4,
        complete: false,
        energyRecoveryPolicy: "excluded-deferred-not-a-completeness-axis",
      },
    });
    expect(candidate.axes.map(({ axisId, ordinal }) => ({ axisId, ordinal }))).toEqual(
      AXIS_VOCABULARY.map((axisId, ordinal) => ({ axisId, ordinal })),
    );
    expect(candidate.axes).toEqual([
      {
        axisId: "weapon",
        ordinal: 0,
        status: "missing-not-admitted-no-default",
        reason: "not-present-in-authenticated-applicable-claim-projection",
      },
      expect.objectContaining({
        axisId: "artifact-set",
        ordinal: 1,
        status: "present-authenticated-singleton",
        sourcePayloadSha256:
          "3f1da28d319a9d68334c22cf1f7998b682159989bf09753aed8935ce3db85fdb",
        normalizedValues: [
          { type: "4pc", setId: "marechaussee_hunter" },
        ],
      }),
      {
        axisId: "main-stat:sands",
        ordinal: 2,
        status: "missing-not-admitted-no-default",
        reason: "not-present-in-authenticated-applicable-claim-projection",
      },
      expect.objectContaining({
        axisId: "main-stat:goblet",
        ordinal: 3,
        status: "present-authenticated-singleton",
        sourcePayloadSha256:
          "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
        normalizedValues: [{ slot: "goblet", statId: "anemo%" }],
      }),
      {
        axisId: "main-stat:circlet",
        ordinal: 4,
        status: "missing-not-admitted-no-default",
        reason: "conditional-or-unselected-source-records-not-consumed",
      },
      {
        axisId: "substats",
        ordinal: 5,
        status: "missing-not-admitted-no-default",
        reason: "conditional-or-unselected-source-records-not-consumed",
      },
    ]);
    expect(report.summary).toEqual({
      uniquePartialTechnicalCandidateCount: 1,
      viewCandidateBindingCount: 2,
      completeCandidateCount: 0,
      assembledBuildCount: 0,
      sourcePublishedWholeCandidateCount: 0,
      recommendationCount: 0,
      rankedCandidateCount: 0,
      presentAxisCount: 2,
      missingAxisCount: 4,
      requestFactAddedTechnicalCandidateCount: 0,
    });
  });

  it("binds the same candidate identity to exact source-only and request provenance", () => {
    const report = canonicalReport();
    const candidate = requiredCandidate(report);
    const [sourceBinding, requestBinding] = report.viewBindings;

    expect(sourceBinding).toMatchObject({
      viewId: "source-only-ffxx",
      upstreamViewSha256: SOURCE_VIEW_SHA256,
      viewBindingSha256: SOURCE_BINDING_SHA256,
      candidateId: candidate.candidateId,
      technicalCombinationSha256: candidate.technicalCombinationSha256,
      candidateIdentitySha256: candidate.candidateIdentitySha256,
      matchedOccurrenceIds: [
        MARECHAUSSEE_OCCURRENCE_ID,
        XIANYUN_GOBLET_OCCURRENCE_ID,
      ],
      unresolvedOccurrenceIds: [C6_GOBLET_OCCURRENCE_ID],
      requestFactCount: 0,
      requestFactAuthoredBy: "none",
      requestFact: null,
      requestFactChangesTechnicalCandidateIdentity: false,
    });
    expect(requestBinding).toMatchObject({
      viewId: "exact-ffxx-plus-wrapper-c6",
      upstreamViewSha256: REQUEST_VIEW_SHA256,
      viewBindingSha256: REQUEST_BINDING_SHA256,
      candidateId: candidate.candidateId,
      technicalCombinationSha256: candidate.technicalCombinationSha256,
      candidateIdentitySha256: candidate.candidateIdentitySha256,
      matchedOccurrenceIds: [...SELECTED_OCCURRENCE_IDS],
      unresolvedOccurrenceIds: [],
      requestFactCount: 1,
      requestFactAuthoredBy: "guide-factory-explicit-fixture",
      requestFact: {
        teamRecordId:
          "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5",
        characterId: "xiao",
        constellation: 6,
        provenance: "request",
      },
      requestFactChangesTechnicalCandidateIdentity: false,
    });
    expect(sourceBinding?.candidateIdentitySha256).toBe(
      requestBinding?.candidateIdentitySha256,
    );
    expect(sourceBinding?.technicalCombinationSha256).toBe(
      requestBinding?.technicalCombinationSha256,
    );
    expect(report.authorshipBoundary).toMatchObject({
      compositionAuthoredBy: "guide-factory",
      sourceAuthoredWholeCandidate: false,
      sourceConstellationSpecified: false,
      sourceAuthoredRequestFact: false,
      requestFactAuthoredBy: "guide-factory-explicit-fixture",
      requestFact: {
        teamRecordId:
          "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5",
        characterId: "xiao",
        constellation: 6,
        provenance: "request",
      },
      wrapperRequestFactExcludedFromCandidateIdentity: true,
      requestFactChangesTechnicalCandidateIdentity: false,
    });

    for (const binding of report.viewBindings) {
      const { viewBindingSha256, ...projection } = binding;
      expect(viewBindingSha256).toBe(hashValue(projection));
    }
  });

  it("preserves C6 as source-unresolved request provenance without creating a vote", () => {
    const report = canonicalReport();
    const [sourceBinding, requestBinding] = report.viewBindings;
    const sourceGoblet = sourceBinding?.axisEvidenceBindings.find(
      ({ axisId }) => axisId === "main-stat:goblet",
    );
    const requestGoblet = requestBinding?.axisEvidenceBindings.find(
      ({ axisId }) => axisId === "main-stat:goblet",
    );
    const c6 = requestGoblet?.occurrenceEvidence.find(
      ({ occurrenceId }) => occurrenceId === C6_GOBLET_OCCURRENCE_ID,
    );

    expect(sourceGoblet?.occurrenceIds).toEqual([
      XIANYUN_GOBLET_OCCURRENCE_ID,
    ]);
    expect(requestGoblet?.occurrenceIds).toEqual([
      XIANYUN_GOBLET_OCCURRENCE_ID,
      C6_GOBLET_OCCURRENCE_ID,
    ]);
    expect(requestGoblet?.occurrenceEvidence).toHaveLength(2);
    expect(c6).toMatchObject({
      occurrenceEvidenceSha256:
        "a2e175a55326a40092def545e3548428925ffb88bae2b81398cc869b2900eff6",
      selectedOccurrenceSha256:
        "1994639390ec2bf81953c4828a54e05e7830ecb70b7e7011920b881cceb75f51",
      sourceCellSha256:
        "e5f54b96ca56536895db4ba9bd8890cc2d37530ecf39593c5d027a3d044e4003",
      requestProjectionSha256:
        "509f8b6de92edd168fb15f190ac85261dc983061e2e5c037656a9c5e80fb5afd",
      sourceResolution: "unresolved-context",
      contextApplicability: "applicable-under-supplied-context",
      effectiveResolution: "matched",
      requestContextBindingCount: 1,
    });
    expect(requestBinding).toMatchObject({
      repeatedGobletPayloadEstablishesCorroboration: false,
      repeatedGobletPayloadAffectsRank: false,
    });
    expect(report.summary.uniquePartialTechnicalCandidateCount).toBe(1);
    expect(report.summary.requestFactAddedTechnicalCandidateCount).toBe(0);
  });

  it("preserves the disjoint 3/14/4 partition with zero holdout or empty consumption", () => {
    const report = canonicalReport();
    const partition = report.partitionBoundary;
    if (!partition) throw new Error("Missing Xiao partial-candidate partition.");

    expect(partition).toMatchObject({
      selectedOccurrenceIds: [...SELECTED_OCCURRENCE_IDS],
      selectedHoldoutEmptyDisjoint: true,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 14,
      emptyOccurrenceCount: 4,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
    });
    const allIds = [
      ...partition.selectedOccurrenceIds,
      ...partition.holdoutOccurrenceIds,
      ...partition.emptyOccurrenceIds,
    ];
    expect(new Set(allIds).size).toBe(21);
  });

  it("reports only partial construction capability and no recommendation or computation claim", () => {
    const report = canonicalReport();

    expect(report).toMatchObject({
      crossAxisCompositionExecuted: true,
      partialCandidateConstructionExecuted: true,
      candidateGenerationExecuted: true,
      candidateGenerationKind: "deterministic-singleton-axis-join",
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
      supportsFormulaClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      playerFacingRecommendations: false,
      recommendationCompositionExecuted: false,
      choiceSelectionExecuted: false,
      cartesianChoiceEnumerationExecuted: false,
      payloadCompatibilityEvaluated: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      formulaInputsUsed: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      executionInputBoundary: {
        formulaPlan: "absent-not-consumed",
        rotation: "absent-not-consumed",
        damageObjective: "absent-not-consumed",
        generatorOptions: "absent-not-consumed",
        optimizerPolicy: "absent-not-consumed",
        playerInventory: "absent-not-consumed",
        energyRecovery: "excluded-deferred",
      },
    });
  });

  it("fails closed on source path, raw byte, and declared hash drift", () => {
    const missingPath = fixture();
    missingPath.sourceFiles = missingPath.sourceFiles.slice(1);
    expectFailedBuild(missingPath, "source-file path closure drifted");

    for (const sourcePath of [XIAO_MANUAL_RELATIVE_PATH, CORE_PATH, CLI_PATH]) {
      const byteDrift = fixture();
      byteDrift.sourceFiles = byteDrift.sourceFiles.map((entry) =>
        entry.path === sourcePath
          ? { ...entry, text: `${entry.text}\n` }
          : entry,
      );
      expectFailedBuild(byteDrift, `source-file hash drifted for ${sourcePath}`);
    }

    const hashDrift = fixture();
    hashDrift.generatedFrom = hashDrift.generatedFrom.map((entry) =>
      entry.path === CORE_PATH ? { ...entry, sha256: "0".repeat(64) } : entry,
    );
    expectFailedBuild(hashDrift, `source-file hash drifted for ${CORE_PATH}`);
  });

  it("fails closed when any of the six parsed JSON inputs disagrees with bytes", () => {
    const parsedInputs: Array<keyof Pick<
      BuildXiaoFfxxPartialArtifactCandidateContractInput,
      | "repositoryInput"
      | "manualSnapshotInput"
      | "manualIndexInput"
      | "sourceRegistryInput"
      | "xiaoSourceLocalDurableReportInput"
      | "applicableClaimDurableReportInput"
    >> = [
      "repositoryInput",
      "manualSnapshotInput",
      "manualIndexInput",
      "sourceRegistryInput",
      "xiaoSourceLocalDurableReportInput",
      "applicableClaimDurableReportInput",
    ];

    for (const inputKey of parsedInputs) {
      const input = fixture();
      const parsed = structuredClone(input[inputKey]) as Record<string, unknown>;
      parsed.__forged = inputKey;
      input[inputKey] = parsed;
      expectFailedBuild(input, "parsed input disagrees with source bytes");
    }
  });

  it("fresh-authenticates and rejects rehashed upstream semantic, request, payload, view, partition, and capability drift", () => {
    const cases: Array<{
      label: string;
      mutate: (report: XiaoFfxxApplicableClaimProjectionContractReport) => void;
    }> = [
      {
        label: "semantic",
        mutate: (report) => {
          report.summary.sourceOnlyMatchedOccurrenceCount = 1;
        },
      },
      {
        label: "request",
        mutate: (report) => {
          if (!report.authorshipBoundary) throw new Error("Missing authorship.");
          Reflect.set(report.authorshipBoundary.requestFact, "constellation", 5);
        },
      },
      {
        label: "payload",
        mutate: (report) => {
          const group = report.views.exactFfxxPlusWrapperC6?.payloadGroups.find(
            ({ payloadSha256 }) =>
              payloadSha256 ===
              "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
          );
          if (!group) throw new Error("Missing Anemo group.");
          group.payloadSha256 = "0".repeat(64);
        },
      },
      {
        label: "view",
        mutate: (report) => {
          if (!report.views.sourceOnly) throw new Error("Missing source view.");
          report.views.sourceOnly.matchedOccurrenceIds = [
            MARECHAUSSEE_OCCURRENCE_ID,
            C6_GOBLET_OCCURRENCE_ID,
          ];
        },
      },
      {
        label: "partition",
        mutate: (report) => {
          if (!report.partitionBoundary) throw new Error("Missing partition.");
          Reflect.set(report.partitionBoundary, "holdoutConsumedCount", 1);
        },
      },
      {
        label: "capability",
        mutate: (report) => {
          Reflect.set(report, "supportsRankClaims", true);
          Reflect.set(report, "candidateCount", 1);
        },
      },
    ];

    for (const testCase of cases) {
      const input = fixture();
      const forged = structuredClone(
        input.applicableClaimDurableReportInput,
      ) as XiaoFfxxApplicableClaimProjectionContractReport;
      testCase.mutate(forged);
      replaceApplicableDurable(input, forged);
      const result = buildXiaoFfxxPartialArtifactCandidateContractReport(input);
      expect(result.comparisonStatus, testCase.label).toBe("not-comparable");
      expect(result.candidate, testCase.label).toBeNull();
      expect(result.viewBindings, testCase.label).toEqual([]);
      expect(result.issues[0]?.message, testCase.label).toContain(
        "failed fresh authentication",
      );
    }
  });

  it("rejects serialized semantic, request, payload, view, partition, axis, missing-policy, identity, count, provenance, and capability tampering", () => {
    const cases: Array<{
      label: string;
      mutate: (report: XiaoFfxxPartialArtifactCandidateContractReport) => void;
    }> = [
      {
        label: "semantic hash",
        mutate: (report) => {
          report.upstreamBoundary.semanticScopeSha256 = "0".repeat(64);
        },
      },
      {
        label: "request binding",
        mutate: (report) => {
          Reflect.set(report.viewBindings[1], "requestFactAuthoredBy", "none");
        },
      },
      {
        label: "payload",
        mutate: (report) => {
          const axis = report.candidate?.axes.find(
            ({ axisId }) => axisId === "main-stat:goblet",
          );
          if (!axis || axis.status !== "present-authenticated-singleton") {
            throw new Error("Missing Goblet axis.");
          }
          axis.sourcePayloadSha256 = "0".repeat(64);
        },
      },
      {
        label: "view",
        mutate: (report) => {
          report.viewBindings[0]!.matchedOccurrenceIds = [
            C6_GOBLET_OCCURRENCE_ID,
          ];
        },
      },
      {
        label: "partition",
        mutate: (report) => {
          if (!report.partitionBoundary) throw new Error("Missing partition.");
          report.partitionBoundary.selectedOccurrenceIds = [
            C6_GOBLET_OCCURRENCE_ID,
          ];
        },
      },
      {
        label: "axis",
        mutate: (report) => {
          if (!report.candidate) throw new Error("Missing candidate.");
          report.candidate.axes.reverse();
        },
      },
      {
        label: "missing policy",
        mutate: (report) => {
          const axis = report.candidate?.axes.find(
            ({ axisId }) => axisId === "weapon",
          );
          if (!axis || axis.status !== "missing-not-admitted-no-default") {
            throw new Error("Missing weapon axis.");
          }
          axis.reason = "conditional-or-unselected-source-records-not-consumed";
        },
      },
      {
        label: "candidate hash",
        mutate: (report) => {
          if (!report.candidate) throw new Error("Missing candidate.");
          report.candidate.candidateIdentitySha256 = "0".repeat(64);
        },
      },
      {
        label: "count",
        mutate: (report) => {
          report.summary.uniquePartialTechnicalCandidateCount = 2;
        },
      },
      {
        label: "provenance",
        mutate: (report) => {
          const c6 = report.viewBindings[1]?.axisEvidenceBindings
            .find(({ axisId }) => axisId === "main-stat:goblet")
            ?.occurrenceEvidence.find(
              ({ occurrenceId }) => occurrenceId === C6_GOBLET_OCCURRENCE_ID,
            );
          if (!c6) throw new Error("Missing C6 binding.");
          c6.sourceResolution = "matched";
        },
      },
      {
        label: "capability",
        mutate: (report) => {
          Reflect.set(report, "supportsBuildRecommendations", true);
          Reflect.set(report, "generatorExecuted", true);
        },
      },
    ];

    for (const testCase of cases) {
      const forged = structuredClone(durableReport);
      testCase.mutate(forged);
      expect(
        authenticateXiaoFfxxPartialArtifactCandidateContract(
          forged,
          fixture(),
        ),
        testCase.label,
      ).toMatchObject({
        authenticated: false,
        reason: "serialized-report-mismatch",
      });
    }
  });
});

async function loadFixture(): Promise<BuildXiaoFfxxPartialArtifactCandidateContractInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(
      path.join(REPOSITORY_ROOT, XIAO_SOURCE_LOCAL_REPORT_RELATIVE_PATH),
    ),
    readJson(path.join(REPOSITORY_ROOT, APPLICABLE_REPORT_RELATIVE_PATH)),
    Promise.all(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.map(
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
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxPartialArtifactCandidateContractInput {
  return structuredClone(baseInput);
}

function canonicalReport(): XiaoFfxxPartialArtifactCandidateContractReport {
  const report = buildXiaoFfxxPartialArtifactCandidateContractReport(fixture());
  if (report.comparisonStatus !== "comparable") {
    throw new Error(
      `Expected comparable Xiao partial candidate: ${report.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
  return report;
}

function requiredCandidate(report: XiaoFfxxPartialArtifactCandidateContractReport) {
  if (!report.candidate) throw new Error("Missing Xiao partial candidate.");
  return report.candidate;
}

function expectFailedBuild(
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
  message: string,
): void {
  const report = buildXiaoFfxxPartialArtifactCandidateContractReport(input);
  expect(report).toMatchObject({
    comparisonStatus: "not-comparable",
    crossAxisCompositionExecuted: false,
    partialCandidateConstructionExecuted: false,
    candidateGenerationExecuted: false,
    candidateGenerationKind: "none-failed-input",
    candidate: null,
    viewBindings: [],
    summary: {
      uniquePartialTechnicalCandidateCount: 0,
      viewCandidateBindingCount: 0,
      completeCandidateCount: 0,
      assembledBuildCount: 0,
    },
  });
  expect(report.issues[0]?.message).toContain(message);
}

function replaceApplicableDurable(
  input: BuildXiaoFfxxPartialArtifactCandidateContractInput,
  durable: XiaoFfxxApplicableClaimProjectionContractReport,
): void {
  const text = stableJson(durable);
  input.applicableClaimDurableReportInput = durable;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === APPLICABLE_REPORT_RELATIVE_PATH
      ? { path: entry.path, text }
      : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === APPLICABLE_REPORT_RELATIVE_PATH
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
