import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import { REPOSITORY_ROOT } from "../src/paths";
import {
  authenticateXiaoFfxxGroupedReplayRepresentationPreflight,
  buildXiaoFfxxGroupedReplayRepresentationPreflightReport,
  requireAuthenticatedXiaoFfxxGroupedReplayRepresentationPreflight,
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH,
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_SOURCE_FILE_PATHS,
  XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS,
  type BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  type XiaoFfxxGroupedReplayRepresentationPreflightReport,
} from "../src/xiaoFfxxGroupedReplayRepresentationPreflight";
import type { XiaoFfxxNonErConditionFreeBranchCandidateContractReport } from "../src/xiaoFfxxNonErConditionFreeBranchCandidateContract";
import type { XiaoFormulaCountParityReport } from "../src/xiaoFormulaCountParity";

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
] as const satisfies ReadonlyArray<
  readonly [
    keyof Omit<
      BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
      "sourceFiles" | "generatedFrom"
    >,
    string,
  ]
>;

let baseInput: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput;
let durableReport: XiaoFfxxGroupedReplayRepresentationPreflightReport;
let canonicalReport: XiaoFfxxGroupedReplayRepresentationPreflightReport;

beforeAll(async () => {
  [baseInput, durableReport] = await Promise.all([
    loadFixture(),
    readJson(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH,
    ) as Promise<XiaoFfxxGroupedReplayRepresentationPreflightReport>,
  ]);
  canonicalReport =
    await buildXiaoFfxxGroupedReplayRepresentationPreflightReport(fixture());
}, 60_000);

describe("Xiao FFXX grouped replay representation preflight", () => {
  it("rebuilds deterministically and authenticates the durable 118-file raw-byte/12-JSON closure", async () => {
    const rebuilt =
      await buildXiaoFfxxGroupedReplayRepresentationPreflightReport(fixture());

    expect(stableJson(rebuilt)).toBe(stableJson(canonicalReport));
    expect(stableJson(canonicalReport)).toBe(stableJson(durableReport));
    expect(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    ).toHaveLength(118);
    expect(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_SOURCE_FILE_PATHS,
    ).toEqual(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    );
    expect(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    ).toEqual(
      [
        ...XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
      ].sort(),
    );
    expect(
      new Set(
        XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
      ).size,
    ).toBe(118);
    expect(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    ).toEqual(
      expect.arrayContaining([
        CHARACTER_BETA_STATS_PATH,
        WEAPON_BETA_STATS_PATH,
        "src/lib/dmgcalc/impl/weapon4Polearm.ts",
        "src/lib/dmgcalc/impl/weapon5Polearm.ts",
      ]),
    );
    expect(canonicalReport.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allDeclaredGeneratedFromHashesAuthenticatedFromBytes: true,
      combinedJsonInputByteAndParsedObjectParity: true,
      staticFirstPartyReplayRuntimePathClosure: true,
      staticFirstPartyReplayRuntimeFileCount: 80,
      runtimeGlobDiscoveryUsed: false,
      sourceFileCount: 118,
      generatedFromCount: 118,
      authenticatedJsonInputParityCount: 12,
      directDurableReportJsonInputCount: 2,
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
      canonicalReport.generatedFrom.every(({ sha256 }) =>
        /^[a-f0-9]{64}$/.test(sha256),
      ),
    ).toBe(true);

    expect(
      await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
        durableReport,
        fixture(),
      ),
    ).toMatchObject({ authenticated: true });
    await expect(
      requireAuthenticatedXiaoFfxxGroupedReplayRepresentationPreflight(
        durableReport,
        fixture(),
      ),
    ).resolves.toBeUndefined();
  }, 60_000);

  it("contains every local static value import reached by the declared replay runtime and checkpoint implementation", async () => {
    expect(XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS).toHaveLength(80);
    const allDeclaredPaths: Set<string> = new Set(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS,
    );
    const runtimePaths: Set<string> = new Set(
      XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS,
    );
    const implementationPaths = [
      "scripts/guide-factory/src/xiaoFfxxGroupedReplayRepresentationPreflight.ts",
      "scripts/guide-factory/src/assemble-xiao-ffxx-grouped-replay-representation-preflight.ts",
    ];
    const importCache = new Map<string, string[]>();
    const importsFor = async (sourcePath: string): Promise<string[]> => {
      const cached = importCache.get(sourcePath);
      if (cached) return cached;
      if (!/\.tsx?$/.test(sourcePath)) return [];

      const sourceText = await readFile(
        path.join(REPOSITORY_ROOT, sourcePath),
        "utf8",
      );
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
      );
      const imports = runtimeStaticModuleSpecifiers(sourceFile).flatMap(
        (moduleSpecifier) => {
          const resolved = resolveFirstPartyModulePath(
            sourcePath,
            moduleSpecifier,
          );
          return resolved ? [resolved] : [];
        },
      );
      importCache.set(sourcePath, imports);
      return imports;
    };

    const missingRuntimeImports: string[] = [];
    for (const sourcePath of runtimePaths) {
      for (const resolved of await importsFor(sourcePath)) {
        if (!runtimePaths.has(resolved)) {
          missingRuntimeImports.push(`${sourcePath} -> ${resolved}`);
        }
      }
    }
    expect(missingRuntimeImports).toEqual([]);

    const missingImplementationImports: string[] = [];
    for (const sourcePath of implementationPaths) {
      for (const resolved of await importsFor(sourcePath)) {
        if (!allDeclaredPaths.has(resolved)) {
          missingImplementationImports.push(`${sourcePath} -> ${resolved}`);
        }
      }
    }
    expect(missingImplementationImports).toEqual([]);

    const runtimeRoots = new Set<string>([
      "scripts/guide-factory/src/computationReplay.ts",
    ]);
    for (const resolved of await importsFor(implementationPaths[0])) {
      if (runtimePaths.has(resolved)) runtimeRoots.add(resolved);
    }
    const reachable = new Set<string>();
    const queue = [...runtimeRoots];
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      if (!sourcePath || reachable.has(sourcePath)) continue;
      reachable.add(sourcePath);
      for (const resolved of await importsFor(sourcePath)) {
        if (runtimePaths.has(resolved) && !reachable.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
    expect([...reachable].sort()).toEqual([...runtimePaths].sort());
  });

  it("fresh-authenticates CP46 and async CP42 before evaluating their exact six-candidate/2-versus-11 boundary", () => {
    expect(canonicalReport.branchCandidateUpstreamBoundary).toMatchObject({
      status: "accepted",
      durableReportPath: BRANCH_CANDIDATE_REPORT_PATH,
      freshlyAuthenticated: true,
      upstreamInputCount: 27,
      candidateCount: 6,
    });
    expect(canonicalReport.formulaCountUpstreamBoundary).toMatchObject({
      status: "accepted",
      durableReportPath: FORMULA_COUNT_REPORT_PATH,
      freshlyAuthenticated: true,
      upstreamInputCount: 36,
      calculatorDefaultSkillCount: 2,
      calculatorDefaultHighPlungeCount: 11,
      sourceTranslatedSkillCount: 2,
      sourceTranslatedHighPlungeCount: 12,
    });
    for (const boundary of [
      canonicalReport.branchCandidateUpstreamBoundary,
      canonicalReport.formulaCountUpstreamBoundary,
    ]) {
      expect(boundary.durableReportFileSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(boundary.durableReportCanonicalObjectSha256).toMatch(
        /^[a-f0-9]{64}$/,
      );
    }
  });

  it("pins the wrapper-authored C0 fixture, refinements, artifact sheet, and source-only view", () => {
    expect(canonicalReport.executionScope).toEqual({
      sourceRosterTeamRecordId:
        "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5",
      calculatorFixtureTeamRecordId:
        "genshintools-presets:team:CX03obKWOJgK51-fWO",
      crossRecordConfigurationJoinAuthoredBy: "guide-factory",
      exactRosterEqualityRequired: true,
      executedViewId: "source-only-ffxx",
      executedViewRequestFactCount: 0,
      excludedViewIds: ["exact-ffxx-plus-wrapper-c6"],
      excludedViewCount: 1,
      excludedC6ViewAffectedConfiguration: false,
      excludedC6ViewAffectedCandidateIdentity: false,
      excludedC6ViewExecuted: false,
      candidateCount: 6,
      completeBuildCount: 0,
    });
    expect(canonicalReport.fixtureBoundary).toMatchObject({
      authoredBy: "guide-factory",
      sourceAuthoredWholeFixture: false,
      fixedMainStatValuesPurpose:
        "guide-factory-wrapper-runtime-materialization",
      sourceSuppliedNumericArtifactStats: false,
      characterLevel: 90,
      constellation: 0,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
      fiveStarRefinement: 1,
      deathmatchRefinement: 5,
      supporterEquipmentPurpose: "checkpoint-42-calculator-runnability-only",
      xiaoArtifactSetId: "marechaussee_hunter",
      teammateArtifactSheetsEmpty: true,
      missingCircletPreserved: true,
      missingSubstatsPreserved: true,
      xiaoArtifactSheetEnergyRechargePresent: false,
      betaDataEnabled: false,
      betaEnvironmentOverrideEnabled: false,
      combatOptions: {
        deathmatch: "gte2",
        furina: "300",
        staff_of_homa: "below50",
        xianyun: "4",
        xiao: "3",
      },
      enemyAura: null,
      extraBuffCount: 0,
      reactionOverrideCount: 0,
      formulaBuffOverrideCount: 0,
      calcContext: {
        enemyLevel: 110,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
    });
    expect(canonicalReport.fixtureBoundary.xiaoArtifactSheet).toEqual([
      { key: "atk", filterKey: "", value: 311 },
      { key: "atk%", filterKey: "", value: 0.466 },
      { key: "dmg%", filterKey: "e:Anemo", value: 0.466 },
      { key: "hp", filterKey: "", value: 4780 },
    ]);
    expect(canonicalReport.fixtureBoundary.xiaoArtifactSheet).not.toContainEqual(
      expect.objectContaining({ key: "er" }),
    );
    expect(
      canonicalReport.fixtureBoundary.rejectedArtifactSheetVariant,
    ).toMatchObject({
      variantId: "omit-universal-flower-plume-main-stats",
      disposition: "rejected-pinned-witness-not-reproduced",
      probeWeaponId: "primordial_jade_wingedspear",
      variantReplayExecuted: true,
      fullCandidateDomainEvaluationExecuted: false,
    });
    expect(
      canonicalReport.fixtureBoundary.rejectedArtifactSheetVariant
        .pinnedGroupedDirectTotalDamage,
    ).toBe(
      canonicalReport.observations.find(
        ({ weaponId }) => weaponId === "primordial_jade_wingedspear",
      )?.groupedReplay.directTotalDamage,
    );
    expect(
      canonicalReport.fixtureBoundary.rejectedArtifactSheetVariant
        .observedGroupedDirectTotalDamage,
    ).toBeCloseTo(360260.1214841301, 6);
    expect(
      canonicalReport.fixtureBoundary.rejectedArtifactSheetVariant
        .absoluteDifference,
    ).toBeGreaterThan(0);
  });

  it("executes only the calculator-default grouped and unit-expanded 2E/11HP representations while withholding source 12HP", () => {
    expect(canonicalReport.formulaPlanBoundary.groupedPlan).toEqual([
      {
        charId: "xiao",
        formulaId: "xiao-skill",
        count: 2,
        reaction: null,
        forceOnField: true,
      },
      {
        charId: "xiao",
        formulaId: "xiao-plunge-high",
        count: 11,
        reaction: null,
        forceOnField: true,
      },
    ]);
    expect(canonicalReport.formulaPlanBoundary.unitExpandedPlan).toHaveLength(
      13,
    );
    expect(
      canonicalReport.formulaPlanBoundary.unitExpandedPlan.slice(0, 2),
    ).toEqual(
      Array.from({ length: 2 }, () => ({
        charId: "xiao",
        formulaId: "xiao-skill",
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
    );
    expect(
      canonicalReport.formulaPlanBoundary.unitExpandedPlan.slice(2),
    ).toEqual(
      Array.from({ length: 11 }, () => ({
        charId: "xiao",
        formulaId: "xiao-plunge-high",
        count: 1,
        reaction: null,
        forceOnField: true,
      })),
    );
    expect(canonicalReport.formulaPlanBoundary).toMatchObject({
      formulaIdAndCountOwnership:
        "guide-factory-checkpoint-42-calculator-default",
      lineOrderAndExecutionFlagOwnership:
        "guide-factory-checkpoint-47-wrapper",
      checkpoint42SuppliesFormulaIdsAndCountsOnly: true,
      unitExpandedLineCount: 13,
      sourceTwelvePlungePlanExecuted: false,
      sourceTwelvePlungePlanDisposition:
        "withheld-cross-context-no-external-buffs",
      sourceContextHasNoExternalBuffs: true,
      evaluatedContextHasExternalFfxxBuffs: true,
      rotationQualityEvaluated: false,
    });
    expect(
      canonicalReport.formulaPlanBoundary.groupedPlan.some(
        ({ formulaId, count }) =>
          formulaId === "xiao-plunge-high" && count === 12,
      ),
    ).toBe(false);
  });

  it("captures six grouped failures and six expanded passes with the exact Xianyun activation split", () => {
    expect(canonicalReport.representationBoundary).toEqual({
      groupedReplayCount: 6,
      groupedReplayRejectionCount: 6,
      groupedRawDualPathCaptureCount: 6,
      unitExpandedReplayCount: 6,
      unitExpandedAgreementCount: 6,
      groupedDirectExpandedDirectAgreementCount: 6,
      groupedCompiledExpandedCompiledAgreementCount: 0,
      diagnosedCause: "grouped-line-stack-limited-buff-representation",
      comparisonWithheld: true,
      representationInvarianceValidated: false,
      groupedReplayAccepted: false,
      unitExpandedReplayAccepted: true,
    });
    expect(canonicalReport.observations.map(({ weaponId }) => weaponId)).toEqual(
      WEAPONS,
    );
    expect(
      canonicalReport.observations.map(({ refinement }) => refinement),
    ).toEqual([1, 5, 1, 1, 1, 1]);
    expect(
      canonicalReport.observations.map(({ candidateId }) => candidateId),
    ).toEqual(
      canonicalReport.observations
        .map(({ candidateId }) => candidateId)
        .sort(),
    );

    for (const observation of canonicalReport.observations) {
      expect(observation).toMatchObject({
        sourceOnlyViewId: "source-only-ffxx",
        excludedViewIds: ["exact-ffxx-plus-wrapper-c6"],
        groupedReplay: {
          representation: "two-grouped-formula-lines",
          lineCounts: [2, 11],
          replayTeamDamageRejected: true,
          calculatorAgreement: false,
          xianyunTotalActivation: 8,
        },
        unitExpandedReplay: {
          representation: "thirteen-unit-formula-lines",
          lineCounts: Array.from({ length: 13 }, () => 1),
          replayTeamDamageAccepted: true,
          calculatorAgreement: true,
          xianyunPerCastActivationSequence: [
            1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
          ],
          xianyunTotalActivation: 8,
        },
        crossRepresentation: {
          groupedDirectEqualsExpandedDirect: true,
          groupedCompiledEqualsExpandedCompiled: false,
        },
        disposition: "withheld-grouped-stack-limited-representation-mismatch",
        comparisonEligible: false,
        factoryRank: null,
        winner: false,
        recommendation: false,
      });
      expect(observation.groupedReplay.rejectionMessage).toContain(
        "above tolerance",
      );
      expect(observation.groupedReplay.absoluteDifference).toBeGreaterThan(
        observation.groupedReplay.allowedDifference,
      );
      expect(observation.unitExpandedReplay.absoluteDifference).toBeLessThanOrEqual(
        observation.unitExpandedReplay.allowedDifference,
      );
      expect(observation.groupedReplay.xianyunStackLimitedBuffKey).toBe(
        observation.unitExpandedReplay.xianyunStackLimitedBuffKey,
      );
      expect(
        observation.groupedReplay.xianyunPerCastActivation * 11,
      ).toBeCloseTo(8, 12);
      expect(
        Math.abs(observation.crossRepresentation.groupedDirectMinusExpandedDirect),
      ).toBeLessThanOrEqual(observation.unitExpandedReplay.allowedDifference);
      expect(observation.observationSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(canonicalReport.issues).toHaveLength(6);
    expect(
      canonicalReport.issues.every(
        ({ code }) =>
          code === "representation.grouped-stack-limited-line-disagrees",
      ),
    ).toBe(true);
  });

  it("withholds comparison, rank, winner, recommendation, complete-build, and ER claims", () => {
    expect(canonicalReport).toMatchObject({
      comparisonStatus: "not-comparable",
      publicationStatus: "withheld-grouped-stack-limited-representation-mismatch",
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
      formulaInputsUsed: true,
      damageComputationExecuted: true,
      groupedReplayExecuted: true,
      unitExpandedReplayExecuted: true,
      optimizerExecuted: false,
      generatorExecuted: false,
      recommendationCompositionExecuted: false,
      idealRollAllocationExecuted: false,
      energyRecoveryInputsUsed: false,
      energyRecoveryComputationExecuted: false,
      summary: {
        candidateCount: 6,
        groupedReplayCount: 6,
        rejectedGroupedReplayCount: 6,
        acceptedUnitExpandedReplayCount: 6,
        comparableCandidateCount: 0,
        rankedCandidateCount: 0,
        winnerCount: 0,
        recommendationCount: 0,
        completeBuildCount: 0,
        energyRecoveryComputationCount: 0,
      },
    });
    expect(canonicalReport.identityBoundary).toMatchObject({
      sourceRankExcludedFromExecutionIdentity: true,
      excludedRequestViewFactsExcludedFromExecutionIdentity: true,
    });
    expect(
      Object.values(canonicalReport.identityBoundary)
        .filter((value): value is string => typeof value === "string")
        .every((value) => /^[a-f0-9]{64}$/.test(value)),
    ).toBe(true);
  });

  it("rejects missing/duplicate closure entries and independent tampering of both binary beta resources", async () => {
    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(1);
    await expectRejectedInput(missing, "source-file path closure drifted");

    const duplicate = fixture();
    duplicate.generatedFrom = [
      ...duplicate.generatedFrom,
      duplicate.generatedFrom[0],
    ];
    await expectRejectedInput(duplicate, "generatedFrom path closure drifted");

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

  it("fresh-authentication rejects parity-valid CP46 and CP42 report forgeries", async () => {
    const branchForgery = fixture();
    const branchReport = structuredClone(
      branchForgery.branchCandidateDurableReportInput,
    ) as XiaoFfxxNonErConditionFreeBranchCandidateContractReport;
    branchReport.candidates[0].baseViewEvidence[0].viewId =
      "exact-ffxx-plus-wrapper-c6";
    replaceJsonInput(
      branchForgery,
      "branchCandidateDurableReportInput",
      BRANCH_CANDIDATE_REPORT_PATH,
      branchReport,
    );
    await expectRejectedInput(branchForgery, "Checkpoint-46");

    const formulaForgery = fixture();
    const formulaReport = structuredClone(
      formulaForgery.formulaCountDurableReportInput,
    ) as XiaoFormulaCountParityReport;
    const sourcePlunge = formulaReport.translatedFormulaCounts.find(
      ({ formulaId }) => formulaId === "xiao-plunge-high",
    );
    if (!sourcePlunge) throw new Error("Missing CP42 source plunge fixture.");
    sourcePlunge.count = 11;
    replaceJsonInput(
      formulaForgery,
      "formulaCountDurableReportInput",
      FORMULA_COUNT_REPORT_PATH,
      formulaReport,
    );
    await expectRejectedInput(formulaForgery, "Checkpoint-42");
  }, 60_000);

  it("binds resealed runtime bytes into report identity and rejects serialized output tampering", async () => {
    const resealedBinary = fixture();
    resealedBinary.sourceFiles = resealedBinary.sourceFiles.map((entry) => {
      if (entry.path !== CHARACTER_BETA_STATS_PATH) return entry;
      const bytes = Buffer.from(entry.bytesBase64, "base64");
      bytes[Math.max(0, bytes.length - 1)] ^= 0xff;
      return { ...entry, bytesBase64: bytes.toString("base64") };
    });
    const changedBytes = requiredSourceBytes(
      resealedBinary,
      CHARACTER_BETA_STATS_PATH,
    );
    resealedBinary.generatedFrom = resealedBinary.generatedFrom.map((entry) =>
      entry.path === CHARACTER_BETA_STATS_PATH
        ? { ...entry, sha256: sha256Bytes(changedBytes) }
        : entry,
    );
    expect(
      await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
        durableReport,
        resealedBinary,
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });

    const forgedOutput = structuredClone(durableReport);
    Reflect.set(forgedOutput.summary, "winnerCount", 1);
    expect(
      await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
        forgedOutput,
        fixture(),
      ),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    await expect(
      requireAuthenticatedXiaoFfxxGroupedReplayRepresentationPreflight(
        forgedOutput,
        fixture(),
      ),
    ).rejects.toThrow("serialized-report-mismatch");
  }, 60_000);
});

function runtimeStaticModuleSpecifiers(
  sourceFile: ts.SourceFile,
): string[] {
  const moduleSpecifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImportDeclaration(node)
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      moduleSpecifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return moduleSpecifiers;
}

function isTypeOnlyImportDeclaration(
  declaration: ts.ImportDeclaration,
): boolean {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (!clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) {
    return false;
  }
  return clause.namedBindings.elements.every(({ isTypeOnly }) => isTypeOnly);
}

function resolveFirstPartyModulePath(
  importerPath: string,
  moduleSpecifier: string,
): string | null {
  const bareModuleSpecifier = moduleSpecifier.split("?", 1)[0];
  let basePath: string;
  if (bareModuleSpecifier.startsWith("@/")) {
    basePath = `src/${bareModuleSpecifier.slice(2)}`;
  } else if (bareModuleSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareModuleSpecifier),
    );
  } else {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    `${basePath}.json.gz`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
  const resolved = candidates.find((candidate) => {
    const absolutePath = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  });
  if (!resolved) {
    throw new Error(
      `Could not resolve first-party static import ${moduleSpecifier} from ${importerPath}.`,
    );
  }
  return resolved.replaceAll("\\", "/");
}

async function loadFixture(): Promise<BuildXiaoFfxxGroupedReplayRepresentationPreflightInput> {
  const parsedEntries = await Promise.all(
    JSON_INPUTS.map(async ([key, relativePath]) => [
      key,
      await readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ]),
  );
  const [sourceFiles, generatedFrom] = await Promise.all([
    Promise.all(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    ...(Object.fromEntries(parsedEntries) as Omit<
      BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
      "sourceFiles" | "generatedFrom"
    >),
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFfxxGroupedReplayRepresentationPreflightInput {
  return structuredClone(baseInput);
}

async function expectRejectedInput(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  expectedMessage: string,
): Promise<void> {
  const authentication =
    await authenticateXiaoFfxxGroupedReplayRepresentationPreflight(
      durableReport,
      input,
    );
  expect(authentication).toMatchObject({
    authenticated: false,
    reason: "canonical-inputs-rejected",
  });
  if (authentication.authenticated) {
    throw new Error("Expected rejected grouped-replay input.");
  }
  expect(authentication.issues.map(({ message }) => message).join(" ")).toContain(
    expectedMessage,
  );
}

function replaceJsonInput(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  key:
    | "branchCandidateDurableReportInput"
    | "formulaCountDurableReportInput",
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

function requiredSourceBytes(
  input: BuildXiaoFfxxGroupedReplayRepresentationPreflightInput,
  relativePath: string,
): Buffer {
  const source = input.sourceFiles.find(({ path: sourcePath }) =>
    sourcePath === relativePath,
  );
  if (!source) throw new Error(`Missing source bytes ${relativePath}.`);
  return Buffer.from(source.bytesBase64, "base64");
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
