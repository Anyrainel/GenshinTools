import { z } from "zod";
import { KEQING_ROLE_PAIR_TARGET_TEAM_IDS } from "./keqingSourceScopedRolePairSample";
import type { ManualSnapshotInput } from "./manualSnapshots";
import {
  type KnowledgeRecord,
  KnowledgeRecordSchema,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  ManualObservationRecordSchema,
  ManualObservationSnapshotSchema,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";
import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  type ScopedSemanticDependencyAcceptedAudit,
  type ScopedSemanticDependencyCandidateDerivationResult,
  type ScopedSemanticDependencyDerivationInput,
  type ScopedSemanticDependencyManifest,
  type ScopedSemanticJsonValue,
} from "./scopedSemanticDependency";

const SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";
const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const CHARACTER_STATS_PATH = "src/data/game/character_stats.json";
const SNAPSHOT_ENVELOPE_KEY = "kqm-keqing-manual";
const MANUAL_RECOMMENDATION_PARITY_ADAPTER_ID =
  "kqm-manual-repository-recommendation-parity-v1";

const RAW_DEPENDENCY_ID = "kqm-keqing-manual-guides";
const CONSOLIDATED_DEPENDENCY_ID = "kqm-keqing-repository-guides";
const BASELINE_DEPENDENCY_ID = "genshintools-keqing-baseline-guide";
const TEAM_DEPENDENCY_ID = "kqm-keqing-lunar-target-teams";
const SNAPSHOT_ENVELOPE_DEPENDENCY_ID = "kqm-keqing-snapshot-envelope";
const MANUAL_INDEX_DEPENDENCY_ID = "manual-snapshot-index-entry";
const SOURCE_REGISTRY_DEPENDENCY_ID = "kqm-source-registry-entry";
const CHARACTER_FACT_DEPENDENCY_ID = "keqing-lunar-character-facts";

export const KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS = Object.freeze([
  "keqing-lunar-charged-default-artifact-stats-luna-i",
  "keqing-lunar-charged-high-buff-goblet-stats-luna-i",
  "keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
  "keqing-lunar-charged-notsu-contexts-luna-i",
  "keqing-lunar-charged-traditional-artifact-options-luna-i",
  "keqing-lunar-charged-top-contributor-artifact-options-luna-i",
  "keqing-lunar-charged-general-mistsplitter-luna-i",
  "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i",
  "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i",
  "keqing-lunar-charged-shielded-summit-shaper-luna-i",
  "keqing-lunar-charged-other-five-star-crit-options-luna-i",
  "keqing-lunar-charged-r5-finale-healer-luna-i",
  "keqing-lunar-charged-freedom-sworn-luna-i",
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i",
  "keqing-lunar-charged-full-shield-eshu-lions-roar-tie-luna-i",
  "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i",
  "keqing-lunar-charged-low-rarity-fallbacks-luna-i",
] as const);

const CONSOLIDATED_GUIDE_IDS =
  KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS.map(
    (sourceRecordId) => `kqm:character-guide:${sourceRecordId}`,
  );

const BASELINE_GUIDE_ID = "genshintools-presets:character-guide:keqing";

export const KEQING_LUNAR_EQUIPMENT_SCOPE_TEAM_IDS =
  Object.freeze([...KEQING_ROLE_PAIR_TARGET_TEAM_IDS] as const);

export const KEQING_LUNAR_EQUIPMENT_SCOPE_CHARACTER_IDS = Object.freeze([
  "keqing",
  "ineffa",
  "aino",
  "sucrose",
  "furina",
  "jean",
  "xilonen",
  "yelan",
  "kaedehara_kazuha",
] as const);

export const KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION = Object.freeze({
  scopeId: "keqing-lunar-equipment-evidence-v1",
  manifestSha256:
    "a2a0dd00c300182512e654fb106cac4e12eac0c83daf6ccf4650116853241ae4",
  scopeProjectionSha256:
    "23f13c9ca714e7d25f01199a629e280b2baa833a77272f57511bc3b423bd935f",
} as const);

export interface KeqingLunarEquipmentScopeAuthority {
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

export interface KeqingLunarEquipmentScopeInput
  extends KeqingLunarEquipmentScopeAuthority {
  repository: KnowledgeRepository;
  manualInputs: readonly ManualSnapshotInput[];
  characterFacts: Readonly<
    Record<string, KeqingLunarEquipmentCharacterFact | undefined>
  >;
}

export interface KeqingLunarEquipmentCharacterFact {
  region: string | undefined;
  weaponType: string | undefined;
}

export interface AuthenticatedKeqingLunarEquipmentScope {
  audit: ScopedSemanticDependencyAcceptedAudit;
  repositoryRecords: readonly KnowledgeRecord[];
  snapshot: ManualObservationSnapshot;
  characterFacts: Readonly<
    Record<string, KeqingLunarEquipmentCharacterFact | undefined>
  >;
}

type SnapshotEnvelope = {
  key: typeof SNAPSHOT_ENVELOPE_KEY;
  schemaVersion: 1;
  expectedSourceId: string;
  snapshotFilePath: string;
  sourceId: string;
  capturedAt: string;
  page: ManualObservationSnapshot["page"];
};

type CharacterFactRow = {
  characterId: string;
  region: string | null;
  weaponType: string | null;
};

const CharacterFactRowSchema = z
  .object({
    characterId: z.string().min(1),
    region: z.string().min(1).nullable(),
    weaponType: z.string().min(1).nullable(),
  })
  .strict();

const ManualSnapshotContainerSchema = ManualObservationSnapshotSchema.extend({
  records: z.array(z.unknown()).min(1),
});

export function deriveKeqingLunarEquipmentScopeCandidate(
  input: KeqingLunarEquipmentScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  return deriveScopedSemanticDependencyCandidate(buildDerivationInput(input));
}

export function authenticateKeqingLunarEquipmentScope(
  input: KeqingLunarEquipmentScopeInput,
): AuthenticatedKeqingLunarEquipmentScope {
  const derivation = buildDerivationInput(input);
  const result = authenticateScopedSemanticDependencies({
    ...derivation,
    expectation: { ...KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION },
  });
  if (result.status !== "accepted") {
    throw new Error(
      `Keqing Lunar equipment semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const rawRecords = selectedPayloads(
    result.selection,
    RAW_DEPENDENCY_ID,
  ).map((payload) => ManualObservationRecordSchema.parse(payload));
  const repositoryRecords = [
    ...selectedPayloads(result.selection, CONSOLIDATED_DEPENDENCY_ID),
    ...selectedPayloads(result.selection, BASELINE_DEPENDENCY_ID),
    ...selectedPayloads(result.selection, TEAM_DEPENDENCY_ID),
  ].map((payload) => KnowledgeRecordSchema.parse(payload));
  const [envelope] = selectedPayloads(
    result.selection,
    SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
  ) as unknown as [SnapshotEnvelope];
  const characterFactRows = selectedPayloads(
    result.selection,
    CHARACTER_FACT_DEPENDENCY_ID,
  ).map((payload) => CharacterFactRowSchema.parse(payload));

  return {
    audit: result.audit,
    repositoryRecords,
    snapshot: {
      schemaVersion: envelope.schemaVersion,
      sourceId: envelope.sourceId,
      capturedAt: envelope.capturedAt,
      page: envelope.page,
      records: rawRecords,
    },
    characterFacts: Object.fromEntries(
      characterFactRows.map(({ characterId, region, weaponType }) => [
        characterId,
        {
          region: region ?? undefined,
          weaponType: weaponType ?? undefined,
        },
      ]),
    ),
  };
}

function buildDerivationInput(
  input: KeqingLunarEquipmentScopeInput,
): ScopedSemanticDependencyDerivationInput {
  const snapshotInput = requiredExactSnapshotInput(input.manualInputs);
  const snapshot = ManualSnapshotContainerSchema.parse(snapshotInput.snapshot);
  const envelope: SnapshotEnvelope = {
    key: SNAPSHOT_ENVELOPE_KEY,
    schemaVersion: snapshot.schemaVersion,
    expectedSourceId: snapshotInput.expectedSourceId,
    snapshotFilePath: snapshotInput.snapshotFile.path,
    sourceId: snapshot.sourceId,
    capturedAt: snapshot.capturedAt,
    page: snapshot.page,
  };
  const characterFactRows: CharacterFactRow[] = Object.entries(
    input.characterFacts,
  ).map(([characterId, fact]) => ({
    characterId,
    region: fact?.region ?? null,
    weaponType: fact?.weaponType ?? null,
  }));

  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        records: snapshot.records,
        adapter: {
          projectionAdapterId: "manual-character-guide-record-v1",
          keyOf: manualSourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: CONSOLIDATED_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "repository-character-guide-record-v1",
          keyOf: (record) => record.id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: BASELINE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "repository-baseline-guide-record-v1",
          keyOf: (record) => record.id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: TEAM_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "repository-team-record-v1",
          keyOf: (record) => record.id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "manual-snapshot-envelope-key-v1",
        records: [envelope],
        adapter: {
          projectionAdapterId: "manual-snapshot-envelope-v1",
          keyOf: (record) => record.key,
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
          projectionAdapterId: "manual-snapshot-index-entry-v1",
          keyOf: (record) => record.path,
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
          projectionAdapterId: "source-manifest-v1",
          keyOf: (record) => record.id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: CHARACTER_FACT_DEPENDENCY_ID,
        containerPath: CHARACTER_STATS_PATH,
        collectionPath: "/",
        keySchemaId: "character-id-v1",
        records: characterFactRows,
        adapter: {
          projectionAdapterId: "character-region-and-weapon-type-v1",
          keyOf: (record) => record.characterId,
          project: (record) => record,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: MANUAL_RECOMMENDATION_PARITY_ADAPTER_ID,
        normalize: ({ dependencyId, payload }) =>
          recommendationParityValue(dependencyId, payload),
      },
    ],
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: KEQING_LUNAR_EQUIPMENT_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: RAW_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        projectionAdapterId: "manual-character-guide-record-v1",
        requiredKeys: [...KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS],
      },
      {
        dependencyId: CONSOLIDATED_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "repository-character-guide-record-v1",
        requiredKeys: [...CONSOLIDATED_GUIDE_IDS],
      },
      {
        dependencyId: BASELINE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "repository-baseline-guide-record-v1",
        requiredKeys: [BASELINE_GUIDE_ID],
      },
      {
        dependencyId: TEAM_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "repository-team-record-v1",
        requiredKeys: [...KEQING_LUNAR_EQUIPMENT_SCOPE_TEAM_IDS],
      },
      {
        dependencyId: SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "manual-snapshot-envelope-key-v1",
        projectionAdapterId: "manual-snapshot-envelope-v1",
        requiredKeys: [SNAPSHOT_ENVELOPE_KEY],
      },
      {
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        projectionAdapterId: "manual-snapshot-index-entry-v1",
        requiredKeys: [SNAPSHOT_PATH],
      },
      {
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        projectionAdapterId: "source-manifest-v1",
        requiredKeys: ["kqm"],
      },
      {
        dependencyId: CHARACTER_FACT_DEPENDENCY_ID,
        containerPath: CHARACTER_STATS_PATH,
        collectionPath: "/",
        keySchemaId: "character-id-v1",
        projectionAdapterId: "character-region-and-weapon-type-v1",
        requiredKeys: [...KEQING_LUNAR_EQUIPMENT_SCOPE_CHARACTER_IDS],
      },
    ],
    parities: KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS.map(
      (sourceRecordId) => ({
        parityId: `manual-repository-recommendation:${sourceRecordId}`,
        parityAdapterId: MANUAL_RECOMMENDATION_PARITY_ADAPTER_ID,
        left: {
          dependencyId: RAW_DEPENDENCY_ID,
          key: sourceRecordId,
        },
        right: {
          dependencyId: CONSOLIDATED_DEPENDENCY_ID,
          key: `kqm:character-guide:${sourceRecordId}`,
        },
      }),
    ),
  };
}

function requiredExactSnapshotInput(
  inputs: readonly ManualSnapshotInput[],
): ManualSnapshotInput {
  const matches = inputs.filter(
    ({ snapshotFile }) => snapshotFile.path === SNAPSHOT_PATH,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Keqing Lunar equipment semantic scope expected exactly one ${SNAPSHOT_PATH} input, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function manualSourceRecordId(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Manual snapshot record is not an object.");
  }
  const sourceRecordId = (record as { sourceRecordId?: unknown })
    .sourceRecordId;
  if (typeof sourceRecordId !== "string" || sourceRecordId.length === 0) {
    throw new Error("Manual snapshot record has no exact sourceRecordId.");
  }
  return sourceRecordId;
}

function recommendationParityValue(
  dependencyId: string,
  payload: ScopedSemanticJsonValue,
): unknown {
  if (!isJsonObject(payload)) {
    throw new Error("Selected guide payload is not an object.");
  }
  if (dependencyId === RAW_DEPENDENCY_ID) {
    if (!("recommendation" in payload)) {
      throw new Error("Manual guide payload has no recommendation.");
    }
    return payload.recommendation;
  }
  if (dependencyId === CONSOLIDATED_DEPENDENCY_ID) {
    const recommendations = payload.recommendations;
    if (!Array.isArray(recommendations) || recommendations.length !== 1) {
      throw new Error(
        "Consolidated guide payload must contain exactly one recommendation.",
      );
    }
    return recommendations[0];
  }
  throw new Error(`Unexpected recommendation parity dependency ${dependencyId}.`);
}

function selectedPayloads(
  selection: {
    readonly dependencies: readonly {
      readonly dependencyId: string;
      readonly entries: readonly {
        readonly key: string;
        readonly payload: ScopedSemanticJsonValue;
      }[];
    }[];
  },
  dependencyId: string,
): ScopedSemanticJsonValue[] {
  const matches = selection.dependencies.filter(
    (dependency) => dependency.dependencyId === dependencyId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Authenticated Keqing scope expected one ${dependencyId} selection, found ${matches.length}.`,
    );
  }
  return matches[0].entries.map(({ payload }) => payload);
}

function isJsonObject(
  value: ScopedSemanticJsonValue,
): value is { readonly [key: string]: ScopedSemanticJsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
