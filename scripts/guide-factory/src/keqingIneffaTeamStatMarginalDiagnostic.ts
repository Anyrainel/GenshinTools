import type { SubStat } from "@/data/enums";
import type { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { TeamSlotConfig } from "@/lib/dmgcalc/types";
import {
  runGenerator,
  type GeneratorOptions,
  type GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import { fingerprintGeneratedArtifacts } from "./artifactGenerationSensitivityProbe";
import {
  ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
  runArtifactGenerationTechnicalProbe,
  type ArtifactGenerationRepositoryBuildValidationTarget,
  type ArtifactGenerationTechnicalCandidate,
} from "./artifactGenerationTechnicalProbe";
import {
  replayTeamDamage,
  type DamageReplayInput,
  type DamageReplayOutput,
  type ReplayTeamConfigs,
} from "./computationReplay";
import {
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
  KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS,
  buildKeqingIneffaBoundedJointArtifactExperimentInput,
} from "./keqingIneffaBoundedJointArtifactExperiment";
import { buildKeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import type { FormulaPlanDraftLine } from "./formulaPlanDraft";
import type { KnowledgeRecord, KnowledgeRepository } from "./schemas";
import {
  TEAM_STAT_MARGINAL_NON_ER_STATS,
  fingerprintTeamStatMarginalSheet,
  fingerprintTeamStatMarginalTeamConfigs,
  runTeamStatMarginalDiagnostic,
  type TeamStatMarginalCrossEndpointStatObservation,
  type TeamStatMarginalDiagnosticReport,
  type TeamStatMarginalEndpointInput,
  type TeamStatMarginalNonErStat,
} from "./teamStatMarginalDiagnostic";

export const KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/keqingIneffaTeamStatMarginalDiagnostic.ts",
    "scripts/guide-factory/src/teamStatMarginalDiagnostic.ts",
    ...KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
    "src/lib/artifact/scoring/constants.ts",
  ]),
] as const;

export const KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID =
  "01-seed-aubade-golden";
export const KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID =
  "keqing-ineffa-seed-node-four-carry-stat-marginals-v1";

const EXPECTED_ENDPOINT_COUNT = 4;
const EXPECTED_FORMULA_LINE_COUNT = 11;
const EXPECTED_READINESS_BLOCKER_COUNT = 8;
const EXPECTED_REPLAY_COUNT =
  EXPECTED_ENDPOINT_COUNT *
  (1 +
    EXPECTED_ENDPOINT_COUNT * TEAM_STAT_MARGINAL_NON_ER_STATS.length);
const ZERO_TOLERANCE = { absolute: 1e-9, relative: 1e-12 } as const;

type GeneratorRunner = (
  options: GeneratorOptions,
) => AsyncIterable<GeneratorResult>;

type ReplayRunner = (input: DamageReplayInput) => Promise<DamageReplayOutput>;

export type KeqingIneffaTeamStatMarginalDiagnosticEnvironment = {
  runGenerator: GeneratorRunner;
  replayTeamDamage: ReplayRunner;
};

export type KeqingIneffaTeamStatMarginalCaptureFailure = {
  code:
    | "missing-final-capture"
    | "captured-result-invalid"
    | string;
  stage: string;
  carryCharacterId: string;
  name: string;
  message: string;
};

export type KeqingIneffaTeamStatMarginalCaptureObservation =
  | {
      carryCharacterId: string;
      endpointId: string;
      outcome: "captured";
      artifactFingerprintSha256: string;
      reactionFormulaLineCount: number;
      teamConfigsFingerprintSha256: string;
      sheetFingerprintsByCharacter: Record<string, string>;
    }
  | {
      carryCharacterId: string;
      endpointId: string;
      outcome: "not-comparable";
      failure: KeqingIneffaTeamStatMarginalCaptureFailure;
    };

type GenshinToolsBaselinePriorityBand = 100 | 75 | 50;

type TechnicalRangeObservation = Pick<
  TeamStatMarginalCrossEndpointStatObservation,
  | "rawDeltaRange"
  | "relativeDeltaRange"
  | "relativeDeltaRangeStatus"
  | "normalizedRange"
  | "normalizedRangeStatus"
  | "signClassification"
  | "zeroClassification"
  | "positiveEndpointIds"
  | "zeroEndpointIds"
  | "negativeEndpointIds"
>;

export type KeqingIneffaSourcePriorityOverlap = {
  classification: "genshintools-baseline-priority-overlap-diagnostic";
  supportsGuideClaims: false;
  supportsStatPriorityClaims: false;
  sourceBandNamespace: "genshintools-baseline-build-priority";
  sourceBandsAreNumericallyComparableToMarginalValues: false;
  technicalAggregation: "ranges-only-no-survivor-averaging";
  characters: Array<{
    characterId: string;
    characterGuideId: string;
    buildSourceRecordId: string;
    artifactSetId: string;
    excludedPriorityEntryCount: number;
    stats: Array<{
      stat: TeamStatMarginalNonErStat;
      genshinToolsBaselinePriorityBand: GenshinToolsBaselinePriorityBand | null;
      technicalAcrossFourCarryEndpoints: TechnicalRangeObservation;
    }>;
  }>;
  objectiveCoverageReview: Array<{
    characterId: string;
    stat: TeamStatMarginalNonErStat;
    genshinToolsBaselinePriorityBand: GenshinToolsBaselinePriorityBand;
    technicalZeroClassification: "all-zero";
    classification: "objective-coverage-review";
    reason: string;
  }>;
  operatingPointSensitivityReview: Array<{
    characterId: string;
    stat: TeamStatMarginalNonErStat;
    genshinToolsBaselinePriorityBand: GenshinToolsBaselinePriorityBand;
    technicalSignClassification: TeamStatMarginalCrossEndpointStatObservation["signClassification"];
    technicalZeroClassification: TeamStatMarginalCrossEndpointStatObservation["zeroClassification"];
    positiveEndpointIds: string[];
    zeroEndpointIds: string[];
    negativeEndpointIds: string[];
    classification: "operating-point-sensitivity-review";
    reason: string;
  }>;
  cautions: [
    "The 100, 75, and 50 labels are GenshinTools baseline build priority bands, not external truth and not a numerical scale comparable with marginal normalization.",
    "A GenshinTools-baseline-listed stat with an all-zero technical marginal is an objective-coverage review case, not a guide disagreement.",
  ];
};

export type KeqingIneffaTeamStatMarginalDiagnosticReport = {
  schemaVersion: 1;
  classification: "keqing-ineffa-team-stat-marginal-technical-diagnostic";
  supportsGuideClaims: false;
  supportsStatRecommendations: false;
  supportsScalarStatWeights: false;
  supportsIdealStatAllocation: false;
  supportsOptimalityClaims: false;
  supportsEnergyRequirements: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  comparisonStatus: "comparable" | "not-comparable";
  fixedCandidate: {
    candidateId: typeof KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID;
    requestedArtifactSetIdsByCharacter: Record<string, string>;
    sourceBuildIdsByCharacter: Record<string, string>;
    exactTeamSourceBindsCandidateEquipment: false;
  };
  technicalObjectiveProvenance: {
    classification: "unreviewed-authored-translation-technical-objective";
    formulaDraftFixtureId: "keqing-ineffa-source-rotation-comparison-v1";
    sourceTeamRecordId: string;
    sourceRotationRecordId: string;
    sourceRotationId: string;
    reviewStatus: "unreviewed";
    formulaLineCount: 11;
    exactClaimCount: number;
    completeTokenMappingCount: number;
    partialTokenMappingCount: number;
    reactionLineCount: number | null;
    explicitFormulaBuffOverrides: null;
    readiness: {
      readyForDamageReplay: false;
      blockerCount: 8;
      blockers: Array<{
        code: string;
        message: string;
        characterId?: string;
        formulaId?: string;
        sourceToken?: string;
      }>;
    };
  };
  capture: {
    scheduling: "sequential";
    plannedGeneratorInvocations: 4;
    observedGeneratorInvocations: number;
    maximumGeneratorConcurrency: number;
    freshTeamBuildPerInvocation: true;
    warmStartSupported: false;
    energyRecoveryThresholdsUsed: false;
    perCharacterConstraintsPassed: false;
    capturedSheetsMayContainIncidentalEnergyRecovery: true;
    incidentalEnergyRecoveryRetainedOnlyInOperatingPointFingerprint: true;
    incidentalEnergyRecoveryAnalyzedOrInterpreted: false;
    domainValidation: {
      expectedCarryCharacterIds: [string, string, string, string];
      actualCarryCharacterIds: string[];
      exactUniqueCarrySetObserved: boolean;
      exactRunCountObserved: boolean;
      exactGeneratorInvocationCountObserved: boolean;
      sequentialConcurrencyObserved: boolean;
      observedReactionFormulaLineCounts: Array<{
        carryCharacterId: string;
        count: number;
      }>;
      exactReactionFreeFormulaDomainObserved: boolean;
    };
    runs: KeqingIneffaTeamStatMarginalCaptureObservation[];
  };
  marginalDiagnostic: TeamStatMarginalDiagnosticReport | null;
  sourcePriorityOverlap: KeqingIneffaSourcePriorityOverlap | null;
  cautions: string[];
  prohibitedInterpretations: string[];
};

type CapturedEndpoint = {
  publicObservation: Extract<
    KeqingIneffaTeamStatMarginalCaptureObservation,
    { outcome: "captured" }
  >;
  coreInput: TeamStatMarginalEndpointInput;
};

type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;

const DEFAULT_ENVIRONMENT: KeqingIneffaTeamStatMarginalDiagnosticEnvironment = {
  runGenerator,
  replayTeamDamage,
};

/**
 * Capture four fresh carry-derived generator endpoints for one fixed equipment
 * node, then evaluate local non-ER +1-roll marginals under an explicitly
 * unreviewed technical objective.
 */
export async function runKeqingIneffaTeamStatMarginalDiagnostic(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment: KeqingIneffaTeamStatMarginalDiagnosticEnvironment =
    DEFAULT_ENVIRONMENT,
): Promise<KeqingIneffaTeamStatMarginalDiagnosticReport> {
  const [boundedInput, formulaDraft] = await Promise.all([
    buildKeqingIneffaBoundedJointArtifactExperimentInput(repository, []),
    buildKeqingIneffaFormulaDraftReport(repository, []),
  ]);
  const candidate = requireFixedCandidate(boundedInput.baseProbeInput.candidates);
  requireRepositoryBuildTargets(candidate);
  validateFixtureInvariants(
    boundedInput.unreviewedTechnicalFormulaLines,
    formulaDraft,
  );
  const translatedProbeInput = {
    ...boundedInput.baseProbeInput,
    formulaDraft: {
      ...boundedInput.baseProbeInput.formulaDraft,
      lines: boundedInput.unreviewedTechnicalFormulaLines.map((line) => ({
        ...line,
      })),
    },
  };
  const characterIds = translatedProbeInput.formulaDraft.assumptions.characters.map(
    ({ characterId }) => characterId,
  );
  if (
    characterIds.length !== EXPECTED_ENDPOINT_COUNT ||
    !sameStrings(
      [...characterIds].sort(compareText),
      [...KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS].sort(compareText),
    )
  ) {
    throw new Error(
      "Keqing/Ineffa stat-marginal fixture must contain exactly the four declared carry characters.",
    );
  }

  let observedGeneratorInvocations = 0;
  let activeGenerators = 0;
  let maximumGeneratorConcurrency = 0;
  const observedReactionFormulaLineCounts: Array<{
    carryCharacterId: string;
    count: number;
  }> = [];
  const captures: CapturedEndpoint[] = [];
  const captureRuns: KeqingIneffaTeamStatMarginalCaptureObservation[] = [];

  for (const carryCharacterId of KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS) {
    const endpointId = `carry-${carryCharacterId}`;
    const capture: {
      finalResult: GeneratorResult | null;
      finalResultCount: number;
      reactionFormulaLineCount: number | null;
      teamConfigs: ReplayTeamConfigs | null;
    } = {
      finalResult: null,
      finalResultCount: 0,
      reactionFormulaLineCount: null,
      teamConfigs: null,
    };

    const technical = await runArtifactGenerationTechnicalProbe(
      {
        ...translatedProbeInput,
        carryCharacterId,
        candidates: [cloneCandidate(candidate)],
        generatedFrom: [],
      },
      {
        runGenerator: (options) => {
          observedGeneratorInvocations += 1;
          capture.teamConfigs = requireFourConfigs(options.teamBuild.configs);
          capture.reactionFormulaLineCount = countReactionFormulaLines(
            options,
            translatedProbeInput.formulaDraft.lines,
          );
          observedReactionFormulaLineCounts.push({
            carryCharacterId,
            count: capture.reactionFormulaLineCount,
          });
          return captureGenerator(options);
        },
      },
    );
    const observation = technical.candidates[0];
    if (
      observation.outcome !== "completed-structurally" ||
      !capture.finalResult ||
      capture.finalResultCount !== 1
    ) {
      captureRuns.push({
        carryCharacterId,
        endpointId,
        outcome: "not-comparable",
        failure:
          observation.outcome === "completed-structurally"
            ? {
                code: "missing-final-capture",
                stage: "capture",
                carryCharacterId,
                name: "TeamStatMarginalCaptureError",
                message: `${endpointId} completed with ${capture.finalResultCount} captured final results; exactly one is required.`,
              }
            : {
                ...observation.failure,
                carryCharacterId,
              },
      });
      continue;
    }
    if (!capture.teamConfigs || capture.reactionFormulaLineCount == null) {
      throw new Error(
        `${endpointId} invoked the generator without captured team configs and formula classification.`,
      );
    }

    try {
      const sheetFingerprintsByCharacter = Object.fromEntries(
        characterIds.map((characterId) => [
          characterId,
          fingerprintTeamStatMarginalSheet(
            capture.finalResult?.sheetsByChar[characterId] as StatSheet,
          ),
        ]),
      );
      const artifactFingerprintSha256 = fingerprintGeneratedArtifacts(
        capture.finalResult.artifactsByChar,
      );
      const teamConfigsFingerprintSha256 =
        fingerprintTeamStatMarginalTeamConfigs(capture.teamConfigs);
      const publicObservation = {
        carryCharacterId,
        endpointId,
        outcome: "captured" as const,
        artifactFingerprintSha256,
        reactionFormulaLineCount: capture.reactionFormulaLineCount,
        teamConfigsFingerprintSha256,
        sheetFingerprintsByCharacter: sortTextRecord(
          sheetFingerprintsByCharacter,
        ),
      };
      captureRuns.push(publicObservation);
      captures.push({
        publicObservation,
        coreInput: {
          endpointId,
          originId: `generator-carry:${carryCharacterId}`,
          captureFingerprintSha256: artifactFingerprintSha256,
          teamConfigsFingerprintSha256,
          sheetFingerprintsByCharacter,
          teamConfigs: capture.teamConfigs,
          artifactSheets: { ...capture.finalResult.sheetsByChar },
        },
      });
    } catch (error) {
      const serialized = serializeError(error);
      captureRuns.push({
        carryCharacterId,
        endpointId,
        outcome: "not-comparable",
        failure: {
          code: "captured-result-invalid",
          stage: "capture",
          carryCharacterId,
          name: serialized.name,
          message: serialized.message,
        },
      });
    }

    async function* captureGenerator(
      options: GeneratorOptions,
    ): AsyncGenerator<GeneratorResult, void> {
      activeGenerators += 1;
      maximumGeneratorConcurrency = Math.max(
        maximumGeneratorConcurrency,
        activeGenerators,
      );
      try {
        for await (const result of environment.runGenerator(options)) {
          if (result.done) {
            capture.finalResult = result;
            capture.finalResultCount += 1;
          }
          yield result;
        }
      } finally {
        activeGenerators -= 1;
      }
    }
  }

  const actualCarryCharacterIds = captureRuns.map(
    ({ carryCharacterId }) => carryCharacterId,
  );
  const exactUniqueCarrySetObserved =
    new Set(actualCarryCharacterIds).size === EXPECTED_ENDPOINT_COUNT &&
    sameStrings(
      [...actualCarryCharacterIds].sort(compareText),
      [...KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS].sort(compareText),
    );
  const exactRunCountObserved =
    captureRuns.length === EXPECTED_ENDPOINT_COUNT &&
    captures.length === EXPECTED_ENDPOINT_COUNT;
  const exactGeneratorInvocationCountObserved =
    observedGeneratorInvocations === EXPECTED_ENDPOINT_COUNT;
  const sequentialConcurrencyObserved =
    maximumGeneratorConcurrency === 1 && activeGenerators === 0;
  const exactReactionFreeFormulaDomainObserved =
    observedReactionFormulaLineCounts.length === EXPECTED_ENDPOINT_COUNT &&
    observedReactionFormulaLineCounts.every(({ count }) => count === 0) &&
    captures.every(
      ({ publicObservation }) =>
        publicObservation.reactionFormulaLineCount === 0,
    );
  const distinctReactionFormulaLineCounts = new Set(
    observedReactionFormulaLineCounts.map(({ count }) => count),
  );
  const reactionLineCount =
    distinctReactionFormulaLineCounts.size === 1
      ? (observedReactionFormulaLineCounts[0]?.count ?? null)
      : null;
  const captureDomainComparable =
    exactUniqueCarrySetObserved &&
    exactRunCountObserved &&
    exactGeneratorInvocationCountObserved &&
    sequentialConcurrencyObserved &&
    exactReactionFreeFormulaDomainObserved;

  let marginalDiagnostic: TeamStatMarginalDiagnosticReport | null = null;
  if (captureDomainComparable) {
    marginalDiagnostic = await runTeamStatMarginalDiagnostic(
      {
        diagnosticId: KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_ID,
        generatedFrom,
        evidence: {
          classification: "structural_smoke",
          supportsGuideClaims: false,
          notes: [
            "Four carry-derived sheets from one fixed repository-build composition are local operating points only.",
            "The 11 exact-valued formula lines are an unreviewed authored translation and do not establish action order, timing, reaction ownership, or buff coverage.",
          ],
          sourceRefs: [
            {
              kind: "knowledge_record",
              recordId: formulaDraft.sourceTeamRecordId,
              supports: ["roster", "damage_plan"],
            },
            ...requireRepositoryBuildTargets(candidate).map((target) => ({
              kind: "knowledge_record" as const,
              recordId: target.characterGuideId,
              supports: ["artifact_stats" as const],
            })),
          ],
        },
        objective: {
          combatOptions: {},
          enemyAura: null,
          extraBuffs: [],
          calcContext: { ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT },
          combo: {
            id: "guide-factory-unreviewed-technical-formula-lines",
            label: {
              en: "Unreviewed formula lines (technical diagnostic only)",
              zh: "未审核公式行（仅技术诊断）",
            },
            lines: boundedInput.unreviewedTechnicalFormulaLines.map(
              ({ characterId, formulaId, count }) => ({
                charId: characterId,
                formulaId,
                count,
                reaction: null,
                forceOnField: false,
              }),
            ),
          },
          formulaBuffOverrides: null,
        },
        zeroTolerance: { ...ZERO_TOLERANCE },
        endpoints: captures.map(({ coreInput }) => coreInput),
      },
      { replayTeamDamage: environment.replayTeamDamage },
    );
    if (
      marginalDiagnostic.execution.plannedReplayCount !==
        EXPECTED_REPLAY_COUNT ||
      marginalDiagnostic.execution.endpointCount !== EXPECTED_ENDPOINT_COUNT ||
      marginalDiagnostic.execution.characterCountPerEndpoint !==
        EXPECTED_ENDPOINT_COUNT ||
      marginalDiagnostic.execution.statCountPerCharacter !==
        TEAM_STAT_MARGINAL_NON_ER_STATS.length
    ) {
      throw new Error(
        "Keqing/Ineffa stat-marginal core returned an unexpected endpoint, character, stat, or replay domain.",
      );
    }
  }

  const sourcePriorityOverlap =
    marginalDiagnostic?.comparisonStatus === "comparable"
      ? buildSourcePriorityOverlap(repository, candidate, marginalDiagnostic)
      : null;
  const comparisonStatus =
    captureDomainComparable &&
    marginalDiagnostic?.comparisonStatus === "comparable" &&
    sourcePriorityOverlap != null
      ? "comparable"
      : "not-comparable";

  const mapping = formulaDraft.damageReplayReadiness.sourceMappingSummary;
  return {
    schemaVersion: 1,
    classification: "keqing-ineffa-team-stat-marginal-technical-diagnostic",
    supportsGuideClaims: false,
    supportsStatRecommendations: false,
    supportsScalarStatWeights: false,
    supportsIdealStatAllocation: false,
    supportsOptimalityClaims: false,
    supportsEnergyRequirements: false,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    comparisonStatus,
    fixedCandidate: {
      candidateId: KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
      requestedArtifactSetIdsByCharacter: sortTextRecord(
        candidate.artifactSetIdsByCharacter,
      ),
      sourceBuildIdsByCharacter: sortTextRecord(
        Object.fromEntries(
          requireRepositoryBuildTargets(candidate).map((target) => [
            target.characterId,
            target.buildSourceRecordId,
          ]),
        ),
      ),
      exactTeamSourceBindsCandidateEquipment: false,
    },
    technicalObjectiveProvenance: {
      classification: "unreviewed-authored-translation-technical-objective",
      formulaDraftFixtureId: formulaDraft.fixtureId,
      sourceTeamRecordId: formulaDraft.sourceTeamRecordId,
      sourceRotationRecordId: formulaDraft.sourceRotation.recordId,
      sourceRotationId: formulaDraft.sourceRotation.rotationId,
      reviewStatus: formulaDraft.authoredTranslation.reviewStatus,
      formulaLineCount: EXPECTED_FORMULA_LINE_COUNT,
      exactClaimCount: mapping.exactClaims,
      completeTokenMappingCount: mapping.completeTokenMappings,
      partialTokenMappingCount: mapping.partialTokenMappings,
      reactionLineCount,
      explicitFormulaBuffOverrides: null,
      readiness: {
        readyForDamageReplay: false,
        blockerCount: EXPECTED_READINESS_BLOCKER_COUNT,
        blockers: formulaDraft.damageReplayReadiness.blockers.map((blocker) => ({
          ...blocker,
        })),
      },
    },
    capture: {
      scheduling: "sequential",
      plannedGeneratorInvocations: EXPECTED_ENDPOINT_COUNT,
      observedGeneratorInvocations,
      maximumGeneratorConcurrency,
      freshTeamBuildPerInvocation: true,
      warmStartSupported: false,
      energyRecoveryThresholdsUsed: false,
      perCharacterConstraintsPassed: false,
      capturedSheetsMayContainIncidentalEnergyRecovery: true,
      incidentalEnergyRecoveryRetainedOnlyInOperatingPointFingerprint: true,
      incidentalEnergyRecoveryAnalyzedOrInterpreted: false,
      domainValidation: {
        expectedCarryCharacterIds: [
          ...KEQING_INEFFA_BOUNDED_JOINT_CARRY_CHARACTER_IDS,
        ],
        actualCarryCharacterIds,
        exactUniqueCarrySetObserved,
        exactRunCountObserved,
        exactGeneratorInvocationCountObserved,
        sequentialConcurrencyObserved,
        observedReactionFormulaLineCounts:
          observedReactionFormulaLineCounts.map((observation) => ({
            ...observation,
          })),
        exactReactionFreeFormulaDomainObserved,
      },
      runs: captureRuns,
    },
    marginalDiagnostic,
    sourcePriorityOverlap,
    cautions: [
      "This wrapper reuses one composition assembled from independent GenshinTools baseline character builds; the exact KQM team record does not bind that equipment to the team.",
      "Each +1-roll result is a local derivative at a generated endpoint, not a legal roll exchange, allocation, stat weight, or recommendation.",
      "Ranges across four carry-derived endpoints preserve operating-point sensitivity without averaging those endpoints into one authoritative value.",
      "GenshinTools baseline priority bands are retained only as categorical overlap metadata and are not numerically comparable with marginal normalization.",
      "All-zero EM observations under a technical combo with no reaction lines or overrides are objective-coverage review evidence, not guide disagreements.",
      "Captured operating-point sheets can contain incidental or filler ER. It is retained only inside the complete sheet fingerprint and baseline operating point; this checkpoint neither perturbs nor interprets it.",
    ],
    prohibitedInterpretations: [
      "stat-priority",
      "scalar-stat-weight",
      "ideal-stat-allocation",
      "artifact-recommendation",
      "guide-recommendation",
      "damage-ranking",
      "winner",
      "global-optimum",
      "energy-requirement",
    ],
  };
}

function buildSourcePriorityOverlap(
  repository: KnowledgeRepository,
  candidate: ArtifactGenerationTechnicalCandidate,
  diagnostic: Extract<
    TeamStatMarginalDiagnosticReport,
    { comparisonStatus: "comparable" }
  >,
): KeqingIneffaSourcePriorityOverlap {
  const characters = requireRepositoryBuildTargets(candidate).map((target) => {
    const guide = repository.records.find(
      (record): record is CharacterGuide =>
        record.kind === "character_guide" &&
        record.id === target.characterGuideId,
    );
    if (!guide) {
      throw new Error(
        `Stat-marginal priority overlap requires ${target.characterGuideId}.`,
      );
    }
    const matchingBuilds = guide.builds.filter(
      (build) =>
        build.sourceRecordId === target.buildSourceRecordId &&
        build.artifact.type === "4pc" &&
        build.artifact.setId === target.artifactSetId,
    );
    if (matchingBuilds.length !== 1) {
      throw new Error(
        `Stat-marginal priority overlap expected one ${target.characterId}/${target.buildSourceRecordId} build, found ${matchingBuilds.length}.`,
      );
    }
    const build = matchingBuilds[0];
    const priorityByStat = new Map<
      TeamStatMarginalNonErStat,
      GenshinToolsBaselinePriorityBand
    >();
    let excludedPriorityEntryCount = 0;
    for (const priority of build.substats) {
      if (!isNonErDiagnosticStat(priority.stat)) {
        excludedPriorityEntryCount += 1;
        continue;
      }
      if (!isBaselinePriorityBand(priority.weight)) {
        throw new Error(
          `Unexpected GenshinTools baseline priority band ${priority.weight} for ${target.characterId}/${priority.stat}.`,
        );
      }
      if (priorityByStat.has(priority.stat)) {
        throw new Error(
          `Duplicate GenshinTools baseline priority stat ${target.characterId}/${priority.stat}.`,
        );
      }
      priorityByStat.set(priority.stat, priority.weight);
    }
    const crossCharacter = diagnostic.crossEndpointSummary.characters.find(
      ({ characterId }) => characterId === target.characterId,
    );
    if (!crossCharacter) {
      throw new Error(
        `Comparable stat-marginal output omitted ${target.characterId}.`,
      );
    }
    const stats = TEAM_STAT_MARGINAL_NON_ER_STATS.map((stat) => {
      const technical = crossCharacter.stats.find(
        ({ stat: observedStat }) => observedStat === stat,
      );
      if (!technical) {
        throw new Error(
          `Comparable stat-marginal output omitted ${target.characterId}/${stat}.`,
        );
      }
      return {
        stat,
        genshinToolsBaselinePriorityBand: priorityByStat.get(stat) ?? null,
        technicalAcrossFourCarryEndpoints:
          cloneTechnicalRangeObservation(technical),
      };
    });
    return {
      characterId: target.characterId,
      characterGuideId: target.characterGuideId,
      buildSourceRecordId: target.buildSourceRecordId,
      artifactSetId: target.artifactSetId,
      excludedPriorityEntryCount,
      stats,
    };
  });

  const objectiveCoverageReview = characters.flatMap((character) =>
    character.stats.flatMap((observation) => {
      const band = observation.genshinToolsBaselinePriorityBand;
      if (
        band == null ||
        observation.technicalAcrossFourCarryEndpoints.zeroClassification !==
          "all-zero"
      ) {
        return [];
      }
      return [
        {
          characterId: character.characterId,
          stat: observation.stat,
          genshinToolsBaselinePriorityBand: band,
          technicalZeroClassification: "all-zero" as const,
          classification: "objective-coverage-review" as const,
          reason:
            observation.stat === "em"
              ? "The technical combo has no reaction lines or reaction overrides, so an all-zero EM marginal cannot test reaction-value contribution."
              : "The GenshinTools-baseline-listed stat is locally all-zero under this incomplete technical objective and requires objective-coverage review before any gameplay interpretation.",
        },
      ];
    }),
  );
  const operatingPointSensitivityReview = characters.flatMap((character) =>
    character.stats.flatMap((observation) => {
      const band = observation.genshinToolsBaselinePriorityBand;
      const technical = observation.technicalAcrossFourCarryEndpoints;
      if (
        band == null ||
        (technical.zeroClassification !== "some-zero" &&
          technical.signClassification !== "mixed")
      ) {
        return [];
      }
      return [
        {
          characterId: character.characterId,
          stat: observation.stat,
          genshinToolsBaselinePriorityBand: band,
          technicalSignClassification: technical.signClassification,
          technicalZeroClassification: technical.zeroClassification,
          positiveEndpointIds: [...technical.positiveEndpointIds],
          zeroEndpointIds: [...technical.zeroEndpointIds],
          negativeEndpointIds: [...technical.negativeEndpointIds],
          classification: "operating-point-sensitivity-review" as const,
          reason:
            "Tolerance-aware sign or zero classification changes across the four captured endpoints, so the local marginal is operating-point-sensitive and cannot support a single priority conclusion.",
        },
      ];
    }),
  );

  return {
    classification: "genshintools-baseline-priority-overlap-diagnostic",
    supportsGuideClaims: false,
    supportsStatPriorityClaims: false,
    sourceBandNamespace: "genshintools-baseline-build-priority",
    sourceBandsAreNumericallyComparableToMarginalValues: false,
    technicalAggregation: "ranges-only-no-survivor-averaging",
    characters,
    objectiveCoverageReview,
    operatingPointSensitivityReview,
    cautions: [
      "The 100, 75, and 50 labels are GenshinTools baseline build priority bands, not external truth and not a numerical scale comparable with marginal normalization.",
      "A GenshinTools-baseline-listed stat with an all-zero technical marginal is an objective-coverage review case, not a guide disagreement.",
    ],
  };
}

function cloneTechnicalRangeObservation(
  observation: TeamStatMarginalCrossEndpointStatObservation,
): TechnicalRangeObservation {
  return {
    rawDeltaRange: { ...observation.rawDeltaRange },
    relativeDeltaRange: observation.relativeDeltaRange
      ? { ...observation.relativeDeltaRange }
      : null,
    relativeDeltaRangeStatus: observation.relativeDeltaRangeStatus,
    normalizedRange: observation.normalizedRange
      ? { ...observation.normalizedRange }
      : null,
    normalizedRangeStatus: observation.normalizedRangeStatus,
    signClassification: observation.signClassification,
    zeroClassification: observation.zeroClassification,
    positiveEndpointIds: [...observation.positiveEndpointIds],
    zeroEndpointIds: [...observation.zeroEndpointIds],
    negativeEndpointIds: [...observation.negativeEndpointIds],
  };
}

function requireFixedCandidate(
  candidates: ArtifactGenerationTechnicalCandidate[],
): ArtifactGenerationTechnicalCandidate {
  const matches = candidates.filter(
    ({ candidateId }) =>
      candidateId === KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID,
  );
  if (
    matches.length !== 1 ||
    matches[0].classification !== "repository-build-seed"
  ) {
    throw new Error(
      `Stat-marginal fixture expected one repository-build seed ${KEQING_INEFFA_TEAM_STAT_MARGINAL_CANDIDATE_ID}.`,
    );
  }
  return matches[0];
}

function validateFixtureInvariants(
  formulaLines: FormulaPlanDraftLine[],
  formulaDraft: Awaited<ReturnType<typeof buildKeqingIneffaFormulaDraftReport>>,
): void {
  if (
    formulaLines.length !== EXPECTED_FORMULA_LINE_COUNT ||
    formulaDraft.authoredTranslation.reviewStatus !== "unreviewed" ||
    formulaDraft.damageReplayReadiness.readyForDamageReplay ||
    formulaDraft.damageReplayReadiness.blockers.length !==
      EXPECTED_READINESS_BLOCKER_COUNT
  ) {
    throw new Error(
      "Keqing/Ineffa stat-marginal fixture must retain 11 unreviewed exact lines and all 8 replay-readiness blockers.",
    );
  }
  if (
    formulaDraft.authoredTranslation.formulaComparisons.length !==
      EXPECTED_FORMULA_LINE_COUNT ||
    formulaDraft.authoredTranslation.formulaComparisons.some(
      ({ sourceCountClaim }) => sourceCountClaim.type !== "exact",
    )
  ) {
    throw new Error(
      "Keqing/Ineffa stat-marginal fixture requires exactly 11 exact-valued authored translation comparisons.",
    );
  }
  if (
    TEAM_STAT_MARGINAL_NON_ER_STATS.length !== 9 ||
    (TEAM_STAT_MARGINAL_NON_ER_STATS as readonly SubStat[]).includes("er")
  ) {
    throw new Error(
      "Keqing/Ineffa stat-marginal fixture requires the exact nine-stat non-ER domain.",
    );
  }
}

function countReactionFormulaLines(
  options: GeneratorOptions,
  formulaLines: FormulaPlanDraftLine[],
): number {
  return formulaLines.filter(({ characterId, formulaId }) => {
    const entry = options.teamBuild.catalog.formulaIndex.get(formulaId);
    if (!entry || entry.owner !== characterId) {
      throw new Error(
        `Stat-marginal formula classification could not resolve ${characterId}.${formulaId} to its owning calculator entry.`,
      );
    }
    return entry.parts.some(
      ({ formula }) => formula.tag.reaction !== "none",
    );
  }).length;
}

function requireFourConfigs(
  configs: readonly TeamSlotConfig[],
): ReplayTeamConfigs {
  if (configs.length !== EXPECTED_ENDPOINT_COUNT) {
    throw new Error(
      `Stat-marginal capture expected four team configs, found ${configs.length}.`,
    );
  }
  return configs.map(cloneTeamConfig) as unknown as ReplayTeamConfigs;
}

function cloneTeamConfig(config: TeamSlotConfig): TeamSlotConfig {
  return {
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
    talentLevels: config.talentLevels ? { ...config.talentLevels } : undefined,
  };
}

function cloneCandidate(
  candidate: ArtifactGenerationTechnicalCandidate,
): ArtifactGenerationTechnicalCandidate {
  return {
    ...candidate,
    artifactSetIdsByCharacter: { ...candidate.artifactSetIdsByCharacter },
    validationTargets: candidate.validationTargets.map((target) => ({
      ...target,
      sands: [...target.sands],
      goblet: [...target.goblet],
      circlet: [...target.circlet],
      substats: [...target.substats],
    })),
  };
}

function requireRepositoryBuildTargets(
  candidate: ArtifactGenerationTechnicalCandidate,
): ArtifactGenerationRepositoryBuildValidationTarget[] {
  return candidate.validationTargets.map((target) => {
    if (target.kind !== "repository-build") {
      throw new Error(
        `Keqing/Ineffa baseline diagnostic requires repository-build validation targets; ${target.characterId} is ${target.kind}.`,
      );
    }
    return target;
  });
}

function isNonErDiagnosticStat(
  stat: string,
): stat is TeamStatMarginalNonErStat {
  return (TEAM_STAT_MARGINAL_NON_ER_STATS as readonly string[]).includes(stat);
}

function isBaselinePriorityBand(
  value: number,
): value is GenshinToolsBaselinePriorityBand {
  return value === 100 || value === 75 || value === 50;
}

function sortTextRecord(
  record: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function serializeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: String(error) };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
