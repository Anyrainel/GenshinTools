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
import {
  authenticateXiaoFfxxApplicableClaimProjectionContract,
  buildXiaoFfxxApplicableClaimProjectionContractReport,
  requireComparableXiaoFfxxApplicableClaimProjectionContract,
  XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS,
  XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH,
  XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS,
  type BuildXiaoFfxxApplicableClaimProjectionContractInput,
  type XiaoFfxxApplicableClaimProjectionContractReport,
} from "../src/xiaoFfxxApplicableClaimProjectionContract";
import type { XiaoSourceLocalConditionSliceReport } from "../src/xiaoSourceLocalConditionSlice";

const XIAO_MANUAL_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);
const XIAO_MANUAL_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_UPSTREAM_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const PROJECTION_IMPLEMENTATION_PATHS = [
  "scripts/guide-factory/src/xiaoFfxxApplicableClaimProjectionContract.ts",
  "scripts/guide-factory/src/assemble-xiao-ffxx-applicable-claim-projection-contract.ts",
] as const;
const TEAM_ID =
  "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
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
const C6_REQUEST_PREDICATE = {
  type: "constellation-at-least",
  characterId: "xiao",
  threshold: 6,
} as const;
const ANEMO_PAYLOAD_SHA256 =
  "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1";

const EXPECTED_LINEAGE_HASHES = {
  [MARECHAUSSEE_OCCURRENCE_ID]: {
    selectedOccurrenceSha256:
      "c46898b21fce01efac4a40290121229853a4cf5d14529f9c6db7e36b45a11551",
    sourceClaimSha256:
      "f3a06383da54355bb383c1ddceb60031311e5727896332612978277cb81795c8",
    conditionControlSha256:
      "68db45b02b15a2e41a2be5c57d7320101d901058976b264186fd1a76596f067a",
    sourceCellSha256:
      "23b591c3dd359b0e8c3b0f30173b27e3b3f48b319c84fdaa7697a86c507d4a3e",
    requestProjectionSha256:
      "34d19cada6d55fb6e3b51516f98816c79ee8d46ba9bb99c189c9a88dd36ba23b",
  },
  [XIANYUN_GOBLET_OCCURRENCE_ID]: {
    selectedOccurrenceSha256:
      "048871163248ab8a70bc38f0ebcb4188470ed1ff5dcdaa3b6d2bfc1ac80d4531",
    sourceClaimSha256:
      "7df7650e957d48d22ff046f298960c150c1bb60b7dbecd30c0611e988ede22e3",
    conditionControlSha256:
      "17b7046a895e2e5a997dd0a6d6a1f029d75357b380036bef1ccd986ddd5571d8",
    sourceCellSha256:
      "84d4dc8982ff1c20de2ccece2664a44f4392a2b3cbf24f70ce39fc3ee96478b9",
    requestProjectionSha256:
      "2c82d94d5182cdba8bb3c4a81a94b1d45b9f3b33e661372dfca1a1387650f6fa",
  },
  [C6_GOBLET_OCCURRENCE_ID]: {
    selectedOccurrenceSha256:
      "1994639390ec2bf81953c4828a54e05e7830ecb70b7e7011920b881cceb75f51",
    sourceClaimSha256:
      "6a6c450cd8d51dba26112f66b1e45595b86701c14ce3218d508428d6e49216c8",
    conditionControlSha256:
      "5b10191ca84d5e14f8ff041160ac55996b8b9537bb74afd374bfc6999930298d",
    sourceCellSha256:
      "e5f54b96ca56536895db4ba9bd8890cc2d37530ecf39593c5d027a3d044e4003",
    requestProjectionSha256:
      "509f8b6de92edd168fb15f190ac85261dc983061e2e5c037656a9c5e80fb5afd",
  },
} as const;

let baseInput: BuildXiaoFfxxApplicableClaimProjectionContractInput;
let durableReport: XiaoFfxxApplicableClaimProjectionContractReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH,
    ) as Promise<XiaoFfxxApplicableClaimProjectionContractReport>,
  ]);
});

describe("Xiao FFXX applicable-claim projection contract", () => {
  it("rebuilds deterministically and authenticates the durable report", () => {
    const input = fixture();
    const first = buildXiaoFfxxApplicableClaimProjectionContractReport(input);
    const second = buildXiaoFfxxApplicableClaimProjectionContractReport(fixture());

    expect(first.comparisonStatus).toBe("comparable");
    expect(first.issues).toEqual([]);
    expect(stableJson(second)).toBe(stableJson(first));
    expect(stableJson(first)).toBe(stableJson(durableReport));
    expect(first.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      sourceFileByteClosureAndJsonObjectParity: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      sourceFileCount:
        XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS.length,
      generatedFromCount:
        XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS.length,
    });
    expect(first.upstreamBoundary).toEqual({
      status: "accepted",
      durableReportPath: XIAO_UPSTREAM_REPORT_RELATIVE_PATH,
      durableReportFileSha256:
        "2de90b57e0611156294aa8a60095fd4829a0c8ab3f6523b61ed82959d15d8353",
      durableReportCanonicalObjectSha256:
        "2de90b57e0611156294aa8a60095fd4829a0c8ab3f6523b61ed82959d15d8353",
      freshlyAuthenticated: true,
      sliceId:
        "kqm-xiao-ffxx-roster-and-c6-source-local-condition-slice-version-5-5",
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 14,
      emptyOccurrenceCount: 4,
      sourceMatchedCount: 2,
      sourceUnresolvedCount: 1,
      effectiveMatchedCount: 3,
    });
    expect(
      authenticateXiaoFfxxApplicableClaimProjectionContract(
        durableReport,
        input,
      ),
    ).toMatchObject({ authenticated: true });
    expect(() =>
      requireComparableXiaoFfxxApplicableClaimProjectionContract(
        durableReport,
        input,
      ),
    ).not.toThrow();
  });

  it("keeps exact two-occurrence source-only and three-occurrence request views", () => {
    const report = canonicalReport();

    expect(report.views.sourceOnly).toEqual(
      expect.objectContaining({
        viewId: "source-only-ffxx",
        requestContextUsed: false,
        matchedOccurrenceIds: [
          MARECHAUSSEE_OCCURRENCE_ID,
          XIANYUN_GOBLET_OCCURRENCE_ID,
        ],
        unresolvedOccurrenceIds: [C6_GOBLET_OCCURRENCE_ID],
        sourceAlreadyMatchedOccurrenceIds: [
          MARECHAUSSEE_OCCURRENCE_ID,
          XIANYUN_GOBLET_OCCURRENCE_ID,
        ],
        requestResolvedOccurrenceIds: [],
        matchedOccurrenceCount: 2,
        unresolvedOccurrenceCount: 1,
        requestFactCount: 0,
        payloadGroupCount: 2,
      }),
    );
    expect(report.views.exactFfxxPlusWrapperC6).toEqual(
      expect.objectContaining({
        viewId: "exact-ffxx-plus-wrapper-c6",
        requestContextUsed: true,
        matchedOccurrenceIds: [...SELECTED_OCCURRENCE_IDS],
        unresolvedOccurrenceIds: [],
        sourceAlreadyMatchedOccurrenceIds: [
          MARECHAUSSEE_OCCURRENCE_ID,
          XIANYUN_GOBLET_OCCURRENCE_ID,
        ],
        requestResolvedOccurrenceIds: [C6_GOBLET_OCCURRENCE_ID],
        matchedOccurrenceCount: 3,
        unresolvedOccurrenceCount: 0,
        requestFactCount: 1,
        payloadGroupCount: 2,
      }),
    );
    expect(report.summary).toMatchObject({
      sourceOnlyMatchedOccurrenceCount: 2,
      sourceOnlyUnresolvedOccurrenceCount: 1,
      sourceOnlyPayloadGroupCount: 2,
      requestViewMatchedOccurrenceCount: 3,
      requestResolvedOccurrenceCount: 1,
      requestViewPayloadGroupCount: 2,
    });
  });

  it("deduplicates the repeated Anemo payload without losing either occurrence or creating rank", () => {
    const report = canonicalReport();
    const sourceOnlyGroup = report.views.sourceOnly?.payloadGroups.find(
      ({ payloadSha256 }) => payloadSha256 === ANEMO_PAYLOAD_SHA256,
    );
    const requestGroup =
      report.views.exactFfxxPlusWrapperC6?.payloadGroups.find(
        ({ payloadSha256 }) => payloadSha256 === ANEMO_PAYLOAD_SHA256,
      );

    expect(sourceOnlyGroup).toMatchObject({
      claimAxis: "main-stat",
      mainStatSlot: "goblet",
      contributingOccurrenceIds: [XIANYUN_GOBLET_OCCURRENCE_ID],
      occurrenceMultiplicity: 1,
      repeatedPayloadIdentity: false,
      establishesCorroboration: false,
      affectsRank: false,
    });
    expect(requestGroup).toMatchObject({
      claimAxis: "main-stat",
      mainStatSlot: "goblet",
      payload: { type: "main-stat", slot: "goblet", statIds: ["anemo%"] },
      contributingOccurrenceIds: [
        XIANYUN_GOBLET_OCCURRENCE_ID,
        C6_GOBLET_OCCURRENCE_ID,
      ],
      occurrenceMultiplicity: 2,
      repeatedPayloadIdentity: true,
      establishesCorroboration: false,
      affectsRank: false,
    });
    expect(report.payloadIdentityPolicy).toEqual({
      keyFields: ["claimAxis", "mainStatSlot", "payloadSha256"],
      deduplicationPurpose: "canonical-payload-representation-only",
      occurrenceProvenancePreserved: true,
      repeatedPayloadEstablishesCorroboration: false,
      repeatedPayloadAffectsRank: false,
      payloadGroupOrder: "canonical-technical-only",
    });
    expect(report.summary.duplicatedPayloadOccurrenceCount).toBe(2);
    expect(report.supportsRankClaims).toBe(false);
  });

  it("pins and reconstructs every selected occurrence lineage hash", () => {
    const report = canonicalReport();
    const observed = Object.fromEntries(
      report.occurrenceEvidence.map(
        ({
          occurrenceId,
          selectedOccurrenceSha256,
          sourceClaimSha256,
          conditionControlSha256,
          sourceCellSha256,
          requestProjectionSha256,
        }) => [
          occurrenceId,
          {
            selectedOccurrenceSha256,
            sourceClaimSha256,
            conditionControlSha256,
            sourceCellSha256,
            requestProjectionSha256,
          },
        ],
      ),
    );

    expect(observed).toEqual(EXPECTED_LINEAGE_HASHES);
    for (const evidence of report.occurrenceEvidence) {
      expect(evidence.selectedOccurrence.occurrenceId).toBe(
        evidence.occurrenceId,
      );
      expect(evidence.sourceClaim.claimId).toBe(evidence.occurrenceId);
      expect(evidence.conditionControl.claimId).toBe(evidence.occurrenceId);
      expect(evidence.sourceCell.claimId).toBe(evidence.occurrenceId);
      expect(evidence.requestProjection.claimId).toBe(evidence.occurrenceId);
      expect(evidence.selectedOccurrenceSha256).toBe(
        hashValue(evidence.selectedOccurrence),
      );
      expect(evidence.sourceClaimSha256).toBe(hashValue(evidence.sourceClaim));
      expect(evidence.conditionControlSha256).toBe(
        hashValue(evidence.conditionControl),
      );
      expect(evidence.sourceCellSha256).toBe(hashValue(evidence.sourceCell));
      expect(evidence.requestProjectionSha256).toBe(
        hashValue(evidence.requestProjection),
      );
    }
  });

  it("keeps C6 source-unresolved and resolves it only with exact FFXX request provenance", () => {
    const report = canonicalReport();
    const c6 = requiredEvidence(report, C6_GOBLET_OCCURRENCE_ID);
    const inputBinding = c6.conditionControl.requestBindings[0];
    const outputBinding = c6.requestProjection.requestContextBindings[0];

    expect(c6.selectedOccurrence.requestPredicate).toEqual(
      C6_REQUEST_PREDICATE,
    );
    expect(c6.sourceCell).toMatchObject({
      resolution: "unresolved-context",
      predicateRows: [
        expect.objectContaining({
          predicateType: "unresolved-context",
          result: "unknown",
          structuredFact: "none-unresolved-context",
        }),
      ],
    });
    expect(c6.applicabilityProvenance).toEqual({
      sourceResolution: "unresolved-context",
      contextApplicability: "applicable-under-supplied-context",
      effectiveResolution: "matched",
      requestContextBindingCount: 1,
      sourceControlPreserved: true,
    });
    expect(c6.requestProjection.sourceControl.resolution).toBe(
      "unresolved-context",
    );
    expect(inputBinding).toMatchObject({
      sourcePredicatePath: "predicate",
      sourcePredicateLeafSha256: c6.selectedOccurrence.predicateSha256,
      requestPredicate: C6_REQUEST_PREDICATE,
    });
    expect(outputBinding).toMatchObject({
      sourcePredicatePath: "predicate",
      requestPredicate: C6_REQUEST_PREDICATE,
      result: "true",
      predicateRows: [
        expect.objectContaining({
          predicatePath: "requestPredicate",
          predicateType: "constellation-at-least",
          result: "true",
          factProvenance: "request",
          factScope: {
            teamRecordId: TEAM_ID,
            characterId: "xiao",
            accountSnapshotId: null,
          },
        }),
      ],
    });
    expect(report.authorshipBoundary).toMatchObject({
      sourceCellsPreservedVerbatim: true,
      requestProjectionsPreservedVerbatim: true,
      sourceAuthoredRequestFact: false,
      requestFactAuthoredBy: "guide-factory-explicit-fixture",
      requestFact: {
        teamRecordId: TEAM_ID,
        characterId: "xiao",
        constellation: 6,
        provenance: "request",
      },
      teamSha256:
        "e1fd7685c28a3804097ef328c0d15d4b19e9da17a5d9628e19c0b96e34c20a09",
    });
    expect(
      report.occurrenceEvidence.map(
        ({ applicabilityProvenance }) =>
          applicabilityProvenance.requestContextBindingCount,
      ),
    ).toEqual([0, 0, 1]);
    expect(
      report.occurrenceEvidence.flatMap(({ requestProjection }) =>
        requestProjection.requestContextBindings.flatMap(({ predicateRows }) =>
          predicateRows.map(({ factProvenance, factScope }) => ({
            factProvenance,
            factScope,
          })),
        ),
      ),
    ).toEqual([
      {
        factProvenance: "request",
        factScope: {
          teamRecordId: TEAM_ID,
          characterId: "xiao",
          accountSnapshotId: null,
        },
      },
    ]);
  });

  it("preserves the exact disjoint 3/14/4 partition with no holdout consumption", () => {
    const report = canonicalReport();
    const partition = report.partitionBoundary;
    if (!partition) throw new Error("Missing Xiao partition boundary.");

    expect(partition).toMatchObject({
      selectedOccurrenceIds: [...SELECTED_OCCURRENCE_IDS],
      selectedOccurrencesSha256:
        "4dd8a1e1b32f81fc365f9ea81a0b2f33434e314a5b6cadb453820e5b61bde0f6",
      holdoutOccurrencesSha256:
        "f7bc7bd49d05dcd4f41eba373d6ac9b0e711d911371ae10cca394a986ca41642",
      emptyOccurrencesSha256:
        "d4115bcd7c7cd0ddeaf3a71c5021217a473e566730d6e250cd562e46cee0780c",
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
    expect(new Set(partition.selectedOccurrenceIds).size).toBe(3);
    expect(new Set(partition.holdoutOccurrenceIds).size).toBe(14);
    expect(new Set(partition.emptyOccurrenceIds).size).toBe(4);
    expect(new Set(allIds).size).toBe(21);
    expect(
      partition.holdoutOccurrenceIds.filter((id) =>
        partition.selectedOccurrenceIds.includes(id),
      ),
    ).toEqual([]);
    expect(
      partition.emptyOccurrenceIds.filter(
        (id) =>
          partition.selectedOccurrenceIds.includes(id) ||
          partition.holdoutOccurrenceIds.includes(id),
      ),
    ).toEqual([]);
    expect(report.summary).toMatchObject({
      evidenceOccurrenceCount: 3,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
    });
  });

  it("executes only applicability projection and identity deduplication capabilities", () => {
    const report = canonicalReport();

    expect(report).toMatchObject({
      applicabilityProjectionExecuted: true,
      payloadIdentityDeduplicationExecuted: true,
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
      crossAxisCompositionExecuted: false,
      payloadCompatibilityEvaluated: false,
      choiceSelectionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      formulaInputsUsed: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      assembledBuildCount: 0,
      candidateCount: 0,
      summary: { assembledBuildCount: 0, candidateCount: 0 },
    });
  });

  it("fails closed on raw-byte disagreement and unauthenticated durable output", () => {
    const sourceHashDrift = fixture();
    sourceHashDrift.sourceFiles = sourceHashDrift.sourceFiles.map((entry) =>
      entry.path === XIAO_MANUAL_RELATIVE_PATH
        ? { ...entry, text: `${entry.text}\n` }
        : entry,
    );
    expect(
      buildXiaoFfxxApplicableClaimProjectionContractReport(sourceHashDrift),
    ).toMatchObject({
      comparisonStatus: "not-comparable",
      applicabilityProjectionExecuted: false,
      views: { sourceOnly: null, exactFfxxPlusWrapperC6: null },
      issues: [
        expect.objectContaining({
          message: expect.stringContaining("source-file hash drifted"),
        }),
      ],
    });

    for (const implementationPath of PROJECTION_IMPLEMENTATION_PATHS) {
      const implementationHashDrift = fixture();
      implementationHashDrift.sourceFiles =
        implementationHashDrift.sourceFiles.map((entry) =>
          entry.path === implementationPath
            ? { ...entry, text: `${entry.text}\n` }
            : entry,
        );
      expect(
        buildXiaoFfxxApplicableClaimProjectionContractReport(
          implementationHashDrift,
        ),
      ).toMatchObject({
        comparisonStatus: "not-comparable",
        issues: [
          expect.objectContaining({
            message: expect.stringContaining(
              `source-file hash drifted for ${implementationPath}`,
            ),
          }),
        ],
      });
    }

    const parsedObjectDrift = fixture();
    const manual = structuredClone(parsedObjectDrift.manualSnapshotInput) as {
      page: { sourceVersion: string };
    };
    manual.page.sourceVersion = "Version forged";
    parsedObjectDrift.manualSnapshotInput = manual;
    expect(
      buildXiaoFfxxApplicableClaimProjectionContractReport(parsedObjectDrift),
    ).toMatchObject({
      comparisonStatus: "not-comparable",
      issues: [
        expect.objectContaining({
          message: expect.stringContaining("parsed input disagrees"),
        }),
      ],
    });

    const forgedDurable = structuredClone(durableReport);
    forgedDurable.summary.requestViewMatchedOccurrenceCount = 2;
    expect(
      authenticateXiaoFfxxApplicableClaimProjectionContract(
        forgedDurable,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });

    const forgedViewSet = structuredClone(durableReport);
    const sourceOnly = forgedViewSet.views.sourceOnly;
    if (!sourceOnly) throw new Error("Missing source-only Xiao view.");
    sourceOnly.matchedOccurrenceIds = [
      MARECHAUSSEE_OCCURRENCE_ID,
      C6_GOBLET_OCCURRENCE_ID,
    ];
    sourceOnly.unresolvedOccurrenceIds = [XIANYUN_GOBLET_OCCURRENCE_ID];
    expect(
      authenticateXiaoFfxxApplicableClaimProjectionContract(
        forgedViewSet,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });

  it("fails closed on locally rehashed semantic, request, payload, holdout, and capability tampering", () => {
    const cases: Array<{
      label: string;
      mutate: (report: XiaoSourceLocalConditionSliceReport) => void;
    }> = [
      {
        label: "semantic scope",
        mutate: (report) => {
          if (!report.semanticScopeAudit) {
            throw new Error("Missing Xiao semantic-scope audit.");
          }
          report.semanticScopeAudit.scopeProjectionSha256 = "0".repeat(64);
        },
      },
      {
        label: "request scope and provenance",
        mutate: (report) => {
          const fact = report.sourceLocalSlice?.requestContextReport?.context
            .requestFactsByTeamRecordId?.[TEAM_ID]?.characterFactsById?.xiao;
          const row = report.sourceLocalSlice?.requestContextReport
            ?.teamProjections[0]?.claimProjections.find(
              ({ claimId }) => claimId === C6_GOBLET_OCCURRENCE_ID,
            )?.requestContextBindings[0]?.predicateRows[0];
          if (!fact || !row) throw new Error("Missing Xiao C6 request evidence.");
          fact.constellation = 5;
          row.factScope.teamRecordId = "kqm:team:forged-xiao-team";
        },
      },
      {
        label: "extra request scope",
        mutate: (report) => {
          const requestFacts = report.sourceLocalSlice?.requestContextReport
            ?.context.requestFactsByTeamRecordId;
          if (!requestFacts) throw new Error("Missing Xiao request facts.");
          Reflect.set(requestFacts, "kqm:team:forged-extra-team", {
            characterFactsById: { xiao: { constellation: 6 } },
          });
        },
      },
      {
        label: "payload lineage",
        mutate: (report) => {
          const selected = report.selectedOccurrences.find(
            ({ occurrenceId }) =>
              occurrenceId === XIANYUN_GOBLET_OCCURRENCE_ID,
          );
          const claim = report.sourceLocalSlice?.sourceClaimCatalog.find(
            ({ claimId }) => claimId === XIANYUN_GOBLET_OCCURRENCE_ID,
          );
          const control = report.sourceLocalSlice?.conditionControls.find(
            ({ claimId }) => claimId === XIANYUN_GOBLET_OCCURRENCE_ID,
          );
          if (
            selected?.payload.type !== "main-stat" ||
            claim?.payload.type !== "main-stat" ||
            !control
          ) {
            throw new Error("Missing Xiao Anemo payload lineage.");
          }
          selected.payload.statIds = ["atk%"];
          selected.payloadSha256 = hashValue(selected.payload);
          claim.payload = structuredClone(selected.payload);
          control.occurrenceControl.payloadSha256 = selected.payloadSha256;
        },
      },
      {
        label: "holdout consumption",
        mutate: (report) => {
          const holdout = report.holdoutOccurrences[0];
          if (!holdout) throw new Error("Missing Xiao holdout.");
          Reflect.set(holdout, "consumedBySlice", true);
          Reflect.set(holdout, "bindingAuthoredBySlice", true);
        },
      },
      {
        label: "selected-holdout overlap",
        mutate: (report) => {
          const holdout = report.holdoutOccurrences[0];
          if (!holdout) throw new Error("Missing Xiao holdout.");
          holdout.occurrenceId = MARECHAUSSEE_OCCURRENCE_ID;
        },
      },
      {
        label: "capability boundary",
        mutate: (report) => {
          Reflect.set(report, "supportsBuildRecommendations", true);
          Reflect.set(report, "candidateGenerationExecuted", true);
          Reflect.set(report, "candidateCount", 1);
        },
      },
    ];

    for (const testCase of cases) {
      const input = fixture();
      const upstream = structuredClone(
        input.xiaoDurableReportInput,
      ) as XiaoSourceLocalConditionSliceReport;
      testCase.mutate(upstream);
      replaceUpstreamDurable(input, upstream);

      const result = buildXiaoFfxxApplicableClaimProjectionContractReport(input);
      expect(result.comparisonStatus, testCase.label).toBe("not-comparable");
      expect(result.applicabilityProjectionExecuted, testCase.label).toBe(false);
      expect(result.payloadIdentityDeduplicationExecuted, testCase.label).toBe(
        false,
      );
      expect(result.views, testCase.label).toEqual({
        sourceOnly: null,
        exactFfxxPlusWrapperC6: null,
      });
      expect(result.upstreamBoundary.status, testCase.label).toBe("rejected");
      expect(result.issues[0]?.message, testCase.label).toContain(
        "failed fresh authentication",
      );
    }
  });

  it("rejects capability forgeries in the durable contract itself", () => {
    const forged = structuredClone(durableReport);
    Reflect.set(forged, "supportsRankClaims", true);
    Reflect.set(forged, "candidateCount", 1);
    Reflect.set(forged.summary, "candidateCount", 1);

    expect(
      authenticateXiaoFfxxApplicableClaimProjectionContract(forged, fixture()),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableXiaoFfxxApplicableClaimProjectionContract(
        forged,
        fixture(),
      ),
    ).toThrow("serialized-report-mismatch");
  });
});

async function loadFixture(): Promise<BuildXiaoFfxxApplicableClaimProjectionContractInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(path.join(REPOSITORY_ROOT, XIAO_UPSTREAM_REPORT_RELATIVE_PATH)),
    Promise.all(
      XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_INPUT_PATHS.map(
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
    xiaoDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxApplicableClaimProjectionContractInput {
  return structuredClone(baseInput);
}

function canonicalReport(): XiaoFfxxApplicableClaimProjectionContractReport {
  const report = buildXiaoFfxxApplicableClaimProjectionContractReport(fixture());
  if (report.comparisonStatus !== "comparable") {
    throw new Error(
      `Expected comparable Xiao projection: ${report.issues
        .map(({ message }) => message)
        .join("; ")}`,
    );
  }
  return report;
}

function requiredEvidence(
  report: XiaoFfxxApplicableClaimProjectionContractReport,
  occurrenceId: string,
) {
  const evidence = report.occurrenceEvidence.find(
    (row) => row.occurrenceId === occurrenceId,
  );
  if (!evidence) throw new Error(`Missing Xiao evidence ${occurrenceId}.`);
  return evidence;
}

function replaceUpstreamDurable(
  input: BuildXiaoFfxxApplicableClaimProjectionContractInput,
  durable: XiaoSourceLocalConditionSliceReport,
): void {
  const text = stableJson(durable);
  input.xiaoDurableReportInput = durable;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === XIAO_UPSTREAM_REPORT_RELATIVE_PATH
      ? { path: entry.path, text }
      : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === XIAO_UPSTREAM_REPORT_RELATIVE_PATH
      ? { path: entry.path, sha256: sha256Text(text) }
      : entry,
  );
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
