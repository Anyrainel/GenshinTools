import path from "node:path";
import { fileURLToPath } from "node:url";
import { characters } from "@/data/resources";
import type { GameCatalogs } from "./catalogs";
import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type KnowledgeRecord,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  authenticateSourceConditionedGuidePacketReport,
  buildSourceConditionedGuidePacketReport,
  type GeneratedFromEntry,
  type SourceConditionedAtomicClaim,
  type SourceConditionedGuidePacketAuthentication,
  type SourceConditionedGuidePacketInput,
  type SourceConditionedGuidePacketReport,
  type SourceConditionMap,
  type SourceConditionPredicateAst,
  type SourceTeamPacketInput,
} from "./sourceConditionedGuidePacket";
import {
  compareSourceToBaselineConstellationScope,
} from "./sourceBaselineInvestmentComparison";
import { cloneTeamMemberInvestment } from "./teamMemberInvestment";
import {
  buildTeamRosterCandidateDomainReport,
  TEAM_ROSTER_CANDIDATE_DOMAIN_STATIC_DEPENDENCY_PATHS,
  type ReleasedCharacterCatalogEntry,
  type TeamRosterHoldoutOutcome,
  type TeamTemplateRecord,
} from "./teamRosterCandidateDomain";

export interface BuildIttoSourceConditionedGuidePacketInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  catalogs: GameCatalogs;
  generatedFrom: readonly GeneratedFromEntry[];
}

export const ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "reports",
  "itto-source-conditioned-guide-packets.json",
);

export const ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS = [
  "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
  "scripts/guide-factory/src/ittoSourceConditionedGuidePacket.ts",
  "scripts/guide-factory/src/assemble-itto-source-conditioned-guide-packets.ts",
  "scripts/guide-factory/src/catalogs.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/sourceBaselineInvestmentComparison.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  ...TEAM_ROSTER_CANDIDATE_DOMAIN_STATIC_DEPENDENCY_PATHS,
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json",
  "scripts/guide-factory/data/source-snapshots/manual-index.json",
  "scripts/guide-factory/sources/registry.json",
] as const;

const EXPERIMENT_ID = "itto-source-conditioned-guide-packets-v1";
const SOURCE_ID = "kqm";
const PAGE_URL = "https://keqingmains.com/q/itto-quickguide/";
const SOURCE_VERSION = "Version 5.6";
const MANUAL_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json";
const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const PINNED_SOURCE_REVISIONS: Readonly<
  Record<string, { fileSha256: string; canonicalObjectSha256: string }>
> = {
  [REPOSITORY_PATH]: {
    fileSha256:
      "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
    canonicalObjectSha256:
      "66179b2cfea81c74cc233a73ed25df6697984f6ebf04289df2cce67fbefd08c8",
  },
  [MANUAL_SNAPSHOT_PATH]: {
    fileSha256:
      "1c1c3efbac87c85fa0e00d38d71aaf5d229acc54a78c75966ec35201f1e837be",
    canonicalObjectSha256:
      "0a0dd2a6329445634c24226f9f0b22601d5b4690e9f766f36332059958f4d154",
  },
  [MANUAL_INDEX_PATH]: {
    fileSha256:
      "45515e3bb3ee7a68b217b2f3263a542f22d4a2e987eeba9003bb71a170ba6010",
    canonicalObjectSha256:
      "c669b925cdbbf3b591bcac66f4e7ec42332f98dc5e1a37be128662fa40504630",
  },
  [SOURCE_REGISTRY_PATH]: {
    fileSha256:
      "3b628e74cb1372b3c0773c75e214d7d4b90a7e064ee83c0c925940f315eddfe2",
    canonicalObjectSha256:
      "2974828169ee2a7290bdcb8108b30db5beabf8ea3a0eb879878fe468044501a8",
  },
};

const RAW_GUIDE_RECORD_IDS = [
  "itto-on-field-artifact-stats-version-5-6",
  "itto-contextual-artifact-sets-version-5-6",
  "itto-contextual-weapons-version-5-6",
] as const;
const RAW_TEMPLATE_RECORD_ID =
  "itto-xilonen-double-geo-template-version-5-6" as const;
const RAW_TEAM_RECORD_IDS = [
  "itto-xilonen-furina-yelan-example-version-5-6",
  "itto-xilonen-furina-xingqiu-example-version-5-6",
  "itto-c2-xilonen-gorou-furina-example-version-5-6",
] as const;
const RAW_RECORD_IDS = [
  ...RAW_GUIDE_RECORD_IDS,
  RAW_TEMPLATE_RECORD_ID,
  ...RAW_TEAM_RECORD_IDS,
] as const;

const GUIDE_RECORD_IDS = [
  "kqm:character-guide:itto-on-field-artifact-stats-version-5-6",
  "kqm:character-guide:itto-contextual-artifact-sets-version-5-6",
  "kqm:character-guide:itto-contextual-weapons-version-5-6",
] as const;
const TEMPLATE_RECORD_ID =
  "kqm:team-template:itto-xilonen-double-geo-template-version-5-6" as const;
const TEAM_RECORD_IDS = [
  "kqm:team:itto-xilonen-furina-yelan-example-version-5-6",
  "kqm:team:itto-xilonen-furina-xingqiu-example-version-5-6",
  "kqm:team:itto-c2-xilonen-gorou-furina-example-version-5-6",
] as const;
const PRESET_TEAM_ID = "genshintools-presets:team:8ru0gxT0jJgK50AfWD";

type ClaimExtraction =
  | { type: "main-stat"; slot: "sands" | "goblet" | "circlet"; index: number }
  | { type: "substat"; index: number }
  | { type: "artifact-group"; index: number }
  | { type: "weapon-group"; index: number };

type PinnedClaimSpec = {
  claimId: string;
  repositoryRecordId: (typeof GUIDE_RECORD_IDS)[number];
  extraction: ClaimExtraction;
  sourceConditions: readonly string[];
  predicate: SourceConditionPredicateAst;
};

const ON_FIELD_CONDITION = ["Itto is used as an on-field DPS."] as const;
const OMITTED_ENERGY_CONDITION = [
  "After meeting the deliberately omitted rotation-specific ER need; this priority captures only the offensive tail.",
] as const;

const PINNED_CLAIM_SPECS: readonly PinnedClaimSpec[] = [
  {
    claimId: `${GUIDE_RECORD_IDS[0]}:main-stat:sands:0`,
    repositoryRecordId: GUIDE_RECORD_IDS[0],
    extraction: { type: "main-stat", slot: "sands", index: 0 },
    sourceConditions: ON_FIELD_CONDITION,
    predicate: unresolved(
      "gameplay-role",
      "An on-field DPS role is gameplay context, not an exact-roster fact.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[0]}:main-stat:goblet:0`,
    repositoryRecordId: GUIDE_RECORD_IDS[0],
    extraction: { type: "main-stat", slot: "goblet", index: 0 },
    sourceConditions: ON_FIELD_CONDITION,
    predicate: unresolved(
      "gameplay-role",
      "An on-field DPS role is gameplay context, not an exact-roster fact.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[0]}:main-stat:goblet:1`,
    repositoryRecordId: GUIDE_RECORD_IDS[0],
    extraction: { type: "main-stat", slot: "goblet", index: 1 },
    sourceConditions: [
      "Itto is used as an on-field DPS.",
      "The team provides abundant DMG Bonus, such as a Xilonen Double Geo team with Furina; investment in Xilonen or Furina can make DEF% outperform Geo DMG Bonus.",
    ],
    predicate: {
      type: "all",
      predicates: [
        unresolved(
          "gameplay-role",
          "An on-field DPS role is gameplay context, not an exact-roster fact.",
        ),
        unresolved(
          "buff-coverage",
          "Abundant DMG Bonus depends on buff coverage not represented by the exact roster.",
        ),
        unresolved(
          "investment-threshold",
          "The source does not quantify the Xilonen or Furina investment threshold.",
        ),
        unresolved(
          "comparative-performance",
          "DEF% versus Geo DMG Bonus has not been calculated for this team packet.",
        ),
      ],
    },
  },
  {
    claimId: `${GUIDE_RECORD_IDS[0]}:main-stat:circlet:0`,
    repositoryRecordId: GUIDE_RECORD_IDS[0],
    extraction: { type: "main-stat", slot: "circlet", index: 0 },
    sourceConditions: ON_FIELD_CONDITION,
    predicate: unresolved(
      "gameplay-role",
      "An on-field DPS role is gameplay context, not an exact-roster fact.",
    ),
  },
  ...([0, 1, 2] as const).map(
    (index): PinnedClaimSpec => ({
      claimId: `${GUIDE_RECORD_IDS[0]}:substat:${index}`,
      repositoryRecordId: GUIDE_RECORD_IDS[0],
      extraction: { type: "substat", index },
      sourceConditions: OMITTED_ENERGY_CONDITION,
      predicate: {
        type: "deferred-energy-prerequisite",
        reason:
          "The source conditions this offensive priority on a rotation-specific ER need deliberately omitted from the repository.",
      },
    }),
  ),
  {
    claimId: `${GUIDE_RECORD_IDS[1]}:artifact-group:0`,
    repositoryRecordId: GUIDE_RECORD_IDS[1],
    extraction: { type: "artifact-group", index: 0 },
    sourceConditions: [
      "Itto uses an on-field damage build; the source describes this set as applicable across all of his team archetypes.",
    ],
    predicate: unresolved(
      "gameplay-role",
      "The on-field damage-build condition is not established by an exact roster.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[1]}:artifact-group:1`,
    repositoryRecordId: GUIDE_RECORD_IDS[1],
    extraction: { type: "artifact-group", index: 1 },
    sourceConditions: ["Itto is played in a team with Furina."],
    predicate: rosterIncludes("furina"),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[1]}:artifact-group:2`,
    repositoryRecordId: GUIDE_RECORD_IDS[1],
    extraction: { type: "artifact-group", index: 2 },
    sourceConditions: ["A good Retracing Bolide set is already owned."],
    predicate: unresolved(
      "owned-inventory",
      "Owned artifact quality is account context and is not represented by a source team.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[1]}:artifact-group:3`,
    repositoryRecordId: GUIDE_RECORD_IDS[1],
    extraction: { type: "artifact-group", index: 3 },
    sourceConditions: [
      "Itto is played in a Plunge composition with Xianyun.",
    ],
    predicate: {
      type: "all",
      predicates: [
        rosterIncludes("xianyun"),
        unresolved(
          "gameplay-sequence",
          "A Plunge composition requires gameplay-sequence evidence beyond the roster.",
        ),
      ],
    },
  },
  {
    claimId: `${GUIDE_RECORD_IDS[2]}:weapon-group:0`,
    repositoryRecordId: GUIDE_RECORD_IDS[2],
    extraction: { type: "weapon-group", index: 0 },
    sourceConditions: [
      "Prioritize Itto's personal damage; the source identifies Redhorn Stonethresher as his signature Best-in-Slot option.",
    ],
    predicate: unresolved(
      "player-preference",
      "Prioritizing personal damage is a player preference, and the source description is not a computed cross-team ranking.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[2]}:weapon-group:1`,
    repositoryRecordId: GUIDE_RECORD_IDS[2],
    extraction: { type: "weapon-group", index: 1 },
    sourceConditions: [
      "Serpent Spine is owned and its passive stack requirements can be accommodated.",
    ],
    predicate: {
      type: "all",
      predicates: [
        unresolved(
          "owned-inventory",
          "Weapon ownership is account context not represented by a source team.",
        ),
        unresolved(
          "passive-execution",
          "Passive-stack accommodation requires gameplay-sequence evidence.",
        ),
      ],
    },
  },
  {
    claimId: `${GUIDE_RECORD_IDS[2]}:weapon-group:2`,
    repositoryRecordId: GUIDE_RECORD_IDS[2],
    extraction: { type: "weapon-group", index: 2 },
    sourceConditions: ["A free craftable option is preferred."],
    predicate: unresolved(
      "player-preference",
      "A preference for a free craftable option is not an exact-roster fact.",
    ),
  },
  {
    claimId: `${GUIDE_RECORD_IDS[2]}:weapon-group:3`,
    repositoryRecordId: GUIDE_RECORD_IDS[2],
    extraction: { type: "weapon-group", index: 3 },
    sourceConditions: [
      "Itto is played in a Plunge composition with Xianyun and Furina.",
    ],
    predicate: {
      type: "all",
      predicates: [
        rosterIncludes("xianyun"),
        rosterIncludes("furina"),
        unresolved(
          "gameplay-sequence",
          "A Plunge composition requires gameplay-sequence evidence beyond the roster.",
        ),
      ],
    },
  },
];

function rosterIncludes(characterId: string): SourceConditionPredicateAst {
  return { type: "exact-team-roster-includes", characterId };
}

function unresolved(
  category: Extract<
    SourceConditionPredicateAst,
    { type: "unresolved-context" }
  >["category"],
  reason: string,
): SourceConditionPredicateAst {
  return { type: "unresolved-context", category, reason };
}

type GuideRecordBase = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type GuideRecommendation = NonNullable<
  GuideRecordBase["recommendations"]
>[number];
type GuideRecord = GuideRecordBase & {
  recommendations: GuideRecommendation[];
};
type TeamRecordBase = Extract<KnowledgeRecord, { kind: "team" }>;
type TeamRecord = TeamRecordBase & {
  intent: NonNullable<TeamRecordBase["intent"]>;
  exhaustiveness: NonNullable<TeamRecordBase["exhaustiveness"]>;
  rankingClaim: NonNullable<TeamRecordBase["rankingClaim"]>;
};
type CandidateTemplateRecord = TeamTemplateRecord & {
  intent: NonNullable<TeamTemplateRecord["intent"]>;
  exhaustiveness: NonNullable<TeamTemplateRecord["exhaustiveness"]>;
  rankingClaim: NonNullable<TeamTemplateRecord["rankingClaim"]>;
};
type ManualRecord = ManualObservationSnapshot["records"][number];
type ManualGuideRecord = Extract<ManualRecord, { kind: "character_guide" }>;
type ManualTeamRecord = Extract<ManualRecord, { kind: "team" }>;

export async function buildIttoSourceConditionedGuidePacketReport(
  input: BuildIttoSourceConditionedGuidePacketInput,
): Promise<SourceConditionedGuidePacketReport> {
  const canonicalInput = await prepareCanonicalInput(input).catch((error) =>
    failedCanonicalInput(input, error),
  );
  return buildSourceConditionedGuidePacketReport(canonicalInput);
}

export async function authenticateIttoSourceConditionedGuidePacketReport(
  serializedReport: SourceConditionedGuidePacketReport,
  input: BuildIttoSourceConditionedGuidePacketInput,
): Promise<SourceConditionedGuidePacketAuthentication> {
  const canonicalInput = await prepareCanonicalInput(input).catch((error) =>
    failedCanonicalInput(input, error),
  );
  return authenticateSourceConditionedGuidePacketReport(
    serializedReport,
    canonicalInput,
  );
}

export function buildIttoGuideEligibleReleasedCharacterCatalog(
  catalogs: GameCatalogs,
): ReleasedCharacterCatalogEntry[] {
  const seen = new Set<string>();
  return characters
    .map(({ id: characterId }) => {
      if (seen.has(characterId)) {
        throw new Error(`Stable character catalog repeats ${characterId}.`);
      }
      seen.add(characterId);
      const elementId = catalogs.characterElements.get(characterId);
      if (!elementId) {
        throw new Error(
          `Stable character ${characterId} is missing an element in character_stats.json.`,
        );
      }
      return {
        characterId,
        elementId,
        playableIdentityId: characterId.startsWith("traveler_")
          ? "traveler"
          : characterId,
      };
    })
    .filter(({ characterId }) => !/^(?:manekin|manekina)_/.test(characterId))
    .sort((left, right) => left.characterId.localeCompare(right.characterId));
}

async function prepareCanonicalInput(
  input: BuildIttoSourceConditionedGuidePacketInput,
): Promise<SourceConditionedGuidePacketInput> {
  assertGeneratedFrom(input.generatedFrom);
  const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
  const manualSnapshot = ManualObservationSnapshotSchema.parse(
    input.manualSnapshotInput,
  );
  const manualIndex = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
  const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistryInput);
  authenticateJsonObject(
    repository,
    REPOSITORY_PATH,
    input.generatedFrom,
  );
  authenticateJsonObject(
    manualSnapshot,
    MANUAL_SNAPSHOT_PATH,
    input.generatedFrom,
  );
  authenticateJsonObject(
    manualIndex,
    MANUAL_INDEX_PATH,
    input.generatedFrom,
  );
  authenticateJsonObject(
    sourceRegistry,
    SOURCE_REGISTRY_PATH,
    input.generatedFrom,
  );
  assertSourceBoundary(manualSnapshot, manualIndex, sourceRegistry);

  const recordsById = new Map(
    repository.records.map((record) => [record.id, record]),
  );
  const guides = GUIDE_RECORD_IDS.map((recordId) =>
    requiredGuide(recordsById, recordId),
  );
  const template = requiredTemplate(recordsById, TEMPLATE_RECORD_ID);
  const teams = TEAM_RECORD_IDS.map((recordId) =>
    requiredTeam(recordsById, recordId),
  );
  const rawRecordsById = new Map(
    manualSnapshot.records.map((record) => [record.sourceRecordId, record]),
  );
  authenticateSelectedRepositoryRecords(
    guides,
    template,
    teams,
    rawRecordsById,
  );

  const sourceClaimCatalog = buildAtomicClaims(guides);
  const conditionMap = buildConditionMap();
  const releasedCharacters = buildIttoGuideEligibleReleasedCharacterCatalog(
    input.catalogs,
  );
  const rosterReport = await buildTeamRosterCandidateDomainReport({
    templates: [template],
    releasedCharacters,
    holdoutTargets: teams.map((team, index) => ({
      targetId: team.id,
      templateId: template.id,
      memberCharacterIds: memberTuple(team),
      expectedOutcome: index < 2 ? "accepted" : "structural-rejected",
      expectedStructuralAssignmentMultiplicity: index < 2 ? 2 : 0,
      category: "same-page-authored-example-structural-projection",
      provenance: {
        sourceId: SOURCE_ID,
        sourceRecordId: RAW_TEAM_RECORD_IDS[index]!,
      },
    })),
  });
  assertRosterReport(rosterReport, teams);
  const holdoutsById = new Map(
    rosterReport.holdouts.map((holdout) => [holdout.targetId, holdout]),
  );
  const teamPackets = teams.map((team, packetIndex) =>
    buildTeamPacket({
      team,
      rawTeam: requiredManualTeam(
        rawRecordsById,
        RAW_TEAM_RECORD_IDS[packetIndex]!,
      ),
      packetIndex,
      holdout: requiredHoldout(holdoutsById, team.id),
      template,
      repositoryTeams: repository.records.filter(
        (record): record is TeamRecord => record.kind === "team",
      ),
    }),
  );

  return {
    experimentId: EXPERIMENT_ID,
    generatedFrom: input.generatedFrom,
    sourceBoundary: buildSourceBoundary(input.generatedFrom),
    policyBoundary: {
      crossRecordJoinOwner: "guide-factory-wrapper",
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionPolicy:
        "pinned-exact-condition-array-hash-to-typed-predicate-map",
      arbitraryEnglishParsingAllowed: false,
      conditionMap,
      allowedStructuredFacts: [
        "exact-source-team-roster",
        "exact-catalog-identity",
        "source-and-baseline-constellation-scope",
      ],
      disallowedStructuredFacts: [
        "gameplay-sequence",
        "account-inventory",
        "player-preference",
      ],
      investmentComparisonScope: "constellation-only",
      talentLevelsEvaluated: false,
    },
    sourceClaimCatalog,
    teamPackets,
    expectedCounts: {
      packetCount: 3,
      sourceClaimCount: 15,
      claimCellCount: 45,
    },
    cautions: [
      "All seven KQM records are agent-assisted and unreviewed; this report is withheld from publication.",
      "Thirty-six cells are withheld: twenty-seven retain unresolved non-roster context and nine retain the deliberately omitted energy prerequisite.",
      "Template membership and TeamMeta.hasReaction are structural runtime representations only, not proof that a team executes Crystallize or satisfies the source gameplay conditions.",
      "Exact roster overlap with a GenshinTools preset does not bind that preset's equipment to the KQM team and does not resolve unspecified baseline investment.",
    ],
    prohibitedInterpretations: [
      "Do not publish these packets as character guides or player-facing recommendations.",
      "Do not infer weapon, artifact, team, or stat rankings from catalog order or matched cells.",
      "Do not infer damage, optimality, formulas, rotations, or ER requirements from this report.",
      "Do not multiply claim axes into assembled builds; the forty-five cells are independent descriptive projections.",
      "Do not treat source-unspecified constellation investment as universal evidence for a constrained baseline comparison.",
    ],
  };
}

function assertGeneratedFrom(entries: readonly GeneratedFromEntry[]): void {
  const expectedPaths = [...new Set(ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS)].sort(
    (left, right) => left.localeCompare(right),
  );
  const actualPaths = entries
    .map(({ path }) => path)
    .sort((left, right) => left.localeCompare(right));
  if (stableJson(actualPaths) !== stableJson(expectedPaths)) {
    throw new Error(
      "Itto packet generatedFrom paths do not exactly match the canonical input path list.",
    );
  }
  for (const [index, entry] of entries.entries()) {
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error(
        `Itto packet generatedFrom entry ${index} has an invalid SHA-256 hash.`,
      );
    }
  }
}

function authenticateJsonObject(
  value: unknown,
  relativePath: string,
  generatedFrom: readonly GeneratedFromEntry[],
): void {
  const expectedRevision = PINNED_SOURCE_REVISIONS[relativePath];
  if (!expectedRevision) {
    throw new Error(`No pinned source revision exists for ${relativePath}.`);
  }
  const suppliedFileHash = requiredSourceHash(generatedFrom, relativePath);
  if (suppliedFileHash !== expectedRevision.fileSha256) {
    throw new Error(`${relativePath} bytes drifted from the pinned source revision.`);
  }
  const canonicalObjectHash = sha256Text(stableJson(value));
  if (canonicalObjectHash !== expectedRevision.canonicalObjectSha256) {
    throw new Error(
      `${relativePath} object does not match the pinned canonical source object.`,
    );
  }
}

function assertSourceBoundary(
  snapshot: ManualObservationSnapshot,
  manualIndex: ReturnType<typeof ManualSnapshotIndexSchema.parse>,
  sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>,
): void {
  if (
    snapshot.sourceId !== SOURCE_ID ||
    snapshot.page.url !== PAGE_URL ||
    snapshot.page.sourceVersion !== SOURCE_VERSION
  ) {
    throw new Error(
      "The supplied Itto manual snapshot does not match the pinned KQM page and source version.",
    );
  }
  const recordIds = snapshot.records
    .map(({ sourceRecordId }) => sourceRecordId)
    .sort((left, right) => left.localeCompare(right));
  const expectedRecordIds = [...RAW_RECORD_IDS].sort((left, right) =>
    left.localeCompare(right),
  );
  if (stableJson(recordIds) !== stableJson(expectedRecordIds)) {
    throw new Error(
      "The Itto manual snapshot must contain exactly the seven pinned source records.",
    );
  }
  if (
    snapshot.records.some(
      (record) =>
        record.extraction.method !== "agent-assisted" ||
        record.extraction.reviewStatus !== "unreviewed",
    )
  ) {
    throw new Error(
      "The Itto packet publication boundary expects seven unreviewed agent-assisted records.",
    );
  }
  const indexMatches = manualIndex.snapshots.filter(
    (entry) =>
      entry.sourceId === SOURCE_ID && entry.path === MANUAL_SNAPSHOT_PATH,
  );
  if (indexMatches.length !== 1) {
    throw new Error(
      "The manual index must contain exactly one pinned Itto snapshot entry.",
    );
  }
  const manifests = sourceRegistry.sources.filter(({ id }) => id === SOURCE_ID);
  const manifest = manifests[0];
  if (
    manifests.length !== 1 ||
    !manifest ||
    manifest.status !== "active" ||
    manifest.permission !== "unknown" ||
    manifest.ingestionMode !== "manual-observation" ||
    manifest.recordFormat !== "manual-observation-v1"
  ) {
    throw new Error(
      "The KQM registry entry is missing or incompatible with manual observation ingestion.",
    );
  }
}

function buildSourceBoundary(
  generatedFrom: readonly GeneratedFromEntry[],
): SourceConditionedGuidePacketInput["sourceBoundary"] {
  return {
    sourceId: SOURCE_ID,
    pageUrl: PAGE_URL,
    sourceVersion: SOURCE_VERSION,
    rawManualSourceRecordIds: [...RAW_RECORD_IDS],
    consolidatedGuideRecordIds: [...GUIDE_RECORD_IDS],
    templateRecordId: TEMPLATE_RECORD_ID,
    exactTeamRecordIds: [...TEAM_RECORD_IDS],
    extractionMethod: "agent-assisted",
    reviewStatus: "unreviewed",
    sourceRegistryStatus: "active",
    sourceRegistryPermission: "unknown",
    repositoryRecordStatus: "candidate",
    promotionEligible: false,
    sourceHashes: [
      REPOSITORY_PATH,
      MANUAL_SNAPSHOT_PATH,
      MANUAL_INDEX_PATH,
      SOURCE_REGISTRY_PATH,
    ]
      .map((relativePath) => ({
        path: relativePath,
        sha256: requiredSourceHash(generatedFrom, relativePath),
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function requiredSourceHash(
  generatedFrom: readonly GeneratedFromEntry[],
  relativePath: string,
): string {
  const matches = generatedFrom.filter(({ path }) => path === relativePath);
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(
      `Expected exactly one generatedFrom hash for ${relativePath}.`,
    );
  }
  return matches[0].sha256;
}

function requiredGuide(
  recordsById: ReadonlyMap<string, KnowledgeRecord>,
  recordId: string,
): GuideRecord {
  const record = recordsById.get(recordId);
  if (
    !record ||
    record.kind !== "character_guide" ||
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    !record.recommendations ||
    record.recommendations.length === 0
  ) {
    throw new Error(`Missing candidate character-guide record ${recordId}.`);
  }
  return record as GuideRecord;
}

function requiredTemplate(
  recordsById: ReadonlyMap<string, KnowledgeRecord>,
  recordId: string,
): CandidateTemplateRecord {
  const record = recordsById.get(recordId);
  if (
    !record ||
    record.kind !== "team_template" ||
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    record.intent == null ||
    record.exhaustiveness == null ||
    record.rankingClaim == null
  ) {
    throw new Error(`Missing candidate team-template record ${recordId}.`);
  }
  if (stableJson(record.reactions) !== stableJson(["crystallize"])) {
    throw new Error(
      "The pinned Itto team template must declare exactly Crystallize.",
    );
  }
  return record as CandidateTemplateRecord;
}

function requiredTeam(
  recordsById: ReadonlyMap<string, KnowledgeRecord>,
  recordId: string,
): TeamRecord {
  const record = recordsById.get(recordId);
  if (
    !record ||
    record.kind !== "team" ||
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    record.intent == null ||
    record.exhaustiveness == null ||
    record.rankingClaim == null
  ) {
    throw new Error(`Missing candidate exact-team record ${recordId}.`);
  }
  if (record.members.length !== 4) {
    throw new Error(`Exact-team record ${recordId} must have four members.`);
  }
  return record as TeamRecord;
}

function authenticateSelectedRepositoryRecords(
  guides: readonly GuideRecord[],
  template: CandidateTemplateRecord,
  teams: readonly TeamRecord[],
  rawRecordsById: ReadonlyMap<string, ManualRecord>,
): void {
  guides.forEach((guide, index) => {
    const raw = requiredManualGuide(
      rawRecordsById,
      RAW_GUIDE_RECORD_IDS[index]!,
    );
    assertSingleSourceReference(guide, raw.sourceRecordId);
    if (
      guide.characterId !== raw.characterId ||
      guide.recommendations.length !== 1 ||
      stableJson(guide.recommendations[0]) !== stableJson(raw.recommendation)
    ) {
      throw new Error(
        `Repository guide ${guide.id} does not exactly preserve its pinned manual recommendation.`,
      );
    }
  });

  const rawTemplate = rawRecordsById.get(RAW_TEMPLATE_RECORD_ID);
  if (!rawTemplate || rawTemplate.kind !== "team_template") {
    throw new Error(`Missing manual team-template ${RAW_TEMPLATE_RECORD_ID}.`);
  }
  assertSingleSourceReference(template, rawTemplate.sourceRecordId);
  const templateProjection = {
    label: template.label,
    intent: template.intent,
    exhaustiveness: template.exhaustiveness,
    rankingClaim: template.rankingClaim,
    slots: template.slots,
    reactions: template.reactions,
  };
  const rawTemplateProjection = {
    label: rawTemplate.label,
    intent: rawTemplate.intent,
    exhaustiveness: rawTemplate.exhaustiveness,
    rankingClaim: rawTemplate.rankingClaim,
    slots: rawTemplate.slots,
    reactions: rawTemplate.reactions,
  };
  if (stableJson(templateProjection) !== stableJson(rawTemplateProjection)) {
    throw new Error(
      "Repository Itto template does not preserve the pinned manual structure.",
    );
  }

  teams.forEach((team, index) => {
    const raw = requiredManualTeam(
      rawRecordsById,
      RAW_TEAM_RECORD_IDS[index]!,
    );
    assertSingleSourceReference(team, raw.sourceRecordId);
    if (
      team.label !== (raw.label ?? null) ||
      team.intent !== raw.intent ||
      team.exhaustiveness !== raw.exhaustiveness ||
      team.rankingClaim !== raw.rankingClaim ||
      stableJson(team.rotations) !== stableJson(raw.rotations) ||
      stableJson(team.members.map(({ characterId }) => characterId)) !==
        stableJson(raw.members.map(({ characterId }) => characterId))
    ) {
      throw new Error(
        `Repository team ${team.id} does not preserve its pinned manual source facts.`,
      );
    }
    team.members.forEach((member, memberIndex) => {
      const rawMember = raw.members[memberIndex];
      if (!rawMember) throw new Error(`Missing raw member ${memberIndex}.`);
      if (
        stableJson(member.investment) !==
        stableJson(normalizeRawSourceInvestment(rawMember))
      ) {
        throw new Error(
          `Repository team ${team.id} changed source investment for ${member.characterId}.`,
        );
      }
      if (member.selectedWeapon != null || member.selectedArtifact != null) {
        throw new Error(
          `Repository team ${team.id} unexpectedly binds baseline equipment.`,
        );
      }
    });
    for (const unknown of raw.unknowns) {
      if (!team.unknowns.includes(unknown)) {
        throw new Error(
          `Repository team ${team.id} dropped manual unknown ${unknown}.`,
        );
      }
    }
  });
}

function assertSingleSourceReference(
  record: KnowledgeRecord,
  sourceRecordId: string,
): void {
  const refs = record.sourceRefs.filter(
    (sourceRef) =>
      sourceRef.sourceId === SOURCE_ID &&
      sourceRef.sourceRecordId === sourceRecordId &&
      "url" in sourceRef.locator &&
      sourceRef.locator.url === PAGE_URL,
  );
  if (refs.length !== 1 || record.sourceRefs.length !== 1) {
    throw new Error(
      `Repository record ${record.id} must have exactly one pinned KQM source reference.`,
    );
  }
}

function requiredManualGuide(
  recordsById: ReadonlyMap<string, ManualRecord>,
  sourceRecordId: string,
): ManualGuideRecord {
  const record = recordsById.get(sourceRecordId);
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing manual character guide ${sourceRecordId}.`);
  }
  return record;
}

function requiredManualTeam(
  recordsById: ReadonlyMap<string, ManualRecord>,
  sourceRecordId: string,
): ManualTeamRecord {
  const record = recordsById.get(sourceRecordId);
  if (!record || record.kind !== "team") {
    throw new Error(`Missing manual exact team ${sourceRecordId}.`);
  }
  return record;
}

function normalizeRawSourceInvestment(
  member: ManualTeamRecord["members"][number],
): TeamRecord["members"][number]["investment"] {
  if (
    member.constellation == null &&
    member.minConstellation == null &&
    member.maxConstellation == null
  ) {
    return { status: "unspecified" };
  }
  return {
    status: "partial",
    ...(member.constellation == null
      ? {}
      : { constellation: member.constellation }),
    ...(member.minConstellation == null
      ? {}
      : { minConstellation: member.minConstellation }),
    ...(member.maxConstellation == null
      ? {}
      : { maxConstellation: member.maxConstellation }),
  };
}

function buildAtomicClaims(
  guides: readonly GuideRecord[],
): SourceConditionedAtomicClaim[] {
  const guidesById = new Map(guides.map((guide) => [guide.id, guide]));
  assertGuideClaimShape(guidesById);
  return PINNED_CLAIM_SPECS.map((spec, catalogIndex) => {
    const guide = guidesById.get(spec.repositoryRecordId);
    const recommendation = guide?.recommendations[0];
    if (!guide || !recommendation) {
      throw new Error(`Missing pinned guide ${spec.repositoryRecordId}.`);
    }
    const extracted = extractClaim(recommendation, spec.extraction);
    if (
      stableJson(extracted.sourceConditions) !==
      stableJson(spec.sourceConditions)
    ) {
      throw new Error(
        `Exact source conditions drifted for pinned claim ${spec.claimId}.`,
      );
    }
    const sourceRef = guide.sourceRefs[0];
    if (!sourceRef) throw new Error(`Guide ${guide.id} has no source reference.`);
    return {
      claimId: spec.claimId,
      catalogIndex,
      repositoryRecordId: guide.id,
      sourceId: sourceRef.sourceId,
      sourceRecordId: sourceRef.sourceRecordId,
      characterId: guide.characterId,
      recommendation: {
        recommendationId: recommendation.id,
        label: recommendation.label ?? null,
        scope: recommendation.scope,
        roles: [...recommendation.roles],
        ordering: extracted.ordering,
        classification: extracted.classification,
        grouping: extracted.grouping,
        sourceIndex: spec.extraction.index,
      },
      payload: extracted.payload,
      sourceConditions: [...extracted.sourceConditions],
      sourceConditionsSha256: sha256Text(
        stableJson(spec.sourceConditions),
      ),
      predicate: structuredClone(spec.predicate),
    };
  });
}

function assertGuideClaimShape(
  guidesById: ReadonlyMap<string, GuideRecord>,
): void {
  const stat = guidesById.get(GUIDE_RECORD_IDS[0])?.recommendations[0];
  const artifact = guidesById.get(GUIDE_RECORD_IDS[1])?.recommendations[0];
  const weapon = guidesById.get(GUIDE_RECORD_IDS[2])?.recommendations[0];
  const mainStatCount = stat?.mainStats
    ? Object.values(stat.mainStats).reduce(
        (total, entries) => total + entries.length,
        0,
      )
    : 0;
  if (
    !stat ||
    stat.scope !== "artifact-stats" ||
    mainStatCount !== 4 ||
    stat.substats?.length !== 3 ||
    stat.erTargets != null ||
    stat.weaponRecommendations != null ||
    stat.artifactRecommendations != null
  ) {
    throw new Error(
      "Pinned Itto artifact-stat record must contain exactly four grouped main-stat and three grouped substat claims, with no ER claim.",
    );
  }
  if (
    !artifact ||
    artifact.scope !== "artifact-sets" ||
    artifact.artifactRecommendations?.length !== 4 ||
    artifact.weaponRecommendations != null ||
    artifact.mainStats != null ||
    artifact.substats != null ||
    artifact.erTargets != null
  ) {
    throw new Error(
      "Pinned Itto artifact-set record must contain exactly four atomic groups.",
    );
  }
  if (
    !weapon ||
    weapon.scope !== "weapons" ||
    weapon.weaponRecommendations?.length !== 4 ||
    weapon.artifactRecommendations != null ||
    weapon.mainStats != null ||
    weapon.substats != null ||
    weapon.erTargets != null
  ) {
    throw new Error(
      "Pinned Itto weapon record must contain exactly four atomic groups and no ER claim.",
    );
  }
}

function extractClaim(
  recommendation: GuideRecommendation,
  extraction: ClaimExtraction,
): {
  payload: SourceConditionedAtomicClaim["payload"];
  sourceConditions: string[];
  ordering: "unranked" | "ranked-groups" | null;
  classification: SourceConditionedAtomicClaim["recommendation"]["classification"];
  grouping: SourceConditionedAtomicClaim["recommendation"]["grouping"];
} {
  if (extraction.type === "main-stat") {
    const entry = recommendation.mainStats?.[extraction.slot][extraction.index];
    if (!entry) throw new Error("Pinned main-stat claim is missing.");
    return {
      payload: {
        type: "main-stat",
        slot: extraction.slot,
        statIds: [...entry.statIds],
        priority: entry.priority ?? null,
        target: entry.target ?? null,
      },
      sourceConditions: [...entry.conditions],
      ordering: null,
      classification: null,
      grouping: null,
    };
  }
  if (extraction.type === "substat") {
    const entry = recommendation.substats?.[extraction.index];
    if (!entry) throw new Error("Pinned substat claim is missing.");
    return {
      payload: {
        type: "substat",
        statIds: [...entry.statIds],
        priority: entry.priority ?? null,
        target: entry.target ?? null,
      },
      sourceConditions: [...entry.conditions],
      ordering: null,
      classification: null,
      grouping: null,
    };
  }
  if (extraction.type === "artifact-group") {
    const group = recommendation.artifactRecommendations?.[extraction.index];
    if (!group) throw new Error("Pinned artifact group is missing.");
    return {
      payload: {
        type: "artifact-group",
        artifacts: structuredClone(group.artifacts),
      },
      sourceConditions: [...group.conditions],
      ordering: recommendation.artifactOrdering ?? null,
      classification: group.classification,
      grouping: group.grouping,
    };
  }
  const group = recommendation.weaponRecommendations?.[extraction.index];
  if (!group) throw new Error("Pinned weapon group is missing.");
  return {
    payload: {
      type: "weapon-group",
      weaponIds: [...group.weaponIds],
    },
    sourceConditions: [...group.conditions],
    ordering: recommendation.weaponOrdering ?? null,
    classification: group.classification,
    grouping: group.grouping,
  };
}

function buildConditionMap(): SourceConditionMap {
  return Object.fromEntries(
    PINNED_CLAIM_SPECS.map((spec) => [
      spec.claimId,
      {
        sourceConditionsSha256: sha256Text(stableJson(spec.sourceConditions)),
        predicate: structuredClone(spec.predicate),
      },
    ]),
  );
}

function memberTuple(
  team: TeamRecord,
): readonly [string, string, string, string] {
  const ids = team.members.map(({ characterId }) => characterId);
  if (ids.length !== 4 || !ids[0] || !ids[1] || !ids[2] || !ids[3]) {
    throw new Error(`Exact team ${team.id} does not have four character IDs.`);
  }
  return [ids[0], ids[1], ids[2], ids[3]];
}

function assertRosterReport(
  report: Awaited<ReturnType<typeof buildTeamRosterCandidateDomainReport>>,
  teams: readonly TeamRecord[],
): void {
  const template = report.templates[0];
  if (
    report.templates.length !== 1 ||
    !template ||
    template.templateId !== TEMPLATE_RECORD_ID ||
    template.status !== "comparable" ||
    template.reactionGate?.status !== "completed" ||
    stableJson(template.reactionGate.declaredReactions) !==
      stableJson(["crystallize"]) ||
    !report.allHoldoutsMatch ||
    report.failures.length !== 0 ||
    report.holdouts.length !== 3
  ) {
    throw new Error(
      "The real roster-domain runtime gate did not produce the pinned comparable Itto boundary.",
    );
  }
  teams.forEach((team, index) => {
    const holdout = report.holdouts.find(({ targetId }) => targetId === team.id);
    const accepted = index < 2;
    if (
      !holdout ||
      holdout.actualOutcome !==
        (accepted ? "accepted" : "structural-rejected") ||
      holdout.structuralAssignmentMultiplicity !== (accepted ? 2 : 0) ||
      holdout.structuralMembership !== accepted ||
      holdout.acceptedMembership !== accepted ||
      holdout.bindingMultiplicityMatchesExpectation !== true ||
      (accepted
        ? stableJson(holdout.reactionById) !==
          stableJson({ crystallize: true })
        : holdout.reactionById !== null)
    ) {
      throw new Error(
        `Roster-domain holdout ${team.id} drifted from its pinned structural/runtime outcome.`,
      );
    }
  });
}

function requiredHoldout(
  holdoutsById: ReadonlyMap<string, TeamRosterHoldoutOutcome>,
  teamId: string,
): TeamRosterHoldoutOutcome {
  const holdout = holdoutsById.get(teamId);
  if (!holdout) throw new Error(`Missing roster-domain holdout ${teamId}.`);
  return holdout;
}

function buildTeamPacket(input: {
  team: TeamRecord;
  rawTeam: ManualTeamRecord;
  packetIndex: number;
  holdout: TeamRosterHoldoutOutcome;
  template: CandidateTemplateRecord;
  repositoryTeams: readonly TeamRecord[];
}): SourceTeamPacketInput {
  const { team, rawTeam, packetIndex, holdout, template } = input;
  const rawMembersById = new Map(
    rawTeam.members.map((member) => [member.characterId, member]),
  );
  const presetOverlap = buildPresetOverlap(team, input.repositoryTeams);
  const shouldHavePreset = packetIndex === 2;
  if (
    presetOverlap.rosterStatus !== (shouldHavePreset ? "present" : "uncovered")
  ) {
    throw new Error(`Unexpected GenshinTools preset overlap for ${team.id}.`);
  }
  if (
    presetOverlap.rosterStatus === "present" &&
    (presetOverlap.presetTeamId !== PRESET_TEAM_ID ||
      presetOverlap.investmentStatus !== "unresolved")
  ) {
    throw new Error(
      `Pinned preset investment overlap drifted for ${team.id}.`,
    );
  }
  return {
    packetIndex,
    teamRecordId: team.id,
    sourceId: SOURCE_ID,
    sourceRecordId: RAW_TEAM_RECORD_IDS[packetIndex]!,
    label: team.label ?? null,
    intent: team.intent,
    exhaustiveness: team.exhaustiveness,
    rankingClaim: team.rankingClaim,
    members: team.members.map((member) => {
      const rawMember = rawMembersById.get(member.characterId);
      if (!rawMember) {
        throw new Error(
          `Manual team ${rawTeam.sourceRecordId} is missing ${member.characterId}.`,
        );
      }
      return {
        characterId: member.characterId,
        rawSourceInvestment: {
          ...(rawMember.constellation == null
            ? {}
            : { constellation: rawMember.constellation }),
          ...(rawMember.minConstellation == null
            ? {}
            : { minConstellation: rawMember.minConstellation }),
          ...(rawMember.maxConstellation == null
            ? {}
            : { maxConstellation: rawMember.maxConstellation }),
        },
        investment: cloneTeamMemberInvestment(member.investment),
      };
    }),
    unknowns: [...rawTeam.unknowns],
    templateStructuralResult: {
      templateId: template.id,
      representation:
        "structural-runtime-representation-not-gameplay-proof",
      declaredReactions: [...(template.reactions ?? [])],
      reactionGate: "TeamMeta.hasReaction",
      actualOutcome: holdout.actualOutcome,
      structuralMembership: holdout.structuralMembership,
      acceptedMembership: holdout.acceptedMembership,
      structuralAssignmentMultiplicity:
        holdout.structuralAssignmentMultiplicity,
      reactionById: holdout.reactionById
        ? { ...holdout.reactionById }
        : null,
      runtimeGateExecutedForStructuralCandidates:
        holdout.structuralMembership === true && holdout.reactionById != null,
      supportsGameplayProof: false,
    },
    presetOverlap,
  };
}

function buildPresetOverlap(
  sourceTeam: TeamRecord,
  repositoryTeams: readonly TeamRecord[],
): SourceTeamPacketInput["presetOverlap"] {
  const sourceRosterKey = rosterKey(
    sourceTeam.members.map(({ characterId }) => characterId),
  );
  const matches = repositoryTeams.filter(
    (candidate) =>
      candidate.id.startsWith("genshintools-presets:team:") &&
      rosterKey(candidate.members.map(({ characterId }) => characterId)) ===
        sourceRosterKey,
  );
  if (matches.length === 0) {
    return {
      rosterStatus: "uncovered",
      presetTeamId: null,
      rosterComparison: "exact-unordered-character-ids",
      investmentStatus: "not-evaluated-roster-uncovered",
      memberInvestmentComparisons: [],
    };
  }
  if (matches.length !== 1 || !matches[0]) {
    throw new Error(
      `Exact source roster ${sourceTeam.id} matches ${matches.length} preset teams.`,
    );
  }
  const preset = matches[0];
  const presetMembersById = new Map(
    preset.members.map((member) => [member.characterId, member]),
  );
  const memberInvestmentComparisons = sourceTeam.members.map((sourceMember) => {
    const baselineMember = presetMembersById.get(sourceMember.characterId);
    if (!baselineMember) {
      throw new Error(
        `Exact roster match ${preset.id} lost ${sourceMember.characterId}.`,
      );
    }
    return {
      characterId: sourceMember.characterId,
      comparison: compareSourceToBaselineConstellationScope(
        sourceMember.investment,
        baselineMember.investment,
      ),
    };
  });
  const outcomes = memberInvestmentComparisons.map(
    ({ comparison }) => comparison.outcome,
  );
  const investmentStatus = outcomes.some(
    (outcome) => outcome === "guaranteed-conflict",
  )
    ? "conflict"
    : outcomes.some(
          (outcome) =>
            outcome === "unresolved-baseline-unspecified" ||
            outcome === "unresolved-partial-overlap",
        )
      ? "unresolved"
      : "guaranteed";
  return {
    rosterStatus: "present",
    presetTeamId: preset.id,
    rosterComparison: "exact-unordered-character-ids",
    investmentStatus,
    memberInvestmentComparisons,
  };
}

function rosterKey(characterIds: readonly string[]): string {
  return [...characterIds].sort((left, right) => left.localeCompare(right)).join("\0");
}

function failedCanonicalInput(
  input: BuildIttoSourceConditionedGuidePacketInput,
  error: unknown,
): SourceConditionedGuidePacketInput {
  const sourcePaths = new Set([
    REPOSITORY_PATH,
    MANUAL_SNAPSHOT_PATH,
    MANUAL_INDEX_PATH,
    SOURCE_REGISTRY_PATH,
  ]);
  return {
    experimentId: EXPERIMENT_ID,
    generatedFrom: input.generatedFrom,
    sourceBoundary: {
      sourceId: SOURCE_ID,
      pageUrl: PAGE_URL,
      sourceVersion: SOURCE_VERSION,
      rawManualSourceRecordIds: [...RAW_RECORD_IDS],
      consolidatedGuideRecordIds: [...GUIDE_RECORD_IDS],
      templateRecordId: TEMPLATE_RECORD_ID,
      exactTeamRecordIds: [...TEAM_RECORD_IDS],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "unauthenticated",
      sourceRegistryPermission: "unauthenticated",
      repositoryRecordStatus: "unauthenticated",
      promotionEligible: false,
      sourceHashes: input.generatedFrom
        .filter(({ path }) => sourcePaths.has(path))
        .map((entry) => ({ ...entry })),
    },
    policyBoundary: {
      crossRecordJoinOwner: "guide-factory-wrapper",
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionPolicy:
        "pinned-exact-condition-array-hash-to-typed-predicate-map",
      arbitraryEnglishParsingAllowed: false,
      conditionMap: buildConditionMap(),
      allowedStructuredFacts: [
        "exact-source-team-roster",
        "exact-catalog-identity",
        "source-and-baseline-constellation-scope",
      ],
      disallowedStructuredFacts: [
        "gameplay-sequence",
        "account-inventory",
        "player-preference",
      ],
      investmentComparisonScope: "constellation-only",
      talentLevelsEvaluated: false,
    },
    sourceClaimCatalog: [],
    teamPackets: [],
    expectedCounts: {
      packetCount: 3,
      sourceClaimCount: 15,
      claimCellCount: 45,
    },
    prevalidationIssues: [
      {
        code: "itto.canonical_input_preparation_failed",
        path: "inputs",
        message: `Itto canonical input preparation failed: ${errorMessage(error)}`,
      },
    ],
    cautions: [
      "Itto packet projection was withheld because canonical source preparation failed.",
    ],
    prohibitedInterpretations: [
      "Do not use a non-comparable packet report for any guide, ranking, damage, formula, rotation, or ER claim.",
    ],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
