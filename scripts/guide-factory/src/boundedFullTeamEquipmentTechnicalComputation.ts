import "@/lib/dmgcalc";

import type { StatKey } from "@/data/enums";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type {
  BuffActivationMap,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import {
  runGenerator as runRuntimeGenerator,
  type GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import {
  bootstrapGuideFactoryComputation,
  replayTeamDamage,
  type ReplayComboLine,
  type ReplayTeamConfigs,
} from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import {
  isCompleteSourceBackedEquipmentRuntimePreflightReport,
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport,
  type SourceBackedEquipmentRuntimeObjectiveLine,
  type SourceBackedEquipmentRuntimePreflightReport,
} from "./sourceBackedEquipmentRuntimePreflight";

const SHA256 = /^[a-f0-9]{64}$/;
const DECIMAL_INTEGER = /^(0|[1-9][0-9]*)$/;
const HARD_MAXIMUM_CARTESIAN_REPLAYS = 9_216n;
const HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION = 64;
const ABSOLUTE_CALCULATOR_TOLERANCE = 1e-9;
const RELATIVE_CALCULATOR_TOLERANCE = 1e-12;

type SheetDumpEntry = { key: StatKey; filterKey: string; value: number };

export type BoundedFullTeamEquipmentTechnicalExecutionPolicy = {
  policyId: string;
  maximumGeneratorInvocations: string;
  maximumCartesianReplays: string;
};

export type BoundedFullTeamEquipmentTechnicalComputationInput = {
  preflight: SourceBackedEquipmentRuntimePreflightReport;
  executionPolicy: BoundedFullTeamEquipmentTechnicalExecutionPolicy;
  generatedFrom: Array<{ path: string; sha256: string }>;
};

export type BoundedFullTeamEquipmentGeneratorRequest = {
  nodeId: string;
  carryCharacterId: string;
  teamConfigs: TeamSlotConfig[];
  objectiveLines: SourceBackedEquipmentRuntimeObjectiveLine[];
  combatOptions: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["combatOptions"];
  enemyAura: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["enemyAura"];
  extraBuffs: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["extraBuffs"];
  calcContext: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["calcContext"];
};

export type BoundedFullTeamEquipmentGeneratorInvocation = {
  /** Object identity is audited across every invocation. */
  runtimeIdentity: object;
  observedTeamConfigs: TeamSlotConfig[];
  results: AsyncIterable<GeneratorResult>;
};

export type BoundedFullTeamEquipmentEvaluationRequest = {
  replayId: string;
  nodeId: string;
  teamConfigs: ReplayTeamConfigs;
  objectiveLines: SourceBackedEquipmentRuntimeObjectiveLine[];
  artifactSheets: Record<string, StatSheet>;
  combatOptions: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["combatOptions"];
  enemyAura: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["enemyAura"];
  extraBuffs: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["extraBuffs"];
  calcContext: SourceBackedEquipmentRuntimePreflightReport["runtimeBoundary"]["assumptions"]["calcContext"];
  sourceTeamRecordId: string;
};

export type BoundedFullTeamEquipmentEvaluationObservation = {
  formulaCoverage: Array<{
    characterId: string;
    formulaId: string;
    available: boolean;
  }>;
  computedBuffOverrides: Record<string, BuffActivationMap>;
  calculatorAgreement: {
    passed: boolean;
    directTotalDamage: number;
    compiledTotalDamage: number;
    absoluteDifference: number;
    allowedDifference: number;
  };
  totalDamage: number;
};

export type BoundedFullTeamEquipmentTechnicalComputationEnvironment = {
  environmentId: string;
  bootstrap: () => Promise<void>;
  createGeneratorInvocation: (
    request: BoundedFullTeamEquipmentGeneratorRequest,
  ) => BoundedFullTeamEquipmentGeneratorInvocation;
  evaluateComposition: (
    request: BoundedFullTeamEquipmentEvaluationRequest,
  ) => Promise<BoundedFullTeamEquipmentEvaluationObservation>;
};

export type BoundedFullTeamEquipmentTechnicalIssue = {
  code: string;
  stage: "input" | "generator" | "capture" | "replay";
  path: string;
  message: string;
  name: string;
  nodeId?: string;
  carryCharacterId?: string;
  compositionId?: string;
};

type ProgressObservation = {
  phase: string;
  progress: number;
  done: boolean;
};

export type BoundedFullTeamEquipmentGeneratorRunObservation =
  | {
      carryCharacterId: string;
      outcome: "captured";
      progress: ProgressObservation[];
      observedTeamConfigsSha256: string;
      sheetFingerprintsByCharacter: Record<string, string>;
    }
  | {
      carryCharacterId: string;
      outcome: "not-comparable";
      progress: ProgressObservation[];
      failure: BoundedFullTeamEquipmentTechnicalIssue;
    };

export type BoundedFullTeamEquipmentSheetPoolCell = {
  nodeId: string;
  characterId: string;
  sheetId: string;
  originCarryCharacterIds: string[];
  originMultiplicity: number;
};

export type BoundedFullTeamEquipmentCompositionProvenance = {
  classification:
    | "intact-generator-endpoint"
    | "cross-endpoint-recombination";
  originCarryCharacterIds: string[];
  originMultiplicity: number;
};

export type BoundedFullTeamEquipmentCompositionObservation = {
  sequence: number;
  compositionId: string;
  sheetsByCharacter: Record<
    string,
    {
      nodeId: string;
      sheetId: string;
      originCarryCharacterIds: string[];
    }
  >;
  provenance: BoundedFullTeamEquipmentCompositionProvenance;
  outcome: "evaluated" | "evaluation-failed";
  unreviewedTechnicalObjective: number | null;
  computedBuffOverridesSha256: string | null;
  calculatorAgreement: {
    passed: true;
    interpretedObjective: number;
    compiledObjective: number;
    absoluteDifference: number;
    allowedDifference: number;
  } | null;
  failure: BoundedFullTeamEquipmentTechnicalIssue | null;
};

export type BoundedFullTeamEquipmentTechnicalReference = {
  compositionId: string;
  unreviewedTechnicalObjective: number;
  provenance: BoundedFullTeamEquipmentCompositionProvenance["classification"];
  equivalentCompositionIds: string[];
  representativeSelectionPolicy: "first-enumerated-exact-objective-tie";
};

export type BoundedFullTeamEquipmentTechnicalNodeObservation = {
  sequence: number;
  nodeId: string;
  materializedConfigsSha256: string;
  comparisonStatus: "comparable" | "not-comparable";
  generatorRuns: BoundedFullTeamEquipmentGeneratorRunObservation[];
  sheetPoolsByCharacter: Record<
    string,
    BoundedFullTeamEquipmentSheetPoolCell[]
  >;
  poolSizesByCharacter: Record<string, number>;
  expectedCartesianCompositionCount: string | null;
  observedCartesianCompositionCount: number;
  provenanceSummary: {
    intactGeneratorEndpointCompositionCount: number;
    crossEndpointRecombinationCount: number;
  };
  compositions: BoundedFullTeamEquipmentCompositionObservation[];
  boundedTechnicalReference: BoundedFullTeamEquipmentTechnicalReference | null;
  intactGeneratorEndpointTechnicalReference: BoundedFullTeamEquipmentTechnicalReference | null;
  boundedReferenceOverIntact: {
    status: "available" | "undefined-zero-intact" | "not-comparable";
    absoluteDelta: number | null;
    ratio: number | null;
  };
  issues: BoundedFullTeamEquipmentTechnicalIssue[];
};

export type BoundedFullTeamEquipmentGlobalTechnicalReference = {
  nodeId: string;
  compositionId: string;
  unreviewedTechnicalObjective: number;
  provenance: BoundedFullTeamEquipmentCompositionProvenance["classification"];
  equivalentReferences: Array<{ nodeId: string; compositionId: string }>;
  representativeSelectionPolicy: "first-node-then-enumerated-exact-objective-tie";
};

export type BoundedFullTeamEquipmentObjectiveDistribution = {
  scope: "complete-domain" | "partial-diagnostic";
  observationCount: number;
  uniqueExactValueCount: number;
  exactTieClassCount: number;
  observationsInExactTieClasses: number;
  maximumExactTieClassSize: number;
  exactTieClassSizeHistogram: Record<string, number>;
  minimum: number;
  percentile25: number;
  median: number;
  mean: number;
  percentile75: number;
  maximum: number;
};

export type BoundedFullTeamEquipmentTechnicalComputationReport = {
  schemaVersion: 1;
  classification: "bounded-full-team-equipment-technical-computation";
  validationStatus:
    | "withheld-invalid-input"
    | "withheld-incomplete-generation"
    | "withheld-post-generation-cap"
    | "withheld-incomplete-replay"
    | "completed-technical-objective";
  comparisonStatus: "comparable" | "not-comparable";
  capabilities: {
    sourceClaims: false;
    guideClaims: false;
    teamRecommendationClaims: false;
    equipmentRecommendationClaims: false;
    rankClaims: false;
    gameplayClaims: false;
    damageClaims: false;
    dpsClaims: false;
    optimalityClaims: false;
    energyRecoveryClaims: false;
  };
  generatorExecuted: boolean;
  damageComputationExecuted: boolean;
  rankingProduced: false;
  recommendationProduced: false;
  guideProduced: false;
  optimizerExecuted: false;
  energyRecoveryInputsUsed: false;
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsOptimality: false;
  supportsEnergyRequirements: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: {
    preflightAuthenticated: boolean;
    preflightComplete: boolean;
    preflightValidationStatus: string;
    preflightReportSha256: string;
    preflightReportContentSha256: string | null;
    sourceLatticeSha256: string | null;
    nodeCount: number;
    nodeIds: string[];
    teamCharacterIds: string[];
    carryCharacterIds: string[];
    objectiveId: string | null;
    objectiveFormulaLinesSha256: string | null;
    objectiveEnvelopeSha256: string | null;
    objectiveReviewStatus: "unreviewed" | "reviewed" | null;
    sourceBindingEstablishedByCaller: boolean | null;
    sourceReadyForDamageReplay: boolean | null;
    sourceReadinessBlockerCount: number;
    runtimeAssumptionsSha256: string | null;
    calcContextSha256: string | null;
    executionPolicy: BoundedFullTeamEquipmentTechnicalExecutionPolicy;
    executionPolicySha256: string;
  };
  execution: {
    environmentId: string;
    scheduling: "sequential";
    nodeLocalSheetPoolsOnly: true;
    crossNodeSheetCompositionsAllowed: false;
    canonicalSheetDeduplication: true;
    freshRuntimeIdentityPerGeneratorInvocation: true;
    warmStartSupported: false;
    perCharacterConstraintsPassed: false;
    energyRecoveryThresholdsPassed: false;
    explicitGeneratorBuffOverridesPassed: false;
    explicitFormulaBuffOverridesPassedToReplay: false;
    countArithmetic: "bigint-decimal";
    hardMaximumGeneratorResultEmissionsPerInvocation: "64";
    hardMaximumCartesianReplays: "9216";
    bootstrapCalls: number;
    plannedGeneratorInvocations: string | null;
    maximumGeneratorInvocations: string;
    theoreticalMaximumCartesianReplays: string | null;
    maximumCartesianReplays: string;
    observedGeneratorInvocations: number;
    freshRuntimeIdentityCount: number;
    capturedGeneratorResultCount: number;
    knownCompleteNodeExpectedReplayCount: string;
    fullDomainExpectedReplayCount: string | null;
    observedReplayCalls: number;
    successfulReplayCount: number;
  };
  provenanceSummary: {
    intactGeneratorEndpointCompositionCount: number;
    crossEndpointRecombinationCount: number;
  };
  nodes: BoundedFullTeamEquipmentTechnicalNodeObservation[];
  objectiveDistribution: BoundedFullTeamEquipmentObjectiveDistribution | null;
  boundedTechnicalReference: BoundedFullTeamEquipmentGlobalTechnicalReference | null;
  intactGeneratorEndpointTechnicalReference: BoundedFullTeamEquipmentGlobalTechnicalReference | null;
  issues: BoundedFullTeamEquipmentTechnicalIssue[];
  cautions: string[];
  authentication: {
    preflightReportSha256: string;
    preflightReportContentSha256: string | null;
    objectiveEnvelopeSha256: string | null;
    runtimeAssumptionsSha256: string | null;
    calcContextSha256: string | null;
    executionPolicySha256: string;
    resultFingerprintSha256: string | null;
    reportContentSha256: string;
  };
};

type CapturedRun = {
  carryCharacterId: string;
  observation: Extract<
    BoundedFullTeamEquipmentGeneratorRunObservation,
    { outcome: "captured" }
  >;
  sheetsByCharacter: Record<string, StatSheet>;
};

type PrivatePoolCell = BoundedFullTeamEquipmentSheetPoolCell & {
  entries: SheetDumpEntry[];
};

type NodeState = {
  node: SourceBackedEquipmentRuntimePreflightReport["nodes"][number];
  sequence: number;
  configs: ReplayTeamConfigs;
  runs: BoundedFullTeamEquipmentGeneratorRunObservation[];
  captures: CapturedRun[];
  issues: BoundedFullTeamEquipmentTechnicalIssue[];
};

type PreparedNode = {
  state: NodeState;
  pools: Record<string, PrivatePoolCell[]>;
  expectedCount: bigint | null;
};

type InputContext = {
  preflightAuthenticated: boolean;
  preflightComplete: boolean;
  preflightReportSha256: string;
  preflightReportContentSha256: string | null;
  sourceLatticeSha256: string | null;
  nodeIds: string[];
  teamCharacterIds: string[];
  carryCharacterIds: string[];
  objectiveId: string | null;
  objectiveFormulaLinesSha256: string | null;
  objectiveEnvelopeSha256: string | null;
  objectiveReviewStatus: "unreviewed" | "reviewed" | null;
  sourceBindingEstablishedByCaller: boolean | null;
  sourceReadyForDamageReplay: boolean | null;
  sourceReadinessBlockerCount: number;
  runtimeAssumptionsSha256: string | null;
  calcContextSha256: string | null;
  executionPolicySha256: string;
  plannedGeneratorInvocations: string | null;
  theoreticalMaximumCartesianReplays: string | null;
};

class TechnicalComputationFailure extends Error {
  override readonly name = "TechnicalComputationFailure";

  constructor(
    readonly code: string,
    readonly stage: BoundedFullTeamEquipmentTechnicalIssue["stage"],
    message: string,
  ) {
    super(message);
  }
}

const DEFAULT_ENVIRONMENT: BoundedFullTeamEquipmentTechnicalComputationEnvironment = {
  environmentId: "existing-generator-and-replay-runtime-v1",
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
  async evaluateComposition(request) {
    const output = await replayTeamDamage({
      replayId: request.replayId,
      evidence: {
        classification: "structural_smoke",
        supportsGuideClaims: false,
        notes: [
          "Bounded full-team equipment computation under a possibly unreviewed technical objective only.",
          "The cited knowledge record supports the roster only. Its rotation text is an upstream input to a wrapper-authored, unreviewed formula translation; it does not contain a source-authored damage plan.",
          "Equipment selections and investment assumptions are authored by the authenticated runtime wrappers; they are not asserted as facts supported by the source team record.",
        ],
        sourceRefs: [
          {
            kind: "knowledge_record",
            recordId: request.sourceTeamRecordId,
            supports: ["roster"],
          },
        ],
      },
      teamConfigs: cloneTeamConfigs(
        request.teamConfigs,
      ) as unknown as ReplayTeamConfigs,
      combatOptions: { ...request.combatOptions },
      enemyAura: request.enemyAura,
      extraBuffs: structuredClone(request.extraBuffs),
      calcContext: { ...request.calcContext },
      combo: {
        id: "bounded-full-team-equipment-technical-objective",
        label: {
          en: "Bounded full-team technical objective",
          zh: "有界全队技术目标",
        },
        lines: toReplayLines(request.objectiveLines),
      },
      artifactSheets: { ...request.artifactSheets },
      formulaBuffOverrides: null,
    });
    return {
      formulaCoverage: output.validation.formulaCoverage.map((row) => ({
        characterId: row.charId,
        formulaId: row.formulaId,
        available: row.available,
      })),
      computedBuffOverrides: output.validation.computedBuffOverrides,
      calculatorAgreement: {
        passed: output.validation.calculatorAgreement.passed,
        directTotalDamage:
          output.validation.calculatorAgreement.directTotalDamage,
        compiledTotalDamage:
          output.validation.calculatorAgreement.compiledTotalDamage,
        absoluteDifference:
          output.validation.calculatorAgreement.absoluteDifference,
        allowedDifference:
          output.validation.calculatorAgreement.allowedDifference,
      },
      totalDamage: output.result.totalDamage,
    };
  },
};

/**
 * Run every materialized CP37 node through four fresh carry generators and the
 * complete node-local sheet product. Partial runtime failures remain typed
 * observations, but any returned reference is withheld outside its complete
 * domain.
 */
export async function runBoundedFullTeamEquipmentTechnicalComputation(
  rawInput: BoundedFullTeamEquipmentTechnicalComputationInput,
  environment: BoundedFullTeamEquipmentTechnicalComputationEnvironment =
    DEFAULT_ENVIRONMENT,
): Promise<BoundedFullTeamEquipmentTechnicalComputationReport> {
  const input = structuredClone(rawInput);
  const inputIssues = validateInput(input, environment);
  const context = buildInputContext(input);
  if (inputIssues.length > 0) {
    return finalizeReport(
      emptyReport(input, environment.environmentId, context, inputIssues),
    );
  }

  const preflight = input.preflight;
  const assumptions = preflight.runtimeBoundary.assumptions;
  const objective = preflight.objectiveBoundary.envelope;
  const characterIds = preflight.inputBoundary.teamMembers.map(
    ({ characterId }) => characterId,
  );
  const carryCharacterIds = [...assumptions.carryCharacterIds];
  const nodes = preflight.nodes;
  let bootstrapCalls = 0;
  await environment.bootstrap();
  bootstrapCalls += 1;

  let observedGeneratorInvocations = 0;
  const runtimeIdentities = new Set<object>();
  let capturedGeneratorResultCount = 0;
  const nodeStates: NodeState[] = [];

  for (const [nodeIndex, node] of nodes.entries()) {
    const configs = requireFourConfigs(node.materializedConfigs);
    const runs: BoundedFullTeamEquipmentGeneratorRunObservation[] = [];
    const captures: CapturedRun[] = [];
    const issues: BoundedFullTeamEquipmentTechnicalIssue[] = [];
    for (const carryCharacterId of carryCharacterIds) {
      const progress: ProgressObservation[] = [];
      try {
        observedGeneratorInvocations += 1;
        const invocation = environment.createGeneratorInvocation({
          nodeId: node.nodeId,
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
          node.nodeId,
          carryCharacterId,
        );
        runtimeIdentities.add(invocation.runtimeIdentity);
        let finalResult: GeneratorResult | null = null;
        let previousProgress = -1;
        let sawDone = false;
        let resultEmissionCount = 0;
        for await (const result of invocation.results) {
          resultEmissionCount += 1;
          if (
            resultEmissionCount >
            HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION
          ) {
            throw new TechnicalComputationFailure(
              "generator.result_emission_cap_exceeded",
              "capture",
              `${node.nodeId}/${carryCharacterId} emitted more than ${HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION} generator results.`,
            );
          }
          validateProgress(
            result,
            previousProgress,
            sawDone,
            node.nodeId,
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
          throw new TechnicalComputationFailure(
            "generator.missing_final_result",
            "capture",
            "Generator completed without exactly one done=true result.",
          );
        }
        const capture = captureFinalResult(
          finalResult,
          characterIds,
          carryCharacterId,
          node.nodeId,
          progress,
          invocation.observedTeamConfigs,
        );
        capturedGeneratorResultCount += 1;
        captures.push(capture);
        runs.push(capture.observation);
      } catch (error) {
        const issue = serializeIssue(error, {
          stage: inferStage(error, "generator"),
          path: `nodes.${node.nodeId}.generator.${carryCharacterId}`,
          nodeId: node.nodeId,
          carryCharacterId,
        });
        issues.push(issue);
        runs.push({
          carryCharacterId,
          outcome: "not-comparable",
          progress,
          failure: issue,
        });
      }
    }
    nodeStates.push({
      node,
      sequence: nodeIndex,
      configs,
      runs,
      captures,
      issues,
    });
  }

  const preparedNodes = nodeStates.map((state) => prepareNode(state, characterIds));
  const knownExpectedReplayCount = preparedNodes.reduce(
    (sum, { expectedCount }) => sum + (expectedCount ?? 0n),
    0n,
  );
  const allNodesGenerated = preparedNodes.every(
    ({ expectedCount }) => expectedCount !== null,
  );
  const maximumCartesianReplays = BigInt(
    input.executionPolicy.maximumCartesianReplays,
  );
  const postGenerationCapExceeded =
    knownExpectedReplayCount > maximumCartesianReplays;

  const publicNodes: BoundedFullTeamEquipmentTechnicalNodeObservation[] = [];
  let observedReplayCalls = 0;
  let successfulReplayCount = 0;

  for (const prepared of preparedNodes) {
    const base = publicNodeBase(prepared, characterIds);
    if (prepared.expectedCount === null || postGenerationCapExceeded) {
      publicNodes.push({
        ...base,
        comparisonStatus: "not-comparable",
        observedCartesianCompositionCount: 0,
        provenanceSummary: {
          intactGeneratorEndpointCompositionCount: 0,
          crossEndpointRecombinationCount: 0,
        },
        compositions: [],
        boundedTechnicalReference: null,
        intactGeneratorEndpointTechnicalReference: null,
        boundedReferenceOverIntact: notComparableLift(),
      });
      continue;
    }

    const selections = enumerateCartesian(characterIds, prepared.pools);
    if (BigInt(selections.length) !== prepared.expectedCount) {
      throw new Error(
        `${prepared.state.node.nodeId}: Cartesian enumeration violated its exact postcondition.`,
      );
    }
    const compositions: BoundedFullTeamEquipmentCompositionObservation[] = [];
    for (const [compositionIndex, selection] of selections.entries()) {
      const compositionId = compositionIdFor(
        prepared.state.node.nodeId,
        characterIds,
        selection,
      );
      const provenance = compositionProvenance(
        characterIds,
        carryCharacterIds,
        selection,
      );
      try {
        observedReplayCalls += 1;
        const evaluation = await environment.evaluateComposition({
          replayId: compositionId,
          nodeId: prepared.state.node.nodeId,
          teamConfigs: cloneTeamConfigs(
            prepared.state.configs,
          ) as unknown as ReplayTeamConfigs,
          objectiveLines: structuredClone(objective.formulaLines),
          artifactSheets: Object.fromEntries(
            characterIds.map((characterId) => [
              characterId,
              StatSheet.fromDump(selection[characterId].entries),
            ]),
          ),
          combatOptions: { ...assumptions.combatOptions },
          enemyAura: assumptions.enemyAura,
          extraBuffs: structuredClone(assumptions.extraBuffs),
          calcContext: { ...assumptions.calcContext },
          sourceTeamRecordId: objective.sourceTeamRecordId,
        });
        validateEvaluation(evaluation, objective.formulaLines, compositionId);
        successfulReplayCount += 1;
        const interpretedObjective = normalizeNumber(
          evaluation.calculatorAgreement.directTotalDamage,
        );
        const compiledObjective = normalizeNumber(
          evaluation.calculatorAgreement.compiledTotalDamage,
        );
        compositions.push({
          sequence: compositionIndex,
          compositionId,
          sheetsByCharacter: publicSelection(characterIds, selection),
          provenance,
          outcome: "evaluated",
          unreviewedTechnicalObjective: normalizeNumber(
            evaluation.totalDamage,
          ),
          computedBuffOverridesSha256: sha256Text(
            stableJson(evaluation.computedBuffOverrides),
          ),
          calculatorAgreement: {
            passed: true,
            interpretedObjective,
            compiledObjective,
            absoluteDifference: normalizeNumber(
              Math.abs(interpretedObjective - compiledObjective),
            ),
            allowedDifference: canonicalCalculatorAllowedDifference(
              interpretedObjective,
              compiledObjective,
            ),
          },
          failure: null,
        });
      } catch (error) {
        const failure = serializeIssue(error, {
          stage: "replay",
          path: `nodes.${prepared.state.node.nodeId}.compositions.${compositionId}`,
          nodeId: prepared.state.node.nodeId,
          compositionId,
        });
        compositions.push({
          sequence: compositionIndex,
          compositionId,
          sheetsByCharacter: publicSelection(characterIds, selection),
          provenance,
          outcome: "evaluation-failed",
          unreviewedTechnicalObjective: null,
          computedBuffOverridesSha256: null,
          calculatorAgreement: null,
          failure,
        });
      }
    }
    const compositionIssues = compositions.flatMap(({ failure }) =>
      failure ? [failure] : [],
    );
    const complete =
      compositionIssues.length === 0 &&
      BigInt(compositions.length) === prepared.expectedCount;
    const references = complete
      ? buildNodeReferences(compositions)
      : emptyNodeReferences();
    const provenanceSummary = summarizeProvenance(compositions);
    publicNodes.push({
      ...base,
      comparisonStatus: complete ? "comparable" : "not-comparable",
      observedCartesianCompositionCount: compositions.length,
      provenanceSummary,
      compositions,
      ...references,
      issues: [...base.issues, ...compositionIssues],
    });
  }

  const allNodesComparable =
    publicNodes.length === nodes.length &&
    publicNodes.every(({ comparisonStatus }) => comparisonStatus === "comparable");
  const anyGenerationFailure = publicNodes.some((node) =>
    node.generatorRuns.some(({ outcome }) => outcome === "not-comparable"),
  );
  const anyReplayFailure = publicNodes.some((node) =>
    node.compositions.some(({ outcome }) => outcome === "evaluation-failed"),
  );
  const validationStatus: BoundedFullTeamEquipmentTechnicalComputationReport["validationStatus"] =
    postGenerationCapExceeded
      ? "withheld-post-generation-cap"
      : anyGenerationFailure
        ? "withheld-incomplete-generation"
        : anyReplayFailure
          ? "withheld-incomplete-replay"
          : "completed-technical-objective";
  const allEvaluated = publicNodes.flatMap((node) =>
    node.compositions.filter(isEvaluatedComposition).map((composition) => ({
      nodeId: node.nodeId,
      composition,
    })),
  );
  const globalReferences = allNodesComparable
    ? buildGlobalReferences(allEvaluated)
    : { bounded: null, intact: null };
  const provenanceSummary = summarizeProvenance(
    publicNodes.flatMap(({ compositions }) => compositions),
  );
  const issues = [
    ...publicNodes.flatMap(({ issues: nodeIssues }) => nodeIssues),
    ...(postGenerationCapExceeded
      ? [
          makeIssue(
            "bounds.dynamic_replay_cap_exceeded",
            "input",
            "execution.knownCompleteNodeExpectedReplayCount",
            `The deduplicated node-local product requires ${knownExpectedReplayCount.toString()} replays, above the ${maximumCartesianReplays.toString()} cap.`,
          ),
        ]
      : []),
  ];

  const report: BoundedFullTeamEquipmentTechnicalComputationReport = {
    ...reportHeader(input, context),
    validationStatus,
    comparisonStatus: allNodesComparable ? "comparable" : "not-comparable",
    generatorExecuted: observedGeneratorInvocations > 0,
    damageComputationExecuted: observedReplayCalls > 0,
    execution: {
      ...fixedExecution(environment.environmentId, input.executionPolicy),
      bootstrapCalls,
      plannedGeneratorInvocations: context.plannedGeneratorInvocations,
      theoreticalMaximumCartesianReplays:
        context.theoreticalMaximumCartesianReplays,
      observedGeneratorInvocations,
      freshRuntimeIdentityCount: runtimeIdentities.size,
      capturedGeneratorResultCount,
      knownCompleteNodeExpectedReplayCount:
        knownExpectedReplayCount.toString(),
      fullDomainExpectedReplayCount: allNodesGenerated
        ? knownExpectedReplayCount.toString()
        : null,
      observedReplayCalls,
      successfulReplayCount,
    },
    provenanceSummary,
    nodes: publicNodes,
    objectiveDistribution:
      allEvaluated.length > 0
        ? buildDistribution(
            allEvaluated.map(
              ({ composition }) =>
                composition.unreviewedTechnicalObjective as number,
            ),
            allNodesComparable ? "complete-domain" : "partial-diagnostic",
          )
        : null,
    boundedTechnicalReference: globalReferences.bounded,
    intactGeneratorEndpointTechnicalReference: globalReferences.intact,
    issues,
    cautions: fixedCautions(),
    authentication: {
      ...authenticationInputs(context),
      resultFingerprintSha256: null,
      reportContentSha256: "",
    },
  };
  return finalizeReport(report);
}

function validateInput(
  input: BoundedFullTeamEquipmentTechnicalComputationInput,
  environment: BoundedFullTeamEquipmentTechnicalComputationEnvironment,
): BoundedFullTeamEquipmentTechnicalIssue[] {
  const issues: BoundedFullTeamEquipmentTechnicalIssue[] = [];
  if (!nonEmpty(environment.environmentId)) {
    issues.push(
      makeIssue(
        "input.invalid_environment_id",
        "input",
        "environment.environmentId",
        "Technical computation environment ID must be nonblank.",
      ),
    );
  }
  let authenticated = false;
  try {
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      input.preflight,
    );
    authenticated = true;
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
    authenticated &&
    !isCompleteSourceBackedEquipmentRuntimePreflightReport(input.preflight)
  ) {
    issues.push(
      makeIssue(
        "input.preflight_incomplete",
        "input",
        "preflight.validationStatus",
        "The technical computation requires a complete runtime-materialization preflight.",
      ),
    );
  }

  if (!nonEmpty(input.executionPolicy.policyId)) {
    issues.push(
      makeIssue(
        "input.invalid_policy_id",
        "input",
        "executionPolicy.policyId",
        "Execution policy ID must be nonblank.",
      ),
    );
  }
  const maximumGeneratorInvocations = parsePositiveBound(
    input.executionPolicy.maximumGeneratorInvocations,
    "executionPolicy.maximumGeneratorInvocations",
    issues,
  );
  const maximumCartesianReplays = parsePositiveBound(
    input.executionPolicy.maximumCartesianReplays,
    "executionPolicy.maximumCartesianReplays",
    issues,
  );
  validateGeneratedFrom(input.generatedFrom, issues);

  if (!authenticated) return issues;
  const { assumptions } = input.preflight.runtimeBoundary;
  if (
    assumptions.energyRecoveryThresholds !== null ||
    assumptions.perCharacterConstraints !== null ||
    containsEnergyInput(assumptions)
  ) {
    issues.push(
      makeIssue(
        "input.energy_or_constraints_present",
        "input",
        "preflight.runtimeBoundary.assumptions",
        "This phase requires ER thresholds and per-character constraints to remain absent.",
      ),
    );
  }
  const characterIds = input.preflight.inputBoundary.teamMembers.map(
    ({ characterId }) => characterId,
  );
  if (
    characterIds.length !== 4 ||
    new Set(characterIds).size !== 4 ||
    assumptions.carryCharacterIds.length !== characterIds.length ||
    new Set(assumptions.carryCharacterIds).size !== characterIds.length ||
    !sameStrings(assumptions.carryCharacterIds, characterIds)
  ) {
    issues.push(
      makeIssue(
        "input.carry_domain_mismatch",
        "input",
        "preflight.runtimeBoundary.assumptions.carryCharacterIds",
        "Carry IDs must exactly and uniquely cover the four materialized team characters in team order.",
      ),
    );
  }
  const nodeIds = input.preflight.nodes.map(({ nodeId }) => nodeId);
  if (
    nodeIds.length === 0 ||
    new Set(nodeIds).size !== nodeIds.length ||
    nodeIds.length !== input.preflight.inputBoundary.latticeNodeCount
  ) {
    issues.push(
      makeIssue(
        "input.node_domain_mismatch",
        "input",
        "preflight.nodes",
        "The exact full materialized node domain must be unique and complete.",
      ),
    );
  }

  if (
    maximumGeneratorInvocations !== null &&
    BigInt(nodeIds.length) * BigInt(assumptions.carryCharacterIds.length) >
      maximumGeneratorInvocations
  ) {
    issues.push(
      makeIssue(
        "bounds.generator_cap_exceeded",
        "input",
        "executionPolicy.maximumGeneratorInvocations",
        "The exact full-domain generator invocation count exceeds the declared cap.",
      ),
    );
  }
  if (maximumCartesianReplays !== null) {
    if (maximumCartesianReplays > HARD_MAXIMUM_CARTESIAN_REPLAYS) {
      issues.push(
        makeIssue(
          "bounds.replay_policy_exceeds_hard_cap",
          "input",
          "executionPolicy.maximumCartesianReplays",
          `The replay policy cap cannot exceed the hard ${HARD_MAXIMUM_CARTESIAN_REPLAYS.toString()}-replay safety boundary.`,
        ),
      );
    }
    const theoretical =
      BigInt(nodeIds.length) *
      BigInt(assumptions.carryCharacterIds.length) ** BigInt(characterIds.length);
    const effectiveMaximum =
      maximumCartesianReplays < HARD_MAXIMUM_CARTESIAN_REPLAYS
        ? maximumCartesianReplays
        : HARD_MAXIMUM_CARTESIAN_REPLAYS;
    if (theoretical > effectiveMaximum) {
      issues.push(
        makeIssue(
          "bounds.theoretical_replay_cap_exceeded",
          "input",
          "executionPolicy.maximumCartesianReplays",
          `The theoretical node-local product requires up to ${theoretical.toString()} replays, above the effective ${effectiveMaximum.toString()} cap.`,
        ),
      );
    }
  }
  return issues;
}

function buildInputContext(
  input: BoundedFullTeamEquipmentTechnicalComputationInput,
): InputContext {
  let preflightAuthenticated = false;
  try {
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
      input.preflight,
    );
    preflightAuthenticated = true;
  } catch {
    // The withheld report still binds the supplied bytes through its hash.
  }
  const preflightComplete =
    preflightAuthenticated &&
    isCompleteSourceBackedEquipmentRuntimePreflightReport(input.preflight);
  const teamCharacterIds = input.preflight.inputBoundary?.teamMembers?.map(
    ({ characterId }) => characterId,
  ) ?? [];
  const carryCharacterIds =
    input.preflight.runtimeBoundary?.assumptions?.carryCharacterIds ?? [];
  const nodeIds = input.preflight.nodes?.map(({ nodeId }) => nodeId) ?? [];
  const plannedGeneratorInvocations =
    nodeIds.length > 0 && carryCharacterIds.length > 0
      ? (BigInt(nodeIds.length) * BigInt(carryCharacterIds.length)).toString()
      : null;
  const theoreticalMaximumCartesianReplays =
    nodeIds.length > 0 &&
    carryCharacterIds.length > 0 &&
    teamCharacterIds.length > 0
      ? (
          BigInt(nodeIds.length) *
          BigInt(carryCharacterIds.length) ** BigInt(teamCharacterIds.length)
        ).toString()
      : null;
  return {
    preflightAuthenticated,
    preflightComplete,
    preflightReportSha256: sha256Text(stableJson(input.preflight)),
    preflightReportContentSha256:
      input.preflight.authentication?.reportContentSha256 ?? null,
    sourceLatticeSha256:
      input.preflight.inputBoundary?.sourceLatticeSha256 ?? null,
    nodeIds,
    teamCharacterIds,
    carryCharacterIds: [...carryCharacterIds],
    objectiveId:
      input.preflight.objectiveBoundary?.envelope?.objectiveId ?? null,
    objectiveFormulaLinesSha256:
      input.preflight.objectiveBoundary?.envelope?.formulaLinesSha256 ?? null,
    objectiveEnvelopeSha256:
      input.preflight.objectiveBoundary?.objectiveEnvelopeSha256 ?? null,
    objectiveReviewStatus:
      input.preflight.objectiveBoundary?.envelope?.reviewStatus ?? null,
    sourceBindingEstablishedByCaller:
      input.preflight.objectiveBoundary?.envelope
        ?.sourceBindingEstablishedByCaller ?? null,
    sourceReadyForDamageReplay:
      input.preflight.objectiveBoundary?.envelope?.sourceReadiness
        ?.readyForDamageReplay ?? null,
    sourceReadinessBlockerCount:
      input.preflight.objectiveBoundary?.envelope?.sourceReadiness?.blockers
        ?.length ?? 0,
    runtimeAssumptionsSha256:
      input.preflight.runtimeBoundary?.runtimeAssumptionsSha256 ?? null,
    calcContextSha256:
      input.preflight.runtimeBoundary?.calcContextSha256 ?? null,
    executionPolicySha256: sha256Text(stableJson(input.executionPolicy)),
    plannedGeneratorInvocations,
    theoreticalMaximumCartesianReplays,
  };
}

function parsePositiveBound(
  value: string,
  path: string,
  issues: BoundedFullTeamEquipmentTechnicalIssue[],
): bigint | null {
  if (!DECIMAL_INTEGER.test(value) || BigInt(value) <= 0n) {
    issues.push(
      makeIssue(
        "input.invalid_bound",
        "input",
        path,
        "Execution bounds must be canonical positive base-10 integers.",
      ),
    );
    return null;
  }
  return BigInt(value);
}

function validateGeneratedFrom(
  generatedFrom: Array<{ path: string; sha256: string }>,
  issues: BoundedFullTeamEquipmentTechnicalIssue[],
): void {
  const paths = new Set<string>();
  for (const [index, entry] of generatedFrom.entries()) {
    if (!nonEmpty(entry.path) || !SHA256.test(entry.sha256)) {
      issues.push(
        makeIssue(
          "input.invalid_generated_from",
          "input",
          `generatedFrom[${index}]`,
          "Generated-from rows require a nonblank path and lowercase SHA-256.",
        ),
      );
    }
    if (paths.has(entry.path)) {
      issues.push(
        makeIssue(
          "input.duplicate_generated_from_path",
          "input",
          `generatedFrom[${index}].path`,
          `Generated-from path ${entry.path} is duplicated.`,
        ),
      );
    }
    paths.add(entry.path);
  }
}

function validateInvocation(
  invocation: BoundedFullTeamEquipmentGeneratorInvocation,
  expectedConfigs: ReplayTeamConfigs,
  identities: ReadonlySet<object>,
  nodeId: string,
  carryCharacterId: string,
): void {
  if (
    typeof invocation.runtimeIdentity !== "object" ||
    invocation.runtimeIdentity === null
  ) {
    throw new TechnicalComputationFailure(
      "generator.invalid_runtime_identity",
      "generator",
      `${nodeId}/${carryCharacterId} did not expose an object runtime identity.`,
    );
  }
  if (identities.has(invocation.runtimeIdentity)) {
    throw new TechnicalComputationFailure(
      "generator.runtime_identity_reused",
      "generator",
      `${nodeId}/${carryCharacterId} reused a prior TeamBuild/runtime identity.`,
    );
  }
  if (!exactEqual(invocation.observedTeamConfigs, expectedConfigs)) {
    throw new TechnicalComputationFailure(
      "generator.config_mismatch",
      "generator",
      `${nodeId}/${carryCharacterId} materialized configs differ from CP37.`,
    );
  }
  if (
    !invocation.results ||
    typeof invocation.results[Symbol.asyncIterator] !== "function"
  ) {
    throw new TechnicalComputationFailure(
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
    !Number.isFinite(result.progress) ||
    result.progress < 0 ||
    result.progress > 1 ||
    result.progress < previousProgress
  ) {
    throw new TechnicalComputationFailure(
      "generator.invalid_progress",
      "capture",
      `${nodeId}/${carryCharacterId} emitted invalid or decreasing progress.`,
    );
  }
  if (sawDone) {
    throw new TechnicalComputationFailure(
      "generator.result_after_final",
      "capture",
      `${nodeId}/${carryCharacterId} emitted a result after done=true.`,
    );
  }
  if (result.done && (result.phase !== "done" || result.progress !== 1)) {
    throw new TechnicalComputationFailure(
      "generator.invalid_final_marker",
      "capture",
      `${nodeId}/${carryCharacterId} emitted done=true without phase=done and progress=1.`,
    );
  }
}

function captureFinalResult(
  finalResult: GeneratorResult,
  characterIds: string[],
  carryCharacterId: string,
  nodeId: string,
  progress: ProgressObservation[],
  observedTeamConfigs: TeamSlotConfig[],
): CapturedRun {
  const expected = [...characterIds].sort(compareText);
  const sheetIds = Object.keys(finalResult.sheetsByChar).sort(compareText);
  const artifactIds = Object.keys(finalResult.artifactsByChar).sort(compareText);
  if (!sameStrings(sheetIds, expected) || !sameStrings(artifactIds, expected)) {
    throw new TechnicalComputationFailure(
      "capture.character_domain_mismatch",
      "capture",
      `${nodeId}/${carryCharacterId} final result does not exactly cover the team characters.`,
    );
  }
  const sheetsByCharacter: Record<string, StatSheet> = {};
  const sheetFingerprintsByCharacter: Record<string, string> = {};
  for (const characterId of characterIds) {
    const sheet = finalResult.sheetsByChar[characterId];
    if (!(sheet instanceof StatSheet)) {
      throw new TechnicalComputationFailure(
        "capture.invalid_sheet",
        "capture",
        `${nodeId}/${carryCharacterId} is missing a StatSheet for ${characterId}.`,
      );
    }
    const entries = canonicalSheetDump(sheet);
    sheetsByCharacter[characterId] = sheet;
    sheetFingerprintsByCharacter[characterId] = sha256Text(stableJson(entries));
  }
  const observation = {
    carryCharacterId,
    outcome: "captured" as const,
    progress: progress.map((row) => ({ ...row })),
    observedTeamConfigsSha256: sha256Text(stableJson(observedTeamConfigs)),
    sheetFingerprintsByCharacter: sortTextRecord(
      sheetFingerprintsByCharacter,
    ),
  };
  return {
    carryCharacterId,
    observation,
    sheetsByCharacter,
  };
}

function prepareNode(state: NodeState, characterIds: string[]): PreparedNode {
  if (
    state.issues.length > 0 ||
    state.captures.length !== characterIds.length
  ) {
    return { state, pools: emptyPools(characterIds), expectedCount: null };
  }
  const pools = Object.fromEntries(
    characterIds.map((characterId) => {
      const byCanonical = new Map<string, PrivatePoolCell>();
      for (const capture of state.captures) {
        const entries = canonicalSheetDump(
          capture.sheetsByCharacter[characterId],
        );
        const canonical = stableJson(entries);
        const existing = byCanonical.get(canonical);
        if (existing) {
          existing.originCarryCharacterIds.push(capture.carryCharacterId);
          existing.originMultiplicity += 1;
        } else {
          byCanonical.set(canonical, {
            nodeId: state.node.nodeId,
            characterId,
            sheetId: sha256Text(canonical),
            originCarryCharacterIds: [capture.carryCharacterId],
            originMultiplicity: 1,
            entries,
          });
        }
      }
      return [characterId, [...byCanonical.values()]];
    }),
  );
  const expectedCount = characterIds.reduce(
    (product, characterId) => product * BigInt(pools[characterId].length),
    1n,
  );
  return { state, pools, expectedCount };
}

function publicNodeBase(
  prepared: PreparedNode,
  characterIds: string[],
): Omit<
  BoundedFullTeamEquipmentTechnicalNodeObservation,
  | "comparisonStatus"
  | "observedCartesianCompositionCount"
  | "provenanceSummary"
  | "compositions"
  | "boundedTechnicalReference"
  | "intactGeneratorEndpointTechnicalReference"
  | "boundedReferenceOverIntact"
> {
  return {
    sequence: prepared.state.sequence,
    nodeId: prepared.state.node.nodeId,
    materializedConfigsSha256:
      prepared.state.node.materializedConfigsSha256 ??
      sha256Text(stableJson(prepared.state.configs)),
    generatorRuns: prepared.state.runs.map(cloneGeneratorObservation),
    sheetPoolsByCharacter: Object.fromEntries(
      characterIds.map((characterId) => [
        characterId,
        prepared.pools[characterId].map(
          ({ entries: _entries, ...cell }) => structuredClone(cell),
        ),
      ]),
    ),
    poolSizesByCharacter: Object.fromEntries(
      characterIds.map((characterId) => [
        characterId,
        prepared.pools[characterId].length,
      ]),
    ),
    expectedCartesianCompositionCount:
      prepared.expectedCount?.toString() ?? null,
    issues: structuredClone(prepared.state.issues),
  };
}

function enumerateCartesian(
  characterIds: string[],
  pools: Record<string, PrivatePoolCell[]>,
): Array<Record<string, PrivatePoolCell>> {
  let selections: Array<Record<string, PrivatePoolCell>> = [{}];
  for (const characterId of characterIds) {
    selections = selections.flatMap((selection) =>
      pools[characterId].map((cell) => ({
        ...selection,
        [characterId]: cell,
      })),
    );
  }
  return selections;
}

function compositionIdFor(
  nodeId: string,
  characterIds: string[],
  selection: Record<string, PrivatePoolCell>,
): string {
  const digest = sha256Text(
    stableJson({
      nodeId,
      sheets: characterIds.map((characterId) => ({
        characterId,
        sheetId: selection[characterId].sheetId,
      })),
    }),
  );
  return `bounded-full-team-composition:${digest}`;
}

function compositionProvenance(
  characterIds: string[],
  carryCharacterIds: string[],
  selection: Record<string, PrivatePoolCell>,
): BoundedFullTeamEquipmentCompositionProvenance {
  const originCarryCharacterIds = carryCharacterIds.filter((carryCharacterId) =>
    characterIds.every((characterId) =>
      selection[characterId].originCarryCharacterIds.includes(
        carryCharacterId,
      ),
    ),
  );
  return {
    classification:
      originCarryCharacterIds.length > 0
        ? "intact-generator-endpoint"
        : "cross-endpoint-recombination",
    originCarryCharacterIds,
    originMultiplicity: originCarryCharacterIds.length,
  };
}

function publicSelection(
  characterIds: string[],
  selection: Record<string, PrivatePoolCell>,
): BoundedFullTeamEquipmentCompositionObservation["sheetsByCharacter"] {
  return Object.fromEntries(
    characterIds.map((characterId) => {
      const cell = selection[characterId];
      return [
        characterId,
        {
          nodeId: cell.nodeId,
          sheetId: cell.sheetId,
          originCarryCharacterIds: [...cell.originCarryCharacterIds],
        },
      ];
    }),
  );
}

function validateEvaluation(
  observation: BoundedFullTeamEquipmentEvaluationObservation,
  objectiveLines: SourceBackedEquipmentRuntimeObjectiveLine[],
  compositionId: string,
): void {
  const expectedCoverage = objectiveLines.map(({ characterId, formulaId }) => ({
    characterId,
    formulaId,
    available: true,
  }));
  if (!exactEqual(observation.formulaCoverage, expectedCoverage)) {
    throw new TechnicalComputationFailure(
      "replay.formula_coverage_mismatch",
      "replay",
      `${compositionId} did not cover the exact objective formula domain.`,
    );
  }
  const agreement = observation.calculatorAgreement;
  for (const [field, value] of Object.entries({
    totalDamage: observation.totalDamage,
    directTotalDamage: agreement.directTotalDamage,
    compiledTotalDamage: agreement.compiledTotalDamage,
    absoluteDifference: agreement.absoluteDifference,
    allowedDifference: agreement.allowedDifference,
  })) {
    if (!Number.isFinite(value)) {
      throw new TechnicalComputationFailure(
        "replay.non_finite_result",
        "replay",
        `${compositionId} returned non-finite ${field}.`,
      );
    }
  }
  const actualRawDifference = Math.abs(
    agreement.directTotalDamage - agreement.compiledTotalDamage,
  );
  const canonicalRawTolerance = canonicalCalculatorAllowedDifference(
    agreement.directTotalDamage,
    agreement.compiledTotalDamage,
  );
  const normalizedDirect = normalizeNumber(agreement.directTotalDamage);
  const normalizedCompiled = normalizeNumber(agreement.compiledTotalDamage);
  const expectedAbsoluteDifference = normalizeNumber(
    Math.abs(normalizedDirect - normalizedCompiled),
  );
  const expectedAllowedDifference = canonicalCalculatorAllowedDifference(
    normalizedDirect,
    normalizedCompiled,
  );
  if (
    !agreement.passed ||
    agreement.absoluteDifference < 0 ||
    actualRawDifference > canonicalRawTolerance ||
    !equalWithinFloatingPointRoundoff(
      agreement.allowedDifference,
      canonicalRawTolerance,
    ) ||
    expectedAbsoluteDifference > expectedAllowedDifference ||
    observation.totalDamage !== agreement.directTotalDamage
  ) {
    throw new TechnicalComputationFailure(
      "replay.calculator_disagreement",
      "replay",
      `${compositionId} failed direct/compiled calculator agreement: observed difference ${agreement.absoluteDifference}, expected ${expectedAbsoluteDifference}; observed tolerance ${agreement.allowedDifference}, expected ${expectedAllowedDifference}.`,
    );
  }
}

function buildNodeReferences(
  compositions: BoundedFullTeamEquipmentCompositionObservation[],
): Pick<
  BoundedFullTeamEquipmentTechnicalNodeObservation,
  | "boundedTechnicalReference"
  | "intactGeneratorEndpointTechnicalReference"
  | "boundedReferenceOverIntact"
> {
  const evaluated = compositions.filter(isEvaluatedComposition);
  const bounded = buildLocalReference(evaluated);
  const intact = buildLocalReference(
    evaluated.filter(
      ({ provenance }) =>
        provenance.classification === "intact-generator-endpoint",
    ),
  );
  if (!bounded || !intact) return emptyNodeReferences();
  const absoluteDelta = normalizeNumber(
    bounded.unreviewedTechnicalObjective -
      intact.unreviewedTechnicalObjective,
  );
  return {
    boundedTechnicalReference: bounded,
    intactGeneratorEndpointTechnicalReference: intact,
    boundedReferenceOverIntact:
      intact.unreviewedTechnicalObjective === 0
        ? {
            status: "undefined-zero-intact",
            absoluteDelta,
            ratio: null,
          }
        : {
            status: "available",
            absoluteDelta,
            ratio: normalizeNumber(
              bounded.unreviewedTechnicalObjective /
                intact.unreviewedTechnicalObjective,
            ),
          },
  };
}

function buildLocalReference(
  values: Array<
    BoundedFullTeamEquipmentCompositionObservation & {
      outcome: "evaluated";
      unreviewedTechnicalObjective: number;
    }
  >,
): BoundedFullTeamEquipmentTechnicalReference | null {
  const representative = maxByObjective(values);
  if (!representative) return null;
  return {
    compositionId: representative.compositionId,
    unreviewedTechnicalObjective:
      representative.unreviewedTechnicalObjective,
    provenance: representative.provenance.classification,
    equivalentCompositionIds: values
      .filter(
        ({ unreviewedTechnicalObjective }) =>
          unreviewedTechnicalObjective ===
          representative.unreviewedTechnicalObjective,
      )
      .map(({ compositionId }) => compositionId),
    representativeSelectionPolicy: "first-enumerated-exact-objective-tie",
  };
}

function emptyNodeReferences(): Pick<
  BoundedFullTeamEquipmentTechnicalNodeObservation,
  | "boundedTechnicalReference"
  | "intactGeneratorEndpointTechnicalReference"
  | "boundedReferenceOverIntact"
> {
  return {
    boundedTechnicalReference: null,
    intactGeneratorEndpointTechnicalReference: null,
    boundedReferenceOverIntact: notComparableLift(),
  };
}

function notComparableLift(): BoundedFullTeamEquipmentTechnicalNodeObservation["boundedReferenceOverIntact"] {
  return {
    status: "not-comparable",
    absoluteDelta: null,
    ratio: null,
  };
}

function buildGlobalReferences(
  rows: Array<{
    nodeId: string;
    composition: BoundedFullTeamEquipmentCompositionObservation & {
      outcome: "evaluated";
      unreviewedTechnicalObjective: number;
    };
  }>,
): {
  bounded: BoundedFullTeamEquipmentGlobalTechnicalReference | null;
  intact: BoundedFullTeamEquipmentGlobalTechnicalReference | null;
} {
  return {
    bounded: buildGlobalReference(rows),
    intact: buildGlobalReference(
      rows.filter(
        ({ composition }) =>
          composition.provenance.classification ===
          "intact-generator-endpoint",
      ),
    ),
  };
}

function buildGlobalReference(
  rows: Array<{
    nodeId: string;
    composition: BoundedFullTeamEquipmentCompositionObservation & {
      outcome: "evaluated";
      unreviewedTechnicalObjective: number;
    };
  }>,
): BoundedFullTeamEquipmentGlobalTechnicalReference | null {
  const representative = rows.reduce<(typeof rows)[number] | null>(
    (best, row) =>
      !best ||
      row.composition.unreviewedTechnicalObjective >
        best.composition.unreviewedTechnicalObjective
        ? row
        : best,
    null,
  );
  if (!representative) return null;
  return {
    nodeId: representative.nodeId,
    compositionId: representative.composition.compositionId,
    unreviewedTechnicalObjective:
      representative.composition.unreviewedTechnicalObjective,
    provenance: representative.composition.provenance.classification,
    equivalentReferences: rows
      .filter(
        ({ composition }) =>
          composition.unreviewedTechnicalObjective ===
          representative.composition.unreviewedTechnicalObjective,
      )
      .map(({ nodeId, composition }) => ({
        nodeId,
        compositionId: composition.compositionId,
      })),
    representativeSelectionPolicy:
      "first-node-then-enumerated-exact-objective-tie",
  };
}

function buildDistribution(
  rawValues: number[],
  scope: BoundedFullTeamEquipmentObjectiveDistribution["scope"],
): BoundedFullTeamEquipmentObjectiveDistribution {
  const values = [...rawValues].sort((left, right) => left - right);
  const classes = new Map<number, number>();
  for (const value of values) classes.set(value, (classes.get(value) ?? 0) + 1);
  const histogram = new Map<number, number>();
  for (const count of classes.values()) {
    histogram.set(count, (histogram.get(count) ?? 0) + 1);
  }
  const tied = [...classes.values()].filter((count) => count > 1);
  return {
    scope,
    observationCount: values.length,
    uniqueExactValueCount: classes.size,
    exactTieClassCount: tied.length,
    observationsInExactTieClasses: tied.reduce(
      (sum, count) => sum + count,
      0,
    ),
    maximumExactTieClassSize: Math.max(...classes.values()),
    exactTieClassSizeHistogram: Object.fromEntries(
      [...histogram.entries()]
        .sort(([left], [right]) => left - right)
        .map(([size, count]) => [String(size), count]),
    ),
    minimum: values[0],
    percentile25: normalizeNumber(quantile(values, 0.25)),
    median: normalizeNumber(quantile(values, 0.5)),
    mean: normalizeNumber(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    ),
    percentile75: normalizeNumber(quantile(values, 0.75)),
    maximum: values.at(-1) as number,
  };
}

function quantile(values: number[], percentile: number): number {
  const position = (values.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? values[lower]
    : values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function summarizeProvenance(
  compositions: BoundedFullTeamEquipmentCompositionObservation[],
): BoundedFullTeamEquipmentTechnicalComputationReport["provenanceSummary"] {
  return {
    intactGeneratorEndpointCompositionCount: compositions.filter(
      ({ provenance }) =>
        provenance.classification === "intact-generator-endpoint",
    ).length,
    crossEndpointRecombinationCount: compositions.filter(
      ({ provenance }) =>
        provenance.classification === "cross-endpoint-recombination",
    ).length,
  };
}

function reportHeader(
  input: BoundedFullTeamEquipmentTechnicalComputationInput,
  context: InputContext,
): Omit<
  BoundedFullTeamEquipmentTechnicalComputationReport,
  | "validationStatus"
  | "comparisonStatus"
  | "generatorExecuted"
  | "damageComputationExecuted"
  | "execution"
  | "provenanceSummary"
  | "nodes"
  | "objectiveDistribution"
  | "boundedTechnicalReference"
  | "intactGeneratorEndpointTechnicalReference"
  | "issues"
  | "cautions"
  | "authentication"
> {
  return {
    schemaVersion: 1,
    classification: "bounded-full-team-equipment-technical-computation",
    capabilities: fixedCapabilities(),
    rankingProduced: false,
    recommendationProduced: false,
    guideProduced: false,
    optimizerExecuted: false,
    energyRecoveryInputsUsed: false,
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsOptimality: false,
    supportsEnergyRequirements: false,
    generatedFrom: [...input.generatedFrom].sort((left, right) =>
      compareText(left.path, right.path),
    ),
    inputBoundary: {
      preflightAuthenticated: context.preflightAuthenticated,
      preflightComplete: context.preflightComplete,
      preflightValidationStatus: input.preflight.validationStatus,
      preflightReportSha256: context.preflightReportSha256,
      preflightReportContentSha256: context.preflightReportContentSha256,
      sourceLatticeSha256: context.sourceLatticeSha256,
      nodeCount: context.nodeIds.length,
      nodeIds: [...context.nodeIds],
      teamCharacterIds: [...context.teamCharacterIds],
      carryCharacterIds: [...context.carryCharacterIds],
      objectiveId: context.objectiveId,
      objectiveFormulaLinesSha256: context.objectiveFormulaLinesSha256,
      objectiveEnvelopeSha256: context.objectiveEnvelopeSha256,
      objectiveReviewStatus: context.objectiveReviewStatus,
      sourceBindingEstablishedByCaller:
        context.sourceBindingEstablishedByCaller,
      sourceReadyForDamageReplay: context.sourceReadyForDamageReplay,
      sourceReadinessBlockerCount: context.sourceReadinessBlockerCount,
      runtimeAssumptionsSha256: context.runtimeAssumptionsSha256,
      calcContextSha256: context.calcContextSha256,
      executionPolicy: structuredClone(input.executionPolicy),
      executionPolicySha256: context.executionPolicySha256,
    },
  };
}

function fixedCapabilities(): BoundedFullTeamEquipmentTechnicalComputationReport["capabilities"] {
  return {
    sourceClaims: false,
    guideClaims: false,
    teamRecommendationClaims: false,
    equipmentRecommendationClaims: false,
    rankClaims: false,
    gameplayClaims: false,
    damageClaims: false,
    dpsClaims: false,
    optimalityClaims: false,
    energyRecoveryClaims: false,
  };
}

function fixedExecution(
  environmentId: string,
  policy: BoundedFullTeamEquipmentTechnicalExecutionPolicy,
): Omit<
  BoundedFullTeamEquipmentTechnicalComputationReport["execution"],
  | "bootstrapCalls"
  | "plannedGeneratorInvocations"
  | "theoreticalMaximumCartesianReplays"
  | "observedGeneratorInvocations"
  | "freshRuntimeIdentityCount"
  | "capturedGeneratorResultCount"
  | "knownCompleteNodeExpectedReplayCount"
  | "fullDomainExpectedReplayCount"
  | "observedReplayCalls"
  | "successfulReplayCount"
> {
  return {
    environmentId,
    scheduling: "sequential",
    nodeLocalSheetPoolsOnly: true,
    crossNodeSheetCompositionsAllowed: false,
    canonicalSheetDeduplication: true,
    freshRuntimeIdentityPerGeneratorInvocation: true,
    warmStartSupported: false,
    perCharacterConstraintsPassed: false,
    energyRecoveryThresholdsPassed: false,
    explicitGeneratorBuffOverridesPassed: false,
    explicitFormulaBuffOverridesPassedToReplay: false,
    countArithmetic: "bigint-decimal",
    hardMaximumGeneratorResultEmissionsPerInvocation:
      HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION.toString() as "64",
    hardMaximumCartesianReplays:
      HARD_MAXIMUM_CARTESIAN_REPLAYS.toString() as "9216",
    maximumGeneratorInvocations: policy.maximumGeneratorInvocations,
    maximumCartesianReplays: policy.maximumCartesianReplays,
  };
}

function emptyReport(
  input: BoundedFullTeamEquipmentTechnicalComputationInput,
  environmentId: string,
  context: InputContext,
  issues: BoundedFullTeamEquipmentTechnicalIssue[],
): BoundedFullTeamEquipmentTechnicalComputationReport {
  return {
    ...reportHeader(input, context),
    validationStatus: "withheld-invalid-input",
    comparisonStatus: "not-comparable",
    generatorExecuted: false,
    damageComputationExecuted: false,
    execution: {
      ...fixedExecution(environmentId, input.executionPolicy),
      bootstrapCalls: 0,
      plannedGeneratorInvocations: context.plannedGeneratorInvocations,
      theoreticalMaximumCartesianReplays:
        context.theoreticalMaximumCartesianReplays,
      observedGeneratorInvocations: 0,
      freshRuntimeIdentityCount: 0,
      capturedGeneratorResultCount: 0,
      knownCompleteNodeExpectedReplayCount: "0",
      fullDomainExpectedReplayCount: null,
      observedReplayCalls: 0,
      successfulReplayCount: 0,
    },
    provenanceSummary: {
      intactGeneratorEndpointCompositionCount: 0,
      crossEndpointRecombinationCount: 0,
    },
    nodes: [],
    objectiveDistribution: null,
    boundedTechnicalReference: null,
    intactGeneratorEndpointTechnicalReference: null,
    issues: structuredClone(issues),
    cautions: fixedCautions(),
    authentication: {
      ...authenticationInputs(context),
      resultFingerprintSha256: null,
      reportContentSha256: "",
    },
  };
}

function authenticationInputs(
  context: InputContext,
): Omit<
  BoundedFullTeamEquipmentTechnicalComputationReport["authentication"],
  "resultFingerprintSha256" | "reportContentSha256"
> {
  return {
    preflightReportSha256: context.preflightReportSha256,
    preflightReportContentSha256: context.preflightReportContentSha256,
    objectiveEnvelopeSha256: context.objectiveEnvelopeSha256,
    runtimeAssumptionsSha256: context.runtimeAssumptionsSha256,
    calcContextSha256: context.calcContextSha256,
    executionPolicySha256: context.executionPolicySha256,
  };
}

function fixedCautions(): string[] {
  return [
    "The generic report self-digest authenticates internal content consistency only; source authority requires a source-specific wrapper to authenticate the expected preflight and complete report digest.",
    "The objective may remain unreviewed and source-not-ready; successful numerical execution does not establish rotation order, buff timing, field time, reaction ownership, or gameplay applicability.",
    "Every equipment node composes source-backed axis occurrences; no source is made the author of the whole equipment composition.",
    "An intact-generator-endpoint composition reproduces one captured four-character generator endpoint; a cross-endpoint-recombination only combines node-local character sheets from different endpoints and must never be described as generator-produced.",
    "Bounded technical references are maxima of this exact finite technical objective only, not rankings, recommendations, DPS, gameplay claims, or global optima.",
    "ER thresholds, per-character constraints, warm starts, cross-node sheet composition, optimizer execution, and formula buff overrides are absent.",
  ];
}

function finalizeReport(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): BoundedFullTeamEquipmentTechnicalComputationReport {
  const finalized = structuredClone(report);
  finalized.authentication.resultFingerprintSha256 =
    finalized.validationStatus === "withheld-invalid-input"
      ? null
      : calculateResultFingerprint(finalized);
  finalized.authentication.reportContentSha256 =
    calculateReportContentSha256(finalized);
  requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
    finalized,
  );
  return finalized;
}

/**
 * Reject post-build mutation and inconsistent derived counters or provenance.
 * This generic self-digest establishes internal consistency, not source
 * authority; a source-specific wrapper must authenticate its expected inputs
 * and complete report digest.
 */
export function requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): void {
  if (
    !SHA256.test(report.authentication.reportContentSha256) ||
    calculateReportContentSha256(report) !==
      report.authentication.reportContentSha256 ||
    !basicReportSemanticsHold(report)
  ) {
    throw new Error(
      "Bounded full-team equipment technical computation report is incomplete, inconsistent, or mutated.",
    );
  }
}

export function isCompleteBoundedFullTeamEquipmentTechnicalComputationReport(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): boolean {
  try {
    requireAuthenticatedBoundedFullTeamEquipmentTechnicalComputationReport(
      report,
    );
  } catch {
    return false;
  }
  return (
    report.validationStatus === "completed-technical-objective" &&
    report.comparisonStatus === "comparable" &&
    report.issues.length === 0 &&
    report.nodes.length === report.inputBoundary.nodeCount &&
    report.nodes.every(
      ({ comparisonStatus }) => comparisonStatus === "comparable",
    ) &&
    report.boundedTechnicalReference !== null &&
    report.intactGeneratorEndpointTechnicalReference !== null
  );
}

function calculateReportContentSha256(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
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
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): string {
  return sha256Text(
    stableJson({
      validationStatus: report.validationStatus,
      comparisonStatus: report.comparisonStatus,
      nodes: report.nodes.map((node) => ({
        nodeId: node.nodeId,
        generatorRuns: node.generatorRuns,
        sheetPoolsByCharacter: node.sheetPoolsByCharacter,
        compositions: node.compositions,
        boundedTechnicalReference: node.boundedTechnicalReference,
        intactGeneratorEndpointTechnicalReference:
          node.intactGeneratorEndpointTechnicalReference,
      })),
      objectiveDistribution: report.objectiveDistribution,
      boundedTechnicalReference: report.boundedTechnicalReference,
      intactGeneratorEndpointTechnicalReference:
        report.intactGeneratorEndpointTechnicalReference,
      issues: report.issues,
    }),
  );
}

function basicReportSemanticsHold(
  report: BoundedFullTeamEquipmentTechnicalComputationReport,
): boolean {
  if (
    report.schemaVersion !== 1 ||
    report.classification !==
      "bounded-full-team-equipment-technical-computation" ||
    !exactEqual(report.capabilities, fixedCapabilities()) ||
    report.rankingProduced ||
    report.recommendationProduced ||
    report.guideProduced ||
    report.optimizerExecuted ||
    report.energyRecoveryInputsUsed ||
    report.supportsGuideClaims ||
    report.supportsEquipmentRecommendations ||
    report.supportsRankClaims ||
    report.supportsDamageClaims ||
    report.supportsOptimality ||
    report.supportsEnergyRequirements ||
    !exactEqual(report.cautions, fixedCautions()) ||
    !report.execution.nodeLocalSheetPoolsOnly ||
    report.execution.crossNodeSheetCompositionsAllowed ||
    !report.execution.canonicalSheetDeduplication ||
    !report.execution.freshRuntimeIdentityPerGeneratorInvocation ||
    report.execution.warmStartSupported ||
    report.execution.perCharacterConstraintsPassed ||
    report.execution.energyRecoveryThresholdsPassed ||
    report.execution.explicitGeneratorBuffOverridesPassed ||
    report.execution.explicitFormulaBuffOverridesPassedToReplay ||
    report.execution.scheduling !== "sequential" ||
    report.execution.countArithmetic !== "bigint-decimal" ||
    report.execution.hardMaximumGeneratorResultEmissionsPerInvocation !==
      HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION.toString() ||
    report.execution.hardMaximumCartesianReplays !==
      HARD_MAXIMUM_CARTESIAN_REPLAYS.toString() ||
    report.execution.maximumGeneratorInvocations !==
      report.inputBoundary.executionPolicy.maximumGeneratorInvocations ||
    report.execution.maximumCartesianReplays !==
      report.inputBoundary.executionPolicy.maximumCartesianReplays ||
    report.inputBoundary.executionPolicySha256 !==
      sha256Text(stableJson(report.inputBoundary.executionPolicy)) ||
    report.authentication.executionPolicySha256 !==
      report.inputBoundary.executionPolicySha256 ||
    report.authentication.preflightReportSha256 !==
      report.inputBoundary.preflightReportSha256 ||
    report.authentication.preflightReportContentSha256 !==
      report.inputBoundary.preflightReportContentSha256 ||
    report.authentication.objectiveEnvelopeSha256 !==
      report.inputBoundary.objectiveEnvelopeSha256 ||
    report.authentication.runtimeAssumptionsSha256 !==
      report.inputBoundary.runtimeAssumptionsSha256 ||
    report.authentication.calcContextSha256 !==
      report.inputBoundary.calcContextSha256 ||
    !generatedFromSemanticsHold(report.generatedFrom)
  ) {
    return false;
  }

  if (report.validationStatus === "withheld-invalid-input") {
    return (
      report.comparisonStatus === "not-comparable" &&
      !report.generatorExecuted &&
      !report.damageComputationExecuted &&
      report.execution.bootstrapCalls === 0 &&
      report.execution.observedGeneratorInvocations === 0 &&
      report.execution.freshRuntimeIdentityCount === 0 &&
      report.execution.capturedGeneratorResultCount === 0 &&
      report.execution.knownCompleteNodeExpectedReplayCount === "0" &&
      report.execution.fullDomainExpectedReplayCount === null &&
      report.execution.observedReplayCalls === 0 &&
      report.execution.successfulReplayCount === 0 &&
      report.nodes.length === 0 &&
      report.issues.length > 0 &&
      exactEqual(report.provenanceSummary, {
        intactGeneratorEndpointCompositionCount: 0,
        crossEndpointRecombinationCount: 0,
      }) &&
      report.objectiveDistribution === null &&
      report.boundedTechnicalReference === null &&
      report.intactGeneratorEndpointTechnicalReference === null &&
      report.authentication.resultFingerprintSha256 === null
    );
  }

  const characterIds = report.inputBoundary.teamCharacterIds;
  const carryCharacterIds = report.inputBoundary.carryCharacterIds;
  const nodeIds = report.inputBoundary.nodeIds;
  const maximumGeneratorInvocations = parseAuthenticatedPositiveInteger(
    report.execution.maximumGeneratorInvocations,
  );
  const maximumCartesianReplays = parseAuthenticatedPositiveInteger(
    report.execution.maximumCartesianReplays,
  );
  if (
    !nonEmpty(report.inputBoundary.executionPolicy.policyId) ||
    !nonEmpty(report.execution.environmentId) ||
    maximumGeneratorInvocations === null ||
    maximumCartesianReplays === null ||
    maximumCartesianReplays > HARD_MAXIMUM_CARTESIAN_REPLAYS ||
    characterIds.length !== 4 ||
    new Set(characterIds).size !== 4 ||
    !sameStrings(characterIds, carryCharacterIds) ||
    nodeIds.length === 0 ||
    nodeIds.length !== report.inputBoundary.nodeCount ||
    new Set(nodeIds).size !== nodeIds.length ||
    !SHA256.test(report.inputBoundary.preflightReportSha256) ||
    !SHA256.test(report.inputBoundary.preflightReportContentSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.sourceLatticeSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.objectiveFormulaLinesSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.objectiveEnvelopeSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.runtimeAssumptionsSha256 ?? "") ||
    !SHA256.test(report.inputBoundary.calcContextSha256 ?? "")
  ) {
    return false;
  }
  const plannedGeneratorInvocations =
    BigInt(nodeIds.length) * BigInt(carryCharacterIds.length);
  const theoreticalMaximumCartesianReplays =
    BigInt(nodeIds.length) *
    BigInt(carryCharacterIds.length) ** BigInt(characterIds.length);
  if (
    !report.inputBoundary.preflightAuthenticated ||
    !report.inputBoundary.preflightComplete ||
    report.execution.bootstrapCalls !== 1 ||
    report.execution.plannedGeneratorInvocations !==
      plannedGeneratorInvocations.toString() ||
    report.execution.theoreticalMaximumCartesianReplays !==
      theoreticalMaximumCartesianReplays.toString() ||
    plannedGeneratorInvocations > maximumGeneratorInvocations ||
    theoreticalMaximumCartesianReplays > maximumCartesianReplays ||
    theoreticalMaximumCartesianReplays >
      HARD_MAXIMUM_CARTESIAN_REPLAYS ||
    report.nodes.length !== report.inputBoundary.nodeCount ||
    !sameStrings(
      report.nodes.map(({ nodeId }) => nodeId),
      report.inputBoundary.nodeIds,
    ) ||
    report.nodes.some(({ sequence }, index) => sequence !== index) ||
    report.execution.observedGeneratorInvocations !==
      report.nodes.reduce(
        (sum, { generatorRuns }) => sum + generatorRuns.length,
        0,
      ) ||
    report.execution.capturedGeneratorResultCount !==
      report.nodes.reduce(
        (sum, { generatorRuns }) =>
          sum +
          generatorRuns.filter(({ outcome }) => outcome === "captured").length,
        0,
      ) ||
    BigInt(report.execution.observedGeneratorInvocations) !==
      plannedGeneratorInvocations ||
    report.execution.freshRuntimeIdentityCount <
      report.execution.capturedGeneratorResultCount ||
    report.execution.freshRuntimeIdentityCount >
      report.execution.observedGeneratorInvocations ||
    report.generatorExecuted !==
      (report.execution.observedGeneratorInvocations > 0) ||
    report.damageComputationExecuted !==
      (report.execution.observedReplayCalls > 0)
  ) {
    return false;
  }

  let observedReplayCalls = 0;
  let successfulReplayCount = 0;
  const allCompositions: BoundedFullTeamEquipmentCompositionObservation[] = [];
  let knownCompleteNodeExpectedReplayCount = 0n;
  let allNodesGenerated = true;
  const postGenerationCapWithholding =
    report.validationStatus === "withheld-post-generation-cap";
  for (const [nodeIndex, node] of report.nodes.entries()) {
    if (
      !nodeSemanticsHold(
        node,
        report.inputBoundary.teamCharacterIds,
        report.inputBoundary.carryCharacterIds,
        nodeIndex,
        postGenerationCapWithholding,
      )
    ) {
      return false;
    }
    observedReplayCalls += node.compositions.length;
    successfulReplayCount += node.compositions.filter(
      ({ outcome }) => outcome === "evaluated",
    ).length;
    allCompositions.push(...node.compositions);
    if (node.expectedCartesianCompositionCount === null) {
      allNodesGenerated = false;
    } else {
      knownCompleteNodeExpectedReplayCount += BigInt(
        node.expectedCartesianCompositionCount,
      );
    }
  }
  if (
    observedReplayCalls !== report.execution.observedReplayCalls ||
    successfulReplayCount !== report.execution.successfulReplayCount ||
    report.execution.knownCompleteNodeExpectedReplayCount !==
      knownCompleteNodeExpectedReplayCount.toString() ||
    report.execution.fullDomainExpectedReplayCount !==
      (allNodesGenerated
        ? knownCompleteNodeExpectedReplayCount.toString()
        : null) ||
    (postGenerationCapWithholding
      ? observedReplayCalls !== 0
      : BigInt(observedReplayCalls) !==
        knownCompleteNodeExpectedReplayCount) ||
    !exactEqual(report.provenanceSummary, summarizeProvenance(allCompositions))
  ) {
    return false;
  }

  const generationFailures = report.nodes.flatMap(({ generatorRuns }) =>
    generatorRuns.filter(
      (
        run,
      ): run is Extract<
        BoundedFullTeamEquipmentGeneratorRunObservation,
        { outcome: "not-comparable" }
      > => run.outcome === "not-comparable",
    ),
  );
  const replayFailures = allCompositions.filter(
    ({ outcome }) => outcome === "evaluation-failed",
  );
  const postGenerationCapExceeded =
    knownCompleteNodeExpectedReplayCount > maximumCartesianReplays ||
    knownCompleteNodeExpectedReplayCount > HARD_MAXIMUM_CARTESIAN_REPLAYS;
  const expectedValidationStatus: BoundedFullTeamEquipmentTechnicalComputationReport["validationStatus"] =
    postGenerationCapExceeded
      ? "withheld-post-generation-cap"
      : generationFailures.length > 0
        ? "withheld-incomplete-generation"
        : replayFailures.length > 0
          ? "withheld-incomplete-replay"
          : "completed-technical-objective";
  const expectedIssues = [
    ...report.nodes.flatMap(({ issues }) => issues),
    ...(postGenerationCapExceeded
      ? [
          makeIssue(
            "bounds.dynamic_replay_cap_exceeded",
            "input",
            "execution.knownCompleteNodeExpectedReplayCount",
            `The deduplicated node-local product requires ${knownCompleteNodeExpectedReplayCount.toString()} replays, above the ${maximumCartesianReplays.toString()} cap.`,
          ),
        ]
      : []),
  ];
  const allComparable = report.nodes.every(
    ({ comparisonStatus }) => comparisonStatus === "comparable",
  );
  if (
    report.validationStatus !== expectedValidationStatus ||
    !exactEqual(report.issues, expectedIssues) ||
    report.comparisonStatus !== (allComparable ? "comparable" : "not-comparable")
  ) {
    return false;
  }
  if (
    allComparable !==
      (report.validationStatus === "completed-technical-objective")
  ) {
    return false;
  }
  if (
    generationFailures.length === 0 &&
    report.execution.freshRuntimeIdentityCount !==
      report.execution.observedGeneratorInvocations
  ) {
    return false;
  }

  const evaluatedRows = report.nodes.flatMap((node) =>
    node.compositions.filter(isEvaluatedComposition).map((composition) => ({
      nodeId: node.nodeId,
      composition,
    })),
  );
  const expectedDistribution =
    evaluatedRows.length === 0
      ? null
      : buildDistribution(
          evaluatedRows.map(
            ({ composition }) => composition.unreviewedTechnicalObjective,
          ),
          allComparable ? "complete-domain" : "partial-diagnostic",
        );
  if (!exactEqual(report.objectiveDistribution, expectedDistribution)) {
    return false;
  }
  const expectedGlobalReferences = allComparable
    ? buildGlobalReferences(evaluatedRows)
    : { bounded: null, intact: null };
  if (
    !exactEqual(
      report.boundedTechnicalReference,
      expectedGlobalReferences.bounded,
    ) ||
    !exactEqual(
      report.intactGeneratorEndpointTechnicalReference,
      expectedGlobalReferences.intact,
    )
  ) {
    return false;
  }
  if (
    !allComparable &&
    (report.boundedTechnicalReference !== null ||
      report.intactGeneratorEndpointTechnicalReference !== null)
  ) {
    return false;
  }
  if (
    !SHA256.test(report.authentication.resultFingerprintSha256 ?? "") ||
    report.authentication.resultFingerprintSha256 !==
      calculateResultFingerprint(report)
  ) {
    return false;
  }
  return true;
}

function nodeSemanticsHold(
  node: BoundedFullTeamEquipmentTechnicalNodeObservation,
  characterIds: string[],
  carryCharacterIds: string[],
  expectedSequence: number,
  postGenerationCapWithholding: boolean,
): boolean {
  if (
    node.sequence !== expectedSequence ||
    !nonEmpty(node.nodeId) ||
    !SHA256.test(node.materializedConfigsSha256) ||
    node.generatorRuns.length !== carryCharacterIds.length ||
    !sameStrings(
      node.generatorRuns.map(({ carryCharacterId }) => carryCharacterId),
      carryCharacterIds,
    ) ||
    !sameStringDomain(Object.keys(node.sheetPoolsByCharacter), characterIds) ||
    !sameStringDomain(Object.keys(node.poolSizesByCharacter), characterIds)
  ) {
    return false;
  }
  for (const [runIndex, run] of node.generatorRuns.entries()) {
    if (
      run.carryCharacterId !== carryCharacterIds[runIndex] ||
      !progressSemanticsHold(run.progress, run.outcome === "captured")
    ) {
      return false;
    }
    if (run.outcome === "captured") {
      if (
        !SHA256.test(run.observedTeamConfigsSha256) ||
        run.observedTeamConfigsSha256 !== node.materializedConfigsSha256 ||
        !sameStrings(
          Object.keys(run.sheetFingerprintsByCharacter).sort(compareText),
          [...characterIds].sort(compareText),
        ) ||
        Object.values(run.sheetFingerprintsByCharacter).some(
          (fingerprint) => !SHA256.test(fingerprint),
        )
      ) {
        return false;
      }
    } else if (
      !issueSemanticsHold(run.failure, {
        nodeId: node.nodeId,
        carryCharacterId: run.carryCharacterId,
        allowedStages: ["generator", "capture"],
      })
    ) {
      return false;
    }
  }
  const generatorFailures = node.generatorRuns.filter(
    (
      run,
    ): run is Extract<
      BoundedFullTeamEquipmentGeneratorRunObservation,
      { outcome: "not-comparable" }
    > => run.outcome === "not-comparable",
  );
  let expected = 1n;
  for (const characterId of characterIds) {
    const cells = node.sheetPoolsByCharacter[characterId];
    if (node.poolSizesByCharacter[characterId] !== cells.length) return false;
    expected *= BigInt(cells.length);
    const ids = new Set<string>();
    for (const cell of cells) {
      if (
        cell.nodeId !== node.nodeId ||
        cell.characterId !== characterId ||
        !SHA256.test(cell.sheetId) ||
        cell.originMultiplicity !== cell.originCarryCharacterIds.length ||
        cell.originMultiplicity <= 0 ||
        new Set(cell.originCarryCharacterIds).size !==
          cell.originCarryCharacterIds.length ||
        cell.originCarryCharacterIds.some(
          (carryCharacterId) =>
            !carryCharacterIds.includes(carryCharacterId),
        ) ||
        ids.has(cell.sheetId)
      ) {
        return false;
      }
      ids.add(cell.sheetId);
    }
    const originRows = cells.flatMap((cell) =>
      cell.originCarryCharacterIds.map((carryCharacterId) => ({
        carryCharacterId,
        sheetId: cell.sheetId,
      })),
    );
    if (
      generatorFailures.length === 0 &&
      (!sameStrings(
        originRows.map(({ carryCharacterId }) => carryCharacterId).sort(compareText),
        [...carryCharacterIds].sort(compareText),
      ) ||
        node.generatorRuns.some(
          (run) =>
            run.outcome !== "captured" ||
            !originRows.some(
              ({ carryCharacterId, sheetId }) =>
                carryCharacterId === run.carryCharacterId &&
                sheetId === run.sheetFingerprintsByCharacter[characterId],
            ),
        ))
    ) {
      return false;
    }
  }
  if (generatorFailures.length > 0) {
    const expectedGeneratorIssues = generatorFailures.map(({ failure }) =>
      structuredClone(failure),
    );
    return (
      Object.values(node.sheetPoolsByCharacter).every(
        (cells) => cells.length === 0,
      ) &&
      Object.values(node.poolSizesByCharacter).every((size) => size === 0) &&
      node.expectedCartesianCompositionCount === null &&
      node.observedCartesianCompositionCount === 0 &&
      node.compositions.length === 0 &&
      node.comparisonStatus === "not-comparable" &&
      node.boundedTechnicalReference === null &&
      node.intactGeneratorEndpointTechnicalReference === null &&
      node.boundedReferenceOverIntact.status === "not-comparable" &&
      node.boundedReferenceOverIntact.absoluteDelta === null &&
      node.boundedReferenceOverIntact.ratio === null &&
      exactEqual(node.issues, expectedGeneratorIssues) &&
      exactEqual(node.provenanceSummary, {
        intactGeneratorEndpointCompositionCount: 0,
        crossEndpointRecombinationCount: 0,
      })
    );
  }
  if (
    node.expectedCartesianCompositionCount !== expected.toString()
  ) {
    return false;
  }
  if (
    node.observedCartesianCompositionCount !== node.compositions.length ||
    (postGenerationCapWithholding
      ? node.compositions.length !== 0
      : BigInt(node.compositions.length) !== expected) ||
    !exactEqual(node.provenanceSummary, summarizeProvenance(node.compositions))
  ) {
    return false;
  }
  const compositionIds = new Set<string>();
  const expectedSelections = enumeratePublicCartesian(
    characterIds,
    node.sheetPoolsByCharacter,
  );
  for (const [compositionIndex, composition] of node.compositions.entries()) {
    const expectedSelection = expectedSelections[compositionIndex];
    if (
      composition.sequence !== compositionIndex ||
      !expectedSelection ||
      compositionIds.has(composition.compositionId) ||
      !sameStringDomain(
        Object.keys(composition.sheetsByCharacter),
        characterIds,
      ) ||
      characterIds.some(
        (characterId) =>
          composition.sheetsByCharacter[characterId].sheetId !==
          expectedSelection[characterId].sheetId,
      )
    ) {
      return false;
    }
    compositionIds.add(composition.compositionId);
    const expectedId = publicCompositionId(
      node.nodeId,
      characterIds,
      composition.sheetsByCharacter,
    );
    if (composition.compositionId !== expectedId) return false;
    const expectedProvenance = publicCompositionProvenance(
      characterIds,
      carryCharacterIds,
      composition.sheetsByCharacter,
    );
    if (!exactEqual(composition.provenance, expectedProvenance)) return false;
    for (const characterId of characterIds) {
      const selection = composition.sheetsByCharacter[characterId];
      if (
        selection.nodeId !== node.nodeId ||
        !node.sheetPoolsByCharacter[characterId].some(
          ({ sheetId, originCarryCharacterIds }) =>
            sheetId === selection.sheetId &&
            exactEqual(
              originCarryCharacterIds,
              selection.originCarryCharacterIds,
            ),
        )
      ) {
        return false;
      }
    }
    if (
      composition.outcome === "evaluated"
        ? composition.unreviewedTechnicalObjective === null ||
          !Number.isFinite(composition.unreviewedTechnicalObjective) ||
          composition.calculatorAgreement?.passed !== true ||
          !calculatorAgreementSemanticsHold(
            composition.unreviewedTechnicalObjective,
            composition.calculatorAgreement,
          ) ||
          composition.failure !== null ||
          !SHA256.test(composition.computedBuffOverridesSha256 ?? "")
        : composition.unreviewedTechnicalObjective !== null ||
          composition.calculatorAgreement !== null ||
          !issueSemanticsHold(composition.failure, {
            nodeId: node.nodeId,
            compositionId: composition.compositionId,
            allowedStages: ["replay"],
          }) ||
          composition.computedBuffOverridesSha256 !== null
    ) {
      return false;
    }
  }
  const compositionFailures = node.compositions.filter(
    (
      composition,
    ): composition is BoundedFullTeamEquipmentCompositionObservation & {
      outcome: "evaluation-failed";
      failure: BoundedFullTeamEquipmentTechnicalIssue;
    } =>
      composition.outcome === "evaluation-failed" &&
      composition.failure !== null,
  );
  if (
    !exactEqual(
      node.issues,
      compositionFailures.map(({ failure }) => failure),
    )
  ) {
    return false;
  }
  if (node.comparisonStatus === "comparable") {
    if (
      node.expectedCartesianCompositionCount === null ||
      BigInt(node.compositions.length) !== expected ||
      node.compositions.some(
        ({ outcome }) => outcome !== "evaluated",
      ) ||
      node.issues.length > 0 ||
      node.compositions.length !== expectedSelections.length
    ) {
      return false;
    }
    const expectedReferences = buildNodeReferences(node.compositions);
    return (
      exactEqual(
        node.boundedTechnicalReference,
        expectedReferences.boundedTechnicalReference,
      ) &&
      exactEqual(
        node.intactGeneratorEndpointTechnicalReference,
        expectedReferences.intactGeneratorEndpointTechnicalReference,
      ) &&
      exactEqual(
        node.boundedReferenceOverIntact,
        expectedReferences.boundedReferenceOverIntact,
      )
    );
  }
  return (
    (postGenerationCapWithholding
      ? node.compositions.length === 0 &&
        compositionFailures.length === 0 &&
        node.issues.length === 0
      : compositionFailures.length > 0) &&
    node.boundedTechnicalReference === null &&
    node.intactGeneratorEndpointTechnicalReference === null &&
    node.boundedReferenceOverIntact.status === "not-comparable" &&
    node.boundedReferenceOverIntact.absoluteDelta === null &&
    node.boundedReferenceOverIntact.ratio === null
  );
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

function parseAuthenticatedPositiveInteger(value: string): bigint | null {
  return DECIMAL_INTEGER.test(value) && BigInt(value) > 0n
    ? BigInt(value)
    : null;
}

function progressSemanticsHold(
  rows: ProgressObservation[],
  requireFinal: boolean,
): boolean {
  if (
    rows.length > HARD_MAXIMUM_GENERATOR_RESULT_EMISSIONS_PER_INVOCATION
  ) {
    return false;
  }
  let previous = -1;
  let doneIndex = -1;
  for (const [index, row] of rows.entries()) {
    if (
      !nonEmpty(row.phase) ||
      !Number.isFinite(row.progress) ||
      row.progress < 0 ||
      row.progress > 1 ||
      row.progress < previous ||
      typeof row.done !== "boolean" ||
      (row.done && (row.phase !== "done" || row.progress !== 1)) ||
      doneIndex >= 0
    ) {
      return false;
    }
    previous = row.progress;
    if (row.done) doneIndex = index;
  }
  return (
    doneIndex < 0 || doneIndex === rows.length - 1
  ) && (!requireFinal || doneIndex === rows.length - 1);
}

function issueSemanticsHold(
  issue: BoundedFullTeamEquipmentTechnicalIssue | null,
  expected: {
    nodeId: string;
    carryCharacterId?: string;
    compositionId?: string;
    allowedStages: BoundedFullTeamEquipmentTechnicalIssue["stage"][];
  },
): issue is BoundedFullTeamEquipmentTechnicalIssue {
  return (
    issue !== null &&
    nonEmpty(issue.code) &&
    nonEmpty(issue.path) &&
    nonEmpty(issue.message) &&
    nonEmpty(issue.name) &&
    expected.allowedStages.includes(issue.stage) &&
    issue.nodeId === expected.nodeId &&
    issue.carryCharacterId === expected.carryCharacterId &&
    issue.compositionId === expected.compositionId
  );
}

function calculatorAgreementSemanticsHold(
  objective: number,
  agreement: NonNullable<
    BoundedFullTeamEquipmentCompositionObservation["calculatorAgreement"]
  >,
): boolean {
  const expectedAbsoluteDifference = normalizeNumber(
    Math.abs(
      agreement.interpretedObjective - agreement.compiledObjective,
    ),
  );
  const expectedAllowedDifference = canonicalCalculatorAllowedDifference(
    agreement.interpretedObjective,
    agreement.compiledObjective,
  );
  return (
    Number.isFinite(agreement.interpretedObjective) &&
    Number.isFinite(agreement.compiledObjective) &&
    Number.isFinite(agreement.absoluteDifference) &&
    Number.isFinite(agreement.allowedDifference) &&
    objective === agreement.interpretedObjective &&
    agreement.absoluteDifference >= 0 &&
    agreement.allowedDifference >= 0 &&
    agreement.absoluteDifference === expectedAbsoluteDifference &&
    agreement.allowedDifference === expectedAllowedDifference &&
    expectedAbsoluteDifference <= expectedAllowedDifference
  );
}

function canonicalCalculatorAllowedDifference(
  interpretedObjective: number,
  compiledObjective: number,
): number {
  return normalizeNumber(
    Math.max(
      ABSOLUTE_CALCULATOR_TOLERANCE,
      RELATIVE_CALCULATOR_TOLERANCE *
        Math.max(
          1,
          Math.abs(interpretedObjective),
          Math.abs(compiledObjective),
        ),
    ),
  );
}

function equalWithinFloatingPointRoundoff(left: number, right: number): boolean {
  const scale = Math.max(Math.abs(left), Math.abs(right), Number.MIN_VALUE);
  return Math.abs(left - right) <= 32 * Number.EPSILON * scale;
}

function enumeratePublicCartesian(
  characterIds: string[],
  pools: BoundedFullTeamEquipmentTechnicalNodeObservation["sheetPoolsByCharacter"],
): Array<Record<string, BoundedFullTeamEquipmentSheetPoolCell>> {
  let selections: Array<Record<string, BoundedFullTeamEquipmentSheetPoolCell>> = [
    {},
  ];
  for (const characterId of characterIds) {
    selections = selections.flatMap((selection) =>
      pools[characterId].map((cell) => ({
        ...selection,
        [characterId]: cell,
      })),
    );
  }
  return selections;
}

function publicCompositionId(
  nodeId: string,
  characterIds: string[],
  sheets: BoundedFullTeamEquipmentCompositionObservation["sheetsByCharacter"],
): string {
  return `bounded-full-team-composition:${sha256Text(
    stableJson({
      nodeId,
      sheets: characterIds.map((characterId) => ({
        characterId,
        sheetId: sheets[characterId].sheetId,
      })),
    }),
  )}`;
}

function publicCompositionProvenance(
  characterIds: string[],
  carryCharacterIds: string[],
  sheets: BoundedFullTeamEquipmentCompositionObservation["sheetsByCharacter"],
): BoundedFullTeamEquipmentCompositionProvenance {
  const origins = carryCharacterIds.filter((carryCharacterId) =>
    characterIds.every((characterId) =>
      sheets[characterId].originCarryCharacterIds.includes(carryCharacterId),
    ),
  );
  return {
    classification:
      origins.length > 0
        ? "intact-generator-endpoint"
        : "cross-endpoint-recombination",
    originCarryCharacterIds: origins,
    originMultiplicity: origins.length,
  };
}

function buildGeneratorCombo(
  objectiveLines: SourceBackedEquipmentRuntimeObjectiveLine[],
): ComboFormula {
  return {
    id: "bounded-full-team-equipment-technical-objective",
    label: {
      en: "Bounded full-team technical objective",
      zh: "有界全队技术目标",
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

function toReplayLines(
  objectiveLines: SourceBackedEquipmentRuntimeObjectiveLine[],
): ReplayComboLine[] {
  return objectiveLines.map((line) => ({
    charId: line.characterId,
    formulaId: line.formulaId,
    count: line.count,
    reaction: line.reaction ? structuredClone(line.reaction) : null,
    forceOnField: line.forceOnField ?? false,
  }));
}

function requireFourConfigs(
  configs: TeamSlotConfig[] | null,
): ReplayTeamConfigs {
  if (!configs || configs.length !== 4) {
    throw new Error(
      `Authenticated complete CP37 node expected four configs, found ${configs?.length ?? 0}.`,
    );
  }
  return cloneTeamConfigs(configs) as unknown as ReplayTeamConfigs;
}

function cloneTeamConfigs(
  configs: readonly TeamSlotConfig[],
): TeamSlotConfig[] {
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

function canonicalSheetDump(sheet: StatSheet): SheetDumpEntry[] {
  return [...sheet.dump()]
    .map((entry) => ({
      ...entry,
      value: normalizeNumber(entry.value),
    }))
    .sort(
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.filterKey, right.filterKey) ||
        left.value - right.value,
    );
}

function emptyPools(
  characterIds: string[],
): Record<string, PrivatePoolCell[]> {
  return Object.fromEntries(characterIds.map((characterId) => [characterId, []]));
}

function cloneGeneratorObservation(
  observation: BoundedFullTeamEquipmentGeneratorRunObservation,
): BoundedFullTeamEquipmentGeneratorRunObservation {
  return structuredClone(observation);
}

function isEvaluatedComposition(
  composition: BoundedFullTeamEquipmentCompositionObservation,
): composition is BoundedFullTeamEquipmentCompositionObservation & {
  outcome: "evaluated";
  unreviewedTechnicalObjective: number;
} {
  return (
    composition.outcome === "evaluated" &&
    composition.unreviewedTechnicalObjective !== null
  );
}

function maxByObjective<
  T extends { unreviewedTechnicalObjective: number },
>(values: T[]): T | null {
  return values.reduce<T | null>(
    (best, value) =>
      !best ||
      value.unreviewedTechnicalObjective > best.unreviewedTechnicalObjective
        ? value
        : best,
    null,
  );
}

function makeIssue(
  code: string,
  stage: BoundedFullTeamEquipmentTechnicalIssue["stage"],
  path: string,
  message: string,
): BoundedFullTeamEquipmentTechnicalIssue {
  return { code, stage, path, message, name: "TechnicalComputationIssue" };
}

function serializeIssue(
  error: unknown,
  context: Omit<
    BoundedFullTeamEquipmentTechnicalIssue,
    "code" | "message" | "name"
  >,
): BoundedFullTeamEquipmentTechnicalIssue {
  return {
    code:
      error instanceof TechnicalComputationFailure
        ? error.code
        : `${context.stage}.failed`,
    stage:
      error instanceof TechnicalComputationFailure
        ? error.stage
        : context.stage,
    path: context.path,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "NonErrorThrow",
    ...(context.nodeId ? { nodeId: context.nodeId } : {}),
    ...(context.carryCharacterId
      ? { carryCharacterId: context.carryCharacterId }
      : {}),
    ...(context.compositionId
      ? { compositionId: context.compositionId }
      : {}),
  };
}

function inferStage(
  error: unknown,
  fallback: BoundedFullTeamEquipmentTechnicalIssue["stage"],
): BoundedFullTeamEquipmentTechnicalIssue["stage"] {
  return error instanceof TechnicalComputationFailure
    ? error.stage
    : fallback;
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot normalize non-finite technical value ${value}.`);
  }
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

function sortTextRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameStringDomain(left: string[], right: string[]): boolean {
  return sameStrings(
    [...left].sort(compareText),
    [...right].sort(compareText),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function containsEnergyInput(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(containsEnergyInput);
  if (typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    if (nested === null || nested === undefined) return false;
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    return (
      normalized === "er" ||
      normalized.includes("energyrecovery") ||
      normalized.includes("energyrecharge") ||
      normalized.includes("erthreshold") ||
      normalized.includes("errequirement") ||
      normalized.includes("erfloor") ||
      containsEnergyInput(nested)
    );
  });
}
