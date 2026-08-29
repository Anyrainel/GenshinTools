import { allSlots, type MainStat, type Slot, type SubStat } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import type { CalcContext } from "@/lib/dmgcalc/types";
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
import { sha256Text, stableJson } from "./io";

type GeneratorRunner = (
  options: GeneratorOptions,
) => AsyncIterable<GeneratorResult>;

export type ArtifactGenerationSensitivityProbeEnvironment = {
  runGenerator: GeneratorRunner;
};

export type ArtifactGenerationSensitivityProbeInput = {
  baseProbeInput: ArtifactGenerationTechnicalProbeInput;
  firstCandidateId: string;
  secondCandidateId: string;
  primaryCarryCharacterId: string;
  additionalCarryCharacterIds: [string, string, string];
  generatedFrom: Array<{ path: string; sha256: string }>;
};

type StructuralSlotSummary = {
  slot: Slot;
  setId: string;
  mainStat: MainStat;
  positiveSubstatKeys: SubStat[];
};

type StructuralCharacterSummary = {
  characterId: string;
  slots: StructuralSlotSummary[];
};

type CompletedRunObservation = {
  sequence: number;
  runId: string;
  scheduleId: string;
  candidateId: string;
  carryCharacterId: string;
  outcome: "captured-structurally";
  generatorInvoked: true;
  teamBuildFreshForInvocation: true;
  fingerprint: {
    algorithm: "sha256";
    canonicalScope: "complete-generated-artifact-records";
    sha256: string;
  };
  structuralSummary: StructuralCharacterSummary[];
};

type NotComparableRunObservation = {
  sequence: number;
  runId: string;
  scheduleId: string;
  candidateId: string;
  carryCharacterId: string;
  outcome: "not-comparable";
  generatorInvoked: boolean;
  teamBuildFreshForInvocation: boolean;
  failure:
    | ArtifactGenerationCandidateFailure
    | {
        code: "missing-captured-final-result";
        stage: "capture";
        name: "SensitivityCaptureError";
        message: string;
      };
};

export type ArtifactGenerationSensitivityRunObservation =
  | CompletedRunObservation
  | NotComparableRunObservation;

type FingerprintComparison = {
  candidateId: string;
  firstRunId: string;
  secondRunId: string;
  comparisonStatus: "comparable" | "not-comparable";
  fingerprintsEqual: boolean | null;
  structuralSummariesEqual: boolean | null;
  scheduleOrderSensitivityObserved: boolean | null;
  notComparableRunIds: string[];
};

export type ArtifactGenerationSensitivityProbeReport = {
  schemaVersion: 1;
  classification: "artifact-generation-carry-and-order-sensitivity-probe";
  supportsGuideClaims: false;
  supportsArtifactRecommendations: false;
  supportsRankClaims: false;
  supportsPerformanceComparison: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceTeamRecordId: string;
  provenance: {
    classification: "interpolation-from-independent-repository-builds";
    candidateBuildIdsByCharacter: Record<string, Record<string, string>>;
    exactTeamSourceBindsCandidateEquipment: false;
  };
  execution: {
    generatorApi: "runGenerator-via-artifact-generation-technical-probe";
    scheduling: "sequential";
    plannedGeneratorInvocations: 7;
    observedGeneratorInvocations: number;
    freshTeamBuildPerInvocation: true;
    energyRecoveryThresholdsUsed: false;
    perCharacterConstraintsPassed: false;
    formulaBuffOverridesPassed: false;
    numericalObjectiveRetained: false;
    calcContext: CalcContext;
    firstCandidateId: string;
    secondCandidateId: string;
    primaryCarryCharacterId: string;
    additionalCarryCharacterIds: [string, string, string];
    schedules: Array<{
      scheduleId: string;
      carryCharacterId: string;
      candidateOrder: string[];
    }>;
  };
  runs: ArtifactGenerationSensitivityRunObservation[];
  carrySensitivity: {
    candidateId: string;
    comparisonStatus: "comparable" | "not-comparable";
    cells: Array<{
      carryCharacterId: string;
      runId: string;
      outcome: ArtifactGenerationSensitivityRunObservation["outcome"];
      fingerprintSha256: string | null;
    }>;
    equivalenceClasses: Array<{
      classId: string;
      carryCharacterIds: string[];
      fingerprintSha256: string;
    }>;
    artifactOutputDifferenceObserved: boolean | null;
    structuralSummaryDifferenceObserved: boolean | null;
    structuralSummaryDifferencesFromPrimary: Array<{
      comparedCarryCharacterId: string;
      firstRunId: string;
      secondRunId: string;
      comparisonStatus: "comparable" | "not-comparable";
      changedSlots: Array<{
        characterId: string;
        slot: Slot;
        primary: {
          mainStat: MainStat;
          positiveSubstatKeys: SubStat[];
        };
        compared: {
          mainStat: MainStat;
          positiveSubstatKeys: SubStat[];
        };
      }>;
    }>;
    notComparableRunIds: string[];
  };
  candidateExecutionOrderSensitivity: {
    comparisonStatus: "comparable" | "not-comparable";
    comparisons: [FingerprintComparison, FingerprintComparison];
    scheduleOrderSensitivityObserved: boolean | null;
  };
  cautions: [
    "Both candidates interpolate independently recorded character builds; no source binds either full equipment assignment to the exact team.",
    "Carry sensitivity tests only the first candidate across four carry choices; execution-order sensitivity tests the first and second candidates at the primary carry, not within-run character or configuration order.",
    "The formula-count translation remains unreviewed, so carry-dependent structures do not establish character roles, correct play, or equipment suitability.",
    "Fingerprint equality means only that complete generated artifact records matched; inequality identifies structure to review, not a better result.",
    "Main stats and positive substat keys are explanatory observations; an ER key does not establish an energy requirement or rotation feasibility.",
    "Fresh TeamBuild construction isolates candidate scheduling from shared build state, but it does not model an iterative joint equipment optimizer.",
  ];
  prohibitedInterpretations: [
    "guide-claim",
    "artifact-recommendation",
    "stat-recommendation",
    "performance-comparison",
    "candidate-ranking",
    "energy-requirement",
  ];
};

type SchedulePlan = {
  scheduleId: string;
  carryCharacterId: string;
  candidates: ArtifactGenerationTechnicalCandidate[];
};

type Capture = {
  finalResult: GeneratorResult | null;
};

const DEFAULT_ENVIRONMENT: ArtifactGenerationSensitivityProbeEnvironment = {
  runGenerator,
};

/**
 * Probe two structural properties of the ordered greedy artifact generator:
 * carry choice and candidate execution order. The final artifacts exist only
 * long enough to derive a canonical hash and an explainable stat-key summary.
 */
export async function runArtifactGenerationSensitivityProbe(
  input: ArtifactGenerationSensitivityProbeInput,
  environment: ArtifactGenerationSensitivityProbeEnvironment = DEFAULT_ENVIRONMENT,
): Promise<ArtifactGenerationSensitivityProbeReport> {
  const { firstCandidate, secondCandidate, carryCharacterIds } =
    validateAndResolveInput(input);
  const schedules: SchedulePlan[] = [
    {
      scheduleId: "forward-a-then-b-primary-carry",
      carryCharacterId: input.primaryCarryCharacterId,
      candidates: [firstCandidate, secondCandidate],
    },
    {
      scheduleId: "reverse-b-then-a-primary-carry",
      carryCharacterId: input.primaryCarryCharacterId,
      candidates: [secondCandidate, firstCandidate],
    },
    ...input.additionalCarryCharacterIds.map(
      (carryCharacterId): SchedulePlan => ({
        scheduleId: `singleton-a-carry-${carryCharacterId}`,
        carryCharacterId,
        candidates: [firstCandidate],
      }),
    ),
  ];

  const runs: ArtifactGenerationSensitivityRunObservation[] = [];
  for (const schedule of schedules) {
    const scheduleRuns = await executeSchedule(
      input.baseProbeInput,
      schedule,
      environment,
      runs.length,
    );
    runs.push(...scheduleRuns);
  }

  const forwardA = requireRun(
    runs,
    "forward-a-then-b-primary-carry",
    firstCandidate.candidateId,
  );
  const forwardB = requireRun(
    runs,
    "forward-a-then-b-primary-carry",
    secondCandidate.candidateId,
  );
  const reverseB = requireRun(
    runs,
    "reverse-b-then-a-primary-carry",
    secondCandidate.candidateId,
  );
  const reverseA = requireRun(
    runs,
    "reverse-b-then-a-primary-carry",
    firstCandidate.candidateId,
  );
  const carryRuns = [
    forwardA,
    ...input.additionalCarryCharacterIds.map((carryCharacterId) =>
      requireRun(
        runs,
        `singleton-a-carry-${carryCharacterId}`,
        firstCandidate.candidateId,
      ),
    ),
  ];
  const orderComparisons: [FingerprintComparison, FingerprintComparison] = [
    compareRuns(firstCandidate.candidateId, forwardA, reverseA),
    compareRuns(secondCandidate.candidateId, forwardB, reverseB),
  ];

  return {
    schemaVersion: 1,
    classification: "artifact-generation-carry-and-order-sensitivity-probe",
    supportsGuideClaims: false,
    supportsArtifactRecommendations: false,
    supportsRankClaims: false,
    supportsPerformanceComparison: false,
    generatedFrom: input.generatedFrom
      .map((source) => ({ ...source }))
      .sort((left, right) => compareText(left.path, right.path)),
    sourceTeamRecordId: input.baseProbeInput.preflight.sourceTeamRecordId,
    provenance: {
      classification: "interpolation-from-independent-repository-builds",
      candidateBuildIdsByCharacter: Object.fromEntries(
        [firstCandidate, secondCandidate].map((candidate) => [
          candidate.candidateId,
          sourceBuildIds(candidate),
        ]),
      ),
      exactTeamSourceBindsCandidateEquipment: false,
    },
    execution: {
      generatorApi: "runGenerator-via-artifact-generation-technical-probe",
      scheduling: "sequential",
      plannedGeneratorInvocations: 7,
      observedGeneratorInvocations: runs.filter(
        ({ generatorInvoked }) => generatorInvoked,
      ).length,
      freshTeamBuildPerInvocation: true,
      energyRecoveryThresholdsUsed: false,
      perCharacterConstraintsPassed: false,
      formulaBuffOverridesPassed: false,
      numericalObjectiveRetained: false,
      calcContext: { ...ARTIFACT_GENERATION_TECHNICAL_PROBE_CONTEXT },
      firstCandidateId: firstCandidate.candidateId,
      secondCandidateId: secondCandidate.candidateId,
      primaryCarryCharacterId: input.primaryCarryCharacterId,
      additionalCarryCharacterIds: [...input.additionalCarryCharacterIds],
      schedules: schedules.map((schedule) => ({
        scheduleId: schedule.scheduleId,
        carryCharacterId: schedule.carryCharacterId,
        candidateOrder: schedule.candidates.map(
          ({ candidateId }) => candidateId,
        ),
      })),
    },
    runs,
    carrySensitivity: summarizeCarrySensitivity(
      firstCandidate.candidateId,
      carryCharacterIds,
      carryRuns,
    ),
    candidateExecutionOrderSensitivity: {
      comparisonStatus: orderComparisons.every(
        ({ comparisonStatus }) => comparisonStatus === "comparable",
      )
        ? "comparable"
        : "not-comparable",
      comparisons: orderComparisons,
      scheduleOrderSensitivityObserved: orderComparisons.every(
        ({ comparisonStatus }) => comparisonStatus === "comparable",
      )
        ? orderComparisons.some(
            ({ scheduleOrderSensitivityObserved }) =>
              scheduleOrderSensitivityObserved,
          )
        : null,
    },
    cautions: [
      "Both candidates interpolate independently recorded character builds; no source binds either full equipment assignment to the exact team.",
      "Carry sensitivity tests only the first candidate across four carry choices; execution-order sensitivity tests the first and second candidates at the primary carry, not within-run character or configuration order.",
      "The formula-count translation remains unreviewed, so carry-dependent structures do not establish character roles, correct play, or equipment suitability.",
      "Fingerprint equality means only that complete generated artifact records matched; inequality identifies structure to review, not a better result.",
      "Main stats and positive substat keys are explanatory observations; an ER key does not establish an energy requirement or rotation feasibility.",
      "Fresh TeamBuild construction isolates candidate scheduling from shared build state, but it does not model an iterative joint equipment optimizer.",
    ],
    prohibitedInterpretations: [
      "guide-claim",
      "artifact-recommendation",
      "stat-recommendation",
      "performance-comparison",
      "candidate-ranking",
      "energy-requirement",
    ],
  };
}

async function executeSchedule(
  baseInput: ArtifactGenerationTechnicalProbeInput,
  schedule: SchedulePlan,
  environment: ArtifactGenerationSensitivityProbeEnvironment,
  sequenceOffset: number,
): Promise<ArtifactGenerationSensitivityRunObservation[]> {
  const captures: Capture[] = [];
  const technicalReport = await runArtifactGenerationTechnicalProbe(
    {
      ...baseInput,
      carryCharacterId: schedule.carryCharacterId,
      candidates: schedule.candidates.map(cloneCandidate),
      generatedFrom: [],
    },
    {
      runGenerator: (options) => {
        const capture: Capture = {
          finalResult: null,
        };
        captures.push(capture);
        return captureFinalResult(options, environment.runGenerator, capture);
      },
    },
  );

  let captureIndex = 0;
  return technicalReport.candidates.map((candidate, index) => {
    const capture = candidate.generatorInvoked
      ? captures[captureIndex++]
      : undefined;
    const runId = `${schedule.scheduleId}:${candidate.candidateId}`;
    const base = {
      sequence: sequenceOffset + index,
      runId,
      scheduleId: schedule.scheduleId,
      candidateId: candidate.candidateId,
      carryCharacterId: schedule.carryCharacterId,
    };

    if (
      candidate.outcome !== "completed-structurally" ||
      !capture?.finalResult
    ) {
      return {
        ...base,
        outcome: "not-comparable" as const,
        generatorInvoked: candidate.generatorInvoked,
        teamBuildFreshForInvocation: capture != null,
        failure:
          candidate.outcome === "completed-structurally"
            ? {
                code: "missing-captured-final-result" as const,
                stage: "capture" as const,
                name: "SensitivityCaptureError" as const,
                message: `Run ${runId} completed without a captured final artifact result.`,
              }
            : { ...candidate.failure },
      };
    }

    return {
      ...base,
      outcome: "captured-structurally" as const,
      generatorInvoked: true as const,
      teamBuildFreshForInvocation: true as const,
      fingerprint: {
        algorithm: "sha256" as const,
        canonicalScope: "complete-generated-artifact-records" as const,
        sha256: fingerprintGeneratedArtifacts(
          capture.finalResult.artifactsByChar,
        ),
      },
      structuralSummary: summarizeArtifacts(
        capture.finalResult.artifactsByChar,
      ),
    };
  });
}

async function* captureFinalResult(
  options: GeneratorOptions,
  runner: GeneratorRunner,
  capture: Capture,
): AsyncGenerator<GeneratorResult, void> {
  for await (const result of runner(options)) {
    if (result.done) capture.finalResult = result;
    yield result;
  }
}

function validateAndResolveInput(input: ArtifactGenerationSensitivityProbeInput): {
  firstCandidate: ArtifactGenerationTechnicalCandidate;
  secondCandidate: ArtifactGenerationTechnicalCandidate;
  carryCharacterIds: string[];
} {
  if (input.firstCandidateId === input.secondCandidateId) {
    throw new Error("Artifact sensitivity probe requires two distinct candidates.");
  }
  const candidates = new Map(
    input.baseProbeInput.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const firstCandidate = candidates.get(input.firstCandidateId);
  const secondCandidate = candidates.get(input.secondCandidateId);
  if (!firstCandidate || !secondCandidate) {
    throw new Error(
      "Artifact sensitivity probe candidate IDs must exist in the technical-probe input.",
    );
  }
  if (
    firstCandidate.classification === "repository-build-negative-control" ||
    secondCandidate.classification === "repository-build-negative-control"
  ) {
    throw new Error(
      "Artifact sensitivity probe does not admit negative-control candidates.",
    );
  }
  const carryCharacterIds = [
    input.primaryCarryCharacterId,
    ...input.additionalCarryCharacterIds,
  ];
  const teamCharacterIds = new Set(
    input.baseProbeInput.formulaDraft.assumptions.characters.map(
      ({ characterId }) => characterId,
    ),
  );
  if (
    new Set(carryCharacterIds).size !== 4 ||
    carryCharacterIds.some((characterId) => !teamCharacterIds.has(characterId))
  ) {
    throw new Error(
      "Artifact sensitivity probe requires four distinct carry cells matching the fixture team.",
    );
  }
  return { firstCandidate, secondCandidate, carryCharacterIds };
}

/** @internal Exported so completeness can be regression-tested. */
export function fingerprintGeneratedArtifacts(
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>,
): string {
  return sha256Text(stableJson(artifactsByChar));
}

function summarizeArtifacts(
  artifactsByChar: Record<string, Record<Slot, ArtifactData>>,
): StructuralCharacterSummary[] {
  return Object.keys(artifactsByChar)
    .sort(compareText)
    .map((characterId) => ({
      characterId,
      slots: allSlots.map((slot) => {
        const artifact = artifactsByChar[characterId][slot];
        return {
          slot,
          setId: artifact.setKey,
          mainStat: artifact.mainStatKey,
          positiveSubstatKeys: Object.entries(artifact.substats)
            .filter(([, value]) => typeof value === "number" && value > 0)
            .map(([key]) => key as SubStat)
            .sort(compareText),
        };
      }),
    }));
}

function summarizeCarrySensitivity(
  candidateId: string,
  carryCharacterIds: string[],
  runs: ArtifactGenerationSensitivityRunObservation[],
): ArtifactGenerationSensitivityProbeReport["carrySensitivity"] {
  const notComparableRunIds = runs
    .filter(({ outcome }) => outcome === "not-comparable")
    .map(({ runId }) => runId);
  const cells = runs.map((run, index) => ({
    carryCharacterId: carryCharacterIds[index],
    runId: run.runId,
    outcome: run.outcome,
    fingerprintSha256:
      run.outcome === "captured-structurally"
        ? run.fingerprint.sha256
        : null,
  }));
  if (notComparableRunIds.length > 0) {
    return {
      candidateId,
      comparisonStatus: "not-comparable",
      cells,
      equivalenceClasses: [],
      artifactOutputDifferenceObserved: null,
      structuralSummaryDifferenceObserved: null,
      structuralSummaryDifferencesFromPrimary:
        compareCarryStructuralSummaries(carryCharacterIds, runs),
      notComparableRunIds,
    };
  }

  const classes = new Map<string, string[]>();
  for (const [index, run] of runs.entries()) {
    if (run.outcome !== "captured-structurally") continue;
    const existing = classes.get(run.fingerprint.sha256) ?? [];
    existing.push(carryCharacterIds[index]);
    classes.set(run.fingerprint.sha256, existing);
  }
  return {
    candidateId,
    comparisonStatus: "comparable",
    cells,
    equivalenceClasses: [...classes.entries()].map(
      ([fingerprintSha256, groupedCarryIds], index) => ({
        classId: `carry-equivalence-${index + 1}`,
        carryCharacterIds: groupedCarryIds,
        fingerprintSha256,
      }),
    ),
    artifactOutputDifferenceObserved: classes.size > 1,
    structuralSummaryDifferenceObserved:
      new Set(
        runs.flatMap((run) =>
          run.outcome === "captured-structurally"
            ? [stableJson(run.structuralSummary)]
            : [],
        ),
      ).size > 1,
    structuralSummaryDifferencesFromPrimary:
      compareCarryStructuralSummaries(carryCharacterIds, runs),
    notComparableRunIds: [],
  };
}

function compareCarryStructuralSummaries(
  carryCharacterIds: string[],
  runs: ArtifactGenerationSensitivityRunObservation[],
): ArtifactGenerationSensitivityProbeReport["carrySensitivity"]["structuralSummaryDifferencesFromPrimary"] {
  const primary = runs[0];
  return runs.slice(1).map((compared, index) => {
    const base = {
      comparedCarryCharacterId: carryCharacterIds[index + 1],
      firstRunId: primary.runId,
      secondRunId: compared.runId,
    };
    if (
      primary.outcome !== "captured-structurally" ||
      compared.outcome !== "captured-structurally"
    ) {
      return {
        ...base,
        comparisonStatus: "not-comparable" as const,
        changedSlots: [],
      };
    }
    const primaryByCharacter = new Map(
      primary.structuralSummary.map((character) => [
        character.characterId,
        character,
      ]),
    );
    const changedSlots = compared.structuralSummary.flatMap((character) => {
      const primaryCharacter = primaryByCharacter.get(character.characterId);
      if (!primaryCharacter) return [];
      const primaryBySlot = new Map(
        primaryCharacter.slots.map((slot) => [slot.slot, slot]),
      );
      return character.slots.flatMap((slot) => {
        const primarySlot = primaryBySlot.get(slot.slot);
        if (
          !primarySlot ||
          (primarySlot.setId === slot.setId &&
            primarySlot.mainStat === slot.mainStat &&
            stableJson(primarySlot.positiveSubstatKeys) ===
              stableJson(slot.positiveSubstatKeys))
        ) {
          return [];
        }
        return [
          {
            characterId: character.characterId,
            slot: slot.slot,
            primary: {
              mainStat: primarySlot.mainStat,
              positiveSubstatKeys: [...primarySlot.positiveSubstatKeys],
            },
            compared: {
              mainStat: slot.mainStat,
              positiveSubstatKeys: [...slot.positiveSubstatKeys],
            },
          },
        ];
      });
    });
    return {
      ...base,
      comparisonStatus: "comparable" as const,
      changedSlots,
    };
  });
}

function compareRuns(
  candidateId: string,
  first: ArtifactGenerationSensitivityRunObservation,
  second: ArtifactGenerationSensitivityRunObservation,
): FingerprintComparison {
  if (
    first.outcome !== "captured-structurally" ||
    second.outcome !== "captured-structurally"
  ) {
    return {
      candidateId,
      firstRunId: first.runId,
      secondRunId: second.runId,
      comparisonStatus: "not-comparable",
      fingerprintsEqual: null,
      structuralSummariesEqual: null,
      scheduleOrderSensitivityObserved: null,
      notComparableRunIds: [first, second]
        .filter(({ outcome }) => outcome === "not-comparable")
        .map(({ runId }) => runId),
    };
  }
  const fingerprintsEqual =
    first.fingerprint.sha256 === second.fingerprint.sha256;
  const structuralSummariesEqual =
    stableJson(first.structuralSummary) === stableJson(second.structuralSummary);
  return {
    candidateId,
    firstRunId: first.runId,
    secondRunId: second.runId,
    comparisonStatus: "comparable",
    fingerprintsEqual,
    structuralSummariesEqual,
    scheduleOrderSensitivityObserved:
      !fingerprintsEqual || !structuralSummariesEqual,
    notComparableRunIds: [],
  };
}

function requireRun(
  runs: ArtifactGenerationSensitivityRunObservation[],
  scheduleId: string,
  candidateId: string,
): ArtifactGenerationSensitivityRunObservation {
  const matches = runs.filter(
    (run) => run.scheduleId === scheduleId && run.candidateId === candidateId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Artifact sensitivity probe expected one ${scheduleId}/${candidateId} run, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function sourceBuildIds(
  candidate: ArtifactGenerationTechnicalCandidate,
): Record<string, string> {
  return Object.fromEntries(
    candidate.validationTargets
      .map((target) => [target.characterId, target.buildSourceRecordId])
      .sort(([left], [right]) => compareText(left, right)),
  );
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
