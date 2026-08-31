import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
  formatGuideDraftPortabilityInventorySummary,
  loadGuideDraftPortabilityInventoryInputFromWorkspace,
} from "../src/assemble-guide-draft-portability-inventory";
import {
  authenticateGuideDraftPortabilityInventoryReport,
  buildGuideDraftPortabilityInventoryReport,
  GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
  GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH,
  GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS,
  type GuideDraftPortabilityInventoryInput,
  type GuideDraftPortabilityInventoryReport,
} from "../src/guideDraftPortabilityInventory";
import {
  hashGuideDraftValue,
  resolveGuideDraftJsonPointer,
} from "../src/guideDraftPacket";
import { stableJson } from "../src/io";

const EXPECTED_SUBJECTS = [
  "arataki_itto",
  "klee",
  "sangonomiya_kokomi",
  "diona",
  "xiao",
  "keqing",
] as const;

let input: GuideDraftPortabilityInventoryInput;
let durableReport: GuideDraftPortabilityInventoryReport;
let report: GuideDraftPortabilityInventoryReport;

beforeAll(async () => {
  input = await loadGuideDraftPortabilityInventoryInputFromWorkspace();
  durableReport = JSON.parse(
    await readFile(GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH, "utf8"),
  ) as GuideDraftPortabilityInventoryReport;
  const authentication = authenticateGuideDraftPortabilityInventoryReport(
    durableReport,
    input,
  );
  if (!authentication.authenticated) {
    throw new Error(authentication.message);
  }
  report = authentication.canonicalReport;
});

describe("guide-draft portability inventory", () => {
  it("rebuilds and authenticates one deterministic durable offline inventory", () => {
    expect(stableJson(report)).toBe(stableJson(durableReport));
    expect(stableJson(buildGuideDraftPortabilityInventoryReport(input))).toBe(
      stableJson(report),
    );
    expect(report).toMatchObject({
      schemaVersion: 1,
      reportType: "guide-draft-portability-inventory",
      inventoryId: "six-character-guide-draft-portability-cp59",
      classification:
        "authenticated-durable-surface-portability-gap-inventory",
      validationStatus: "completed-six-character-closed-field-family-audit",
      publicationStatus: "withheld-offline-experimental-inventory",
    });
    expect(formatGuideDraftPortabilityInventorySummary(report)).toBe(
      "Inventoried 6 character surfaces across 198 field-family states; evidence-gate/current-format/selected: 1/0/1.",
    );
    const { reportSha256: _reportSha256, ...withoutHash } = report;
    expect(report.reportSha256).toBe(hashGuideDraftValue(withoutHash));
  });

  it("authenticates the exact nine-path raw-byte closure and six canonical JSON reports", () => {
    expect(GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS).toHaveLength(9);
    expect(new Set(GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS).size).toBe(9);
    expect(input.sourceFiles.map(({ path }) => path).sort(compareText)).toEqual(
      GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS,
    );
    expect(input.generatedFrom.map(({ path }) => path).sort(compareText)).toEqual(
      GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS,
    );
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactPathSet: true,
      byteHashClosure: true,
      canonicalJsonByteObjectParity: true,
      sourceFileCount: 9,
      jsonReportCount: 6,
    });
    for (const sourceFile of input.sourceFiles) {
      const bytes = Buffer.from(sourceFile.bytesBase64, "base64");
      expect(
        input.generatedFrom.find(({ path }) => path === sourceFile.path)?.sha256,
      ).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
  });

  it("records the observed CP58 format blocker without pretending to fresh-authenticate upstream claims", () => {
    expect(report.authorityBoundary).toEqual({
      durableReportBytesAuthenticated: true,
      upstreamFreshAuthenticationPerformedByThisInventory: false,
      upstreamClaimsReauthorized: false,
      selectedSurfaceCompletenessClaimed: false,
      applicabilityIsRecommendation: false,
    });
    expect(report.formatBoundary).toEqual({
      assessedCorePath: GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH,
      assessedCoreSha256:
        "defde895365ae4b4b402f66483a04e3e5536d933abc516492e74acf188ed6ef5",
      assessmentMethod: "reviewed-exact-core-fingerprint",
      reusableClosedFieldTreePolicyPresent: true,
      reusableExactProvenanceHashPolicyPresent: true,
      upstreamAnchorModel: "cp57-envelope-candidate-artifact-profile",
      nonCp57UpstreamAnchorSupported: false,
      zeroLocalRelationPacketSupported: false,
      relationStateDiscriminatorsAreCp57Specific: true,
      portabilityStatus:
        "blocked-pending-generic-anchor-and-readiness-refactor",
    });
    for (const subject of report.subjects) {
      expect(subject.sourceSurface).toMatchObject({
        durableBytesAuthenticated: true,
        upstreamFreshAuthenticationPerformedByThisInventory: false,
      });
    }
  });

  it("closes all six subjects over the same 33 field families without scoring them", () => {
    expect(report.subjects.map(({ characterId }) => characterId)).toEqual(
      EXPECTED_SUBJECTS,
    );
    expect(report.scopeBoundary).toEqual({
      fieldFamilies: GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES,
      fieldFamilyCount: 33,
      energyRecovery: "inventory-boundary-only-deferred-by-user",
      coverageScoreComputed: false,
      subjectRankComputed: false,
      majorityVoteComputed: false,
    });
    for (const subject of report.subjects) {
      expect(subject.fieldStates.map(({ family }) => family)).toEqual(
        GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES,
      );
      expect(new Set(subject.fieldStates.map(({ family }) => family)).size).toBe(
        33,
      );
      expect(subject.reviewAuthorityGap).toEqual({
        gapClass: "review-authority",
        sourceReviewStatus: "unreviewed",
        sourcePermissionStatus: "unknown",
        factoryAuthoredJoinsAreSourceAuthorization: false,
        publicationAuthorized: false,
      });
    }
    expect(report.summary).toEqual({
      subjectCount: 6,
      fieldFamilyCountPerSubject: 33,
      fieldStateCount: 198,
      directSourceObservationRowCount: 23,
      guardedSourceObservationRowCount: 4,
      identifierReferenceOnlyRowCount: 9,
      holdoutLocatorOnlyRowCount: 5,
      guideFactoryCompositionRowCount: 11,
      experimentalFixtureRowCount: 2,
      unreviewedFactoryTranslationRowCount: 1,
      explicitNegativeBoundaryRowCount: 42,
      scopeDeferredRowCount: 6,
      notSerializedRowCount: 106,
      sourceDataGapRowCount: 89,
      formatGapRowCount: 34,
      computationGapRowCount: 109,
      reviewAuthorityGapCount: 6,
      evidenceGateEligibleSubjectCount: 1,
      currentFormatAcceptedSubjectCount: 0,
      selectedTrialSubjectCount: 1,
      guideCount: 0,
      assembledBuildCount: 0,
      recommendationCount: 0,
      rankCount: 0,
      optimizerRunCount: 0,
      damageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
  });

  it("selects only Klee through an exact evidence gate, not a coverage score or character rank", () => {
    const eligible = report.subjects.filter(
      ({ trialGate }) => trialGate.evidenceGatePassed,
    );
    expect(eligible.map(({ characterId }) => characterId)).toEqual(["klee"]);
    expect(eligible[0]?.trialGate).toEqual({
      exactTeamRosterSurface: true,
      subjectScopedRequestSurface: true,
      artifactSetOptionSurface: true,
      allThreeMainStatSlotsSurface: true,
      independentApplicabilityWithoutWholeBuildComposition: true,
      zeroAssembledBuildsAndCandidates: true,
      singleRequestTeamInterpretation: true,
      evidenceGatePassed: true,
      currentGenericPacketFormatAccepted: false,
    });
    const byId = Object.fromEntries(
      report.subjects.map((subject) => [subject.characterId, subject.trialGate]),
    );
    expect(byId.arataki_itto).toMatchObject({
      exactTeamRosterSurface: false,
      subjectScopedRequestSurface: true,
      artifactSetOptionSurface: false,
      zeroAssembledBuildsAndCandidates: true,
      evidenceGatePassed: false,
    });
    expect(byId.sangonomiya_kokomi).toMatchObject({
      exactTeamRosterSurface: true,
      subjectScopedRequestSurface: false,
      artifactSetOptionSurface: true,
      independentApplicabilityWithoutWholeBuildComposition: true,
      zeroAssembledBuildsAndCandidates: true,
      evidenceGatePassed: false,
    });
    expect(byId.diona).toMatchObject({
      exactTeamRosterSurface: true,
      subjectScopedRequestSurface: true,
      artifactSetOptionSurface: true,
      allThreeMainStatSlotsSurface: false,
      independentApplicabilityWithoutWholeBuildComposition: true,
      singleRequestTeamInterpretation: true,
      evidenceGatePassed: false,
    });
    expect(byId.xiao).toMatchObject({
      artifactSetOptionSurface: true,
      zeroAssembledBuildsAndCandidates: false,
      evidenceGatePassed: false,
    });
    expect(byId.keqing).toMatchObject({
      exactTeamRosterSurface: true,
      artifactSetOptionSurface: true,
      allThreeMainStatSlotsSurface: true,
      zeroAssembledBuildsAndCandidates: false,
      evidenceGatePassed: false,
    });
    expect(report.selectedTrial).toEqual({
      characterId: "klee",
      selectionMethod: "exact-boolean-evidence-gate-not-score",
      evidenceGateEligibleCharacterIds: ["klee"],
      selectionIsGuideRecommendation: false,
      selectionIsCharacterRank: false,
      nextRequiredWork: "generalize-upstream-anchor-and-zero-relation-readiness",
    });
    expect(
      report.subjects.filter(
        ({ trialDisposition }) =>
          trialDisposition === "selected-for-next-format-portability-trial",
      ),
    ).toHaveLength(1);
  });

  it("preserves source-specific differences instead of flattening the six surfaces", () => {
    const byId = Object.fromEntries(
      report.subjects.map((subject) => [subject.characterId, subject]),
    );
    expect(field(byId.arataki_itto, "weapon.observed-options")).toMatchObject({
      surfaceKinds: ["identifier-reference-only"],
      gapClasses: ["source-data", "format"],
      gapCodes: ["option-payloads-absent", "identifier-without-payload"],
    });
    expect(
      field(byId.klee, "artifacts.main-stats.sands.observed-options"),
    ).toMatchObject({
      surfaceKinds: ["direct-source-observation"],
      gapClasses: [],
      gapCodes: [],
    });
    expect(field(byId.sangonomiya_kokomi, "artifacts.set-options")).toMatchObject(
      {
        surfaceKinds: ["direct-source-observation", "holdout-locator-only"],
        gapClasses: ["format"],
        gapCodes: ["holdout-locator-without-payload"],
      },
    );
    expect(field(byId.diona, "artifacts.set-options")).toMatchObject({
      surfaceKinds: ["direct-source-observation", "holdout-locator-only"],
      gapClasses: ["format"],
      gapCodes: ["holdout-locator-without-payload"],
    });
    expect(field(byId.diona, "weapon.observed-options")).toMatchObject({
      surfaceKinds: ["holdout-locator-only"],
      gapClasses: ["format"],
      gapCodes: ["holdout-locator-without-payload"],
    });
    expect(field(byId.xiao, "weapon.observed-options")).toMatchObject({
      surfaceKinds: ["direct-source-observation"],
      gapClasses: ["format"],
      gapCodes: ["group-order-is-not-selection"],
    });
    expect(field(byId.keqing, "artifacts.set-options")).toMatchObject({
      surfaceKinds: ["direct-source-observation", "guide-factory-composition"],
      gapClasses: ["format", "computation"],
    });
    expect(field(byId.keqing, "computation.formula-counts")).toMatchObject({
      surfaceKinds: ["unreviewed-factory-translation"],
      gapClasses: ["format", "computation"],
      gapCodes: [
        "unreviewed-factory-translation-not-a-guide-field",
        "formula-counts-not-computed",
      ],
    });
    expect(
      field(byId.keqing, "computation.rotation-and-buff-coverage"),
    ).toMatchObject({
      surfaceKinds: ["not-serialized"],
      gapClasses: ["source-data", "computation"],
      gapCodes: [
        "rotation-coverage-evidence-absent",
        "rotation-coverage-not-computed",
      ],
      evidenceReferenceIds: [],
    });
    expect(field(byId.klee, "weapon.selected")).toMatchObject({
      surfaceKinds: ["explicit-negative-boundary"],
      gapClasses: ["computation"],
      gapCodes: ["selection-not-executed"],
    });
    expect(byId.keqing?.sourceSurface.reportType).toBeNull();
    expect(byId.keqing?.sourceSurface.publicationStatus).toBeNull();
  });

  it("binds every evidence reference to an exact JSON pointer and canonical value hash", () => {
    const sourceByPath = new Map(
      input.sourceFiles.map(({ path, bytesBase64 }) => [
        path,
        Buffer.from(bytesBase64, "base64").toString("utf8"),
      ]),
    );
    for (const subject of report.subjects) {
      const sourceText = sourceByPath.get(subject.sourceSurface.reportPath);
      expect(sourceText).toBeTypeOf("string");
      const sourceReport = JSON.parse(sourceText as string) as unknown;
      const evidenceIds = new Set(
        subject.evidenceReferences.map(({ evidenceId }) => evidenceId),
      );
      for (const evidence of subject.evidenceReferences) {
        const value = resolveGuideDraftJsonPointer(
          sourceReport,
          evidence.jsonPointer,
        );
        expect(evidence.canonicalValueSha256).toBe(hashGuideDraftValue(value));
      }
      for (const state of subject.fieldStates) {
        for (const evidenceId of state.evidenceReferenceIds) {
          expect(evidenceIds.has(evidenceId)).toBe(true);
        }
        if (
          state.surfaceKinds.every(
            (kind) => kind === "not-serialized" || kind === "scope-deferred",
          )
        ) {
          expect(state.evidenceReferenceIds).toEqual([]);
        } else {
          expect(state.evidenceReferenceIds.length).toBeGreaterThan(0);
        }
        expect(new Set(state.surfaceKinds).size).toBe(state.surfaceKinds.length);
        expect(new Set(state.gapClasses).size).toBe(state.gapClasses.length);
        expect(new Set(state.gapCodes).size).toBe(state.gapCodes.length);
      }
    }
  });

  it("retains a closed no-guide, no-rank, no-computation capability boundary with ER deferred", () => {
    expect(report.capabilityBoundary).toEqual({
      supportsPortabilityInventory: true,
      supportsGuideClaims: false,
      supportsPublication: false,
      supportsTeamRecommendationClaims: false,
      supportsEquipmentRecommendationClaims: false,
      supportsStatRecommendationClaims: false,
      supportsRankClaims: false,
      supportsOptimizerClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
    });
    expect(report.summary).toMatchObject({
      guideCount: 0,
      assembledBuildCount: 0,
      recommendationCount: 0,
      rankCount: 0,
      optimizerRunCount: 0,
      damageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(report.scopeBoundary.fieldFamilies).toContain(
      "computation.energy-recharge",
    );
    for (const subject of report.subjects) {
      expect(field(subject, "computation.energy-recharge")).toEqual({
        family: "computation.energy-recharge",
        surfaceKinds: ["scope-deferred"],
        gapClasses: ["computation"],
        gapCodes: ["energy-recharge-deferred-by-scope"],
        evidenceReferenceIds: [],
      });
    }
  });

  it("rejects raw-byte drift even when JSON meaning is unchanged", () => {
    const tampered = cloneInput(input);
    const index = tampered.sourceFiles.findIndex(
      ({ path }) => path === GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.klee,
    );
    const text = Buffer.from(
      tampered.sourceFiles[index]?.bytesBase64 ?? "",
      "base64",
    ).toString("utf8");
    replaceSourceBytes(tampered, index, Buffer.from(`${text}\n`, "utf8"));
    expect(() => buildGuideDraftPortabilityInventoryReport(tampered)).toThrow(
      "is not in canonical checked-in form",
    );
  });

  it("rejects semantic promotion inside a rehashed canonical source surface", () => {
    const tampered = mutateJsonSource(
      input,
      GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.klee,
      (value) => {
        const report = value as {
          positiveWitness: { jointPayloadCompatibilityEstablished: boolean };
        };
        report.positiveWitness.jointPayloadCompatibilityEstablished = true;
      },
    );
    expect(() => buildGuideDraftPortabilityInventoryReport(tampered)).toThrow(
      "Klee compatibility boundary drifted",
    );
  });

  it("rejects rehashed Klee payload, request, team-scope, and applicability drift", () => {
    const mutations: Array<{
      mutate: (value: MutableKleeReport) => void;
      expectedError: string;
    }> = [
      {
        mutate: (value) => {
          value.positiveWitness.claims[2]!.sourceClaim.payload = {
            priority: null,
            slot: "flower",
            statIds: [],
            target: null,
            type: "main-stat",
          };
        },
        expectedError: "Klee sands payload drifted",
      },
      {
        mutate: (value) => {
          value.positiveWitness.claims[3]!.sourceClaim.payload = {
            artifacts: [{ setId: "gladiators_finale", type: "4pc" }],
            type: "artifact-group",
          };
        },
        expectedError: "Klee artifact payload drifted",
      },
      {
        mutate: (value) => {
          value.positiveWitness.claims[0]!.requestProjection.requestContextBindings[0]!.requestPredicate.roleId =
            "off-field-dps";
        },
        expectedError: "Klee circlet request predicate drifted",
      },
      {
        mutate: (value) => {
          value.positiveWitness.claims[0]!.requestProjection.requestContextBindings[0]!.predicateRows[0]!.factScope.teamRecordId =
            "kqm:team:klee-drifted";
        },
        expectedError: "Klee circlet request fact scope drifted",
      },
      {
        mutate: (value) => {
          value.positiveWitness.claims[0]!.requestProjection.contextApplicability =
            "source-already-matched";
        },
        expectedError: "Klee circlet applicability drifted",
      },
      {
        mutate: (value) => {
          value.positiveWitness.team.memberCharacterIds[3] = "bennett";
        },
        expectedError: "Klee exact team roster drifted",
      },
      {
        mutate: (value) => {
          value.recommendationCompositionExecuted = true;
        },
        expectedError: "Klee recommendation-composition boundary drifted",
      },
    ];
    for (const { mutate, expectedError } of mutations) {
      const tampered = mutateJsonSource(
        input,
        GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.klee,
        (value) => mutate(value as MutableKleeReport),
      );
      expect(() => buildGuideDraftPortabilityInventoryReport(tampered)).toThrow(
        expectedError,
      );
    }
  });

  it("rejects rehashed Kokomi and Diona payload/holdout semantic drift", () => {
    const cases: Array<{
      sourcePath: string;
      mutate: (value: MutableSourceSliceReport) => void;
      expectedError: string;
    }> = [
      {
        sourcePath: GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.kokomi,
        mutate: (value) => {
          value.selectedOccurrences[0]!.payload = {
            artifacts: [{ setId: "maiden_beloved", type: "4pc" }],
            type: "artifact-group",
          };
        },
        expectedError: "Kokomi selected artifact payload drifted",
      },
      {
        sourcePath: GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.kokomi,
        mutate: (value) => {
          value.holdoutOccurrences[0]!.payload = { type: "artifact-group" };
        },
        expectedError: "Kokomi holdout 0 unexpectedly serializes a payload",
      },
      {
        sourcePath: GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.diona,
        mutate: (value) => {
          value.selectedOccurrences[0]!.payload = {
            artifacts: [{ setId: "noblesse_oblige", type: "4pc" }],
            type: "artifact-group",
          };
        },
        expectedError: "Diona selected artifact payload drifted",
      },
      {
        sourcePath: GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.diona,
        mutate: (value) => {
          value.holdoutOccurrences[8]!.claimAxis = "artifact-recommendation";
        },
        expectedError: "Diona weapon holdout claim axis drifted",
      },
    ];
    for (const { sourcePath, mutate, expectedError } of cases) {
      const tampered = mutateJsonSource(input, sourcePath, (value) =>
        mutate(value as MutableSourceSliceReport),
      );
      expect(() => buildGuideDraftPortabilityInventoryReport(tampered)).toThrow(
        expectedError,
      );
    }
  });

  it("rejects swapped reports, path-set drift, and a rehashed generic-core change", () => {
    const swapped = cloneInput(input);
    const kleeIndex = sourceIndex(
      swapped,
      GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.klee,
    );
    const kokomiIndex = sourceIndex(
      swapped,
      GUIDE_DRAFT_PORTABILITY_SOURCE_REPORT_PATHS.kokomi,
    );
    const kleeBytes = Buffer.from(
      swapped.sourceFiles[kleeIndex]?.bytesBase64 ?? "",
      "base64",
    );
    const kokomiBytes = Buffer.from(
      swapped.sourceFiles[kokomiIndex]?.bytesBase64 ?? "",
      "base64",
    );
    replaceSourceBytes(swapped, kleeIndex, kokomiBytes);
    replaceSourceBytes(swapped, kokomiIndex, kleeBytes);
    expect(() => buildGuideDraftPortabilityInventoryReport(swapped)).toThrow();

    const missing = cloneInput(input);
    missing.sourceFiles.pop();
    expect(() => buildGuideDraftPortabilityInventoryReport(missing)).toThrow(
      "input path closure drifted",
    );

    const coreTamper = cloneInput(input);
    const coreIndex = sourceIndex(coreTamper, GUIDE_DRAFT_PACKET_CORE_RELATIVE_PATH);
    const coreBytes = Buffer.from(
      coreTamper.sourceFiles[coreIndex]?.bytesBase64 ?? "",
      "base64",
    );
    replaceSourceBytes(
      coreTamper,
      coreIndex,
      Buffer.concat([coreBytes, Buffer.from("\n", "utf8")]),
    );
    expect(() => buildGuideDraftPortabilityInventoryReport(coreTamper)).toThrow(
      "reviewed checkpoint-58 guide-draft packet core fingerprint drifted",
    );
  });

  it("rejects serialized gap, gate, capability, and summary tampering", () => {
    for (const mutate of [
      (value: GuideDraftPortabilityInventoryReport) => {
        value.subjects[0]!.fieldStates[0]!.gapClasses = ["computation"];
      },
      (value: GuideDraftPortabilityInventoryReport) => {
        value.subjects[1]!.trialGate.evidenceGatePassed = false;
      },
      (value: GuideDraftPortabilityInventoryReport) => {
        (value.capabilityBoundary as Record<string, unknown>).supportsGuideClaims =
          true;
      },
      (value: GuideDraftPortabilityInventoryReport) => {
        value.summary.fieldStateCount = 197;
      },
    ]) {
      const tampered = structuredClone(report);
      mutate(tampered);
      const authentication = authenticateGuideDraftPortabilityInventoryReport(
        tampered,
        input,
      );
      expect(authentication).toMatchObject({
        authenticated: false,
        reason: "serialized-report-mismatch",
      });
    }
  });
});

type MutableKleeReport = {
  recommendationCompositionExecuted: boolean;
  positiveWitness: {
    claims: Array<{
      sourceClaim: { payload: unknown };
      requestProjection: {
        contextApplicability: string;
        requestContextBindings: Array<{
          requestPredicate: { roleId: string };
          predicateRows: Array<{
            factScope: { teamRecordId: string };
          }>;
        }>;
      };
    }>;
    team: { memberCharacterIds: string[] };
  };
};

type MutableSourceSliceReport = {
  selectedOccurrences: Array<{ payload: unknown }>;
  holdoutOccurrences: Array<Record<string, unknown>>;
};

function field(
  subject:
    | GuideDraftPortabilityInventoryReport["subjects"][number]
    | undefined,
  family: (typeof GUIDE_DRAFT_PORTABILITY_FIELD_FAMILIES)[number],
) {
  return subject?.fieldStates.find((state) => state.family === family);
}

function cloneInput(
  value: GuideDraftPortabilityInventoryInput,
): {
  sourceFiles: Array<{ path: string; bytesBase64: string }>;
  generatedFrom: Array<{ path: string; sha256: string }>;
} {
  return {
    sourceFiles: value.sourceFiles.map((sourceFile) => ({ ...sourceFile })),
    generatedFrom: value.generatedFrom.map((entry) => ({ ...entry })),
  };
}

function mutateJsonSource(
  value: GuideDraftPortabilityInventoryInput,
  sourcePath: string,
  mutate: (value: unknown) => void,
): GuideDraftPortabilityInventoryInput {
  const cloned = cloneInput(value);
  const index = sourceIndex(cloned, sourcePath);
  const parsed = JSON.parse(
    Buffer.from(cloned.sourceFiles[index]?.bytesBase64 ?? "", "base64").toString(
      "utf8",
    ),
  ) as unknown;
  mutate(parsed);
  replaceSourceBytes(cloned, index, Buffer.from(stableJson(parsed), "utf8"));
  return cloned;
}

function sourceIndex(
  value: GuideDraftPortabilityInventoryInput,
  sourcePath: string,
): number {
  const index = value.sourceFiles.findIndex(({ path }) => path === sourcePath);
  if (index < 0) throw new Error(`Missing test source ${sourcePath}.`);
  return index;
}

function replaceSourceBytes(
  value: {
    sourceFiles: Array<{ path: string; bytesBase64: string }>;
    generatedFrom: Array<{ path: string; sha256: string }>;
  },
  sourceIndexValue: number,
  bytes: Buffer,
): void {
  const sourceFile = value.sourceFiles[sourceIndexValue];
  if (!sourceFile) throw new Error("Missing test source file.");
  sourceFile.bytesBase64 = bytes.toString("base64");
  const generated = value.generatedFrom.find(({ path }) => path === sourceFile.path);
  if (!generated) throw new Error("Missing test generated-from entry.");
  generated.sha256 = createHash("sha256").update(bytes).digest("hex");
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
