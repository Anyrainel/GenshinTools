import { z } from "zod";
import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  type ScopedSemanticDependencyAcceptedAudit,
  type ScopedSemanticDependencyAuthenticationInput,
  type ScopedSemanticDependencyCandidateDerivationResult,
  type ScopedSemanticDependencyManifest,
  type ScopedSemanticDependencySelection,
  type ScopedSemanticJsonValue,
} from "./scopedSemanticDependency";
import {
  InvestmentSchema,
  KnowledgeRecordSchema,
  ManualObservationRecordSchema,
  SourceManifestSchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";
import type { TeamMemberInvestment } from "./teamMemberInvestment";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";

const RAW_RECORD_DEPENDENCY_ID = "itto-raw-source-records";
const REPOSITORY_RECORD_DEPENDENCY_ID =
  "itto-consolidated-source-records";
const PRESET_COVERAGE_DEPENDENCY_ID = "itto-preset-roster-coverage";
const MANUAL_INDEX_DEPENDENCY_ID = "itto-manual-index-entry";
const SOURCE_REGISTRY_DEPENDENCY_ID = "itto-kqm-registry-entry";
const RECORD_PARITY_ADAPTER_ID =
  "itto-normalized-manual-repository-record-parity-v1";

export const ITTO_RAW_GUIDE_RECORD_IDS = Object.freeze([
  "itto-on-field-artifact-stats-version-5-6",
  "itto-contextual-artifact-sets-version-5-6",
  "itto-contextual-weapons-version-5-6",
] as const);
export const ITTO_RAW_TEMPLATE_RECORD_ID =
  "itto-xilonen-double-geo-template-version-5-6" as const;
export const ITTO_RAW_TEAM_RECORD_IDS = Object.freeze([
  "itto-xilonen-furina-yelan-example-version-5-6",
  "itto-xilonen-furina-xingqiu-example-version-5-6",
  "itto-c2-xilonen-gorou-furina-example-version-5-6",
] as const);
export const ITTO_RAW_RECORD_IDS = Object.freeze([
  ...ITTO_RAW_GUIDE_RECORD_IDS,
  ITTO_RAW_TEMPLATE_RECORD_ID,
  ...ITTO_RAW_TEAM_RECORD_IDS,
] as const);

export const ITTO_GUIDE_RECORD_IDS = Object.freeze(
  ITTO_RAW_GUIDE_RECORD_IDS.map(
    (sourceRecordId) => `kqm:character-guide:${sourceRecordId}`,
  ),
);
export const ITTO_TEMPLATE_RECORD_ID =
  `kqm:team-template:${ITTO_RAW_TEMPLATE_RECORD_ID}` as const;
export const ITTO_TEAM_RECORD_IDS = Object.freeze(
  ITTO_RAW_TEAM_RECORD_IDS.map(
    (sourceRecordId) => `kqm:team:${sourceRecordId}`,
  ),
);
export const ITTO_REPOSITORY_RECORD_IDS = Object.freeze([
  ...ITTO_GUIDE_RECORD_IDS,
  ITTO_TEMPLATE_RECORD_ID,
  ...ITTO_TEAM_RECORD_IDS,
]);

export const ITTO_PRESET_TEAM_ID =
  "genshintools-presets:team:8ru0gxT0jJgK50AfWD" as const;

export const ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION =
  Object.freeze({
    scopeId: "itto-source-conditioned-guide-packet-v1",
    manifestSha256:
      "d87f9fe73cdfd98b4a509ba2a93534585c6693e291dec813548e9c69685b20f6",
    scopeProjectionSha256:
      "722b7c6f754f2e30bf2cccb2b84406019bf6b1369755ebb6a8dd4b649bd7f209",
  });

export interface IttoSourceConditionedGuidePacketScopeInput {
  repository: KnowledgeRepository;
  manualSnapshot: ManualObservationSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

export interface IttoPresetRosterCoverageRow {
  teamRecordId: string;
  rosterKey: string;
  matchingPresetTeams: Array<{
    id: string;
    members: Array<{
      characterId: string;
      investment: TeamMemberInvestment;
    }>;
  }>;
}

export interface AuthenticatedIttoSourceConditionedGuidePacketScope {
  audit: ScopedSemanticDependencyAcceptedAudit;
  rawRecords: readonly ManualObservationSnapshot["records"][number][];
  repositoryRecords: readonly KnowledgeRecord[];
  presetRosterCoverage: readonly IttoPresetRosterCoverageRow[];
  manualIndexEntry: ManualSnapshotIndex["snapshots"][number];
  sourceRegistryEntry: SourceRegistry["sources"][number];
}

const ManualIndexEntrySchema = z
  .object({
    sourceId: z.string().min(1),
    path: z.string().min(1),
  })
  .strict();

const PresetRosterCoverageRowSchema = z
  .object({
    teamRecordId: z.string().min(1),
    rosterKey: z.string(),
    matchingPresetTeams: z.array(
      z
        .object({
          id: z.string().min(1),
          members: z.array(
            z
              .object({
                characterId: z.string().min(1),
                investment: InvestmentSchema,
              })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();

export function deriveIttoSourceConditionedGuidePacketScopeCandidate(
  input: IttoSourceConditionedGuidePacketScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput = buildAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function requireIttoSourceConditionedGuidePacketScope(
  input: IttoSourceConditionedGuidePacketScopeInput,
): AuthenticatedIttoSourceConditionedGuidePacketScope {
  const result = authenticateScopedSemanticDependencies(
    buildAuthenticationInput(input),
  );
  if (result.status !== "accepted") {
    throw new Error(
      `Itto packet semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const rawRecords = selectedPayloads(
    result.selection,
    RAW_RECORD_DEPENDENCY_ID,
  ).map((payload) => ManualObservationRecordSchema.parse(payload));
  const repositoryRecords = selectedPayloads(
    result.selection,
    REPOSITORY_RECORD_DEPENDENCY_ID,
  ).map((payload) => KnowledgeRecordSchema.parse(payload));
  const presetRosterCoverage = selectedPayloads(
    result.selection,
    PRESET_COVERAGE_DEPENDENCY_ID,
  ).map((payload) => PresetRosterCoverageRowSchema.parse(payload));
  const [manualIndexEntry] = selectedPayloads(
    result.selection,
    MANUAL_INDEX_DEPENDENCY_ID,
  ).map((payload) => ManualIndexEntrySchema.parse(payload));
  const [sourceRegistryEntry] = selectedPayloads(
    result.selection,
    SOURCE_REGISTRY_DEPENDENCY_ID,
  ).map((payload) => SourceManifestSchema.parse(payload));
  if (!manualIndexEntry || !sourceRegistryEntry) {
    throw new Error("Authenticated Itto scope omitted a singleton authority row.");
  }

  return {
    audit: result.audit,
    rawRecords,
    repositoryRecords,
    presetRosterCoverage,
    manualIndexEntry,
    sourceRegistryEntry,
  };
}

/** Exposed for focused adversarial tests of the independently pinned scope. */
export function buildIttoSourceConditionedGuidePacketScopeAuthenticationInput(
  input: IttoSourceConditionedGuidePacketScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return buildAuthenticationInput(input);
}

function buildAuthenticationInput(
  input: IttoSourceConditionedGuidePacketScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  const presetCoverage = buildPresetRosterCoverage(input.repository.records);
  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_RECORD_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        records: input.manualSnapshot.records,
        adapter: {
          projectionAdapterId: "itto-raw-source-record-v1",
          keyOf: manualSourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_RECORD_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "itto-consolidated-source-record-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_COVERAGE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records?kind=team&source=genshintools-presets&roster=itto-target",
        keySchemaId: "itto-source-team-record-id-v1",
        records: presetCoverage,
        adapter: {
          projectionAdapterId: "itto-preset-roster-coverage-v1",
          keyOf: ({ teamRecordId }) => teamRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        records: input.manualIndex.snapshots,
        adapter: {
          projectionAdapterId: "itto-manual-index-entry-v1",
          keyOf: ({ path }) => path,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        records: input.sourceRegistry.sources,
        adapter: {
          projectionAdapterId: "itto-source-manifest-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: RECORD_PARITY_ADAPTER_ID,
        normalize: ({ dependencyId, key, payload }) =>
          normalizedRecordParity(dependencyId, key, payload),
      },
    ],
    expectation: {
      ...ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION,
    },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: RAW_RECORD_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        projectionAdapterId: "itto-raw-source-record-v1",
        requiredKeys: [...ITTO_RAW_RECORD_IDS],
      },
      {
        dependencyId: REPOSITORY_RECORD_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "itto-consolidated-source-record-v1",
        requiredKeys: [...ITTO_REPOSITORY_RECORD_IDS],
      },
      {
        dependencyId: PRESET_COVERAGE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records?kind=team&source=genshintools-presets&roster=itto-target",
        keySchemaId: "itto-source-team-record-id-v1",
        projectionAdapterId: "itto-preset-roster-coverage-v1",
        requiredKeys: [...ITTO_TEAM_RECORD_IDS],
      },
      {
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        projectionAdapterId: "itto-manual-index-entry-v1",
        requiredKeys: [SNAPSHOT_PATH],
      },
      {
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        projectionAdapterId: "itto-source-manifest-v1",
        requiredKeys: ["kqm"],
      },
    ],
    parities: ITTO_RAW_RECORD_IDS.map((sourceRecordId, index) => ({
      parityId: `itto-manual-repository:${sourceRecordId}`,
      parityAdapterId: RECORD_PARITY_ADAPTER_ID,
      left: {
        dependencyId: RAW_RECORD_DEPENDENCY_ID,
        key: sourceRecordId,
      },
      right: {
        dependencyId: REPOSITORY_RECORD_DEPENDENCY_ID,
        key: ITTO_REPOSITORY_RECORD_IDS[index]!,
      },
    })),
  };
}

function buildPresetRosterCoverage(
  records: readonly KnowledgeRecord[],
): IttoPresetRosterCoverageRow[] {
  const teamsById = new Map(records.map((record) => [record.id, record]));
  const presetTeams = records.filter(
    (record): record is Extract<KnowledgeRecord, { kind: "team" }> =>
      record.kind === "team" &&
      record.id.startsWith("genshintools-presets:team:"),
  );
  return ITTO_TEAM_RECORD_IDS.map((teamRecordId) => {
    const sourceTeam = teamsById.get(teamRecordId);
    if (!sourceTeam || sourceTeam.kind !== "team") {
      return { teamRecordId, rosterKey: "", matchingPresetTeams: [] };
    }
    const targetRosterKey = rosterKey(
      sourceTeam.members.map(({ characterId }) => characterId),
    );
    return {
      teamRecordId,
      rosterKey: targetRosterKey,
      matchingPresetTeams: presetTeams
        .filter(
          (candidate) =>
            rosterKey(candidate.members.map(({ characterId }) => characterId)) ===
            targetRosterKey,
        )
        .map((candidate) => ({
          id: candidate.id,
          members: candidate.members.map(({ characterId, investment }) => ({
            characterId,
            investment,
          })),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    };
  });
}

function normalizedRecordParity(
  dependencyId: string,
  key: string,
  payload: ScopedSemanticJsonValue,
): unknown {
  const record = requiredObject(payload, `${dependencyId}:${key}`);
  const kind = requiredString(record.kind, `${dependencyId}:${key}.kind`);
  const raw = dependencyId === RAW_RECORD_DEPENDENCY_ID;
  if (!raw && dependencyId !== REPOSITORY_RECORD_DEPENDENCY_ID) {
    throw new Error(`Unexpected Itto parity dependency ${dependencyId}.`);
  }

  if (kind === "character_guide") {
    const recommendations = raw
      ? [record.recommendation]
      : requiredArray(record.recommendations, `${dependencyId}:${key}.recommendations`);
    if (recommendations.length !== 1) {
      throw new Error(`Itto guide ${key} must have exactly one recommendation.`);
    }
    return {
      characterId: record.characterId,
      recommendation: recommendations[0],
    };
  }

  if (kind === "team_template") {
    return {
      label: record.label,
      intent: record.intent,
      exhaustiveness: record.exhaustiveness,
      rankingClaim: record.rankingClaim,
      slots: record.slots,
      reactions: record.reactions,
    };
  }

  if (kind === "team") {
    const members = requiredArray(
      record.members,
      `${dependencyId}:${key}.members`,
    ).map((value, memberIndex) => {
      const member = requiredObject(
        value,
        `${dependencyId}:${key}.members[${memberIndex}]`,
      );
      return {
        characterId: member.characterId,
        investment: raw
          ? normalizeRawInvestment(member)
          : member.investment,
      };
    });
    return {
      label: record.label ?? null,
      intent: record.intent,
      exhaustiveness: record.exhaustiveness,
      rankingClaim: record.rankingClaim,
      rotations: record.rotations,
      members,
    };
  }

  throw new Error(`Unsupported Itto parity record kind ${kind}.`);
}

function normalizeRawInvestment(
  member: Readonly<Record<string, ScopedSemanticJsonValue>>,
): unknown {
  const constellation = member.constellation;
  const minConstellation = member.minConstellation;
  const maxConstellation = member.maxConstellation;
  if (
    constellation == null &&
    minConstellation == null &&
    maxConstellation == null
  ) {
    return { status: "unspecified" };
  }
  return {
    ...(constellation == null ? {} : { constellation }),
    ...(maxConstellation == null ? {} : { maxConstellation }),
    ...(minConstellation == null ? {} : { minConstellation }),
    status: "partial",
  };
}

function manualSourceRecordId(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Itto manual record is not an object.");
  }
  const sourceRecordId = (record as { sourceRecordId?: unknown })
    .sourceRecordId;
  if (typeof sourceRecordId !== "string" || sourceRecordId.length === 0) {
    throw new Error("Itto manual record has no exact sourceRecordId.");
  }
  return sourceRecordId;
}

function selectedPayloads(
  selection: ScopedSemanticDependencySelection,
  dependencyId: string,
): ScopedSemanticJsonValue[] {
  const matches = selection.dependencies.filter(
    (dependency) => dependency.dependencyId === dependencyId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Authenticated Itto scope expected one ${dependencyId} selection, found ${matches.length}.`,
    );
  }
  return matches[0].entries.map(({ payload }) => payload);
}

function requiredObject(
  value: ScopedSemanticJsonValue,
  path: string,
): Readonly<Record<string, ScopedSemanticJsonValue>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} is not an object.`);
  }
  return value as Readonly<Record<string, ScopedSemanticJsonValue>>;
}

function requiredArray(
  value: ScopedSemanticJsonValue | undefined,
  path: string,
): readonly ScopedSemanticJsonValue[] {
  if (!Array.isArray(value)) throw new Error(`${path} is not an array.`);
  return value;
}

function requiredString(value: ScopedSemanticJsonValue | undefined, path: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} is not a string.`);
  }
  return value;
}

function rosterKey(characterIds: readonly string[]): string {
  return [...characterIds]
    .sort((left, right) => left.localeCompare(right))
    .join("\0");
}
