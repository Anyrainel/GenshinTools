import type { GameCatalogs } from "./catalogs";
import type { KnowledgeRecord, KnowledgeRepository } from "./schemas";

export const TEAM_TEMPLATE_COVERAGE_INPUT_PATHS = [
  "scripts/guide-factory/src/catalogs.ts",
  "scripts/guide-factory/src/teamTemplateCoverage.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/data/game/character_stats.json",
] as const;

type BaselineTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type TeamTemplate = Extract<KnowledgeRecord, { kind: "team_template" }>;
type SourceReference = TeamTemplate["sourceRefs"][number];
type TemplateSlot = TeamTemplate["slots"][number];

type CandidateEvaluation =
  | { outcome: "match"; unresolvedRoleIds: [] }
  | { outcome: "unresolved"; unresolvedRoleIds: string[] }
  | { outcome: "no-match"; unresolvedRoleIds: [] };

type SlotEvaluation =
  | { outcome: "match"; unresolvedRoleIds: [] }
  | { outcome: "unresolved"; unresolvedRoleIds: string[] }
  | { outcome: "no-match"; unresolvedRoleIds: [] };

export type TeamTemplateCoverageOutcome =
  | "present"
  | "unresolved"
  | "uncovered";

export interface TeamTemplateCoverageEntry {
  templateId: string;
  outcome: TeamTemplateCoverageOutcome;
  matchedBaselineTeamIds: string[];
  unresolvedBaselineTeamIds: string[];
  unresolvedRoleIds: string[];
  sourceRefs: SourceReference[];
}

export interface ExternalExactTeamCoverageEntry {
  teamId: string;
  outcome: "present" | "uncovered";
  matchedBaselineTeamIds: string[];
  sourceRefs: BaselineTeam["sourceRefs"];
}

export interface TeamTemplateCoverageReport {
  schemaVersion: 1;
  generatedFrom: Array<{ path: string; sha256: string }>;
  limitations: [
    "Templates and promotion-ineligible external exact teams are compared only with exact team records carrying baseline status.",
    "Character, element, and any selectors are resolved; role selectors remain unresolved because no role catalog is available.",
    "Coverage measures repository overlap, not gameplay quality, rotation validity, damage, or optimality.",
  ];
  prohibitedAggregates: ["score", "rank", "winner"];
  templates: TeamTemplateCoverageEntry[];
  exactTeams: ExternalExactTeamCoverageEntry[];
}

const MEMBER_ASSIGNMENTS = permutations([0, 1, 2, 3]);

export function buildTeamTemplateCoverageReport(
  repository: KnowledgeRepository,
  catalogs: GameCatalogs,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): TeamTemplateCoverageReport {
  const baselineTeams = repository.records
    .filter(
      (record): record is BaselineTeam =>
        record.kind === "team" && record.status === "baseline",
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const templates = repository.records
    .filter(
      (record): record is TeamTemplate => record.kind === "team_template",
    )
    .filter(({ status }) => status !== "rejected")
    .sort((left, right) => left.id.localeCompare(right.id));
  const externalExactTeams = repository.records
    .filter(
      (record): record is BaselineTeam =>
        record.kind === "team" &&
        record.promotionEligible === false &&
        record.status !== "rejected",
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    schemaVersion: 1,
    generatedFrom: generatedFrom
      .map((file) => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    limitations: [
      "Templates and promotion-ineligible external exact teams are compared only with exact team records carrying baseline status.",
      "Character, element, and any selectors are resolved; role selectors remain unresolved because no role catalog is available.",
      "Coverage measures repository overlap, not gameplay quality, rotation validity, damage, or optimality.",
    ],
    prohibitedAggregates: ["score", "rank", "winner"],
    templates: templates.map((template) =>
      buildTemplateCoverage(template, baselineTeams, catalogs),
    ),
    exactTeams: externalExactTeams.map((team) =>
      buildExactTeamCoverage(team, baselineTeams),
    ),
  };
}

function buildExactTeamCoverage(
  team: BaselineTeam,
  baselineTeams: BaselineTeam[],
): ExternalExactTeamCoverageEntry {
  const memberKey = exactMemberKey(team);
  const matchedBaselineTeamIds = baselineTeams
    .filter((baseline) => exactMemberKey(baseline) === memberKey)
    .map(({ id }) => id)
    .sort((left, right) => left.localeCompare(right));
  return {
    teamId: team.id,
    outcome: matchedBaselineTeamIds.length > 0 ? "present" : "uncovered",
    matchedBaselineTeamIds,
    sourceRefs: [...team.sourceRefs]
      .map(cloneSourceReference)
      .sort(compareSourceReferences),
  };
}

function exactMemberKey(team: BaselineTeam): string {
  return team.members
    .map(({ characterId }) => characterId)
    .sort((left, right) => left.localeCompare(right))
    .join("\0");
}

function buildTemplateCoverage(
  template: TeamTemplate,
  baselineTeams: BaselineTeam[],
  catalogs: GameCatalogs,
): TeamTemplateCoverageEntry {
  const matchedBaselineTeamIds = new Set<string>();
  const unresolvedBaselineTeamIds = new Set<string>();
  const unresolvedRoleIds = new Set<string>();

  for (const team of baselineTeams) {
    const evaluation = evaluateCandidate(template, team, catalogs);
    if (evaluation.outcome === "match") {
      matchedBaselineTeamIds.add(team.id);
      continue;
    }
    if (evaluation.outcome === "unresolved") {
      unresolvedBaselineTeamIds.add(team.id);
      for (const roleId of evaluation.unresolvedRoleIds) {
        unresolvedRoleIds.add(roleId);
      }
    }
  }

  return {
    templateId: template.id,
    outcome:
      matchedBaselineTeamIds.size > 0
        ? "present"
        : unresolvedBaselineTeamIds.size > 0
          ? "unresolved"
          : "uncovered",
    matchedBaselineTeamIds: sorted(matchedBaselineTeamIds),
    unresolvedBaselineTeamIds: sorted(unresolvedBaselineTeamIds),
    unresolvedRoleIds: sorted(unresolvedRoleIds),
    sourceRefs: [...template.sourceRefs]
      .map(cloneSourceReference)
      .sort(compareSourceReferences),
  };
}

function evaluateCandidate(
  template: TeamTemplate,
  team: BaselineTeam,
  catalogs: GameCatalogs,
): CandidateEvaluation {
  const unresolvedRoleIds = new Set<string>();

  for (const assignment of MEMBER_ASSIGNMENTS) {
    const evaluation = evaluateAssignment(template, team, assignment, catalogs);
    if (evaluation.outcome === "match") {
      return { outcome: "match", unresolvedRoleIds: [] };
    }
    if (evaluation.outcome === "unresolved") {
      for (const roleId of evaluation.unresolvedRoleIds) {
        unresolvedRoleIds.add(roleId);
      }
    }
  }

  return unresolvedRoleIds.size > 0
    ? { outcome: "unresolved", unresolvedRoleIds: sorted(unresolvedRoleIds) }
    : { outcome: "no-match", unresolvedRoleIds: [] };
}

function evaluateAssignment(
  template: TeamTemplate,
  team: BaselineTeam,
  assignment: number[],
  catalogs: GameCatalogs,
): CandidateEvaluation {
  const unresolvedRoleIds = new Set<string>();

  for (const [slotIndex, slot] of template.slots.entries()) {
    const memberIndex = assignment[slotIndex];
    const member = memberIndex == null ? undefined : team.members[memberIndex];
    if (!member) return { outcome: "no-match", unresolvedRoleIds: [] };

    const evaluation = evaluateSlot(slot, member.characterId, catalogs);
    if (evaluation.outcome === "no-match") {
      return { outcome: "no-match", unresolvedRoleIds: [] };
    }
    if (evaluation.outcome === "unresolved") {
      for (const roleId of evaluation.unresolvedRoleIds) {
        unresolvedRoleIds.add(roleId);
      }
    }
  }

  return unresolvedRoleIds.size > 0
    ? { outcome: "unresolved", unresolvedRoleIds: sorted(unresolvedRoleIds) }
    : { outcome: "match", unresolvedRoleIds: [] };
}

function evaluateSlot(
  slot: TemplateSlot,
  characterId: string,
  catalogs: GameCatalogs,
): SlotEvaluation {
  const unresolvedRoleIds = new Set<string>();
  const characterElement = catalogs.characterElements.get(characterId);

  for (const option of slot.options) {
    if (option.type === "any") {
      return { outcome: "match", unresolvedRoleIds: [] };
    }
    if (
      option.type === "characters" &&
      option.characterIds.includes(characterId)
    ) {
      return { outcome: "match", unresolvedRoleIds: [] };
    }
    if (
      option.type === "elements" &&
      characterElement != null &&
      option.elements.some((element) => element === characterElement)
    ) {
      return { outcome: "match", unresolvedRoleIds: [] };
    }
    if (option.type === "roles") {
      for (const roleId of option.roleIds) unresolvedRoleIds.add(roleId);
    }
  }

  return unresolvedRoleIds.size > 0
    ? { outcome: "unresolved", unresolvedRoleIds: sorted(unresolvedRoleIds) }
    : { outcome: "no-match", unresolvedRoleIds: [] };
}

function permutations(values: number[]): number[][] {
  if (values.length === 0) return [[]];

  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidateIndex) => candidateIndex !== index)).map(
      (tail) => [value, ...tail],
    ),
  );
}

function cloneSourceReference(reference: SourceReference): SourceReference {
  return {
    ...reference,
    locator: { ...reference.locator },
  };
}

function compareSourceReferences(
  left: SourceReference,
  right: SourceReference,
): number {
  return sourceReferenceKey(left).localeCompare(sourceReferenceKey(right));
}

function sourceReferenceKey(reference: SourceReference): string {
  const locator =
    "file" in reference.locator
      ? [
          "file",
          reference.locator.file,
          reference.locator.recordId ?? "",
          reference.locator.jsonPointer ?? "",
        ]
      : [
          "url",
          reference.locator.url,
          reference.locator.heading ?? "",
          reference.locator.timestamp ?? "",
        ];
  return [reference.sourceId, reference.sourceRecordId, ...locator].join("\0");
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
