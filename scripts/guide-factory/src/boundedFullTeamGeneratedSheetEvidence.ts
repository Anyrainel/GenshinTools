import "@/lib/dmgcalc";

import { statPools } from "@/data/constants";
import {
  allSlots,
  type MainStat,
  type Slot,
  type StatKey,
  type SubStat,
} from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { isFlatStat } from "@/data/utils";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type { ComboFormula, TeamSlotConfig } from "@/lib/dmgcalc/types";
import {
  runGenerator as runRuntimeGenerator,
  type GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import {
  isCompleteBoundedFullTeamEquipmentTechnicalComputationReport,
  requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport,
  type BoundedFullTeamEquipmentTechnicalComputationReport,
  type BoundedFullTeamEquipmentGeneratorRequest,
} from "./boundedFullTeamEquipmentTechnicalComputation";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import {
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimePreflightReport,
} from "./sourceBackedEquipmentRuntimePreflight";

const SHA256 = /^[a-f0-9]{64}$/;
const HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION = 64;
const DISPLAY_ROUNDING_HALF_UNIT = 0.005;
const NUMERIC_TOLERANCE_FACTOR = 64 * Number.EPSILON;
const SUBSTAT_KEYS = new Set<string>([
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "er",
  "em",
  "atk",
  "hp",
  "def",
]);
const MAIN_STAT_KEYS = new Set<string>([
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "er",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "heal%",
  "atk",
  "hp",
]);
const STAT_KEYS = new Set<string>([
  ...MAIN_STAT_KEYS,
  ...SUBSTAT_KEYS,
  "baseHp",
  "baseAtk",
  "baseDef",
  "dmg%",
  "polestarField",
  "baseDmg",
  "baseDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "reactionDmg%",
  "reactionCr",
  "reactionCd",
  "atkSpd%",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
]);

export type GeneratedSheetDumpEntry = {
  key: StatKey;
  filterKey: string;
  value: number;
};

export type StableDisplayedSubstat = {
  key: SubStat;
  value: number;
};

export type StableArtifactAllocationSlot = {
  slot: Slot;
  rarity: 4 | 5;
  level: number;
  mainStatKey: MainStat;
  displayedSubstats: StableDisplayedSubstat[];
  derivedLineEvidence: {
    visibleDisplayedSubstatLineCount: number;
    totalRollCount: null;
    totalRollCountStatus: "unknown-from-rounded-display-values";
  };
};

export type GeneratedSheetOccurrenceContext = {
  nodeId: string;
  carryCharacterId: string;
  characterId: string;
  allocationId: string;
};

export type ArtifactAllocationOccurrenceContext = {
  nodeId: string;
  carryCharacterId: string;
  characterId: string;
  sheetId: string;
};

export type GeneratedSheetCatalogEntry = {
  sheetId: string;
  entries: GeneratedSheetDumpEntry[];
  allocationIds: string[];
  occurrences: GeneratedSheetOccurrenceContext[];
};

export type ArtifactAllocationCatalogEntry = {
  allocationId: string;
  artifacts: StableArtifactAllocationSlot[];
  reconstructedSheetId: string;
  reconstructedSheetEntries: GeneratedSheetDumpEntry[];
  occurrences: ArtifactAllocationOccurrenceContext[];
};

export type SheetAllocationDelta = {
  key: StatKey;
  filterKey: string;
  generatedValue: number;
  reconstructedValue: number;
  delta: number;
  displayedSubstatContributionCount: number;
  displayRoundingBound: number;
  numericTolerance: number;
  allowedAbsoluteDelta: number;
  withinEnvelope: boolean;
};

export type GeneratedSheetAllocationObservation = {
  characterId: string;
  sheetId: string;
  allocationId: string;
  reconstructedSheetId: string;
  exactStatDeltas: SheetAllocationDelta[];
  displayRoundingEnvelopeSatisfied: true;
};

type ProgressObservation = {
  phase: string;
  progress: number;
  done: boolean;
};

export type GeneratedSheetEvidenceIssue = {
  code: string;
  stage: "input" | "bootstrap" | "generator" | "capture" | "reconciliation";
  path: string;
  message: string;
  name: string;
  nodeId?: string;
  carryCharacterId?: string;
  characterId?: string;
};

export type GeneratedSheetEvidenceRunObservation =
  | {
      carryCharacterId: string;
      outcome: "captured";
      progress: ProgressObservation[];
      observedTeamConfigsSha256: string;
      expectedCp38ProgressSha256: string;
      observedProgressSha256: string;
      sheetsByCharacter: Record<string, GeneratedSheetAllocationObservation>;
    }
  | {
      carryCharacterId: string;
      outcome: "not-comparable";
      progress: ProgressObservation[];
      failure: GeneratedSheetEvidenceIssue;
    };

export type GeneratedSheetOriginParityRow = {
  characterId: string;
  sheetId: string;
  expectedOriginCarryCharacterIds: string[];
  observedOriginCarryCharacterIds: string[];
  expectedOriginMultiplicity: number;
  observedOriginMultiplicity: number;
  matched: boolean;
};

export type GeneratedSheetEvidenceNodeObservation = {
  sequence: number;
  nodeId: string;
  materializedConfigsSha256: string;
  cp38NodeEvidenceSha256: string;
  comparisonStatus: "comparable" | "not-comparable";
  generatorRuns: GeneratedSheetEvidenceRunObservation[];
  originParity: GeneratedSheetOriginParityRow[];
  issues: GeneratedSheetEvidenceIssue[];
};

export type BoundedFullTeamGeneratedSheetEvidenceInput = {
  technicalReport: BoundedFullTeamEquipmentTechnicalComputationReport;
  preflight: SourceBackedEquipmentRuntimePreflightReport;
  generatedFrom: Array<{ path: string; sha256: string }>;
};

export type BoundedFullTeamGeneratedSheetGeneratorInvocation = {
  runtimeIdentity: object;
  observedTeamConfigs: TeamSlotConfig[];
  results: AsyncIterable<GeneratorResult>;
};

export type BoundedFullTeamGeneratedSheetEvidenceEnvironment = {
  environmentId: string;
  generatorOptimizationMode:
    | "damage-objective-driven-artifact-generator"
    | "injected-generator-not-characterized";
  bootstrap: () => Promise<void>;
  createGeneratorInvocation: (
    request: BoundedFullTeamEquipmentGeneratorRequest,
  ) => BoundedFullTeamGeneratedSheetGeneratorInvocation;
};

export type BoundedFullTeamGeneratedSheetEvidenceReport = {
  schemaVersion: 1;
  classification: "bounded-full-team-generated-sheet-evidence";
  validationStatus:
    | "withheld-invalid-input"
    | "withheld-bootstrap-failure"
    | "withheld-incomplete-generation"
    | "withheld-inconsistent-evidence"
    | "completed-generated-sheet-evidence";
  comparisonStatus: "comparable" | "not-comparable";
  capabilities: {
    sourceClaims: false;
    guideClaims: false;
    teamRecommendationClaims: false;
    equipmentRecommendationClaims: false;
    statPriorityClaims: false;
    rankClaims: false;
    gameplayClaims: false;
    damageClaims: false;
    dpsClaims: false;
    optimalityClaims: false;
    energyRecoveryClaims: false;
  };
  generatorExecuted: boolean;
  generatorOptimizationExecuted: boolean;
  generatorDamageObjectiveEvaluated: boolean;
  damageReplayExecuted: false;
  damageReplayCalls: 0;
  rankingProduced: false;
  recommendationProduced: false;
  guideProduced: false;
  downstreamOptimizerExecuted: false;
  downstreamOptimizerCalls: 0;
  energyRecoveryInterpreted: false;
  energyRecoveryCalls: 0;
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsStatPriorityClaims: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsOptimality: false;
  supportsEnergyRequirements: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: {
    technicalReportAuthenticated: boolean;
    technicalReportComplete: boolean;
    technicalReportSha256: string;
    technicalReportContentSha256: string | null;
    preflightAuthenticated: boolean;
    preflightComplete: boolean;
    preflightReportSha256: string;
    preflightReportContentSha256: string | null;
    cp38PreflightBindingMatched: boolean;
    nodeCount: number;
    nodeIds: string[];
    teamCharacterIds: string[];
    carryCharacterIds: string[];
    plannedGeneratorInvocations: string | null;
  };
  execution: {
    environmentId: string;
    generatorOptimizationMode:
      | "damage-objective-driven-artifact-generator"
      | "injected-generator-not-characterized";
    scheduling: "sequential";
    hardMaximumGeneratorResultEmissionsPerInvocation: "64";
    freshRuntimeIdentityPerGeneratorInvocation: true;
    exactCp38NodeCarryConfigRunParityRequired: true;
    damageReplayPermitted: false;
    rankingPermitted: false;
    recommendationPermitted: false;
    downstreamOptimizerPermitted: false;
    energyRecoveryInterpretationPermitted: false;
    bootstrapCalls: number;
    observedGeneratorInvocations: number;
    freshRuntimeIdentityCount: number;
    capturedGeneratorResultCount: number;
    observedCharacterSheetAllocationCount: number;
  };
  nodes: GeneratedSheetEvidenceNodeObservation[];
  sheetCatalog: GeneratedSheetCatalogEntry[];
  artifactAllocationCatalog: ArtifactAllocationCatalogEntry[];
  relationshipSummary: {
    sheetCount: number;
    allocationCount: number;
    occurrenceCount: number;
    sheetIdsWithMultipleAllocations: number;
    maximumAllocationsPerSheet: number;
  };
  issues: GeneratedSheetEvidenceIssue[];
  cautions: string[];
  authentication: {
    technicalReportSha256: string;
    technicalReportContentSha256: string | null;
    preflightReportSha256: string;
    preflightReportContentSha256: string | null;
    resultFingerprintSha256: string | null;
    reportContentSha256: string;
  };
};

type CapturedArtifactAllocation = {
  artifacts: StableArtifactAllocationSlot[];
  reconstructedEntries: GeneratedSheetDumpEntry[];
};

type InputContext = BoundedFullTeamGeneratedSheetEvidenceReport["inputBoundary"];

class GeneratedSheetEvidenceFailure extends Error {
  override readonly name = "GeneratedSheetEvidenceFailure";

  constructor(
    readonly code: string,
    readonly stage: GeneratedSheetEvidenceIssue["stage"],
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_ENVIRONMENT: BoundedFullTeamGeneratedSheetEvidenceEnvironment = {
  environmentId: "existing-generator-sheet-evidence-runtime-v1",
  generatorOptimizationMode: "damage-objective-driven-artifact-generator",
  bootstrap: bootstrapGuideFactoryComputation,
  createGeneratorInvocation(request) {
    const teamBuild = new TeamBuild(
      cloneTeamConfigs(request.teamConfigs),
      { ...request.combatOptions },
      request.enemyAura ?? undefined,
      structuredClone(request.extraBuffs),
      undefined,
      { ...request.calcContext },
    );
    const combo = buildGeneratorCombo(request.objectiveLines);
    return {
      runtimeIdentity: teamBuild,
      observedTeamConfigs: cloneTeamConfigs(teamBuild.configs),
      results: runRuntimeGenerator({
        teamBuild,
        carryCharId: request.carryCharacterId,
        combo,
        calcContext: { ...request.calcContext },
        rollMultiplier: request.calcContext.rollMultiplier,
        substatBudget: request.calcContext.substatBudget,
      }),
    };
  },
};

/**
 * Rerun the exact authenticated CP38 node/carry generator domain and retain
 * only generated sheets and stable artifact-allocation evidence. No damage
 * replay, ranking, recommendation, ER interpretation, or downstream optimizer
 * is reachable through this environment seam.
 */
export async function runBoundedFullTeamGeneratedSheetEvidence(
  rawInput: BoundedFullTeamGeneratedSheetEvidenceInput,
  environment: BoundedFullTeamGeneratedSheetEvidenceEnvironment =
    DEFAULT_ENVIRONMENT,
): Promise<BoundedFullTeamGeneratedSheetEvidenceReport> {
  const input = structuredClone(rawInput);
  const context = buildInputContext(input);
  const inputIssues = validateInput(input, environment, context);
  if (inputIssues.length > 0) {
    return finalizeReport(
      emptyReport(
        input,
        environment,
        context,
        "withheld-invalid-input",
        inputIssues,
      ),
    );
  }

  let bootstrapCalls = 0;
  try {
    await environment.bootstrap();
    bootstrapCalls = 1;
  } catch (error) {
    return finalizeReport(
      emptyReport(
        input,
        environment,
        context,
        "withheld-bootstrap-failure",
        [
          serializeIssue(error, {
            stage: "bootstrap",
            path: "execution.bootstrap",
          }),
        ],
      ),
    );
  }

  const technicalReport = input.technicalReport;
  const preflight = input.preflight;
  const assumptions = preflight.runtimeBoundary.assumptions;
  const objective = preflight.objectiveBoundary.envelope;
  const characterIds = [...context.teamCharacterIds];
  const carryCharacterIds = [...context.carryCharacterIds];
  const runtimeIdentities = new Set<object>();
  let observedGeneratorInvocations = 0;
  let capturedGeneratorResultCount = 0;
  let observedCharacterSheetAllocationCount = 0;
  const nodes: GeneratedSheetEvidenceNodeObservation[] = [];
  const rawSheetCatalog = new Map<string, GeneratedSheetCatalogEntry>();
  const rawAllocationCatalog = new Map<
    string,
    ArtifactAllocationCatalogEntry
  >();

  for (const [nodeIndex, cp38Node] of technicalReport.nodes.entries()) {
    const preflightNode = preflight.nodes[nodeIndex];
    const configs = requireFourConfigs(preflightNode.materializedConfigs);
    const runs: GeneratedSheetEvidenceRunObservation[] = [];
    const nodeIssues: GeneratedSheetEvidenceIssue[] = [];

    for (const [carryIndex, carryCharacterId] of carryCharacterIds.entries()) {
      const cp38Run = cp38Node.generatorRuns[carryIndex];
      const progress: ProgressObservation[] = [];
      try {
        observedGeneratorInvocations += 1;
        const invocation = environment.createGeneratorInvocation({
          nodeId: cp38Node.nodeId,
          carryCharacterId,
          teamConfigs: cloneTeamConfigs(configs),
          objectiveLines: structuredClone(objective.formulaLines),
          combatOptions: { ...assumptions.combatOptions },
          enemyAura: assumptions.enemyAura,
          extraBuffs: structuredClone(assumptions.extraBuffs),
          calcContext: { ...assumptions.calcContext },
        });
        validateInvocation(
          invocation,
          configs,
          runtimeIdentities,
          cp38Node.nodeId,
          carryCharacterId,
        );

        let finalResult: GeneratorResult | null = null;
        let previousProgress = -1;
        let sawDone = false;
        let emissions = 0;
        for await (const result of invocation.results) {
          emissions += 1;
          if (
            emissions > HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION
          ) {
            throw new GeneratedSheetEvidenceFailure(
              "generator.result_emission_cap_exceeded",
              "capture",
              `${cp38Node.nodeId}/${carryCharacterId} emitted more than 64 generator results.`,
            );
          }
          validateProgress(
            result,
            previousProgress,
            sawDone,
            cp38Node.nodeId,
            carryCharacterId,
          );
          progress.push({
            phase: result.phase,
            progress: result.progress,
            done: result.done,
          });
          previousProgress = result.progress;
          if (result.done) {
            sawDone = true;
            finalResult = result;
          }
        }
        if (!finalResult) {
          throw new GeneratedSheetEvidenceFailure(
            "generator.missing_final_result",
            "capture",
            "Generator completed without exactly one done=true result.",
          );
        }
        if (cp38Run.outcome !== "captured") {
          throw new GeneratedSheetEvidenceFailure(
            "reconciliation.cp38_run_not_captured",
            "reconciliation",
            `${cp38Node.nodeId}/${carryCharacterId} has no authenticated captured CP38 endpoint.`,
          );
        }
        const expectedProgressSha256 = sha256Text(stableJson(cp38Run.progress));
        const observedProgressSha256 = sha256Text(stableJson(progress));
        if (observedProgressSha256 !== expectedProgressSha256) {
          throw new GeneratedSheetEvidenceFailure(
            "reconciliation.cp38_progress_mismatch",
            "reconciliation",
            `${cp38Node.nodeId}/${carryCharacterId} progress stream differs from CP38.`,
          );
        }

        const captured = captureFinalResult(
          finalResult,
          characterIds,
          cp38Run.sheetFingerprintsByCharacter,
          cp38Node.nodeId,
          carryCharacterId,
        );
        capturedGeneratorResultCount += 1;
        observedCharacterSheetAllocationCount += characterIds.length;
        const sheetsByCharacter: Record<
          string,
          GeneratedSheetAllocationObservation
        > = {};
        for (const characterId of characterIds) {
          const observation = captured.observations[characterId];
          const allocation = captured.allocations[characterId];
          sheetsByCharacter[characterId] = observation;
          addCatalogOccurrence(
            rawSheetCatalog,
            rawAllocationCatalog,
            cp38Node.nodeId,
            carryCharacterId,
            characterId,
            observation,
            captured.sheetEntries[characterId],
            allocation,
          );
        }
        runs.push({
          carryCharacterId,
          outcome: "captured",
          progress,
          observedTeamConfigsSha256: sha256Text(
            stableJson(invocation.observedTeamConfigs),
          ),
          expectedCp38ProgressSha256: expectedProgressSha256,
          observedProgressSha256,
          sheetsByCharacter: sortTextRecord(sheetsByCharacter),
        });
      } catch (error) {
        const failure = serializeIssue(error, {
          stage: inferStage(error, "generator"),
          path: `nodes.${cp38Node.nodeId}.generator.${carryCharacterId}`,
          nodeId: cp38Node.nodeId,
          carryCharacterId,
        });
        nodeIssues.push(failure);
        runs.push({
          carryCharacterId,
          outcome: "not-comparable",
          progress,
          failure,
        });
      }
    }

    const originParity = buildOriginParity(
      cp38Node,
      runs,
      characterIds,
      carryCharacterIds,
    );
    for (const row of originParity) {
      if (!row.matched) {
        nodeIssues.push({
          code: "reconciliation.cp38_origin_multiplicity_mismatch",
          stage: "reconciliation",
          path: `nodes.${cp38Node.nodeId}.originParity.${row.characterId}.${row.sheetId}`,
          message: `${cp38Node.nodeId}/${row.characterId}/${row.sheetId} does not reproduce CP38 origin carries and multiplicity.`,
          name: "GeneratedSheetEvidenceIssue",
          nodeId: cp38Node.nodeId,
          characterId: row.characterId,
        });
      }
    }
    const comparable =
      nodeIssues.length === 0 &&
      runs.length === carryCharacterIds.length &&
      runs.every(({ outcome }) => outcome === "captured");
    nodes.push({
      sequence: nodeIndex,
      nodeId: cp38Node.nodeId,
      materializedConfigsSha256: cp38Node.materializedConfigsSha256,
      cp38NodeEvidenceSha256: sha256Text(stableJson(cp38Node)),
      comparisonStatus: comparable ? "comparable" : "not-comparable",
      generatorRuns: runs,
      originParity,
      issues: nodeIssues,
    });
  }

  const issues = nodes.flatMap(({ issues: nodeIssues }) => nodeIssues);
  const anyGenerationFailure = nodes.some((node) =>
    node.generatorRuns.some(({ outcome }) => outcome !== "captured"),
  );
  const allComparable =
    issues.length === 0 &&
    nodes.length === context.nodeCount &&
    nodes.every(({ comparisonStatus }) => comparisonStatus === "comparable");
  const sheetCatalog = finalizeSheetCatalog(rawSheetCatalog);
  const artifactAllocationCatalog = finalizeAllocationCatalog(
    rawAllocationCatalog,
  );
  const report: BoundedFullTeamGeneratedSheetEvidenceReport = {
    ...reportHeader(input, context),
    validationStatus: allComparable
      ? "completed-generated-sheet-evidence"
      : anyGenerationFailure
        ? "withheld-incomplete-generation"
        : "withheld-inconsistent-evidence",
    comparisonStatus: allComparable ? "comparable" : "not-comparable",
    generatorExecuted: observedGeneratorInvocations > 0,
    generatorOptimizationExecuted:
      environment.generatorOptimizationMode ===
        "damage-objective-driven-artifact-generator" &&
      observedGeneratorInvocations > 0,
    generatorDamageObjectiveEvaluated:
      environment.generatorOptimizationMode ===
        "damage-objective-driven-artifact-generator" &&
      observedGeneratorInvocations > 0,
    execution: {
      ...fixedExecution(environment),
      bootstrapCalls,
      observedGeneratorInvocations,
      freshRuntimeIdentityCount: runtimeIdentities.size,
      capturedGeneratorResultCount,
      observedCharacterSheetAllocationCount,
    },
    nodes,
    sheetCatalog,
    artifactAllocationCatalog,
    relationshipSummary: summarizeRelationships(
      sheetCatalog,
      artifactAllocationCatalog,
    ),
    issues,
    cautions: fixedCautions(),
    authentication: {
      technicalReportSha256: context.technicalReportSha256,
      technicalReportContentSha256:
        context.technicalReportContentSha256,
      preflightReportSha256: context.preflightReportSha256,
      preflightReportContentSha256: context.preflightReportContentSha256,
      resultFingerprintSha256: null,
      reportContentSha256: "",
    },
  };
  return finalizeReport(report);
}

function validateInput(
  input: BoundedFullTeamGeneratedSheetEvidenceInput,
  environment: BoundedFullTeamGeneratedSheetEvidenceEnvironment,
  context: InputContext,
): GeneratedSheetEvidenceIssue[] {
  const issues: GeneratedSheetEvidenceIssue[] = [];
  if (!nonEmpty(environment.environmentId)) {
    issues.push(
      makeIssue(
        "input.invalid_environment_id",
        "input",
        "environment.environmentId",
        "Generated-sheet environment ID must be nonblank.",
      ),
    );
  }
  if (
    environment.generatorOptimizationMode !==
      "damage-objective-driven-artifact-generator" &&
    environment.generatorOptimizationMode !==
      "injected-generator-not-characterized"
  ) {
    issues.push(
      makeIssue(
        "input.invalid_generator_optimization_mode",
        "input",
        "environment.generatorOptimizationMode",
        "The generator optimization mode must be an explicit supported value.",
      ),
    );
  }
  try {
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      input.technicalReport,
    );
  } catch (error) {
    issues.push(
      makeIssue(
        "input.technical_report_unauthenticated",
        "input",
        "technicalReport",
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  try {
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      input.preflight,
    );
  } catch (error) {
    issues.push(
      makeIssue(
        "input.preflight_unauthenticated",
        "input",
        "preflight",
        error instanceof Error ? error.message : String(error),
      ),
    );
  }
  if (
    context.technicalReportAuthenticated &&
    !context.technicalReportComplete
  ) {
    issues.push(
      makeIssue(
        "input.technical_report_incomplete",
        "input",
        "technicalReport.validationStatus",
        "Generated-sheet evidence requires a complete authenticated CP38 technical report.",
      ),
    );
  }
  if (context.preflightAuthenticated && !context.preflightComplete) {
    issues.push(
      makeIssue(
        "input.preflight_incomplete",
        "input",
        "preflight.validationStatus",
        "Generated-sheet evidence requires a complete authenticated materialization preflight.",
      ),
    );
  }
  validateGeneratedFrom(input.generatedFrom, issues);
  if (
    context.technicalReportAuthenticated &&
    context.preflightAuthenticated &&
    !context.cp38PreflightBindingMatched
  ) {
    issues.push(
      makeIssue(
        "input.cp38_preflight_binding_mismatch",
        "input",
        "technicalReport.inputBoundary.preflightReportSha256",
        "CP38 does not authenticate the supplied materialization preflight bytes.",
      ),
    );
  }
  if (
    context.technicalReportComplete &&
    context.preflightComplete &&
    !exactDomainParity(input.technicalReport, input.preflight)
  ) {
    issues.push(
      makeIssue(
        "input.cp38_domain_mismatch",
        "input",
        "technicalReport.nodes",
        "CP38 and the preflight do not expose the exact same node, carry, character, config, and captured-run domain.",
      ),
    );
  }
  return issues;
}

function buildInputContext(
  input: BoundedFullTeamGeneratedSheetEvidenceInput,
): InputContext {
  let technicalReportAuthenticated = false;
  let preflightAuthenticated = false;
  try {
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      input.technicalReport,
    );
    technicalReportAuthenticated = true;
  } catch {
    // The withheld report still binds supplied bytes below.
  }
  try {
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      input.preflight,
    );
    preflightAuthenticated = true;
  } catch {
    // The withheld report still binds supplied bytes below.
  }
  const technicalReportComplete =
    technicalReportAuthenticated &&
    isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(
      input.technicalReport,
    );
  const preflightComplete =
    preflightAuthenticated &&
    isCompleteSourceBackedEquipmentRuntimePreflightReport(input.preflight);
  const technicalReportSha256 = sha256Text(stableJson(input.technicalReport));
  const preflightReportSha256 = sha256Text(stableJson(input.preflight));
  const nodeIds = input.technicalReport.nodes?.map(({ nodeId }) => nodeId) ?? [];
  const teamCharacterIds =
    input.technicalReport.inputBoundary?.teamCharacterIds ?? [];
  const carryCharacterIds =
    input.technicalReport.inputBoundary?.carryCharacterIds ?? [];
  return {
    technicalReportAuthenticated,
    technicalReportComplete,
    technicalReportSha256,
    technicalReportContentSha256:
      input.technicalReport.authentication?.reportContentSha256 ?? null,
    preflightAuthenticated,
    preflightComplete,
    preflightReportSha256,
    preflightReportContentSha256:
      input.preflight.authentication?.reportContentSha256 ?? null,
    cp38PreflightBindingMatched:
      technicalReportAuthenticated &&
      preflightAuthenticated &&
      input.technicalReport.inputBoundary.preflightReportSha256 ===
        preflightReportSha256 &&
      input.technicalReport.inputBoundary.preflightReportContentSha256 ===
        input.preflight.authentication.reportContentSha256,
    nodeCount: nodeIds.length,
    nodeIds: [...nodeIds],
    teamCharacterIds: [...teamCharacterIds],
    carryCharacterIds: [...carryCharacterIds],
    plannedGeneratorInvocations:
      nodeIds.length > 0 && carryCharacterIds.length > 0
        ? (BigInt(nodeIds.length) * BigInt(carryCharacterIds.length)).toString()
        : null,
  };
}

function exactDomainParity(
  technical: BoundedFullTeamEquipmentTechnicalComputationReport,
  preflight: SourceBackedEquipmentRuntimePreflightReport,
): boolean {
  const characterIds = preflight.inputBoundary.teamMembers.map(
    ({ characterId }) => characterId,
  );
  const carries = preflight.runtimeBoundary.assumptions.carryCharacterIds;
  if (
    !sameStrings(technical.inputBoundary.teamCharacterIds, characterIds) ||
    !sameStrings(technical.inputBoundary.carryCharacterIds, carries) ||
    technical.nodes.length !== preflight.nodes.length
  ) {
    return false;
  }
  return technical.nodes.every((node, index) => {
    const materialized = preflight.nodes[index];
    return (
      node.nodeId === materialized.nodeId &&
      node.materializedConfigsSha256 === materialized.materializedConfigsSha256 &&
      node.generatorRuns.length === carries.length &&
      node.generatorRuns.every(
        (run, runIndex) =>
          run.carryCharacterId === carries[runIndex] &&
          run.outcome === "captured" &&
          run.observedTeamConfigsSha256 === materialized.materializedConfigsSha256,
      )
    );
  });
}

function validateInvocation(
  invocation: BoundedFullTeamGeneratedSheetGeneratorInvocation,
  expectedConfigs: TeamSlotConfig[],
  identities: Set<object>,
  nodeId: string,
  carryCharacterId: string,
): void {
  if (
    typeof invocation.runtimeIdentity !== "object" ||
    invocation.runtimeIdentity === null
  ) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.invalid_runtime_identity",
      "generator",
      `${nodeId}/${carryCharacterId} did not expose an object runtime identity.`,
    );
  }
  if (identities.has(invocation.runtimeIdentity)) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.runtime_identity_reused",
      "generator",
      `${nodeId}/${carryCharacterId} reused a prior runtime identity.`,
    );
  }
  identities.add(invocation.runtimeIdentity);
  if (!exactEqual(invocation.observedTeamConfigs, expectedConfigs)) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.config_mismatch",
      "generator",
      `${nodeId}/${carryCharacterId} materialized configs differ from the authenticated preflight.`,
    );
  }
  if (
    !invocation.results ||
    typeof invocation.results[Symbol.asyncIterator] !== "function"
  ) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.invalid_iterable",
      "generator",
      `${nodeId}/${carryCharacterId} did not return an async result stream.`,
    );
  }
}

function validateProgress(
  result: GeneratorResult,
  previousProgress: number,
  sawDone: boolean,
  nodeId: string,
  carryCharacterId: string,
): void {
  if (
    !nonEmpty(result.phase) ||
    !Number.isFinite(result.progress) ||
    result.progress < 0 ||
    result.progress > 1 ||
    result.progress < previousProgress
  ) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.invalid_progress",
      "capture",
      `${nodeId}/${carryCharacterId} emitted invalid or decreasing progress.`,
    );
  }
  if (sawDone) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.result_after_final",
      "capture",
      `${nodeId}/${carryCharacterId} emitted a result after done=true.`,
    );
  }
  if (result.done && (result.phase !== "done" || result.progress !== 1)) {
    throw new GeneratedSheetEvidenceFailure(
      "generator.invalid_final_marker",
      "capture",
      `${nodeId}/${carryCharacterId} emitted done=true without phase=done and progress=1.`,
    );
  }
}

function captureFinalResult(
  result: GeneratorResult,
  characterIds: string[],
  expectedSheetIds: Record<string, string>,
  nodeId: string,
  carryCharacterId: string,
): {
  observations: Record<string, GeneratedSheetAllocationObservation>;
  allocations: Record<string, CapturedArtifactAllocation>;
  sheetEntries: Record<string, GeneratedSheetDumpEntry[]>;
} {
  const expectedDomain = [...characterIds].sort(compareText);
  if (
    !sameStrings(Object.keys(result.sheetsByChar).sort(compareText), expectedDomain) ||
    !sameStrings(
      Object.keys(result.artifactsByChar).sort(compareText),
      expectedDomain,
    ) ||
    !sameStrings(Object.keys(expectedSheetIds).sort(compareText), expectedDomain)
  ) {
    throw new GeneratedSheetEvidenceFailure(
      "capture.character_domain_mismatch",
      "capture",
      `${nodeId}/${carryCharacterId} final result does not exactly cover the four-character domain.`,
    );
  }
  const observations: Record<string, GeneratedSheetAllocationObservation> = {};
  const allocations: Record<string, CapturedArtifactAllocation> = {};
  const sheetEntries: Record<string, GeneratedSheetDumpEntry[]> = {};
  for (const characterId of characterIds) {
    const sheet = result.sheetsByChar[characterId];
    if (!(sheet instanceof StatSheet)) {
      throw new GeneratedSheetEvidenceFailure(
        "capture.invalid_sheet",
        "capture",
        `${nodeId}/${carryCharacterId}/${characterId} is not a StatSheet.`,
      );
    }
    const entries = canonicalSheetDump(sheet);
    const sheetId = sha256Text(stableJson(entries));
    if (sheetId !== expectedSheetIds[characterId]) {
      throw new GeneratedSheetEvidenceFailure(
        "reconciliation.cp38_sheet_mismatch",
        "reconciliation",
        `${nodeId}/${carryCharacterId}/${characterId} StatSheet bytes differ from CP38.`,
      );
    }
    const artifacts = normalizeArtifactAllocation(
      result.artifactsByChar[characterId],
      nodeId,
      carryCharacterId,
      characterId,
    );
    const allocationId = sha256Text(stableJson(artifacts));
    const reconstructed = StatSheet.fromArtifacts(
      artifacts.map((artifact) => stableSlotToArtifact(artifact)),
    );
    const reconstructedEntries = canonicalSheetDump(reconstructed);
    const reconstructedSheetId = sha256Text(stableJson(reconstructedEntries));
    const exactStatDeltas = buildStatDeltas(
      entries,
      reconstructedEntries,
      artifacts,
    );
    if (exactStatDeltas.some(({ withinEnvelope }) => !withinEnvelope)) {
      throw new GeneratedSheetEvidenceFailure(
        "capture.display_rounding_envelope_exceeded",
        "capture",
        `${nodeId}/${carryCharacterId}/${characterId} generated sheet cannot be reconstructed from displayed artifacts within the derived rounding envelope.`,
      );
    }
    observations[characterId] = {
      characterId,
      sheetId,
      allocationId,
      reconstructedSheetId,
      exactStatDeltas,
      displayRoundingEnvelopeSatisfied: true,
    };
    allocations[characterId] = { artifacts, reconstructedEntries };
    sheetEntries[characterId] = entries;
  }
  return { observations, allocations, sheetEntries };
}

function normalizeArtifactAllocation(
  raw: Record<Slot, ArtifactData>,
  nodeId: string,
  carryCharacterId: string,
  characterId: string,
): StableArtifactAllocationSlot[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw illegalArtifactShape(nodeId, carryCharacterId, characterId);
  }
  if (!sameStrings(Object.keys(raw).sort(compareText), [...allSlots].sort(compareText))) {
    throw illegalArtifactShape(nodeId, carryCharacterId, characterId);
  }
  return allSlots.map((slot) => {
    const artifact = raw[slot] as ArtifactData | undefined;
    if (
      !artifact ||
      typeof artifact !== "object" ||
      Array.isArray(artifact) ||
      artifact.slotKey !== slot ||
      (artifact.rarity !== 4 && artifact.rarity !== 5) ||
      !Number.isInteger(artifact.level) ||
      artifact.level < 0 ||
      artifact.level > (artifact.rarity === 4 ? 16 : 20) ||
      !MAIN_STAT_KEYS.has(artifact.mainStatKey) ||
      !mainStatAllowedForSlot(slot, artifact.mainStatKey) ||
      !artifact.substats ||
      typeof artifact.substats !== "object" ||
      Array.isArray(artifact.substats) ||
      artifact.totalRolls !== undefined ||
      artifact.astralMark !== undefined ||
      artifact.elixirCrafted !== undefined ||
      artifact.unactivatedSubstats !== undefined ||
      artifact.initialValues !== undefined
    ) {
      throw illegalArtifactShape(nodeId, carryCharacterId, characterId);
    }
    const displayedSubstats = Object.entries(artifact.substats)
      .map(([key, value]) => {
        if (
          !SUBSTAT_KEYS.has(key) ||
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value <= 0 ||
          value !== Number(value.toFixed(2)) ||
          key === artifact.mainStatKey
        ) {
          throw illegalArtifactShape(nodeId, carryCharacterId, characterId);
        }
        return { key: key as SubStat, value: normalizeNumber(value) };
      })
      .sort((left, right) => compareText(left.key, right.key));
    if (displayedSubstats.length > 4) {
      throw illegalArtifactShape(nodeId, carryCharacterId, characterId);
    }
    return {
      slot,
      rarity: artifact.rarity,
      level: artifact.level,
      mainStatKey: artifact.mainStatKey,
      displayedSubstats,
      derivedLineEvidence: {
        visibleDisplayedSubstatLineCount: displayedSubstats.length,
        totalRollCount: null,
        totalRollCountStatus: "unknown-from-rounded-display-values",
      },
    };
  });
}

function illegalArtifactShape(
  nodeId: string,
  carryCharacterId: string,
  characterId: string,
): GeneratedSheetEvidenceFailure {
  return new GeneratedSheetEvidenceFailure(
    "capture.illegal_artifact_allocation_shape",
    "capture",
    `${nodeId}/${carryCharacterId}/${characterId} emitted an unsupported or illegal artifact allocation shape.`,
  );
}

function stableSlotToArtifact(slot: StableArtifactAllocationSlot): ArtifactData {
  return {
    id: "excluded-generated-identity",
    setKey: "excluded-cosmetic-set-identity",
    slotKey: slot.slot,
    rarity: slot.rarity,
    level: slot.level,
    mainStatKey: slot.mainStatKey,
    lock: false,
    substats: Object.fromEntries(
      slot.displayedSubstats.map(({ key, value }) => [key, value]),
    ),
  };
}

function buildStatDeltas(
  generated: GeneratedSheetDumpEntry[],
  reconstructed: GeneratedSheetDumpEntry[],
  artifacts: StableArtifactAllocationSlot[],
): SheetAllocationDelta[] {
  const generatedMap = dumpMap(generated);
  const reconstructedMap = dumpMap(reconstructed);
  const identities = [...new Set([...generatedMap.keys(), ...reconstructedMap.keys()])]
    .sort(compareText);
  return identities.map((identity) => {
    const parsed = parseDumpIdentity(identity);
    const generatedValue = generatedMap.get(identity) ?? 0;
    const reconstructedValue = reconstructedMap.get(identity) ?? 0;
    const contributionCount =
      parsed.filterKey === ""
        ? artifacts.reduce(
            (count, artifact) =>
              count +
              artifact.displayedSubstats.filter(({ key }) => key === parsed.key)
                .length,
            0,
          )
        : 0;
    const displayRoundingBound = normalizeNumber(
      contributionCount *
        DISPLAY_ROUNDING_HALF_UNIT *
        (isFlatStat(parsed.key) ? 1 : 0.01),
    );
    const numericTolerance = normalizeNumber(
      NUMERIC_TOLERANCE_FACTOR *
        Math.max(
          1,
          Math.abs(generatedValue),
          Math.abs(reconstructedValue),
          Math.abs(displayRoundingBound),
        ),
    );
    const delta = normalizeNumber(generatedValue - reconstructedValue);
    const allowedAbsoluteDelta = normalizeNumber(
      displayRoundingBound + numericTolerance,
    );
    return {
      key: parsed.key,
      filterKey: parsed.filterKey,
      generatedValue,
      reconstructedValue,
      delta,
      displayedSubstatContributionCount: contributionCount,
      displayRoundingBound,
      numericTolerance,
      allowedAbsoluteDelta,
      withinEnvelope: Math.abs(delta) <= allowedAbsoluteDelta,
    };
  });
}

function dumpMap(entries: GeneratedSheetDumpEntry[]): Map<string, number> {
  return new Map(
    entries.map(({ key, filterKey, value }) => [
      dumpIdentity(key, filterKey),
      value,
    ]),
  );
}

function dumpIdentity(key: StatKey, filterKey: string): string {
  return `${key}\u0000${filterKey}`;
}

function parseDumpIdentity(identity: string): {
  key: StatKey;
  filterKey: string;
} {
  const separator = identity.indexOf("\u0000");
  return {
    key: identity.slice(0, separator) as StatKey,
    filterKey: identity.slice(separator + 1),
  };
}

function addCatalogOccurrence(
  sheets: Map<string, GeneratedSheetCatalogEntry>,
  allocations: Map<string, ArtifactAllocationCatalogEntry>,
  nodeId: string,
  carryCharacterId: string,
  characterId: string,
  observation: GeneratedSheetAllocationObservation,
  entries: GeneratedSheetDumpEntry[],
  allocation: CapturedArtifactAllocation,
): void {
  const sheetOccurrence = {
    nodeId,
    carryCharacterId,
    characterId,
    allocationId: observation.allocationId,
  };
  const existingSheet = sheets.get(observation.sheetId);
  if (existingSheet) {
    if (!exactEqual(existingSheet.entries, entries)) {
      throw new Error("A content-addressed sheet ID resolved to different bytes.");
    }
    existingSheet.occurrences.push(sheetOccurrence);
    if (!existingSheet.allocationIds.includes(observation.allocationId)) {
      existingSheet.allocationIds.push(observation.allocationId);
    }
  } else {
    sheets.set(observation.sheetId, {
      sheetId: observation.sheetId,
      entries: structuredClone(entries),
      allocationIds: [observation.allocationId],
      occurrences: [sheetOccurrence],
    });
  }

  const allocationOccurrence = {
    nodeId,
    carryCharacterId,
    characterId,
    sheetId: observation.sheetId,
  };
  const existingAllocation = allocations.get(observation.allocationId);
  if (existingAllocation) {
    if (
      !exactEqual(existingAllocation.artifacts, allocation.artifacts) ||
      !exactEqual(
        existingAllocation.reconstructedSheetEntries,
        allocation.reconstructedEntries,
      )
    ) {
      throw new Error("A content-addressed allocation ID resolved to different bytes.");
    }
    existingAllocation.occurrences.push(allocationOccurrence);
  } else {
    allocations.set(observation.allocationId, {
      allocationId: observation.allocationId,
      artifacts: structuredClone(allocation.artifacts),
      reconstructedSheetId: observation.reconstructedSheetId,
      reconstructedSheetEntries: structuredClone(
        allocation.reconstructedEntries,
      ),
      occurrences: [allocationOccurrence],
    });
  }
}

function buildOriginParity(
  cp38Node: BoundedFullTeamEquipmentTechnicalComputationReport["nodes"][number],
  runs: GeneratedSheetEvidenceRunObservation[],
  characterIds: string[],
  carryCharacterIds: string[],
): GeneratedSheetOriginParityRow[] {
  const rows: GeneratedSheetOriginParityRow[] = [];
  for (const characterId of characterIds) {
    const expectedCells = cp38Node.sheetPoolsByCharacter[characterId];
    const observed = new Map<string, string[]>();
    for (const run of runs) {
      if (run.outcome !== "captured") continue;
      const sheetId = run.sheetsByCharacter[characterId]?.sheetId;
      if (!sheetId) continue;
      const carries = observed.get(sheetId) ?? [];
      carries.push(run.carryCharacterId);
      observed.set(sheetId, carries);
    }
    const sheetIds = [...new Set([
      ...expectedCells.map(({ sheetId }) => sheetId),
      ...observed.keys(),
    ])].sort(compareText);
    for (const sheetId of sheetIds) {
      const expected = expectedCells.find((cell) => cell.sheetId === sheetId);
      const expectedCarries = expected
        ? [...expected.originCarryCharacterIds]
        : [];
      const observedCarries = carryCharacterIds.filter((carry) =>
        (observed.get(sheetId) ?? []).includes(carry),
      );
      rows.push({
        characterId,
        sheetId,
        expectedOriginCarryCharacterIds: expectedCarries,
        observedOriginCarryCharacterIds: observedCarries,
        expectedOriginMultiplicity: expected?.originMultiplicity ?? 0,
        observedOriginMultiplicity: observed.get(sheetId)?.length ?? 0,
        matched:
          expected !== undefined &&
          expected.originMultiplicity === (observed.get(sheetId)?.length ?? 0) &&
          sameStrings(expectedCarries, observedCarries),
      });
    }
  }
  return rows.sort(
    (left, right) =>
      compareText(left.characterId, right.characterId) ||
      compareText(left.sheetId, right.sheetId),
  );
}

function finalizeSheetCatalog(
  catalog: Map<string, GeneratedSheetCatalogEntry>,
): GeneratedSheetCatalogEntry[] {
  return [...catalog.values()]
    .map((entry) => ({
      ...entry,
      allocationIds: [...entry.allocationIds].sort(compareText),
      occurrences: [...entry.occurrences].sort(compareSheetOccurrence),
    }))
    .sort((left, right) => compareText(left.sheetId, right.sheetId));
}

function finalizeAllocationCatalog(
  catalog: Map<string, ArtifactAllocationCatalogEntry>,
): ArtifactAllocationCatalogEntry[] {
  return [...catalog.values()]
    .map((entry) => ({
      ...entry,
      occurrences: [...entry.occurrences].sort(compareAllocationOccurrence),
    }))
    .sort((left, right) => compareText(left.allocationId, right.allocationId));
}

function summarizeRelationships(
  sheets: GeneratedSheetCatalogEntry[],
  allocations: ArtifactAllocationCatalogEntry[],
): BoundedFullTeamGeneratedSheetEvidenceReport["relationshipSummary"] {
  return {
    sheetCount: sheets.length,
    allocationCount: allocations.length,
    occurrenceCount: sheets.reduce(
      (sum, { occurrences }) => sum + occurrences.length,
      0,
    ),
    sheetIdsWithMultipleAllocations: sheets.filter(
      ({ allocationIds }) => allocationIds.length > 1,
    ).length,
    maximumAllocationsPerSheet: sheets.reduce(
      (maximum, { allocationIds }) => Math.max(maximum, allocationIds.length),
      0,
    ),
  };
}

function emptyReport(
  input: BoundedFullTeamGeneratedSheetEvidenceInput,
  environment: BoundedFullTeamGeneratedSheetEvidenceEnvironment,
  context: InputContext,
  status: "withheld-invalid-input" | "withheld-bootstrap-failure",
  issues: GeneratedSheetEvidenceIssue[],
): BoundedFullTeamGeneratedSheetEvidenceReport {
  return {
    ...reportHeader(input, context),
    validationStatus: status,
    comparisonStatus: "not-comparable",
    generatorExecuted: false,
    generatorOptimizationExecuted: false,
    generatorDamageObjectiveEvaluated: false,
    execution: {
      ...fixedExecution(environment),
      bootstrapCalls: 0,
      observedGeneratorInvocations: 0,
      freshRuntimeIdentityCount: 0,
      capturedGeneratorResultCount: 0,
      observedCharacterSheetAllocationCount: 0,
    },
    nodes: [],
    sheetCatalog: [],
    artifactAllocationCatalog: [],
    relationshipSummary: summarizeRelationships([], []),
    issues: structuredClone(issues),
    cautions: fixedCautions(),
    authentication: {
      technicalReportSha256: context.technicalReportSha256,
      technicalReportContentSha256:
        context.technicalReportContentSha256,
      preflightReportSha256: context.preflightReportSha256,
      preflightReportContentSha256: context.preflightReportContentSha256,
      resultFingerprintSha256: null,
      reportContentSha256: "",
    },
  };
}

function reportHeader(
  input: BoundedFullTeamGeneratedSheetEvidenceInput,
  context: InputContext,
): Pick<
  BoundedFullTeamGeneratedSheetEvidenceReport,
  | "schemaVersion"
  | "classification"
  | "capabilities"
  | "generatorOptimizationExecuted"
  | "generatorDamageObjectiveEvaluated"
  | "damageReplayExecuted"
  | "damageReplayCalls"
  | "rankingProduced"
  | "recommendationProduced"
  | "guideProduced"
  | "downstreamOptimizerExecuted"
  | "downstreamOptimizerCalls"
  | "energyRecoveryInterpreted"
  | "energyRecoveryCalls"
  | "supportsGuideClaims"
  | "supportsEquipmentRecommendations"
  | "supportsStatPriorityClaims"
  | "supportsRankClaims"
  | "supportsDamageClaims"
  | "supportsOptimality"
  | "supportsEnergyRequirements"
  | "generatedFrom"
  | "inputBoundary"
> {
  return {
    schemaVersion: 1,
    classification: "bounded-full-team-generated-sheet-evidence",
    capabilities: fixedCapabilities(),
    generatorOptimizationExecuted: false,
    generatorDamageObjectiveEvaluated: false,
    damageReplayExecuted: false,
    damageReplayCalls: 0,
    rankingProduced: false,
    recommendationProduced: false,
    guideProduced: false,
    downstreamOptimizerExecuted: false,
    downstreamOptimizerCalls: 0,
    energyRecoveryInterpreted: false,
    energyRecoveryCalls: 0,
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsStatPriorityClaims: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsOptimality: false,
    supportsEnergyRequirements: false,
    generatedFrom: structuredClone(input.generatedFrom),
    inputBoundary: structuredClone(context),
  };
}

function fixedCapabilities(): BoundedFullTeamGeneratedSheetEvidenceReport["capabilities"] {
  return {
    sourceClaims: false,
    guideClaims: false,
    teamRecommendationClaims: false,
    equipmentRecommendationClaims: false,
    statPriorityClaims: false,
    rankClaims: false,
    gameplayClaims: false,
    damageClaims: false,
    dpsClaims: false,
    optimalityClaims: false,
    energyRecoveryClaims: false,
  };
}

function fixedExecution(
  environment: BoundedFullTeamGeneratedSheetEvidenceEnvironment,
): Omit<
  BoundedFullTeamGeneratedSheetEvidenceReport["execution"],
  | "bootstrapCalls"
  | "observedGeneratorInvocations"
  | "freshRuntimeIdentityCount"
  | "capturedGeneratorResultCount"
  | "observedCharacterSheetAllocationCount"
> {
  return {
    environmentId: environment.environmentId,
    generatorOptimizationMode: environment.generatorOptimizationMode,
    scheduling: "sequential",
    hardMaximumGeneratorResultEmissionsPerInvocation: "64",
    freshRuntimeIdentityPerGeneratorInvocation: true,
    exactCp38NodeCarryConfigRunParityRequired: true,
    damageReplayPermitted: false,
    rankingPermitted: false,
    recommendationPermitted: false,
    downstreamOptimizerPermitted: false,
    energyRecoveryInterpretationPermitted: false,
  };
}

function fixedCautions(): string[] {
  return [
    "The generic report self-digest authenticates internal consistency only; a source-specific wrapper must authenticate the expected CP38 report, preflight, dependency bytes, environment, and complete output digest.",
    "Generated StatSheets and stable displayed artifact allocations are captured evidence from this exact bounded rerun; they are not source claims, rankings, recommendations, stat priorities, damage claims, gameplay claims, or global optima.",
    "Artifact IDs, set keys, lock state, and randomized flex-slot display identity are intentionally excluded from allocation identity. Slot, rarity, level, main stat, and displayed substats remain identity-bearing.",
    "Visible displayed substat line count is observable, but exact roll count is not identifiable from rounded displayed values and remains null.",
    "StatSheet.fromArtifacts reconstruction uses displayed two-decimal substats. Per-stat differences are accepted only inside a derived half-unit display-rounding envelope plus floating-point tolerance.",
    "One StatSheet may correspond to multiple stable artifact allocations; the catalog preserves every occurrence and the one-to-many relationship.",
    "Incidental ER keys and values remain uninterpreted bytes/data. No ER threshold, requirement, floor, sequence, or recommendation is computed.",
    "The default runtime directly reruns the existing damage-objective-driven artifact generator, including its generator-internal optimization. Injected generators remain explicitly uncharacterized.",
    "This phase performs zero separate damage replay, ranking, recommendation, guide production, downstream optimizer calls, and ER interpretation calls.",
  ];
}

function finalizeReport(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): BoundedFullTeamGeneratedSheetEvidenceReport {
  const finalized = structuredClone(report);
  finalized.authentication.resultFingerprintSha256 =
    finalized.validationStatus === "withheld-invalid-input" ||
    finalized.validationStatus === "withheld-bootstrap-failure"
      ? null
      : calculateResultFingerprint(finalized);
  finalized.authentication.reportContentSha256 =
    calculateReportContentSha256(finalized);
  requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(finalized);
  return finalized;
}

export function requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): void {
  if (
    !SHA256.test(report.authentication.reportContentSha256) ||
    report.authentication.reportContentSha256 !==
      calculateReportContentSha256(report) ||
    !reportSemanticsHold(report)
  ) {
    throw new Error(
      "Bounded full-team generated-sheet evidence report is incomplete, inconsistent, or mutated.",
    );
  }
}

export function isCompleteBoundedFullTeamGeneratedSheetEvidenceReport(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): boolean {
  try {
    requireAuthenticatedBoundedFullTeamGeneratedSheetEvidenceReport(report);
  } catch {
    return false;
  }
  return (
    report.validationStatus === "completed-generated-sheet-evidence" &&
    report.comparisonStatus === "comparable" &&
    report.issues.length === 0 &&
    report.nodes.length === report.inputBoundary.nodeCount &&
    report.nodes.every(
      ({ comparisonStatus }) => comparisonStatus === "comparable",
    )
  );
}

function reportSemanticsHold(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): boolean {
  if (
    report.schemaVersion !== 1 ||
    report.classification !== "bounded-full-team-generated-sheet-evidence" ||
    !exactEqual(report.capabilities, fixedCapabilities()) ||
    !exactEqual(report.cautions, fixedCautions()) ||
    report.damageReplayExecuted ||
    report.damageReplayCalls !== 0 ||
    report.rankingProduced ||
    report.recommendationProduced ||
    report.guideProduced ||
    report.downstreamOptimizerExecuted ||
    report.downstreamOptimizerCalls !== 0 ||
    report.energyRecoveryInterpreted ||
    report.energyRecoveryCalls !== 0 ||
    report.supportsGuideClaims ||
    report.supportsEquipmentRecommendations ||
    report.supportsStatPriorityClaims ||
    report.supportsRankClaims ||
    report.supportsDamageClaims ||
    report.supportsOptimality ||
    report.supportsEnergyRequirements ||
    !nonEmpty(report.execution.environmentId) ||
    report.execution.scheduling !== "sequential" ||
    report.execution.hardMaximumGeneratorResultEmissionsPerInvocation !== "64" ||
    !report.execution.freshRuntimeIdentityPerGeneratorInvocation ||
    !report.execution.exactCp38NodeCarryConfigRunParityRequired ||
    report.execution.damageReplayPermitted ||
    report.execution.rankingPermitted ||
    report.execution.recommendationPermitted ||
    report.execution.downstreamOptimizerPermitted ||
    report.execution.energyRecoveryInterpretationPermitted ||
    report.authentication.technicalReportSha256 !==
      report.inputBoundary.technicalReportSha256 ||
    report.authentication.technicalReportContentSha256 !==
      report.inputBoundary.technicalReportContentSha256 ||
    report.authentication.preflightReportSha256 !==
      report.inputBoundary.preflightReportSha256 ||
    report.authentication.preflightReportContentSha256 !==
      report.inputBoundary.preflightReportContentSha256 ||
    !exactEqual(
      report.relationshipSummary,
      summarizeRelationships(
        report.sheetCatalog,
        report.artifactAllocationCatalog,
      ),
    )
  ) {
    return false;
  }
  const generatedFromValid = generatedFromSemanticsHold(report.generatedFrom);
  const generatorOptimizationModeValid =
    report.execution.generatorOptimizationMode ===
      "damage-objective-driven-artifact-generator" ||
    report.execution.generatorOptimizationMode ===
      "injected-generator-not-characterized";
  const invalidGeneratedFromIssueCount = report.issues.filter(
    ({ code }) => code === "input.invalid_generated_from",
  ).length;
  const invalidGeneratorOptimizationModeIssueCount = report.issues.filter(
    ({ code }) => code === "input.invalid_generator_optimization_mode",
  ).length;
  if (
    (generatedFromValid && invalidGeneratedFromIssueCount !== 0) ||
    (!generatedFromValid && invalidGeneratedFromIssueCount !== 1) ||
    (generatorOptimizationModeValid &&
      invalidGeneratorOptimizationModeIssueCount !== 0) ||
    (!generatorOptimizationModeValid &&
      invalidGeneratorOptimizationModeIssueCount !== 1)
  ) {
    return false;
  }
  const early =
    report.validationStatus === "withheld-invalid-input" ||
    report.validationStatus === "withheld-bootstrap-failure";
  if (early) {
    return (
      report.comparisonStatus === "not-comparable" &&
      !report.generatorExecuted &&
      !report.generatorOptimizationExecuted &&
      !report.generatorDamageObjectiveEvaluated &&
      report.execution.bootstrapCalls === 0 &&
      report.execution.observedGeneratorInvocations === 0 &&
      report.execution.freshRuntimeIdentityCount === 0 &&
      report.execution.capturedGeneratorResultCount === 0 &&
      report.execution.observedCharacterSheetAllocationCount === 0 &&
      report.nodes.length === 0 &&
      report.sheetCatalog.length === 0 &&
      report.artifactAllocationCatalog.length === 0 &&
      report.issues.length > 0 &&
      report.authentication.resultFingerprintSha256 === null
    );
  }
  if (!generatedFromValid || !generatorOptimizationModeValid) return false;
  const nodeIds = report.inputBoundary.nodeIds;
  const characterIds = report.inputBoundary.teamCharacterIds;
  const carries = report.inputBoundary.carryCharacterIds;
  const planned = BigInt(nodeIds.length) * BigInt(carries.length);
  const damageDrivenGenerator =
    report.execution.generatorOptimizationMode ===
    "damage-objective-driven-artifact-generator";
  if (
    !report.inputBoundary.technicalReportAuthenticated ||
    !report.inputBoundary.technicalReportComplete ||
    !report.inputBoundary.preflightAuthenticated ||
    !report.inputBoundary.preflightComplete ||
    !report.inputBoundary.cp38PreflightBindingMatched ||
    !SHA256.test(report.inputBoundary.technicalReportSha256) ||
    !SHA256.test(report.inputBoundary.technicalReportContentSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.preflightReportSha256) ||
    !SHA256.test(report.inputBoundary.preflightReportContentSha256 ?? "") ||
    characterIds.length !== 4 ||
    new Set(characterIds).size !== 4 ||
    !sameStrings(characterIds, carries) ||
    nodeIds.length === 0 ||
    nodeIds.length !== report.inputBoundary.nodeCount ||
    new Set(nodeIds).size !== nodeIds.length ||
    report.inputBoundary.plannedGeneratorInvocations !== planned.toString() ||
    report.execution.bootstrapCalls !== 1 ||
    report.execution.observedGeneratorInvocations !== Number(planned) ||
    report.execution.freshRuntimeIdentityCount > Number(planned) ||
    report.nodes.length !== nodeIds.length ||
    !sameStrings(report.nodes.map(({ nodeId }) => nodeId), nodeIds) ||
    report.generatorExecuted !== (planned > 0n) ||
    report.generatorOptimizationExecuted !==
      (damageDrivenGenerator && planned > 0n) ||
    report.generatorDamageObjectiveEvaluated !==
      (damageDrivenGenerator && planned > 0n)
  ) {
    return false;
  }
  const capturedRuns = report.nodes.reduce(
    (sum, node) =>
      sum +
      node.generatorRuns.filter(({ outcome }) => outcome === "captured").length,
    0,
  );
  if (
    report.execution.capturedGeneratorResultCount !== capturedRuns ||
    report.execution.freshRuntimeIdentityCount < capturedRuns ||
    report.execution.observedCharacterSheetAllocationCount !==
      capturedRuns * characterIds.length
  ) {
    return false;
  }
  for (const [nodeIndex, node] of report.nodes.entries()) {
    if (
      node.sequence !== nodeIndex ||
      !SHA256.test(node.materializedConfigsSha256) ||
      !SHA256.test(node.cp38NodeEvidenceSha256) ||
      node.generatorRuns.length !== carries.length ||
      !sameStrings(
        node.generatorRuns.map(({ carryCharacterId }) => carryCharacterId),
        carries,
      ) ||
      !originParitySemanticsHold(node.originParity, node.generatorRuns, characterIds) ||
      !exactEqual(
        node.issues,
        expectedNodeIssues(node.generatorRuns, node.originParity, node.nodeId),
      )
    ) {
      return false;
    }
    const comparable =
      node.issues.length === 0 &&
      node.generatorRuns.every(({ outcome }) => outcome === "captured");
    if (
      node.comparisonStatus !==
      (comparable ? "comparable" : "not-comparable")
    ) {
      return false;
    }
    for (const run of node.generatorRuns) {
      if (!progressSemanticsHold(run.progress, run.outcome === "captured")) {
        return false;
      }
      if (run.outcome === "captured") {
        if (
          run.observedTeamConfigsSha256 !== node.materializedConfigsSha256 ||
          !SHA256.test(run.expectedCp38ProgressSha256) ||
          run.expectedCp38ProgressSha256 !== run.observedProgressSha256 ||
          run.observedProgressSha256 !== sha256Text(stableJson(run.progress)) ||
          !sameStrings(
            Object.keys(run.sheetsByCharacter).sort(compareText),
            [...characterIds].sort(compareText),
          )
        ) {
          return false;
        }
      } else if (!issueSemanticsHold(run.failure, node.nodeId, run.carryCharacterId)) {
        return false;
      }
    }
  }
  if (!catalogSemanticsHold(report)) {
    return false;
  }
  const allComparable = report.nodes.every(
    ({ comparisonStatus }) => comparisonStatus === "comparable",
  );
  const anyRunFailure = report.nodes.some((node) =>
    node.generatorRuns.some(({ outcome }) => outcome !== "captured"),
  );
  const expectedStatus = allComparable
    ? "completed-generated-sheet-evidence"
    : anyRunFailure
      ? "withheld-incomplete-generation"
      : "withheld-inconsistent-evidence";
  if (
    report.validationStatus !== expectedStatus ||
    report.comparisonStatus !==
      (allComparable ? "comparable" : "not-comparable") ||
    (allComparable &&
      report.execution.freshRuntimeIdentityCount !== Number(planned)) ||
    !exactEqual(report.issues, report.nodes.flatMap(({ issues }) => issues)) ||
    !SHA256.test(report.authentication.resultFingerprintSha256 ?? "") ||
    report.authentication.resultFingerprintSha256 !==
      calculateResultFingerprint(report)
  ) {
    return false;
  }
  return true;
}

function catalogSemanticsHold(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): boolean {
  const sheetById = new Map<string, GeneratedSheetCatalogEntry>();
  const allocationById = new Map<string, ArtifactAllocationCatalogEntry>();
  if (
    !sortedUnique(report.sheetCatalog.map(({ sheetId }) => sheetId)) ||
    !sortedUnique(
      report.artifactAllocationCatalog.map(({ allocationId }) => allocationId),
    )
  ) {
    return false;
  }
  for (const sheet of report.sheetCatalog) {
    if (
      !SHA256.test(sheet.sheetId) ||
      sheet.sheetId !== sha256Text(stableJson(sheet.entries)) ||
      !canonicalDumpSemanticsHold(sheet.entries) ||
      !sortedUnique(sheet.allocationIds) ||
      !isSorted(sheet.occurrences, compareSheetOccurrence)
    ) {
      return false;
    }
    sheetById.set(sheet.sheetId, sheet);
  }
  for (const allocation of report.artifactAllocationCatalog) {
    if (
      !SHA256.test(allocation.allocationId) ||
      allocation.allocationId !== sha256Text(stableJson(allocation.artifacts)) ||
      !stableAllocationSemanticsHold(allocation.artifacts) ||
      !canonicalDumpSemanticsHold(allocation.reconstructedSheetEntries) ||
      allocation.reconstructedSheetId !==
        sha256Text(stableJson(allocation.reconstructedSheetEntries)) ||
      !exactEqual(
        allocation.reconstructedSheetEntries,
        canonicalSheetDump(
          StatSheet.fromArtifacts(
            allocation.artifacts.map((artifact) =>
              stableSlotToArtifact(artifact),
            ),
          ),
        ),
      ) ||
      !isSorted(allocation.occurrences, compareAllocationOccurrence)
    ) {
      return false;
    }
    allocationById.set(allocation.allocationId, allocation);
  }
  const expectedSheetOccurrences = new Map<string, GeneratedSheetOccurrenceContext[]>();
  const expectedAllocationOccurrences = new Map<
    string,
    ArtifactAllocationOccurrenceContext[]
  >();
  for (const node of report.nodes) {
    for (const run of node.generatorRuns) {
      if (run.outcome !== "captured") continue;
      for (const [characterId, observation] of Object.entries(
        run.sheetsByCharacter,
      )) {
        const sheet = sheetById.get(observation.sheetId);
        const allocation = allocationById.get(observation.allocationId);
        if (
          !sheet ||
          !allocation ||
          observation.characterId !== characterId ||
          observation.reconstructedSheetId !== allocation.reconstructedSheetId ||
          !observation.displayRoundingEnvelopeSatisfied ||
          !exactEqual(
            observation.exactStatDeltas,
            buildStatDeltas(
              sheet.entries,
              allocation.reconstructedSheetEntries,
              allocation.artifacts,
            ),
          ) ||
          observation.exactStatDeltas.some(({ withinEnvelope }) => !withinEnvelope)
        ) {
          return false;
        }
        const sheetOccurrences = expectedSheetOccurrences.get(observation.sheetId) ?? [];
        sheetOccurrences.push({
          nodeId: node.nodeId,
          carryCharacterId: run.carryCharacterId,
          characterId,
          allocationId: observation.allocationId,
        });
        expectedSheetOccurrences.set(observation.sheetId, sheetOccurrences);
        const allocationOccurrences =
          expectedAllocationOccurrences.get(observation.allocationId) ?? [];
        allocationOccurrences.push({
          nodeId: node.nodeId,
          carryCharacterId: run.carryCharacterId,
          characterId,
          sheetId: observation.sheetId,
        });
        expectedAllocationOccurrences.set(
          observation.allocationId,
          allocationOccurrences,
        );
      }
    }
  }
  for (const sheet of report.sheetCatalog) {
    const expected = (expectedSheetOccurrences.get(sheet.sheetId) ?? []).sort(
      compareSheetOccurrence,
    );
    if (
      !exactEqual(sheet.occurrences, expected) ||
      !exactEqual(
        sheet.allocationIds,
        [...new Set(expected.map(({ allocationId }) => allocationId))].sort(
          compareText,
        ),
      )
    ) {
      return false;
    }
  }
  for (const allocation of report.artifactAllocationCatalog) {
    const expected = (
      expectedAllocationOccurrences.get(allocation.allocationId) ?? []
    ).sort(compareAllocationOccurrence);
    if (!exactEqual(allocation.occurrences, expected)) return false;
  }
  return (
    expectedSheetOccurrences.size === report.sheetCatalog.length &&
    expectedAllocationOccurrences.size ===
      report.artifactAllocationCatalog.length
  );
}

function expectedNodeIssues(
  runs: GeneratedSheetEvidenceRunObservation[],
  originParity: GeneratedSheetOriginParityRow[],
  nodeId: string,
): GeneratedSheetEvidenceIssue[] {
  return [
    ...runs.flatMap((run) =>
      run.outcome === "not-comparable" ? [run.failure] : [],
    ),
    ...originParity
      .filter(({ matched }) => !matched)
      .map((row) => ({
        code: "reconciliation.cp38_origin_multiplicity_mismatch",
        stage: "reconciliation" as const,
        path: `nodes.${nodeId}.originParity.${row.characterId}.${row.sheetId}`,
        message: `${nodeId}/${row.characterId}/${row.sheetId} does not reproduce CP38 origin carries and multiplicity.`,
        name: "GeneratedSheetEvidenceIssue",
        nodeId,
        characterId: row.characterId,
      })),
  ];
}

function originParitySemanticsHold(
  rows: GeneratedSheetOriginParityRow[],
  runs: GeneratedSheetEvidenceRunObservation[],
  characterIds: string[],
): boolean {
  const rowIdentities = rows.map(({ characterId, sheetId }) =>
    `${characterId}\u0000${sheetId}`,
  );
  if (
    new Set(rowIdentities).size !== rowIdentities.length ||
    !isSorted(
      rows,
      (left, right) =>
        compareText(left.characterId, right.characterId) ||
        compareText(left.sheetId, right.sheetId),
    )
  ) {
    return false;
  }
  const carryCharacterIds = runs.map(({ carryCharacterId }) => carryCharacterId);
  const observedIdentities = new Set<string>();
  for (const run of runs) {
    if (run.outcome !== "captured") continue;
    for (const characterId of characterIds) {
      const sheetId = run.sheetsByCharacter[characterId]?.sheetId;
      if (sheetId) observedIdentities.add(`${characterId}\u0000${sheetId}`);
    }
  }
  if (
    [...observedIdentities].some(
      (identity) => !rowIdentities.includes(identity),
    ) ||
    (runs.every(({ outcome }) => outcome === "captured") &&
      (rows.length !== observedIdentities.size ||
        rowIdentities.some((identity) => !observedIdentities.has(identity))))
  ) {
    return false;
  }
  for (const row of rows) {
    if (
      !characterIds.includes(row.characterId) ||
      !SHA256.test(row.sheetId) ||
      row.expectedOriginMultiplicity !==
        row.expectedOriginCarryCharacterIds.length ||
      row.observedOriginMultiplicity !==
        row.observedOriginCarryCharacterIds.length ||
      row.expectedOriginMultiplicity < 0 ||
      row.observedOriginMultiplicity < 0 ||
      new Set(row.expectedOriginCarryCharacterIds).size !==
        row.expectedOriginCarryCharacterIds.length ||
      new Set(row.observedOriginCarryCharacterIds).size !==
        row.observedOriginCarryCharacterIds.length ||
      row.expectedOriginCarryCharacterIds.some(
        (carryCharacterId) => !carryCharacterIds.includes(carryCharacterId),
      ) ||
      row.observedOriginCarryCharacterIds.some(
        (carryCharacterId) => !carryCharacterIds.includes(carryCharacterId),
      )
    ) {
      return false;
    }
    const observed = runs
      .filter(
        (run) =>
          run.outcome === "captured" &&
          run.sheetsByCharacter[row.characterId]?.sheetId === row.sheetId,
      )
      .map(({ carryCharacterId }) => carryCharacterId);
    if (
      !sameStrings(observed, row.observedOriginCarryCharacterIds) ||
      row.matched !==
        (row.expectedOriginMultiplicity === row.observedOriginMultiplicity &&
          sameStrings(
            row.expectedOriginCarryCharacterIds,
            row.observedOriginCarryCharacterIds,
          ))
    ) {
      return false;
    }
  }
  return true;
}

function stableAllocationSemanticsHold(
  artifacts: StableArtifactAllocationSlot[],
): boolean {
  if (
    artifacts.length !== allSlots.length ||
    !sameStrings(artifacts.map(({ slot }) => slot), allSlots)
  ) {
    return false;
  }
  return artifacts.every((artifact) => {
    if (
      (artifact.rarity !== 4 && artifact.rarity !== 5) ||
      !Number.isInteger(artifact.level) ||
      artifact.level < 0 ||
      artifact.level > (artifact.rarity === 4 ? 16 : 20) ||
      !MAIN_STAT_KEYS.has(artifact.mainStatKey) ||
      !mainStatAllowedForSlot(artifact.slot, artifact.mainStatKey) ||
      artifact.displayedSubstats.length > 4 ||
      !sortedUnique(artifact.displayedSubstats.map(({ key }) => key)) ||
      artifact.derivedLineEvidence.visibleDisplayedSubstatLineCount !==
        artifact.displayedSubstats.length ||
      artifact.derivedLineEvidence.totalRollCount !== null ||
      artifact.derivedLineEvidence.totalRollCountStatus !==
        "unknown-from-rounded-display-values"
    ) {
      return false;
    }
    return artifact.displayedSubstats.every(
      ({ key, value }) =>
        SUBSTAT_KEYS.has(key) &&
        key !== artifact.mainStatKey &&
        Number.isFinite(value) &&
        value > 0 &&
        value === Number(value.toFixed(2)),
    );
  });
}

function canonicalDumpSemanticsHold(
  entries: GeneratedSheetDumpEntry[],
): boolean {
  if (
    !isSorted(
      entries,
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.filterKey, right.filterKey) ||
        left.value - right.value,
    )
  ) {
    return false;
  }
  const identities = new Set<string>();
  for (const entry of entries) {
    const identity = dumpIdentity(entry.key, entry.filterKey);
    if (
      !nonEmpty(entry.key) ||
      !STAT_KEYS.has(entry.key) ||
      !Number.isFinite(entry.value) ||
      entry.value === 0 ||
      identities.has(identity)
    ) {
      return false;
    }
    identities.add(identity);
  }
  return true;
}

function mainStatAllowedForSlot(slot: Slot, stat: MainStat): boolean {
  return (statPools[slot] as readonly string[]).includes(stat);
}

function progressSemanticsHold(
  rows: ProgressObservation[],
  requireFinal: boolean,
): boolean {
  if (rows.length > HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION) {
    return false;
  }
  let previous = -1;
  let done = false;
  for (const [index, row] of rows.entries()) {
    if (
      !nonEmpty(row.phase) ||
      !Number.isFinite(row.progress) ||
      row.progress < 0 ||
      row.progress > 1 ||
      row.progress < previous ||
      done ||
      (row.done &&
        (row.phase !== "done" ||
          row.progress !== 1 ||
          index !== rows.length - 1))
    ) {
      return false;
    }
    previous = row.progress;
    done = row.done;
  }
  return !requireFinal || done;
}

function issueSemanticsHold(
  issue: GeneratedSheetEvidenceIssue,
  nodeId: string,
  carryCharacterId: string,
): boolean {
  return (
    nonEmpty(issue.code) &&
    nonEmpty(issue.path) &&
    nonEmpty(issue.message) &&
    nonEmpty(issue.name) &&
    issue.nodeId === nodeId &&
    issue.carryCharacterId === carryCharacterId
  );
}

function calculateReportContentSha256(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): string {
  return sha256Text(
    stableJson({
      ...report,
      authentication: {
        ...report.authentication,
        reportContentSha256: "",
      },
    }),
  );
}

function calculateResultFingerprint(
  report: BoundedFullTeamGeneratedSheetEvidenceReport,
): string {
  return sha256Text(
    stableJson({
      validationStatus: report.validationStatus,
      comparisonStatus: report.comparisonStatus,
      nodes: report.nodes,
      sheetCatalog: report.sheetCatalog,
      artifactAllocationCatalog: report.artifactAllocationCatalog,
      relationshipSummary: report.relationshipSummary,
      issues: report.issues,
    }),
  );
}

function canonicalSheetDump(sheet: StatSheet): GeneratedSheetDumpEntry[] {
  return [...sheet.dump()]
    .map((entry) => ({ ...entry, value: normalizeNumber(entry.value) }))
    .sort(
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.filterKey, right.filterKey) ||
        left.value - right.value,
    );
}

function buildGeneratorCombo(
  objectiveLines: SourceBackedEquipmentRuntimePreflightReport["objectiveBoundary"]["envelope"]["formulaLines"],
): ComboFormula {
  return {
    id: "bounded-full-team-generated-sheet-evidence-objective",
    label: {
      en: "Bounded full-team generated-sheet evidence objective",
      zh: "有界全队生成面板证据目标",
    },
    lines: objectiveLines.map((line) => ({
      charId: line.characterId,
      formulaId: line.formulaId,
      count: line.count,
      ...(line.reaction ? { reaction: structuredClone(line.reaction) } : {}),
      ...(line.forceOnField === undefined
        ? {}
        : { forceOnField: line.forceOnField }),
    })),
  };
}

function requireFourConfigs(
  configs: TeamSlotConfig[] | null,
): TeamSlotConfig[] {
  if (!configs || configs.length !== 4) {
    throw new Error("Authenticated complete preflight node must have four configs.");
  }
  return cloneTeamConfigs(configs);
}

function cloneTeamConfigs(configs: readonly TeamSlotConfig[]): TeamSlotConfig[] {
  return configs.map((config) => ({
    ...config,
    artifactSet:
      config.artifactSet?.type === "4pc"
        ? { ...config.artifactSet }
        : config.artifactSet?.type === "2pc+2pc"
          ? {
              ...config.artifactSet,
              halfSetIds: [...config.artifactSet.halfSetIds],
            }
          : null,
    talentLevels: config.talentLevels
      ? { ...config.talentLevels }
      : undefined,
  }));
}

function validateGeneratedFrom(
  rows: Array<{ path: string; sha256: string }>,
  issues: GeneratedSheetEvidenceIssue[],
): void {
  if (!generatedFromSemanticsHold(rows)) {
    issues.push(
      makeIssue(
        "input.invalid_generated_from",
        "input",
        "generatedFrom",
        "Generated-from rows must be unique, path-sorted, nonblank, and lowercase SHA-256 authenticated.",
      ),
    );
  }
}

function generatedFromSemanticsHold(
  rows: Array<{ path: string; sha256: string }>,
): boolean {
  return rows.every(
    ({ path, sha256 }, index) =>
      nonEmpty(path) &&
      SHA256.test(sha256) &&
      (index === 0 || compareText(rows[index - 1].path, path) < 0),
  );
}

function makeIssue(
  code: string,
  stage: GeneratedSheetEvidenceIssue["stage"],
  path: string,
  message: string,
): GeneratedSheetEvidenceIssue {
  return { code, stage, path, message, name: "GeneratedSheetEvidenceIssue" };
}

function serializeIssue(
  error: unknown,
  context: Pick<GeneratedSheetEvidenceIssue, "stage" | "path"> &
    Partial<
      Pick<
        GeneratedSheetEvidenceIssue,
        "nodeId" | "carryCharacterId" | "characterId"
      >
    >,
): GeneratedSheetEvidenceIssue {
  return {
    code:
      error instanceof GeneratedSheetEvidenceFailure
        ? error.code
        : `${context.stage}.failed`,
    stage:
      error instanceof GeneratedSheetEvidenceFailure
        ? error.stage
        : context.stage,
    path: context.path,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "NonErrorThrow",
    ...(context.nodeId ? { nodeId: context.nodeId } : {}),
    ...(context.carryCharacterId
      ? { carryCharacterId: context.carryCharacterId }
      : {}),
    ...(context.characterId ? { characterId: context.characterId } : {}),
  };
}

function inferStage(
  error: unknown,
  fallback: GeneratedSheetEvidenceIssue["stage"],
): GeneratedSheetEvidenceIssue["stage"] {
  return error instanceof GeneratedSheetEvidenceFailure
    ? error.stage
    : fallback;
}

function compareSheetOccurrence(
  left: GeneratedSheetOccurrenceContext,
  right: GeneratedSheetOccurrenceContext,
): number {
  return (
    compareText(left.nodeId, right.nodeId) ||
    compareText(left.carryCharacterId, right.carryCharacterId) ||
    compareText(left.characterId, right.characterId) ||
    compareText(left.allocationId, right.allocationId)
  );
}

function compareAllocationOccurrence(
  left: ArtifactAllocationOccurrenceContext,
  right: ArtifactAllocationOccurrenceContext,
): number {
  return (
    compareText(left.nodeId, right.nodeId) ||
    compareText(left.carryCharacterId, right.carryCharacterId) ||
    compareText(left.characterId, right.characterId) ||
    compareText(left.sheetId, right.sheetId)
  );
}

function isSorted<T>(values: T[], compare: (left: T, right: T) => number): boolean {
  return values.every(
    (value, index) => index === 0 || compare(values[index - 1], value) <= 0,
  );
}

function sortedUnique(values: string[]): boolean {
  return values.every(
    (value, index) =>
      nonEmpty(value) &&
      (index === 0 || compareText(values[index - 1], value) < 0),
  );
}

function sortTextRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot normalize non-finite generated-sheet value ${value}.`);
  }
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nonEmpty(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
