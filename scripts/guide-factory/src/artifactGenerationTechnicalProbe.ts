import { statPools } from "@/data/constants";
import { allSlots, type MainStat, type Slot, type SubStat } from "@/data/enums";
import { artifactsById } from "@/data/gameResources";
import type { ArtifactData } from "@/data/types";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import type {
  CalcContext,
  ComboFormula,
  TeamSlotConfig,
} from "@/lib/dmgcalc/types";
import {
  runGenerator,
  type GeneratorOptions,
  type GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import type { ArtifactGenerationPreflightReport } from "./artifactGenerationPreflight";
import { bootstrapGuideFactoryComputation } from "./computationReplay";
import type { FormulaPlanDraftOutput } from "./formulaPlanDraft";
import { stableJson } from "./io";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
} from "./schemas";

const MAX_CANDIDATES = 8;
const ALLOWED_CANDIDATE_CLASSIFICATIONS = new Set<string>([
  "repository-build-seed",
  "repository-build-composition",
  "repository-build-negative-control",
  "composed-source-claims",
]);

class CandidateResultValidationError extends Error {
  override readonly name = "CandidateResultValidationError";
}

export const ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};

type ArtifactGenerationValidationTargetStats = {
  characterId: string;
  artifactSetId: string;
  sands: MainStat[];
  goblet: MainStat[];
  circlet: MainStat[];
  substats: SubStat[];
};

export type ArtifactGenerationRepositoryBuildValidationTarget =
  ArtifactGenerationValidationTargetStats & {
    kind: "repository-build";
    characterGuideId: string;
    buildSourceRecordId: string;
  };

export type ArtifactGenerationComposedSourceClaimsValidationTarget =
  ArtifactGenerationValidationTargetStats & {
    kind: "composed-source-claims";
    compositionId: string;
    repositoryRecordIds: string[];
    equipmentClaimIds: string[];
    matchedStatClaimIds: {
      sands: string[];
      goblet: string[];
      circlet: string[];
      substats: string[];
    };
    withheldStatClaimIds: string[];
    sourcePriorityGroups: SubStat[][];
    sourceAuthored: false;
  };

export type ArtifactGenerationValidationTarget =
  | ArtifactGenerationRepositoryBuildValidationTarget
  | ArtifactGenerationComposedSourceClaimsValidationTarget;

/**
 * Runtime provenance available to the generic probe.
 *
 * Repository targets are checked against the caller-supplied, schema-valid
 * consolidated repository snapshot. Its source revision is authenticated by
 * the source wrapper and durable validator, not by this generic probe.
 * Composed-target authorization is intentionally absent from this serializable
 * input. A source-specific caller must supply a trusted validator capability in
 * the execution environment; the generic probe defaults to rejecting composed
 * targets because it does not know any source-specific evidence schema.
 */
export type ArtifactGenerationValidationProvenance = {
  repository: KnowledgeRepository;
};

export type ArtifactGenerationTechnicalCandidate = {
  candidateId: string;
  classification:
    | "repository-build-seed"
    | "repository-build-composition"
    | "repository-build-negative-control"
    | "composed-source-claims";
  artifactSetIdsByCharacter: Record<string, string>;
  validationTargets: ArtifactGenerationValidationTarget[];
};

export type ArtifactGenerationTechnicalProbeInput = {
  preflight: ArtifactGenerationPreflightReport;
  formulaDraft: FormulaPlanDraftOutput;
  validationProvenance: ArtifactGenerationValidationProvenance;
  carryCharacterId: string;
  candidates: ArtifactGenerationTechnicalCandidate[];
  generatedFrom: Array<{ path: string; sha256: string }>;
};

export type ArtifactGenerationCandidateFailure = {
  code:
    | "candidate-character-mismatch"
    | "candidate-build-target-mismatch"
    | "candidate-classification-invalid"
    | "candidate-validation-target-provenance-mismatch"
    | "unknown-artifact-set"
    | "non-five-star-set"
    | "candidate-formula-invalid"
    | "team-build-failed"
    | "generator-failed"
    | "generator-produced-no-final-result"
    | "generator-result-invalid";
  stage:
    | "candidate-validation"
    | "team-build"
    | "formula-validation"
    | "generator"
    | "result-validation";
  name: string;
  message: string;
};

type GeneratorRunner = (
  options: GeneratorOptions,
) => AsyncIterable<GeneratorResult>;

export type ArtifactGenerationTechnicalProbeEnvironment = {
  runGenerator: GeneratorRunner;
  validateComposedSourceClaimsTarget?: (
    target: ArtifactGenerationComposedSourceClaimsValidationTarget,
  ) =>
    | { valid: true }
    | {
        valid: false;
        message: string;
      };
};

type GeneratorProgressObservation = {
  phase: string;
  progress: number;
  done: boolean;
};

type MainStatReviewObservation = {
  generated: MainStat;
  validationTargetObserved: MainStat[];
  relation: "listed-by-validation-target" | "not-listed-by-validation-target";
};

type CharacterValidationObservation = {
  characterId: string;
  validationTargetProvenance: ArtifactGenerationValidationTargetProvenance;
  artifactSetId: string;
  mainStats: {
    sands: MainStatReviewObservation;
    goblet: MainStatReviewObservation;
    circlet: MainStatReviewObservation;
  };
  substats: {
    generatedPositiveKeys: SubStat[];
    validationTargetObservedKeys: SubStat[];
    generatedKeysListedByValidationTarget: SubStat[];
    generatedKeysNotListedByValidationTarget: SubStat[];
    validationTargetKeysNotGenerated: SubStat[];
  };
};

export type ArtifactGenerationValidationTargetProvenance =
  | {
      kind: "repository-build";
      characterGuideId: string;
      buildSourceRecordId: string;
    }
  | {
      kind: "composed-source-claims";
      compositionId: string;
      repositoryRecordIds: string[];
      equipmentClaimIds: string[];
      matchedStatClaimIds: ArtifactGenerationComposedSourceClaimsValidationTarget["matchedStatClaimIds"];
      withheldStatClaimIds: string[];
      sourcePriorityGroups: SubStat[][];
      sourceAuthored: false;
    };

type ArtifactShapeObservation = {
  characterId: string;
  slots: Array<{
    slot: Slot;
    setId: string;
    rarity: number;
    level: number;
    hasMainStat: boolean;
    positiveSubstatKeyCount: number;
  }>;
};

type RequestedValidationTargetObservation =
  | {
      kind: "repository-build";
      characterGuideId: string | null;
      buildSourceRecordId: string | null;
    }
  | {
      kind: "composed-source-claims";
      compositionId: string | null;
    }
  | {
      kind: "unrecognized";
      requestedKind: string | null;
    };

type CandidateBase = {
  sequence: number;
  candidateId: string;
  requestedClassification: string;
  requestedArtifactSetIdsByCharacter: Record<string, string>;
  changedFromSeedCharacters: string[];
  requestedValidationTargetsByCharacter: Record<
    string,
    RequestedValidationTargetObservation
  >;
  independentValidation: {
    validationTargetsMatchAssignmentAndProvenance: boolean;
    allSetsAreFiveStar: boolean | "not-evaluated";
    runtimeRegistration: "passed" | "failed" | "not-attempted";
  };
  generatorInvoked: boolean;
  progress: GeneratorProgressObservation[];
};

export type ArtifactGenerationTechnicalCandidateObservation =
  | (CandidateBase & {
      outcome: "completed-structurally";
      classification: ArtifactGenerationTechnicalCandidate["classification"];
      independentValidation: CandidateBase["independentValidation"] & {
        validationTargetsMatchAssignmentAndProvenance: true;
        allSetsAreFiveStar: true;
        runtimeRegistration: "passed";
      };
      generatorInvoked: true;
      requestedAssignmentsSatisfied: true;
      artifactShape: ArtifactShapeObservation[];
      validationTargetComparisons: CharacterValidationObservation[];
    })
  | (CandidateBase & {
      outcome: "rejected-before-run" | "failed-during-run";
      requestedAssignmentsSatisfied: false;
      failure: ArtifactGenerationCandidateFailure;
    });

export type ArtifactGenerationTechnicalProbeReport = {
  schemaVersion: 2;
  classification: "artifact-generation-technical-probe";
  supportsGuideClaims: false;
  supportsArtifactRecommendations: false;
  supportsComparativeClaims: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceTeamRecordId: string;
  seedPreflight: {
    equipmentReadyForTechnicalProbe: true;
    seedPreflightBound: true;
    seedArtifactSetIdsByCharacter: Record<string, string>;
    authorizesChangedCandidateFormulaBinding: false;
    readyForReviewedGeneratorExperiment: boolean;
    formulaPlanReviewStatus: ArtifactGenerationPreflightReport["formulaReadiness"]["reviewStatus"];
  };
  execution: {
    generatorApi: "runGenerator";
    comparisonWrapperUsed: false;
    scheduling: "sequential";
    carryCharacterId: string;
    candidateLimit: number;
    candidateOrder: string[];
    calcContext: CalcContext;
    energyRecoveryThresholdsUsed: false;
    numericalDamageRetained: false;
    composedSourceClaimsValidationPolicy: "default-deny-trusted-environment-capability-only";
    trustedComposedSourceClaimsValidatorAvailable: boolean;
  };
  candidates: ArtifactGenerationTechnicalCandidateObservation[];
  cautions: [
    "Repository-build validation is relative to the caller-supplied schema-valid consolidated snapshot, whose revision is authenticated by the source wrapper and durable validator rather than this generic probe; composed targets require a trusted source-specific environment validator, and neither boundary binds the full candidate to this exact team, the other targets, or a reviewed formula.",
    "Generated main stats and positive substat keys are review observations against provenance-validated targets, not correctness, ranking, or recommendation claims.",
    "An observed ER main stat or substat key does not establish an ER floor, rotation feasibility, or ER adequacy.",
    "The generator is ordered and greedy; completing this probe does not establish joint optimality.",
  ];
  prohibitedInterpretations: [
    "damage-comparison",
    "candidate-ranking",
    "winner",
    "artifact-recommendation",
    "stat-recommendation",
    "energy-requirement",
  ];
};

const DEFAULT_ENVIRONMENT: ArtifactGenerationTechnicalProbeEnvironment = {
  runGenerator,
};

/**
 * Exercise the artifact generator through a small, explicitly ordered list.
 *
 * The generator necessarily uses its damage objective internally, but this
 * boundary intentionally retains no damage values and derives no ordering.
 * Candidate validation and failures remain one observation each so a bad
 * assignment cannot erase the rest of the experiment.
 */
export async function runArtifactGenerationTechnicalProbe(
  input: ArtifactGenerationTechnicalProbeInput,
  environment: ArtifactGenerationTechnicalProbeEnvironment = DEFAULT_ENVIRONMENT,
): Promise<ArtifactGenerationTechnicalProbeReport> {
  validateProbeInput(input);
  await bootstrapGuideFactoryComputation();

  const seedArtifactSetIdsByCharacter = Object.fromEntries(
    input.formulaDraft.assumptions.characters.map((character) => [
      character.characterId,
      requireFourPieceSetId(character.characterId, character.selectedArtifact),
    ]),
  );
  const observations: ArtifactGenerationTechnicalCandidateObservation[] = [];

  for (const [index, candidate] of input.candidates.entries()) {
    observations.push(
      await runCandidate(
        index,
        candidate,
        input,
        seedArtifactSetIdsByCharacter,
        environment,
      ),
    );
  }

  return {
    schemaVersion: 2,
    classification: "artifact-generation-technical-probe",
    supportsGuideClaims: false,
    supportsArtifactRecommendations: false,
    supportsComparativeClaims: false,
    generatedFrom: input.generatedFrom
      .map((source) => ({ ...source }))
      .sort((left, right) => compareText(left.path, right.path)),
    sourceTeamRecordId: input.preflight.sourceTeamRecordId,
    seedPreflight: {
      equipmentReadyForTechnicalProbe: true,
      seedPreflightBound: true,
      seedArtifactSetIdsByCharacter: sortTextRecord(
        seedArtifactSetIdsByCharacter,
      ),
      authorizesChangedCandidateFormulaBinding: false,
      readyForReviewedGeneratorExperiment:
        input.preflight.readyForReviewedGeneratorExperiment,
      formulaPlanReviewStatus: input.preflight.formulaReadiness.reviewStatus,
    },
    execution: {
      generatorApi: "runGenerator",
      comparisonWrapperUsed: false,
      scheduling: "sequential",
      carryCharacterId: input.carryCharacterId,
      candidateLimit: MAX_CANDIDATES,
      candidateOrder: input.candidates.map(({ candidateId }) => candidateId),
      calcContext: { ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT },
      energyRecoveryThresholdsUsed: false,
      numericalDamageRetained: false,
      composedSourceClaimsValidationPolicy:
        "default-deny-trusted-environment-capability-only",
      trustedComposedSourceClaimsValidatorAvailable:
        environment.validateComposedSourceClaimsTarget != null,
    },
    candidates: observations,
    cautions: [
      "Repository-build validation is relative to the caller-supplied schema-valid consolidated snapshot, whose revision is authenticated by the source wrapper and durable validator rather than this generic probe; composed targets require a trusted source-specific environment validator, and neither boundary binds the full candidate to this exact team, the other targets, or a reviewed formula.",
      "Generated main stats and positive substat keys are review observations against provenance-validated targets, not correctness, ranking, or recommendation claims.",
      "An observed ER main stat or substat key does not establish an ER floor, rotation feasibility, or ER adequacy.",
      "The generator is ordered and greedy; completing this probe does not establish joint optimality.",
    ],
    prohibitedInterpretations: [
      "damage-comparison",
      "candidate-ranking",
      "winner",
      "artifact-recommendation",
      "stat-recommendation",
      "energy-requirement",
    ],
  };
}

async function runCandidate(
  index: number,
  candidate: ArtifactGenerationTechnicalCandidate,
  input: ArtifactGenerationTechnicalProbeInput,
  seedArtifactSetIdsByCharacter: Record<string, string>,
  environment: ArtifactGenerationTechnicalProbeEnvironment,
): Promise<ArtifactGenerationTechnicalCandidateObservation> {
  const progress: GeneratorProgressObservation[] = [];
  const changedFromSeedCharacters = Object.keys(
    seedArtifactSetIdsByCharacter,
  )
    .filter(
      (characterId) =>
        candidate.artifactSetIdsByCharacter[characterId] !==
        seedArtifactSetIdsByCharacter[characterId],
    )
    .sort();
  const requestedValidationTargetsByCharacter = sortTextRecord(
    Object.fromEntries(
      candidate.validationTargets.map((target, targetIndex) =>
        describeRequestedValidationTarget(target, targetIndex),
      ),
    ),
  );
  const base: Omit<CandidateBase, "independentValidation"> = {
    sequence: index,
    candidateId: candidate.candidateId,
    requestedClassification: String(candidate.classification),
    requestedArtifactSetIdsByCharacter: sortTextRecord(
      candidate.artifactSetIdsByCharacter,
    ),
    changedFromSeedCharacters,
    requestedValidationTargetsByCharacter,
    generatorInvoked: false,
    progress,
  };

  const candidateValidation = validateCandidate(
    candidate,
    Object.keys(seedArtifactSetIdsByCharacter),
    input.validationProvenance,
    environment,
  );
  if (candidateValidation.failure) {
    return {
      ...base,
      outcome: "rejected-before-run",
      independentValidation: candidateValidation.validation,
      requestedAssignmentsSatisfied: false,
      failure: candidateValidation.failure,
    };
  }

  const configs = buildCandidateTeamConfigs(
    input.formulaDraft,
    candidate.artifactSetIdsByCharacter,
  );
  let teamBuild: TeamBuild;
  try {
    teamBuild = new TeamBuild(
      configs,
      {},
      undefined,
      [],
      undefined,
      ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
    );
  } catch (error) {
    return {
      ...base,
      outcome: "failed-during-run",
      independentValidation: {
        ...candidateValidation.validation,
        runtimeRegistration: "failed",
      },
      requestedAssignmentsSatisfied: false,
      failure: serializeFailure("team-build-failed", "team-build", error),
    };
  }

  let combo: ComboFormula;
  try {
    combo = buildGeneratorCombo(input.formulaDraft, teamBuild);
  } catch (error) {
    return {
      ...base,
      outcome: "rejected-before-run",
      independentValidation: {
        ...candidateValidation.validation,
        runtimeRegistration: "passed",
      },
      requestedAssignmentsSatisfied: false,
      failure: serializeFailure(
        "candidate-formula-invalid",
        "formula-validation",
        error,
      ),
    };
  }

  let finalResult: GeneratorResult | null = null;
  let previousProgress = -1;
  let sawDone = false;
  try {
    const generated = environment.runGenerator({
      teamBuild,
      carryCharId: input.carryCharacterId,
      combo,
      calcContext: ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
      rollMultiplier: ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT.rollMultiplier,
      substatBudget: ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT.substatBudget,
    });
    base.generatorInvoked = true;
    for await (const result of generated) {
      validateProgressYield(
        candidate.candidateId,
        result,
        previousProgress,
        sawDone,
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
  } catch (error) {
    const isResultValidation = error instanceof CandidateResultValidationError;
    return {
      ...base,
      generatorInvoked: true,
      outcome: "failed-during-run",
      independentValidation: {
        ...candidateValidation.validation,
        runtimeRegistration: "passed",
      },
      requestedAssignmentsSatisfied: false,
      failure: serializeFailure(
        isResultValidation ? "generator-result-invalid" : "generator-failed",
        isResultValidation ? "result-validation" : "generator",
        error,
      ),
    };
  }

  if (!finalResult) {
    return {
      ...base,
      generatorInvoked: true,
      outcome: "failed-during-run",
      independentValidation: {
        ...candidateValidation.validation,
        runtimeRegistration: "passed",
      },
      requestedAssignmentsSatisfied: false,
      failure: {
        code: "generator-produced-no-final-result",
        stage: "result-validation",
        name: "GeneratorResultError",
        message: `Candidate ${candidate.candidateId} produced no done=true result.`,
      },
    };
  }

  try {
    const artifactShape = validateAndObserveArtifactShape(
      candidate,
      finalResult,
    );
    return {
      ...base,
      generatorInvoked: true,
      outcome: "completed-structurally",
      classification: candidate.classification,
      independentValidation: {
        validationTargetsMatchAssignmentAndProvenance: true,
        allSetsAreFiveStar: true,
        runtimeRegistration: "passed",
      },
      requestedAssignmentsSatisfied: true,
      artifactShape,
      validationTargetComparisons: compareValidationTargets(
        candidate.validationTargets,
        finalResult.artifactsByChar,
      ),
    };
  } catch (error) {
    return {
      ...base,
      generatorInvoked: true,
      outcome: "failed-during-run",
      independentValidation: {
        ...candidateValidation.validation,
        runtimeRegistration: "passed",
      },
      requestedAssignmentsSatisfied: false,
      failure: serializeFailure(
        "generator-result-invalid",
        "result-validation",
        error,
      ),
    };
  }
}

function validateProbeInput(input: ArtifactGenerationTechnicalProbeInput): void {
  const repositoryResult = KnowledgeRepositorySchema.safeParse(
    input.validationProvenance.repository,
  );
  if (!repositoryResult.success) {
    throw new Error(
      "Artifact-generation technical probe requires a valid consolidated knowledge repository for provenance checks.",
    );
  }
  if (!input.preflight.equipmentReadyForTechnicalProbe) {
    throw new Error(
      "Artifact-generation technical probe requires a passing seed equipment preflight.",
    );
  }
  if (input.preflight.sourceTeamRecordId !== input.formulaDraft.sourceTeamRecordId) {
    throw new Error(
      "Artifact-generation technical probe preflight and formula draft target different teams.",
    );
  }
  if (
    input.candidates.length === 0 ||
    input.candidates.length > MAX_CANDIDATES
  ) {
    throw new Error(
      `Artifact-generation technical probe requires 1-${MAX_CANDIDATES} candidates.`,
    );
  }
  const characterIds = input.formulaDraft.assumptions.characters.map(
    ({ characterId }) => characterId,
  );
  if (!characterIds.includes(input.carryCharacterId)) {
    throw new Error(
      `Artifact-generation technical probe carry ${input.carryCharacterId} is not in the formula fixture.`,
    );
  }
  const candidateIds = input.candidates.map(({ candidateId }) => candidateId);
  if (
    candidateIds.some((candidateId) => !candidateId.trim()) ||
    new Set(candidateIds).size !== candidateIds.length
  ) {
    throw new Error(
      "Artifact-generation technical probe candidate IDs must be non-empty and unique.",
    );
  }

  const preflightBinding = new Map(
    input.preflight.formulaDraftBinding.characters.map((character) => [
      character.characterId,
      character,
    ]),
  );
  for (const assumption of input.formulaDraft.assumptions.characters) {
    const bound = preflightBinding.get(assumption.characterId);
    if (
      !bound ||
      bound.charLevel !== assumption.charLevel ||
      bound.constellation !== assumption.constellation ||
      bound.refinement !== assumption.refinement ||
      bound.selectedWeaponId !== assumption.selectedWeaponId ||
      JSON.stringify(bound.talentLevels) !==
        JSON.stringify(assumption.talentLevels) ||
      requireFourPieceSetId(bound.characterId, bound.selectedArtifact) !==
        requireFourPieceSetId(assumption.characterId, assumption.selectedArtifact)
    ) {
      throw new Error(
        `Artifact-generation technical probe formula binding changed for ${assumption.characterId}.`,
      );
    }
  }
  if (preflightBinding.size !== characterIds.length) {
    throw new Error(
      "Artifact-generation technical probe formula binding has a different team shape.",
    );
  }
}

function validateCandidate(
  candidate: ArtifactGenerationTechnicalCandidate,
  expectedCharacterIds: string[],
  provenance: ArtifactGenerationValidationProvenance,
  environment: ArtifactGenerationTechnicalProbeEnvironment,
): {
  validation: CandidateBase["independentValidation"];
  failure: ArtifactGenerationCandidateFailure | null;
} {
  if (!ALLOWED_CANDIDATE_CLASSIFICATIONS.has(String(candidate.classification))) {
    return candidateRejection(
      "candidate-classification-invalid",
      `Candidate ${candidate.candidateId} has unsupported classification ${String(candidate.classification)}.`,
      false,
      "not-evaluated",
    );
  }
  const invalidTargetIndex = candidate.validationTargets.findIndex(
    (target) => !hasRecognizedValidationTargetEnvelope(target),
  );
  if (invalidTargetIndex >= 0) {
    return candidateRejection(
      "candidate-validation-target-provenance-mismatch",
      `Candidate ${candidate.candidateId} validation target ${invalidTargetIndex} has an unsupported kind or malformed identity envelope.`,
      false,
      "not-evaluated",
    );
  }
  const requestedIds = Object.keys(candidate.artifactSetIdsByCharacter).sort();
  const expectedIds = [...expectedCharacterIds].sort();
  if (requestedIds.join("\0") !== expectedIds.join("\0")) {
    return candidateRejection(
      "candidate-character-mismatch",
      `Candidate ${candidate.candidateId} must assign exactly ${expectedIds.join(", ")}.`,
      false,
      "not-evaluated",
    );
  }

  const targetsByCharacter = new Map(
    candidate.validationTargets.map((target) => [target.characterId, target]),
  );
  const validationTargetsMatchAssignment =
    candidate.validationTargets.length === expectedIds.length &&
    targetsByCharacter.size === expectedIds.length &&
    expectedIds.every((characterId) => {
      const target = targetsByCharacter.get(characterId);
      return (
        target?.artifactSetId ===
        candidate.artifactSetIdsByCharacter[characterId]
      );
    });
  if (!validationTargetsMatchAssignment) {
    return candidateRejection(
      "candidate-build-target-mismatch",
      `Candidate ${candidate.candidateId} does not have one matching validation target per assignment.`,
      false,
      "not-evaluated",
    );
  }

  const hasComposedTarget = candidate.validationTargets.some(
    ({ kind }) => kind === "composed-source-claims",
  );
  if (
    (candidate.classification.startsWith("repository-build-") &&
      hasComposedTarget) ||
    (candidate.classification === "composed-source-claims" &&
      !hasComposedTarget)
  ) {
    return candidateRejection(
      "candidate-validation-target-provenance-mismatch",
      `Candidate ${candidate.candidateId} classification ${candidate.classification} is inconsistent with its validation-target kinds.`,
      false,
      "not-evaluated",
    );
  }

  for (const characterId of expectedIds) {
    const target = targetsByCharacter.get(characterId);
    if (!target) {
      return candidateRejection(
        "candidate-build-target-mismatch",
        `Candidate ${candidate.candidateId} is missing validation target ${characterId}.`,
        false,
        "not-evaluated",
      );
    }
    const provenanceMismatch = validateTargetProvenance(
      target,
      provenance,
      environment,
    );
    if (provenanceMismatch) {
      return candidateRejection(
        "candidate-validation-target-provenance-mismatch",
        `Candidate ${candidate.candidateId} target ${characterId} failed provenance validation: ${provenanceMismatch}`,
        false,
        "not-evaluated",
      );
    }
  }

  for (const characterId of expectedIds) {
    const setId = candidate.artifactSetIdsByCharacter[characterId];
    const artifact = artifactsById[setId];
    if (!artifact) {
      return candidateRejection(
        "unknown-artifact-set",
        `Candidate ${candidate.candidateId} assigns unknown set ${setId} to ${characterId}.`,
        true,
        false,
      );
    }
    if (artifact.rarity !== 5) {
      return candidateRejection(
        "non-five-star-set",
        `Candidate ${candidate.candidateId} assigns ${artifact.rarity}-star set ${setId} to ${characterId}; the deterministic probe admits only 5-star sets (non-five-star-filter).`,
        true,
        false,
      );
    }
  }

  return {
    validation: {
      validationTargetsMatchAssignmentAndProvenance: true,
      allSetsAreFiveStar: true,
      runtimeRegistration: "not-attempted",
    },
    failure: null,
  };
}

function candidateRejection(
  code: ArtifactGenerationCandidateFailure["code"],
  message: string,
  validationTargetsMatchAssignmentAndProvenance: boolean,
  allSetsAreFiveStar: boolean | "not-evaluated",
): ReturnType<typeof validateCandidate> {
  return {
    validation: {
      validationTargetsMatchAssignmentAndProvenance,
      allSetsAreFiveStar,
      runtimeRegistration: "not-attempted",
    },
    failure: {
      code,
      stage: "candidate-validation",
      name: "CandidateValidationError",
      message,
    },
  };
}

function hasRecognizedValidationTargetEnvelope(
  target: unknown,
): target is ArtifactGenerationValidationTarget {
  if (target == null || typeof target !== "object") return false;
  const record = target as Record<string, unknown>;
  if (
    typeof record.characterId !== "string" ||
    typeof record.artifactSetId !== "string" ||
    !isStringArray(record.sands) ||
    !isStringArray(record.goblet) ||
    !isStringArray(record.circlet) ||
    !isStringArray(record.substats)
  ) {
    return false;
  }
  if (record.kind === "repository-build") {
    return (
      typeof record.characterGuideId === "string" &&
      typeof record.buildSourceRecordId === "string"
    );
  }
  if (record.kind === "composed-source-claims") {
    const matchedStatClaimIds =
      record.matchedStatClaimIds != null &&
      typeof record.matchedStatClaimIds === "object"
        ? (record.matchedStatClaimIds as Record<string, unknown>)
        : null;
    return (
      typeof record.compositionId === "string" &&
      isStringArray(record.repositoryRecordIds) &&
      isStringArray(record.equipmentClaimIds) &&
      isStringArray(record.withheldStatClaimIds) &&
      Array.isArray(record.sourcePriorityGroups) &&
      record.sourcePriorityGroups.every(isStringArray) &&
      matchedStatClaimIds != null &&
      isStringArray(matchedStatClaimIds.sands) &&
      isStringArray(matchedStatClaimIds.goblet) &&
      isStringArray(matchedStatClaimIds.circlet) &&
      isStringArray(matchedStatClaimIds.substats) &&
      record.sourceAuthored === false
    );
  }
  return false;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function describeRequestedValidationTarget(
  target: unknown,
  targetIndex: number,
): [string, RequestedValidationTargetObservation] {
  const record =
    target != null && typeof target === "object"
      ? (target as Record<string, unknown>)
      : {};
  const characterKey =
    typeof record.characterId === "string"
      ? record.characterId
      : `invalid-target-${targetIndex}`;
  if (record.kind === "repository-build") {
    return [
      characterKey,
      {
        kind: record.kind,
        characterGuideId:
          typeof record.characterGuideId === "string"
            ? record.characterGuideId
            : null,
        buildSourceRecordId:
          typeof record.buildSourceRecordId === "string"
            ? record.buildSourceRecordId
            : null,
      },
    ];
  }
  if (record.kind === "composed-source-claims") {
    return [
      characterKey,
      {
        kind: record.kind,
        compositionId:
          typeof record.compositionId === "string"
            ? record.compositionId
            : null,
      },
    ];
  }
  return [
    characterKey,
    {
      kind: "unrecognized",
      requestedKind: typeof record.kind === "string" ? record.kind : null,
    },
  ];
}

type KnowledgeCharacterGuide = Extract<
  KnowledgeRecord,
  { kind: "character_guide" }
>;

function validateTargetProvenance(
  target: ArtifactGenerationValidationTarget,
  provenance: ArtifactGenerationValidationProvenance,
  environment: ArtifactGenerationTechnicalProbeEnvironment,
): string | null {
  const incompleteStats = [
    target.sands,
    target.goblet,
    target.circlet,
    target.substats,
  ].some((values) => values.length === 0);
  if (incompleteStats) {
    return "main-stat and substat observations must all be non-empty";
  }
  const statDomainMismatch = validateValidationTargetStatDomains(target);
  if (statDomainMismatch) return statDomainMismatch;

  if (target.kind === "repository-build") {
    return validateRepositoryBuildTarget(target, provenance.repository);
  }
  const structuralMismatch = validateComposedSourceClaimsTargetShape(target);
  if (structuralMismatch) return structuralMismatch;
  const trustedValidator = environment.validateComposedSourceClaimsTarget;
  if (!trustedValidator) {
    return "composed source claims require a trusted source-specific environment validator";
  }
  try {
    const result = trustedValidator(cloneComposedSourceClaimsTarget(target));
    if (result.valid) return null;
    return result.message.trim()
      ? `trusted source-specific validator rejected the target: ${result.message}`
      : "trusted source-specific validator rejected the target without a reason";
  } catch (error) {
    return `trusted source-specific validator threw ${serializeErrorMessage(error)}`;
  }
}

function validateValidationTargetStatDomains(
  target: ArtifactGenerationValidationTarget,
): string | null {
  const mainStatSlots = ["sands", "goblet", "circlet"] as const;
  for (const slot of mainStatSlots) {
    const legalMainStats = statPools[slot] as readonly MainStat[];
    const illegalStat = target[slot].find(
      (stat) => !legalMainStats.includes(stat),
    );
    if (illegalStat) {
      return `validation target ${slot} contains slot-illegal main stat ${illegalStat}`;
    }
  }
  const illegalSubstat = target.substats.find(
    (stat) => !LEGAL_SUBSTAT_KEYS.has(stat),
  );
  if (illegalSubstat) {
    return `validation target substats contain illegal substat ${illegalSubstat}`;
  }
  if (target.kind === "composed-source-claims") {
    const illegalPriorityStat = target.sourcePriorityGroups
      .flat()
      .find((stat) => !LEGAL_SUBSTAT_KEYS.has(stat));
    if (illegalPriorityStat) {
      return `composed source priority groups contain illegal substat ${illegalPriorityStat}`;
    }
  }
  return null;
}

function validateRepositoryBuildTarget(
  target: ArtifactGenerationRepositoryBuildValidationTarget,
  repository: KnowledgeRepository,
): string | null {
  const guides = repository.records.filter(
    (record): record is KnowledgeCharacterGuide =>
      record.kind === "character_guide" && record.id === target.characterGuideId,
  );
  if (guides.length !== 1) {
    return `expected one repository character guide ${target.characterGuideId}, found ${guides.length}`;
  }
  const guide = guides[0];
  if (guide.characterId !== target.characterId) {
    return `guide ${target.characterGuideId} belongs to ${guide.characterId}, not ${target.characterId}`;
  }
  const builds = guide.builds.filter(
    ({ sourceRecordId }) => sourceRecordId === target.buildSourceRecordId,
  );
  if (builds.length !== 1) {
    return `expected one repository build ${target.buildSourceRecordId} in ${target.characterGuideId}, found ${builds.length}`;
  }
  const build = builds[0];
  if (
    build.artifact.type !== "4pc" ||
    build.artifact.setId !== target.artifactSetId
  ) {
    return `repository build ${target.buildSourceRecordId} does not select 4pc ${target.artifactSetId}`;
  }
  const repositoryStats = {
    sands: build.sands.map(({ stat }) => stat),
    goblet: build.goblet.map(({ stat }) => stat),
    circlet: build.circlet.map(({ stat }) => stat),
    substats: build.substats.map(({ stat }) => stat),
  };
  const targetStats = {
    sands: target.sands,
    goblet: target.goblet,
    circlet: target.circlet,
    substats: target.substats,
  };
  if (stableJson(repositoryStats) !== stableJson(targetStats)) {
    return `repository build ${target.buildSourceRecordId} stat observations do not match the declared target`;
  }
  return null;
}

function validateComposedSourceClaimsTargetShape(
  target: ArtifactGenerationComposedSourceClaimsValidationTarget,
): string | null {
  const claimIdGroups = [
    target.equipmentClaimIds,
    target.matchedStatClaimIds.sands,
    target.matchedStatClaimIds.goblet,
    target.matchedStatClaimIds.circlet,
    target.matchedStatClaimIds.substats,
    target.withheldStatClaimIds,
  ];
  if (
    !target.compositionId.trim() ||
    target.repositoryRecordIds.length === 0 ||
    target.equipmentClaimIds.length === 0 ||
    target.repositoryRecordIds.some((recordId) => !recordId.trim()) ||
    claimIdGroups.some((claimIds) =>
      claimIds.some((claimId) => !claimId.trim()),
    )
  ) {
    return "composition and source-claim IDs must be non-empty";
  }
  const matchedClaimIds = [
    ...target.matchedStatClaimIds.sands,
    ...target.matchedStatClaimIds.goblet,
    ...target.matchedStatClaimIds.circlet,
    ...target.matchedStatClaimIds.substats,
  ];
  if (
    new Set(target.repositoryRecordIds).size !==
      target.repositoryRecordIds.length ||
    new Set(target.equipmentClaimIds).size !== target.equipmentClaimIds.length ||
    new Set(matchedClaimIds).size !== matchedClaimIds.length ||
    new Set(target.withheldStatClaimIds).size !==
      target.withheldStatClaimIds.length ||
    matchedClaimIds.some((claimId) =>
      target.withheldStatClaimIds.includes(claimId),
    )
  ) {
    return "composed source-claim IDs must be unique and matched/withheld stat claims must be disjoint";
  }
  if (
    target.sourceAuthored !== false ||
    target.sourcePriorityGroups.length === 0 ||
    target.sourcePriorityGroups.some((group) => group.length === 0)
  ) {
    return "composed targets must be factory-authored and retain non-empty source priority groups";
  }

  return null;
}

function cloneComposedSourceClaimsTarget(
  target: ArtifactGenerationComposedSourceClaimsValidationTarget,
): ArtifactGenerationComposedSourceClaimsValidationTarget {
  return {
    ...target,
    repositoryRecordIds: [...target.repositoryRecordIds],
    equipmentClaimIds: [...target.equipmentClaimIds],
    matchedStatClaimIds: {
      sands: [...target.matchedStatClaimIds.sands],
      goblet: [...target.matchedStatClaimIds.goblet],
      circlet: [...target.matchedStatClaimIds.circlet],
      substats: [...target.matchedStatClaimIds.substats],
    },
    withheldStatClaimIds: [...target.withheldStatClaimIds],
    sourcePriorityGroups: target.sourcePriorityGroups.map((group) => [...group]),
    sands: [...target.sands],
    goblet: [...target.goblet],
    circlet: [...target.circlet],
    substats: [...target.substats],
  };
}

function serializeErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : `NonErrorThrow: ${String(error)}`;
}

export function describeArtifactGenerationValidationTargetProvenance(
  target: ArtifactGenerationValidationTarget,
): ArtifactGenerationValidationTargetProvenance {
  if (target.kind === "repository-build") {
    return {
      kind: target.kind,
      characterGuideId: target.characterGuideId,
      buildSourceRecordId: target.buildSourceRecordId,
    };
  }
  return {
    kind: target.kind,
    compositionId: target.compositionId,
    repositoryRecordIds: [...target.repositoryRecordIds],
    equipmentClaimIds: [...target.equipmentClaimIds],
    matchedStatClaimIds: {
      sands: [...target.matchedStatClaimIds.sands],
      goblet: [...target.matchedStatClaimIds.goblet],
      circlet: [...target.matchedStatClaimIds.circlet],
      substats: [...target.matchedStatClaimIds.substats],
    },
    withheldStatClaimIds: [...target.withheldStatClaimIds],
    sourcePriorityGroups: target.sourcePriorityGroups.map((group) => [...group]),
    sourceAuthored: false,
  };
}

export function artifactGenerationValidationTargetKnowledgeRecordIds(
  target: ArtifactGenerationValidationTarget,
): string[] {
  return target.kind === "repository-build"
    ? [target.characterGuideId]
    : [...target.repositoryRecordIds];
}

function buildCandidateTeamConfigs(
  formulaDraft: FormulaPlanDraftOutput,
  artifactSetIdsByCharacter: Record<string, string>,
): TeamSlotConfig[] {
  return formulaDraft.assumptions.characters.map((assumption) => ({
    charId: assumption.characterId,
    charLevel: assumption.charLevel,
    constellation: assumption.constellation,
    weaponId: assumption.selectedWeaponId,
    refinement: assumption.refinement,
    artifactSet: {
      type: "4pc",
      setId: artifactSetIdsByCharacter[assumption.characterId],
    },
    talentLevels: { ...assumption.talentLevels },
  }));
}

function buildGeneratorCombo(
  formulaDraft: FormulaPlanDraftOutput,
  teamBuild: TeamBuild,
): ComboFormula {
  if (formulaDraft.lines.length === 0) {
    throw new Error(
      "Artifact-generation technical objective requires at least one formula line.",
    );
  }
  const availableFormulas = teamBuild.catalog.getFormulaIds();
  const lines = formulaDraft.lines.map((line) => {
    if (!availableFormulas[line.characterId]?.[line.formulaId]) {
      throw new Error(
        `Technical objective formula ${line.characterId}.${line.formulaId} is unavailable for the rebuilt candidate team.`,
      );
    }
    if (!Number.isFinite(line.count) || line.count <= 0) {
      throw new Error(
        `Technical objective formula ${line.characterId}.${line.formulaId} requires a positive finite count.`,
      );
    }
    return {
      charId: line.characterId,
      formulaId: line.formulaId,
      count: line.count,
    };
  });
  return {
    id: "guide-factory-unreviewed-formula-draft-technical-objective",
    label: {
      en: "Unreviewed formula draft (technical probe only)",
      zh: "未审核公式草案（仅技术探测）",
    },
    lines,
  };
}

function validateAndObserveArtifactShape(
  candidate: ArtifactGenerationTechnicalCandidate,
  result: GeneratorResult,
): ArtifactShapeObservation[] {
  if (!result.done || result.phase !== "done" || result.progress !== 1) {
    throw new Error(
      `Candidate ${candidate.candidateId} final result is not done at progress 1.`,
    );
  }
  const expectedCharacterIds = Object.keys(
    candidate.artifactSetIdsByCharacter,
  ).sort();
  const artifactCharacterIds = Object.keys(result.artifactsByChar).sort();
  const sheetCharacterIds = Object.keys(result.sheetsByChar).sort();
  if (
    artifactCharacterIds.join("\0") !== expectedCharacterIds.join("\0") ||
    sheetCharacterIds.join("\0") !== expectedCharacterIds.join("\0")
  ) {
    throw new Error(
      `Candidate ${candidate.candidateId} result character shape differs from the requested team.`,
    );
  }

  return expectedCharacterIds.map((characterId) => {
    const artifacts = result.artifactsByChar[characterId];
    const requestedSetId = candidate.artifactSetIdsByCharacter[characterId];
    if (
      !artifacts ||
      Object.keys(artifacts).sort().join("\0") !==
        [...allSlots].sort().join("\0")
    ) {
      throw new CandidateResultValidationError(
        `Candidate ${candidate.candidateId} returned an invalid slot inventory for ${characterId}.`,
      );
    }
    const slots = allSlots.map((slot) => {
      const artifact = artifacts?.[slot];
      if (!artifact) {
        throw new Error(
          `Candidate ${candidate.candidateId} is missing ${characterId}.${slot}.`,
        );
      }
      if (artifact.slotKey !== slot || artifact.setKey !== requestedSetId) {
        throw new Error(
          `Candidate ${candidate.candidateId} returned ${characterId}.${slot} as ${artifact.slotKey}/${artifact.setKey}, expected ${slot}/${requestedSetId}.`,
        );
      }
      if (
        artifact.id !== `gen-${characterId}-${slot}` ||
        artifact.rarity !== 5 ||
        artifact.level !== 20
      ) {
        throw new CandidateResultValidationError(
          `Candidate ${candidate.candidateId} returned invalid generated-piece identity/rarity/level for ${characterId}.${slot}.`,
        );
      }
      if (!(statPools[slot] as readonly MainStat[]).includes(artifact.mainStatKey)) {
        throw new CandidateResultValidationError(
          `Candidate ${candidate.candidateId} returned illegal main stat ${artifact.mainStatKey} for ${characterId}.${slot}.`,
        );
      }
      validateSubstats(candidate.candidateId, characterId, slot, artifact);
      return {
        slot,
        setId: artifact.setKey,
        rarity: artifact.rarity,
        level: artifact.level,
        hasMainStat: Boolean(artifact.mainStatKey),
        positiveSubstatKeyCount: positiveSubstatKeys(artifact).length,
      };
    });
    return { characterId, slots };
  });
}

function validateProgressYield(
  candidateId: string,
  result: GeneratorResult,
  previousProgress: number,
  sawDone: boolean,
): void {
  if (
    !Number.isFinite(result.progress) ||
    result.progress < 0 ||
    result.progress > 1 ||
    result.progress < previousProgress
  ) {
    throw new CandidateResultValidationError(
      `Candidate ${candidateId} emitted invalid or decreasing progress ${result.progress} after ${previousProgress}.`,
    );
  }
  if (sawDone) {
    throw new CandidateResultValidationError(
      `Candidate ${candidateId} emitted a result after its done=true result.`,
    );
  }
  if (result.done && (result.phase !== "done" || result.progress !== 1)) {
    throw new CandidateResultValidationError(
      `Candidate ${candidateId} emitted done=true without phase=done and progress=1.`,
    );
  }
}

function validateSubstats(
  candidateId: string,
  characterId: string,
  slot: Slot,
  artifact: ArtifactData,
): void {
  const entries = Object.entries(artifact.substats);
  if (entries.length > 4) {
    throw new CandidateResultValidationError(
      `Candidate ${candidateId} returned more than four substat keys for ${characterId}.${slot}.`,
    );
  }
  for (const [key, value] of entries) {
    if (!LEGAL_SUBSTAT_KEYS.has(key as SubStat)) {
      throw new CandidateResultValidationError(
        `Candidate ${candidateId} returned unknown substat ${key} for ${characterId}.${slot}.`,
      );
    }
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new CandidateResultValidationError(
        `Candidate ${candidateId} returned non-positive or non-finite ${key} for ${characterId}.${slot}.`,
      );
    }
    if (key === artifact.mainStatKey) {
      throw new CandidateResultValidationError(
        `Candidate ${candidateId} returned main/substat conflict ${key} for ${characterId}.${slot}.`,
      );
    }
  }
}

const LEGAL_SUBSTAT_KEYS: ReadonlySet<SubStat> = new Set([
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

function compareValidationTargets(
  targets: ArtifactGenerationValidationTarget[],
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>,
): CharacterValidationObservation[] {
  return targets
    .map((target): CharacterValidationObservation => {
      const artifacts = artifactsByChar[target.characterId];
      if (!artifacts) {
        throw new Error(
          `Missing generated artifacts for validation target ${target.characterId}.`,
        );
      }
      const generatedPositiveKeys = [
        ...new Set(allSlots.flatMap((slot) => positiveSubstatKeys(artifacts[slot]))),
      ].sort(compareText);
      const validationTargetObservedKeys = [...new Set(target.substats)].sort(
        compareText,
      );
      const validationTargetKeySet = new Set(validationTargetObservedKeys);
      const generatedKeySet = new Set(generatedPositiveKeys);

      return {
        characterId: target.characterId,
        validationTargetProvenance:
          describeArtifactGenerationValidationTargetProvenance(target),
        artifactSetId: target.artifactSetId,
        mainStats: {
          sands: compareMainStat(artifacts.sands.mainStatKey, target.sands),
          goblet: compareMainStat(artifacts.goblet.mainStatKey, target.goblet),
          circlet: compareMainStat(
            artifacts.circlet.mainStatKey,
            target.circlet,
          ),
        },
        substats: {
          generatedPositiveKeys,
          validationTargetObservedKeys,
          generatedKeysListedByValidationTarget: generatedPositiveKeys.filter(
            (key) => validationTargetKeySet.has(key),
          ),
          generatedKeysNotListedByValidationTarget:
            generatedPositiveKeys.filter(
              (key) => !validationTargetKeySet.has(key),
            ),
          validationTargetKeysNotGenerated: validationTargetObservedKeys.filter(
            (key) => !generatedKeySet.has(key),
          ),
        },
      };
    })
    .sort((left, right) => compareText(left.characterId, right.characterId));
}

function compareMainStat(
  generated: MainStat,
  validationTargetObserved: MainStat[],
): MainStatReviewObservation {
  const sortedValidationTargetObserved = [
    ...new Set(validationTargetObserved),
  ].sort(compareText);
  return {
    generated,
    validationTargetObserved: sortedValidationTargetObserved,
    relation: sortedValidationTargetObserved.includes(generated)
      ? "listed-by-validation-target"
      : "not-listed-by-validation-target",
  };
}

function positiveSubstatKeys(artifact: ArtifactData): SubStat[] {
  return Object.entries(artifact.substats)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([key]) => key as SubStat)
    .sort(compareText);
}

function requireFourPieceSetId(
  characterId: string,
  artifact: FormulaPlanDraftOutput["assumptions"]["characters"][number]["selectedArtifact"],
): string {
  if (artifact.type !== "4pc") {
    throw new Error(
      `Artifact-generation technical probe seed ${characterId} is not a four-piece set.`,
    );
  }
  return artifact.setId;
}

function serializeFailure(
  code: ArtifactGenerationCandidateFailure["code"],
  stage: ArtifactGenerationCandidateFailure["stage"],
  error: unknown,
): ArtifactGenerationCandidateFailure {
  return error instanceof Error
    ? { code, stage, name: error.name, message: error.message }
    : { code, stage, name: "NonErrorThrow", message: String(error) };
}

function sortTextRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
