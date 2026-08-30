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
  KnowledgeRecordSchema,
  ManualObservationRecordSchema,
  SourceManifestSchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";

const RAW_RECORD_DEPENDENCY_ID = "xiao-raw-source-records";
const REPOSITORY_RECORD_DEPENDENCY_ID =
  "xiao-consolidated-source-records";
const MANUAL_INDEX_DEPENDENCY_ID = "xiao-manual-index-entry";
const SOURCE_REGISTRY_DEPENDENCY_ID = "xiao-kqm-registry-entry";
const RECORD_PARITY_ADAPTER_ID =
  "xiao-normalized-manual-repository-record-parity-v1";

export const XIAO_RAW_RECORD_IDS = Object.freeze([
  "xiao-offensive-artifact-stats-version-5-5",
  "xiao-vha-artifact-branch-version-5-5",
  "xiao-mh-artifact-branch-version-5-5",
  "xiao-lno-artifact-branch-c0-c5-version-5-5",
  "xiao-five-star-weapon-tiers-version-5-5",
  "xiao-unranked-four-star-weapons-version-5-5",
  "xiao-xianyun-furina-faruzan-ffxx-version-5-5",
] as const);

export const XIAO_REPOSITORY_RECORD_IDS = Object.freeze(
  XIAO_RAW_RECORD_IDS.map((sourceRecordId, index) =>
    index === XIAO_RAW_RECORD_IDS.length - 1
      ? `kqm:team:${sourceRecordId}`
      : `kqm:character-guide:${sourceRecordId}`,
  ),
);

export const XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION =
  Object.freeze({
    scopeId: "xiao-source-local-condition-slice-v1",
    manifestSha256:
      "49b934ec97f2b3509e2e55d7cba1506f211c73cc859ca9a34f8ab522534bbd59",
    scopeProjectionSha256:
      "3590fa5c530ec992fc1fc9f89528271377ab7b879b2555bead544207738aa274",
  });

export interface XiaoSourceLocalConditionSliceScopeInput {
  repository: KnowledgeRepository;
  manualSnapshot: ManualObservationSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

export interface AuthenticatedXiaoSourceLocalConditionSliceScope {
  audit: ScopedSemanticDependencyAcceptedAudit;
  rawRecords: readonly ManualObservationSnapshot["records"][number][];
  repositoryRecords: readonly KnowledgeRecord[];
  manualIndexEntry: ManualSnapshotIndex["snapshots"][number];
  sourceRegistryEntry: SourceRegistry["sources"][number];
}

const ManualIndexEntrySchema = z
  .object({ sourceId: z.string().min(1), path: z.string().min(1) })
  .strict();

export function deriveXiaoSourceLocalConditionSliceScopeCandidate(
  input: XiaoSourceLocalConditionSliceScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput = buildAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function requireXiaoSourceLocalConditionSliceScope(
  input: XiaoSourceLocalConditionSliceScopeInput,
): AuthenticatedXiaoSourceLocalConditionSliceScope {
  const result = authenticateScopedSemanticDependencies(
    buildAuthenticationInput(input),
  );
  if (result.status !== "accepted") {
    throw new Error(
      `Xiao source-local semantic scope authentication failed: ${result.issues
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
  const [manualIndexEntry] = selectedPayloads(
    result.selection,
    MANUAL_INDEX_DEPENDENCY_ID,
  ).map((payload) => ManualIndexEntrySchema.parse(payload));
  const [sourceRegistryEntry] = selectedPayloads(
    result.selection,
    SOURCE_REGISTRY_DEPENDENCY_ID,
  ).map((payload) => SourceManifestSchema.parse(payload));
  if (!manualIndexEntry || !sourceRegistryEntry) {
    throw new Error("Authenticated Xiao scope omitted a singleton authority row.");
  }
  return {
    audit: result.audit,
    rawRecords,
    repositoryRecords,
    manualIndexEntry,
    sourceRegistryEntry,
  };
}

/** Exposed for focused adversarial tests of the independently pinned scope. */
export function buildXiaoSourceLocalConditionSliceScopeAuthenticationInput(
  input: XiaoSourceLocalConditionSliceScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return buildAuthenticationInput(input);
}

function buildAuthenticationInput(
  input: XiaoSourceLocalConditionSliceScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
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
          projectionAdapterId: "xiao-raw-source-record-v1",
          keyOf: ({ sourceRecordId }) => sourceRecordId,
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
          projectionAdapterId: "xiao-consolidated-source-record-v1",
          keyOf: ({ id }) => id,
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
          projectionAdapterId: "xiao-manual-index-entry-v1",
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
          projectionAdapterId: "xiao-source-manifest-v1",
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
      ...XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION,
    },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION.scopeId,
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
        projectionAdapterId: "xiao-raw-source-record-v1",
        requiredKeys: [...XIAO_RAW_RECORD_IDS],
      },
      {
        dependencyId: REPOSITORY_RECORD_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "xiao-consolidated-source-record-v1",
        requiredKeys: [...XIAO_REPOSITORY_RECORD_IDS],
      },
      {
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        projectionAdapterId: "xiao-manual-index-entry-v1",
        requiredKeys: [SNAPSHOT_PATH],
      },
      {
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        projectionAdapterId: "xiao-source-manifest-v1",
        requiredKeys: ["kqm"],
      },
    ],
    parities: XIAO_RAW_RECORD_IDS.map((sourceRecordId, index) => ({
      parityId: `xiao-manual-repository:${sourceRecordId}`,
      parityAdapterId: RECORD_PARITY_ADAPTER_ID,
      left: { dependencyId: RAW_RECORD_DEPENDENCY_ID, key: sourceRecordId },
      right: {
        dependencyId: REPOSITORY_RECORD_DEPENDENCY_ID,
        key: XIAO_REPOSITORY_RECORD_IDS[index]!,
      },
    })),
  };
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
    throw new Error(`Unexpected Xiao parity dependency ${dependencyId}.`);
  }
  if (kind === "character_guide") {
    const recommendations = raw
      ? [record.recommendation]
      : requiredArray(
          record.recommendations,
          `${dependencyId}:${key}.recommendations`,
        );
    return {
      kind,
      characterId: record.characterId,
      recommendations,
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
        investment: raw ? normalizeRawInvestment(member) : member.investment,
      };
    });
    return {
      kind,
      label: record.label ?? null,
      intent: record.intent,
      exhaustiveness: record.exhaustiveness,
      rankingClaim: record.rankingClaim,
      members,
    };
  }
  throw new Error(`Unsupported Xiao parity record kind ${kind}.`);
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
  if (constellation != null) {
    return { status: "exact", constellation };
  }
  return {
    status: "range",
    ...(minConstellation == null ? {} : { minConstellation }),
    ...(maxConstellation == null ? {} : { maxConstellation }),
  };
}

function selectedPayloads(
  selection: ScopedSemanticDependencySelection,
  dependencyId: string,
): ScopedSemanticJsonValue[] {
  const dependency = selection.dependencies.find(
    (candidate) => candidate.dependencyId === dependencyId,
  );
  if (!dependency) {
    throw new Error(`Authenticated Xiao scope omitted ${dependencyId}.`);
  }
  return dependency.entries.map(({ payload }) => payload);
}

function requiredObject(
  value: ScopedSemanticJsonValue,
  path: string,
): Readonly<Record<string, ScopedSemanticJsonValue>> {
  if (value == null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`Expected object at ${path}.`);
  }
  return value as Readonly<Record<string, ScopedSemanticJsonValue>>;
}

function requiredArray(
  value: ScopedSemanticJsonValue | undefined,
  path: string,
): readonly ScopedSemanticJsonValue[] {
  if (!Array.isArray(value)) throw new Error(`Expected array at ${path}.`);
  return value;
}

function requiredString(
  value: ScopedSemanticJsonValue | undefined,
  path: string,
): string {
  if (typeof value !== "string") throw new Error(`Expected string at ${path}.`);
  return value;
}
