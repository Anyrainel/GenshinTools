import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ReplayComboLine } from "../src/computationReplay";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  authenticateXiaoFfxxUnitExpandedExecutionGate,
  buildXiaoFfxxUnitExpandedExecutionGateReport,
  expandXiaoFfxxCountedPlan,
  requireAuthenticatedXiaoFfxxUnitExpandedExecutionGate,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS,
  XIAO_FFXX_UNIT_EXPANSION_MAX_LINES,
  type BuildXiaoFfxxUnitExpandedExecutionGateInput,
  type XiaoFfxxUnitExpandedExecutionGateReport,
} from "../src/xiaoFfxxUnitExpandedExecutionGate";
import {
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
  type XiaoFfxxGroupedReplayRepresentationPreflightReport,
} from "../src/xiaoFfxxGroupedReplayRepresentationPreflight";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const XIAO_MANUAL_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_ROTATION_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";
const GENSHINTOOLS_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_SOURCE_LOCAL_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-source-local-condition-slice.json";
const APPLICABLE_CLAIM_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-applicable-claim-projection-contract.json";
const PARTIAL_CANDIDATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-partial-artifact-candidate-contract.json";
const BRANCH_SOURCE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-non-er-equipment-branch-source-slice.json";
const BRANCH_CANDIDATE_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-non-er-condition-free-branch-candidate-contract.json";
const FORMULA_COUNT_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-formula-count-parity.json";
const GROUPED_REPLAY_REPORT_PATH =
  "scripts/guide-factory/reports/xiao-ffxx-grouped-replay-representation-preflight.json";
const CHARACTER_BETA_STATS_PATH =
  "src/data/game/character_beta_stats.json.gz";
const WEAPON_BETA_STATS_PATH = "src/data/game/weapon_beta_stats.json.gz";

const WEAPONS = [
  "calamity_queller",
  "deathmatch",
  "lumidouce_elegy",
  "primordial_jade_wingedspear",
  "staff_of_homa",
  "vortex_vanquisher",
] as const;

const JSON_INPUTS = [
  ["repositoryInput", REPOSITORY_PATH],
  ["xiaoManualSnapshotInput", XIAO_MANUAL_PATH],
  ["xiaoRotationFixtureSnapshotInput", XIAO_ROTATION_PATH],
  ["genshinToolsSnapshotInput", GENSHINTOOLS_SNAPSHOT_PATH],
  ["manualIndexInput", MANUAL_INDEX_PATH],
  ["sourceRegistryInput", SOURCE_REGISTRY_PATH],
  ["xiaoSourceLocalDurableReportInput", XIAO_SOURCE_LOCAL_REPORT_PATH],
  ["applicableClaimDurableReportInput", APPLICABLE_CLAIM_REPORT_PATH],
  ["partialCandidateDurableReportInput", PARTIAL_CANDIDATE_REPORT_PATH],
  ["branchSourceDurableReportInput", BRANCH_SOURCE_REPORT_PATH],
  ["branchCandidateDurableReportInput", BRANCH_CANDIDATE_REPORT_PATH],
  ["formulaCountDurableReportInput", FORMULA_COUNT_REPORT_PATH],
  ["groupedReplayDurableReportInput", GROUPED_REPLAY_REPORT_PATH],
] as const satisfies ReadonlyArray<
  readonly [
    keyof Omit<
      BuildXiaoFfxxUnitExpandedExecutionGateInput,
      "sourceFiles" | "generatedFrom"
    >,
    string,
  ]
>;

let baseInput: BuildXiaoFfxxUnitExpandedExecutionGateInput;
let durableReport: XiaoFfxxUnitExpandedExecutionGateReport;
let canonicalReport: XiaoFfxxUnitExpandedExecutionGateReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH,
    ) as Promise<XiaoFfxxUnitExpandedExecutionGateReport>,
  ]);
  canonicalReport =
    await buildXiaoFfxxUnitExpandedExecutionGateReport(fixture());
}, 60_000);

describe("Xiao FFXX unit-expanded execution gate", () => {
  it("rebuilds deterministically and authenticates the exact 121-byte/13-JSON closure", async () => {
    expect(stableJson(canonicalReport)).toBe(stableJson(durableReport));
    expect(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS).toHaveLength(121);
    expect(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS).toEqual(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
    );
    expect(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS).toEqual(
      [...XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS].sort(),
    );
    expect(
      new Set(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS).size,
    ).toBe(121);
    expect(JSON_INPUTS).toHaveLength(13);
    expect(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS.every(
        (sourcePath) =>
          XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.includes(
            sourcePath,
          ),
      ),
    ).toBe(true);
    expect(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.filter(
        (sourcePath) =>
          !XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS.includes(
            sourcePath,
          ),
      ),
    ).toEqual([
      GROUPED_REPLAY_REPORT_PATH,
      "scripts/guide-factory/src/assemble-xiao-ffxx-unit-expanded-execution-gate.ts",
      "scripts/guide-factory/src/xiaoFfxxUnitExpandedExecutionGate.ts",
    ]);
    expect(canonicalReport.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      sourceFileCount: 121,
      generatedFromCount: 121,
      authenticatedJsonInputParityCount: 13,
    });

    const hashByPath = new Map(
      baseInput.generatedFrom.map(({ path: sourcePath, sha256 }) => [
        sourcePath,
        sha256,
      ]),
    );
    for (const sourceFile of baseInput.sourceFiles) {
      expect(
        sha256Bytes(Buffer.from(sourceFile.bytesBase64, "base64")),
        sourceFile.path,
      ).toBe(hashByPath.get(sourceFile.path));
    }
    expect(
      await authenticateXiaoFfxxUnitExpandedExecutionGate(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    await expect(
      requireAuthenticatedXiaoFfxxUnitExpandedExecutionGate(
        durableReport,
        fixture(),
      ),
    ).resolves.toBeUndefined();
  }, 60_000);

  it("expands the two counted lines contiguously and exactly equals the authenticated unit plan", () => {
    const groupedPlan = canonicalReport.normalizationBoundary.groupedPlan;
    const expansion = expandXiaoFfxxCountedPlan(groupedPlan);

    expect(XIAO_FFXX_UNIT_EXPANSION_MAX_LINES).toBe(13);
    expect(expansion).toMatchObject({
      inputLineCount: 2,
      inputOccurrenceCount: 13,
      normalizedLineCount: 13,
      inputLineMappings: [
        {
          inputLineIndex: 0,
          inputCount: 2,
          normalizedStartIndex: 0,
          normalizedEndIndexExclusive: 2,
        },
        {
          inputLineIndex: 1,
          inputCount: 11,
          normalizedStartIndex: 2,
          normalizedEndIndexExclusive: 13,
        },
      ],
    });
    expect(stableJson(expansion.lines)).toBe(
      stableJson(canonicalReport.normalizationBoundary.normalizedPlan),
    );
    expect(canonicalReport.normalizationBoundary).toMatchObject({
      policyId: "xiao-contiguous-unit-expansion-v1",
      policyScope: "xiao-ffxx-checkpoint-47-counted-plan-only",
      genericNormalizationSafetyClaim: false,
      normalizationAuthoredBy: "guide-factory-checkpoint-48-wrapper",
      formulaIdAndCountOwnership:
        "guide-factory-checkpoint-42-calculator-default",
      lineOrderAndExecutionFlagOwnership:
        "guide-factory-checkpoint-47-wrapper",
      positiveSafeIntegerCountsRequired: true,
      maximumExpandedLineCount: 13,
      contiguousInputLineOrderPreserved: true,
      reactionAndForceOnFieldPreserved: true,
      exactStableEqualityToUpstreamUnitPlan: true,
      formulaBuffOverridesRequiredNull: true,
      inputLineCount: 2,
      inputOccurrenceCount: 13,
      normalizedLineCount: 13,
      gameplayOrderValidated: false,
      buffTimingValidated: false,
    });
    expect(canonicalReport.identityBoundary.normalizationPolicySha256).toBe(
      sha256Value({
        policyId: "xiao-contiguous-unit-expansion-v1",
        policyScope: "xiao-ffxx-checkpoint-47-counted-plan-only",
        genericNormalizationSafetyClaim: false,
        normalizationAuthoredBy: "guide-factory-checkpoint-48-wrapper",
        formulaIdAndCountOwnership:
          "guide-factory-checkpoint-42-calculator-default",
        lineOrderAndExecutionFlagOwnership:
          "guide-factory-checkpoint-47-wrapper",
        positiveSafeIntegerCountsRequired: true,
        maximumExpandedLineCount: 13,
        contiguousInputLineOrderPreserved: true,
        reactionAndForceOnFieldPreserved: true,
        exactStableEqualityToUpstreamUnitPlan: true,
        formulaBuffOverridesRequiredNull: true,
        inputLineCount: 2,
        inputOccurrenceCount: 13,
        normalizedLineCount: 13,
        inputLineMappings: expansion.inputLineMappings,
      }),
    );

    const reaction = {
      reaction: "vaporize" as const,
      rxnParts: { 0: "none" as const },
      rxnPartHits: { 0: 1 },
    };
    const cloned = expandXiaoFfxxCountedPlan([
      {
        charId: "xiao",
        formulaId: "synthetic-reaction-preservation-probe",
        count: 2,
        reaction,
        forceOnField: false,
      },
    ]);
    expect(cloned.lines).toEqual([
      {
        charId: "xiao",
        formulaId: "synthetic-reaction-preservation-probe",
        count: 1,
        reaction,
        forceOnField: false,
      },
      {
        charId: "xiao",
        formulaId: "synthetic-reaction-preservation-probe",
        count: 1,
        reaction,
        forceOnField: false,
      },
    ]);
    expect(cloned.lines[0].reaction).not.toBe(reaction);
    expect(cloned.lines[0].reaction).not.toBe(cloned.lines[1].reaction);
  });

  it("rejects empty, invalid, fractional, zero, unsafe, and over-cap counted plans", () => {
    const validLine: ReplayComboLine = {
      charId: "xiao",
      formulaId: "xiao-skill",
      count: 1,
      reaction: null,
      forceOnField: true,
    };
    expect(() => expandXiaoFfxxCountedPlan([])).toThrow("cannot be empty");
    for (const count of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        expandXiaoFfxxCountedPlan([{ ...validLine, count }]),
      ).toThrow("positive safe integer");
    }
    expect(() =>
      expandXiaoFfxxCountedPlan([
        { ...validLine, count: 7 },
        { ...validLine, formulaId: "xiao-plunge-high", count: 7 },
      ]),
    ).toThrow("13-line expansion cap");
    expect(() =>
      expandXiaoFfxxCountedPlan([{ ...validLine, charId: "" }]),
    ).toThrow("requires character and formula IDs");
    expect(() =>
      expandXiaoFfxxCountedPlan([{ ...validLine, formulaId: "" }]),
    ).toThrow("requires character and formula IDs");
    expect(() =>
      expandXiaoFfxxCountedPlan([
        {
          ...validLine,
          forceOnField: "yes" as unknown as boolean,
        },
      ]),
    ).toThrow("explicit forceOnField boolean");
  });

  it("fresh-authenticates checkpoint 47 and names every inherited versus additional operation count", () => {
    expect(canonicalReport.upstreamBoundary).toEqual({
      durableReportPath: GROUPED_REPLAY_REPORT_PATH,
      durableReportFileSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      durableReportCanonicalObjectSha256: expect.stringMatching(
        /^[a-f0-9]{64}$/,
      ),
      freshlyAuthenticated: true,
      upstreamInputCount: 118,
      groupedReplayAttemptCount: 6,
      groupedRawDualPathCaptureCount: 6,
      unitExpandedAcceptedReplayCount: 6,
      rejectedArtifactSheetProbeCount: 1,
      checkpoint48AdditionalReplayCount: 0,
    });
    expect(
      canonicalReport.observations.every(
        ({ normalizedExecution }) =>
          normalizedExecution.evidenceOrigin ===
            "fresh-authenticated-checkpoint-47-canonical-rebuild" &&
          !normalizedExecution.checkpoint48AdditionalReplayExecuted,
      ),
    ).toBe(true);
  });

  it("projects six eligible technical-ID-ordered observations with exact upstream invariants", () => {
    const upstream =
      baseInput.groupedReplayDurableReportInput as XiaoFfxxGroupedReplayRepresentationPreflightReport;
    const upstreamByCandidateId = new Map(
      upstream.observations.map((observation) => [
        observation.candidateId,
        observation,
      ]),
    );

    expect(canonicalReport.observations.map(({ weaponId }) => weaponId)).toEqual(
      WEAPONS,
    );
    expect(
      canonicalReport.observations.map(({ candidateId }) => candidateId),
    ).toEqual(
      canonicalReport.observations
        .map(({ candidateId }) => candidateId)
        .sort(),
    );
    expect(canonicalReport.observations.map(({ refinement }) => refinement)).toEqual(
      [1, 5, 1, 1, 1, 1],
    );
    for (const observation of canonicalReport.observations) {
      const upstreamObservation = upstreamByCandidateId.get(
        observation.candidateId,
      );
      expect(upstreamObservation).toBeDefined();
      expect(observation).toMatchObject({
        candidateIdentitySha256: upstreamObservation?.candidateIdentitySha256,
        weaponId: upstreamObservation?.weaponId,
        refinement: upstreamObservation?.refinement,
        executedViewId: "source-only-ffxx",
        technicalObservationEligible: true,
        comparisonEligible: false,
        factoryRank: null,
        winner: false,
        recommendation: false,
        normalizedExecution: {
          groupedInterpretedReferenceTotalDamage:
            upstreamObservation?.groupedReplay.directTotalDamage,
          unitExpandedDirectTotalDamage:
            upstreamObservation?.unitExpandedReplay.directTotalDamage,
          unitExpandedCompiledTotalDamage:
            upstreamObservation?.unitExpandedReplay.compiledTotalDamage,
          allowedDifference:
            upstreamObservation?.unitExpandedReplay.allowedDifference,
          dualPathAgreement: true,
          groupedDirectUnitExpandedDirectAgreement: true,
        },
        activationEvidence: {
          buffKey:
            upstreamObservation?.unitExpandedReplay
              .xianyunStackLimitedBuffKey,
          perPlungeOccurrence: [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
          totalActivation: 8,
          exactExpectedSequence: true,
        },
      });
      expect(observation.normalizedExecution.absoluteDifference).toBeLessThanOrEqual(
        observation.normalizedExecution.allowedDifference,
      );
      expect(observation.normalizedExecution.absoluteDifference).toBe(
        normalizedNumber(
          Math.abs(
            observation.normalizedExecution.unitExpandedDirectTotalDamage -
              observation.normalizedExecution
                .unitExpandedCompiledTotalDamage,
          ),
        ),
      );
      expect(
        observation.normalizedExecution
          .groupedDirectMinusUnitExpandedDirect,
      ).toBe(
        normalizedNumber(
          observation.normalizedExecution
            .groupedInterpretedReferenceTotalDamage -
            observation.normalizedExecution.unitExpandedDirectTotalDamage,
        ),
      );
      expect(
        Math.abs(
          observation.normalizedExecution
            .groupedDirectMinusUnitExpandedDirect,
        ),
      ).toBeLessThanOrEqual(1e-9);
      expect(observation.observationSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("keeps three source groups and six edges outside technical observation identity", () => {
    expect(canonicalReport.provenanceOnly).toMatchObject({
      sourceGroupCount: 3,
      candidateEdgeCount: 6,
      sourceRanksExcludedFromExecutionIdentity: true,
      sourceGroupsExcludedFromTechnicalObservationIdentity: true,
    });
    expect(
      canonicalReport.provenanceOnly.groups.map(
        ({ sourceRankGroup, sourceOrdering, membersTied, candidateIds }) => ({
          sourceRankGroup,
          sourceOrdering,
          membersTied,
          candidateCount: candidateIds.length,
        }),
      ),
    ).toEqual([
      {
        sourceRankGroup: 1,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        candidateCount: 3,
      },
      {
        sourceRankGroup: 2,
        sourceOrdering: "ranked-groups",
        membersTied: true,
        candidateCount: 2,
      },
      {
        sourceRankGroup: null,
        sourceOrdering: "unranked",
        membersTied: false,
        candidateCount: 1,
      },
    ]);
    expect(canonicalReport.provenanceOnly.candidateEdges).toHaveLength(6);
    expect(
      canonicalReport.provenanceOnly.candidateEdges.every(
        ({ provenanceOnly }) => provenanceOnly,
      ),
    ).toBe(true);
    expect(stableJson(canonicalReport.observations)).not.toContain(
      "sourceRankGroup",
    );
    expect(stableJson(canonicalReport.observations)).not.toContain(
      "branchGroupId",
    );
    expect(canonicalReport.identityBoundary).toMatchObject({
      sourceRankExcludedFromExecutionIdentity: true,
      excludedRequestViewFactsExcludedFromExecutionIdentity: true,
    });
    expect(canonicalReport.identityBoundary.executionGateSha256).toBe(
      sha256Value({
        upstreamFixtureSha256: (
          baseInput.groupedReplayDurableReportInput as XiaoFfxxGroupedReplayRepresentationPreflightReport
        ).identityBoundary.fixtureSha256,
        groupedPlanSha256:
          canonicalReport.identityBoundary.groupedPlanSha256,
        normalizedPlanSha256:
          canonicalReport.identityBoundary.normalizedPlanSha256,
        normalizationPolicySha256:
          canonicalReport.identityBoundary.normalizationPolicySha256,
        technicalObservationSetSha256:
          canonicalReport.identityBoundary.technicalObservationSetSha256,
      }),
    );
    expect(canonicalReport.identityBoundary.aggregateGateSha256).toBe(
      sha256Value({
        executionGateSha256:
          canonicalReport.identityBoundary.executionGateSha256,
        provenanceOnlySha256:
          canonicalReport.identityBoundary.provenanceOnlySha256,
      }),
    );
  });

  it("performs normalization only and withholds comparison, rank, recommendation, damage, rotation, and ER capabilities", () => {
    expect(canonicalReport).toMatchObject({
      validationStatus: "accepted",
      comparisonExecutionStatus: "not-performed",
      publicationStatus: "withheld-unreviewed-fixture-and-order",
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsBuildRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsWinnerClaims: false,
      supportsDamageClaims: false,
      supportsDamageComparisonClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      normalizationExecuted: true,
      technicalObservationProjectionExecuted: true,
      comparisonExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      recommendationCompositionExecuted: false,
      idealRollAllocationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        candidateCount: 6,
        technicalObservationEligibleCount: 6,
        comparisonCount: 0,
        rankedCandidateCount: 0,
        winnerCount: 0,
        recommendationCount: 0,
        completeBuildCount: 0,
        energyRecoveryComputationCount: 0,
      },
      issues: [],
    });
  });

  it("rejects missing, duplicate, parity-mismatched, and binary-tampered authenticated inputs", async () => {
    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(1);
    await expectRejectedInput(missing, "source-file path closure drifted");

    const duplicate = fixture();
    duplicate.generatedFrom = [
      ...duplicate.generatedFrom,
      duplicate.generatedFrom[0],
    ];
    await expectRejectedInput(duplicate, "generatedFrom path closure drifted");

    const parityMismatch = fixture();
    const parsedUpstream = structuredClone(
      parityMismatch.groupedReplayDurableReportInput,
    ) as XiaoFfxxGroupedReplayRepresentationPreflightReport;
    Reflect.set(parsedUpstream.summary, "winnerCount", 1);
    parityMismatch.groupedReplayDurableReportInput = parsedUpstream;
    await expectRejectedInput(parityMismatch, "parsed input disagrees with bytes");

    for (const binaryPath of [
      CHARACTER_BETA_STATS_PATH,
      WEAPON_BETA_STATS_PATH,
    ]) {
      const tampered = fixture();
      tampered.sourceFiles = tampered.sourceFiles.map((entry) => {
        if (entry.path !== binaryPath) return entry;
        const bytes = Buffer.from(entry.bytesBase64, "base64");
        bytes[Math.max(0, bytes.length - 1)] ^= 0xff;
        return { ...entry, bytesBase64: bytes.toString("base64") };
      });
      await expectRejectedInput(tampered, binaryPath);
    }
  }, 60_000);

  it("rejects a parity-valid forged checkpoint-47 report through fresh upstream authentication", async () => {
    const forged = fixture();
    const upstream = structuredClone(
      forged.groupedReplayDurableReportInput,
    ) as XiaoFfxxGroupedReplayRepresentationPreflightReport;
    Reflect.set(upstream.summary, "winnerCount", 1);
    replaceJsonInput(
      forged,
      "groupedReplayDurableReportInput",
      GROUPED_REPLAY_REPORT_PATH,
      upstream,
    );
    await expectRejectedInput(forged, "Checkpoint-47");
  }, 60_000);

  it("rejects serialized gate tampering", async () => {
    const forged = structuredClone(durableReport);
    Reflect.set(forged.summary, "comparisonCount", 1);
    expect(
      await authenticateXiaoFfxxUnitExpandedExecutionGate(forged, fixture()),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  }, 60_000);
});

async function loadFixture(): Promise<BuildXiaoFfxxUnitExpandedExecutionGateInput> {
  const parsedEntries = await Promise.all(
    JSON_INPUTS.map(async ([key, relativePath]) => [
      key,
      await readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ]),
  );
  const [sourceFiles, generatedFrom] = await Promise.all([
    Promise.all(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    ...(Object.fromEntries(parsedEntries) as Omit<
      BuildXiaoFfxxUnitExpandedExecutionGateInput,
      "sourceFiles" | "generatedFrom"
    >),
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxUnitExpandedExecutionGateInput {
  return structuredClone(baseInput);
}

async function expectRejectedInput(
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
  expectedMessage: string,
): Promise<void> {
  const authentication = await authenticateXiaoFfxxUnitExpandedExecutionGate(
    durableReport,
    input,
  );
  expect(authentication).toMatchObject({
    authenticated: false,
    reason: "canonical-inputs-rejected",
  });
  if (authentication.authenticated) {
    throw new Error("Expected rejected unit-expanded execution-gate input.");
  }
  expect(authentication.issues.map(({ message }) => message).join(" ")).toContain(
    expectedMessage,
  );
}

function replaceJsonInput(
  input: BuildXiaoFfxxUnitExpandedExecutionGateInput,
  key: "groupedReplayDurableReportInput",
  relativePath: string,
  value: unknown,
): void {
  const text = stableJson(value);
  input[key] = value;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === relativePath
      ? { ...entry, bytesBase64: Buffer.from(text).toString("base64") }
      : entry,
  );
  input.generatedFrom = input.generatedFrom.map((entry) =>
    entry.path === relativePath
      ? { ...entry, sha256: sha256Text(text) }
      : entry,
  );
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Value(value: unknown): string {
  return sha256Text(stableJson(value));
}

function normalizedNumber(value: number): number {
  if (Object.is(value, -0)) return 0;
  return Number(value.toPrecision(15));
}
