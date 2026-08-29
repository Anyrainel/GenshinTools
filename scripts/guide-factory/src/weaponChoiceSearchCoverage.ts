import characterStatsInput from "@/data/game/character_stats.json";
import weaponStatsInput from "@/data/game/weapon_stats.json";
import { weapons } from "@/data/resources";
import { betaWeapons } from "@/data/resources_beta";
import type { KnowledgeRecord, KnowledgeRepository } from "./schemas";

export const WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS = [
  "scripts/guide-factory/src/weaponChoiceSearchCoverage.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/data/betaState.ts",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameResources.ts",
  "src/data/gameStatsLoader.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/data/types.ts",
  "src/lib/team-comp/analyzer/weaponChoice.ts",
] as const;

const MIRRORED_POLICY_LABEL =
  "offline mirror of private getWeaponCandidates (released inputs)" as const;
const RUNTIME_POLICY_PATH =
  "src/lib/team-comp/analyzer/weaponChoice.ts#getWeaponCandidates" as const;

type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type EnergyGuidance = Extract<
  KnowledgeRecord,
  { kind: "energy_guidance" }
>;
type KnowledgeStatus = KnowledgeRecord["status"];
type SourceReference = KnowledgeRecord["sourceRefs"][number];
type GuideRecommendation = NonNullable<
  CharacterGuide["recommendations"]
>[number];
type WeaponRecommendation = NonNullable<
  GuideRecommendation["weaponRecommendations"]
>[number];
type TeamMember = KnowledgeTeam["members"][number];

export interface WeaponPolicyStats {
  rarity: number;
  type: string;
}

export interface WeaponPolicyResource {
  rarity: number;
}

export interface WeaponChoiceSearchCoveragePolicyInputs {
  weaponStats: Readonly<Record<string, WeaponPolicyStats>>;
  characterWeaponTypes: Readonly<Record<string, string | undefined>>;
  releasedWeaponResources: Readonly<Record<string, WeaponPolicyResource>>;
  betaOnlyWeaponIds: ReadonlySet<string>;
}

export interface MirroredWeaponCandidate {
  weaponId: string;
  weaponType: string;
  rarity: number;
  refinement: 1 | 5;
}

export interface MirroredWeaponCandidateDomain {
  candidates: MirroredWeaponCandidate[];
}

export type WeaponIdDomainOutcome =
  | "in-released-candidate-domain"
  | "excluded-from-released-candidate-domain";

export type WeaponIdDomainFailureReason =
  | "beta-only-weapon"
  | "missing-weapon-stats"
  | "low-rarity-filter"
  | "unexpected-policy-omission";

export type WeaponRefinementCoverageOutcome =
  | "exact-candidate"
  | "unspecified"
  | "excluded-by-policy";

export type WeaponRefinementFailureReason =
  | "weapon-id-outside-domain"
  | "refinement-not-enumerated-by-policy"
  | "unexpected-policy-omission";

export type NativeWeaponTypeCompatibilityOutcome =
  | "compatible"
  | "mismatched"
  | "unknown";

interface TeamContext {
  label?: string;
  intent?: KnowledgeTeam["intent"];
  exhaustiveness?: KnowledgeTeam["exhaustiveness"];
  rankingClaim?: KnowledgeTeam["rankingClaim"];
  reactions: string[];
  characterIds: string[];
}

type RawWeaponObservation = {
  observationId: string;
  recordId: string;
  recordStatus: KnowledgeStatus;
  characterId: string;
  weaponId: string;
  requestedRefinement?: number;
  sourceRefs: SourceReference[];
} &
  (
    | {
        sourceKind: "guide-weapon-order";
        sourceListIndex: number;
        sourceListLength: number;
      }
    | {
        sourceKind: "character-guide-recommendation";
        recommendationId: string;
        recommendationLabel?: string;
        recommendationOrdering?: GuideRecommendation["weaponOrdering"];
        recommendationGroupIndex: number;
        weaponIndex: number;
        grouping: WeaponRecommendation["grouping"];
        classification: WeaponRecommendation["classification"];
        conditions: string[];
        minConstellation?: number;
        maxConstellation?: number;
        roles: string[];
      }
    | {
        sourceKind: "team-selected-weapon";
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
        teamContext: TeamContext;
      }
    | {
        sourceKind: "team-member-recommendation";
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
        teamContext: TeamContext;
        recommendationOrdering?: TeamMember["weaponOrdering"];
        recommendationGroupIndex: number;
        weaponIndex: number;
        grouping: WeaponRecommendation["grouping"];
        classification: WeaponRecommendation["classification"];
        conditions: string[];
      }
  );

export type WeaponChoiceSearchCoverageObservation = RawWeaponObservation & {
  weaponIdDomain: {
    outcome: WeaponIdDomainOutcome;
    failureReason?: WeaponIdDomainFailureReason;
    weaponStatsAvailable: boolean;
    releasedResourceAvailable: boolean;
    betaOnly: boolean;
    resolvedPolicyRarity?: number;
    candidateRefinements: number[];
  };
  refinementCoverage: {
    outcome: WeaponRefinementCoverageOutcome;
    requestedRefinement?: number;
    failureReason?: WeaponRefinementFailureReason;
  };
  nativeTypeCompatibility: {
    outcome: NativeWeaponTypeCompatibilityOutcome;
    characterWeaponType?: string;
    weaponTypeFromStats?: string;
  };
};

export type DeferredWeaponConditionReference = {
  referenceId: string;
  recordId: string;
  recordStatus: KnowledgeStatus;
  characterId: string;
  targetIndex: number;
  analyzed: false;
  conditions: string[];
  weaponCondition:
    | { type: "specific"; weaponIds: string[] }
    | {
        type: "category";
        weaponType: string;
        excludedWeaponIds: string[];
      };
  sourceRefs: SourceReference[];
} &
  (
    | {
        sourceKind: "energy-guidance-target";
        constellation?: number;
        teamContext: EnergyGuidance["teamContext"];
      }
    | {
        sourceKind: "character-guide-er-target";
        recommendationId: string;
        minConstellation?: number;
        maxConstellation?: number;
        roles: string[];
      }
    | {
        sourceKind: "team-member-er-target";
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
        teamContext: TeamContext;
      }
  );

interface AxisCounts {
  total: number;
}

export interface WeaponChoiceSearchCoverageReport {
  schemaVersion: 1;
  classification: "weapon-choice-candidate-policy-coverage";
  supportsGuideClaims: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  searchSpace: {
    catalogScope: "released";
    implementation: typeof MIRRORED_POLICY_LABEL;
    runtimePolicyPath: typeof RUNTIME_POLICY_PATH;
    candidateDomainOrigin: "offline-mirror" | "provided-for-audit";
    candidateWeaponIds: string[];
    candidatePairs: MirroredWeaponCandidate[];
    counts: {
      weaponIds: number;
      weaponRefinementPairs: number;
      byRarity: Record<
        string,
        { weaponIds: number; weaponRefinementPairs: number }
      >;
      byWeaponType: Record<
        string,
        { weaponIds: number; weaponRefinementPairs: number }
      >;
    };
    candidateDomainComparison: {
      comparedAgainst: "offline-mirror";
      supportsRuntimeEquivalenceClaim: false;
      detected: boolean;
      unexpectedOmissions: string[];
      unexpectedCandidates: string[];
      metadataMismatches: Array<{
        candidateKey: string;
        fields: Array<"weaponType" | "rarity">;
      }>;
    };
  };
  summary: {
    all: AxisCounts;
    bySourceKind: {
      guideWeaponOrder: number;
      teamSelectedWeapons: number;
      characterGuideRecommendations: number;
      teamMemberRecommendations: number;
    };
    weaponIdDomain: {
      inReleasedCandidateDomain: number;
      excludedFromReleasedCandidateDomain: number;
      byFailureReason: Record<WeaponIdDomainFailureReason, number>;
    };
    refinementCoverage: {
      exactCandidate: number;
      unspecified: number;
      excludedByPolicy: number;
      byFailureReason: Record<WeaponRefinementFailureReason, number>;
    };
    nativeTypeCompatibility: {
      compatible: number;
      mismatched: number;
      unknown: number;
    };
  };
  deferredWeaponConditions: {
    analyzed: false;
    weaponConditionObjects: number;
    explicitWeaponIdOccurrences: number;
    categoryConditions: number;
    references: DeferredWeaponConditionReference[];
  };
  observations: WeaponChoiceSearchCoverageObservation[];
  limitations: [
    "The weapon candidate builder is private runtime code, so this offline report mirrors its small released-catalog policy; source hashing and locked tests expose changes, but the default report cannot independently execute the private builder.",
    "An optional supplied candidate domain can be compared with the mirror for audit tests; the default offline-mirror comparison is not evidence that runtime code and the mirror are semantically identical.",
    "Runtime filters by the currently equipped seed weapon's type and skips a character when that seed lacks stats; this report audits a global candidate domain and reports native character-type compatibility separately.",
    "Weapon-ID domain membership only means the released search policy can name the weapon; it does not prove that generation, formula evaluation, or damage computation succeeds.",
    "An unspecified refinement remains an explicit source-data gap and is never counted as exact candidate coverage.",
    "Native weapon-type mismatch is reported independently from candidate-domain membership and does not decide which source is correct.",
    "Ordering, grouping, conditions, constellation scope, team context, investment, and provenance are preserved but not evaluated.",
    "Weapon conditions attached to ER targets are inventoried separately and deliberately receive no candidate, compatibility, or ER analysis.",
    "Rejected records are excluded from candidate observations but remain visible in the deferred weapon-condition inventory.",
  ];
  prohibitedInterpretations: [
    "score",
    "rank",
    "winner",
    "damage-result",
    "energy-result",
    "guide-recommendation",
  ];
}

export interface WeaponChoiceSearchCoverageOptions {
  policyInputs?: WeaponChoiceSearchCoveragePolicyInputs;
  /**
   * Lets audits test a captured or deliberately perturbed candidate domain.
   * Production report generation should omit this and use the offline mirror.
   */
  candidateDomain?: MirroredWeaponCandidateDomain;
}

const WEAPON_ID_FAILURE_REASONS: WeaponIdDomainFailureReason[] = [
  "beta-only-weapon",
  "missing-weapon-stats",
  "low-rarity-filter",
  "unexpected-policy-omission",
];

const REFINEMENT_FAILURE_REASONS: WeaponRefinementFailureReason[] = [
  "weapon-id-outside-domain",
  "refinement-not-enumerated-by-policy",
  "unexpected-policy-omission",
];

const DEFAULT_POLICY_INPUTS: WeaponChoiceSearchCoveragePolicyInputs = {
  weaponStats: weaponStatsInput as Record<string, WeaponPolicyStats>,
  characterWeaponTypes: Object.fromEntries(
    Object.entries(characterStatsInput).map(([characterId, stats]) => [
      characterId,
      stats.weaponType,
    ]),
  ),
  releasedWeaponResources: Object.fromEntries(
    weapons.map(({ id, rarity }) => [id, { rarity }]),
  ),
  betaOnlyWeaponIds: new Set(
    betaWeapons
      .filter((betaWeapon) =>
        weapons.every((releasedWeapon) => releasedWeapon.id !== betaWeapon.id),
      )
      .map(({ id }) => id),
  ),
};

/**
 * Mirror the private runtime `getWeaponCandidates` policy against released
 * data: iterate weapon stats, use resource rarity with stats rarity fallback,
 * skip 1-2 star weapons, use R5 for 3-4 star weapons, and R1 plus R5 for 5
 * star weapons. Weapon type always comes from weapon stats.
 */
export function buildMirroredWeaponCandidateDomain(
  inputs: WeaponChoiceSearchCoveragePolicyInputs = DEFAULT_POLICY_INPUTS,
): MirroredWeaponCandidateDomain {
  const candidates: MirroredWeaponCandidate[] = [];

  for (const [weaponId, stats] of Object.entries(inputs.weaponStats)) {
    if (inputs.betaOnlyWeaponIds.has(weaponId)) continue;
    const rarity =
      inputs.releasedWeaponResources[weaponId]?.rarity ?? stats.rarity;
    if (rarity <= 2) continue;

    if (rarity <= 4) {
      candidates.push({
        weaponId,
        weaponType: stats.type,
        rarity,
        refinement: 5,
      });
    } else {
      candidates.push(
        {
          weaponId,
          weaponType: stats.type,
          rarity,
          refinement: 1,
        },
        {
          weaponId,
          weaponType: stats.type,
          rarity,
          refinement: 5,
        },
      );
    }
  }

  return { candidates: sortCandidates(candidates) };
}

/**
 * Measure whether current non-ER weapon observations fit the analyzer's
 * released candidate policy. This runs no generator, formula, ranking, damage,
 * or energy calculation.
 */
export function buildWeaponChoiceSearchCoverageReport(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  options: WeaponChoiceSearchCoverageOptions = {},
): WeaponChoiceSearchCoverageReport {
  const inputs = options.policyInputs ?? DEFAULT_POLICY_INPUTS;
  const expectedDomain = buildMirroredWeaponCandidateDomain(inputs);
  const candidateDomain = options.candidateDomain ?? expectedDomain;
  const candidatePairs = sortCandidates(candidateDomain.candidates);
  const expectedPairs = sortCandidates(expectedDomain.candidates);
  const candidateIndex = buildCandidateIndex(candidatePairs);
  const expectedIndex = buildCandidateIndex(expectedPairs);
  const candidateDomainComparison = compareCandidateDomains(
    candidateIndex,
    expectedIndex,
  );

  const observations = collectRawObservations(repository)
    .map((observation) =>
      classifyObservation(
        observation,
        inputs,
        candidateIndex,
        expectedIndex,
      ),
    )
    .sort((left, right) => left.observationId.localeCompare(right.observationId));
  requireUniqueObservationIds(observations);

  const deferredReferences = collectDeferredWeaponConditions(repository).sort(
    (left, right) => left.referenceId.localeCompare(right.referenceId),
  );
  requireUniqueDeferredReferenceIds(deferredReferences);

  return {
    schemaVersion: 1,
    classification: "weapon-choice-candidate-policy-coverage",
    supportsGuideClaims: false,
    generatedFrom: generatedFrom
      .map((input) => ({ ...input }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    searchSpace: {
      catalogScope: "released",
      implementation: MIRRORED_POLICY_LABEL,
      runtimePolicyPath: RUNTIME_POLICY_PATH,
      candidateDomainOrigin:
        options.candidateDomain == null
          ? "offline-mirror"
          : "provided-for-audit",
      candidateWeaponIds: [...candidateIndex.byWeaponId.keys()].sort(compareText),
      candidatePairs,
      counts: countCandidateDomain(candidatePairs),
      candidateDomainComparison,
    },
    summary: summarizeObservations(observations),
    deferredWeaponConditions: {
      analyzed: false,
      weaponConditionObjects: deferredReferences.length,
      explicitWeaponIdOccurrences: deferredReferences.reduce(
        (total, reference) =>
          total +
          (reference.weaponCondition.type === "specific"
            ? reference.weaponCondition.weaponIds.length
            : reference.weaponCondition.excludedWeaponIds.length),
        0,
      ),
      categoryConditions: deferredReferences.filter(
        ({ weaponCondition }) => weaponCondition.type === "category",
      ).length,
      references: deferredReferences,
    },
    observations,
    limitations: [
      "The weapon candidate builder is private runtime code, so this offline report mirrors its small released-catalog policy; source hashing and locked tests expose changes, but the default report cannot independently execute the private builder.",
      "An optional supplied candidate domain can be compared with the mirror for audit tests; the default offline-mirror comparison is not evidence that runtime code and the mirror are semantically identical.",
      "Runtime filters by the currently equipped seed weapon's type and skips a character when that seed lacks stats; this report audits a global candidate domain and reports native character-type compatibility separately.",
      "Weapon-ID domain membership only means the released search policy can name the weapon; it does not prove that generation, formula evaluation, or damage computation succeeds.",
      "An unspecified refinement remains an explicit source-data gap and is never counted as exact candidate coverage.",
      "Native weapon-type mismatch is reported independently from candidate-domain membership and does not decide which source is correct.",
      "Ordering, grouping, conditions, constellation scope, team context, investment, and provenance are preserved but not evaluated.",
      "Weapon conditions attached to ER targets are inventoried separately and deliberately receive no candidate, compatibility, or ER analysis.",
      "Rejected records are excluded from candidate observations but remain visible in the deferred weapon-condition inventory.",
    ],
    prohibitedInterpretations: [
      "score",
      "rank",
      "winner",
      "damage-result",
      "energy-result",
      "guide-recommendation",
    ],
  };
}

interface CandidateIndex {
  byPairKey: Map<string, MirroredWeaponCandidate>;
  byWeaponId: Map<string, MirroredWeaponCandidate[]>;
}

function buildCandidateIndex(
  candidates: readonly MirroredWeaponCandidate[],
): CandidateIndex {
  const byPairKey = new Map<string, MirroredWeaponCandidate>();
  const byWeaponId = new Map<string, MirroredWeaponCandidate[]>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate.weaponId, candidate.refinement);
    if (byPairKey.has(key)) {
      throw new Error(`Weapon candidate policy repeats ${key}.`);
    }
    const clone = { ...candidate };
    byPairKey.set(key, clone);
    const weaponCandidates = byWeaponId.get(candidate.weaponId) ?? [];
    weaponCandidates.push(clone);
    byWeaponId.set(candidate.weaponId, weaponCandidates);
  }
  for (const weaponCandidates of byWeaponId.values()) {
    weaponCandidates.sort((left, right) => left.refinement - right.refinement);
  }
  return { byPairKey, byWeaponId };
}

function compareCandidateDomains(
  candidateIndex: CandidateIndex,
  expectedIndex: CandidateIndex,
): WeaponChoiceSearchCoverageReport["searchSpace"]["candidateDomainComparison"] {
  const unexpectedOmissions = [...expectedIndex.byPairKey.keys()]
    .filter((key) => !candidateIndex.byPairKey.has(key))
    .sort(compareText);
  const unexpectedCandidates = [...candidateIndex.byPairKey.keys()]
    .filter((key) => !expectedIndex.byPairKey.has(key))
    .sort(compareText);
  const metadataMismatches = [...candidateIndex.byPairKey.entries()]
    .flatMap(([key, candidate]) => {
      const expected = expectedIndex.byPairKey.get(key);
      if (!expected) return [];
      const fields: Array<"weaponType" | "rarity"> = [];
      if (candidate.weaponType !== expected.weaponType) fields.push("weaponType");
      if (candidate.rarity !== expected.rarity) fields.push("rarity");
      return fields.length === 0 ? [] : [{ candidateKey: key, fields }];
    })
    .sort((left, right) => left.candidateKey.localeCompare(right.candidateKey));
  return {
    comparedAgainst: "offline-mirror",
    supportsRuntimeEquivalenceClaim: false,
    detected:
      unexpectedOmissions.length > 0 ||
      unexpectedCandidates.length > 0 ||
      metadataMismatches.length > 0,
    unexpectedOmissions,
    unexpectedCandidates,
    metadataMismatches,
  };
}

function classifyObservation(
  observation: RawWeaponObservation,
  inputs: WeaponChoiceSearchCoveragePolicyInputs,
  candidateIndex: CandidateIndex,
  expectedIndex: CandidateIndex,
): WeaponChoiceSearchCoverageObservation {
  const stats = inputs.weaponStats[observation.weaponId];
  const resource = inputs.releasedWeaponResources[observation.weaponId];
  const betaOnly = inputs.betaOnlyWeaponIds.has(observation.weaponId);
  const resolvedPolicyRarity = stats
    ? (resource?.rarity ?? stats.rarity)
    : undefined;
  const candidates = candidateIndex.byWeaponId.get(observation.weaponId) ?? [];
  const candidateRefinements = candidates.map(({ refinement }) => refinement);

  let weaponIdDomain: WeaponChoiceSearchCoverageObservation["weaponIdDomain"];
  if (betaOnly) {
    weaponIdDomain = {
      outcome: "excluded-from-released-candidate-domain",
      failureReason: "beta-only-weapon",
      weaponStatsAvailable: stats != null,
      releasedResourceAvailable: resource != null,
      betaOnly,
      ...(resolvedPolicyRarity == null ? {} : { resolvedPolicyRarity }),
      candidateRefinements,
    };
  } else if (stats == null) {
    weaponIdDomain = {
      outcome: "excluded-from-released-candidate-domain",
      failureReason: "missing-weapon-stats",
      weaponStatsAvailable: false,
      releasedResourceAvailable: resource != null,
      betaOnly,
      candidateRefinements,
    };
  } else if (resolvedPolicyRarity != null && resolvedPolicyRarity <= 2) {
    weaponIdDomain = {
      outcome: "excluded-from-released-candidate-domain",
      failureReason: "low-rarity-filter",
      weaponStatsAvailable: true,
      releasedResourceAvailable: resource != null,
      betaOnly,
      resolvedPolicyRarity,
      candidateRefinements,
    };
  } else if (candidates.length === 0) {
    weaponIdDomain = {
      outcome: "excluded-from-released-candidate-domain",
      failureReason: "unexpected-policy-omission",
      weaponStatsAvailable: true,
      releasedResourceAvailable: resource != null,
      betaOnly,
      ...(resolvedPolicyRarity == null ? {} : { resolvedPolicyRarity }),
      candidateRefinements,
    };
  } else {
    weaponIdDomain = {
      outcome: "in-released-candidate-domain",
      weaponStatsAvailable: true,
      releasedResourceAvailable: resource != null,
      betaOnly,
      ...(resolvedPolicyRarity == null ? {} : { resolvedPolicyRarity }),
      candidateRefinements,
    };
  }

  const refinementCoverage = classifyRefinement(
    observation,
    weaponIdDomain,
    candidateIndex,
    expectedIndex,
  );
  const characterWeaponType =
    inputs.characterWeaponTypes[observation.characterId];
  const weaponTypeFromStats = stats?.type;
  const nativeTypeCompatibility =
    characterWeaponType == null || weaponTypeFromStats == null
      ? {
          outcome: "unknown" as const,
          ...(characterWeaponType == null ? {} : { characterWeaponType }),
          ...(weaponTypeFromStats == null ? {} : { weaponTypeFromStats }),
        }
      : {
          outcome:
            characterWeaponType === weaponTypeFromStats
              ? ("compatible" as const)
              : ("mismatched" as const),
          characterWeaponType,
          weaponTypeFromStats,
        };

  return {
    ...cloneRawObservation(observation),
    weaponIdDomain,
    refinementCoverage,
    nativeTypeCompatibility,
  };
}

function classifyRefinement(
  observation: RawWeaponObservation,
  weaponIdDomain: WeaponChoiceSearchCoverageObservation["weaponIdDomain"],
  candidateIndex: CandidateIndex,
  expectedIndex: CandidateIndex,
): WeaponChoiceSearchCoverageObservation["refinementCoverage"] {
  if (observation.requestedRefinement == null) {
    return { outcome: "unspecified" };
  }

  const key = candidateKey(
    observation.weaponId,
    observation.requestedRefinement,
  );
  if (candidateIndex.byPairKey.has(key)) {
    return {
      outcome: "exact-candidate",
      requestedRefinement: observation.requestedRefinement,
    };
  }
  if (expectedIndex.byPairKey.has(key)) {
    return {
      outcome: "excluded-by-policy",
      requestedRefinement: observation.requestedRefinement,
      failureReason: "unexpected-policy-omission",
    };
  }
  return {
    outcome: "excluded-by-policy",
    requestedRefinement: observation.requestedRefinement,
    failureReason:
      weaponIdDomain.outcome === "in-released-candidate-domain"
        ? "refinement-not-enumerated-by-policy"
        : "weapon-id-outside-domain",
  };
}

function collectRawObservations(
  repository: KnowledgeRepository,
): RawWeaponObservation[] {
  return repository.records.flatMap((record) => {
    if (record.status === "rejected") return [];
    if (record.kind === "character_guide") {
      return collectGuideObservations(record);
    }
    if (record.kind === "team") return collectTeamObservations(record);
    return [];
  });
}

function collectGuideObservations(guide: CharacterGuide): RawWeaponObservation[] {
  const sourceRefs = guide.sourceRefs.map(cloneSourceReference);
  const observations: RawWeaponObservation[] = [];

  for (const [sourceListIndex, weaponId] of (
    guide.weaponOrder ?? []
  ).entries()) {
    observations.push({
      observationId: `${guide.id}:weapon-order:${sourceListIndex}`,
      recordId: guide.id,
      recordStatus: guide.status,
      characterId: guide.characterId,
      weaponId,
      sourceKind: "guide-weapon-order",
      sourceListIndex,
      sourceListLength: guide.weaponOrder?.length ?? 0,
      sourceRefs: sourceRefs.map(cloneSourceReference),
    });
  }

  for (const recommendation of guide.recommendations ?? []) {
    for (const [groupIndex, group] of (
      recommendation.weaponRecommendations ?? []
    ).entries()) {
      for (const [weaponIndex, weaponId] of group.weaponIds.entries()) {
        observations.push({
          observationId:
            `${guide.id}:recommendation:${recommendation.id}:` +
            `weapon-group:${groupIndex}:${weaponIndex}`,
          recordId: guide.id,
          recordStatus: guide.status,
          characterId: guide.characterId,
          weaponId,
          sourceKind: "character-guide-recommendation",
          recommendationId: recommendation.id,
          ...(recommendation.label == null
            ? {}
            : { recommendationLabel: recommendation.label }),
          ...(recommendation.weaponOrdering == null
            ? {}
            : { recommendationOrdering: recommendation.weaponOrdering }),
          recommendationGroupIndex: groupIndex,
          weaponIndex,
          grouping: group.grouping,
          classification: group.classification,
          conditions: [...group.conditions],
          ...(recommendation.minConstellation == null
            ? {}
            : { minConstellation: recommendation.minConstellation }),
          ...(recommendation.maxConstellation == null
            ? {}
            : { maxConstellation: recommendation.maxConstellation }),
          roles: [...recommendation.roles],
          sourceRefs: sourceRefs.map(cloneSourceReference),
        });
      }
    }
  }
  return observations;
}

function collectTeamObservations(team: KnowledgeTeam): RawWeaponObservation[] {
  const sourceRefs = team.sourceRefs.map(cloneSourceReference);
  const teamContext = cloneTeamContext(team);
  const observations: RawWeaponObservation[] = [];

  for (const [memberIndex, member] of team.members.entries()) {
    if (member.selectedWeapon != null) {
      observations.push({
        observationId: `${team.id}:member:${memberIndex}:selected-weapon`,
        recordId: team.id,
        recordStatus: team.status,
        characterId: member.characterId,
        weaponId: member.selectedWeapon.weaponId,
        ...(member.selectedWeapon.refinement == null
          ? {}
          : { requestedRefinement: member.selectedWeapon.refinement }),
        sourceKind: "team-selected-weapon",
        memberIndex,
        memberInvestment: cloneInvestment(member.investment),
        teamContext: cloneTeamContextValue(teamContext),
        sourceRefs: sourceRefs.map(cloneSourceReference),
      });
    }

    for (const [groupIndex, group] of (
      member.weaponRecommendations ?? []
    ).entries()) {
      for (const [weaponIndex, weaponId] of group.weaponIds.entries()) {
        observations.push({
          observationId:
            `${team.id}:member:${memberIndex}:weapon-group:` +
            `${groupIndex}:${weaponIndex}`,
          recordId: team.id,
          recordStatus: team.status,
          characterId: member.characterId,
          weaponId,
          sourceKind: "team-member-recommendation",
          memberIndex,
          memberInvestment: cloneInvestment(member.investment),
          teamContext: cloneTeamContextValue(teamContext),
          ...(member.weaponOrdering == null
            ? {}
            : { recommendationOrdering: member.weaponOrdering }),
          recommendationGroupIndex: groupIndex,
          weaponIndex,
          grouping: group.grouping,
          classification: group.classification,
          conditions: [...group.conditions],
          sourceRefs: sourceRefs.map(cloneSourceReference),
        });
      }
    }
  }
  return observations;
}

function collectDeferredWeaponConditions(
  repository: KnowledgeRepository,
): DeferredWeaponConditionReference[] {
  const references: DeferredWeaponConditionReference[] = [];
  for (const record of repository.records) {
    const sourceRefs = record.sourceRefs.map(cloneSourceReference);
    if (record.kind === "energy_guidance") {
      for (const [targetIndex, target] of record.targets.entries()) {
        if (target.weapon == null) continue;
        references.push({
          referenceId: `${record.id}:target:${targetIndex}:weapon-condition`,
          recordId: record.id,
          recordStatus: record.status,
          characterId: record.characterId,
          targetIndex,
          analyzed: false,
          conditions: [...target.conditions],
          weaponCondition: cloneWeaponCondition(target.weapon),
          sourceKind: "energy-guidance-target",
          ...(record.constellation == null
            ? {}
            : { constellation: record.constellation }),
          teamContext: {
            requiredCharacterIds: [...record.teamContext.requiredCharacterIds],
            oneOfCharacterIds: [...record.teamContext.oneOfCharacterIds],
          },
          sourceRefs: sourceRefs.map(cloneSourceReference),
        });
      }
      continue;
    }

    if (record.kind === "character_guide") {
      for (const recommendation of record.recommendations ?? []) {
        for (const [targetIndex, target] of (
          recommendation.erTargets ?? []
        ).entries()) {
          if (target.weapon == null) continue;
          references.push({
            referenceId:
              `${record.id}:recommendation:${recommendation.id}:` +
              `er-target:${targetIndex}:weapon-condition`,
            recordId: record.id,
            recordStatus: record.status,
            characterId: record.characterId,
            targetIndex,
            analyzed: false,
            conditions: [...target.conditions],
            weaponCondition: cloneWeaponCondition(target.weapon),
            sourceKind: "character-guide-er-target",
            recommendationId: recommendation.id,
            ...(recommendation.minConstellation == null
              ? {}
              : { minConstellation: recommendation.minConstellation }),
            ...(recommendation.maxConstellation == null
              ? {}
              : { maxConstellation: recommendation.maxConstellation }),
            roles: [...recommendation.roles],
            sourceRefs: sourceRefs.map(cloneSourceReference),
          });
        }
      }
      continue;
    }

    if (record.kind === "team") {
      const teamContext = cloneTeamContext(record);
      for (const [memberIndex, member] of record.members.entries()) {
        for (const [targetIndex, target] of (
          member.erTargets ?? []
        ).entries()) {
          if (target.weapon == null) continue;
          references.push({
            referenceId:
              `${record.id}:member:${memberIndex}:er-target:` +
              `${targetIndex}:weapon-condition`,
            recordId: record.id,
            recordStatus: record.status,
            characterId: member.characterId,
            targetIndex,
            analyzed: false,
            conditions: [...target.conditions],
            weaponCondition: cloneWeaponCondition(target.weapon),
            sourceKind: "team-member-er-target",
            memberIndex,
            memberInvestment: cloneInvestment(member.investment),
            teamContext: cloneTeamContextValue(teamContext),
            sourceRefs: sourceRefs.map(cloneSourceReference),
          });
        }
      }
    }
  }
  return references;
}

function summarizeObservations(
  observations: readonly WeaponChoiceSearchCoverageObservation[],
): WeaponChoiceSearchCoverageReport["summary"] {
  return {
    all: { total: observations.length },
    bySourceKind: {
      guideWeaponOrder: countSourceKind(observations, "guide-weapon-order"),
      teamSelectedWeapons: countSourceKind(
        observations,
        "team-selected-weapon",
      ),
      characterGuideRecommendations: countSourceKind(
        observations,
        "character-guide-recommendation",
      ),
      teamMemberRecommendations: countSourceKind(
        observations,
        "team-member-recommendation",
      ),
    },
    weaponIdDomain: {
      inReleasedCandidateDomain: observations.filter(
        ({ weaponIdDomain }) =>
          weaponIdDomain.outcome === "in-released-candidate-domain",
      ).length,
      excludedFromReleasedCandidateDomain: observations.filter(
        ({ weaponIdDomain }) =>
          weaponIdDomain.outcome ===
          "excluded-from-released-candidate-domain",
      ).length,
      byFailureReason: Object.fromEntries(
        WEAPON_ID_FAILURE_REASONS.map((reason) => [
          reason,
          observations.filter(
            ({ weaponIdDomain }) => weaponIdDomain.failureReason === reason,
          ).length,
        ]),
      ) as Record<WeaponIdDomainFailureReason, number>,
    },
    refinementCoverage: {
      exactCandidate: observations.filter(
        ({ refinementCoverage }) =>
          refinementCoverage.outcome === "exact-candidate",
      ).length,
      unspecified: observations.filter(
        ({ refinementCoverage }) =>
          refinementCoverage.outcome === "unspecified",
      ).length,
      excludedByPolicy: observations.filter(
        ({ refinementCoverage }) =>
          refinementCoverage.outcome === "excluded-by-policy",
      ).length,
      byFailureReason: Object.fromEntries(
        REFINEMENT_FAILURE_REASONS.map((reason) => [
          reason,
          observations.filter(
            ({ refinementCoverage }) =>
              refinementCoverage.failureReason === reason,
          ).length,
        ]),
      ) as Record<WeaponRefinementFailureReason, number>,
    },
    nativeTypeCompatibility: {
      compatible: observations.filter(
        ({ nativeTypeCompatibility }) =>
          nativeTypeCompatibility.outcome === "compatible",
      ).length,
      mismatched: observations.filter(
        ({ nativeTypeCompatibility }) =>
          nativeTypeCompatibility.outcome === "mismatched",
      ).length,
      unknown: observations.filter(
        ({ nativeTypeCompatibility }) =>
          nativeTypeCompatibility.outcome === "unknown",
      ).length,
    },
  };
}

function countCandidateDomain(
  candidates: readonly MirroredWeaponCandidate[],
): WeaponChoiceSearchCoverageReport["searchSpace"]["counts"] {
  const weaponRarities = new Map<string, number>();
  const weaponTypes = new Map<string, string>();
  const pairCounts = new Map<string, number>();
  const typePairCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const existingRarity = weaponRarities.get(candidate.weaponId);
    if (existingRarity != null && existingRarity !== candidate.rarity) {
      throw new Error(
        `Weapon candidate ${candidate.weaponId} has conflicting rarities.`,
      );
    }
    weaponRarities.set(candidate.weaponId, candidate.rarity);
    const existingType = weaponTypes.get(candidate.weaponId);
    if (existingType != null && existingType !== candidate.weaponType) {
      throw new Error(
        `Weapon candidate ${candidate.weaponId} has conflicting weapon types.`,
      );
    }
    weaponTypes.set(candidate.weaponId, candidate.weaponType);
    const rarityKey = String(candidate.rarity);
    pairCounts.set(rarityKey, (pairCounts.get(rarityKey) ?? 0) + 1);
    typePairCounts.set(
      candidate.weaponType,
      (typePairCounts.get(candidate.weaponType) ?? 0) + 1,
    );
  }
  const rarityKeys = new Set([
    ...[...weaponRarities.values()].map(String),
    ...pairCounts.keys(),
  ]);
  const byRarity = Object.fromEntries(
    [...rarityKeys]
      .sort((left, right) => Number(left) - Number(right))
      .map((rarity) => [
        rarity,
        {
          weaponIds: [...weaponRarities.values()].filter(
            (candidateRarity) => String(candidateRarity) === rarity,
          ).length,
          weaponRefinementPairs: pairCounts.get(rarity) ?? 0,
        },
      ]),
  );
  const byWeaponType = Object.fromEntries(
    [...new Set([...weaponTypes.values(), ...typePairCounts.keys()])]
      .sort(compareText)
      .map((weaponType) => [
        weaponType,
        {
          weaponIds: [...weaponTypes.values()].filter(
            (candidateType) => candidateType === weaponType,
          ).length,
          weaponRefinementPairs: typePairCounts.get(weaponType) ?? 0,
        },
      ]),
  );
  return {
    weaponIds: weaponRarities.size,
    weaponRefinementPairs: candidates.length,
    byRarity,
    byWeaponType,
  };
}

function countSourceKind(
  observations: readonly WeaponChoiceSearchCoverageObservation[],
  sourceKind: WeaponChoiceSearchCoverageObservation["sourceKind"],
): number {
  return observations.filter(
    (observation) => observation.sourceKind === sourceKind,
  ).length;
}

function sortCandidates(
  candidates: readonly MirroredWeaponCandidate[],
): MirroredWeaponCandidate[] {
  return candidates
    .map((candidate) => ({ ...candidate }))
    .sort(
      (left, right) =>
        compareText(left.weaponId, right.weaponId) ||
        left.refinement - right.refinement,
    );
}

function cloneRawObservation(
  observation: RawWeaponObservation,
): RawWeaponObservation {
  if (observation.sourceKind === "guide-weapon-order") {
    return {
      ...observation,
      sourceRefs: observation.sourceRefs.map(cloneSourceReference),
    };
  }
  if (observation.sourceKind === "character-guide-recommendation") {
    return {
      ...observation,
      conditions: [...observation.conditions],
      roles: [...observation.roles],
      sourceRefs: observation.sourceRefs.map(cloneSourceReference),
    };
  }
  return {
    ...observation,
    memberInvestment: cloneInvestment(observation.memberInvestment),
    teamContext: cloneTeamContextValue(observation.teamContext),
    ...(observation.sourceKind === "team-member-recommendation"
      ? { conditions: [...observation.conditions] }
      : {}),
    sourceRefs: observation.sourceRefs.map(cloneSourceReference),
  } as RawWeaponObservation;
}

function cloneTeamContext(team: KnowledgeTeam): TeamContext {
  return {
    ...(team.label == null ? {} : { label: team.label }),
    ...(team.intent == null ? {} : { intent: team.intent }),
    ...(team.exhaustiveness == null
      ? {}
      : { exhaustiveness: team.exhaustiveness }),
    ...(team.rankingClaim == null
      ? {}
      : { rankingClaim: team.rankingClaim }),
    reactions: [...(team.reactions ?? [])],
    characterIds: team.members.map(({ characterId }) => characterId),
  };
}

function cloneTeamContextValue(teamContext: TeamContext): TeamContext {
  return {
    ...teamContext,
    reactions: [...teamContext.reactions],
    characterIds: [...teamContext.characterIds],
  };
}

function cloneInvestment(
  investment: TeamMember["investment"],
): TeamMember["investment"] {
  if (investment.status === "unspecified") return { status: "unspecified" };
  if (investment.status === "partial") {
    return {
      status: "partial",
      ...(investment.constellation == null
        ? {}
        : { constellation: investment.constellation }),
      ...(investment.talentLevels == null
        ? {}
        : { talentLevels: [...investment.talentLevels] }),
    };
  }
  return {
    status: "specified",
    constellation: investment.constellation,
    talentLevels: [...investment.talentLevels],
  };
}

function cloneWeaponCondition(
  condition:
    | { type: "specific"; weaponIds: string[] }
    | {
        type: "category";
        weaponType: string;
        excludedWeaponIds: string[];
      },
): DeferredWeaponConditionReference["weaponCondition"] {
  return condition.type === "specific"
    ? { type: "specific", weaponIds: [...condition.weaponIds] }
    : {
        type: "category",
        weaponType: condition.weaponType,
        excludedWeaponIds: [...condition.excludedWeaponIds],
      };
}

function cloneSourceReference(reference: SourceReference): SourceReference {
  return { ...reference, locator: { ...reference.locator } };
}

function requireUniqueObservationIds(
  observations: readonly WeaponChoiceSearchCoverageObservation[],
): void {
  const seen = new Set<string>();
  for (const observation of observations) {
    if (seen.has(observation.observationId)) {
      throw new Error(
        `Weapon candidate coverage repeats observation ${observation.observationId}.`,
      );
    }
    seen.add(observation.observationId);
  }
}

function requireUniqueDeferredReferenceIds(
  references: readonly DeferredWeaponConditionReference[],
): void {
  const seen = new Set<string>();
  for (const reference of references) {
    if (seen.has(reference.referenceId)) {
      throw new Error(
        `Deferred weapon-condition inventory repeats ${reference.referenceId}.`,
      );
    }
    seen.add(reference.referenceId);
  }
}

function candidateKey(weaponId: string, refinement: number): string {
  return `${weaponId}@R${refinement}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
