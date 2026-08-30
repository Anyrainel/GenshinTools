import type { Element } from "@/data/enums";
import type { ArtifactSetConfig } from "@/data/types";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  CalcContext,
  ExtraBuff,
  OptionMap,
  ReactionOverride,
  TalentLevels,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import { sha256Text, stableJson } from "./io";
import {
  isCompleteSourceBackedEquipmentCandidateLattice,
  type SourceBackedEquipmentCandidateLatticeReport,
  type SourceBackedEquipmentCandidateReference,
  type SourceBackedEquipmentJsonValue,
} from "./sourceBackedEquipmentCandidateLattice";

const SHA256 = /^[a-f0-9]{64}$/;
const DECIMAL_INTEGER = /^(0|[1-9][0-9]*)$/;
const ELEMENTS = new Set<Element>([
  "Pyro",
  "Hydro",
  "Electro",
  "Cryo",
  "Anemo",
  "Geo",
  "Dendro",
]);
const SUBSTAT_BUDGETS = new Set<CalcContext["substatBudget"]>([
  "7_5",
  "7_6",
  "8_6",
  "8_7",
  "9_7",
]);
const REACTION_TYPES = new Set([
  "none",
  "melt",
  "vaporize",
  "quicken",
  "spread",
  "aggravate",
  "overloaded",
  "electroCharged",
  "superconduct",
  "swirl",
  "frozen",
  "shatter",
  "bloom",
  "hyperbloom",
  "burgeon",
  "burning",
  "crystallize",
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
  "stellarConduct",
  "stellarSwirl",
]);
const FORBIDDEN_ENERGY_KEYS = new Set([
  "er",
  "erfloor",
  "errequirement",
  "errequirements",
  "erthreshold",
  "erthresholds",
  "energyrecharge",
  "energyrecovery",
  "energyrequirement",
  "energyrequirements",
  "energythreshold",
  "energythresholds",
]);
const SOURCE_READINESS_BLOCKER_CODES = new Set<
  SourceBackedEquipmentRuntimeSourceReadinessBlocker["code"]
>([
  "translation-unreviewed",
  "range-count-claim",
  "partial-token-mapping",
  "unresolved-formula-mapping",
  "unresolved-source-token",
  "unclassified-formula",
]);

export type SourceBackedEquipmentRuntimeInvestment = {
  teamMemberId: string;
  characterId: string;
  charLevel: number;
  constellation: number;
  talentLevels: TalentLevels;
};

type SourceBackedEquipmentRuntimeOccurrenceResolutionBase = {
  occurrenceId: string;
  axisId: string;
  groupId: string;
  teamMemberId: string;
  characterId: string;
  latticePayloadSha256: string;
};

export type SourceBackedEquipmentRuntimeOccurrenceResolution =
  | (SourceBackedEquipmentRuntimeOccurrenceResolutionBase & {
      equipmentKind: "weapon";
      weaponId: string;
      refinement: number;
    })
  | (SourceBackedEquipmentRuntimeOccurrenceResolutionBase & {
      equipmentKind: "artifact";
      artifactSet: { type: "4pc"; setId: string };
    });

export type SourceBackedEquipmentRuntimeObjectiveLine = {
  characterId: string;
  formulaId: string;
  count: number;
  /** Optional formula metadata is retained exactly, but never evaluated here. */
  reaction?: ReactionOverride | null;
  forceOnField?: boolean;
};

export type SourceBackedEquipmentRuntimeUnresolvedMapping = {
  characterId: string;
  sourceToken: string;
  calculatorFormulaId: string | null;
  reason: string;
};

export type SourceBackedEquipmentRuntimeSourceReadinessBlocker = {
  code:
    | "translation-unreviewed"
    | "range-count-claim"
    | "partial-token-mapping"
    | "unresolved-formula-mapping"
    | "unresolved-source-token"
    | "unclassified-formula";
  characterId?: string;
  formulaId?: string;
  sourceToken?: string;
  message: string;
};

export type SourceBackedEquipmentRuntimeSourceMappingSummary = {
  comparisons: number;
  exactClaims: number;
  rangeClaims: number;
  completeTokenMappings: number;
  partialTokenMappings: number;
  unresolvedMappings: number;
  nonNullFormulaUnresolvedMappings: number;
  nullFormulaUnresolvedMappings: number;
  sourceAbsentMappings: number;
};

export type SourceBackedEquipmentRuntimeObjectiveEnvelope = {
  objectiveId: string;
  sourceTeamRecordId: string;
  sourceRotationRecordId: string;
  sourceRotationId: string;
  expectedFormulaLineCount: number;
  formulaLines: SourceBackedEquipmentRuntimeObjectiveLine[];
  /** Canonical SHA-256 of formulaLines, including any retained line metadata. */
  formulaLinesSha256: string;
  reviewStatus: "unreviewed" | "reviewed";
  /** Authentication performed by the source-specific caller, never this core. */
  sourceBindingEstablishedByCaller: boolean;
  unresolvedMappings: SourceBackedEquipmentRuntimeUnresolvedMapping[];
  sourceReadiness: {
    readyForDamageReplay: boolean;
    blockers: SourceBackedEquipmentRuntimeSourceReadinessBlocker[];
    mappingSummary: SourceBackedEquipmentRuntimeSourceMappingSummary;
  };
};

export type SourceBackedEquipmentRuntimeAssumptions = {
  assumptionsId: string;
  expectedNodeCount: string;
  investments: SourceBackedEquipmentRuntimeInvestment[];
  combatOptions: OptionMap;
  enemyAura: Element | null;
  extraBuffs: ExtraBuff[];
  calcContext: CalcContext;
  carryCharacterIds: string[];
  /** ER and generator constraints remain explicitly absent in this phase. */
  energyRecoveryThresholds: null;
  perCharacterConstraints: null;
};

export type SourceBackedEquipmentRuntimePreflightInput<
  TPayload extends SourceBackedEquipmentJsonValue,
> = {
  lattice: SourceBackedEquipmentCandidateLatticeReport<TPayload>;
  occurrenceResolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[];
  objective: SourceBackedEquipmentRuntimeObjectiveEnvelope;
  runtimeAssumptions: SourceBackedEquipmentRuntimeAssumptions;
};

export type SourceBackedEquipmentRuntimeMaterializationRequest = {
  nodeId: string;
  teamMembers: Array<{ teamMemberId: string; characterId: string }>;
  configs: TeamSlotConfig[];
  combatOptions: OptionMap;
  enemyAura: Element | null;
  extraBuffs: ExtraBuff[];
  calcContext: CalcContext;
};

export type SourceBackedEquipmentRuntimeMaterializationObservation = {
  teamCharacterOrder: string[];
  configs: TeamSlotConfig[];
  availableFormulaIdsByCharacter: Record<string, string[]>;
  formulaOwnerById: Record<string, string | null>;
};

export type SourceBackedEquipmentRuntimePreflightEnvironment = {
  /**
   * Trusted test/wrapper seam. Implementations must return an observation from
   * one fresh existing-runtime TeamBuild for the supplied request.
   */
  environmentId: string;
  bootstrap: () => Promise<void>;
  materialize: (
    request: SourceBackedEquipmentRuntimeMaterializationRequest,
  ) => SourceBackedEquipmentRuntimeMaterializationObservation;
};

export type SourceBackedEquipmentRuntimePreflightBlocker = {
  code: string;
  path: string;
  message: string;
  characterId?: string;
  formulaId?: string;
  sourceToken?: string;
};

type ResolvedMemberEquipment = {
  teamMemberId: string;
  characterId: string;
  weapon: {
    occurrenceId: string;
    weaponId: string;
    refinement: number;
  };
  artifact: {
    occurrenceId: string;
    artifactSet: { type: "4pc"; setId: string };
  };
};

export type SourceBackedEquipmentRuntimePreflightNode = {
  nodeId: string;
  selections: SourceBackedEquipmentCandidateReference[];
  selectionsSha256: string;
  resolvedEquipment: ResolvedMemberEquipment[] | null;
  resolvedEquipmentSha256: string | null;
  materializationStatus: "materialized" | "blocked";
  materializedConfigs: TeamSlotConfig[] | null;
  materializedConfigsSha256: string | null;
  teamOrderMatches: boolean;
  equipmentMatches: boolean;
  objectiveFormulaCoverage: Array<{
    characterId: string;
    formulaId: string;
    count: number;
    available: boolean;
  }>;
  unresolvedFormulaReferenceCoverage: Array<{
    characterId: string;
    formulaId: string;
    available: boolean;
  }>;
  objectiveFormulaLinesSha256: string;
  objectiveEnvelopeSha256: string;
  runtimeAssumptionsSha256: string;
  calcContextSha256: string;
  runtimeReady: boolean;
  readyForEvaluator: boolean;
  blockers: SourceBackedEquipmentRuntimePreflightBlocker[];
};

export type SourceBackedEquipmentRuntimePreflightReport = {
  schemaVersion: 1;
  classification: "source-backed-equipment-runtime-materialization-preflight";
  validationStatus:
    | "withheld-invalid-input"
    | "withheld-incomplete-materialization"
    | "materialized-objective-not-ready"
    | "ready-for-evaluator";
  comparisonStatus: "not-run";
  capabilities: {
    materializationPreflight: true;
    candidateGeneration: false;
    damageReplay: false;
    damageEvaluation: false;
    scoring: false;
    ranking: false;
    recommendation: false;
    guide: false;
    optimality: false;
    energyRecovery: false;
  };
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsOptimality: false;
  supportsEnergyRequirements: false;
  energyRecoveryInputsUsed: false;
  inputBoundary: {
    latticeComplete: boolean;
    sourceLatticeSha256: string;
    memberCount: number;
    axisCount: number;
    activeOccurrenceCount: number;
    expectedCombinationCount: string;
    maximumCombinationCount: string;
    latticeNodeCount: number;
    callerExpectedNodeCount: string;
    occurrenceResolutionCount: number;
    exactOccurrenceResolutionClosure: boolean;
    teamMembers: Array<{ teamMemberId: string; characterId: string }>;
    axisOrder: string[];
    occurrenceResolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[];
  };
  objectiveBoundary: {
    envelope: SourceBackedEquipmentRuntimeObjectiveEnvelope;
    formulaLineHashMatches: boolean;
    objectiveEnvelopeSha256: string;
    sourceBindingEstablishedByCore: false;
    sourceReadyForEvaluation: boolean;
    sourceReadiness: SourceBackedEquipmentRuntimeObjectiveEnvelope["sourceReadiness"];
    blockers: SourceBackedEquipmentRuntimeSourceReadinessBlocker[];
    policyChecks: {
      reviewed: boolean;
      sourceBindingEstablishedByCaller: boolean;
      noUnresolvedMappings: boolean;
      callerReadyForDamageReplay: boolean;
      noSourceReadinessBlockers: boolean;
    };
  };
  runtimeBoundary: {
    assumptions: SourceBackedEquipmentRuntimeAssumptions;
    runtimeAssumptionsSha256: string;
    calcContextSha256: string;
  };
  execution: {
    scheduling: "sequential";
    environmentId: string;
    bootstrapCalls: number;
    plannedMaterializationCount: number;
    observedMaterializationCalls: number;
    freshTeamBuildCount: number;
    materializedNodeCount: number;
    runtimeReadyNodeCount: number;
    evaluatorReadyNodeCount: number;
    objectiveFormulaAvailabilityChecks: number;
    unresolvedFormulaReferenceAvailabilityChecks: number;
    generatorCalls: 0;
    replayCalls: 0;
    damageEvaluationCalls: 0;
    scoringCalls: 0;
    rankingCalls: 0;
    energyRecoveryCalls: 0;
  };
  nodes: SourceBackedEquipmentRuntimePreflightNode[];
  issues: SourceBackedEquipmentRuntimePreflightBlocker[];
  cautions: string[];
  authentication: {
    sourceLatticeSha256: string;
    occurrenceResolutionsSha256: string;
    objectiveEnvelopeSha256: string;
    runtimeAssumptionsSha256: string;
    calcContextSha256: string;
    reportContentSha256: string;
  };
};

export type CompleteSourceBackedEquipmentRuntimePreflightReport = Omit<
  SourceBackedEquipmentRuntimePreflightReport,
  "validationStatus"
> & {
  validationStatus:
    | "materialized-objective-not-ready"
    | "ready-for-evaluator";
};

const DEFAULT_ENVIRONMENT: SourceBackedEquipmentRuntimePreflightEnvironment = {
  environmentId: "existing-team-build-runtime-v1",
  bootstrap: bootstrapGuideFactoryComputation,
  materialize(request) {
    const teamBuild = new TeamBuild(
      cloneTeamConfigs(request.configs),
      { ...request.combatOptions },
      request.enemyAura ?? undefined,
      structuredClone(request.extraBuffs),
      undefined,
      { ...request.calcContext },
    );
    const available = teamBuild.catalog.getFormulaIds();
    return {
      teamCharacterOrder: [...teamBuild.teamMeta.characters],
      configs: cloneTeamConfigs(teamBuild.configs),
      availableFormulaIdsByCharacter: Object.fromEntries(
        Object.entries(available).map(([characterId, formulas]) => [
          characterId,
          Object.keys(formulas).sort(compareText),
        ]),
      ),
      formulaOwnerById: Object.fromEntries(
        [...teamBuild.catalog.formulaIndex.entries()].map(
          ([formulaId, entry]) => [formulaId, entry.owner ?? null],
        ),
      ),
    };
  },
};

/**
 * Materialize every complete lattice node through a fresh calculator TeamBuild.
 * This is a structural preflight only: it never calls a generator, evaluator,
 * damage replay, scorer, ranker, optimizer, or ER calculator.
 */
export async function buildSourceBackedEquipmentRuntimePreflight<
  TPayload extends SourceBackedEquipmentJsonValue,
>(
  rawInput: SourceBackedEquipmentRuntimePreflightInput<TPayload>,
  environment: SourceBackedEquipmentRuntimePreflightEnvironment =
    DEFAULT_ENVIRONMENT,
): Promise<SourceBackedEquipmentRuntimePreflightReport> {
  const input = structuredClone(rawInput);
  const issues: SourceBackedEquipmentRuntimePreflightBlocker[] = [];
  validateInputRoot(input, issues);
  if (!nonEmpty(environment.environmentId)) {
    addBlocker(
      issues,
      "environment.invalid_id",
      "environment.environmentId",
      "Trusted materialization environment ID must be nonblank.",
    );
  }
  const completeLattice = isCompleteSourceBackedEquipmentCandidateLattice(
    input.lattice,
  )
    ? input.lattice.lattice
    : null;
  const latticeComplete = completeLattice !== null;
  if (!latticeComplete) {
    addBlocker(
      issues,
      "lattice.incomplete",
      "lattice",
      "The runtime preflight requires an authenticated complete source-backed lattice.",
    );
  }

  const lattice = completeLattice;
  const sourceLatticeSha256 = sha256Text(stableJson(input.lattice));
  const teamMembers = lattice
    ? lattice.domains
        .filter(({ equipmentKind }) => equipmentKind === "weapon")
        .map(({ teamMemberId, characterId }) => ({
          teamMemberId,
          characterId,
        }))
    : [];
  const axisOrder = lattice ? [...lattice.axisOrder] : [];
  const activeOccurrenceCount = lattice
    ? lattice.domains.reduce(
        (sum, domain) => sum + domain.occurrenceCount,
        0,
      )
    : 0;

  const occurrenceIndex = latticeComplete
    ? indexLatticeOccurrences(input.lattice, issues)
    : new Map<string, IndexedLatticeOccurrence<TPayload>>();
  const resolutionIndex = validateOccurrenceResolutions(
    input.occurrenceResolutions,
    occurrenceIndex,
    issues,
  );
  const exactOccurrenceResolutionClosure =
    latticeComplete &&
    resolutionIndex.size === occurrenceIndex.size &&
    issues.every(({ code }) => !code.startsWith("resolution."));

  validateObjective(input.objective, teamMembers, issues);
  validateRuntimeAssumptions(
    input.runtimeAssumptions,
    teamMembers,
    input.lattice,
    issues,
  );

  const objectiveFormulaLinesSha256 = sha256Text(
    stableJson(input.objective.formulaLines),
  );
  const formulaLineHashMatches =
    input.objective.formulaLinesSha256 === objectiveFormulaLinesSha256;
  const objectiveEnvelopeSha256 = sha256Text(stableJson(input.objective));
  const runtimeAssumptionsSha256 = sha256Text(
    stableJson(input.runtimeAssumptions),
  );
  const calcContextSha256 = sha256Text(
    stableJson(input.runtimeAssumptions.calcContext),
  );
  const occurrenceResolutionsSha256 = sha256Text(
    stableJson(input.occurrenceResolutions),
  );
  const objectiveBlockers = structuredClone(
    input.objective.sourceReadiness.blockers,
  );
  const sourceReadinessPolicyChecks = {
    reviewed: input.objective.reviewStatus === "reviewed",
    sourceBindingEstablishedByCaller:
      input.objective.sourceBindingEstablishedByCaller,
    noUnresolvedMappings: input.objective.unresolvedMappings.length === 0,
    callerReadyForDamageReplay:
      input.objective.sourceReadiness.readyForDamageReplay,
    noSourceReadinessBlockers: objectiveBlockers.length === 0,
  };
  const sourceReadyForEvaluation = Object.values(
    sourceReadinessPolicyChecks,
  ).every(Boolean);

  let bootstrapCalls = 0;
  let observedMaterializationCalls = 0;
  let freshTeamBuildCount = 0;
  const nodes: SourceBackedEquipmentRuntimePreflightNode[] = [];

  if (issues.length === 0) {
    bootstrapCalls += 1;
    await environment.bootstrap();
    for (const node of lattice?.nodes ?? []) {
      const nodeBlockers: SourceBackedEquipmentRuntimePreflightBlocker[] = [];
      const resolvedEquipment = resolveNodeEquipment(
        node.selections,
        resolutionIndex,
        teamMembers,
        nodeBlockers,
      );
      const configs = resolvedEquipment
        ? buildNodeConfigs(
            resolvedEquipment,
            input.runtimeAssumptions.investments,
          )
        : null;
      let observation: SourceBackedEquipmentRuntimeMaterializationObservation | null =
        null;
      if (configs) {
        try {
          observedMaterializationCalls += 1;
          observation = environment.materialize({
            nodeId: node.nodeId,
            teamMembers: structuredClone(teamMembers),
            configs: cloneTeamConfigs(configs),
            combatOptions: { ...input.runtimeAssumptions.combatOptions },
            enemyAura: input.runtimeAssumptions.enemyAura,
            extraBuffs: structuredClone(input.runtimeAssumptions.extraBuffs),
            calcContext: structuredClone(input.runtimeAssumptions.calcContext),
          });
          freshTeamBuildCount += 1;
        } catch (error) {
          addBlocker(
            nodeBlockers,
            "runtime.materialization_failed",
            `nodes.${node.nodeId}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      const expectedOrder = teamMembers.map(({ characterId }) => characterId);
      const teamOrderMatches =
        observation !== null &&
        exactEqual(observation.teamCharacterOrder, expectedOrder);
      if (observation && !teamOrderMatches) {
        addBlocker(
          nodeBlockers,
          "runtime.team_order_mismatch",
          `nodes.${node.nodeId}.teamCharacterOrder`,
          "The materialized runtime team order does not match the lattice member order.",
        );
      }
      const equipmentMatches =
        observation !== null &&
        configs !== null &&
        exactEqual(observation.configs, configs);
      if (observation && !equipmentMatches) {
        addBlocker(
          nodeBlockers,
          "runtime.config_mismatch",
          `nodes.${node.nodeId}.configs`,
          "The materialized runtime configs do not exactly match the selected equipment and investment.",
        );
      }

      const objectiveFormulaCoverage = input.objective.formulaLines.map(
        ({ characterId, formulaId, count }) => ({
          characterId,
          formulaId,
          count,
          available: formulaAvailable(
            observation,
            characterId,
            formulaId,
          ),
        }),
      );
      for (const row of objectiveFormulaCoverage) {
        if (row.available) continue;
        addBlocker(
          nodeBlockers,
          "runtime.objective_formula_unavailable",
          `nodes.${node.nodeId}.formulas.${row.characterId}.${row.formulaId}`,
          `Objective formula ${row.characterId}.${row.formulaId} is unavailable in the materialized runtime catalog.`,
        );
      }

      const unresolvedFormulaReferenceCoverage =
        input.objective.unresolvedMappings
          .filter(
            (mapping): mapping is SourceBackedEquipmentRuntimeUnresolvedMapping & {
              calculatorFormulaId: string;
            } => mapping.calculatorFormulaId !== null,
          )
          .map(({ characterId, calculatorFormulaId }) => ({
            characterId,
            formulaId: calculatorFormulaId,
            available: formulaAvailable(
              observation,
              characterId,
              calculatorFormulaId,
            ),
          }));
      for (const row of unresolvedFormulaReferenceCoverage) {
        if (row.available) continue;
        addBlocker(
          nodeBlockers,
          "runtime.unresolved_formula_reference_unavailable",
          `nodes.${node.nodeId}.unresolved.${row.characterId}.${row.formulaId}`,
          `Referenced unresolved formula ${row.characterId}.${row.formulaId} is unavailable in the materialized runtime catalog.`,
        );
      }

      const runtimeReady =
        resolvedEquipment !== null &&
        configs !== null &&
        observation !== null &&
        teamOrderMatches &&
        equipmentMatches &&
        nodeBlockers.length === 0;
      const blockers = [
        ...nodeBlockers,
        ...(runtimeReady
          ? objectiveBlockers.map((blocker, index) => ({
              ...blocker,
              path: `objective.sourceReadiness.blockers[${index}]`,
            }))
          : []),
      ];
      nodes.push({
        nodeId: node.nodeId,
        selections: structuredClone(node.selections),
        selectionsSha256: sha256Text(stableJson(node.selections)),
        resolvedEquipment: resolvedEquipment
          ? structuredClone(resolvedEquipment)
          : null,
        resolvedEquipmentSha256: resolvedEquipment
          ? sha256Text(stableJson(resolvedEquipment))
          : null,
        materializationStatus: runtimeReady ? "materialized" : "blocked",
        materializedConfigs: runtimeReady ? cloneTeamConfigs(configs) : null,
        materializedConfigsSha256: runtimeReady
          ? sha256Text(stableJson(configs))
          : null,
        teamOrderMatches,
        equipmentMatches,
        objectiveFormulaCoverage,
        unresolvedFormulaReferenceCoverage,
        objectiveFormulaLinesSha256,
        objectiveEnvelopeSha256,
        runtimeAssumptionsSha256,
        calcContextSha256,
        runtimeReady,
        readyForEvaluator: runtimeReady && sourceReadyForEvaluation,
        blockers,
      });
    }
  }

  const materializedNodeCount = nodes.filter(
    ({ materializationStatus }) => materializationStatus === "materialized",
  ).length;
  const runtimeReadyNodeCount = nodes.filter(({ runtimeReady }) => runtimeReady)
    .length;
  const evaluatorReadyNodeCount = nodes.filter(
    ({ readyForEvaluator }) => readyForEvaluator,
  ).length;
  const expectedNodeCount = lattice?.nodes.length ?? 0;
  const allNodesMaterialized =
    issues.length === 0 &&
    nodes.length === expectedNodeCount &&
    expectedNodeCount > 0 &&
    materializedNodeCount === expectedNodeCount &&
    runtimeReadyNodeCount === expectedNodeCount &&
    observedMaterializationCalls === expectedNodeCount &&
    freshTeamBuildCount === expectedNodeCount;
  const validationStatus: SourceBackedEquipmentRuntimePreflightReport["validationStatus"] =
    issues.length > 0
      ? "withheld-invalid-input"
      : !allNodesMaterialized
        ? "withheld-incomplete-materialization"
        : sourceReadyForEvaluation
          ? "ready-for-evaluator"
          : "materialized-objective-not-ready";

  const reportWithoutDigest: SourceBackedEquipmentRuntimePreflightReport = {
    schemaVersion: 1,
    classification:
      "source-backed-equipment-runtime-materialization-preflight",
    validationStatus,
    comparisonStatus: "not-run",
    capabilities: fixedCapabilities(),
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsRankClaims: false,
    supportsDamageClaims: false,
    supportsOptimality: false,
    supportsEnergyRequirements: false,
    energyRecoveryInputsUsed: false,
    inputBoundary: {
      latticeComplete,
      sourceLatticeSha256,
      memberCount: lattice?.memberCount ?? 0,
      axisCount: lattice?.axisCount ?? 0,
      activeOccurrenceCount,
      expectedCombinationCount:
        input.lattice.preflight.expectedCombinationCount,
      maximumCombinationCount: input.lattice.preflight.maximumCombinationCount,
      latticeNodeCount: lattice?.nodes.length ?? 0,
      callerExpectedNodeCount: input.runtimeAssumptions.expectedNodeCount,
      occurrenceResolutionCount: input.occurrenceResolutions.length,
      exactOccurrenceResolutionClosure,
      teamMembers: structuredClone(teamMembers),
      axisOrder,
      occurrenceResolutions: structuredClone(input.occurrenceResolutions),
    },
    objectiveBoundary: {
      envelope: structuredClone(input.objective),
      formulaLineHashMatches,
      objectiveEnvelopeSha256,
      sourceBindingEstablishedByCore: false,
      sourceReadyForEvaluation,
      sourceReadiness: structuredClone(input.objective.sourceReadiness),
      blockers: structuredClone(objectiveBlockers),
      policyChecks: sourceReadinessPolicyChecks,
    },
    runtimeBoundary: {
      assumptions: structuredClone(input.runtimeAssumptions),
      runtimeAssumptionsSha256,
      calcContextSha256,
    },
    execution: {
      scheduling: "sequential",
      environmentId: environment.environmentId,
      bootstrapCalls,
      plannedMaterializationCount: expectedNodeCount,
      observedMaterializationCalls,
      freshTeamBuildCount,
      materializedNodeCount,
      runtimeReadyNodeCount,
      evaluatorReadyNodeCount,
      objectiveFormulaAvailabilityChecks: nodes.reduce(
        (sum, node) => sum + node.objectiveFormulaCoverage.length,
        0,
      ),
      unresolvedFormulaReferenceAvailabilityChecks: nodes.reduce(
        (sum, node) =>
          sum + node.unresolvedFormulaReferenceCoverage.length,
        0,
      ),
      generatorCalls: 0,
      replayCalls: 0,
      damageEvaluationCalls: 0,
      scoringCalls: 0,
      rankingCalls: 0,
      energyRecoveryCalls: 0,
    },
    nodes,
    issues,
    cautions: [
      "Materialization and formula availability do not validate rotation order, buff timing, field time, reaction ownership, gameplay applicability, or damage.",
      "The lattice composes source-backed axis occurrences; it does not make any source the author of a whole equipment candidate.",
      "No generator, damage replay, scorer, ranker, optimizer, or ER calculation runs in this preflight.",
    ],
    authentication: {
      sourceLatticeSha256,
      occurrenceResolutionsSha256,
      objectiveEnvelopeSha256,
      runtimeAssumptionsSha256,
      calcContextSha256,
      reportContentSha256: "",
    },
  };
  reportWithoutDigest.authentication.reportContentSha256 =
    calculateReportContentSha256(reportWithoutDigest);
  requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
    reportWithoutDigest,
  );
  return reportWithoutDigest;
}

/** Reject every post-build mutation through a self-excluding content digest. */
export function requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(
  report: SourceBackedEquipmentRuntimePreflightReport,
): void {
  if (
    !SHA256.test(report.authentication.reportContentSha256) ||
    calculateReportContentSha256(report) !==
      report.authentication.reportContentSha256 ||
    !basicReportSemanticsHold(report)
  ) {
    throw new Error(
      "Source-backed equipment runtime preflight report is incomplete, inconsistent, or mutated.",
    );
  }
}

export function isCompleteSourceBackedEquipmentRuntimePreflightReport(
  report: SourceBackedEquipmentRuntimePreflightReport,
): report is CompleteSourceBackedEquipmentRuntimePreflightReport {
  try {
    requireAuthenticatedSourceBackedEquipmentRuntimePreflightReport(report);
  } catch {
    return false;
  }
  const expected = report.inputBoundary.latticeNodeCount;
  return (
    (report.validationStatus === "materialized-objective-not-ready" ||
      report.validationStatus === "ready-for-evaluator") &&
    report.issues.length === 0 &&
    report.inputBoundary.latticeComplete &&
    report.inputBoundary.exactOccurrenceResolutionClosure &&
    expected > 0 &&
    report.nodes.length === expected &&
    report.execution.observedMaterializationCalls === expected &&
    report.execution.freshTeamBuildCount === expected &&
    report.execution.materializedNodeCount === expected &&
    report.execution.runtimeReadyNodeCount === expected &&
    report.nodes.every(
      (node) =>
        node.materializationStatus === "materialized" &&
        node.runtimeReady &&
        node.materializedConfigs !== null &&
        node.objectiveFormulaCoverage.every(({ available }) => available) &&
        node.unresolvedFormulaReferenceCoverage.every(
          ({ available }) => available,
        ),
    )
  );
}

type IndexedLatticeOccurrence<
  TPayload extends SourceBackedEquipmentJsonValue,
> = {
  reference: SourceBackedEquipmentCandidateReference;
  payload: TPayload;
};

function validateInputRoot<TPayload extends SourceBackedEquipmentJsonValue>(
  input: SourceBackedEquipmentRuntimePreflightInput<TPayload>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const unknownKeys = Object.keys(input).filter(
    (key) =>
      ![
        "lattice",
        "occurrenceResolutions",
        "objective",
        "runtimeAssumptions",
      ].includes(key),
  );
  if (unknownKeys.length > 0) {
    addBlocker(
      issues,
      "input.unknown_field",
      "input",
      `Runtime preflight input has unsupported fields: ${unknownKeys.join(", ")}.`,
    );
  }
}

function indexLatticeOccurrences<
  TPayload extends SourceBackedEquipmentJsonValue,
>(
  report: SourceBackedEquipmentCandidateLatticeReport<TPayload>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): Map<string, IndexedLatticeOccurrence<TPayload>> {
  const result = new Map<string, IndexedLatticeOccurrence<TPayload>>();
  const lattice = report.lattice;
  if (!lattice) return result;
  for (const group of lattice.groups) {
    const domain = lattice.domains.find(({ groupIds }) =>
      groupIds.includes(group.groupId),
    );
    if (!domain) continue;
    for (const occurrence of group.occurrences) {
      if (containsForbiddenEnergyInput(occurrence.payload)) {
        addBlocker(
          issues,
          "lattice.payload_contains_er",
          `lattice.occurrences.${occurrence.occurrenceId}.payload`,
          "Occurrence payload contains an ER-related field outside this phase.",
        );
      }
      result.set(occurrence.occurrenceId, {
        reference: {
          axisId: domain.axisId,
          teamMemberId: domain.teamMemberId,
          characterId: domain.characterId,
          equipmentKind: domain.equipmentKind,
          groupId: group.groupId,
          occurrenceId: occurrence.occurrenceId,
        },
        payload: structuredClone(occurrence.payload),
      });
    }
  }
  return result;
}

function validateOccurrenceResolutions<
  TPayload extends SourceBackedEquipmentJsonValue,
>(
  resolutions: SourceBackedEquipmentRuntimeOccurrenceResolution[],
  occurrences: ReadonlyMap<string, IndexedLatticeOccurrence<TPayload>>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): Map<string, SourceBackedEquipmentRuntimeOccurrenceResolution> {
  const result = new Map<string, SourceBackedEquipmentRuntimeOccurrenceResolution>();
  for (const [index, resolution] of resolutions.entries()) {
    const path = `occurrenceResolutions[${index}]`;
    const allowedResolutionKeys =
      resolution.equipmentKind === "weapon"
        ? [
            "occurrenceId",
            "axisId",
            "groupId",
            "teamMemberId",
            "characterId",
            "latticePayloadSha256",
            "equipmentKind",
            "weaponId",
            "refinement",
          ]
        : [
            "occurrenceId",
            "axisId",
            "groupId",
            "teamMemberId",
            "characterId",
            "latticePayloadSha256",
            "equipmentKind",
            "artifactSet",
          ];
    const unknownResolutionKeys = Object.keys(resolution).filter(
      (key) => !allowedResolutionKeys.includes(key),
    );
    if (unknownResolutionKeys.length > 0) {
      addBlocker(
        issues,
        "resolution.unknown_field",
        path,
        `Occurrence resolution has unsupported fields: ${unknownResolutionKeys.join(", ")}.`,
      );
    }
    if (result.has(resolution.occurrenceId)) {
      addBlocker(
        issues,
        "resolution.duplicate_occurrence",
        `${path}.occurrenceId`,
        `Duplicate resolution for ${resolution.occurrenceId}.`,
      );
      continue;
    }
    result.set(resolution.occurrenceId, resolution);
    const occurrence = occurrences.get(resolution.occurrenceId);
    if (!occurrence) {
      addBlocker(
        issues,
        "resolution.extra_occurrence",
        `${path}.occurrenceId`,
        `Resolution ${resolution.occurrenceId} is not an active lattice occurrence.`,
      );
      continue;
    }
    const expected = occurrence.reference;
    if (
      resolution.axisId !== expected.axisId ||
      resolution.groupId !== expected.groupId ||
      resolution.teamMemberId !== expected.teamMemberId ||
      resolution.characterId !== expected.characterId ||
      resolution.equipmentKind !== expected.equipmentKind
    ) {
      addBlocker(
        issues,
        "resolution.reference_mismatch",
        path,
        "Occurrence resolution reference fields do not exactly match the lattice occurrence.",
      );
    }
    const expectedPayloadSha256 = sha256Text(stableJson(occurrence.payload));
    if (
      !SHA256.test(resolution.latticePayloadSha256) ||
      resolution.latticePayloadSha256 !== expectedPayloadSha256
    ) {
      addBlocker(
        issues,
        "resolution.payload_hash_mismatch",
        `${path}.latticePayloadSha256`,
        "Occurrence resolution is not bound to the exact lattice payload.",
      );
    }
    if (resolution.equipmentKind === "weapon") {
      if (
        !nonEmpty(resolution.weaponId) ||
        !Number.isInteger(resolution.refinement) ||
        resolution.refinement < 1 ||
        resolution.refinement > 5
      ) {
        addBlocker(
          issues,
          "resolution.invalid_weapon",
          path,
          "Weapon resolutions require a nonblank weapon ID and Refinement 1 through 5.",
        );
      }
    } else {
      const artifactSet = resolution.artifactSet;
      if (
        !artifactSet ||
        Object.keys(artifactSet).some(
          (key) => !["type", "setId"].includes(key),
        ) ||
        artifactSet.type !== "4pc" ||
        !nonEmpty(artifactSet.setId)
      ) {
        addBlocker(
          issues,
          "resolution.non_4pc_artifact",
          path,
          "Artifact resolutions in this preflight must select exactly one exact 4pc set object.",
        );
      }
    }
    if (containsForbiddenEnergyInput(resolution)) {
      addBlocker(
        issues,
        "resolution.contains_er",
        path,
        "Occurrence resolution contains an ER-related field outside this phase.",
      );
    }
  }
  for (const occurrenceId of occurrences.keys()) {
    if (result.has(occurrenceId)) continue;
    addBlocker(
      issues,
      "resolution.missing_occurrence",
      "occurrenceResolutions",
      `Active lattice occurrence ${occurrenceId} has no runtime resolution.`,
    );
  }
  return result;
}

function validateObjective(
  objective: SourceBackedEquipmentRuntimeObjectiveEnvelope,
  teamMembers: Array<{ teamMemberId: string; characterId: string }>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const unknownObjectiveKeys = Object.keys(objective).filter(
    (key) =>
      ![
        "objectiveId",
        "sourceTeamRecordId",
        "sourceRotationRecordId",
        "sourceRotationId",
        "expectedFormulaLineCount",
        "formulaLines",
        "formulaLinesSha256",
        "reviewStatus",
        "sourceBindingEstablishedByCaller",
        "unresolvedMappings",
        "sourceReadiness",
      ].includes(key),
  );
  if (unknownObjectiveKeys.length > 0) {
    addBlocker(
      issues,
      "objective.unknown_field",
      "objective",
      `Objective envelope has unsupported fields: ${unknownObjectiveKeys.join(", ")}.`,
    );
  }
  for (const [key, value] of Object.entries({
    objectiveId: objective.objectiveId,
    sourceTeamRecordId: objective.sourceTeamRecordId,
    sourceRotationRecordId: objective.sourceRotationRecordId,
    sourceRotationId: objective.sourceRotationId,
  })) {
    if (!nonEmpty(value)) {
      addBlocker(
        issues,
        "objective.invalid_id",
        `objective.${key}`,
        `${key} must be nonblank.`,
      );
    }
  }
  if (
    !Number.isInteger(objective.expectedFormulaLineCount) ||
    objective.expectedFormulaLineCount <= 0 ||
    objective.formulaLines.length !== objective.expectedFormulaLineCount
  ) {
    addBlocker(
      issues,
      "objective.formula_count_mismatch",
      "objective.expectedFormulaLineCount",
      "Objective formula lines must exactly match the positive declared count.",
    );
  }
  const characterIds = new Set(teamMembers.map(({ characterId }) => characterId));
  const keys = new Set<string>();
  for (const [index, line] of objective.formulaLines.entries()) {
    const path = `objective.formulaLines[${index}]`;
    const unknownKeys = Object.keys(line).filter(
      (key) =>
        !["characterId", "formulaId", "count", "reaction", "forceOnField"].includes(
          key,
        ),
    );
    if (unknownKeys.length > 0) {
      addBlocker(
        issues,
        "objective.line_unknown_field",
        path,
        `Objective formula line has unsupported fields: ${unknownKeys.join(", ")}.`,
      );
    }
    if (
      !characterIds.has(line.characterId) ||
      !nonEmpty(line.formulaId) ||
      !Number.isFinite(line.count) ||
      line.count <= 0 ||
      (line.forceOnField !== undefined &&
        typeof line.forceOnField !== "boolean") ||
      (line.reaction !== undefined &&
        line.reaction !== null &&
        !validReactionOverride(line.reaction))
    ) {
      addBlocker(
        issues,
        "objective.invalid_formula_line",
        path,
        "Objective formula lines require a team character, formula ID, positive finite count, and valid optional metadata.",
      );
    }
    const key = `${line.characterId}\0${line.formulaId}`;
    if (keys.has(key)) {
      addBlocker(
        issues,
        "objective.duplicate_formula_line",
        path,
        `Objective repeats ${line.characterId}.${line.formulaId}.`,
      );
    }
    keys.add(key);
  }
  const calculatedHash = sha256Text(stableJson(objective.formulaLines));
  if (
    !SHA256.test(objective.formulaLinesSha256) ||
    objective.formulaLinesSha256 !== calculatedHash
  ) {
    addBlocker(
      issues,
      "objective.formula_hash_mismatch",
      "objective.formulaLinesSha256",
      "Objective formula-line hash does not match the exact canonical lines.",
    );
  }
  if (
    objective.reviewStatus !== "unreviewed" &&
    objective.reviewStatus !== "reviewed"
  ) {
    addBlocker(
      issues,
      "objective.invalid_review_status",
      "objective.reviewStatus",
      "Objective review status must be unreviewed or reviewed.",
    );
  }
  const mappingKeys = new Set<string>();
  for (const [index, mapping] of objective.unresolvedMappings.entries()) {
    const path = `objective.unresolvedMappings[${index}]`;
    const unknownMappingKeys = Object.keys(mapping).filter(
      (key) =>
        ![
          "characterId",
          "sourceToken",
          "calculatorFormulaId",
          "reason",
        ].includes(key),
    );
    if (
      unknownMappingKeys.length > 0 ||
      !characterIds.has(mapping.characterId) ||
      !nonEmpty(mapping.sourceToken) ||
      (mapping.calculatorFormulaId !== null &&
        !nonEmpty(mapping.calculatorFormulaId)) ||
      !nonEmpty(mapping.reason)
    ) {
      addBlocker(
        issues,
        "objective.invalid_unresolved_mapping",
        path,
        "Unresolved mappings require a team character, source token, reason, and optional nonblank formula ID.",
      );
    }
    const key = stableJson({
      characterId: mapping.characterId,
      sourceToken: mapping.sourceToken,
      calculatorFormulaId: mapping.calculatorFormulaId,
    });
    if (mappingKeys.has(key)) {
      addBlocker(
        issues,
        "objective.duplicate_unresolved_mapping",
        path,
        "Objective repeats an unresolved source mapping.",
      );
    }
    mappingKeys.add(key);
  }
  if (typeof objective.sourceBindingEstablishedByCaller !== "boolean") {
    addBlocker(
      issues,
      "objective.invalid_caller_source_binding",
      "objective.sourceBindingEstablishedByCaller",
      "Caller source-binding state must be an explicit boolean.",
    );
  }
  validateSourceReadiness(objective, issues);
  if (containsForbiddenEnergyInput(objective)) {
    addBlocker(
      issues,
      "objective.contains_er",
      "objective",
      "Objective envelope contains an ER-related field outside this phase.",
    );
  }
}

function validateSourceReadiness(
  objective: SourceBackedEquipmentRuntimeObjectiveEnvelope,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const readiness = objective.sourceReadiness;
  const allowedReadinessKeys = new Set([
    "readyForDamageReplay",
    "blockers",
    "mappingSummary",
  ]);
  const unknownReadinessKeys = Object.keys(readiness).filter(
    (key) => !allowedReadinessKeys.has(key),
  );
  if (unknownReadinessKeys.length > 0) {
    addBlocker(
      issues,
      "objective.source_readiness_unknown_field",
      "objective.sourceReadiness",
      `Source readiness has unsupported fields: ${unknownReadinessKeys.join(", ")}.`,
    );
  }
  const blockerKeys = new Set<string>();
  const blockerCounts = new Map<string, number>();
  for (const [index, blocker] of readiness.blockers.entries()) {
    const path = `objective.sourceReadiness.blockers[${index}]`;
    const unknownBlockerKeys = Object.keys(blocker).filter(
      (key) =>
        ![
          "code",
          "characterId",
          "formulaId",
          "sourceToken",
          "message",
        ].includes(key),
    );
    if (
      unknownBlockerKeys.length > 0 ||
      !SOURCE_READINESS_BLOCKER_CODES.has(blocker.code) ||
      !nonEmpty(blocker.message) ||
      (blocker.characterId !== undefined &&
        !nonEmpty(blocker.characterId)) ||
      (blocker.formulaId !== undefined && !nonEmpty(blocker.formulaId)) ||
      (blocker.sourceToken !== undefined && !nonEmpty(blocker.sourceToken))
    ) {
      addBlocker(
        issues,
        "objective.invalid_source_readiness_blocker",
        path,
        "Source-readiness blockers must retain a recognized code, exact optional identities, and a nonblank message.",
      );
    }
    const key = stableJson(blocker);
    if (blockerKeys.has(key)) {
      addBlocker(
        issues,
        "objective.duplicate_source_readiness_blocker",
        path,
        "Source readiness repeats an exact blocker row.",
      );
    }
    blockerKeys.add(key);
    blockerCounts.set(blocker.code, (blockerCounts.get(blocker.code) ?? 0) + 1);
  }
  const unresolvedBlockerClosure = objective.unresolvedMappings.every(
    (mapping) =>
      readiness.blockers.filter((blocker) =>
        sourceReadinessBlockerMatchesUnresolvedMapping(blocker, mapping),
      ).length === 1,
  ) &&
    readiness.blockers
      .filter(
        ({ code }) =>
          code === "unresolved-formula-mapping" ||
          code === "unresolved-source-token",
      )
      .every(
        (blocker) =>
          objective.unresolvedMappings.filter((mapping) =>
            sourceReadinessBlockerMatchesUnresolvedMapping(blocker, mapping),
          ).length === 1,
      );
  const formulaBoundBlockersValid = readiness.blockers
    .filter(
      ({ code }) =>
        code === "range-count-claim" ||
        code === "partial-token-mapping" ||
        code === "unclassified-formula",
    )
    .every(
      ({ characterId, formulaId }) =>
        objective.formulaLines.some(
          (line) =>
            line.characterId === characterId && line.formulaId === formulaId,
        ),
    );
  if (
    typeof readiness.readyForDamageReplay !== "boolean" ||
    readiness.readyForDamageReplay !== (readiness.blockers.length === 0)
  ) {
    addBlocker(
      issues,
      "objective.source_readiness_status_mismatch",
      "objective.sourceReadiness.readyForDamageReplay",
      "Caller readiness must be true exactly when its authenticated blocker list is empty.",
    );
  }
  const summary = readiness.mappingSummary;
  const summaryKeys = [
    "comparisons",
    "exactClaims",
    "rangeClaims",
    "completeTokenMappings",
    "partialTokenMappings",
    "unresolvedMappings",
    "nonNullFormulaUnresolvedMappings",
    "nullFormulaUnresolvedMappings",
    "sourceAbsentMappings",
  ] as const;
  const unknownSummaryKeys = Object.keys(summary).filter(
    (key) => !summaryKeys.includes(key as (typeof summaryKeys)[number]),
  );
  const summaryValuesValid = summaryKeys.every(
    (key) => Number.isInteger(summary[key]) && summary[key] >= 0,
  );
  if (
    unknownSummaryKeys.length > 0 ||
    !summaryValuesValid ||
    !unresolvedBlockerClosure ||
    !formulaBoundBlockersValid ||
    summary.comparisons !== objective.formulaLines.length ||
    summary.exactClaims + summary.rangeClaims !== summary.comparisons ||
    summary.completeTokenMappings + summary.partialTokenMappings !==
      summary.comparisons ||
    summary.nonNullFormulaUnresolvedMappings +
      summary.nullFormulaUnresolvedMappings !==
      summary.unresolvedMappings ||
    summary.unresolvedMappings !== objective.unresolvedMappings.length ||
    (blockerCounts.get("translation-unreviewed") ?? 0) !==
      (objective.reviewStatus === "unreviewed" ? 1 : 0) ||
    (blockerCounts.get("range-count-claim") ?? 0) !== summary.rangeClaims ||
    (blockerCounts.get("partial-token-mapping") ?? 0) !==
      summary.partialTokenMappings ||
    (blockerCounts.get("unresolved-formula-mapping") ?? 0) !==
      summary.nonNullFormulaUnresolvedMappings ||
    (blockerCounts.get("unresolved-source-token") ?? 0) !==
      summary.nullFormulaUnresolvedMappings
  ) {
    addBlocker(
      issues,
      "objective.source_readiness_summary_mismatch",
      "objective.sourceReadiness.mappingSummary",
      "Source-readiness mapping counts, blocker counts, and unresolved mappings must form one exact closure.",
    );
  }
}

function sourceReadinessBlockerMatchesUnresolvedMapping(
  blocker: SourceBackedEquipmentRuntimeSourceReadinessBlocker,
  mapping: SourceBackedEquipmentRuntimeUnresolvedMapping,
): boolean {
  return (
    blocker.code ===
      (mapping.calculatorFormulaId === null
        ? "unresolved-source-token"
        : "unresolved-formula-mapping") &&
    blocker.characterId === mapping.characterId &&
    blocker.sourceToken === mapping.sourceToken &&
    (mapping.calculatorFormulaId === null
      ? blocker.formulaId === undefined
      : blocker.formulaId === mapping.calculatorFormulaId)
  );
}

function validateRuntimeAssumptions<TPayload extends SourceBackedEquipmentJsonValue>(
  assumptions: SourceBackedEquipmentRuntimeAssumptions,
  teamMembers: Array<{ teamMemberId: string; characterId: string }>,
  lattice: SourceBackedEquipmentCandidateLatticeReport<TPayload>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const allowedAssumptionKeys = new Set([
    "assumptionsId",
    "expectedNodeCount",
    "investments",
    "combatOptions",
    "enemyAura",
    "extraBuffs",
    "calcContext",
    "carryCharacterIds",
    "energyRecoveryThresholds",
    "perCharacterConstraints",
  ]);
  const unknownAssumptionKeys = Object.keys(assumptions).filter(
    (key) => !allowedAssumptionKeys.has(key),
  );
  if (unknownAssumptionKeys.length > 0) {
    addBlocker(
      issues,
      "assumptions.unknown_field",
      "runtimeAssumptions",
      `Runtime assumptions have unsupported fields: ${unknownAssumptionKeys.join(", ")}.`,
    );
  }
  if (!nonEmpty(assumptions.assumptionsId)) {
    addBlocker(
      issues,
      "assumptions.invalid_id",
      "runtimeAssumptions.assumptionsId",
      "Runtime assumptions ID must be nonblank.",
    );
  }
  if (
    !DECIMAL_INTEGER.test(assumptions.expectedNodeCount) ||
    assumptions.expectedNodeCount === "0" ||
    assumptions.expectedNodeCount !== lattice.preflight.expectedCombinationCount
  ) {
    addBlocker(
      issues,
      "assumptions.node_count_mismatch",
      "runtimeAssumptions.expectedNodeCount",
      "Runtime expected node count must exactly match the complete lattice count.",
    );
  }
  if (assumptions.investments.length !== teamMembers.length) {
    addBlocker(
      issues,
      "assumptions.investment_count_mismatch",
      "runtimeAssumptions.investments",
      "Runtime investments must contain exactly one ordered row per team member.",
    );
  }
  const investmentMembers = new Set<string>();
  for (const [index, investment] of assumptions.investments.entries()) {
    const path = `runtimeAssumptions.investments[${index}]`;
    const unknownInvestmentKeys = Object.keys(investment).filter(
      (key) =>
        ![
          "teamMemberId",
          "characterId",
          "charLevel",
          "constellation",
          "talentLevels",
        ].includes(key),
    );
    const unknownTalentKeys = Object.keys(investment.talentLevels).filter(
      (key) => !["auto", "skill", "burst"].includes(key),
    );
    const expected = teamMembers[index];
    if (
      !expected ||
      investment.teamMemberId !== expected.teamMemberId ||
      investment.characterId !== expected.characterId
    ) {
      addBlocker(
        issues,
        "assumptions.investment_order_mismatch",
        path,
        "Runtime investments must follow the exact lattice member order and identity.",
      );
    }
    if (investmentMembers.has(investment.teamMemberId)) {
      addBlocker(
        issues,
        "assumptions.duplicate_investment",
        path,
        `Duplicate investment for ${investment.teamMemberId}.`,
      );
    }
    investmentMembers.add(investment.teamMemberId);
    if (
      unknownInvestmentKeys.length > 0 ||
      unknownTalentKeys.length > 0 ||
      !Number.isInteger(investment.charLevel) ||
      investment.charLevel < 1 ||
      investment.charLevel > 100 ||
      !Number.isInteger(investment.constellation) ||
      investment.constellation < 0 ||
      investment.constellation > 6 ||
      !validTalentLevels(investment.talentLevels)
    ) {
      addBlocker(
        issues,
        "assumptions.invalid_investment",
        path,
        "Investment requires level 1-100, constellation 0-6, and talent levels 1-15.",
      );
    }
  }
  if (
    assumptions.carryCharacterIds.length !== teamMembers.length ||
    new Set(assumptions.carryCharacterIds).size !== teamMembers.length ||
    !sameStringSet(
      assumptions.carryCharacterIds,
      teamMembers.map(({ characterId }) => characterId),
    )
  ) {
    addBlocker(
      issues,
      "assumptions.carry_closure_mismatch",
      "runtimeAssumptions.carryCharacterIds",
      "Carry IDs must be an exact unique closure over the four team characters.",
    );
  }
  if (
    assumptions.enemyAura !== null &&
    !ELEMENTS.has(assumptions.enemyAura)
  ) {
    addBlocker(
      issues,
      "assumptions.invalid_enemy_aura",
      "runtimeAssumptions.enemyAura",
      "Enemy aura must be null or a supported element.",
    );
  }
  if (
    Object.entries(assumptions.combatOptions).some(
      ([key, value]) => !nonEmpty(key) || typeof value !== "string",
    )
  ) {
    addBlocker(
      issues,
      "assumptions.invalid_combat_options",
      "runtimeAssumptions.combatOptions",
      "Combat options must be a string-to-string record.",
    );
  }
  validateExtraBuffs(assumptions.extraBuffs, teamMembers, issues);
  validateCalcContext(assumptions.calcContext, teamMembers, issues);
  if (
    assumptions.energyRecoveryThresholds !== null ||
    assumptions.perCharacterConstraints !== null
  ) {
    addBlocker(
      issues,
      "assumptions.deferred_inputs_present",
      "runtimeAssumptions",
      "ER thresholds and per-character generator constraints must remain explicitly null.",
    );
  }
  const energyScanInput = {
    investments: assumptions.investments,
    combatOptions: assumptions.combatOptions,
    enemyAura: assumptions.enemyAura,
    extraBuffs: assumptions.extraBuffs,
    calcContext: assumptions.calcContext,
    carryCharacterIds: assumptions.carryCharacterIds,
  };
  if (
    containsForbiddenEnergyInput(energyScanInput) ||
    assumptions.extraBuffs.some(({ stats }) =>
      stats.some(({ key }) => key === "er"),
    )
  ) {
    addBlocker(
      issues,
      "assumptions.contains_er",
      "runtimeAssumptions",
      "Runtime assumptions contain ER input outside this deferred phase.",
    );
  }
}

function validateExtraBuffs(
  buffs: ExtraBuff[],
  teamMembers: Array<{ teamMemberId: string; characterId: string }>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const ids = new Set<string>();
  const characters = new Set(teamMembers.map(({ characterId }) => characterId));
  for (const [index, buff] of buffs.entries()) {
    const path = `runtimeAssumptions.extraBuffs[${index}]`;
    const unknownBuffKeys = Object.keys(buff).filter(
      (key) => !["id", "presetId", "target", "stats", "maxStacks"].includes(key),
    );
    const invalidStatShape = buff.stats.some(
      (stat) =>
        Object.keys(stat).some((key) => !["key", "value"].includes(key)) ||
        !nonEmpty(stat.key) ||
        !Number.isFinite(stat.value) ||
        stat.key === "er",
    );
    if (
      unknownBuffKeys.length > 0 ||
      !nonEmpty(buff.id) ||
      ids.has(buff.id) ||
      (buff.target !== "team" && !characters.has(buff.target)) ||
      (buff.maxStacks !== undefined &&
        (!Number.isInteger(buff.maxStacks) || buff.maxStacks <= 0)) ||
      invalidStatShape
    ) {
      addBlocker(
        issues,
        "assumptions.invalid_extra_buff",
        path,
        "Extra buffs require unique IDs, team-scoped targets, finite non-ER stats, and a positive optional stack cap.",
      );
    }
    ids.add(buff.id);
  }
}

function validateCalcContext(
  context: CalcContext,
  teamMembers: Array<{ teamMemberId: string; characterId: string }>,
  issues: SourceBackedEquipmentRuntimePreflightBlocker[],
): void {
  const allowedKeys = new Set([
    "enemyLevel",
    "enemyRes",
    "perCharCrTarget",
    "rollMultiplier",
    "substatBudget",
    "stellarAttachHits",
    "stellarDirectCoeff",
  ]);
  const unknownKeys = Object.keys(context).filter((key) => !allowedKeys.has(key));
  const targetCharacters = new Set(
    teamMembers.map(({ characterId }) => characterId),
  );
  const perCharEntries = Object.entries(context.perCharCrTarget ?? {});
  if (
    unknownKeys.length > 0 ||
    !Number.isFinite(context.enemyLevel) ||
    context.enemyLevel <= 0 ||
    !Number.isFinite(context.enemyRes) ||
    !Number.isFinite(context.rollMultiplier) ||
    context.rollMultiplier <= 0 ||
    context.rollMultiplier > 1 ||
    !SUBSTAT_BUDGETS.has(context.substatBudget) ||
    perCharEntries.some(
      ([characterId, target]) =>
        !targetCharacters.has(characterId) ||
        !Number.isInteger(target) ||
        target < 0 ||
        target > 100,
    ) ||
    (context.stellarAttachHits !== undefined &&
      (!Number.isFinite(context.stellarAttachHits) ||
        context.stellarAttachHits <= 0)) ||
    (context.stellarDirectCoeff !== undefined &&
      !Number.isFinite(context.stellarDirectCoeff))
  ) {
    addBlocker(
      issues,
      "assumptions.invalid_calc_context",
      "runtimeAssumptions.calcContext",
      `CalcContext is invalid or has unsupported fields${
        unknownKeys.length > 0 ? `: ${unknownKeys.join(", ")}` : "."
      }`,
    );
  }
}

function resolveNodeEquipment(
  selections: SourceBackedEquipmentCandidateReference[],
  resolutions: ReadonlyMap<
    string,
    SourceBackedEquipmentRuntimeOccurrenceResolution
  >,
  teamMembers: Array<{ teamMemberId: string; characterId: string }>,
  blockers: SourceBackedEquipmentRuntimePreflightBlocker[],
): ResolvedMemberEquipment[] | null {
  const byMember = new Map<
    string,
    {
      weapon?: Extract<
        SourceBackedEquipmentRuntimeOccurrenceResolution,
        { equipmentKind: "weapon" }
      >;
      artifact?: Extract<
        SourceBackedEquipmentRuntimeOccurrenceResolution,
        { equipmentKind: "artifact" }
      >;
    }
  >();
  for (const selection of selections) {
    const resolution = resolutions.get(selection.occurrenceId);
    if (!resolution || !exactReferenceResolution(selection, resolution)) {
      addBlocker(
        blockers,
        "node.unresolved_selection",
        `nodes.selections.${selection.occurrenceId}`,
        "Node selection has no exact occurrence resolution.",
      );
      continue;
    }
    const member = byMember.get(selection.teamMemberId) ?? {};
    if (resolution.equipmentKind === "weapon") {
      if (member.weapon) {
        addBlocker(
          blockers,
          "node.duplicate_weapon",
          `nodes.${selection.teamMemberId}`,
          "Node contains more than one weapon for a member.",
        );
      }
      member.weapon = resolution;
    } else {
      if (member.artifact) {
        addBlocker(
          blockers,
          "node.duplicate_artifact",
          `nodes.${selection.teamMemberId}`,
          "Node contains more than one artifact for a member.",
        );
      }
      member.artifact = resolution;
    }
    byMember.set(selection.teamMemberId, member);
  }
  const result: ResolvedMemberEquipment[] = [];
  for (const member of teamMembers) {
    const equipment = byMember.get(member.teamMemberId);
    if (!equipment?.weapon || !equipment.artifact) {
      addBlocker(
        blockers,
        "node.partial_member",
        `nodes.${member.teamMemberId}`,
        "Every node member requires exactly one weapon and one artifact.",
      );
      continue;
    }
    result.push({
      teamMemberId: member.teamMemberId,
      characterId: member.characterId,
      weapon: {
        occurrenceId: equipment.weapon.occurrenceId,
        weaponId: equipment.weapon.weaponId,
        refinement: equipment.weapon.refinement,
      },
      artifact: {
        occurrenceId: equipment.artifact.occurrenceId,
        artifactSet: { ...equipment.artifact.artifactSet },
      },
    });
  }
  return blockers.length === 0 && result.length === teamMembers.length
    ? result
    : null;
}

function buildNodeConfigs(
  equipment: ResolvedMemberEquipment[],
  investments: SourceBackedEquipmentRuntimeInvestment[],
): TeamSlotConfig[] {
  return equipment.map((member, index) => {
    const investment = investments[index];
    return {
      charId: member.characterId,
      charLevel: investment.charLevel,
      constellation: investment.constellation,
      weaponId: member.weapon.weaponId,
      refinement: member.weapon.refinement,
      artifactSet: cloneArtifactSet(member.artifact.artifactSet),
      talentLevels: { ...investment.talentLevels },
    };
  });
}

function formulaAvailable(
  observation: SourceBackedEquipmentRuntimeMaterializationObservation | null,
  characterId: string,
  formulaId: string,
): boolean {
  return (
    observation !== null &&
    observation.availableFormulaIdsByCharacter[characterId]?.includes(
      formulaId,
    ) === true &&
    observation.formulaOwnerById[formulaId] === characterId
  );
}

function basicReportSemanticsHold(
  report: SourceBackedEquipmentRuntimePreflightReport,
): boolean {
  const { authentication, capabilities, execution } = report;
  if (
    report.schemaVersion !== 1 ||
    report.classification !==
      "source-backed-equipment-runtime-materialization-preflight" ||
    report.comparisonStatus !== "not-run" ||
    !exactEqual(capabilities, fixedCapabilities()) ||
    report.supportsGuideClaims ||
    report.supportsEquipmentRecommendations ||
    report.supportsRankClaims ||
    report.supportsDamageClaims ||
    report.supportsOptimality ||
    report.supportsEnergyRequirements ||
    report.energyRecoveryInputsUsed ||
    execution.generatorCalls !== 0 ||
    execution.replayCalls !== 0 ||
    execution.damageEvaluationCalls !== 0 ||
    execution.scoringCalls !== 0 ||
    execution.rankingCalls !== 0 ||
    execution.energyRecoveryCalls !== 0 ||
    authentication.sourceLatticeSha256 !==
      report.inputBoundary.sourceLatticeSha256 ||
    authentication.occurrenceResolutionsSha256 !==
      sha256Text(stableJson(report.inputBoundary.occurrenceResolutions)) ||
    authentication.objectiveEnvelopeSha256 !==
      sha256Text(stableJson(report.objectiveBoundary.envelope)) ||
    authentication.objectiveEnvelopeSha256 !==
      report.objectiveBoundary.objectiveEnvelopeSha256 ||
    authentication.runtimeAssumptionsSha256 !==
      sha256Text(stableJson(report.runtimeBoundary.assumptions)) ||
    authentication.runtimeAssumptionsSha256 !==
      report.runtimeBoundary.runtimeAssumptionsSha256 ||
    authentication.calcContextSha256 !==
      sha256Text(stableJson(report.runtimeBoundary.assumptions.calcContext)) ||
    authentication.calcContextSha256 !==
      report.runtimeBoundary.calcContextSha256 ||
    report.objectiveBoundary.formulaLineHashMatches !==
      (report.objectiveBoundary.envelope.formulaLinesSha256 ===
        sha256Text(
          stableJson(report.objectiveBoundary.envelope.formulaLines),
        )) ||
    report.objectiveBoundary.sourceBindingEstablishedByCore ||
    !exactEqual(
      report.objectiveBoundary.sourceReadiness,
      report.objectiveBoundary.envelope.sourceReadiness,
    ) ||
    !exactEqual(
      report.objectiveBoundary.blockers,
      report.objectiveBoundary.envelope.sourceReadiness.blockers,
    ) ||
    !exactEqual(report.objectiveBoundary.policyChecks, {
      reviewed:
        report.objectiveBoundary.envelope.reviewStatus === "reviewed",
      sourceBindingEstablishedByCaller:
        report.objectiveBoundary.envelope
          .sourceBindingEstablishedByCaller,
      noUnresolvedMappings:
        report.objectiveBoundary.envelope.unresolvedMappings.length === 0,
      callerReadyForDamageReplay:
        report.objectiveBoundary.envelope.sourceReadiness
          .readyForDamageReplay,
      noSourceReadinessBlockers:
        report.objectiveBoundary.envelope.sourceReadiness.blockers.length ===
        0,
    }) ||
    report.objectiveBoundary.sourceReadyForEvaluation !==
      Object.values(report.objectiveBoundary.policyChecks).every(Boolean) ||
    report.inputBoundary.occurrenceResolutionCount !==
      report.inputBoundary.occurrenceResolutions.length ||
    (report.inputBoundary.latticeComplete &&
      (report.inputBoundary.memberCount !== 4 ||
        report.inputBoundary.axisCount !== 8 ||
        report.inputBoundary.teamMembers.length !== 4 ||
        report.inputBoundary.axisOrder.length !== 8)) ||
    execution.plannedMaterializationCount !==
      report.inputBoundary.latticeNodeCount ||
    execution.materializedNodeCount !==
      report.nodes.filter(
        ({ materializationStatus }) => materializationStatus === "materialized",
      ).length ||
    execution.runtimeReadyNodeCount !==
      report.nodes.filter(({ runtimeReady }) => runtimeReady).length ||
    execution.evaluatorReadyNodeCount !==
      report.nodes.filter(({ readyForEvaluator }) => readyForEvaluator).length ||
    execution.objectiveFormulaAvailabilityChecks !==
      report.nodes.reduce(
        (sum, node) => sum + node.objectiveFormulaCoverage.length,
        0,
      ) ||
    execution.unresolvedFormulaReferenceAvailabilityChecks !==
      report.nodes.reduce(
        (sum, node) =>
          sum + node.unresolvedFormulaReferenceCoverage.length,
        0,
      )
  ) {
    return false;
  }
  const nodeIds = new Set<string>();
  for (const node of report.nodes) {
    if (
      nodeIds.has(node.nodeId) ||
      node.selections.length !== 8 ||
      node.selectionsSha256 !== sha256Text(stableJson(node.selections)) ||
      node.objectiveFormulaLinesSha256 !==
        report.objectiveBoundary.envelope.formulaLinesSha256 ||
      node.objectiveEnvelopeSha256 !==
        authentication.objectiveEnvelopeSha256 ||
      node.runtimeAssumptionsSha256 !==
        authentication.runtimeAssumptionsSha256 ||
      node.calcContextSha256 !== authentication.calcContextSha256 ||
      node.objectiveFormulaCoverage.length !==
        report.objectiveBoundary.envelope.formulaLines.length ||
      (node.resolvedEquipment === null) !==
        (node.resolvedEquipmentSha256 === null) ||
      (node.resolvedEquipment !== null &&
        node.resolvedEquipmentSha256 !==
          sha256Text(stableJson(node.resolvedEquipment))) ||
      (node.materializedConfigs === null) !==
        (node.materializedConfigsSha256 === null) ||
      (node.materializedConfigs !== null &&
        node.materializedConfigsSha256 !==
          sha256Text(stableJson(node.materializedConfigs))) ||
      (node.materializationStatus === "materialized") !== node.runtimeReady ||
      (node.readyForEvaluator &&
        (!node.runtimeReady ||
          !report.objectiveBoundary.sourceReadyForEvaluation))
    ) {
      return false;
    }
    nodeIds.add(node.nodeId);
  }
  return true;
}

function calculateReportContentSha256(
  report: SourceBackedEquipmentRuntimePreflightReport,
): string {
  const clone = structuredClone(report);
  clone.authentication.reportContentSha256 = "";
  return sha256Text(stableJson(clone));
}

function fixedCapabilities(): SourceBackedEquipmentRuntimePreflightReport["capabilities"] {
  return {
    materializationPreflight: true,
    candidateGeneration: false,
    damageReplay: false,
    damageEvaluation: false,
    scoring: false,
    ranking: false,
    recommendation: false,
    guide: false,
    optimality: false,
    energyRecovery: false,
  };
}

function cloneTeamConfigs(configs: TeamSlotConfig[]): TeamSlotConfig[] {
  return configs.map((config) => ({
    ...config,
    artifactSet: config.artifactSet
      ? cloneArtifactSet(config.artifactSet)
      : null,
    ...(config.talentLevels
      ? { talentLevels: { ...config.talentLevels } }
      : {}),
  }));
}

function cloneArtifactSet(set: ArtifactSetConfig): ArtifactSetConfig {
  return set.type === "4pc"
    ? { type: "4pc", setId: set.setId }
    : { type: "2pc+2pc", halfSetIds: [...set.halfSetIds] };
}

function exactReferenceResolution(
  reference: SourceBackedEquipmentCandidateReference,
  resolution: SourceBackedEquipmentRuntimeOccurrenceResolution,
): boolean {
  return (
    reference.occurrenceId === resolution.occurrenceId &&
    reference.axisId === resolution.axisId &&
    reference.groupId === resolution.groupId &&
    reference.teamMemberId === resolution.teamMemberId &&
    reference.characterId === resolution.characterId &&
    reference.equipmentKind === resolution.equipmentKind
  );
}

function containsForbiddenEnergyInput(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsForbiddenEnergyInput);
  }
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      FORBIDDEN_ENERGY_KEYS.has(normalizeKey(key)) ||
      containsForbiddenEnergyInput(nested),
  );
}

function validReactionOverride(value: ReactionOverride): boolean {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(
      (key) => !["reaction", "rxnParts", "rxnPartHits"].includes(key),
    ) ||
    (value.reaction !== undefined && !REACTION_TYPES.has(value.reaction))
  ) {
    return false;
  }
  if (
    value.rxnParts !== undefined &&
    (!plainRecord(value.rxnParts) ||
      Object.entries(value.rxnParts).some(
        ([partIndex, reaction]) =>
          !canonicalNonNegativeInteger(partIndex) ||
          !REACTION_TYPES.has(reaction),
      ))
  ) {
    return false;
  }
  return !(
    value.rxnPartHits !== undefined &&
    (!plainRecord(value.rxnPartHits) ||
      Object.entries(value.rxnPartHits).some(
        ([partIndex, hits]) =>
          !canonicalNonNegativeInteger(partIndex) ||
          !Number.isInteger(hits) ||
          hits < 0,
      ))
  );
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalNonNegativeInteger(value: string): boolean {
  return /^(0|[1-9][0-9]*)$/.test(value);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function validTalentLevels(levels: TalentLevels): boolean {
  return [levels.auto, levels.skill, levels.burst].every(
    (level) => Number.isInteger(level) && level >= 1 && level <= 15,
  );
}

function sameStringSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addBlocker(
  blockers: SourceBackedEquipmentRuntimePreflightBlocker[],
  code: string,
  path: string,
  message: string,
): void {
  blockers.push({ code, path, message });
}
