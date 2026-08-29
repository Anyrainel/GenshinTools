import { createHash } from "node:crypto";
import type { ReactionType } from "@/data/enums";
import { characterStatsResource } from "@/data/gameStatsLoader";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import { GUIDE_FACTORY_TEAM_REACTION_IDS } from "./catalogs";
import type { KnowledgeRecord } from "./schemas";

export type TeamTemplateRecord = Extract<
  KnowledgeRecord,
  { kind: "team_template" }
>;

export interface ReleasedCharacterCatalogEntry {
  characterId: string;
  elementId: string;
  /**
   * IDs which represent mutually exclusive forms of one playable character
   * share an identity. Traveler forms are also normalized defensively when
   * callers omit this field.
   */
  playableIdentityId?: string;
}

export type HoldoutExpectedOutcome =
  | "accepted"
  | "reaction-rejected"
  | "structural-rejected"
  | "template-withheld"
  | "template-not-comparable"
  | "invalid-target";

export interface TeamRosterHoldoutTarget {
  targetId: string;
  templateId: string;
  memberCharacterIds: readonly [string, string, string, string];
  expectedOutcome: HoldoutExpectedOutcome;
  expectedStructuralAssignmentMultiplicity?: number;
  /** Explicit validation binding from template slot ID to character ID. */
  sourceSlotBinding?: Readonly<Record<string, string>>;
  /**
   * How the slot fit was constructed. A same-page fit is still an inference;
   * neither value means the source published a machine-readable binding.
   */
  sourceSlotBindingBasis?:
    | "same-page-inferred-fit"
    | "cross-page-audit-fit";
  category?: string;
  provenance?: {
    sourceId: string;
    sourceRecordId: string;
  };
}

export interface TeamRosterCandidateDomainInput {
  templates: readonly TeamTemplateRecord[];
  /** This boundary must already exclude beta and otherwise ineligible forms. */
  releasedCharacters: readonly ReleasedCharacterCatalogEntry[];
  holdoutTargets: readonly TeamRosterHoldoutTarget[];
}

export interface TeamRosterReactionGateInput {
  templateId: string;
  memberCharacterIds: readonly [string, string, string, string];
  declaredReactions: readonly ReactionType[];
  assumptions: {
    constellations: Readonly<Record<string, 0>>;
    enemyAura: null;
  };
}

export interface TeamRosterReactionGateResult {
  accepted: boolean;
  byReaction: Readonly<Record<string, boolean>>;
}

export interface TeamRosterReactionGateEnvironment {
  prepare?(): Promise<void>;
  evaluate(
    input: TeamRosterReactionGateInput,
  ): TeamRosterReactionGateResult | Promise<TeamRosterReactionGateResult>;
}

export type TeamRosterCandidateDomainFailureCode =
  | "invalid-catalog-entry"
  | "duplicate-catalog-character"
  | "duplicate-template-id"
  | "unknown-explicit-character"
  | "invalid-template-slot"
  | "invalid-template-reaction"
  | "unsafe-search-size"
  | "reaction-gate-prepare-failed"
  | "reaction-gate-evaluate-failed"
  | "reaction-gate-invalid-result"
  | "invalid-holdout-target"
  | "unknown-holdout-template"
  | "duplicate-holdout-target"
  | "holdout-expectation-mismatch";

export interface TeamRosterCandidateDomainFailure {
  code: TeamRosterCandidateDomainFailureCode;
  stage:
    | "catalog"
    | "selector-resolution"
    | "enumeration"
    | "reaction-gate"
    | "holdout";
  scope: "report" | "template" | "holdout";
  templateId?: string;
  targetId?: string;
  message: string;
}

export type TeamRosterCandidateTemplateStatus =
  | "comparable"
  | "withheld-unresolved-role"
  | "not-comparable";

export interface TeamRosterSlotPoolReport {
  slotIndex: number;
  slotId: string;
  resolution: "resolved" | "unresolved-role" | "failed";
  poolSize: number | null;
  poolSha256: string | null;
  unresolvedRoleIds: string[];
}

export interface AssignmentMultiplicityHistogramEntry {
  assignmentCount: number;
  rosterCount: number;
}

export interface TeamRosterReactionGateReport {
  status: "completed" | "failed";
  declaredReactions: string[];
  acceptedCanonicalRosterCount: number | null;
  rejectedCanonicalRosterCount: number | null;
  acceptedOrderedAssignmentCount: number | null;
  rejectedOrderedAssignmentCount: number | null;
}

export interface TeamRosterCandidateTemplateReport {
  templateId: string;
  status: TeamRosterCandidateTemplateStatus;
  unresolvedRoleIds: string[];
  slotPools: TeamRosterSlotPoolReport[];
  theoreticalOrderedAssignmentCount: number | null;
  validOrderedAssignmentCount: number | null;
  duplicateMemberAssignmentRejectionCount: number | null;
  exactDuplicateMemberAssignmentRejectionCount: number | null;
  samePlayableIdentityAssignmentRejectionCount: number | null;
  canonicalRosterCount: number | null;
  assignmentMultiplicityHistogram: AssignmentMultiplicityHistogramEntry[];
  structuralDomainSha256: string | null;
  reactionAcceptedDomainSha256: string | null;
  reactionGate: TeamRosterReactionGateReport | null;
  failures: TeamRosterCandidateDomainFailure[];
}

export type HoldoutActualOutcome = HoldoutExpectedOutcome;

export interface TeamRosterHoldoutOutcome {
  targetId: string;
  templateId: string;
  memberCharacterIds: string[];
  expectedOutcome: HoldoutExpectedOutcome;
  expectedStructuralAssignmentMultiplicity: number | null;
  category: string | null;
  provenance: {
    sourceId: string;
    sourceRecordId: string;
  } | null;
  actualOutcome: HoldoutActualOutcome;
  matchesExpectation: boolean;
  structuralMembership: boolean | null;
  acceptedMembership: boolean | null;
  reactionRejected: boolean | null;
  structuralAssignmentMultiplicity: number | null;
  bindingMultiplicityMatchesExpectation: boolean | null;
  sourceSlotBinding: Record<string, string> | null;
  sourceSlotBindingBasis:
    | "same-page-inferred-fit"
    | "cross-page-audit-fit"
    | null;
  sourceSlotBindingMembership: boolean | null;
  reactionById: Record<string, boolean> | null;
  failure: TeamRosterCandidateDomainFailure | null;
}

/** Files whose behavior or data directly affects the default runtime gate. */
export const TEAM_ROSTER_CANDIDATE_DOMAIN_STATIC_DEPENDENCY_PATHS = [
  "scripts/guide-factory/src/teamRosterCandidateDomain.ts",
  "src/data/betaState.ts",
  "src/data/charInfo.ts",
  "src/data/game/character_beta_stats.json.gz",
  "src/data/game/character_stats.json",
  "src/data/gameDataUtil.ts",
  "src/data/gameResources.ts",
  "src/data/gameStatsLoader.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/data/utils.ts",
  "src/lib/dmgcalc/constants.ts",
  "src/lib/dmgcalc/core/teamMeta.ts",
] as const;

export interface TeamRosterCandidateDomainReport {
  schemaVersion: 1;
  reportType: "team-roster-candidate-domain";
  catalogBoundary: {
    label: "guide-domain-eligible-released-character-ids";
    characterCount: number;
    characterIdsSha256: string;
    playableIdentityCount: number;
    sharedPlayableIdentityGroups: Array<{
      playableIdentityId: string;
      characterIds: string[];
    }>;
  };
  assumptions: {
    constellation: 0;
    enemyAura: null;
    reactionGate: "TeamMeta.hasReaction";
    slotOptionSemantics: "or-within-slot;and-across-slots";
    highlightedOptionsSemantics: "annotation-only";
    requiredRoleSelectorSemantics: "withhold-template-if-any-required-slot-option-is-role";
    rosterIdentitySemantics: "four-distinct-playable-identities";
    maximumTheoreticalOrderedAssignmentCount: number;
  };
  hashContracts: {
    characterIdsSha256: "sha256(stable-json(sorted-character-id-array))";
    rosterDomainSha256: "sha256(stable-json(sorted-canonical-roster-id-arrays))";
  };
  claimFlags: {
    supportsRanking: false;
    supportsRecommendation: false;
    supportsDamageComparison: false;
    supportsOptimality: false;
    supportsIndependentGameplayValidation: false;
    usesEnergyRecovery: false;
  };
  prohibitedClaims: ["score", "rank", "winner", "best", "recommendation"];
  templates: TeamRosterCandidateTemplateReport[];
  holdouts: TeamRosterHoldoutOutcome[];
  allHoldoutsMatch: boolean;
  failures: TeamRosterCandidateDomainFailure[];
}

interface NormalizedCatalogEntry {
  characterId: string;
  elementId: string;
  playableIdentityId: string;
}

interface CanonicalRosterState {
  memberCharacterIds: [string, string, string, string];
  assignmentCount: number;
  accepted?: boolean;
  reactionById?: Record<string, boolean>;
}

interface TemplateBuildState {
  report: TeamRosterCandidateTemplateReport;
  canonicalRosters: Map<string, CanonicalRosterState> | null;
  resolvedSlotPools: Map<string, ReadonlySet<string>> | null;
}

interface CatalogState {
  entries: NormalizedCatalogEntry[];
  byCharacterId: Map<string, NormalizedCatalogEntry>;
  failures: TeamRosterCandidateDomainFailure[];
}

const MAX_THEORETICAL_ORDERED_ASSIGNMENT_COUNT = 2_000_000;

const GUIDE_DOMAIN_ELEMENT_IDS = new Set([
  "anemo",
  "cryo",
  "dendro",
  "electro",
  "geo",
  "hydro",
  "pyro",
]);

const TEAM_REACTION_IDS = new Set<ReactionType>(
  GUIDE_FACTORY_TEAM_REACTION_IDS,
);

const DEFAULT_REACTION_GATE_ENVIRONMENT: TeamRosterReactionGateEnvironment = {
  prepare: async () => {
    await characterStatsResource.preload();
  },
  evaluate: ({ memberCharacterIds, declaredReactions, assumptions }) => {
    const constellations = Object.fromEntries(
      memberCharacterIds.map((characterId) => [
        characterId,
        assumptions.constellations[characterId] ?? 0,
      ]),
    );
    const teamMeta = new TeamMeta(
      [...memberCharacterIds],
      constellations,
      {},
      undefined,
    );
    const byReaction = Object.fromEntries(
      declaredReactions.map((reaction) => [
        reaction,
        teamMeta.hasReaction(reaction),
      ]),
    );
    return {
      accepted: declaredReactions.every((reaction) => byReaction[reaction]),
      byReaction,
    };
  },
};

export async function buildTeamRosterCandidateDomainReport(
  input: TeamRosterCandidateDomainInput,
  environment: TeamRosterReactionGateEnvironment =
    DEFAULT_REACTION_GATE_ENVIRONMENT,
): Promise<TeamRosterCandidateDomainReport> {
  const catalog = normalizeCatalog(input.releasedCharacters);
  const reportFailures = [...catalog.failures];
  const duplicateTemplateIds = findDuplicates(
    input.templates.map((template) => template.id),
  );
  for (const templateId of duplicateTemplateIds) {
    reportFailures.push({
      code: "duplicate-template-id",
      stage: "selector-resolution",
      scope: "report",
      templateId,
      message: `Template ID ${templateId} occurs more than once.`,
    });
  }

  const templateInputs = [...input.templates].sort((left, right) =>
    compareStrings(left.id, right.id),
  );
  const templateStates = templateInputs.map((template) =>
    resolveAndEnumerateTemplate(
      template,
      catalog,
      duplicateTemplateIds.has(template.id),
    ),
  );

  const gateCandidates = templateStates.filter(
    (state, index) =>
      state.report.status === "comparable" &&
      (templateInputs[index]?.reactions?.length ?? 0) > 0,
  );
  let prepareFailure: TeamRosterCandidateDomainFailure | null = null;
  if (gateCandidates.length > 0 && environment.prepare) {
    try {
      await environment.prepare();
    } catch (error) {
      prepareFailure = {
        code: "reaction-gate-prepare-failed",
        stage: "reaction-gate",
        scope: "report",
        message: `Reaction gate preparation failed: ${errorMessage(error)}`,
      };
      reportFailures.push(prepareFailure);
    }
  }

  for (const [index, state] of templateStates.entries()) {
    if (state.report.status !== "comparable") continue;
    const template = templateInputs[index];
    if (!template) continue;
    const declaredReactions = template.reactions ?? [];
    if (prepareFailure && declaredReactions.length > 0) {
      makeTemplateNotComparable(
        state,
        {
          ...prepareFailure,
          scope: "template",
          templateId: template.id,
        },
        declaredReactions,
      );
      continue;
    }
    await applyReactionGate(template, state, environment);
  }

  const statesByTemplateId = new Map(
    templateStates.map((state) => [state.report.templateId, state]),
  );
  const duplicateHoldoutTargetIds = findDuplicates(
    input.holdoutTargets.map((target) => target.targetId),
  );
  const holdouts = [...input.holdoutTargets]
    .sort((left, right) => compareStrings(left.targetId, right.targetId))
    .map((target) =>
      evaluateHoldout(
        target,
        catalog,
        statesByTemplateId,
        duplicateHoldoutTargetIds.has(target.targetId),
      ),
    );
  for (const state of templateStates) {
    reportFailures.push(...state.report.failures);
  }
  for (const holdout of holdouts) {
    if (holdout.failure) reportFailures.push(holdout.failure);
  }

  const sharedPlayableIdentityGroups = [...groupCatalogByIdentity(catalog.entries)]
    .filter(([, entries]) => entries.length > 1)
    .map(([playableIdentityId, entries]) => ({
      playableIdentityId,
      characterIds: entries
        .map((entry) => entry.characterId)
        .sort(compareStrings),
    }))
    .sort((left, right) =>
      compareStrings(left.playableIdentityId, right.playableIdentityId),
    );

  return {
    schemaVersion: 1,
    reportType: "team-roster-candidate-domain",
    catalogBoundary: {
      label: "guide-domain-eligible-released-character-ids",
      characterCount: catalog.entries.length,
      characterIdsSha256: hashStableStringArray(
        catalog.entries.map((entry) => entry.characterId),
      ),
      playableIdentityCount: new Set(
        catalog.entries.map((entry) => entry.playableIdentityId),
      ).size,
      sharedPlayableIdentityGroups,
    },
    assumptions: {
      constellation: 0,
      enemyAura: null,
      reactionGate: "TeamMeta.hasReaction",
      slotOptionSemantics: "or-within-slot;and-across-slots",
      highlightedOptionsSemantics: "annotation-only",
      requiredRoleSelectorSemantics:
        "withhold-template-if-any-required-slot-option-is-role",
      rosterIdentitySemantics: "four-distinct-playable-identities",
      maximumTheoreticalOrderedAssignmentCount:
        MAX_THEORETICAL_ORDERED_ASSIGNMENT_COUNT,
    },
    hashContracts: {
      characterIdsSha256: "sha256(stable-json(sorted-character-id-array))",
      rosterDomainSha256:
        "sha256(stable-json(sorted-canonical-roster-id-arrays))",
    },
    claimFlags: {
      supportsRanking: false,
      supportsRecommendation: false,
      supportsDamageComparison: false,
      supportsOptimality: false,
      supportsIndependentGameplayValidation: false,
      usesEnergyRecovery: false,
    },
    prohibitedClaims: ["score", "rank", "winner", "best", "recommendation"],
    templates: templateStates.map((state) => state.report),
    holdouts,
    allHoldoutsMatch: holdouts.every(
      (holdout) => holdout.matchesExpectation && holdout.failure == null,
    ),
    failures: sortFailures(reportFailures),
  };
}

function normalizeCatalog(
  input: readonly ReleasedCharacterCatalogEntry[],
): CatalogState {
  const failures: TeamRosterCandidateDomainFailure[] = [];
  const byCharacterId = new Map<string, NormalizedCatalogEntry>();

  for (const rawEntry of input) {
    const characterId = rawEntry.characterId.trim();
    const elementId = rawEntry.elementId.trim().toLowerCase();
    const playableIdentityId = normalizePlayableIdentity(
      characterId,
      rawEntry.playableIdentityId,
    );
    if (
      !characterId ||
      !elementId ||
      !playableIdentityId ||
      !GUIDE_DOMAIN_ELEMENT_IDS.has(elementId)
    ) {
      failures.push({
        code: "invalid-catalog-entry",
        stage: "catalog",
        scope: "report",
        message:
          "Every catalog entry needs non-empty character and playable-identity IDs plus a supported Genshin element ID.",
      });
      continue;
    }
    if (byCharacterId.has(characterId)) {
      failures.push({
        code: "duplicate-catalog-character",
        stage: "catalog",
        scope: "report",
        message: `Character ID ${characterId} occurs more than once in the guide-domain catalog.`,
      });
      continue;
    }
    byCharacterId.set(characterId, {
      characterId,
      elementId,
      playableIdentityId,
    });
  }

  const entries = [...byCharacterId.values()].sort((left, right) =>
    compareStrings(left.characterId, right.characterId),
  );
  return { entries, byCharacterId, failures: sortFailures(failures) };
}

function resolveAndEnumerateTemplate(
  template: TeamTemplateRecord,
  catalog: CatalogState,
  hasDuplicateTemplateId: boolean,
): TemplateBuildState {
  const failures: TeamRosterCandidateDomainFailure[] = [];
  if (catalog.failures.length > 0) {
    failures.push(
      ...catalog.failures.map((failure) => ({
        ...failure,
        scope: "template" as const,
        templateId: template.id,
      })),
    );
  }
  if (hasDuplicateTemplateId) {
    failures.push({
      code: "duplicate-template-id",
      stage: "selector-resolution",
      scope: "template",
      templateId: template.id,
      message: `Template ID ${template.id} is not unique.`,
    });
  }
  for (const reaction of template.reactions ?? []) {
    if (!TEAM_REACTION_IDS.has(reaction as ReactionType)) {
      failures.push({
        code: "invalid-template-reaction",
        stage: "selector-resolution",
        scope: "template",
        templateId: template.id,
        message: `Template declares unsupported reaction ID ${reaction}.`,
      });
    }
  }
  for (const slotId of findDuplicates(template.slots.map((slot) => slot.id))) {
    failures.push({
      code: "invalid-template-slot",
      stage: "selector-resolution",
      scope: "template",
      templateId: template.id,
      message: `Template slot ID ${slotId} occurs more than once.`,
    });
  }

  const slotPools = template.slots.map((slot, slotIndex) =>
    resolveSlotPool(template.id, slot, slotIndex, catalog, failures),
  );
  const unresolvedRoleIds = sortedUnique(
    slotPools.flatMap((slot) => slot.unresolvedRoleIds),
  );
  const roleWithheld = unresolvedRoleIds.length > 0;
  const resolutionFailed =
    failures.length > 0 || slotPools.some((slot) => slot.resolution === "failed");

  if (roleWithheld || resolutionFailed) {
    return {
      report: emptyTemplateReport(
        template.id,
        roleWithheld && !resolutionFailed
          ? "withheld-unresolved-role"
          : "not-comparable",
        unresolvedRoleIds,
        slotPools,
        failures,
      ),
      canonicalRosters: null,
      resolvedSlotPools: null,
    };
  }

  const pools = slotPools.map((slot) => slot.resolvedCharacterIds ?? []);
  const theoreticalOrderedAssignmentCount = pools.reduce(
    (product, pool) => product * pool.length,
    1,
  );
  if (
    !Number.isSafeInteger(theoreticalOrderedAssignmentCount) ||
    theoreticalOrderedAssignmentCount >
      MAX_THEORETICAL_ORDERED_ASSIGNMENT_COUNT
  ) {
    failures.push({
      code: "unsafe-search-size",
      stage: "enumeration",
      scope: "template",
      templateId: template.id,
      message: `Theoretical ordered assignment count ${theoreticalOrderedAssignmentCount} exceeds the safe offline cap of ${MAX_THEORETICAL_ORDERED_ASSIGNMENT_COUNT}.`,
    });
    return {
      report: emptyTemplateReport(
        template.id,
        "not-comparable",
        [],
        slotPools,
        failures,
      ),
      canonicalRosters: null,
      resolvedSlotPools: null,
    };
  }

  const canonicalRosters = new Map<string, CanonicalRosterState>();
  let exactDuplicateRejections = 0;
  let samePlayableIdentityRejections = 0;
  let validOrderedAssignmentCount = 0;
  enumerateAssignments(pools, (members) => {
    if (new Set(members).size !== members.length) {
      exactDuplicateRejections += 1;
      return;
    }
    const identities = members.map(
      (characterId) => catalog.byCharacterId.get(characterId)?.playableIdentityId,
    );
    if (new Set(identities).size !== identities.length) {
      samePlayableIdentityRejections += 1;
      return;
    }
    validOrderedAssignmentCount += 1;
    const canonicalMembers = [...members].sort((left, right) =>
      compareStrings(left, right),
    ) as [string, string, string, string];
    const key = rosterKey(canonicalMembers);
    const existing = canonicalRosters.get(key);
    if (existing) {
      existing.assignmentCount += 1;
    } else {
      canonicalRosters.set(key, {
        memberCharacterIds: canonicalMembers,
        assignmentCount: 1,
      });
    }
  });

  const multiplicity = multiplicityHistogram(canonicalRosters.values());
  const report: TeamRosterCandidateTemplateReport = {
    templateId: template.id,
    status: "comparable",
    unresolvedRoleIds: [],
    slotPools: stripResolvedIds(slotPools),
    theoreticalOrderedAssignmentCount,
    validOrderedAssignmentCount,
    duplicateMemberAssignmentRejectionCount:
      exactDuplicateRejections + samePlayableIdentityRejections,
    exactDuplicateMemberAssignmentRejectionCount: exactDuplicateRejections,
    samePlayableIdentityAssignmentRejectionCount:
      samePlayableIdentityRejections,
    canonicalRosterCount: canonicalRosters.size,
    assignmentMultiplicityHistogram: multiplicity,
    structuralDomainSha256: hashRosterDomain(canonicalRosters, () => true),
    reactionAcceptedDomainSha256: null,
    reactionGate: null,
    failures: [],
  };
  return {
    report,
    canonicalRosters,
    resolvedSlotPools: new Map(
      template.slots.map((slot, index) => [
        slot.id,
        new Set(pools[index] ?? []),
      ]),
    ),
  };
}

type InternalSlotPool = TeamRosterSlotPoolReport & {
  resolvedCharacterIds?: string[];
};

function resolveSlotPool(
  templateId: string,
  slot: TeamTemplateRecord["slots"][number],
  slotIndex: number,
  catalog: CatalogState,
  failures: TeamRosterCandidateDomainFailure[],
): InternalSlotPool {
  const unresolvedRoleIds = sortedUnique(
    slot.options.flatMap((option) =>
      option.type === "roles" ? option.roleIds : [],
    ),
  );
  if (unresolvedRoleIds.length > 0) {
    return {
      slotIndex,
      slotId: slot.id,
      resolution: "unresolved-role",
      poolSize: null,
      poolSha256: null,
      unresolvedRoleIds,
    };
  }

  const characterIds = new Set<string>();
  for (const option of slot.options) {
    if (option.type === "any") {
      for (const entry of catalog.entries) characterIds.add(entry.characterId);
      continue;
    }
    if (option.type === "elements") {
      const elements = new Set<string>(option.elements);
      for (const entry of catalog.entries) {
        if (elements.has(entry.elementId)) {
          characterIds.add(entry.characterId);
        }
      }
      continue;
    }
    if (option.type === "characters") {
      for (const characterId of option.characterIds) {
        if (!catalog.byCharacterId.has(characterId)) {
          failures.push({
            code: "unknown-explicit-character",
            stage: "selector-resolution",
            scope: "template",
            templateId,
            message: `Slot ${slot.id} names character ${characterId}, which is absent from the guide-domain catalog.`,
          });
        } else {
          characterIds.add(characterId);
        }
      }
    }
  }
  const resolvedCharacterIds = [...characterIds].sort((left, right) =>
    compareStrings(left, right),
  );
  if (resolvedCharacterIds.length === 0) {
    failures.push({
      code: "invalid-template-slot",
      stage: "selector-resolution",
      scope: "template",
      templateId,
      message: `Slot ${slot.id} resolves to an empty guide-domain pool.`,
    });
    return {
      slotIndex,
      slotId: slot.id,
      resolution: "failed",
      poolSize: 0,
      poolSha256: hashStrings(`slot-pool-v1\0${templateId}\0${slot.id}`, []),
      unresolvedRoleIds: [],
      resolvedCharacterIds,
    };
  }
  return {
    slotIndex,
    slotId: slot.id,
    resolution: "resolved",
    poolSize: resolvedCharacterIds.length,
    poolSha256: hashStrings(
      `slot-pool-v1\0${templateId}\0${slot.id}`,
      resolvedCharacterIds,
    ),
    unresolvedRoleIds: [],
    resolvedCharacterIds,
  };
}

async function applyReactionGate(
  template: TeamTemplateRecord,
  state: TemplateBuildState,
  environment: TeamRosterReactionGateEnvironment,
): Promise<void> {
  const canonicalRosters = state.canonicalRosters;
  if (!canonicalRosters) return;
  const declaredReactions = (template.reactions ?? []) as ReactionType[];
  let acceptedCanonicalRosterCount = 0;
  let rejectedCanonicalRosterCount = 0;
  let acceptedOrderedAssignmentCount = 0;
  let rejectedOrderedAssignmentCount = 0;

  for (const roster of sortedRosterStates(canonicalRosters)) {
    const constellations = Object.fromEntries(
      roster.memberCharacterIds.map((characterId) => [characterId, 0 as const]),
    );
    let result: TeamRosterReactionGateResult = {
      accepted: true,
      byReaction: {},
    };
    if (declaredReactions.length > 0) {
      try {
        const evaluated = environment.evaluate({
          templateId: template.id,
          memberCharacterIds: roster.memberCharacterIds,
          declaredReactions,
          assumptions: { constellations, enemyAura: null },
        });
        result = isPromiseLike(evaluated) ? await evaluated : evaluated;
      } catch (error) {
        makeTemplateNotComparable(
          state,
          {
            code: "reaction-gate-evaluate-failed",
            stage: "reaction-gate",
            scope: "template",
            templateId: template.id,
            message: `Reaction gate failed for a canonical roster: ${errorMessage(error)}`,
          },
          declaredReactions,
        );
        return;
      }
    }
    const invalidReason = validateGateResult(result, declaredReactions);
    if (invalidReason) {
      makeTemplateNotComparable(
        state,
        {
          code: "reaction-gate-invalid-result",
          stage: "reaction-gate",
          scope: "template",
          templateId: template.id,
          message: invalidReason,
        },
        declaredReactions,
      );
      return;
    }

    roster.accepted = result.accepted;
    roster.reactionById = Object.fromEntries(
      [...declaredReactions]
        .sort(compareStrings)
        .map((reaction) => [reaction, result.byReaction[reaction] as boolean]),
    );
    if (result.accepted) {
      acceptedCanonicalRosterCount += 1;
      acceptedOrderedAssignmentCount += roster.assignmentCount;
    } else {
      rejectedCanonicalRosterCount += 1;
      rejectedOrderedAssignmentCount += roster.assignmentCount;
    }
  }

  state.report.reactionGate = {
    status: "completed",
    declaredReactions: [...declaredReactions].sort((left, right) =>
      compareStrings(left, right),
    ),
    acceptedCanonicalRosterCount,
    rejectedCanonicalRosterCount,
    acceptedOrderedAssignmentCount,
    rejectedOrderedAssignmentCount,
  };
  state.report.reactionAcceptedDomainSha256 = hashRosterDomain(
    canonicalRosters,
    (roster) => roster.accepted === true,
  );
}

function validateGateResult(
  result: TeamRosterReactionGateResult,
  declaredReactions: readonly ReactionType[],
): string | null {
  if (!result || typeof result !== "object") {
    return "Reaction gate returned a non-object result.";
  }
  if (typeof result.accepted !== "boolean") {
    return "Reaction gate result is missing a boolean accepted field.";
  }
  if (!result.byReaction || typeof result.byReaction !== "object") {
    return "Reaction gate result is missing its per-reaction outcomes.";
  }
  for (const reaction of declaredReactions) {
    if (typeof result.byReaction[reaction] !== "boolean") {
      return `Reaction gate result is missing a boolean outcome for ${reaction}.`;
    }
  }
  const derivedAccepted = declaredReactions.every(
    (reaction) => result.byReaction[reaction],
  );
  if (derivedAccepted !== result.accepted) {
    return "Reaction gate accepted disagrees with the conjunction of declared reaction outcomes.";
  }
  return null;
}

function makeTemplateNotComparable(
  state: TemplateBuildState,
  failure: TeamRosterCandidateDomainFailure,
  declaredReactions: readonly string[] = [],
): void {
  state.report.status = "not-comparable";
  state.report.reactionAcceptedDomainSha256 = null;
  state.report.reactionGate = {
    status: "failed",
    declaredReactions: [...declaredReactions].sort(compareStrings),
    acceptedCanonicalRosterCount: null,
    rejectedCanonicalRosterCount: null,
    acceptedOrderedAssignmentCount: null,
    rejectedOrderedAssignmentCount: null,
  };
  state.report.failures = sortFailures([...state.report.failures, failure]);
  if (state.canonicalRosters) {
    for (const roster of state.canonicalRosters.values()) {
      delete roster.accepted;
      delete roster.reactionById;
    }
  }
}

function evaluateHoldout(
  target: TeamRosterHoldoutTarget,
  catalog: CatalogState,
  statesByTemplateId: ReadonlyMap<string, TemplateBuildState>,
  hasDuplicateTargetId: boolean,
): TeamRosterHoldoutOutcome {
  const base = {
    targetId: target.targetId,
    templateId: target.templateId,
    memberCharacterIds: [...target.memberCharacterIds],
    expectedOutcome: target.expectedOutcome,
    expectedStructuralAssignmentMultiplicity:
      target.expectedStructuralAssignmentMultiplicity ?? null,
    category: target.category ?? null,
    provenance: target.provenance ? { ...target.provenance } : null,
    sourceSlotBinding: target.sourceSlotBinding
      ? { ...target.sourceSlotBinding }
      : null,
    sourceSlotBindingBasis: target.sourceSlotBindingBasis ?? null,
  };
  if (hasDuplicateTargetId) {
    return invalidTarget(
      "duplicate-holdout-target",
      `Holdout target ID ${target.targetId} occurs more than once.`,
    );
  }
  const invalidReason = validateHoldoutTarget(target, catalog);
  if (invalidReason) {
    return invalidTarget("invalid-holdout-target", invalidReason);
  }
  const state = statesByTemplateId.get(target.templateId);
  if (!state) {
    return invalidTarget(
      "unknown-holdout-template",
      `Holdout target references unknown template ${target.templateId}.`,
    );
  }
  const resolvedState = state;
  if (resolvedState.report.status === "withheld-unresolved-role") {
    return outcome("template-withheld", null, null, null);
  }
  const canonicalMembers = [...target.memberCharacterIds].sort((left, right) =>
    compareStrings(left, right),
  );
  const roster = resolvedState.canonicalRosters?.get(
    rosterKey(canonicalMembers),
  );
  const sourceSlotBindingMembership = evaluateSourceSlotBinding(
    target,
    resolvedState.resolvedSlotPools,
  );
  if (resolvedState.report.status === "not-comparable") {
    return outcome(
      "template-not-comparable",
      roster ?? null,
      null,
      sourceSlotBindingMembership,
    );
  }
  if (!roster) {
    return outcome(
      "structural-rejected",
      null,
      null,
      sourceSlotBindingMembership,
    );
  }
  return outcome(
    roster.accepted ? "accepted" : "reaction-rejected",
    roster,
    roster.reactionById ?? {},
    sourceSlotBindingMembership,
  );

  function outcome(
    actualOutcome: HoldoutActualOutcome,
    roster: CanonicalRosterState | null,
    reactionById: Record<string, boolean> | null,
    sourceSlotBindingMembership: boolean | null,
  ): TeamRosterHoldoutOutcome {
    const structuralMembership = resolvedState.canonicalRosters
      ? roster != null
      : null;
    const acceptedMembership =
      actualOutcome === "accepted"
        ? true
        : actualOutcome === "reaction-rejected" ||
            actualOutcome === "structural-rejected"
          ? false
          : null;
    const structuralAssignmentMultiplicity =
      roster?.assignmentCount ?? (structuralMembership === false ? 0 : null);
    const bindingMultiplicityMatchesExpectation =
      target.expectedStructuralAssignmentMultiplicity == null
        ? null
        : structuralAssignmentMultiplicity ===
          target.expectedStructuralAssignmentMultiplicity;
    const mismatchReasons: string[] = [];
    if (target.expectedOutcome !== actualOutcome) {
      mismatchReasons.push(
        `expected outcome ${target.expectedOutcome}, observed ${actualOutcome}`,
      );
    }
    if (bindingMultiplicityMatchesExpectation === false) {
      mismatchReasons.push(
        `expected binding multiplicity ${target.expectedStructuralAssignmentMultiplicity}, observed ${structuralAssignmentMultiplicity ?? "unavailable"}`,
      );
    }
    if (sourceSlotBindingMembership === false) {
      mismatchReasons.push(
        "the explicit source slot binding is outside the template domain",
      );
    }
    const failure: TeamRosterCandidateDomainFailure | null =
      mismatchReasons.length === 0
        ? null
        : {
            code: "holdout-expectation-mismatch",
            stage: "holdout",
            scope: "holdout",
            targetId: target.targetId,
            templateId: target.templateId,
            message: `Holdout expectation mismatch: ${mismatchReasons.join("; ")}.`,
          };
    return {
      ...base,
      actualOutcome,
      matchesExpectation: failure == null,
      structuralMembership,
      acceptedMembership,
      reactionRejected:
        actualOutcome === "reaction-rejected"
          ? true
          : actualOutcome === "accepted" ||
              actualOutcome === "structural-rejected"
            ? false
            : null,
      structuralAssignmentMultiplicity,
      bindingMultiplicityMatchesExpectation,
      sourceSlotBindingMembership,
      reactionById,
      failure,
    };
  }

  function invalidTarget(
    code:
      | "invalid-holdout-target"
      | "unknown-holdout-template"
      | "duplicate-holdout-target",
    message: string,
  ): TeamRosterHoldoutOutcome {
    const failure: TeamRosterCandidateDomainFailure = {
      code,
      stage: "holdout",
      scope: "holdout",
      targetId: target.targetId,
      templateId: target.templateId,
      message,
    };
    return {
      ...base,
      actualOutcome: "invalid-target",
      matchesExpectation: false,
      structuralMembership: null,
      acceptedMembership: null,
      reactionRejected: null,
      structuralAssignmentMultiplicity: null,
      bindingMultiplicityMatchesExpectation: null,
      sourceSlotBindingMembership: null,
      reactionById: null,
      failure,
    };
  }
}

function validateHoldoutTarget(
  target: TeamRosterHoldoutTarget,
  catalog: CatalogState,
): string | null {
  const members = target.memberCharacterIds;
  if (members.length !== 4) return "A holdout target must contain four members.";
  if (new Set(members).size !== members.length) {
    return "A holdout target cannot repeat a character ID.";
  }
  const unknown = members.filter(
    (characterId) => !catalog.byCharacterId.has(characterId),
  );
  if (unknown.length > 0) {
    return `Holdout target contains guide-domain-ineligible or unknown character IDs: ${sortedUnique(unknown).join(", ")}.`;
  }
  const identities = members.map(
    (characterId) => catalog.byCharacterId.get(characterId)?.playableIdentityId,
  );
  if (new Set(identities).size !== identities.length) {
    return "A holdout target cannot contain multiple forms of one playable identity.";
  }
  if (
    target.expectedStructuralAssignmentMultiplicity != null &&
    (!Number.isSafeInteger(target.expectedStructuralAssignmentMultiplicity) ||
      target.expectedStructuralAssignmentMultiplicity < 0)
  ) {
    return "Expected structural assignment multiplicity must be a non-negative safe integer.";
  }
  if (target.sourceSlotBinding && !target.sourceSlotBindingBasis) {
    return "A source slot binding requires an explicit inferred-fit basis.";
  }
  if (!target.sourceSlotBinding && target.sourceSlotBindingBasis) {
    return "A source slot binding basis cannot be supplied without a binding.";
  }
  return null;
}

function evaluateSourceSlotBinding(
  target: TeamRosterHoldoutTarget,
  resolvedSlotPools: ReadonlyMap<string, ReadonlySet<string>> | null,
): boolean | null {
  if (!target.sourceSlotBinding) return null;
  if (!resolvedSlotPools) return null;
  const expectedSlotIds = [...resolvedSlotPools.keys()].sort(compareStrings);
  const providedSlotIds = Object.keys(target.sourceSlotBinding).sort(
    compareStrings,
  );
  if (
    expectedSlotIds.length !== providedSlotIds.length ||
    expectedSlotIds.some((slotId, index) => slotId !== providedSlotIds[index])
  ) {
    return false;
  }
  const boundCharacters = expectedSlotIds.map(
    (slotId) => target.sourceSlotBinding?.[slotId] ?? "",
  );
  if (
    sortedUnique(boundCharacters).join("\0") !==
    sortedUnique(target.memberCharacterIds).join("\0")
  ) {
    return false;
  }
  return expectedSlotIds.every((slotId) => {
    const characterId = target.sourceSlotBinding?.[slotId];
    return characterId != null && resolvedSlotPools.get(slotId)?.has(characterId);
  });
}

function emptyTemplateReport(
  templateId: string,
  status: Exclude<TeamRosterCandidateTemplateStatus, "comparable">,
  unresolvedRoleIds: string[],
  slotPools: InternalSlotPool[],
  failures: TeamRosterCandidateDomainFailure[],
): TeamRosterCandidateTemplateReport {
  return {
    templateId,
    status,
    unresolvedRoleIds,
    slotPools: stripResolvedIds(slotPools),
    theoreticalOrderedAssignmentCount: null,
    validOrderedAssignmentCount: null,
    duplicateMemberAssignmentRejectionCount: null,
    exactDuplicateMemberAssignmentRejectionCount: null,
    samePlayableIdentityAssignmentRejectionCount: null,
    canonicalRosterCount: null,
    assignmentMultiplicityHistogram: [],
    structuralDomainSha256: null,
    reactionAcceptedDomainSha256: null,
    reactionGate: null,
    failures: sortFailures(failures),
  };
}

function stripResolvedIds(
  pools: readonly InternalSlotPool[],
): TeamRosterSlotPoolReport[] {
  return pools.map(({ resolvedCharacterIds: _, ...report }) => report);
}

function enumerateAssignments(
  pools: readonly string[][],
  visit: (members: [string, string, string, string]) => void,
): void {
  const members = new Array<string>(4);
  walk(0);

  function walk(slotIndex: number): void {
    if (slotIndex === pools.length) {
      visit([...members] as [string, string, string, string]);
      return;
    }
    const pool = pools[slotIndex] ?? [];
    for (const characterId of pool) {
      members[slotIndex] = characterId;
      walk(slotIndex + 1);
    }
  }
}

function multiplicityHistogram(
  rosters: Iterable<CanonicalRosterState>,
): AssignmentMultiplicityHistogramEntry[] {
  const counts = new Map<number, number>();
  for (const roster of rosters) {
    counts.set(
      roster.assignmentCount,
      (counts.get(roster.assignmentCount) ?? 0) + 1,
    );
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([assignmentCount, rosterCount]) => ({
      assignmentCount,
      rosterCount,
    }));
}

function hashRosterDomain(
  rosters: ReadonlyMap<string, CanonicalRosterState>,
  include: (roster: CanonicalRosterState) => boolean,
): string {
  const hash = createHash("sha256");
  const included = [...rosters.entries()]
    .filter(([, roster]) => include(roster))
    .sort(([left], [right]) => compareStrings(left, right));
  if (included.length === 0) {
    hash.update("[]\n");
    return hash.digest("hex");
  }
  hash.update("[\n");
  for (const [rosterIndex, [, roster]] of included.entries()) {
    if (rosterIndex > 0) hash.update(",\n");
    hash.update("  [\n");
    for (const [
      memberIndex,
      characterId,
    ] of roster.memberCharacterIds.entries()) {
      hash.update(`    ${JSON.stringify(characterId)}`);
      if (memberIndex < roster.memberCharacterIds.length - 1) hash.update(",");
      hash.update("\n");
    }
    hash.update("  ]");
  }
  hash.update("\n]\n");
  return hash.digest("hex");
}

function hashStableStringArray(values: readonly string[]): string {
  const hash = createHash("sha256");
  const sorted = [...values].sort(compareStrings);
  if (sorted.length === 0) {
    hash.update("[]\n");
    return hash.digest("hex");
  }
  hash.update("[\n");
  for (const [index, value] of sorted.entries()) {
    hash.update(`  ${JSON.stringify(value)}`);
    if (index < sorted.length - 1) hash.update(",");
    hash.update("\n");
  }
  hash.update("]\n");
  return hash.digest("hex");
}

function hashStrings(label: string, values: readonly string[]): string {
  const hash = createHash("sha256");
  hash.update(`${label}\n`);
  for (const value of [...values].sort(compareStrings)) {
    hash.update(`${Buffer.byteLength(value)}:${value}\n`);
  }
  return hash.digest("hex");
}

function rosterKey(members: readonly string[]): string {
  return members.join("\0");
}

function sortedRosterStates(
  rosters: ReadonlyMap<string, CanonicalRosterState>,
): CanonicalRosterState[] {
  return [...rosters.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, roster]) => roster);
}

function normalizePlayableIdentity(
  characterId: string,
  explicitIdentity: string | undefined,
): string {
  if (characterId.startsWith("traveler_")) return "traveler";
  return explicitIdentity?.trim() || characterId;
}

function groupCatalogByIdentity(
  entries: readonly NormalizedCatalogEntry[],
): Map<string, NormalizedCatalogEntry[]> {
  const groups = new Map<string, NormalizedCatalogEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.playableIdentityId) ?? [];
    group.push(entry);
    groups.set(entry.playableIdentityId, group);
  }
  return groups;
}

function findDuplicates(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function sortFailures(
  failures: readonly TeamRosterCandidateDomainFailure[],
): TeamRosterCandidateDomainFailure[] {
  const unique = new Map<string, TeamRosterCandidateDomainFailure>();
  for (const failure of failures) {
    const key = [
      failure.scope,
      failure.templateId ?? "",
      failure.targetId ?? "",
      failure.code,
      failure.message,
    ].join("\0");
    if (!unique.has(key)) unique.set(key, failure);
  }
  return [...unique.values()].sort((left, right) =>
    [
      left.scope,
      left.templateId ?? "",
      left.targetId ?? "",
      left.code,
      left.message,
    ]
      .join("\0")
      .localeCompare(
        [
          right.scope,
          right.templateId ?? "",
          right.targetId ?? "",
          right.code,
          right.message,
        ].join("\0"),
      ),
  );
}
