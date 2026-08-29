import { sha256Text, stableJson } from "./io";
import {
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "./manualSnapshots";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  ManualObservationSnapshotSchema,
} from "./schemas";
import {
  evaluateSourceScopedRoleSample,
  type SourceScopedCharacterRoleRecord,
  type SourceScopedRoleSampleReport,
} from "./sourceScopedRoleSample";
import {
  buildTeamRosterCandidateDomainReport,
  type ReleasedCharacterCatalogEntry,
} from "./teamRosterCandidateDomain";
import {
  buildTeamRosterCandidateDomainExperimentFixture,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
} from "./teamRosterCandidateDomainExperiment";

type ExactTeamRecord = Extract<KnowledgeRecord, { kind: "team" }>;
type TeamTemplateRecord = Extract<
  KnowledgeRecord,
  { kind: "team_template" }
>;

export const FURINA_ROLE_RECORD_ID =
  "kqm:character-role:furina-xilonen-healer-role-luna-ii";
export const FURINA_ROLE_TEMPLATE_ID =
  "kqm:team-template:furina-team-template-hypercarry-mono";
export const FURINA_ROLE_TARGET_TEAM_ID =
  "kqm:team:furina-neuvillette-kazuha-xilonen-example";
export const FURINA_ROLE_SOURCE_RECORD_ID =
  "furina-xilonen-healer-role-luna-ii";

export const FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS = [
  ...new Set([
    ...TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
    "scripts/guide-factory/data/source-snapshots/manual-index.json",
    "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
    "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json",
    "scripts/guide-factory/sources/registry.json",
    "scripts/guide-factory/src/furinaSourceScopedRoleSample.ts",
    "scripts/guide-factory/src/manualSnapshots.ts",
    "scripts/guide-factory/src/sourceScopedRoleSample.ts",
  ]),
].sort(compareText);

const EXPECTED_ELIGIBLE_CHARACTER_COUNT = 125;
const EXPECTED_ROLE_REVIEW_STATUS = "unreviewed";
const EXPECTED_ROSTER_DOMAIN_STATUS = "withheld-unresolved-role";
const TARGET_MEMBER_CHARACTER_IDS = [
  "furina",
  "neuvillette",
  "kaedehara_kazuha",
  "xilonen",
] as const;
const SOURCE_SLOT_BINDING = {
  furina: "furina",
  healer: "xilonen",
  "flex-1": "neuvillette",
  "flex-2": "kaedehara_kazuha",
} as const;

export interface FurinaSourceScopedRoleSampleReport {
  schemaVersion: 1;
  classification: "furina-source-scoped-role-sample";
  comparisonStatus: "comparable" | "not-comparable";
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsRankClaims: false;
  supportsGlobalRoleResolution: false;
  energyRecoveryInputsUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  sourceExtractionBoundary: {
    sourceId: "kqm";
    sourceRecordId: typeof FURINA_ROLE_SOURCE_RECORD_ID;
    snapshotFile: { path: string; sha256: string };
    extractionMethod: "manual" | "agent-assisted";
    observedReviewStatus: "unreviewed" | "reviewed";
    expectedReviewStatus: typeof EXPECTED_ROLE_REVIEW_STATUS;
    matchesExpectedReviewStatus: boolean;
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
    checkedInRosterReportReference: {
      source: "checked-in-team-roster-candidate-domain-report";
      reportComparisonStatus: string;
      eligibleCharacterCount: number;
      eligibleCatalogSha256: string;
      eligibleCharacterIdsSha256: string;
      playableIdentityCount: number;
    };
    checkedInRosterReportComparison: {
      referenceReportComparable: boolean;
      eligibleCharacterCountMatches: boolean;
      eligibleCatalogHashMatches: boolean;
      eligibleCharacterIdsHashMatches: boolean;
      playableIdentityCountMatches: boolean;
      allChecksMatch: boolean;
    };
  };
  existingRosterDomainBoundary: {
    templateId: typeof FURINA_ROLE_TEMPLATE_ID;
    expectedStatus: typeof EXPECTED_ROSTER_DOMAIN_STATUS;
    observedStatus: string | null;
    remainsWithheldUnresolvedRole: boolean;
    namedRoleEvidenceInstalledAsGlobalResolver: false;
  };
  namedSampleBoundary: {
    roleRecordId: typeof FURINA_ROLE_RECORD_ID;
    templateId: typeof FURINA_ROLE_TEMPLATE_ID;
    targetTeamId: typeof FURINA_ROLE_TARGET_TEAM_ID;
    evidenceCharacterId: "xilonen";
    expectedStructuralBindingMultiplicity: 2;
    sourceSlotBinding: typeof SOURCE_SLOT_BINDING;
    sourceSlotBindingBasis: "same-page-inferred-fit";
  };
  roleSample: SourceScopedRoleSampleReport;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export interface CheckedInRosterCatalogReference {
  reportComparisonStatus: string;
  eligibleCharacterCount: number;
  eligibleCatalogSha256: string;
  eligibleCharacterIdsSha256: string;
  playableIdentityCount: number;
}

export interface CheckedInRosterCatalogComparison {
  referenceReportComparable: boolean;
  eligibleCharacterCountMatches: boolean;
  eligibleCatalogHashMatches: boolean;
  eligibleCharacterIdsHashMatches: boolean;
  playableIdentityCountMatches: boolean;
  allChecksMatch: boolean;
}

export async function runFurinaSourceScopedRoleSample(
  repository: KnowledgeRepository,
  manualInputs: readonly ManualSnapshotInput[],
  checkedInRosterDomainReportInput: unknown,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): Promise<FurinaSourceScopedRoleSampleReport> {
  const roleRecord = requireRoleRecord(repository, FURINA_ROLE_RECORD_ID);
  const template = requireTemplateRecord(repository, FURINA_ROLE_TEMPLATE_ID);
  const targetTeam = requireTeamRecord(repository, FURINA_ROLE_TARGET_TEAM_ID);
  const furinaSnapshotInput = requiredManualSnapshotInputContaining(
    manualInputs,
    "kqm",
    FURINA_ROLE_SOURCE_RECORD_ID,
  );
  const furinaSnapshot = ManualObservationSnapshotSchema.parse(
    furinaSnapshotInput.snapshot,
  );
  const manualRoleRecords = furinaSnapshot.records.filter(
    (record) =>
      record.kind === "character_role" &&
      record.sourceRecordId === FURINA_ROLE_SOURCE_RECORD_ID,
  );
  if (manualRoleRecords.length !== 1) {
    throw new Error(
      `Expected exactly one indexed KQM character-role record ${FURINA_ROLE_SOURCE_RECORD_ID}, found ${manualRoleRecords.length}.`,
    );
  }
  const manualRoleRecord = manualRoleRecords[0];

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

  const existingRosterDomain = await buildTeamRosterCandidateDomainReport({
    templates: [template],
    releasedCharacters: eligibleCharacters,
    holdoutTargets: [],
  });
  const rosterTemplateReports = existingRosterDomain.templates.filter(
    ({ templateId }) => templateId === FURINA_ROLE_TEMPLATE_ID,
  );
  if (rosterTemplateReports.length !== 1) {
    throw new Error(
      `Expected one existing roster-domain result for ${FURINA_ROLE_TEMPLATE_ID}, found ${rosterTemplateReports.length}.`,
    );
  }
  const observedRosterStatus = rosterTemplateReports[0]?.status ?? null;

  const roleSample = evaluateSourceScopedRoleSample({
    roleRecord,
    template,
    targetTeam,
    eligibleCharacters,
    expectation: {
      roleRecordId: FURINA_ROLE_RECORD_ID,
      templateId: FURINA_ROLE_TEMPLATE_ID,
      slotId: "healer",
      roleId: "healer",
      targetTeamId: FURINA_ROLE_TARGET_TEAM_ID,
      targetMemberCharacterIds: TARGET_MEMBER_CHARACTER_IDS,
      evidenceCharacterId: "xilonen",
      expectedStructuralBindingMultiplicity: 2,
    },
    sourceSlotBinding: SOURCE_SLOT_BINDING,
    sourceSlotBindingBasis: "same-page-inferred-fit",
  });

  const reviewStatusMatches =
    manualRoleRecord.extraction.reviewStatus === EXPECTED_ROLE_REVIEW_STATUS;
  const eligibleCharacterCountMatchesExpectation =
    eligibleCharacters.length === EXPECTED_ELIGIBLE_CHARACTER_COUNT;
  const remainsWithheldUnresolvedRole =
    observedRosterStatus === EXPECTED_ROSTER_DOMAIN_STATUS;
  const comparisonStatus =
    roleSample.comparisonStatus === "comparable" &&
    reviewStatusMatches &&
    eligibleCharacterCountMatchesExpectation &&
    checkedInRosterReportComparison.allChecksMatch &&
    remainsWithheldUnresolvedRole
      ? "comparable"
      : "not-comparable";

  return {
    schemaVersion: 1,
    classification: "furina-source-scoped-role-sample",
    comparisonStatus,
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsRankClaims: false,
    supportsGlobalRoleResolution: false,
    energyRecoveryInputsUsed: false,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    sourceExtractionBoundary: {
      sourceId: "kqm",
      sourceRecordId: FURINA_ROLE_SOURCE_RECORD_ID,
      snapshotFile: { ...furinaSnapshotInput.snapshotFile },
      extractionMethod: manualRoleRecord.extraction.method,
      observedReviewStatus: manualRoleRecord.extraction.reviewStatus,
      expectedReviewStatus: EXPECTED_ROLE_REVIEW_STATUS,
      matchesExpectedReviewStatus: reviewStatusMatches,
    },
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
      templateId: FURINA_ROLE_TEMPLATE_ID,
      expectedStatus: EXPECTED_ROSTER_DOMAIN_STATUS,
      observedStatus: observedRosterStatus,
      remainsWithheldUnresolvedRole,
      namedRoleEvidenceInstalledAsGlobalResolver: false,
    },
    namedSampleBoundary: {
      roleRecordId: FURINA_ROLE_RECORD_ID,
      templateId: FURINA_ROLE_TEMPLATE_ID,
      targetTeamId: FURINA_ROLE_TARGET_TEAM_ID,
      evidenceCharacterId: "xilonen",
      expectedStructuralBindingMultiplicity: 2,
      sourceSlotBinding: SOURCE_SLOT_BINDING,
      sourceSlotBindingBasis: "same-page-inferred-fit",
    },
    roleSample,
    cautions: [
      "The one Xilonen observation is non-exhaustive and unranked; it is not a reusable healer catalog.",
      "The exact target team, template, and role evidence share one KQM page, so this is a same-page extraction and structural-binding check rather than independent gameplay validation.",
      "The two flex-slot permutations explain the structural multiplicity of two; they are not two distinct recommended teams.",
      "The broader roster-domain experiment deliberately remains role-withheld because this named observation is not installed as a global role resolver.",
      "The current 125-ID catalog is checked against the independently stored counts and fingerprints in the checked-in roster-domain report; same-count membership drift does not pass this gate.",
      "No energy threshold, rotation energy model, damage objective, equipment search, or stat allocation is evaluated here.",
    ],
    prohibitedInterpretations: [
      "complete-healer-domain",
      "global-role-resolution",
      "team-recommendation",
      "team-ranking",
      "gameplay-quality",
      "independent-gameplay-validation",
      "energy-requirement",
    ],
  };
}

export function parseCheckedInRosterCatalogReference(
  input: unknown,
): CheckedInRosterCatalogReference {
  if (!isRecord(input)) {
    throw new Error("The checked-in roster-domain report is not an object.");
  }
  const released = input.releasedCatalogBoundary;
  const domain = input.domain;
  if (!isRecord(released) || !isRecord(domain)) {
    throw new Error(
      "The checked-in roster-domain report is missing its catalog boundaries.",
    );
  }
  const compact = domain.catalogBoundary;
  if (!isRecord(compact)) {
    throw new Error(
      "The checked-in roster-domain report is missing domain.catalogBoundary.",
    );
  }
  const reference: CheckedInRosterCatalogReference = {
    reportComparisonStatus: requiredString(
      input.comparisonStatus,
      "comparisonStatus",
    ),
    eligibleCharacterCount: requiredNonNegativeInteger(
      released.eligibleCharacterCount,
      "releasedCatalogBoundary.eligibleCharacterCount",
    ),
    eligibleCatalogSha256: requiredSha256(
      released.eligibleCatalogSha256,
      "releasedCatalogBoundary.eligibleCatalogSha256",
    ),
    eligibleCharacterIdsSha256: requiredSha256(
      compact.characterIdsSha256,
      "domain.catalogBoundary.characterIdsSha256",
    ),
    playableIdentityCount: requiredNonNegativeInteger(
      compact.playableIdentityCount,
      "domain.catalogBoundary.playableIdentityCount",
    ),
  };
  const compactCharacterCount = requiredNonNegativeInteger(
    compact.characterCount,
    "domain.catalogBoundary.characterCount",
  );
  if (compactCharacterCount !== reference.eligibleCharacterCount) {
    throw new Error(
      "The checked-in roster-domain report has inconsistent eligible character counts.",
    );
  }
  return reference;
}

export function compareEligibleCatalogWithCheckedInRosterReport(
  eligibleCharacters: readonly ReleasedCharacterCatalogEntry[],
  reference: CheckedInRosterCatalogReference,
): CheckedInRosterCatalogComparison {
  const eligibleCharacterCountMatches =
    eligibleCharacters.length === reference.eligibleCharacterCount;
  const eligibleCatalogHashMatches =
    sha256Text(stableJson(eligibleCharacters)) ===
    reference.eligibleCatalogSha256;
  const eligibleCharacterIdsHashMatches =
    sha256Text(
      stableJson(eligibleCharacters.map(({ characterId }) => characterId)),
    ) === reference.eligibleCharacterIdsSha256;
  const playableIdentityCountMatches =
    new Set(
      eligibleCharacters.map(
        ({ characterId, playableIdentityId }) =>
          playableIdentityId ??
          (characterId.startsWith("traveler_") ? "traveler" : characterId),
      ),
    ).size === reference.playableIdentityCount;
  const referenceReportComparable =
    reference.reportComparisonStatus === "comparable";
  return {
    referenceReportComparable,
    eligibleCharacterCountMatches,
    eligibleCatalogHashMatches,
    eligibleCharacterIdsHashMatches,
    playableIdentityCountMatches,
    allChecksMatch:
      referenceReportComparable &&
      eligibleCharacterCountMatches &&
      eligibleCatalogHashMatches &&
      eligibleCharacterIdsHashMatches &&
      playableIdentityCountMatches,
  };
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return value;
}

function requiredSha256(value: unknown, path: string): string {
  const parsed = requiredString(value, path);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return parsed;
}

function requiredNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`The checked-in roster-domain report has invalid ${path}.`);
  }
  return value as number;
}
