import { characters } from "@/data/resources";
import { loadGameCatalogs } from "./catalogs";
import { sha256Text, stableJson } from "./io";
import type { KnowledgeRecord, KnowledgeRepository } from "./schemas";
import { buildTeamTemplateCoverageReport } from "./teamTemplateCoverage";
import {
  buildTeamRosterCandidateDomainReport,
  type ReleasedCharacterCatalogEntry,
  type TeamRosterCandidateDomainInput,
  type TeamRosterCandidateDomainReport,
  type TeamRosterHoldoutTarget,
  type TeamRosterReactionGateEnvironment,
  TEAM_ROSTER_CANDIDATE_DOMAIN_STATIC_DEPENDENCY_PATHS,
} from "./teamRosterCandidateDomain";

type TeamTemplateRecord = Extract<
  KnowledgeRecord,
  { kind: "team_template" }
>;
type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;

export const TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS = [
  "scripts/guide-factory/src/catalogs.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/teamRosterCandidateDomainExperiment.ts",
  "scripts/guide-factory/src/teamTemplateCoverage.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  ...TEAM_ROSTER_CANDIDATE_DOMAIN_STATIC_DEPENDENCY_PATHS,
] as const;

export const TEAM_ROSTER_CANDIDATE_DOMAIN_TEMPLATE_IDS = [
  "kqm:team-template:furina-team-template-electro-charged",
  "kqm:team-template:furina-team-template-freeze",
  "kqm:team-template:furina-team-template-hypercarry-mono",
  "kqm:team-template:furina-team-template-quickbloom",
  "kqm:team-template:furina-team-template-vaporize",
  "kqm:team-template:keqing-team-template-lunar-charged",
] as const;

const ELECTRO_CHARGED_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-electro-charged";
const FREEZE_TEMPLATE_ID = "kqm:team-template:furina-team-template-freeze";
const QUICKBLOOM_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-quickbloom";
const VAPORIZE_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-vaporize";
const EXPECTED_ROLE_SELECTOR_WITHHELD_TEMPLATE_IDS = [
  "kqm:team-template:furina-team-template-hypercarry-mono",
  "kqm:team-template:keqing-team-template-lunar-charged",
] as const;

type ValidationEvidenceClass =
  | "same-page-authored-domain-check"
  | "cross-source-internal-baseline-overlap"
  | "same-publisher-cross-page-negative";

type RecordedReactionRelationship =
  | "aligned-with-template"
  | "different-from-template"
  | "not-recorded";

type HoldoutDefinition = {
  targetId: string;
  repositoryTeamId: string;
  templateId: string;
  expectedOutcome: TeamRosterHoldoutTarget["expectedOutcome"];
  evidenceClass: ValidationEvidenceClass;
  explicitRuntimeGateNegative: boolean;
  recordedReactionRelationship: RecordedReactionRelationship;
  expectedStructuralAssignmentMultiplicity?: number;
  sourceSlotBinding?: Readonly<Record<string, string>>;
  sourceSlotBindingBasis?: Exclude<
    TeamRosterHoldoutTarget["sourceSlotBindingBasis"],
    undefined
  >;
};

const HOLDOUT_DEFINITIONS: HoldoutDefinition[] = [
  {
    targetId: "same-page:furina-alhaitham-shinobu-nahida-quickbloom",
    repositoryTeamId:
      "kqm:team:furina-alhaitham-shinobu-nahida-quickbloom-example",
    templateId: QUICKBLOOM_TEMPLATE_ID,
    expectedOutcome: "accepted",
    evidenceClass: "same-page-authored-domain-check",
    explicitRuntimeGateNegative: false,
    recordedReactionRelationship: "aligned-with-template",
    expectedStructuralAssignmentMultiplicity: 2,
    sourceSlotBinding: {
      furina: "furina",
      dendro: "alhaitham",
      electro: "kuki_shinobu",
      flex: "nahida",
    },
    sourceSlotBindingBasis: "same-page-inferred-fit",
  },
  {
    targetId: "same-page:furina-nahida-cyno-baizhu-quickbloom",
    repositoryTeamId:
      "kqm:team:furina-nahida-cyno-baizhu-quickbloom-example",
    templateId: QUICKBLOOM_TEMPLATE_ID,
    expectedOutcome: "accepted",
    evidenceClass: "same-page-authored-domain-check",
    explicitRuntimeGateNegative: false,
    recordedReactionRelationship: "aligned-with-template",
    expectedStructuralAssignmentMultiplicity: 2,
    sourceSlotBinding: {
      furina: "furina",
      dendro: "nahida",
      electro: "cyno",
      flex: "baizhu",
    },
    sourceSlotBindingBasis: "same-page-inferred-fit",
  },
  ...baselineOverlapDefinitions(ELECTRO_CHARGED_TEMPLATE_ID, [
    // Columbina enables Lunar-Charged, so the runtime gate supersedes EC.
    [
      "genshintools-presets:team:C8O2y1jWpNRe5gSc04",
      1,
      "different-from-template",
      "reaction-rejected",
    ],
    ["genshintools-presets:team:PSK5xCCWjKgdZ2Sc04", 2, "not-recorded"],
    [
      "genshintools-presets:team:QCC32ya0kJgK51AC0e",
      2,
      "aligned-with-template",
    ],
  ]),
  ...baselineOverlapDefinitions(FREEZE_TEMPLATE_ID, [
    [
      "genshintools-presets:team:1ZC3ATIWeGrK1fWd0N",
      2,
      "different-from-template",
    ],
    [
      "genshintools-presets:team:6te0ITIWe72K1eia0O",
      2,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:7sa0JFZ0jJam0WuIWD",
      6,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:8IS2p3X0jJb451cfWN",
      1,
      "different-from-template",
    ],
    [
      "genshintools-presets:team:IZC0JFZ0DJgK50uIWD",
      6,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:JAG4wxT0jJgK50uIWD",
      2,
      "aligned-with-template",
    ],
    ["genshintools-presets:team:JQC4x3X0jNRe0gTIWe", 1, "not-recorded"],
    [
      "genshintools-presets:team:QSW63FZ0jJam0W_T0D",
      6,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:QSW63FZ0jJam0WuIWD",
      6,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:Xjy6ZFZ0DJam0X8h0r",
      4,
      "aligned-with-template",
    ],
  ]),
  ...baselineOverlapDefinitions(VAPORIZE_TEMPLATE_ID, [
    [
      "genshintools-presets:team:8IS2oxT0jJgK51CXWN",
      1,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:8IS2p3X0jJb451cfWN",
      1,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:Kqy2obKWOJgK50orWD",
      2,
      "aligned-with-template",
    ],
    [
      "genshintools-presets:team:LQm5QT3W4Cte2uorWD",
      4,
      "aligned-with-template",
    ],
  ]),
  {
    targetId: "runtime-negative:keqing-ineffa-furina-xilonen-as-electro-charged",
    repositoryTeamId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    templateId: ELECTRO_CHARGED_TEMPLATE_ID,
    expectedOutcome: "reaction-rejected",
    evidenceClass: "same-publisher-cross-page-negative",
    explicitRuntimeGateNegative: true,
    recordedReactionRelationship: "different-from-template",
    expectedStructuralAssignmentMultiplicity: 2,
    sourceSlotBinding: {
      furina: "furina",
      electro: "keqing",
      "electro-or-hydro": "ineffa",
      "anemo-or-flex": "xilonen",
    },
    sourceSlotBindingBasis: "cross-page-audit-fit",
  },
];

export type TeamRosterCandidateDomainExperimentReport = {
  schemaVersion: 1;
  classification: "bounded-team-roster-candidate-domain-experiment";
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsRankClaims: false;
  supportsGameplayValidation: false;
  energyRecoveryInputsUsed: false;
  comparisonStatus: "comparable" | "not-comparable";
  generatedFrom: Array<{ path: string; sha256: string }>;
  templateBoundary: {
    selectedTemplateCount: 6;
    selectedTemplateIds: string[];
    selectedTemplateRecordsSha256: string;
    roleSelectorPolicy: "withhold-template-if-any-slot-option-is-unresolved-role";
    highlightedOptionsPolicy: "annotation-only";
    expectedRoleSelectorWithheldTemplateIds: string[];
    repositoryRoleSelectorTemplateIds: string[];
    roleSelectorWithholdingMatchesExpectation: boolean;
  };
  releasedCatalogBoundary: {
    source: "stable-resources";
    fullStableCharacterCount: number;
    fullStableCatalogSha256: string;
    excludedSpecialAvatarForms: {
      count: number;
      sha256: string;
      reason: "Manekin and Manekina element variants are special-avatar forms withheld from the first guide-oriented team domain.";
    };
    eligibleCharacterCount: number;
    eligibleCatalogSha256: string;
    travelerIdentityPolicy: "all traveler element variants share playableIdentityId=traveler";
  };
  validationEvidenceBoundary: {
    targetAssociationCount: number;
    uniqueRepositoryTeamRecordCount: number;
    samePageAuthoredDomainChecks: ValidationTargetClassSummary;
    crossSourceInternalBaselineOverlap: ValidationTargetClassSummary;
    explicitRuntimeGateNegatives: ValidationTargetClassSummary;
    baselineOverlapCompletenessAgainstCurrentTemplateCoverage: true;
    recordedReactionRelationships: Record<
      RecordedReactionRelationship,
      { targetCount: number; targetIds: string[] }
    >;
    allTargetsMatch: boolean;
    independentGameplayValidation: {
      status: "not-supplied";
      targetCount: 0;
      supportsGameplayValidation: false;
    };
  };
  domain: TeamRosterCandidateDomainReport;
  cautions: [
    "Same-page authored examples test extraction and domain membership against the same source; they are not independent gameplay validation.",
    "Cross-source GenshinTools baseline overlap is an internal data-overlap observation, not evidence that a generated roster follows the template's intended play or is good.",
    "Runtime reaction acceptance checks calculator TeamMeta availability under fixed C0 and no enemy aura; it does not establish rotation execution, trigger ownership, or damage.",
    "A template is withheld if any actual slot option is an unresolved role; role selectors are not weakened to element or unrestricted matches.",
    "Highlighted options remain annotations and do not narrow an otherwise resolved slot pool.",
    "Slot bindings are validation fits inferred from page context or constructed across pages; none is a machine-readable source binding.",
    "Recorded reaction relationships preserve repository labels only; they do not prove template intent or in-game execution.",
  ];
  prohibitedInterpretations: [
    "candidate-ranking",
    "winner",
    "team-recommendation",
    "gameplay-quality",
    "independent-gameplay-validation",
    "energy-requirement",
  ];
};

type ValidationTargetClassSummary = {
  targetCount: number;
  uniqueRepositoryTeamRecordCount: number;
  targetIds: string[];
  targetDefinitionsSha256: string;
  establishesIntendedPlay: false;
  establishesGameplayQuality: false;
};

type ExperimentFixture = {
  coreInput: TeamRosterCandidateDomainInput;
  templateBoundary: Omit<
    TeamRosterCandidateDomainExperimentReport["templateBoundary"],
    "roleSelectorWithholdingMatchesExpectation"
  >;
  releasedCatalogBoundary: TeamRosterCandidateDomainExperimentReport["releasedCatalogBoundary"];
  validationEvidenceBoundary: Omit<
    TeamRosterCandidateDomainExperimentReport["validationEvidenceBoundary"],
    "allTargetsMatch"
  >;
};

export async function runTeamRosterCandidateDomainExperiment(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment?: TeamRosterReactionGateEnvironment,
): Promise<TeamRosterCandidateDomainExperimentReport> {
  const fixture = await buildTeamRosterCandidateDomainExperimentFixture(
    repository,
  );
  const domain = await buildTeamRosterCandidateDomainReport(
    fixture.coreInput,
    environment,
  );
  const actualRoleWithheldTemplateIds = domain.templates
    .filter(({ status }) => status === "withheld-unresolved-role")
    .map(({ templateId }) => templateId)
    .sort(compareText);
  const roleSelectorWithholdingMatchesExpectation =
    stableJson(actualRoleWithheldTemplateIds) ===
    stableJson(
      fixture.templateBoundary.expectedRoleSelectorWithheldTemplateIds,
    );
  return {
    schemaVersion: 1,
    classification: "bounded-team-roster-candidate-domain-experiment",
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsRankClaims: false,
    supportsGameplayValidation: false,
    energyRecoveryInputsUsed: false,
    comparisonStatus: deriveComparisonStatus(
      domain,
      roleSelectorWithholdingMatchesExpectation,
    ),
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    templateBoundary: {
      ...fixture.templateBoundary,
      roleSelectorWithholdingMatchesExpectation,
    },
    releasedCatalogBoundary: fixture.releasedCatalogBoundary,
    validationEvidenceBoundary: {
      ...fixture.validationEvidenceBoundary,
      allTargetsMatch: domain.allHoldoutsMatch,
    },
    domain,
    cautions: [
      "Same-page authored examples test extraction and domain membership against the same source; they are not independent gameplay validation.",
      "Cross-source GenshinTools baseline overlap is an internal data-overlap observation, not evidence that a generated roster follows the template's intended play or is good.",
      "Runtime reaction acceptance checks calculator TeamMeta availability under fixed C0 and no enemy aura; it does not establish rotation execution, trigger ownership, or damage.",
      "A template is withheld if any actual slot option is an unresolved role; role selectors are not weakened to element or unrestricted matches.",
      "Highlighted options remain annotations and do not narrow an otherwise resolved slot pool.",
      "Slot bindings are validation fits inferred from page context or constructed across pages; none is a machine-readable source binding.",
      "Recorded reaction relationships preserve repository labels only; they do not prove template intent or in-game execution.",
    ],
    prohibitedInterpretations: [
      "candidate-ranking",
      "winner",
      "team-recommendation",
      "gameplay-quality",
      "independent-gameplay-validation",
      "energy-requirement",
    ],
  };
}

export async function buildTeamRosterCandidateDomainExperimentFixture(
  repository: KnowledgeRepository,
): Promise<ExperimentFixture> {
  const catalogs = await loadGameCatalogs();
  const templates = selectTemplates(repository);
  const { fullStableCatalog, excluded, eligible } = buildReleasedCatalog(
    catalogs.characterElements,
  );
  const holdoutTargets = buildHoldoutTargets(repository, templates);
  validateBaselineOverlapCompleteness(
    buildTeamTemplateCoverageReport(repository, catalogs),
  );
  const repositoryRoleSelectorTemplateIds = templates
    .filter(hasUnresolvedRoleSelector)
    .map(({ id }) => id)
    .sort(compareText);

  return {
    coreInput: {
      templates,
      releasedCharacters: eligible,
      holdoutTargets,
    },
    templateBoundary: {
      selectedTemplateCount: 6,
      selectedTemplateIds: templates.map(({ id }) => id),
      selectedTemplateRecordsSha256: sha256Text(stableJson(templates)),
      roleSelectorPolicy:
        "withhold-template-if-any-slot-option-is-unresolved-role",
      highlightedOptionsPolicy: "annotation-only",
      expectedRoleSelectorWithheldTemplateIds: [
        ...EXPECTED_ROLE_SELECTOR_WITHHELD_TEMPLATE_IDS,
      ],
      repositoryRoleSelectorTemplateIds,
    },
    releasedCatalogBoundary: {
      source: "stable-resources",
      fullStableCharacterCount: fullStableCatalog.length,
      fullStableCatalogSha256: sha256Text(stableJson(fullStableCatalog)),
      excludedSpecialAvatarForms: {
        count: excluded.length,
        sha256: sha256Text(stableJson(excluded)),
        reason:
          "Manekin and Manekina element variants are special-avatar forms withheld from the first guide-oriented team domain.",
      },
      eligibleCharacterCount: eligible.length,
      eligibleCatalogSha256: sha256Text(stableJson(eligible)),
      travelerIdentityPolicy:
        "all traveler element variants share playableIdentityId=traveler",
    },
    validationEvidenceBoundary: summarizeValidationEvidence(),
  };
}

function selectTemplates(repository: KnowledgeRepository): TeamTemplateRecord[] {
  const byId = new Map(
    repository.records
      .filter(
        (record): record is TeamTemplateRecord =>
          record.kind === "team_template",
      )
      .map((record) => [record.id, record]),
  );
  return TEAM_ROSTER_CANDIDATE_DOMAIN_TEMPLATE_IDS.map((templateId) => {
    const template = byId.get(templateId);
    if (!template || template.status === "rejected") {
      throw new Error(
        `Selected roster-domain template ${templateId} is missing or rejected.`,
      );
    }
    return template;
  });
}

function buildReleasedCatalog(
  characterElements: ReadonlyMap<string, string>,
): {
  fullStableCatalog: ReleasedCharacterCatalogEntry[];
  excluded: ReleasedCharacterCatalogEntry[];
  eligible: ReleasedCharacterCatalogEntry[];
} {
  const fullStableCatalog = characters
    .map(({ id }) => {
      const elementId = characterElements.get(id);
      if (!elementId) {
        throw new Error(
          `Stable character ${id} is missing an element in character_stats.json.`,
        );
      }
      return {
        characterId: id,
        elementId,
        playableIdentityId: id.startsWith("traveler_") ? "traveler" : id,
      } satisfies ReleasedCharacterCatalogEntry;
    })
    .sort((left, right) => compareText(left.characterId, right.characterId));
  const excluded = fullStableCatalog.filter(({ characterId }) =>
    /^(?:manekin|manekina)_/.test(characterId),
  );
  const eligible = fullStableCatalog.filter(
    ({ characterId }) => !/^(?:manekin|manekina)_/.test(characterId),
  );
  return { fullStableCatalog, excluded, eligible };
}

function buildHoldoutTargets(
  repository: KnowledgeRepository,
  templates: TeamTemplateRecord[],
): TeamRosterHoldoutTarget[] {
  const teams = new Map(
    repository.records
      .filter((record): record is ExactTeamRecord => record.kind === "team")
      .map((record) => [record.id, record]),
  );
  const templatesById = new Map(
    templates.map((template) => [template.id, template]),
  );
  const targetIds = new Set<string>();

  return HOLDOUT_DEFINITIONS.map((definition) => {
    if (targetIds.has(definition.targetId)) {
      throw new Error(`Duplicate roster-domain holdout ${definition.targetId}.`);
    }
    targetIds.add(definition.targetId);
    const team = teams.get(definition.repositoryTeamId);
    const template = templatesById.get(definition.templateId);
    if (!team || !template) {
      throw new Error(
        `Roster-domain holdout ${definition.targetId} is missing its team or template.`,
      );
    }
    validateEvidenceClass(definition, team, template);
    if (team.members.length !== 4) {
      throw new Error(
        `Roster-domain holdout ${definition.targetId} must contain four members.`,
      );
    }
    const sourceRef = team.sourceRefs[0];
    if (!sourceRef) {
      throw new Error(
        `Roster-domain holdout ${definition.targetId} has no source reference.`,
      );
    }
    return {
      targetId: definition.targetId,
      templateId: definition.templateId,
      memberCharacterIds: team.members.map(
        ({ characterId }) => characterId,
      ) as [string, string, string, string],
      expectedOutcome: definition.expectedOutcome,
      expectedStructuralAssignmentMultiplicity:
        definition.expectedStructuralAssignmentMultiplicity,
      sourceSlotBinding: definition.sourceSlotBinding,
      sourceSlotBindingBasis: definition.sourceSlotBindingBasis,
      category: definition.evidenceClass,
      provenance: {
        sourceId: sourceRef.sourceId,
        sourceRecordId: sourceRef.sourceRecordId,
      },
    };
  });
}

function validateEvidenceClass(
  definition: HoldoutDefinition,
  team: ExactTeamRecord,
  template: TeamTemplateRecord,
): void {
  const teamSources = new Set(team.sourceRefs.map(({ sourceId }) => sourceId));
  const templateSources = new Set(
    template.sourceRefs.map(({ sourceId }) => sourceId),
  );
  const sharesPublisher = [...teamSources].some((sourceId) =>
    templateSources.has(sourceId),
  );
  const teamUrls = sourceUrls(team);
  const templateUrls = sourceUrls(template);
  const sharesLocatorUrl = [...teamUrls].some((url) => templateUrls.has(url));
  const invalidClassification =
    definition.evidenceClass === "same-page-authored-domain-check"
      ? !sharesLocatorUrl
      : definition.evidenceClass ===
          "cross-source-internal-baseline-overlap"
        ? sharesPublisher || team.status !== "baseline"
        : !sharesPublisher || sharesLocatorUrl;
  if (invalidClassification) {
    throw new Error(
      `Roster-domain holdout ${definition.targetId} no longer matches its evidence classification.`,
    );
  }
  const recordedReactions = team.reactions ?? [];
  const observedRelationship: RecordedReactionRelationship =
    recordedReactions.length === 0
      ? "not-recorded"
      : (template.reactions ?? []).every((reaction) =>
            recordedReactions.includes(reaction),
          )
        ? "aligned-with-template"
        : "different-from-template";
  if (observedRelationship !== definition.recordedReactionRelationship) {
    throw new Error(
      `Roster-domain holdout ${definition.targetId} recorded-reaction relationship drifted from ${definition.recordedReactionRelationship} to ${observedRelationship}.`,
    );
  }
}

function sourceUrls(record: TeamTemplateRecord | ExactTeamRecord): Set<string> {
  return new Set(
    record.sourceRefs.flatMap(({ locator }) =>
      "url" in locator ? [locator.url] : [],
    ),
  );
}

function hasUnresolvedRoleSelector(template: TeamTemplateRecord): boolean {
  return template.slots.some((slot) =>
    slot.options.some((option) => option.type === "roles"),
  );
}

function summarizeValidationEvidence(): Omit<
  TeamRosterCandidateDomainExperimentReport["validationEvidenceBoundary"],
  "allTargetsMatch"
> {
  const samePage = HOLDOUT_DEFINITIONS.filter(
    ({ evidenceClass }) => evidenceClass === "same-page-authored-domain-check",
  );
  const crossSource = HOLDOUT_DEFINITIONS.filter(
    ({ evidenceClass }) =>
      evidenceClass === "cross-source-internal-baseline-overlap",
  );
  const negatives = HOLDOUT_DEFINITIONS.filter(
    ({ explicitRuntimeGateNegative, expectedOutcome }) =>
      explicitRuntimeGateNegative || expectedOutcome === "reaction-rejected",
  );
  return {
    targetAssociationCount: HOLDOUT_DEFINITIONS.length,
    uniqueRepositoryTeamRecordCount: new Set(
      HOLDOUT_DEFINITIONS.map(({ repositoryTeamId }) => repositoryTeamId),
    ).size,
    samePageAuthoredDomainChecks: summarizeTargetClass(samePage),
    crossSourceInternalBaselineOverlap: summarizeTargetClass(crossSource),
    explicitRuntimeGateNegatives: summarizeTargetClass(negatives),
    baselineOverlapCompletenessAgainstCurrentTemplateCoverage: true,
    recordedReactionRelationships: summarizeRecordedReactionRelationships(
      HOLDOUT_DEFINITIONS,
    ),
    independentGameplayValidation: {
      status: "not-supplied",
      targetCount: 0,
      supportsGameplayValidation: false,
    },
  };
}

function validateBaselineOverlapCompleteness(
  coverage: ReturnType<typeof buildTeamTemplateCoverageReport>,
): void {
  const resolvedTemplateIds = new Set([
    ELECTRO_CHARGED_TEMPLATE_ID,
    FREEZE_TEMPLATE_ID,
    QUICKBLOOM_TEMPLATE_ID,
    VAPORIZE_TEMPLATE_ID,
  ]);
  const expectedPairs = coverage.templates
    .filter(({ templateId }) => resolvedTemplateIds.has(templateId))
    .flatMap(({ templateId, matchedBaselineTeamIds }) =>
      matchedBaselineTeamIds.map((teamId) => ({ templateId, teamId })),
    )
    .sort(compareTemplateTeamPair);
  const declaredPairs = HOLDOUT_DEFINITIONS.filter(
    ({ evidenceClass }) =>
      evidenceClass === "cross-source-internal-baseline-overlap",
  )
    .map(({ templateId, repositoryTeamId: teamId }) => ({
      templateId,
      teamId,
    }))
    .sort(compareTemplateTeamPair);
  if (stableJson(expectedPairs) !== stableJson(declaredPairs)) {
    throw new Error(
      "Roster-domain baseline-overlap targets no longer cover every current structural match for the four resolved templates.",
    );
  }
}

function compareTemplateTeamPair(
  left: { templateId: string; teamId: string },
  right: { templateId: string; teamId: string },
): number {
  return (
    compareText(left.templateId, right.templateId) ||
    compareText(left.teamId, right.teamId)
  );
}

function summarizeTargetClass(
  definitions: HoldoutDefinition[],
): ValidationTargetClassSummary {
  const sorted = [...definitions].sort((left, right) =>
    compareText(left.targetId, right.targetId),
  );
  return {
    targetCount: sorted.length,
    uniqueRepositoryTeamRecordCount: new Set(
      sorted.map(({ repositoryTeamId }) => repositoryTeamId),
    ).size,
    targetIds: sorted.map(({ targetId }) => targetId),
    targetDefinitionsSha256: sha256Text(stableJson(sorted)),
    establishesIntendedPlay: false,
    establishesGameplayQuality: false,
  };
}

function baselineOverlapDefinitions(
  templateId: string,
  repositoryTeams: Array<
    readonly [
      repositoryTeamId: string,
      multiplicity: number,
      recordedReactionRelationship: RecordedReactionRelationship,
      expectedOutcome?: TeamRosterHoldoutTarget["expectedOutcome"],
    ]
  >,
): HoldoutDefinition[] {
  return repositoryTeams.map(
    ([
      repositoryTeamId,
      multiplicity,
      recordedReactionRelationship,
      expectedOutcome = "accepted",
    ]) => ({
      targetId: `baseline-overlap:${templateId}:${repositoryTeamId}`,
      repositoryTeamId,
      templateId,
      expectedOutcome,
      evidenceClass: "cross-source-internal-baseline-overlap" as const,
      explicitRuntimeGateNegative: expectedOutcome === "reaction-rejected",
      recordedReactionRelationship,
      expectedStructuralAssignmentMultiplicity: multiplicity,
    }),
  );
}

function summarizeRecordedReactionRelationships(
  definitions: readonly HoldoutDefinition[],
): TeamRosterCandidateDomainExperimentReport["validationEvidenceBoundary"]["recordedReactionRelationships"] {
  return Object.fromEntries(
    ([
      "aligned-with-template",
      "different-from-template",
      "not-recorded",
    ] as const).map((relationship) => {
      const targetIds = definitions
        .filter(
          ({ recordedReactionRelationship }) =>
            recordedReactionRelationship === relationship,
        )
        .map(({ targetId }) => targetId)
        .sort(compareText);
      return [relationship, { targetCount: targetIds.length, targetIds }];
    }),
  ) as TeamRosterCandidateDomainExperimentReport["validationEvidenceBoundary"]["recordedReactionRelationships"];
}

function deriveComparisonStatus(
  domain: TeamRosterCandidateDomainReport,
  roleSelectorWithholdingMatchesExpectation: boolean,
): TeamRosterCandidateDomainExperimentReport["comparisonStatus"] {
  const hasNotComparableTemplate = domain.templates.some(
    ({ status }) => status === "not-comparable",
  );
  return domain.failures.length > 0 ||
    hasNotComparableTemplate ||
    !roleSelectorWithholdingMatchesExpectation ||
    !domain.allHoldoutsMatch
    ? "not-comparable"
    : "comparable";
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
