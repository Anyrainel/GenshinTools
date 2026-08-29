import type { StatKey } from "@/data/enums";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type { CalcContext, TeamSlotConfig } from "@/lib/dmgcalc/types";
import {
  runGenerator,
  type GeneratorOptions,
  type GeneratorResult,
} from "@/lib/team-comp/generator/generator";
import {
  ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
  runArtifactGenerationTechnicalProbe,
  type ArtifactGenerationCandidateFailure,
  type ArtifactGenerationTechnicalCandidate,
  type ArtifactGenerationTechnicalProbeInput,
} from "./artifactGenerationTechnicalProbe";
import {
  replayTeamDamage,
  type DamageReplayInput,
  type DamageReplayOutput,
  type ReplayComboLine,
  type ReplayTeamConfigs,
} from "./computationReplay";
import type { FormulaPlanDraftLine } from "./formulaPlanDraft";
import { sha256Text, stableJson } from "./io";
import { fingerprintGeneratedArtifacts } from "./artifactGenerationSensitivityProbe";

type GeneratorRunner = (
  options: GeneratorOptions,
) => AsyncIterable<GeneratorResult>;

type ReplayRunner = (input: DamageReplayInput) => Promise<DamageReplayOutput>;

export type BoundedJointArtifactExperimentEnvironment = {
  runGenerator: GeneratorRunner;
  replayTeamDamage: ReplayRunner;
};

export type BoundedJointArtifactExperimentInput = {
  baseProbeInput: ArtifactGenerationTechnicalProbeInput;
  candidateIds: [string, string, string, string];
  carryCharacterIds: [string, string, string, string];
  unreviewedTechnicalFormulaLines: FormulaPlanDraftLine[];
  generatedFrom: Array<{ path: string; sha256: string }>;
};

type SheetDumpEntry = { key: StatKey; filterKey: string; value: number };

type CapturedRun = {
  carryCharacterId: string;
  artifactFingerprintSha256: string;
  sheetFingerprintsByCharacter: Record<string, string>;
  teamConfigs: ReplayTeamConfigs;
  sheetsByCharacter: Record<string, StatSheet>;
};

type RunFailure = {
  carryCharacterId: string;
  failure:
    | ArtifactGenerationCandidateFailure
      | {
          code: "missing-final-capture";
          stage: "capture";
          name: "JointExperimentCaptureError";
          message: string;
        }
      | {
          code: "captured-result-invalid";
          stage: "capture";
          name: "JointExperimentCaptureError";
          message: string;
        };
};

type NodeFailure = {
  code: "team-config-mismatch";
  stage: "capture";
  name: "JointExperimentCaptureError";
  message: string;
};

type PoolCell = {
  nodeId: string;
  characterId: string;
  sheetId: string;
  originCarryCharacterIds: string[];
  entries: SheetDumpEntry[];
};

export type BoundedJointArtifactCompositionObservation = {
  compositionId: string;
  sheetsByCharacter: Record<
    string,
    {
      nodeId: string;
      sheetId: string;
      originCarryCharacterIds: string[];
    }
  >;
  intactCarryCharacterIds: string[];
  outcome: "evaluated" | "evaluation-failed";
  unreviewedTechnicalObjective: number | null;
  normalizedToBoundedReference: number | null;
  normalizedToBoundedReferenceStatus:
    | "available"
    | "undefined-zero-reference"
    | "not-comparable";
  computedBuffOverrideLineCount: number | null;
  computedBuffOverridesSha256: string | null;
  calculatorAgreement:
    | {
        passed: true;
        interpretedObjective: number;
        compiledObjective: number;
        absoluteDifference: number;
        allowedDifference: number;
      }
    | null;
  failure: { name: string; message: string } | null;
};

export type BoundedJointArtifactNodeObservation = {
  nodeId: string;
  requestedArtifactSetIdsByCharacter: Record<string, string>;
  sourceBuildIdsByCharacter: Record<string, string>;
  carryRuns: Array<
    | {
        carryCharacterId: string;
        outcome: "captured";
        artifactFingerprintSha256: string;
        sheetFingerprintsByCharacter: Record<string, string>;
      }
    | ({ outcome: "not-comparable" } & RunFailure)
  >;
  nodeFailures: NodeFailure[];
  technicalTeamConfigs: ReplayTeamConfigs | null;
  capturedTeamConfigSha256: string | null;
  comparisonStatus: "comparable" | "not-comparable";
  sheetPoolsByCharacter: Record<
    string,
    Array<{
      nodeId: string;
      sheetId: string;
      originCarryCharacterIds: string[];
    }>
  >;
  poolSizesByCharacter: Record<string, number>;
  expectedCartesianCompositionCount: number | null;
  observedCartesianCompositionCount: number;
  intactCarryCoverage: Array<{
    carryCharacterId: string;
    compositionId: string | null;
  }>;
  compositions: BoundedJointArtifactCompositionObservation[];
  boundedReferenceComposition:
    | {
        compositionId: string;
        unreviewedTechnicalObjective: number;
        equivalentCompositionIds: string[];
        representativeSelectionPolicy: "first-enumerated-exact-objective-tie";
      }
    | null;
  bestIntactCarryComposition:
    | {
        compositionId: string;
        unreviewedTechnicalObjective: number;
        equivalentCompositionIds: string[];
        representativeSelectionPolicy: "first-enumerated-exact-objective-tie";
      }
    | null;
  boundedReferenceOverBestIntact: number | null;
  boundedReferenceOverBestIntactStatus:
    | "available"
    | "undefined-zero-best-intact"
    | "not-comparable";
};

export type BoundedJointArtifactExperimentReport = {
  schemaVersion: 1;
  classification: "bounded-joint-artifact-stat-technical-experiment";
  supportsGuideClaims: false;
  supportsArtifactRecommendations: false;
  supportsGamePerformanceClaims: false;
  supportsGlobalOptimality: false;
  supportsTechnicalObjectiveComparison: true;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceTeamRecordId: string;
  comparisonStatus: "comparable" | "not-comparable";
  technicalObjectiveInputs: {
    unreviewedTechnicalFormulaPlan: {
      reviewStatus: "unreviewed";
      sourceBindingEstablishedByCore: false;
      lines: FormulaPlanDraftLine[];
      sha256: string;
    };
    calcContext: CalcContext;
    combatOptions: Record<string, never>;
    enemyAura: null;
    extraBuffs: [];
    explicitFormulaBuffOverrides: null;
    sharedCharacterConfigs: Array<{
      characterId: string;
      charLevel: number;
      constellation: number;
      selectedWeaponId: string;
      refinement: number;
      talentLevels: { auto: number; skill: number; burst: number };
    }>;
  };
  execution: {
    scheduling: "sequential";
    plannedGeneratorInvocations: 16;
    observedGeneratorInvocations: number;
    maximumGeneratorConcurrency: number;
    freshTeamBuildPerInvocation: true;
    warmStartSupported: false;
    energyRecoveryThresholdsUsed: false;
    perCharacterConstraintsPassed: false;
    explicitGeneratorBuffOverridesPassed: false;
    explicitFormulaBuffOverridesPassedToReplay: false;
    calcContext: CalcContext;
    candidateIds: [string, string, string, string];
    carryCharacterIds: [string, string, string, string];
  };
  latticeBoundary: {
    nodeLocalSheetPoolsOnly: true;
    crossNodeSheetCompositionsAllowed: false;
    candidateNodeCount: 4;
    totalExpectedCompositions: number | null;
    totalObservedCompositions: number;
  };
  nodes: BoundedJointArtifactNodeObservation[];
  boundedReferenceComposition:
    | {
        nodeId: string;
        compositionId: string;
        unreviewedTechnicalObjective: number;
        equivalentReferences: Array<{
          nodeId: string;
          compositionId: string;
        }>;
        representativeSelectionPolicy: "first-candidate-then-enumerated-composition-exact-objective-tie";
      }
    | null;
  cautions: string[];
};

const DEFAULT_ENVIRONMENT: BoundedJointArtifactExperimentEnvironment = {
  runGenerator,
  replayTeamDamage,
};

/**
 * Exhaust the small node-local lattice formed by four repository-backed set
 * assignments and four generator carry seeds. This is an offline technical
 * comparison only: its authored formula counts remain unreviewed.
 */
export async function runBoundedJointArtifactExperiment(
  input: BoundedJointArtifactExperimentInput,
  environment: BoundedJointArtifactExperimentEnvironment = DEFAULT_ENVIRONMENT,
): Promise<BoundedJointArtifactExperimentReport> {
  const candidates = validateAndResolveInput(input);
  const translatedProbeInput = withExactFormulaLines(
    input.baseProbeInput,
    input.unreviewedTechnicalFormulaLines,
  );
  const characterIds = translatedProbeInput.formulaDraft.assumptions.characters.map(
    ({ characterId }) => characterId,
  );
  validateTechnicalFormulaLines(
    input.unreviewedTechnicalFormulaLines,
    characterIds,
  );
  const replayLines = toReplayLines(input.unreviewedTechnicalFormulaLines);
  let activeGenerators = 0;
  let maximumGeneratorConcurrency = 0;
  let observedGeneratorInvocations = 0;
  const nodes: BoundedJointArtifactNodeObservation[] = [];

  for (const candidate of candidates) {
    const captures: CapturedRun[] = [];
    const failures: RunFailure[] = [];
    for (const carryCharacterId of input.carryCharacterIds) {
      const capture: {
        finalResult: GeneratorResult | null;
        teamConfigs: ReplayTeamConfigs | null;
      } = { finalResult: null, teamConfigs: null };
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
            return captureGenerator(options);
          },
        },
      );
      const observation = technical.candidates[0];
      if (
        observation.outcome !== "completed-structurally" ||
        !capture.finalResult
      ) {
        failures.push({
          carryCharacterId,
          failure:
            observation.outcome === "completed-structurally"
              ? {
                  code: "missing-final-capture",
                  stage: "capture",
                  name: "JointExperimentCaptureError",
                  message: `${candidate.candidateId}/${carryCharacterId} completed without a captured final result.`,
                }
              : { ...observation.failure },
        });
        continue;
      }
      if (!capture.teamConfigs) {
        throw new Error(
          `${candidate.candidateId}/${carryCharacterId} invoked the generator without captured configs.`,
        );
      }
      const finalResult = capture.finalResult;
      const teamConfigs = capture.teamConfigs;
      try {
        const sheetFingerprintsByCharacter = Object.fromEntries(
          characterIds.map((characterId) => [
            characterId,
            fingerprintSheet(finalResult.sheetsByChar[characterId]),
          ]),
        );
        captures.push({
          carryCharacterId,
          artifactFingerprintSha256: fingerprintGeneratedArtifacts(
            finalResult.artifactsByChar,
          ),
          sheetFingerprintsByCharacter,
          teamConfigs,
          sheetsByCharacter: { ...finalResult.sheetsByChar },
        });
      } catch (error) {
        const serialized = serializeError(error);
        failures.push({
          carryCharacterId,
          failure: {
            code: "captured-result-invalid",
            stage: "capture",
            name: "JointExperimentCaptureError",
            message: `${candidate.candidateId}/${carryCharacterId} produced an invalid captured result: ${serialized.name}: ${serialized.message}`,
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
            if (result.done) capture.finalResult = result;
            yield result;
          }
        } finally {
          activeGenerators -= 1;
        }
      }
    }

    nodes.push(
      await buildNodeObservation(
        candidate,
        characterIds,
        input.carryCharacterIds,
        captures,
        failures,
        replayLines,
        environment,
      ),
    );
  }

  const allComparable = nodes.every(
    ({ comparisonStatus }) => comparisonStatus === "comparable",
  );
  const globalCandidates = nodes.flatMap((node) => {
    const reference = node.boundedReferenceComposition;
    return reference
      ? reference.equivalentCompositionIds.map((compositionId) => ({
          nodeId: node.nodeId,
          compositionId,
          unreviewedTechnicalObjective:
            reference.unreviewedTechnicalObjective,
        }))
      : [];
  });
  const globalRepresentative = allComparable
    ? maxByObjective(globalCandidates)
    : null;
  const globalReference = globalRepresentative
    ? {
        ...globalRepresentative,
        equivalentReferences: globalCandidates
          .filter(
            ({ unreviewedTechnicalObjective }) =>
              unreviewedTechnicalObjective ===
              globalRepresentative.unreviewedTechnicalObjective,
          )
          .map(({ nodeId, compositionId }) => ({ nodeId, compositionId })),
        representativeSelectionPolicy:
          "first-candidate-then-enumerated-composition-exact-objective-tie" as const,
      }
    : null;
  const expectedCounts = nodes.map(
    ({ expectedCartesianCompositionCount }) =>
      expectedCartesianCompositionCount,
  );

  return {
    schemaVersion: 1,
    classification: "bounded-joint-artifact-stat-technical-experiment",
    supportsGuideClaims: false,
    supportsArtifactRecommendations: false,
    supportsGamePerformanceClaims: false,
    supportsGlobalOptimality: false,
    supportsTechnicalObjectiveComparison: true,
    generatedFrom: [...input.generatedFrom].sort((a, b) =>
      compareText(a.path, b.path),
    ),
    sourceTeamRecordId: input.baseProbeInput.preflight.sourceTeamRecordId,
    comparisonStatus: allComparable ? "comparable" : "not-comparable",
    technicalObjectiveInputs: {
      unreviewedTechnicalFormulaPlan: {
        reviewStatus: "unreviewed",
        sourceBindingEstablishedByCore: false,
        lines: input.unreviewedTechnicalFormulaLines.map((line) => ({
          ...line,
        })),
        sha256: sha256Text(stableJson(input.unreviewedTechnicalFormulaLines)),
      },
      calcContext: { ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT },
      combatOptions: {},
      enemyAura: null,
      extraBuffs: [],
      explicitFormulaBuffOverrides: null,
      sharedCharacterConfigs:
        input.baseProbeInput.formulaDraft.assumptions.characters.map(
          (character) => ({
            characterId: character.characterId,
            charLevel: character.charLevel,
            constellation: character.constellation,
            selectedWeaponId: character.selectedWeaponId,
            refinement: character.refinement,
            talentLevels: { ...character.talentLevels },
          }),
        ),
    },
    execution: {
      scheduling: "sequential",
      plannedGeneratorInvocations: 16,
      observedGeneratorInvocations,
      maximumGeneratorConcurrency,
      freshTeamBuildPerInvocation: true,
      warmStartSupported: false,
      energyRecoveryThresholdsUsed: false,
      perCharacterConstraintsPassed: false,
      explicitGeneratorBuffOverridesPassed: false,
      explicitFormulaBuffOverridesPassedToReplay: false,
      calcContext: { ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT },
      candidateIds: [...input.candidateIds],
      carryCharacterIds: [...input.carryCharacterIds],
    },
    latticeBoundary: {
      nodeLocalSheetPoolsOnly: true,
      crossNodeSheetCompositionsAllowed: false,
      candidateNodeCount: 4,
      totalExpectedCompositions: expectedCounts.every(
        (count): count is number => count != null,
      )
        ? expectedCounts.reduce((sum, count) => sum + (count ?? 0), 0)
        : null,
      totalObservedCompositions: nodes.reduce(
        (sum, node) => sum + node.observedCartesianCompositionCount,
        0,
      ),
    },
    nodes,
    boundedReferenceComposition: globalReference,
    cautions: [
      "The four nodes interpolate independently recorded character builds; no source binds a complete node assignment to this exact team.",
      "The supplied technical formula lines are unreviewed; this generic experiment does not itself establish their source binding, rotation order, buff timing, or field time.",
      "The bounded reference is only the maximum observed technical objective inside these four set nodes and their node-local carry-derived sheet pools.",
      "No cross-node sheet recombination, weapon choice, constellation choice, ER target, gameplay claim, or guide recommendation is evaluated.",
      "Exact sheet dumps are intentionally not retained; reproduction reruns all 16 generator calls and verifies the retained artifact, sheet, and team-config fingerprints before evaluating the node-local lattice.",
    ],
  };
}

async function buildNodeObservation(
  candidate: ArtifactGenerationTechnicalCandidate,
  characterIds: string[],
  carryCharacterIds: [string, string, string, string],
  captures: CapturedRun[],
  failures: RunFailure[],
  replayLines: ReplayComboLine[],
  environment: BoundedJointArtifactExperimentEnvironment,
): Promise<BoundedJointArtifactNodeObservation> {
  const carryRuns: BoundedJointArtifactNodeObservation["carryRuns"] = [
    ...captures.map((capture) => ({
      carryCharacterId: capture.carryCharacterId,
      outcome: "captured" as const,
      artifactFingerprintSha256: capture.artifactFingerprintSha256,
      sheetFingerprintsByCharacter: sortTextRecord(
        capture.sheetFingerprintsByCharacter,
      ),
    })),
    ...failures.map((failure) => ({
      ...failure,
      outcome: "not-comparable" as const,
    })),
  ].sort((a, b) =>
    carryCharacterIds.indexOf(a.carryCharacterId) -
    carryCharacterIds.indexOf(b.carryCharacterId),
  );
  const pools = buildNodeLocalPools(candidate.candidateId, characterIds, captures);
  const nodeFailures = validateCapturedTeamConfigs(candidate.candidateId, captures);
  const capturedTeamConfigSha256 =
    captures.length === carryCharacterIds.length && nodeFailures.length === 0
      ? sha256Text(stableJson(captures[0].teamConfigs))
      : null;
  const technicalTeamConfigs =
    capturedTeamConfigSha256 == null
      ? null
      : requireFourConfigs(captures[0].teamConfigs);
  const publicPools = Object.fromEntries(
    characterIds.map((characterId) => [
      characterId,
      (pools[characterId] ?? []).map(
        ({ entries: _entries, characterId: _characterId, ...cell }) => cell,
      ),
    ]),
  );
  const poolSizesByCharacter = Object.fromEntries(
    characterIds.map((characterId) => [
      characterId,
      pools[characterId]?.length ?? 0,
    ]),
  );
  const base = {
    nodeId: candidate.candidateId,
    requestedArtifactSetIdsByCharacter: sortTextRecord(
      candidate.artifactSetIdsByCharacter,
    ),
    sourceBuildIdsByCharacter: sourceBuildIds(candidate),
    carryRuns,
    nodeFailures,
    technicalTeamConfigs,
    capturedTeamConfigSha256,
    sheetPoolsByCharacter: publicPools,
    poolSizesByCharacter,
  };
  if (
    failures.length > 0 ||
    nodeFailures.length > 0 ||
    captures.length !== carryCharacterIds.length
  ) {
    return {
      ...base,
      comparisonStatus: "not-comparable",
      expectedCartesianCompositionCount: null,
      observedCartesianCompositionCount: 0,
      intactCarryCoverage: carryCharacterIds.map((carryCharacterId) => ({
        carryCharacterId,
        compositionId: null,
      })),
      compositions: [],
      boundedReferenceComposition: null,
      bestIntactCarryComposition: null,
      boundedReferenceOverBestIntact: null,
      boundedReferenceOverBestIntactStatus: "not-comparable",
    };
  }

  const expectedCount = characterIds.reduce(
    (product, characterId) => product * pools[characterId].length,
    1,
  );
  const selections = enumerateCartesian(characterIds, pools);
  if (selections.length !== expectedCount) {
    throw new Error(
      `${candidate.candidateId}: Cartesian enumeration produced ${selections.length}, expected ${expectedCount}.`,
    );
  }
  const firstCapture = captures[0];
  const compositions: BoundedJointArtifactCompositionObservation[] = [];
  for (const [index, selected] of selections.entries()) {
    const compositionId = `${candidate.candidateId}:composition-${String(index + 1).padStart(2, "0")}`;
    const intactCarryCharacterIds = carryCharacterIds.filter((carryId) =>
      characterIds.every((characterId) =>
        selected[characterId].originCarryCharacterIds.includes(carryId),
      ),
    );
    try {
      const output = await environment.replayTeamDamage({
        replayId: compositionId,
        evidence: {
          classification: "structural_smoke",
          supportsGuideClaims: false,
          notes: [
            "Unreviewed technical formula lines used as a bounded objective only.",
          ],
          sourceRefs: candidate.validationTargets.map((target) => {
            if (target.kind !== "repository-build") {
              throw new Error(
                `Bounded joint experiment requires repository-build validation targets; ${target.characterId} is ${target.kind}.`,
              );
            }
            return {
              kind: "knowledge_record" as const,
              recordId: target.characterGuideId,
              supports: ["artifact_stats" as const],
            };
          }),
        },
        teamConfigs: firstCapture.teamConfigs,
        combatOptions: {},
        enemyAura: null,
        extraBuffs: [],
        calcContext: {
          // Context is fixed by the technical runner; keeping it here avoids
          // accepting any per-character threshold extension.
          ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT,
        },
        combo: {
          id: "guide-factory-unreviewed-technical-formula-lines",
          label: {
            en: "Unreviewed formula lines (technical objective only)",
            zh: "未审核公式行（仅技术目标）",
          },
          lines: replayLines.map((line) => ({ ...line })),
        },
        artifactSheets: Object.fromEntries(
          characterIds.map((characterId) => [
            characterId,
            StatSheet.fromDump(selected[characterId].entries),
          ]),
        ),
        formulaBuffOverrides: null,
      });
      const agreement = output.validation.calculatorAgreement;
      compositions.push({
        compositionId,
        sheetsByCharacter: publicSelection(characterIds, selected),
        intactCarryCharacterIds,
        outcome: "evaluated",
        unreviewedTechnicalObjective: output.result.totalDamage,
        normalizedToBoundedReference: null,
        normalizedToBoundedReferenceStatus: "not-comparable",
        computedBuffOverrideLineCount: Object.keys(
          output.validation.computedBuffOverrides,
        ).length,
        computedBuffOverridesSha256: sha256Text(
          stableJson(output.validation.computedBuffOverrides),
        ),
        calculatorAgreement: {
          passed: true,
          interpretedObjective: agreement.directTotalDamage,
          compiledObjective: agreement.compiledTotalDamage,
          absoluteDifference: agreement.absoluteDifference,
          allowedDifference: agreement.allowedDifference,
        },
        failure: null,
      });
    } catch (error) {
      compositions.push({
        compositionId,
        sheetsByCharacter: publicSelection(characterIds, selected),
        intactCarryCharacterIds,
        outcome: "evaluation-failed",
        unreviewedTechnicalObjective: null,
        normalizedToBoundedReference: null,
        normalizedToBoundedReferenceStatus: "not-comparable",
        computedBuffOverrideLineCount: null,
        computedBuffOverridesSha256: null,
        calculatorAgreement: null,
        failure: serializeError(error),
      });
    }
  }

  const evaluationFailed = compositions.some(
    ({ outcome }) => outcome === "evaluation-failed",
  );
  const intactCarryCoverage = carryCharacterIds.map((carryCharacterId) => ({
    carryCharacterId,
    compositionId:
      compositions.find(({ intactCarryCharacterIds }) =>
        intactCarryCharacterIds.includes(carryCharacterId),
      )?.compositionId ?? null,
  }));
  if (
    evaluationFailed ||
    intactCarryCoverage.some(({ compositionId }) => compositionId == null)
  ) {
    return {
      ...base,
      comparisonStatus: "not-comparable",
      expectedCartesianCompositionCount: expectedCount,
      observedCartesianCompositionCount: compositions.length,
      intactCarryCoverage,
      compositions,
      boundedReferenceComposition: null,
      bestIntactCarryComposition: null,
      boundedReferenceOverBestIntact: null,
      boundedReferenceOverBestIntactStatus: "not-comparable",
    };
  }

  const evaluated = compositions.filter(
    (composition): composition is BoundedJointArtifactCompositionObservation & {
      outcome: "evaluated";
      unreviewedTechnicalObjective: number;
    } => composition.outcome === "evaluated",
  );
  const reference = maxByObjective(evaluated);
  const bestIntact = maxByObjective(
    evaluated.filter(
      ({ intactCarryCharacterIds }) => intactCarryCharacterIds.length > 0,
    ),
  );
  if (!reference || !bestIntact) {
    throw new Error(`${candidate.candidateId}: comparable node has no reference.`);
  }
  const referenceEquivalents = evaluated
    .filter(
      ({ unreviewedTechnicalObjective }) =>
        unreviewedTechnicalObjective === reference.unreviewedTechnicalObjective,
    )
    .map(({ compositionId }) => compositionId);
  const bestIntactEquivalents = evaluated
    .filter(
      ({ intactCarryCharacterIds, unreviewedTechnicalObjective }) =>
        intactCarryCharacterIds.length > 0 &&
        unreviewedTechnicalObjective === bestIntact.unreviewedTechnicalObjective,
    )
    .map(({ compositionId }) => compositionId);
  const referenceIsZero = reference.unreviewedTechnicalObjective === 0;
  for (const composition of compositions) {
    if (composition.unreviewedTechnicalObjective != null && !referenceIsZero) {
      composition.normalizedToBoundedReference = normalizeNumber(
        composition.unreviewedTechnicalObjective /
          reference.unreviewedTechnicalObjective,
      );
      composition.normalizedToBoundedReferenceStatus = "available";
    } else if (composition.unreviewedTechnicalObjective != null) {
      composition.normalizedToBoundedReference = null;
      composition.normalizedToBoundedReferenceStatus =
        "undefined-zero-reference";
    }
  }
  const bestIntactIsZero = bestIntact.unreviewedTechnicalObjective === 0;
  return {
    ...base,
    comparisonStatus: "comparable",
    expectedCartesianCompositionCount: expectedCount,
    observedCartesianCompositionCount: compositions.length,
    intactCarryCoverage,
    compositions,
    boundedReferenceComposition: {
      compositionId: reference.compositionId,
      unreviewedTechnicalObjective: reference.unreviewedTechnicalObjective,
      equivalentCompositionIds: referenceEquivalents,
      representativeSelectionPolicy: "first-enumerated-exact-objective-tie",
    },
    bestIntactCarryComposition: {
      compositionId: bestIntact.compositionId,
      unreviewedTechnicalObjective: bestIntact.unreviewedTechnicalObjective,
      equivalentCompositionIds: bestIntactEquivalents,
      representativeSelectionPolicy: "first-enumerated-exact-objective-tie",
    },
    boundedReferenceOverBestIntact: bestIntactIsZero
      ? null
      : normalizeNumber(
          reference.unreviewedTechnicalObjective /
            bestIntact.unreviewedTechnicalObjective,
        ),
    boundedReferenceOverBestIntactStatus: bestIntactIsZero
      ? "undefined-zero-best-intact"
      : "available",
  };
}

function validateAndResolveInput(
  input: BoundedJointArtifactExperimentInput,
): ArtifactGenerationTechnicalCandidate[] {
  if (
    new Set(input.candidateIds).size !== 4 ||
    new Set(input.carryCharacterIds).size !== 4 ||
    input.unreviewedTechnicalFormulaLines.length === 0
  ) {
    throw new Error(
      "Bounded joint experiment requires four distinct candidates, four distinct carries, and exact formula lines.",
    );
  }
  const byId = new Map(
    input.baseProbeInput.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const teamCharacterIds = new Set(
    input.baseProbeInput.formulaDraft.assumptions.characters.map(
      ({ characterId }) => characterId,
    ),
  );
  if (
    teamCharacterIds.size !== 4 ||
    input.carryCharacterIds.some(
      (characterId) => !teamCharacterIds.has(characterId),
    )
  ) {
    throw new Error(
      "Bounded joint experiment carries must exactly cover the four fixture characters.",
    );
  }
  return input.candidateIds.map((candidateId) => {
    const candidate = byId.get(candidateId);
    if (!candidate || candidate.classification === "repository-build-negative-control") {
      throw new Error(
        `Bounded joint experiment candidate ${candidateId} is missing or is a negative control.`,
      );
    }
    sourceBuildIds(candidate);
    return candidate;
  });
}

function sourceBuildIds(
  candidate: ArtifactGenerationTechnicalCandidate,
): Record<string, string> {
  return sortTextRecord(
    Object.fromEntries(
      candidate.validationTargets.map((target) => {
        if (target.kind !== "repository-build") {
          throw new Error(
            `Bounded joint experiment requires repository-build validation targets; ${target.characterId} is ${target.kind}.`,
          );
        }
        return [target.characterId, target.buildSourceRecordId];
      }),
    ),
  );
}

function validateTechnicalFormulaLines(
  lines: FormulaPlanDraftLine[],
  characterIds: string[],
): void {
  const teamCharacters = new Set(characterIds);
  const coveredCharacters = new Set<string>();
  const formulaKeys = new Set<string>();
  for (const line of lines) {
    if (!teamCharacters.has(line.characterId)) {
      throw new Error(
        `Exact formula line ${line.characterId}.${line.formulaId} is outside the fixture team.`,
      );
    }
    if (!line.formulaId.trim()) {
      throw new Error("Exact formula lines require non-empty formula IDs.");
    }
    const key = `${line.characterId}\0${line.formulaId}`;
    if (formulaKeys.has(key)) {
      throw new Error(
        `Exact formula line ${line.characterId}.${line.formulaId} is duplicated.`,
      );
    }
    formulaKeys.add(key);
    coveredCharacters.add(line.characterId);
  }
  const missingCharacters = characterIds.filter(
    (characterId) => !coveredCharacters.has(characterId),
  );
  if (missingCharacters.length > 0) {
    throw new Error(
      `Exact formula lines do not cover fixture characters: ${missingCharacters.join(", ")}.`,
    );
  }
}

function withExactFormulaLines(
  input: ArtifactGenerationTechnicalProbeInput,
  lines: FormulaPlanDraftLine[],
): ArtifactGenerationTechnicalProbeInput {
  return {
    ...input,
    formulaDraft: {
      ...input.formulaDraft,
      lines: lines.map((line) => ({ ...line })),
    },
  };
}

function toReplayLines(lines: FormulaPlanDraftLine[]): ReplayComboLine[] {
  return lines.map((line) => {
    if (!Number.isFinite(line.count) || line.count <= 0) {
      throw new Error(
        `Exact formula line ${line.characterId}.${line.formulaId} requires a positive finite count.`,
      );
    }
    return {
      charId: line.characterId,
      formulaId: line.formulaId,
      count: line.count,
      reaction: null,
      forceOnField: false,
    };
  });
}

function buildNodeLocalPools(
  nodeId: string,
  characterIds: string[],
  captures: CapturedRun[],
): Record<string, PoolCell[]> {
  return Object.fromEntries(
    characterIds.map((characterId) => {
      const byCanonical = new Map<string, PoolCell>();
      for (const capture of captures) {
        const entries = canonicalSheetDump(capture.sheetsByCharacter[characterId]);
        const canonical = stableJson(entries);
        const existing = byCanonical.get(canonical);
        if (existing) {
          existing.originCarryCharacterIds.push(capture.carryCharacterId);
        } else {
          byCanonical.set(canonical, {
            nodeId,
            characterId,
            sheetId: sha256Text(canonical),
            originCarryCharacterIds: [capture.carryCharacterId],
            entries,
          });
        }
      }
      return [characterId, [...byCanonical.values()]];
    }),
  );
}

function validateCapturedTeamConfigs(
  nodeId: string,
  captures: CapturedRun[],
): NodeFailure[] {
  const first = captures[0];
  if (!first) return [];
  const expected = stableJson(first.teamConfigs);
  return captures.slice(1).flatMap((capture) =>
    stableJson(capture.teamConfigs) === expected
      ? []
      : [
          {
            code: "team-config-mismatch" as const,
            stage: "capture" as const,
            name: "JointExperimentCaptureError" as const,
            message: `${nodeId}/${capture.carryCharacterId} captured team configs that differ from ${first.carryCharacterId}; the node was not replayed.`,
          },
        ],
  );
}

function enumerateCartesian(
  characterIds: string[],
  pools: Record<string, PoolCell[]>,
): Array<Record<string, PoolCell>> {
  let selections: Array<Record<string, PoolCell>> = [{}];
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

function publicSelection(
  characterIds: string[],
  selected: Record<string, PoolCell>,
): BoundedJointArtifactCompositionObservation["sheetsByCharacter"] {
  return Object.fromEntries(
    characterIds.map((characterId) => {
      const { entries: _entries, characterId: _characterId, ...cell } =
        selected[characterId];
      return [characterId, cell];
    }),
  );
}

function canonicalSheetDump(sheet: StatSheet): SheetDumpEntry[] {
  if (!(sheet instanceof StatSheet)) {
    throw new Error("Generator capture is missing a StatSheet.");
  }
  return [...sheet.dump()]
    .map((entry) => ({ ...entry }))
    .sort(
      (a, b) =>
        compareText(a.key, b.key) ||
        compareText(a.filterKey, b.filterKey) ||
        a.value - b.value,
    );
}

function fingerprintSheet(sheet: StatSheet): string {
  return sha256Text(stableJson(canonicalSheetDump(sheet)));
}

function requireFourConfigs(
  configs: readonly TeamSlotConfig[],
): ReplayTeamConfigs {
  if (configs.length !== 4) {
    throw new Error(`Joint experiment expected four team configs, found ${configs.length}.`);
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
          ? { ...config.artifactSet, halfSetIds: [...config.artifactSet.halfSetIds] }
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

function sortTextRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => compareText(a, b)),
  );
}

function serializeError(error: unknown): { name: string; message: string } {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "Error", message: String(error) };
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Non-finite value ${value}.`);
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
