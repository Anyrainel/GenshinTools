import { sha256Text, stableJson } from "./io";
import {
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "./manualSnapshots";
import {
  compareEligibleCatalogWithCheckedInRosterReport,
  parseCheckedInRosterCatalogReference,
  type CheckedInRosterCatalogComparison,
  type CheckedInRosterCatalogReference,
} from "./rosterCatalogReference";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
} from "./schemas";
import {
  evaluateSourceScopedRolePairSample,
  type SourceScopedRolePairSampleReport,
  type SourceScopedRolePairTargetInput,
} from "./sourceScopedRolePairSample";
import type { SourceScopedCharacterRoleRecord } from "./sourceScopedRoleSample";
import { buildTeamRosterCandidateDomainReport } from "./teamRosterCandidateDomain";
import {
  buildTeamRosterCandidateDomainExperimentFixture,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
} from "./teamRosterCandidateDomainExperiment";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;
type TeamTemplateRecord = Extract<
  KnowledgeRecord,
  { kind: "team_template" }
>;
type ManualRecord = ManualObservationSnapshot["records"][number];
type RoleMember = SourceScopedCharacterRoleRecord["members"][number];

export const KEQING_ROLE_PAIR_TEMPLATE_ID =
  "kqm:team-template:keqing-team-template-lunar-charged";
export const KEQING_HYDRO_ROLE_RECORD_ID =
  "kqm:character-role:keqing-lunar-charged-off-field-hydro-appliers";
export const KEQING_SHRED_ROLE_RECORD_ID =
  "kqm:character-role:keqing-lunar-charged-resistance-shred-options";

export const KEQING_ROLE_PAIR_TARGET_TEAM_IDS = [
  "kqm:team:keqing-ineffa-aino-sucrose-lunar-charged-example",
  "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example",
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
  "kqm:team:keqing-ineffa-yelan-kazuha-lunar-charged-example",
] as const;

export const KEQING_ROLE_PAIR_VV_CONDITION =
  "Equipped with 4pc Viridescent Venerer and activates its relevant RES reduction.";

export const KEQING_ROLE_PAIR_PAGE_URL =
  "https://keqingmains.com/q/keqing-quickguide/";

const KEQING_TEMPLATE_SOURCE_RECORD_ID =
  "keqing-team-template-lunar-charged";
const KEQING_HYDRO_ROLE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-off-field-hydro-appliers";
const KEQING_SHRED_ROLE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-resistance-shred-options";
const EXPECTED_ELIGIBLE_CHARACTER_COUNT = 125;
const EXPECTED_EXTRACTION_METHOD = "agent-assisted";
const EXPECTED_REVIEW_STATUS = "unreviewed";
const EXPECTED_ROSTER_DOMAIN_STATUS = "withheld-unresolved-role";

const EXPECTED_EXTRACTION_RECORDS = [
  {
    kind: "team_template",
    sourceRecordId: KEQING_TEMPLATE_SOURCE_RECORD_ID,
  },
  {
    kind: "character_role",
    sourceRecordId: KEQING_HYDRO_ROLE_SOURCE_RECORD_ID,
  },
  {
    kind: "character_role",
    sourceRecordId: KEQING_SHRED_ROLE_SOURCE_RECORD_ID,
  },
  {
    kind: "team",
    sourceRecordId:
      "keqing-ineffa-aino-sucrose-lunar-charged-example",
  },
  {
    kind: "team",
    sourceRecordId:
      "keqing-ineffa-furina-jean-lunar-charged-example",
  },
  {
    kind: "team",
    sourceRecordId:
      "keqing-ineffa-furina-xilonen-lunar-charged-example",
  },
  {
    kind: "team",
    sourceRecordId:
      "keqing-ineffa-yelan-kazuha-lunar-charged-example",
  },
] as const;

const EXPECTED_ROLE_MEMBERS = {
  [KEQING_HYDRO_ROLE_RECORD_ID]: [
    { characterId: "aino", conditions: [] },
    { characterId: "furina", conditions: [] },
    { characterId: "xingqiu", conditions: [] },
    { characterId: "yelan", conditions: [] },
  ],
  [KEQING_SHRED_ROLE_RECORD_ID]: [
    {
      characterId: "jean",
      conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    {
      characterId: "kaedehara_kazuha",
      conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    {
      characterId: "sayu",
      conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    {
      characterId: "sucrose",
      conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    {
      characterId: "xianyun",
      conditions: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    { characterId: "xilonen", conditions: [] },
  ],
} as const;

const TARGET_DEFINITIONS = [
  {
    targetId:
      "kqm:team:keqing-ineffa-aino-sucrose-lunar-charged-example",
    targetTeamId:
      "kqm:team:keqing-ineffa-aino-sucrose-lunar-charged-example",
    memberCharacterIds: ["keqing", "ineffa", "aino", "sucrose"],
    hydroCharacterId: "aino",
    shredCharacterId: "sucrose",
    sourceSlotBinding: {
      keqing: "keqing",
      ineffa: "ineffa",
      "off-field-hydro": "aino",
      "resistance-shred": "sucrose",
    },
    acknowledgedConditionsByRoleRecordId: {
      [KEQING_HYDRO_ROLE_RECORD_ID]: [],
      [KEQING_SHRED_ROLE_RECORD_ID]: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    expectedStructuralBindingMultiplicity: 1,
  },
  {
    targetId:
      "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example",
    targetTeamId:
      "kqm:team:keqing-ineffa-furina-jean-lunar-charged-example",
    memberCharacterIds: ["keqing", "ineffa", "furina", "jean"],
    hydroCharacterId: "furina",
    shredCharacterId: "jean",
    sourceSlotBinding: {
      keqing: "keqing",
      ineffa: "ineffa",
      "off-field-hydro": "furina",
      "resistance-shred": "jean",
    },
    acknowledgedConditionsByRoleRecordId: {
      [KEQING_HYDRO_ROLE_RECORD_ID]: [],
      [KEQING_SHRED_ROLE_RECORD_ID]: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    expectedStructuralBindingMultiplicity: 1,
  },
  {
    targetId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    targetTeamId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    memberCharacterIds: ["keqing", "ineffa", "furina", "xilonen"],
    hydroCharacterId: "furina",
    shredCharacterId: "xilonen",
    sourceSlotBinding: {
      keqing: "keqing",
      ineffa: "ineffa",
      "off-field-hydro": "furina",
      "resistance-shred": "xilonen",
    },
    acknowledgedConditionsByRoleRecordId: {
      [KEQING_HYDRO_ROLE_RECORD_ID]: [],
      [KEQING_SHRED_ROLE_RECORD_ID]: [],
    },
    expectedStructuralBindingMultiplicity: 1,
  },
  {
    targetId:
      "kqm:team:keqing-ineffa-yelan-kazuha-lunar-charged-example",
    targetTeamId:
      "kqm:team:keqing-ineffa-yelan-kazuha-lunar-charged-example",
    memberCharacterIds: [
      "keqing",
      "ineffa",
      "yelan",
      "kaedehara_kazuha",
    ],
    hydroCharacterId: "yelan",
    shredCharacterId: "kaedehara_kazuha",
    sourceSlotBinding: {
      keqing: "keqing",
      ineffa: "ineffa",
      "off-field-hydro": "yelan",
      "resistance-shred": "kaedehara_kazuha",
    },
    acknowledgedConditionsByRoleRecordId: {
      [KEQING_HYDRO_ROLE_RECORD_ID]: [],
      [KEQING_SHRED_ROLE_RECORD_ID]: [KEQING_ROLE_PAIR_VV_CONDITION],
    },
    expectedStructuralBindingMultiplicity: 1,
  },
] as const;

export const KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS = [
  ...new Set([
    ...TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
    "scripts/guide-factory/data/source-snapshots/manual-index.json",
    "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
    "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json",
    "scripts/guide-factory/sources/registry.json",
    "scripts/guide-factory/src/keqingSourceScopedRolePairSample.ts",
    "scripts/guide-factory/src/manualSnapshots.ts",
    "scripts/guide-factory/src/rosterCatalogReference.ts",
    "scripts/guide-factory/src/sourceScopedRolePairSample.ts",
    "scripts/guide-factory/src/sourceScopedRoleSample.ts",
  ]),
].sort(compareText);

export interface KeqingSourceScopedRolePairSampleReport {
  schemaVersion: 1;
  classification: "keqing-source-scoped-role-pair-sample";
  comparisonStatus: "comparable" | "not-comparable";
  completeRoleDomains: false;
  completePairDomain: false;
  unconfiguredRoleMemberPairsEvaluated: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsRankClaims: false;
  supportsGlobalRoleResolution: false;
  supportsGameplayValidation: false;
  supportsDamageClaims: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsEnergyRecoveryClaims: false;
  energyRecoveryInputsUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceExtractionBoundary: {
    sourceId: "kqm";
    snapshotFile: { path: string; sha256: string };
    expectedParticipatingRecordCount: 7;
    observedSnapshotRecordCount: number;
    configuredRecordsPresentExactlyOnce: boolean;
    expectedExtractionMethod: typeof EXPECTED_EXTRACTION_METHOD;
    expectedReviewStatus: typeof EXPECTED_REVIEW_STATUS;
    allExtractionStatesMatch: boolean;
    records: Array<{
      kind: ManualRecord["kind"];
      sourceRecordId: string;
      occurrenceCount: number;
      observedExtractionMethod: "manual" | "agent-assisted" | null;
      observedReviewStatus: "unreviewed" | "reviewed" | null;
      presentExactlyOnce: boolean;
      matchesExpectedExtractionMethod: boolean;
      matchesExpectedReviewStatus: boolean;
    }>;
  };
  sourcePageBoundary: {
    expectedPageUrl: typeof KEQING_ROLE_PAIR_PAGE_URL;
    observedSnapshotPageUrl: string;
    snapshotPageUrlMatchesExpectation: boolean;
    allRepositoryRecordsUseExactPage: boolean;
    repositoryRecords: Array<{
      recordId: string;
      observedSourcePages: Array<{ sourceId: string; pageUrl: string }>;
      usesExactPage: boolean;
    }>;
  };
  releasedCatalogBoundary: {
    source: "stable-resources";
    fullStableCharacterCount: number;
    excludedSpecialAvatarFormCount: number;
    excludedSpecialAvatarFormsSha256: string;
    eligibleCharacterCount: number;
    expectedEligibleCharacterCount: typeof EXPECTED_ELIGIBLE_CHARACTER_COUNT;
    eligibleCharacterCountMatchesExpectation: boolean;
    eligibleCatalogSha256: string;
    eligibleCharacterIdsSha256: string;
    playableIdentityCount: number;
    travelerIdentityPolicy: string;
    checkedInRosterReportReference: CheckedInRosterCatalogReference & {
      source: "checked-in-team-roster-candidate-domain-report";
    };
    checkedInRosterReportComparison: CheckedInRosterCatalogComparison;
  };
  existingRosterDomainBoundary: {
    templateId: typeof KEQING_ROLE_PAIR_TEMPLATE_ID;
    expectedStatus: typeof EXPECTED_ROSTER_DOMAIN_STATUS;
    freshObservedStatus: string | null;
    freshRemainsWithheldUnresolvedRole: boolean;
    checkedInObservedStatus: string | null;
    checkedInRemainsWithheldUnresolvedRole: boolean;
    namedRoleEvidenceInstalledAsGlobalResolver: false;
  };
  roleInventoryBoundary: {
    expectedRoleRecordCount: 2;
    allRoleInventoriesMatchExpectation: boolean;
    roleRecords: Array<{
      roleRecordId: string;
      templateId: string;
      slotId: string;
      roleId: string;
      status: string;
      promotionEligible: boolean | null;
      members: RoleMember[];
      exhaustiveness: "non-exhaustive" | "exhaustive" | "unspecified";
      rankingClaim: "none" | "ordered" | "unordered";
      matchesExpectedMemberInventory: boolean;
      matchesExpectedUnspecifiedUnrankedScope: boolean;
    }>;
  };
  configuredPublishedTargets: Array<{
    targetId: string;
    targetTeamId: string;
    memberCharacterIds: string[];
    roleMemberBindings: Array<{
      roleRecordId: string;
      characterId: string;
    }>;
    sourceSlotBinding: Record<string, string>;
    sourceSlotBindingBasis: "same-page-inferred-fit";
    acknowledgedConditionsByRoleRecordId: Record<string, string[]>;
    expectedStructuralBindingMultiplicity: 1;
  }>;
  publishedTargetBoundary: {
    expectedTargetCount: 4;
    configuredTargetCount: number;
    evaluatedTargetCount: number;
    expectedTargetTeamIds: string[];
    configuredTargetTeamIds: string[];
    evaluatedTargetTeamIds: string[];
    configuredTargetsMatchExpectation: boolean;
    evaluatedTargetsMatchConfiguration: boolean;
  };
  rolePairSample: SourceScopedRolePairSampleReport;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export async function runKeqingSourceScopedRolePairSample(
  repository: KnowledgeRepository,
  manualInputs: readonly ManualSnapshotInput[],
  checkedInRosterDomainReportInput: unknown,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): Promise<KeqingSourceScopedRolePairSampleReport> {
  const template = requireTemplateRecord(
    repository,
    KEQING_ROLE_PAIR_TEMPLATE_ID,
  );
  const hydroRole = requireRoleRecord(
    repository,
    KEQING_HYDRO_ROLE_RECORD_ID,
  );
  const shredRole = requireRoleRecord(
    repository,
    KEQING_SHRED_ROLE_RECORD_ID,
  );
  const targetTeams = new Map(
    KEQING_ROLE_PAIR_TARGET_TEAM_IDS.map((teamId) => [
      teamId,
      requireTeamRecord(repository, teamId),
    ]),
  );

  const keqingSnapshotInput = requiredManualSnapshotInputContaining(
    manualInputs,
    "kqm",
    KEQING_TEMPLATE_SOURCE_RECORD_ID,
  );
  const keqingSnapshot = ManualObservationSnapshotSchema.parse(
    keqingSnapshotInput.snapshot,
  );
  const extractionState = buildExtractionState(keqingSnapshot.records);
  const pageBoundary = buildSourcePageBoundary(
    keqingSnapshot.page.url,
    [template, hydroRole, shredRole, ...targetTeams.values()],
  );

  const fixture =
    await buildTeamRosterCandidateDomainExperimentFixture(repository);
  const eligibleCharacters = fixture.coreInput.releasedCharacters;
  const eligibleCatalogSha256 = sha256Text(stableJson(eligibleCharacters));
  const eligibleCharacterIdsSha256 = sha256Text(
    stableJson(eligibleCharacters.map(({ characterId }) => characterId)),
  );
  const playableIdentityCount = new Set(
    eligibleCharacters.map(
      ({ characterId, playableIdentityId }) =>
        playableIdentityId ??
        (characterId.startsWith("traveler_") ? "traveler" : characterId),
    ),
  ).size;
  const checkedInRosterReportReference =
    parseCheckedInRosterCatalogReference(checkedInRosterDomainReportInput);
  const checkedInRosterReportComparison =
    compareEligibleCatalogWithCheckedInRosterReport(
      eligibleCharacters,
      checkedInRosterReportReference,
    );

  const freshRosterDomain = await buildTeamRosterCandidateDomainReport({
    templates: [template],
    releasedCharacters: eligibleCharacters,
    holdoutTargets: [],
  });
  const freshObservedStatus = requiredSingleTemplateStatus(
    freshRosterDomain,
    KEQING_ROLE_PAIR_TEMPLATE_ID,
    "fresh roster-domain result",
  );
  const checkedInObservedStatus = requiredSingleTemplateStatus(
    checkedInRosterDomainReportInput,
    KEQING_ROLE_PAIR_TEMPLATE_ID,
    "checked-in roster-domain report",
  );
  const freshRemainsWithheldUnresolvedRole =
    freshObservedStatus === EXPECTED_ROSTER_DOMAIN_STATUS;
  const checkedInRemainsWithheldUnresolvedRole =
    checkedInObservedStatus === EXPECTED_ROSTER_DOMAIN_STATUS;

  const rolePairTargets = buildRolePairTargets(targetTeams);
  const rolePairSample = evaluateSourceScopedRolePairSample({
    template,
    expectedTemplateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
    roles: [
      {
        record: hydroRole,
        expectedRecordId: KEQING_HYDRO_ROLE_RECORD_ID,
        expectedTemplateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        expectedSlotId: "off-field-hydro",
        expectedRoleId: "off-field-hydro-applier",
      },
      {
        record: shredRole,
        expectedRecordId: KEQING_SHRED_ROLE_RECORD_ID,
        expectedTemplateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
        expectedSlotId: "resistance-shred",
        expectedRoleId: "resistance-shred",
      },
    ],
    targets: rolePairTargets,
    eligibleCharacters,
  });

  const roleInventoryBoundary = buildRoleInventoryBoundary([
    hydroRole,
    shredRole,
  ]);
  const publishedTargetBoundary = buildPublishedTargetBoundary(
    rolePairTargets,
    rolePairSample,
  );
  const eligibleCharacterCountMatchesExpectation =
    eligibleCharacters.length === EXPECTED_ELIGIBLE_CHARACTER_COUNT;
  const comparisonStatus =
    rolePairSample.comparisonStatus === "comparable" &&
    extractionState.configuredRecordsPresentExactlyOnce &&
    extractionState.allExtractionStatesMatch &&
    pageBoundary.snapshotPageUrlMatchesExpectation &&
    pageBoundary.allRepositoryRecordsUseExactPage &&
    roleInventoryBoundary.allRoleInventoriesMatchExpectation &&
    publishedTargetBoundary.configuredTargetsMatchExpectation &&
    publishedTargetBoundary.evaluatedTargetsMatchConfiguration &&
    eligibleCharacterCountMatchesExpectation &&
    checkedInRosterReportComparison.allChecksMatch &&
    freshRemainsWithheldUnresolvedRole &&
    checkedInRemainsWithheldUnresolvedRole
      ? "comparable"
      : "not-comparable";

  return {
    schemaVersion: 1,
    classification: "keqing-source-scoped-role-pair-sample",
    comparisonStatus,
    completeRoleDomains: false,
    completePairDomain: false,
    unconfiguredRoleMemberPairsEvaluated: false,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsRankClaims: false,
    supportsGlobalRoleResolution: false,
    supportsGameplayValidation: false,
    supportsDamageClaims: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsEnergyRecoveryClaims: false,
    energyRecoveryInputsUsed: false,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    sourceExtractionBoundary: {
      sourceId: "kqm",
      snapshotFile: { ...keqingSnapshotInput.snapshotFile },
      expectedParticipatingRecordCount: 7,
      observedSnapshotRecordCount: keqingSnapshot.records.length,
      ...extractionState,
      expectedExtractionMethod: EXPECTED_EXTRACTION_METHOD,
      expectedReviewStatus: EXPECTED_REVIEW_STATUS,
    },
    sourcePageBoundary: pageBoundary,
    releasedCatalogBoundary: {
      source: fixture.releasedCatalogBoundary.source,
      fullStableCharacterCount:
        fixture.releasedCatalogBoundary.fullStableCharacterCount,
      excludedSpecialAvatarFormCount:
        fixture.releasedCatalogBoundary.excludedSpecialAvatarForms.count,
      excludedSpecialAvatarFormsSha256:
        fixture.releasedCatalogBoundary.excludedSpecialAvatarForms.sha256,
      eligibleCharacterCount: eligibleCharacters.length,
      expectedEligibleCharacterCount: EXPECTED_ELIGIBLE_CHARACTER_COUNT,
      eligibleCharacterCountMatchesExpectation,
      eligibleCatalogSha256,
      eligibleCharacterIdsSha256,
      playableIdentityCount,
      travelerIdentityPolicy:
        fixture.releasedCatalogBoundary.travelerIdentityPolicy,
      checkedInRosterReportReference: {
        source: "checked-in-team-roster-candidate-domain-report",
        ...checkedInRosterReportReference,
      },
      checkedInRosterReportComparison,
    },
    existingRosterDomainBoundary: {
      templateId: KEQING_ROLE_PAIR_TEMPLATE_ID,
      expectedStatus: EXPECTED_ROSTER_DOMAIN_STATUS,
      freshObservedStatus,
      freshRemainsWithheldUnresolvedRole,
      checkedInObservedStatus,
      checkedInRemainsWithheldUnresolvedRole,
      namedRoleEvidenceInstalledAsGlobalResolver: false,
    },
    roleInventoryBoundary,
    configuredPublishedTargets: rolePairTargets.map((target) => ({
      targetId: target.targetId,
      targetTeamId: target.expectedTargetTeamId,
      memberCharacterIds: [...target.expectedMemberCharacterIds],
      roleMemberBindings: target.roleMemberBindings.map((binding) => ({
        ...binding,
      })),
      sourceSlotBinding: { ...target.sourceSlotBinding },
      sourceSlotBindingBasis: target.sourceSlotBindingBasis,
      acknowledgedConditionsByRoleRecordId: Object.fromEntries(
        Object.entries(
          target.acknowledgedConditionsByRoleRecordId ?? {},
        ).map(([recordId, conditions]) => [recordId, [...conditions]]),
      ),
      expectedStructuralBindingMultiplicity: 1,
    })),
    publishedTargetBoundary,
    rolePairSample,
    cautions: [
      "Both role records preserve source-positive members with unspecified exhaustiveness and no ranking; unexercised members remain evidence rather than failures or inferred negatives.",
      "Only the four exact teams published on the same KQM page are evaluated. No other combination of the two role-member lists is generated, judged, or recommended.",
      "Viridescent Venerer conditions are acknowledged for the configured Jean, Sucrose, and Kaedehara Kazuha targets, but the wrapper does not verify aura setup, timing, or gameplay execution.",
      "The current 125-ID catalog is checked against independently stored counts and fingerprints in the checked-in roster-domain report; same-count fingerprint drift fails this gate.",
      "The Keqing Lunar-Charged template remains role-withheld in both a fresh roster-domain replay and the checked-in roster-domain report; these observations are not installed as a global resolver.",
      "No damage, equipment, stat allocation, rotation-quality, or energy-recovery computation is performed.",
    ],
    prohibitedInterpretations: [
      "complete-role-domain",
      "complete-role-pair-domain",
      "global-role-resolution",
      "team-recommendation",
      "team-ranking",
      "gameplay-quality",
      "damage-quality",
      "equipment-recommendation",
      "stat-recommendation",
      "energy-requirement",
    ],
  };
}

function buildExtractionState(
  records: readonly ManualRecord[],
): Pick<
  KeqingSourceScopedRolePairSampleReport["sourceExtractionBoundary"],
  | "configuredRecordsPresentExactlyOnce"
  | "allExtractionStatesMatch"
  | "records"
> {
  const expectedInventory = EXPECTED_EXTRACTION_RECORDS.map((record) => ({
    ...record,
  })).sort(compareSourceRecord);
  const extractionRecords = expectedInventory.map((expected) => {
    const matches = records.filter(
      (record) =>
        record.kind === expected.kind &&
        record.sourceRecordId === expected.sourceRecordId,
    );
    const record = matches.length === 1 ? (matches[0] as ManualRecord) : null;
    return {
      kind: expected.kind,
      sourceRecordId: expected.sourceRecordId,
      occurrenceCount: matches.length,
      observedExtractionMethod: record?.extraction.method ?? null,
      observedReviewStatus: record?.extraction.reviewStatus ?? null,
      presentExactlyOnce: matches.length === 1,
      matchesExpectedExtractionMethod:
        record?.extraction.method === EXPECTED_EXTRACTION_METHOD,
      matchesExpectedReviewStatus:
        record?.extraction.reviewStatus === EXPECTED_REVIEW_STATUS,
    };
  });
  return {
    configuredRecordsPresentExactlyOnce: extractionRecords.every(
      ({ presentExactlyOnce }) => presentExactlyOnce,
    ),
    allExtractionStatesMatch: extractionRecords.every(
      ({
        matchesExpectedExtractionMethod,
        matchesExpectedReviewStatus,
      }) =>
        matchesExpectedExtractionMethod && matchesExpectedReviewStatus,
    ),
    records: extractionRecords,
  };
}

function buildRoleInventoryBoundary(
  records: readonly SourceScopedCharacterRoleRecord[],
): KeqingSourceScopedRolePairSampleReport["roleInventoryBoundary"] {
  const roleRecords = [...records]
    .sort((left, right) => compareText(left.id, right.id))
    .map((record) => {
      const members = canonicalRoleMembers(record.members);
      const expectedMembers = EXPECTED_ROLE_MEMBERS[
        record.id as keyof typeof EXPECTED_ROLE_MEMBERS
      ];
      return {
        roleRecordId: record.id,
        templateId: record.appliesTo.teamTemplateId,
        slotId: record.appliesTo.slotId,
        roleId: record.roleId,
        status: record.status,
        promotionEligible: record.promotionEligible ?? null,
        members,
        exhaustiveness: record.exhaustiveness,
        rankingClaim: record.rankingClaim,
        matchesExpectedMemberInventory:
          expectedMembers !== undefined &&
          stableJson(members) === stableJson(expectedMembers),
        matchesExpectedUnspecifiedUnrankedScope:
          record.exhaustiveness === "unspecified" &&
          record.rankingClaim === "none",
      };
    });
  return {
    expectedRoleRecordCount: 2,
    allRoleInventoriesMatchExpectation:
      roleRecords.length === 2 &&
      roleRecords.every(
        ({
          matchesExpectedMemberInventory,
          matchesExpectedUnspecifiedUnrankedScope,
        }) =>
          matchesExpectedMemberInventory &&
          matchesExpectedUnspecifiedUnrankedScope,
      ),
    roleRecords,
  };
}

function buildSourcePageBoundary(
  observedSnapshotPageUrl: string,
  records: readonly (
    | SourceScopedCharacterRoleRecord
    | TeamTemplateRecord
    | ExactTeamRecord
  )[],
): KeqingSourceScopedRolePairSampleReport["sourcePageBoundary"] {
  const repositoryRecords = [...records]
    .sort((left, right) => compareText(left.id, right.id))
    .map((record) => {
      const rawSourcePages = record.sourceRefs.map((sourceRef) =>
        "url" in sourceRef.locator
          ? {
              sourceId: sourceRef.sourceId,
              pageUrl: sourceRef.locator.url,
            }
          : null,
      );
      const observedSourcePages = [
        ...new Map(
          rawSourcePages.flatMap((entry) =>
            entry
              ? [[`${entry.sourceId}\u0000${entry.pageUrl}`, entry] as const]
              : [],
          ),
        ).values(),
      ].sort(
        (left, right) =>
          compareText(left.sourceId, right.sourceId) ||
          compareText(left.pageUrl, right.pageUrl),
      );
      return {
        recordId: record.id,
        observedSourcePages,
        usesExactPage:
          rawSourcePages.length > 0 &&
          rawSourcePages.every(
            (entry) =>
              entry?.sourceId === "kqm" &&
              entry.pageUrl === KEQING_ROLE_PAIR_PAGE_URL,
          ),
      };
    });
  return {
    expectedPageUrl: KEQING_ROLE_PAIR_PAGE_URL,
    observedSnapshotPageUrl,
    snapshotPageUrlMatchesExpectation:
      observedSnapshotPageUrl === KEQING_ROLE_PAIR_PAGE_URL,
    allRepositoryRecordsUseExactPage: repositoryRecords.every(
      ({ usesExactPage }) => usesExactPage,
    ),
    repositoryRecords,
  };
}

function buildPublishedTargetBoundary(
  targets: readonly SourceScopedRolePairTargetInput[],
  report: SourceScopedRolePairSampleReport,
): KeqingSourceScopedRolePairSampleReport["publishedTargetBoundary"] {
  const expectedTargetTeamIds = [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS].sort(
    compareText,
  );
  const configuredTargetTeamIds = targets
    .map(({ expectedTargetTeamId }) => expectedTargetTeamId)
    .sort(compareText);
  const evaluatedTargetTeamIds = report.targets
    .map(({ targetTeamId }) => targetTeamId)
    .sort(compareText);
  return {
    expectedTargetCount: 4,
    configuredTargetCount: configuredTargetTeamIds.length,
    evaluatedTargetCount: evaluatedTargetTeamIds.length,
    expectedTargetTeamIds,
    configuredTargetTeamIds,
    evaluatedTargetTeamIds,
    configuredTargetsMatchExpectation:
      stableJson(configuredTargetTeamIds) ===
      stableJson(expectedTargetTeamIds),
    evaluatedTargetsMatchConfiguration:
      stableJson(evaluatedTargetTeamIds) ===
      stableJson(configuredTargetTeamIds),
  };
}

function buildRolePairTargets(
  targetTeams: ReadonlyMap<string, ExactTeamRecord>,
): SourceScopedRolePairTargetInput[] {
  return TARGET_DEFINITIONS.map((definition) => {
    const targetTeam = targetTeams.get(definition.targetTeamId);
    if (!targetTeam) {
      throw new Error(`Missing configured target team ${definition.targetTeamId}.`);
    }
    return {
      targetId: definition.targetId,
      targetTeam,
      expectedTargetTeamId: definition.targetTeamId,
      expectedMemberCharacterIds: [...definition.memberCharacterIds],
      roleMemberBindings: [
        {
          roleRecordId: KEQING_HYDRO_ROLE_RECORD_ID,
          characterId: definition.hydroCharacterId,
        },
        {
          roleRecordId: KEQING_SHRED_ROLE_RECORD_ID,
          characterId: definition.shredCharacterId,
        },
      ],
      sourceSlotBinding: { ...definition.sourceSlotBinding },
      sourceSlotBindingBasis: "same-page-inferred-fit",
      acknowledgedConditionsByRoleRecordId: Object.fromEntries(
        Object.entries(
          definition.acknowledgedConditionsByRoleRecordId,
        ).map(([recordId, conditions]) => [recordId, [...conditions]]),
      ),
      expectedStructuralBindingMultiplicity:
        definition.expectedStructuralBindingMultiplicity,
    };
  });
}

function canonicalRoleMembers(members: readonly RoleMember[]): RoleMember[] {
  return members
    .map((member) => ({
      ...member,
      conditions: [...member.conditions].sort(compareText),
    }))
    .sort((left, right) => compareText(left.characterId, right.characterId));
}

function requiredSingleTemplateStatus(
  input: unknown,
  templateId: string,
  label: string,
): string | null {
  if (!isRecord(input)) {
    throw new Error(`The ${label} is not an object.`);
  }
  const domain = "domain" in input ? input.domain : input;
  if (!isRecord(domain) || !Array.isArray(domain.templates)) {
    throw new Error(`The ${label} is missing its template results.`);
  }
  const matches = domain.templates.filter(
    (entry) => isRecord(entry) && entry.templateId === templateId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one ${label} result for ${templateId}, found ${matches.length}.`,
    );
  }
  const status = matches[0]?.status;
  if (typeof status !== "string" || status.length === 0) {
    throw new Error(`The ${label} has an invalid status for ${templateId}.`);
  }
  return status;
}

function requireRoleRecord(
  repository: KnowledgeRepository,
  id: string,
): SourceScopedCharacterRoleRecord {
  const matches = repository.records.filter(
    (record): record is SourceScopedCharacterRoleRecord =>
      record.kind === "character_role" && record.id === id,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one character-role record ${id}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function requireTemplateRecord(
  repository: KnowledgeRepository,
  id: string,
): TeamTemplateRecord {
  const matches = repository.records.filter(
    (record): record is TeamTemplateRecord =>
      record.kind === "team_template" && record.id === id,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one team-template record ${id}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function requireTeamRecord(
  repository: KnowledgeRepository,
  id: string,
): ExactTeamRecord {
  const matches = repository.records.filter(
    (record): record is ExactTeamRecord =>
      record.kind === "team" && record.id === id,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one exact-team record ${id}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function compareSourceRecord(
  left: { sourceRecordId: string; kind: string },
  right: { sourceRecordId: string; kind: string },
): number {
  return (
    compareText(left.sourceRecordId, right.sourceRecordId) ||
    compareText(left.kind, right.kind)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
