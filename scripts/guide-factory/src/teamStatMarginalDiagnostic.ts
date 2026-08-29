import type { Element, StatKey, SubStat } from "@/data/enums";
import { AVG_SUBSTAT_ROLL } from "@/lib/artifact/scoring/constants";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import type {
  BuffActivationMap,
  CalcContext,
  ExtraBuff,
  OptionMap,
} from "@/lib/dmgcalc/types";
import {
  replayTeamDamage,
  type DamageReplayInput,
  type DamageReplayOutput,
  type ReplayCombo,
  type ReplayEvidence,
  type ReplayTeamConfigs,
} from "./computationReplay";
import { sha256Text, stableJson } from "./io";

export const TEAM_STAT_MARGINAL_NON_ER_STATS = [
  "cr",
  "cd",
  "atk%",
  "hp%",
  "def%",
  "em",
  "atk",
  "hp",
  "def",
] as const satisfies readonly SubStat[];

export type TeamStatMarginalNonErStat =
  (typeof TEAM_STAT_MARGINAL_NON_ER_STATS)[number];

export type TeamStatMarginalZeroTolerance = {
  absolute: number;
  relative: number;
};

export type TeamStatMarginalEndpointInput = {
  endpointId: string;
  originId: string;
  /**
   * Opaque caller provenance fingerprint (for example, synthesized artifacts).
   * The core validates lowercase SHA-256 syntax only because it does not receive
   * the caller's source object. Team-config and sheet fingerprints are separate
   * and are recomputed by this module.
   */
  captureFingerprintSha256: string;
  teamConfigsFingerprintSha256: string;
  sheetFingerprintsByCharacter: Record<string, string>;
  teamConfigs: ReplayTeamConfigs;
  artifactSheets: Record<string, StatSheet>;
};

export type TeamStatMarginalDiagnosticInput = {
  diagnosticId: string;
  generatedFrom: Array<{ path: string; sha256: string }>;
  evidence: ReplayEvidence;
  objective: {
    combatOptions: OptionMap;
    enemyAura: Element | null;
    extraBuffs: ExtraBuff[];
    calcContext: CalcContext;
    combo: ReplayCombo;
    formulaBuffOverrides: Record<string, BuffActivationMap> | null;
  };
  zeroTolerance: TeamStatMarginalZeroTolerance;
  endpoints: TeamStatMarginalEndpointInput[];
};

type ReplayRunner = (input: DamageReplayInput) => Promise<DamageReplayOutput>;

export type TeamStatMarginalDiagnosticEnvironment = {
  replayTeamDamage: ReplayRunner;
};

export type TeamStatMarginalSign = "positive" | "zero" | "negative";

export type TeamStatMarginalDiagnosticFailure = {
  code:
    | "invalid-capture-fingerprint"
    | "invalid-team-config-shape"
    | "team-config-fingerprint-mismatch"
    | "artifact-sheet-character-mismatch"
    | "invalid-artifact-sheet"
    | "sheet-fingerprint-character-mismatch"
    | "sheet-fingerprint-mismatch"
    | "cross-endpoint-team-config-mismatch"
    | "evaluation-withheld-due-to-capture-failure"
    | "replay-failed"
    | "replay-output-invalid";
  stage: "capture-validation" | "baseline-replay" | "marginal-replay";
  endpointId: string;
  characterId: string | null;
  stat: TeamStatMarginalNonErStat | null;
  name: string;
  message: string;
};

export type TeamStatMarginalCalculatorAgreement = {
  passed: true;
  directTotalDamage: number;
  compiledTotalDamage: number;
  absoluteDifference: number;
  allowedDifference: number;
};

export type TeamStatMarginalReplayObservation = {
  objective: number;
  computedBuffOverrideLineCount: number;
  computedBuffOverridesSha256: string;
  calculatorAgreement: TeamStatMarginalCalculatorAgreement;
};

export type TeamStatMarginalStatObservation = {
  stat: TeamStatMarginalNonErStat;
  averageRollDelta: number;
  perturbedObjective: number;
  rawDelta: number;
  relativeDeltaToBaseline: number | null;
  relativeDeltaStatus: "available" | "undefined-zero-baseline";
  withinCharacterNormalizedToMaxPositive: number | null;
  normalizationStatus:
    | "available"
    | "undefined-no-positive-character-marginal";
  effectiveZeroTolerance: number;
  sign: TeamStatMarginalSign;
  replayValidation: Omit<TeamStatMarginalReplayObservation, "objective">;
};

export type TeamStatMarginalCharacterObservation = {
  characterId: string;
  sheetFingerprintSha256: string;
  maxPositiveRawDelta: number | null;
  normalizationStatus:
    | "available"
    | "undefined-no-positive-character-marginal";
  stats: TeamStatMarginalStatObservation[];
};

type TeamStatMarginalEndpointMetadata = {
  endpointId: string;
  originId: string;
  captureFingerprintSha256: string;
  teamConfigsFingerprintSha256: string;
  sheetFingerprintsByCharacter: Record<string, string>;
};

export type TeamStatMarginalEvaluatedEndpoint =
  TeamStatMarginalEndpointMetadata & {
    outcome: "evaluated";
    observedReplayCount: number;
    baseline: TeamStatMarginalReplayObservation;
    characters: TeamStatMarginalCharacterObservation[];
  };

export type TeamStatMarginalFailedEndpoint = TeamStatMarginalEndpointMetadata & {
  outcome: "not-comparable";
  observedReplayCount: number;
  failures: TeamStatMarginalDiagnosticFailure[];
};

export type TeamStatMarginalEndpointObservation =
  | TeamStatMarginalEvaluatedEndpoint
  | TeamStatMarginalFailedEndpoint;

export type TeamStatMarginalSheetFingerprintMultiplicity = {
  endpointCount: number;
  characters: Array<{
    characterId: string;
    uniqueSheetFingerprintCount: number;
    groups: Array<{
      sheetFingerprintSha256: string;
      multiplicity: number;
      endpointIds: string[];
      originIds: string[];
    }>;
  }>;
};

export type TeamStatMarginalNumberRange = {
  min: number;
  max: number;
  range: number;
  relativeRangeToMaxMagnitude: number | null;
};

export type TeamStatMarginalCrossEndpointStatObservation = {
  stat: TeamStatMarginalNonErStat;
  endpointCount: number;
  rawDeltaRange: TeamStatMarginalNumberRange;
  relativeDeltaRange: TeamStatMarginalNumberRange | null;
  relativeDeltaRangeStatus:
    | "available"
    | "unavailable-at-one-or-more-endpoints";
  normalizedRange: TeamStatMarginalNumberRange | null;
  normalizedRangeStatus:
    | "available"
    | "unavailable-at-one-or-more-endpoints";
  signClassification:
    | "all-positive"
    | "all-zero"
    | "all-negative"
    | "mixed";
  zeroClassification: "none-zero" | "some-zero" | "all-zero";
  positiveEndpointIds: string[];
  zeroEndpointIds: string[];
  negativeEndpointIds: string[];
};

export type TeamStatMarginalCrossEndpointSummary = {
  aggregation: "ranges-only-no-survivor-averaging";
  endpointCount: number;
  characters: Array<{
    characterId: string;
    stats: TeamStatMarginalCrossEndpointStatObservation[];
  }>;
};

type TeamStatMarginalDiagnosticReportBase = {
  schemaVersion: 1;
  classification: "team-stat-marginal-technical-diagnostic";
  supportsGuideClaims: false;
  supportsStatRecommendations: false;
  supportsScalarStatWeights: false;
  supportsIdealStatAllocation: false;
  supportsEnergyRequirements: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  diagnosticId: string;
  evidence: ReplayEvidence;
  technicalObjective: TeamStatMarginalDiagnosticInput["objective"] & {
    sha256: string;
  };
  statDomain: {
    stats: Array<{
      stat: TeamStatMarginalNonErStat;
      averageRollDelta: number;
    }>;
    energyRecoveryExcluded: true;
    perturbation: "+1-average-five-star-substat-roll";
    representsFeasibleArtifactAllocation: false;
  };
  zeroTolerance: TeamStatMarginalZeroTolerance & {
    scale: "max-of-one-baseline-and-perturbed-objective";
  };
  captureFingerprintBoundary: {
    callerCaptureFingerprintValidation: "lowercase-sha256-syntax-only";
    callerCaptureFingerprintRecomputedByCore: false;
    teamConfigFingerprintsRecomputedByCore: true;
    sheetFingerprintsRecomputedByCore: true;
  };
  execution: {
    scheduling: "sequential";
    fullDirectAndCompiledReplayPerPoint: true;
    endpointCount: number;
    characterCountPerEndpoint: 4;
    statCountPerCharacter: 9;
    plannedReplayCount: number;
    observedReplayCount: number;
    allPlannedReplaysObserved: boolean;
    energyRecoveryEvaluationsUsed: false;
  };
  sheetFingerprintMultiplicity: TeamStatMarginalSheetFingerprintMultiplicity | null;
  endpoints: TeamStatMarginalEndpointObservation[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export type TeamStatMarginalDiagnosticReport =
  | (TeamStatMarginalDiagnosticReportBase & {
      comparisonStatus: "comparable";
      failures: [];
      sheetFingerprintMultiplicity: TeamStatMarginalSheetFingerprintMultiplicity;
      endpoints: TeamStatMarginalEvaluatedEndpoint[];
      crossEndpointSummary: TeamStatMarginalCrossEndpointSummary;
    })
  | (TeamStatMarginalDiagnosticReportBase & {
      comparisonStatus: "not-comparable";
      failures: TeamStatMarginalDiagnosticFailure[];
      crossEndpointSummary: null;
    });

type ValidatedEndpoint = TeamStatMarginalEndpointInput & {
  characterIds: [string, string, string, string];
};

type PendingStatObservation = Omit<
  TeamStatMarginalStatObservation,
  "withinCharacterNormalizedToMaxPositive" | "normalizationStatus"
>;

const DEFAULT_ENVIRONMENT: TeamStatMarginalDiagnosticEnvironment = {
  replayTeamDamage,
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CHARACTER_COUNT = 4;

/** Canonical fingerprint for one captured artifact StatSheet. */
export function fingerprintTeamStatMarginalSheet(sheet: StatSheet): string {
  if (!(sheet instanceof StatSheet)) {
    throw new Error("Team stat marginal fingerprint requires a StatSheet.");
  }
  const entries = [...sheet.dump()]
    .map(({ key, filterKey, value }) => ({
      key,
      filterKey,
      value: normalizeNumber(value),
    }))
    .sort(
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.filterKey, right.filterKey) ||
        left.value - right.value,
    );
  return sha256Text(stableJson(entries));
}

/** Canonical fingerprint for the four captured runtime team configs. */
export function fingerprintTeamStatMarginalTeamConfigs(
  configs: ReplayTeamConfigs,
): string {
  return sha256Text(stableJson(configs));
}

/**
 * Evaluate local +1-roll derivatives at caller-captured team endpoints.
 *
 * This is an offline technical diagnostic. It deliberately retains ranges and
 * tolerance-aware signs instead of averaging endpoints into stat weights.
 */
export async function runTeamStatMarginalDiagnostic(
  input: TeamStatMarginalDiagnosticInput,
  environment: TeamStatMarginalDiagnosticEnvironment = DEFAULT_ENVIRONMENT,
): Promise<TeamStatMarginalDiagnosticReport> {
  validateTopLevelInput(input);
  const statDeltas = requireCanonicalNonErStatDeltas();
  const plannedReplayCount =
    input.endpoints.length *
    (1 + CHARACTER_COUNT * TEAM_STAT_MARGINAL_NON_ER_STATS.length);
  let observedReplayCount = 0;
  const base = buildReportBase(input, statDeltas, plannedReplayCount);
  const captureValidation = validateCapturedEndpoints(input.endpoints);

  if (captureValidation.failures.length > 0) {
    const failuresByEndpoint = groupFailuresByEndpoint(
      captureValidation.failures,
    );
    const endpoints = input.endpoints.map(
      (endpoint): TeamStatMarginalFailedEndpoint => ({
        ...endpointMetadata(endpoint),
        outcome: "not-comparable",
        observedReplayCount: 0,
        failures:
          failuresByEndpoint.get(endpoint.endpointId) ?? [
            withheldFailure(endpoint.endpointId),
          ],
      }),
    );
    return {
      ...base,
      comparisonStatus: "not-comparable",
      execution: executionWithObserved(
        base.execution,
        observedReplayCount,
      ),
      sheetFingerprintMultiplicity: null,
      endpoints,
      failures: captureValidation.failures,
      crossEndpointSummary: null,
    };
  }

  const validatedEndpoints = captureValidation.endpoints;
  const sheetFingerprintMultiplicity = buildSheetFingerprintMultiplicity(
    validatedEndpoints,
  );
  const endpoints: TeamStatMarginalEndpointObservation[] = [];
  const failures: TeamStatMarginalDiagnosticFailure[] = [];

  for (const endpoint of validatedEndpoints) {
    const endpointStartedAt = observedReplayCount;
    const baselineReplayId = `${input.diagnosticId}:${endpoint.endpointId}:baseline`;
    observedReplayCount += 1;
    const baseline = await evaluateReplayPoint(
      buildReplayInput(input, endpoint, baselineReplayId, endpoint.artifactSheets),
      environment,
      endpoint.endpointId,
      null,
      null,
      "baseline-replay",
    );
    if (baseline.failure) {
      failures.push(baseline.failure);
      endpoints.push({
        ...endpointMetadata(endpoint),
        outcome: "not-comparable",
        observedReplayCount: observedReplayCount - endpointStartedAt,
        failures: [baseline.failure],
      });
      continue;
    }

    const pendingByCharacter = new Map<
      string,
      { pending: PendingStatObservation[]; failures: TeamStatMarginalDiagnosticFailure[] }
    >();
    for (const characterId of endpoint.characterIds) {
      const pending: PendingStatObservation[] = [];
      const characterFailures: TeamStatMarginalDiagnosticFailure[] = [];
      for (const { stat, averageRollDelta } of statDeltas) {
        const replayId = `${input.diagnosticId}:${endpoint.endpointId}:${characterId}:${stat}`;
        const perturbedSheets = {
          ...endpoint.artifactSheets,
          [characterId]: endpoint.artifactSheets[characterId].withDelta(
            stat as StatKey,
            averageRollDelta,
          ),
        };
        observedReplayCount += 1;
        const perturbed = await evaluateReplayPoint(
          buildReplayInput(input, endpoint, replayId, perturbedSheets),
          environment,
          endpoint.endpointId,
          characterId,
          stat,
          "marginal-replay",
        );
        if (perturbed.failure) {
          failures.push(perturbed.failure);
          characterFailures.push(perturbed.failure);
          continue;
        }

        const rawDelta = normalizeNumber(
          perturbed.observation.objective - baseline.observation.objective,
        );
        const effectiveZeroTolerance = effectiveTolerance(
          input.zeroTolerance,
          baseline.observation.objective,
          perturbed.observation.objective,
        );
        const sign = classifySign(rawDelta, effectiveZeroTolerance);
        const baselineIsZero = baseline.observation.objective === 0;
        pending.push({
          stat,
          averageRollDelta,
          perturbedObjective: perturbed.observation.objective,
          rawDelta,
          relativeDeltaToBaseline: baselineIsZero
            ? null
            : normalizeNumber(rawDelta / baseline.observation.objective),
          relativeDeltaStatus: baselineIsZero
            ? "undefined-zero-baseline"
            : "available",
          effectiveZeroTolerance,
          sign,
          replayValidation: replayValidationWithoutObjective(
            perturbed.observation,
          ),
        });
      }
      pendingByCharacter.set(characterId, {
        pending,
        failures: characterFailures,
      });
    }

    const endpointFailures = [...pendingByCharacter.values()].flatMap(
      ({ failures: characterFailures }) => characterFailures,
    );
    if (endpointFailures.length > 0) {
      endpoints.push({
        ...endpointMetadata(endpoint),
        outcome: "not-comparable",
        observedReplayCount: observedReplayCount - endpointStartedAt,
        failures: endpointFailures,
      });
      continue;
    }

    const characters = endpoint.characterIds.map(
      (characterId): TeamStatMarginalCharacterObservation => {
        const pending = pendingByCharacter.get(characterId)?.pending ?? [];
        if (pending.length !== TEAM_STAT_MARGINAL_NON_ER_STATS.length) {
          throw new Error(
            `${endpoint.endpointId}/${characterId} lost a successful stat observation without retaining a failure.`,
          );
        }
        const maxPositiveRawDelta = pending.reduce<number | null>(
          (current, observation) =>
            observation.sign === "positive" &&
            (current == null || observation.rawDelta > current)
              ? observation.rawDelta
              : current,
          null,
        );
        const normalizationStatus =
          maxPositiveRawDelta == null
            ? "undefined-no-positive-character-marginal"
            : "available";
        return {
          characterId,
          sheetFingerprintSha256:
            endpoint.sheetFingerprintsByCharacter[characterId],
          maxPositiveRawDelta,
          normalizationStatus,
          stats: pending.map((observation) => ({
            ...observation,
            withinCharacterNormalizedToMaxPositive:
              maxPositiveRawDelta == null
                ? null
                : normalizeNumber(
                    observation.rawDelta / maxPositiveRawDelta,
                  ),
            normalizationStatus,
          })),
        };
      },
    );
    endpoints.push({
      ...endpointMetadata(endpoint),
      outcome: "evaluated",
      observedReplayCount: observedReplayCount - endpointStartedAt,
      baseline: baseline.observation,
      characters,
    });
  }

  const execution = executionWithObserved(
    base.execution,
    observedReplayCount,
  );
  if (
    failures.length > 0 ||
    endpoints.some(({ outcome }) => outcome !== "evaluated")
  ) {
    return {
      ...base,
      comparisonStatus: "not-comparable",
      execution,
      sheetFingerprintMultiplicity,
      endpoints,
      failures,
      crossEndpointSummary: null,
    };
  }

  const evaluatedEndpoints = endpoints as TeamStatMarginalEvaluatedEndpoint[];
  if (observedReplayCount !== plannedReplayCount) {
    throw new Error(
      `Comparable team stat marginal diagnostic observed ${observedReplayCount} replays; expected ${plannedReplayCount}.`,
    );
  }
  return {
    ...base,
    comparisonStatus: "comparable",
    execution,
    sheetFingerprintMultiplicity,
    endpoints: evaluatedEndpoints,
    failures: [],
    crossEndpointSummary: buildCrossEndpointSummary(evaluatedEndpoints),
  };
}

function validateTopLevelInput(input: TeamStatMarginalDiagnosticInput): void {
  if (!input.diagnosticId.trim()) {
    throw new Error("Team stat marginal diagnostic requires a diagnosticId.");
  }
  if (input.endpoints.length < 2) {
    throw new Error(
      "Team stat marginal diagnostic requires at least two captured endpoints.",
    );
  }
  const endpointIds = input.endpoints.map(({ endpointId }) => endpointId);
  if (
    endpointIds.some((endpointId) => !endpointId.trim()) ||
    new Set(endpointIds).size !== endpointIds.length
  ) {
    throw new Error(
      "Team stat marginal endpoint IDs must be non-empty and unique.",
    );
  }
  for (const [key, value] of Object.entries(input.zeroTolerance)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        `Team stat marginal zero tolerance ${key} must be finite and non-negative.`,
      );
    }
  }
}

function requireCanonicalNonErStatDeltas(): Array<{
  stat: TeamStatMarginalNonErStat;
  averageRollDelta: number;
}> {
  if (
    (TEAM_STAT_MARGINAL_NON_ER_STATS as readonly string[]).includes("er")
  ) {
    throw new Error("Team stat marginal diagnostic must not evaluate ER.");
  }
  return TEAM_STAT_MARGINAL_NON_ER_STATS.map((stat) => {
    const averageRollDelta = AVG_SUBSTAT_ROLL[stat];
    if (!Number.isFinite(averageRollDelta) || averageRollDelta <= 0) {
      throw new Error(
        `Team stat marginal average roll for ${stat} must be positive and finite.`,
      );
    }
    return { stat, averageRollDelta: normalizeNumber(averageRollDelta) };
  });
}

function validateCapturedEndpoints(endpoints: TeamStatMarginalEndpointInput[]): {
  endpoints: ValidatedEndpoint[];
  failures: TeamStatMarginalDiagnosticFailure[];
} {
  const validated: ValidatedEndpoint[] = [];
  const failures: TeamStatMarginalDiagnosticFailure[] = [];
  for (const endpoint of endpoints) {
    const endpointFailures = validateCapturedEndpoint(endpoint);
    failures.push(...endpointFailures);
    if (endpointFailures.length === 0) {
      validated.push({
        ...endpoint,
        characterIds: endpoint.teamConfigs.map(
          ({ charId }) => charId,
        ) as [string, string, string, string],
      });
    }
  }

  if (failures.length === 0) {
    const reference = validated[0].teamConfigsFingerprintSha256;
    for (const endpoint of validated.slice(1)) {
      if (endpoint.teamConfigsFingerprintSha256 !== reference) {
        failures.push(
          captureFailure(
            "cross-endpoint-team-config-mismatch",
            endpoint.endpointId,
            `Endpoint ${endpoint.endpointId} team configs differ from ${validated[0].endpointId}; cross-endpoint marginal ranges were withheld.`,
          ),
        );
      }
    }
  }
  return { endpoints: validated, failures };
}

function validateCapturedEndpoint(
  endpoint: TeamStatMarginalEndpointInput,
): TeamStatMarginalDiagnosticFailure[] {
  const failures: TeamStatMarginalDiagnosticFailure[] = [];
  if (
    !endpoint.originId.trim() ||
    !SHA256_PATTERN.test(endpoint.captureFingerprintSha256)
  ) {
    failures.push(
      captureFailure(
        "invalid-capture-fingerprint",
        endpoint.endpointId,
        `Endpoint ${endpoint.endpointId} requires a non-empty origin and lowercase SHA-256 capture fingerprint.`,
      ),
    );
  }
  if (
    endpoint.teamConfigs.length !== CHARACTER_COUNT ||
    endpoint.teamConfigs.some(({ charId }) => !charId.trim()) ||
    new Set(endpoint.teamConfigs.map(({ charId }) => charId)).size !==
      CHARACTER_COUNT
  ) {
    failures.push(
      captureFailure(
        "invalid-team-config-shape",
        endpoint.endpointId,
        `Endpoint ${endpoint.endpointId} must contain four unique character configs.`,
      ),
    );
    return failures;
  }
  const actualTeamFingerprint = fingerprintTeamStatMarginalTeamConfigs(
    endpoint.teamConfigs,
  );
  if (
    !SHA256_PATTERN.test(endpoint.teamConfigsFingerprintSha256) ||
    endpoint.teamConfigsFingerprintSha256 !== actualTeamFingerprint
  ) {
    failures.push(
      captureFailure(
        "team-config-fingerprint-mismatch",
        endpoint.endpointId,
        `Endpoint ${endpoint.endpointId} team-config fingerprint does not match its supplied configs.`,
      ),
    );
  }

  const characterIds = endpoint.teamConfigs.map(({ charId }) => charId).sort(
    compareText,
  );
  const sheetCharacterIds = Object.keys(endpoint.artifactSheets).sort(
    compareText,
  );
  if (!sameStrings(characterIds, sheetCharacterIds)) {
    failures.push(
      captureFailure(
        "artifact-sheet-character-mismatch",
        endpoint.endpointId,
        `Endpoint ${endpoint.endpointId} artifact sheets must exactly match ${characterIds.join(", ")}.`,
      ),
    );
  }
  const fingerprintCharacterIds = Object.keys(
    endpoint.sheetFingerprintsByCharacter,
  ).sort(compareText);
  if (!sameStrings(characterIds, fingerprintCharacterIds)) {
    failures.push(
      captureFailure(
        "sheet-fingerprint-character-mismatch",
        endpoint.endpointId,
        `Endpoint ${endpoint.endpointId} sheet fingerprints must exactly match ${characterIds.join(", ")}.`,
      ),
    );
  }

  for (const characterId of characterIds) {
    const sheet = endpoint.artifactSheets[characterId];
    if (!(sheet instanceof StatSheet)) {
      failures.push({
        ...captureFailure(
          "invalid-artifact-sheet",
          endpoint.endpointId,
          `Endpoint ${endpoint.endpointId}/${characterId} is not a StatSheet.`,
        ),
        characterId,
      });
      continue;
    }
    const expected = endpoint.sheetFingerprintsByCharacter[characterId];
    const actual = fingerprintTeamStatMarginalSheet(sheet);
    if (!SHA256_PATTERN.test(expected ?? "") || expected !== actual) {
      failures.push({
        ...captureFailure(
          "sheet-fingerprint-mismatch",
          endpoint.endpointId,
          `Endpoint ${endpoint.endpointId}/${characterId} sheet fingerprint does not match its supplied StatSheet.`,
        ),
        characterId,
      });
    }
  }
  return failures;
}

function captureFailure(
  code: TeamStatMarginalDiagnosticFailure["code"],
  endpointId: string,
  message: string,
): TeamStatMarginalDiagnosticFailure {
  return {
    code,
    stage: "capture-validation",
    endpointId,
    characterId: null,
    stat: null,
    name: "TeamStatMarginalCaptureError",
    message,
  };
}

function withheldFailure(
  endpointId: string,
): TeamStatMarginalDiagnosticFailure {
  return captureFailure(
    "evaluation-withheld-due-to-capture-failure",
    endpointId,
    `Endpoint ${endpointId} was not evaluated because at least one captured endpoint failed validation.`,
  );
}

async function evaluateReplayPoint(
  replayInput: DamageReplayInput,
  environment: TeamStatMarginalDiagnosticEnvironment,
  endpointId: string,
  characterId: string | null,
  stat: TeamStatMarginalNonErStat | null,
  stage: "baseline-replay" | "marginal-replay",
): Promise<
  | { observation: TeamStatMarginalReplayObservation; failure: null }
  | { observation: null; failure: TeamStatMarginalDiagnosticFailure }
> {
  let output: DamageReplayOutput;
  try {
    output = await environment.replayTeamDamage(replayInput);
  } catch (error) {
    const serialized = serializeError(error);
    return {
      observation: null,
      failure: {
        code: "replay-failed",
        stage,
        endpointId,
        characterId,
        stat,
        name: serialized.name,
        message: serialized.message,
      },
    };
  }

  try {
    return {
      observation: validateReplayOutput(replayInput.replayId, output),
      failure: null,
    };
  } catch (error) {
    const serialized = serializeError(error);
    return {
      observation: null,
      failure: {
        code: "replay-output-invalid",
        stage,
        endpointId,
        characterId,
        stat,
        name: serialized.name,
        message: serialized.message,
      },
    };
  }
}

function validateReplayOutput(
  replayId: string,
  output: DamageReplayOutput,
): TeamStatMarginalReplayObservation {
  const agreement = output.validation?.calculatorAgreement;
  const values = [
    output.result?.totalDamage,
    agreement?.directTotalDamage,
    agreement?.compiledTotalDamage,
    agreement?.absoluteDifference,
    agreement?.allowedDifference,
  ];
  const consistencyScale = Math.max(
    1,
    Math.abs(output.result?.totalDamage ?? 0),
    Math.abs(agreement?.directTotalDamage ?? 0),
    Math.abs(agreement?.compiledTotalDamage ?? 0),
  );
  const consistencyTolerance = Math.max(
    1e-12,
    Number.EPSILON * 8 * consistencyScale,
  );
  const calculatedAbsoluteDifference = agreement
    ? Math.abs(agreement.directTotalDamage - agreement.compiledTotalDamage)
    : Number.NaN;
  if (
    output.replayId !== replayId ||
    agreement?.passed !== true ||
    values.some((value) => !Number.isFinite(value)) ||
    output.result.totalDamage < 0 ||
    agreement.absoluteDifference < 0 ||
    agreement.allowedDifference < 0 ||
    agreement.absoluteDifference > agreement.allowedDifference ||
    Math.abs(
      agreement.absoluteDifference - calculatedAbsoluteDifference,
    ) > consistencyTolerance ||
    Math.abs(output.result.totalDamage - agreement.directTotalDamage) >
      consistencyTolerance
  ) {
    throw new Error(
      `Replay ${replayId} returned a non-finite, negative, mismatched, or calculator-disagreeing objective.`,
    );
  }
  return {
    objective: normalizeNumber(output.result.totalDamage),
    computedBuffOverrideLineCount: Object.keys(
      output.validation.computedBuffOverrides ?? {},
    ).length,
    computedBuffOverridesSha256: sha256Text(
      stableJson(output.validation.computedBuffOverrides ?? {}),
    ),
    calculatorAgreement: {
      passed: true,
      directTotalDamage: normalizeNumber(agreement.directTotalDamage),
      compiledTotalDamage: normalizeNumber(agreement.compiledTotalDamage),
      absoluteDifference: normalizeNumber(agreement.absoluteDifference),
      allowedDifference: normalizeNumber(agreement.allowedDifference),
    },
  };
}

function buildReplayInput(
  input: TeamStatMarginalDiagnosticInput,
  endpoint: ValidatedEndpoint,
  replayId: string,
  artifactSheets: Record<string, StatSheet>,
): DamageReplayInput {
  return {
    replayId,
    evidence: cloneEvidence(input.evidence),
    teamConfigs: endpoint.teamConfigs,
    combatOptions: { ...input.objective.combatOptions },
    enemyAura: input.objective.enemyAura,
    extraBuffs: input.objective.extraBuffs.map(cloneExtraBuff),
    calcContext: cloneCalcContext(input.objective.calcContext),
    combo: cloneCombo(input.objective.combo),
    artifactSheets,
    formulaBuffOverrides: cloneFormulaBuffOverrides(
      input.objective.formulaBuffOverrides,
    ),
  };
}

function buildCrossEndpointSummary(
  endpoints: TeamStatMarginalEvaluatedEndpoint[],
): TeamStatMarginalCrossEndpointSummary {
  const first = endpoints[0];
  return {
    aggregation: "ranges-only-no-survivor-averaging",
    endpointCount: endpoints.length,
    characters: first.characters.map((firstCharacter) => ({
      characterId: firstCharacter.characterId,
      stats: TEAM_STAT_MARGINAL_NON_ER_STATS.map((stat) => {
        const observations = endpoints.map((endpoint) => {
          const character = endpoint.characters.find(
            ({ characterId }) => characterId === firstCharacter.characterId,
          );
          const observation = character?.stats.find(
            ({ stat: observedStat }) => observedStat === stat,
          );
          if (!observation) {
            throw new Error(
              `Comparable endpoint ${endpoint.endpointId} is missing ${firstCharacter.characterId}/${stat}.`,
            );
          }
          return { endpointId: endpoint.endpointId, observation };
        });
        const relativeValues = observations.map(
          ({ observation }) => observation.relativeDeltaToBaseline,
        );
        const normalizedValues = observations.map(
          ({ observation }) =>
            observation.withinCharacterNormalizedToMaxPositive,
        );
        const signs = observations.map(({ observation }) => observation.sign);
        return {
          stat,
          endpointCount: endpoints.length,
          rawDeltaRange: numberRange(
            observations.map(({ observation }) => observation.rawDelta),
          ),
          relativeDeltaRange: relativeValues.every(
            (value): value is number => value != null,
          )
            ? numberRange(relativeValues)
            : null,
          relativeDeltaRangeStatus: relativeValues.every(
            (value) => value != null,
          )
            ? "available"
            : "unavailable-at-one-or-more-endpoints",
          normalizedRange: normalizedValues.every(
            (value): value is number => value != null,
          )
            ? numberRange(normalizedValues)
            : null,
          normalizedRangeStatus: normalizedValues.every(
            (value) => value != null,
          )
            ? "available"
            : "unavailable-at-one-or-more-endpoints",
          signClassification: classifySigns(signs),
          zeroClassification: classifyZeros(signs),
          positiveEndpointIds: observations
            .filter(({ observation }) => observation.sign === "positive")
            .map(({ endpointId }) => endpointId),
          zeroEndpointIds: observations
            .filter(({ observation }) => observation.sign === "zero")
            .map(({ endpointId }) => endpointId),
          negativeEndpointIds: observations
            .filter(({ observation }) => observation.sign === "negative")
            .map(({ endpointId }) => endpointId),
        };
      }),
    })),
  };
}

function buildSheetFingerprintMultiplicity(
  endpoints: ValidatedEndpoint[],
): TeamStatMarginalSheetFingerprintMultiplicity {
  const characterIds = endpoints[0].characterIds;
  return {
    endpointCount: endpoints.length,
    characters: characterIds.map((characterId) => {
      const groups = new Map<
        string,
        { endpointIds: string[]; originIds: string[] }
      >();
      for (const endpoint of endpoints) {
        const fingerprint = endpoint.sheetFingerprintsByCharacter[characterId];
        const group = groups.get(fingerprint) ?? {
          endpointIds: [],
          originIds: [],
        };
        group.endpointIds.push(endpoint.endpointId);
        group.originIds.push(endpoint.originId);
        groups.set(fingerprint, group);
      }
      const publicGroups = [...groups.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([sheetFingerprintSha256, group]) => ({
          sheetFingerprintSha256,
          multiplicity: group.endpointIds.length,
          endpointIds: [...group.endpointIds],
          originIds: [...group.originIds],
        }));
      return {
        characterId,
        uniqueSheetFingerprintCount: publicGroups.length,
        groups: publicGroups,
      };
    }),
  };
}

function numberRange(values: number[]): TeamStatMarginalNumberRange {
  if (values.length === 0) throw new Error("Cannot build an empty number range.");
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = normalizeNumber(max - min);
  const maxMagnitude = Math.max(Math.abs(min), Math.abs(max));
  return {
    min: normalizeNumber(min),
    max: normalizeNumber(max),
    range,
    relativeRangeToMaxMagnitude:
      maxMagnitude === 0 ? null : normalizeNumber(range / maxMagnitude),
  };
}

function classifySigns(
  signs: TeamStatMarginalSign[],
): TeamStatMarginalCrossEndpointStatObservation["signClassification"] {
  const unique = new Set(signs);
  if (unique.size !== 1) return "mixed";
  const only = signs[0];
  return only === "positive"
    ? "all-positive"
    : only === "negative"
      ? "all-negative"
      : "all-zero";
}

function classifyZeros(
  signs: TeamStatMarginalSign[],
): TeamStatMarginalCrossEndpointStatObservation["zeroClassification"] {
  const zeroCount = signs.filter((sign) => sign === "zero").length;
  return zeroCount === 0
    ? "none-zero"
    : zeroCount === signs.length
      ? "all-zero"
      : "some-zero";
}

function classifySign(
  delta: number,
  tolerance: number,
): TeamStatMarginalSign {
  if (Math.abs(delta) <= tolerance) return "zero";
  return delta > 0 ? "positive" : "negative";
}

function effectiveTolerance(
  tolerance: TeamStatMarginalZeroTolerance,
  baseline: number,
  perturbed: number,
): number {
  return normalizeNumber(
    Math.max(
      tolerance.absolute,
      tolerance.relative *
        Math.max(1, Math.abs(baseline), Math.abs(perturbed)),
    ),
  );
}

function buildReportBase(
  input: TeamStatMarginalDiagnosticInput,
  statDeltas: Array<{
    stat: TeamStatMarginalNonErStat;
    averageRollDelta: number;
  }>,
  plannedReplayCount: number,
): TeamStatMarginalDiagnosticReportBase {
  const objective = cloneObjective(input.objective);
  return {
    schemaVersion: 1,
    classification: "team-stat-marginal-technical-diagnostic",
    supportsGuideClaims: false,
    supportsStatRecommendations: false,
    supportsScalarStatWeights: false,
    supportsIdealStatAllocation: false,
    supportsEnergyRequirements: false,
    generatedFrom: input.generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    diagnosticId: input.diagnosticId,
    evidence: cloneEvidence(input.evidence),
    technicalObjective: {
      ...objective,
      sha256: sha256Text(stableJson(objective)),
    },
    statDomain: {
      stats: statDeltas.map((entry) => ({ ...entry })),
      energyRecoveryExcluded: true,
      perturbation: "+1-average-five-star-substat-roll",
      representsFeasibleArtifactAllocation: false,
    },
    zeroTolerance: {
      ...input.zeroTolerance,
      scale: "max-of-one-baseline-and-perturbed-objective",
    },
    captureFingerprintBoundary: {
      callerCaptureFingerprintValidation: "lowercase-sha256-syntax-only",
      callerCaptureFingerprintRecomputedByCore: false,
      teamConfigFingerprintsRecomputedByCore: true,
      sheetFingerprintsRecomputedByCore: true,
    },
    execution: {
      scheduling: "sequential",
      fullDirectAndCompiledReplayPerPoint: true,
      endpointCount: input.endpoints.length,
      characterCountPerEndpoint: 4,
      statCountPerCharacter: 9,
      plannedReplayCount,
      observedReplayCount: 0,
      allPlannedReplaysObserved: false,
      energyRecoveryEvaluationsUsed: false,
    },
    sheetFingerprintMultiplicity: null,
    endpoints: [],
    cautions: [
      "Each perturbation adds one average roll to an already captured sheet; it is a local derivative and not a legal roll exchange or feasible allocation.",
      "The diagnostic retains endpoint ranges and tolerance-aware signs; it does not average endpoints into a scalar stat weight.",
      "Formula counts, reactions, buffs, rotations, and captured operating points remain only as credible as the caller-supplied technical objective and evidence.",
      "A zero marginal can reveal local saturation or objective blindness; it does not prove that a stat has no gameplay value.",
    ],
    prohibitedInterpretations: [
      "stat-weight",
      "stat-priority",
      "ideal-allocation",
      "artifact-recommendation",
      "guide-recommendation",
      "global-optimum",
      "energy-requirement",
    ],
  };
}

function executionWithObserved(
  execution: TeamStatMarginalDiagnosticReportBase["execution"],
  observedReplayCount: number,
): TeamStatMarginalDiagnosticReportBase["execution"] {
  return {
    ...execution,
    observedReplayCount,
    allPlannedReplaysObserved:
      observedReplayCount === execution.plannedReplayCount,
  };
}

function endpointMetadata(
  endpoint: TeamStatMarginalEndpointInput,
): TeamStatMarginalEndpointMetadata {
  return {
    endpointId: endpoint.endpointId,
    originId: endpoint.originId,
    captureFingerprintSha256: endpoint.captureFingerprintSha256,
    teamConfigsFingerprintSha256: endpoint.teamConfigsFingerprintSha256,
    sheetFingerprintsByCharacter: sortTextRecord(
      endpoint.sheetFingerprintsByCharacter,
    ),
  };
}

function groupFailuresByEndpoint(
  failures: TeamStatMarginalDiagnosticFailure[],
): Map<string, TeamStatMarginalDiagnosticFailure[]> {
  const grouped = new Map<string, TeamStatMarginalDiagnosticFailure[]>();
  for (const failure of failures) {
    const current = grouped.get(failure.endpointId) ?? [];
    current.push(failure);
    grouped.set(failure.endpointId, current);
  }
  return grouped;
}

function replayValidationWithoutObjective(
  observation: TeamStatMarginalReplayObservation,
): Omit<TeamStatMarginalReplayObservation, "objective"> {
  return {
    computedBuffOverrideLineCount:
      observation.computedBuffOverrideLineCount,
    computedBuffOverridesSha256: observation.computedBuffOverridesSha256,
    calculatorAgreement: { ...observation.calculatorAgreement },
  };
}

function cloneObjective(
  objective: TeamStatMarginalDiagnosticInput["objective"],
): TeamStatMarginalDiagnosticInput["objective"] {
  return {
    combatOptions: { ...objective.combatOptions },
    enemyAura: objective.enemyAura,
    extraBuffs: objective.extraBuffs.map(cloneExtraBuff),
    calcContext: cloneCalcContext(objective.calcContext),
    combo: cloneCombo(objective.combo),
    formulaBuffOverrides: cloneFormulaBuffOverrides(
      objective.formulaBuffOverrides,
    ),
  };
}

function cloneEvidence(evidence: ReplayEvidence): ReplayEvidence {
  return {
    ...evidence,
    notes: [...evidence.notes],
    sourceRefs: evidence.sourceRefs.map((sourceRef) => ({
      ...sourceRef,
      supports: [...sourceRef.supports],
    })),
  };
}

function cloneCombo(combo: ReplayCombo): ReplayCombo {
  return {
    id: combo.id,
    label: { ...combo.label },
    lines: combo.lines.map((line) => ({
      ...line,
      reaction: line.reaction ? { ...line.reaction } : null,
    })),
  };
}

function cloneExtraBuff(buff: ExtraBuff): ExtraBuff {
  return {
    ...buff,
    stats: buff.stats.map((stat) => ({ ...stat })),
  };
}

function cloneCalcContext(context: CalcContext): CalcContext {
  return {
    ...context,
    ...(context.perCharCrTarget
      ? { perCharCrTarget: { ...context.perCharCrTarget } }
      : {}),
  };
}

function cloneFormulaBuffOverrides(
  overrides: Record<string, BuffActivationMap> | null,
): Record<string, BuffActivationMap> | null {
  if (overrides == null) return null;
  return Object.fromEntries(
    Object.entries(overrides).map(([formulaKey, activation]) => [
      formulaKey,
      Object.fromEntries(
        Object.entries(activation).map(([buffKey, parts]) => [
          buffKey,
          { ...parts },
        ]),
      ),
    ]),
  );
}

function sortTextRecord(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) =>
      compareText(left, right),
    ),
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

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Non-finite value ${value}.`);
  return Object.is(value, -0) ? 0 : Number(value.toPrecision(15));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
