import { statPools, TIER_LIST_OTHER_ARTIFACT_SETS } from "@/data/constants";
import {
  artifactHalfSetsById,
  artifactsById,
  betaArtifactIds,
} from "@/data/gameResources";
import {
  buildArtifactSetChoiceCandidates,
  buildTwoPieceArtifactChoiceCandidates,
} from "@/lib/team-comp/analyzer/weaponChoice";
import type {
  ArtifactChoice,
  KnowledgeRecord,
  KnowledgeRepository,
} from "./schemas";

export const ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS = [
  "scripts/guide-factory/src/artifactChoiceSearchCoverage.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/data/betaState.ts",
  "src/data/constants.ts",
  "src/data/enums.ts",
  "src/data/gameResources.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/data/types.ts",
  "src/lib/team-comp/analyzer/weaponChoice.ts",
] as const;

type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type KnowledgeStatus = KnowledgeRecord["status"];
type SourceReference = KnowledgeRecord["sourceRefs"][number];
type GuideRecommendation = NonNullable<
  CharacterGuide["recommendations"]
>[number];
type ArtifactRecommendation = NonNullable<
  GuideRecommendation["artifactRecommendations"]
>[number];
type TeamMember = KnowledgeTeam["members"][number];
type TeamArtifactPlan = NonNullable<KnowledgeTeam["artifactPlans"]>[number];

export type ArtifactChoiceSearchCoverageOutcome =
  | "enumerated-initially"
  | "conditionally-representable"
  | "not-representable";

export type ArtifactChoiceSearchFailureReason =
  | "beta-only-artifact"
  | "missing-runtime-artifact"
  | "non-five-star-filter"
  | "tier-list-other-filter"
  | "unexpected-initial-candidate-omission"
  | "missing-runtime-half-set"
  | "unmapped-dynamic-half-set-family"
  | "no-released-five-star-set-for-half-set"
  | "insufficient-distinct-released-five-star-sets"
  | "unexpected-conditional-candidate-omission";

type ObservationBase = {
  observationId: string;
  recordId: string;
  recordStatus: KnowledgeStatus;
  characterId: string;
  sourceRecordId: string;
  artifact: ArtifactChoice;
  outcome: ArtifactChoiceSearchCoverageOutcome;
  failureReason?: ArtifactChoiceSearchFailureReason;
  sourceRefs: SourceReference[];
};

export type ArtifactChoiceSearchCoverageObservation = ObservationBase &
  (
    | {
        sourceKind: "guide-build";
        visible: boolean;
        buildName?: string;
        minConstellation?: number;
        styles: string[];
        roles: string[];
      }
    | {
        sourceKind: "character-guide-recommendation";
        recommendationLabel?: string;
        recommendationGroupIndex: number;
        artifactIndex: number;
        grouping: ArtifactRecommendation["grouping"];
        classification: ArtifactRecommendation["classification"];
        conditions: string[];
        minConstellation?: number;
        maxConstellation?: number;
        roles: string[];
      }
    | {
        sourceKind: "team-selected-artifact";
        teamLabel?: string;
        teamIntent?: KnowledgeTeam["intent"];
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
      }
    | {
        sourceKind: "team-member-recommendation";
        teamLabel?: string;
        teamIntent?: KnowledgeTeam["intent"];
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
        recommendationGroupIndex: number;
        artifactIndex: number;
        grouping: ArtifactRecommendation["grouping"];
        classification: ArtifactRecommendation["classification"];
        conditions: string[];
      }
    | {
        sourceKind: "team-artifact-plan-assignment";
        teamLabel?: string;
        teamIntent?: KnowledgeTeam["intent"];
        planId: string;
        planLabel?: string;
        planClassification: TeamArtifactPlan["classification"];
        planConditions: string[];
        assignmentIndex: number;
        memberIndex: number;
        memberInvestment: TeamMember["investment"];
      }
  );

export interface ArtifactChoiceSearchCoverageCounts {
  total: number;
  enumeratedInitially: number;
  conditionallyRepresentable: number;
  notRepresentable: number;
}

export interface ArtifactChoiceSearchCoverageReport {
  schemaVersion: 2;
  classification: "artifact-choice-search-space-coverage";
  supportsGuideClaims: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  searchSpace: {
    catalogScope: "released";
    initialFourPieceKeys: string[];
    maximumConditionalTwoPieceKeys: string[];
    maximumDiscoverySubstatKeys: string[];
  };
  summary: {
    all: ArtifactChoiceSearchCoverageCounts;
    guideBuilds: ArtifactChoiceSearchCoverageCounts;
    teamSelectedArtifacts: ArtifactChoiceSearchCoverageCounts;
    recommendations: ArtifactChoiceSearchCoverageCounts;
    teamArtifactPlanAssignments: ArtifactChoiceSearchCoverageCounts;
    byFailureReason: Record<ArtifactChoiceSearchFailureReason, number>;
  };
  observations: ArtifactChoiceSearchCoverageObservation[];
  limitations: [
    "Initial 4-piece enumeration does not prove that artifact generation or damage evaluation succeeds for a set.",
    "The 2-piece search space is only a maximum grammar derived from every legal substat; runtime appends a potentially smaller set after successful 4-piece evaluations.",
    "Coverage means that the analyzer can name an artifact choice, not that the choice is suitable, competitive, or optimal for the character or team.",
    "Source conditions, visibility, constellation scope, and artifact-plan coupling are preserved but not evaluated.",
    "Rejected records are excluded; every artifact choice field on non-rejected character-guide and team records is otherwise audited.",
    "This report uses the released artifact catalog and fails if beta-only sets leak into the candidate grammar.",
    "Plan assignments are audited individually; coverage of every assignment does not prove that the analyzer can enumerate or optimize the coupled plan jointly.",
  ];
  prohibitedInterpretations: [
    "score",
    "rank",
    "winner",
    "damage-result",
    "energy-target",
    "guide-recommendation",
  ];
}

const FAILURE_REASONS: ArtifactChoiceSearchFailureReason[] = [
  "beta-only-artifact",
  "missing-runtime-artifact",
  "non-five-star-filter",
  "tier-list-other-filter",
  "unexpected-initial-candidate-omission",
  "missing-runtime-half-set",
  "unmapped-dynamic-half-set-family",
  "no-released-five-star-set-for-half-set",
  "insufficient-distinct-released-five-star-sets",
  "unexpected-conditional-candidate-omission",
];

/**
 * Audit whether the analyzer's existing artifact-choice grammar can express
 * artifact observations already present in the knowledge repository.
 *
 * This is search-domain coverage only. It deliberately runs no generator,
 * damage formula, ranking, or energy calculation.
 */
export function buildArtifactChoiceSearchCoverageReport(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): ArtifactChoiceSearchCoverageReport {
  const initialFourPieceKeys = uniqueSorted(
    buildArtifactSetChoiceCandidates().map((candidate) => {
      if (candidate.artifactSet.type !== "4pc") {
        throw new Error(
          "Artifact search coverage expected initial candidates to be 4-piece choices.",
        );
      }
      return candidate.artifactSet.setId;
    }),
    "initial 4-piece artifact candidate",
  );
  const leakedBetaKeys = initialFourPieceKeys.filter((key) =>
    betaArtifactIds.has(key),
  );
  if (leakedBetaKeys.length > 0) {
    throw new Error(
      `Released artifact search coverage contains beta-only candidates: ${leakedBetaKeys.join(", ")}.`,
    );
  }

  const maximumConditionalTwoPieceKeys = uniqueSorted(
    buildTwoPieceArtifactChoiceCandidates(statPools.substat).map((candidate) => {
      if (candidate.artifactSet.type !== "2pc+2pc") {
        throw new Error(
          "Artifact search coverage expected conditional candidates to be 2-piece plus 2-piece choices.",
        );
      }
      return artifactChoiceKey(candidate.artifactSet);
    }),
    "maximum conditional 2-piece artifact candidate",
  );
  const betaDependentConditionalKeys =
    maximumConditionalTwoPieceKeys.filter((key) => {
      const halfSetIds = key.split("+");
      if (halfSetIds.some((halfSetId) => releasedFiveStarSetIds(halfSetId).length === 0)) {
        return true;
      }
      return (
        halfSetIds[0] === halfSetIds[1] &&
        releasedFiveStarSetIds(halfSetIds[0]).length < 2
      );
    });
  if (betaDependentConditionalKeys.length > 0) {
    throw new Error(
      "Released artifact search coverage contains beta-dependent conditional " +
        `candidates: ${betaDependentConditionalKeys.join(", ")}.`,
    );
  }
  const searchSpace = buildSearchSpaceIndex(
    initialFourPieceKeys,
    maximumConditionalTwoPieceKeys,
  );

  const observations = repository.records
    .flatMap((record) => {
      if (record.kind === "character_guide") {
        return collectGuideObservations(record, searchSpace);
      }
      if (record.kind === "team") {
        return collectTeamObservations(record, searchSpace);
      }
      return [];
    })
    .sort((left, right) => left.observationId.localeCompare(right.observationId));
  requireUniqueObservationIds(observations);

  const guideBuilds = observations.filter(
    ({ sourceKind }) => sourceKind === "guide-build",
  );
  const teamSelectedArtifacts = observations.filter(
    ({ sourceKind }) => sourceKind === "team-selected-artifact",
  );
  const recommendations = observations.filter(
    ({ sourceKind }) =>
      sourceKind === "character-guide-recommendation" ||
      sourceKind === "team-member-recommendation",
  );
  const teamArtifactPlanAssignments = observations.filter(
    ({ sourceKind }) => sourceKind === "team-artifact-plan-assignment",
  );

  return {
    schemaVersion: 2,
    classification: "artifact-choice-search-space-coverage",
    supportsGuideClaims: false,
    generatedFrom: generatedFrom
      .map((input) => ({ ...input }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    searchSpace: {
      catalogScope: "released",
      initialFourPieceKeys,
      maximumConditionalTwoPieceKeys,
      maximumDiscoverySubstatKeys: [...statPools.substat].sort(compareText),
    },
    summary: {
      all: countOutcomes(observations),
      guideBuilds: countOutcomes(guideBuilds),
      teamSelectedArtifacts: countOutcomes(teamSelectedArtifacts),
      recommendations: countOutcomes(recommendations),
      teamArtifactPlanAssignments: countOutcomes(
        teamArtifactPlanAssignments,
      ),
      byFailureReason: Object.fromEntries(
        FAILURE_REASONS.map((reason) => [
          reason,
          observations.filter(
            (observation) => observation.failureReason === reason,
          ).length,
        ]),
      ) as Record<ArtifactChoiceSearchFailureReason, number>,
    },
    observations,
    limitations: [
      "Initial 4-piece enumeration does not prove that artifact generation or damage evaluation succeeds for a set.",
      "The 2-piece search space is only a maximum grammar derived from every legal substat; runtime appends a potentially smaller set after successful 4-piece evaluations.",
      "Coverage means that the analyzer can name an artifact choice, not that the choice is suitable, competitive, or optimal for the character or team.",
      "Source conditions, visibility, constellation scope, and artifact-plan coupling are preserved but not evaluated.",
      "Rejected records are excluded; every artifact choice field on non-rejected character-guide and team records is otherwise audited.",
      "This report uses the released artifact catalog and fails if beta-only sets leak into the candidate grammar.",
      "Plan assignments are audited individually; coverage of every assignment does not prove that the analyzer can enumerate or optimize the coupled plan jointly.",
    ],
    prohibitedInterpretations: [
      "score",
      "rank",
      "winner",
      "damage-result",
      "energy-target",
      "guide-recommendation",
    ],
  };
}

type SearchSpaceIndex = {
  initialFourPieceKeys: ReadonlySet<string>;
  maximumConditionalTwoPieceKeys: ReadonlySet<string>;
  dynamicallyDiscoverableHalfSetIds: ReadonlySet<string>;
};

function buildSearchSpaceIndex(
  initialFourPieceKeys: readonly string[],
  maximumConditionalTwoPieceKeys: readonly string[],
): SearchSpaceIndex {
  const dynamicallyDiscoverableHalfSetIds = new Set<string>();
  for (const key of maximumConditionalTwoPieceKeys) {
    for (const halfSetId of key.split("+")) {
      dynamicallyDiscoverableHalfSetIds.add(halfSetId);
    }
  }
  return {
    initialFourPieceKeys: new Set(initialFourPieceKeys),
    maximumConditionalTwoPieceKeys: new Set(maximumConditionalTwoPieceKeys),
    dynamicallyDiscoverableHalfSetIds,
  };
}

function collectGuideObservations(
  guide: CharacterGuide,
  searchSpace: SearchSpaceIndex,
): ArtifactChoiceSearchCoverageObservation[] {
  const sourceRefs = guide.sourceRefs.map(cloneSourceReference);
  const observations: ArtifactChoiceSearchCoverageObservation[] = [];

  if (guide.status !== "rejected") {
    for (const build of guide.builds) {
      observations.push({
        observationId: `${guide.id}:build:${build.sourceRecordId}`,
        recordId: guide.id,
        recordStatus: guide.status,
        characterId: guide.characterId,
        sourceKind: "guide-build",
        sourceRecordId: build.sourceRecordId,
        visible: build.visible,
        ...(build.name == null ? {} : { buildName: build.name }),
        ...(build.minConstellation == null
          ? {}
          : { minConstellation: build.minConstellation }),
        styles: [...(build.styles ?? [])],
        roles: [...(build.roles ?? [])],
        artifact: cloneArtifact(build.artifact),
        ...classifyArtifactChoice(build.artifact, searchSpace),
        sourceRefs: sourceRefs.map(cloneSourceReference),
      });
    }
  }

  if (guide.status === "rejected") return observations;
  for (const recommendation of guide.recommendations ?? []) {
    for (const [groupIndex, group] of (
      recommendation.artifactRecommendations ?? []
    ).entries()) {
      for (const [artifactIndex, artifact] of group.artifacts.entries()) {
        observations.push({
          observationId:
            `${guide.id}:recommendation:${recommendation.id}:` +
            `${groupIndex}:${artifactIndex}`,
          recordId: guide.id,
          recordStatus: guide.status,
          characterId: guide.characterId,
          sourceKind: "character-guide-recommendation",
          sourceRecordId: recommendation.id,
          ...(recommendation.label == null
            ? {}
            : { recommendationLabel: recommendation.label }),
          recommendationGroupIndex: groupIndex,
          artifactIndex,
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
          artifact: cloneArtifact(artifact),
          ...classifyArtifactChoice(artifact, searchSpace),
          sourceRefs: sourceRefs.map(cloneSourceReference),
        });
      }
    }
  }
  return observations;
}

function collectTeamObservations(
  team: KnowledgeTeam,
  searchSpace: SearchSpaceIndex,
): ArtifactChoiceSearchCoverageObservation[] {
  if (team.status === "rejected") return [];

  const sourceRefs = team.sourceRefs.map(cloneSourceReference);
  const sourceRecordId = requiredTeamSourceRecordId(team.id, sourceRefs);

  const observations: ArtifactChoiceSearchCoverageObservation[] = [];
  for (const [memberIndex, member] of team.members.entries()) {
    if (member.selectedArtifact != null) {
      observations.push({
        observationId: `${team.id}:member:${memberIndex}:selected-artifact`,
        recordId: team.id,
        recordStatus: team.status,
        characterId: member.characterId,
        sourceKind: "team-selected-artifact",
        sourceRecordId,
        ...(team.label == null ? {} : { teamLabel: team.label }),
        ...(team.intent == null ? {} : { teamIntent: team.intent }),
        memberIndex,
        memberInvestment: cloneInvestment(member.investment),
        artifact: cloneArtifact(member.selectedArtifact),
        ...classifyArtifactChoice(member.selectedArtifact, searchSpace),
        sourceRefs: sourceRefs.map(cloneSourceReference),
      });
    }
    for (const [groupIndex, group] of (
      member.artifactRecommendations ?? []
    ).entries()) {
      for (const [artifactIndex, artifact] of group.artifacts.entries()) {
        observations.push({
          observationId:
            `${team.id}:member:${memberIndex}:artifact-group:` +
            `${groupIndex}:${artifactIndex}`,
          recordId: team.id,
          recordStatus: team.status,
          characterId: member.characterId,
          sourceKind: "team-member-recommendation",
          sourceRecordId,
          ...(team.label == null ? {} : { teamLabel: team.label }),
          ...(team.intent == null ? {} : { teamIntent: team.intent }),
          memberIndex,
          memberInvestment: cloneInvestment(member.investment),
          recommendationGroupIndex: groupIndex,
          artifactIndex,
          grouping: group.grouping,
          classification: group.classification,
          conditions: [...group.conditions],
          artifact: cloneArtifact(artifact),
          ...classifyArtifactChoice(artifact, searchSpace),
          sourceRefs: sourceRefs.map(cloneSourceReference),
        });
      }
    }
  }
  for (const plan of team.artifactPlans ?? []) {
    for (const [assignmentIndex, assignment] of plan.assignments.entries()) {
      const memberIndex = team.members.findIndex(
        ({ characterId }) => characterId === assignment.characterId,
      );
      if (memberIndex < 0) {
        throw new Error(
          `Artifact search coverage plan ${team.id}/${plan.id} assigns non-member ${assignment.characterId}.`,
        );
      }
      const member = team.members[memberIndex];
      observations.push({
        observationId:
          `${team.id}:artifact-plan:${plan.id}:assignment:` +
          assignmentIndex,
        recordId: team.id,
        recordStatus: team.status,
        characterId: assignment.characterId,
        sourceKind: "team-artifact-plan-assignment",
        sourceRecordId,
        ...(team.label == null ? {} : { teamLabel: team.label }),
        ...(team.intent == null ? {} : { teamIntent: team.intent }),
        planId: plan.id,
        ...(plan.label == null ? {} : { planLabel: plan.label }),
        planClassification: plan.classification,
        planConditions: [...plan.conditions],
        assignmentIndex,
        memberIndex,
        memberInvestment: cloneInvestment(member.investment),
        artifact: cloneArtifact(assignment.artifact),
        ...classifyArtifactChoice(assignment.artifact, searchSpace),
        sourceRefs: sourceRefs.map(cloneSourceReference),
      });
    }
  }
  return observations;
}

function classifyArtifactChoice(
  artifact: ArtifactChoice,
  searchSpace: SearchSpaceIndex,
): Pick<
  ArtifactChoiceSearchCoverageObservation,
  "outcome" | "failureReason"
> {
  if (artifact.type === "4pc") {
    const failureReason = fourPieceFailureReason(artifact.setId, searchSpace);
    return failureReason == null
      ? { outcome: "enumerated-initially" }
      : { outcome: "not-representable", failureReason };
  }

  const failureReason = twoPieceFailureReason(
    artifact.halfSetIds,
    searchSpace,
  );
  return failureReason == null
    ? { outcome: "conditionally-representable" }
    : { outcome: "not-representable", failureReason };
}

function fourPieceFailureReason(
  setId: string,
  searchSpace: SearchSpaceIndex,
): ArtifactChoiceSearchFailureReason | null {
  if (betaArtifactIds.has(setId)) return "beta-only-artifact";
  const artifact = artifactsById[setId];
  if (!artifact) return "missing-runtime-artifact";
  if (artifact.rarity !== 5) return "non-five-star-filter";
  if (TIER_LIST_OTHER_ARTIFACT_SETS.has(setId)) {
    return "tier-list-other-filter";
  }
  return searchSpace.initialFourPieceKeys.has(setId)
    ? null
    : "unexpected-initial-candidate-omission";
}

function twoPieceFailureReason(
  halfSetIds: readonly [string, string],
  searchSpace: SearchSpaceIndex,
): ArtifactChoiceSearchFailureReason | null {
  const normalized = [...halfSetIds].sort(compareText) as [string, string];
  for (const halfSetId of normalized) {
    if (!artifactHalfSetsById[halfSetId]) return "missing-runtime-half-set";
  }
  for (const halfSetId of normalized) {
    if (releasedFiveStarSetIds(halfSetId).length === 0) {
      return "no-released-five-star-set-for-half-set";
    }
  }
  for (const halfSetId of normalized) {
    if (!searchSpace.dynamicallyDiscoverableHalfSetIds.has(halfSetId)) {
      return "unmapped-dynamic-half-set-family";
    }
  }
  if (
    normalized[0] === normalized[1] &&
    releasedFiveStarSetIds(normalized[0]).length < 2
  ) {
    return "insufficient-distinct-released-five-star-sets";
  }
  return searchSpace.maximumConditionalTwoPieceKeys.has(normalized.join("+"))
    ? null
    : "unexpected-conditional-candidate-omission";
}

function releasedFiveStarSetIds(halfSetId: string): string[] {
  return (artifactHalfSetsById[halfSetId]?.setIds ?? []).filter(
    (setId) =>
      !betaArtifactIds.has(setId) && artifactsById[setId]?.rarity === 5,
  );
}

function artifactChoiceKey(artifact: ArtifactChoice): string {
  return artifact.type === "4pc"
    ? artifact.setId
    : [...artifact.halfSetIds].sort(compareText).join("+");
}

function countOutcomes(
  observations: readonly ArtifactChoiceSearchCoverageObservation[],
): ArtifactChoiceSearchCoverageCounts {
  return {
    total: observations.length,
    enumeratedInitially: observations.filter(
      ({ outcome }) => outcome === "enumerated-initially",
    ).length,
    conditionallyRepresentable: observations.filter(
      ({ outcome }) => outcome === "conditionally-representable",
    ).length,
    notRepresentable: observations.filter(
      ({ outcome }) => outcome === "not-representable",
    ).length,
  };
}

function uniqueSorted(values: string[], label: string): string[] {
  const sorted = [...values].sort(compareText);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index] === sorted[index - 1]) {
      throw new Error(`${label} repeats ${sorted[index]}.`);
    }
  }
  return sorted;
}

function requireUniqueObservationIds(
  observations: readonly ArtifactChoiceSearchCoverageObservation[],
): void {
  const seen = new Set<string>();
  for (const observation of observations) {
    if (seen.has(observation.observationId)) {
      throw new Error(
        `Artifact search coverage repeats observation ${observation.observationId}.`,
      );
    }
    seen.add(observation.observationId);
  }
}

function cloneArtifact(artifact: ArtifactChoice): ArtifactChoice {
  return artifact.type === "4pc"
    ? { type: "4pc", setId: artifact.setId }
    : {
        type: "2pc+2pc",
        halfSetIds: [artifact.halfSetIds[0], artifact.halfSetIds[1]],
      };
}

function cloneSourceReference(reference: SourceReference): SourceReference {
  return { ...reference, locator: { ...reference.locator } };
}

function cloneInvestment(investment: TeamMember["investment"]): TeamMember["investment"] {
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

function requiredTeamSourceRecordId(
  teamId: string,
  sourceRefs: readonly SourceReference[],
): string {
  const sourceClaims = new Map(
    sourceRefs.map((reference) => [
      `${reference.sourceId}\0${reference.sourceRecordId}`,
      reference.sourceRecordId,
    ]),
  );
  if (sourceClaims.size !== 1) {
    throw new Error(
      `Artifact search coverage team ${teamId} requires exactly one source claim; found ${sourceClaims.size}.`,
    );
  }
  const sourceRecordId = [...sourceClaims.values()][0];
  if (!sourceRecordId) {
    throw new Error(
      `Artifact search coverage team ${teamId} has no source record ID.`,
    );
  }
  return sourceRecordId;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
