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
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const FIXTURE_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";
const PRESET_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";

const RAW_FIXTURE_DEPENDENCY_ID = "xiao-formula-raw-fixture";
const REPOSITORY_FIXTURE_DEPENDENCY_ID =
  "xiao-formula-consolidated-fixture";
const RAW_PRESET_TEAM_DEPENDENCY_ID = "xiao-formula-raw-preset-team";
const REPOSITORY_TEAM_DEPENDENCY_ID =
  "xiao-formula-consolidated-preset-team";
const MANUAL_INDEX_DEPENDENCY_ID = "xiao-formula-manual-index-entry";
const SOURCE_REGISTRY_DEPENDENCY_ID =
  "xiao-formula-source-registry-entries";
const FIXTURE_PARITY_ADAPTER_ID =
  "xiao-formula-manual-repository-fixture-parity-v1";
const TEAM_PARITY_ADAPTER_ID =
  "xiao-formula-preset-repository-team-parity-v1";

export const XIAO_FORMULA_COUNT_SOURCE_RECORD_ID =
  "xiao-no-buff-eeq12hp-rotation-fixture-version-5-5" as const;
export const XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID =
  `kqm:rotation-fixture:${XIAO_FORMULA_COUNT_SOURCE_RECORD_ID}` as const;
export const XIAO_FORMULA_COUNT_BASELINE_SOURCE_RECORD_ID =
  "CX03obKWOJgK51-fWO" as const;
export const XIAO_FORMULA_COUNT_BASELINE_TEAM_ID =
  `genshintools-presets:team:${XIAO_FORMULA_COUNT_BASELINE_SOURCE_RECORD_ID}` as const;

export const XIAO_FORMULA_COUNT_PARITY_SCOPE_EXPECTATION = Object.freeze({
  scopeId: "xiao-formula-count-parity-v1",
  manifestSha256:
    "4359740241a370e3ebc72d6e194ae6441a0bfb59a1f90fe7f414020055a4c1aa",
  scopeProjectionSha256:
    "17f457d095268b739b46c2acb4f5f98f885c247823c22ff5adb5714c08da3f34",
});

export interface XiaoFormulaCountParityScopeInput {
  repository: KnowledgeRepository;
  manualFixtureSnapshot: ManualObservationSnapshot;
  genshinToolsSnapshot: GenshinToolsPresetSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

export interface AuthenticatedXiaoFormulaCountParityScope {
  audit: ScopedSemanticDependencyAcceptedAudit;
  rawFixture: Extract<
    ManualObservationSnapshot["records"][number],
    { kind: "rotation_fixture" }
  >;
  repositoryFixture: Extract<
    KnowledgeRecord,
    { kind: "rotation_fixture" }
  >;
  baselineTeam: Extract<KnowledgeRecord, { kind: "team" }>;
  manualIndexEntry: ManualSnapshotIndex["snapshots"][number];
  sourceRegistryEntries: SourceRegistry["sources"];
}

const ManualIndexEntrySchema = z
  .object({ sourceId: z.string().min(1), path: z.string().min(1) })
  .strict();

export function deriveXiaoFormulaCountParityScopeCandidate(
  input: XiaoFormulaCountParityScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput = buildAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function requireXiaoFormulaCountParityScope(
  input: XiaoFormulaCountParityScopeInput,
): AuthenticatedXiaoFormulaCountParityScope {
  const result = authenticateScopedSemanticDependencies(
    buildAuthenticationInput(input),
  );
  if (result.status !== "accepted") {
    throw new Error(
      `Xiao formula-count semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const [rawFixturePayload] = selectedPayloads(
    result.selection,
    RAW_FIXTURE_DEPENDENCY_ID,
  );
  const rawFixture = ManualObservationRecordSchema.parse(rawFixturePayload);
  if (rawFixture.kind !== "rotation_fixture") {
    throw new Error("Authenticated Xiao raw fixture is not a rotation fixture.");
  }

  const [repositoryFixturePayload] = selectedPayloads(
    result.selection,
    REPOSITORY_FIXTURE_DEPENDENCY_ID,
  );
  const repositoryFixture = KnowledgeRecordSchema.parse(
    repositoryFixturePayload,
  );
  if (repositoryFixture.kind !== "rotation_fixture") {
    throw new Error(
      "Authenticated Xiao repository fixture is not a rotation fixture.",
    );
  }

  const [baselineTeamPayload] = selectedPayloads(
    result.selection,
    REPOSITORY_TEAM_DEPENDENCY_ID,
  );
  const baselineTeam = KnowledgeRecordSchema.parse(baselineTeamPayload);
  if (baselineTeam.kind !== "team") {
    throw new Error("Authenticated Xiao baseline record is not a team.");
  }

  const [manualIndexPayload] = selectedPayloads(
    result.selection,
    MANUAL_INDEX_DEPENDENCY_ID,
  );
  const manualIndexEntry = ManualIndexEntrySchema.parse(manualIndexPayload);
  const sourceRegistryEntries = selectedPayloads(
    result.selection,
    SOURCE_REGISTRY_DEPENDENCY_ID,
  ).map((payload) => SourceManifestSchema.parse(payload));

  return {
    audit: result.audit,
    rawFixture,
    repositoryFixture,
    baselineTeam,
    manualIndexEntry,
    sourceRegistryEntries,
  };
}

export function buildXiaoFormulaCountParityScopeAuthenticationInput(
  input: XiaoFormulaCountParityScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return buildAuthenticationInput(input);
}

function buildAuthenticationInput(
  input: XiaoFormulaCountParityScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_FIXTURE_DEPENDENCY_ID,
        containerPath: FIXTURE_SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        records: input.manualFixtureSnapshot.records,
        adapter: {
          projectionAdapterId: "xiao-formula-raw-fixture-v1",
          keyOf: manualSourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_FIXTURE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "xiao-formula-repository-fixture-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_PRESET_TEAM_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/teams",
        keySchemaId: "genshintools-source-record-id-v1",
        records: input.genshinToolsSnapshot.teams,
        adapter: {
          projectionAdapterId: "xiao-formula-raw-preset-team-v1",
          keyOf: ({ sourceRecordId }) => sourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_TEAM_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "xiao-formula-repository-team-v1",
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
          projectionAdapterId: "xiao-formula-manual-index-entry-v1",
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
          projectionAdapterId: "xiao-formula-source-manifest-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: FIXTURE_PARITY_ADAPTER_ID,
        normalize: ({ dependencyId, key, payload }) =>
          normalizeFixtureParity(dependencyId, key, payload),
      },
      {
        parityAdapterId: TEAM_PARITY_ADAPTER_ID,
        normalize: ({ dependencyId, key, payload }) =>
          normalizeTeamParity(dependencyId, key, payload),
      },
    ],
    expectation: { ...XIAO_FORMULA_COUNT_PARITY_SCOPE_EXPECTATION },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: XIAO_FORMULA_COUNT_PARITY_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: RAW_FIXTURE_DEPENDENCY_ID,
        containerPath: FIXTURE_SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        projectionAdapterId: "xiao-formula-raw-fixture-v1",
        requiredKeys: [XIAO_FORMULA_COUNT_SOURCE_RECORD_ID],
      },
      {
        dependencyId: REPOSITORY_FIXTURE_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "xiao-formula-repository-fixture-v1",
        requiredKeys: [XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID],
      },
      {
        dependencyId: RAW_PRESET_TEAM_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/teams",
        keySchemaId: "genshintools-source-record-id-v1",
        projectionAdapterId: "xiao-formula-raw-preset-team-v1",
        requiredKeys: [XIAO_FORMULA_COUNT_BASELINE_SOURCE_RECORD_ID],
      },
      {
        dependencyId: REPOSITORY_TEAM_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "xiao-formula-repository-team-v1",
        requiredKeys: [XIAO_FORMULA_COUNT_BASELINE_TEAM_ID],
      },
      {
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        projectionAdapterId: "xiao-formula-manual-index-entry-v1",
        requiredKeys: [FIXTURE_SNAPSHOT_PATH],
      },
      {
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        projectionAdapterId: "xiao-formula-source-manifest-v1",
        requiredKeys: ["kqm", "genshintools-presets"],
      },
    ],
    parities: [
      {
        parityId: "xiao-formula-manual-repository-fixture",
        parityAdapterId: FIXTURE_PARITY_ADAPTER_ID,
        left: {
          dependencyId: RAW_FIXTURE_DEPENDENCY_ID,
          key: XIAO_FORMULA_COUNT_SOURCE_RECORD_ID,
        },
        right: {
          dependencyId: REPOSITORY_FIXTURE_DEPENDENCY_ID,
          key: XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID,
        },
      },
      {
        parityId: "xiao-formula-preset-repository-team",
        parityAdapterId: TEAM_PARITY_ADAPTER_ID,
        left: {
          dependencyId: RAW_PRESET_TEAM_DEPENDENCY_ID,
          key: XIAO_FORMULA_COUNT_BASELINE_SOURCE_RECORD_ID,
        },
        right: {
          dependencyId: REPOSITORY_TEAM_DEPENDENCY_ID,
          key: XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
        },
      },
    ],
  };
}

function normalizeFixtureParity(
  dependencyId: string,
  key: string,
  payload: ScopedSemanticJsonValue,
): unknown {
  const record = requiredObject(payload, `${dependencyId}:${key}`);
  if (
    dependencyId !== RAW_FIXTURE_DEPENDENCY_ID &&
    dependencyId !== REPOSITORY_FIXTURE_DEPENDENCY_ID
  ) {
    throw new Error(`Unexpected Xiao fixture parity dependency ${dependencyId}.`);
  }
  if (record.kind !== "rotation_fixture") {
    throw new Error(`Xiao formula fixture ${key} has kind ${String(record.kind)}.`);
  }
  return {
    characterId: record.characterId,
    rotation: record.rotation,
    formulaCounts: record.formulaCounts,
  };
}

function normalizeTeamParity(
  dependencyId: string,
  key: string,
  payload: ScopedSemanticJsonValue,
): unknown {
  const record = requiredObject(payload, `${dependencyId}:${key}`);
  const members = requiredArray(
    record.members,
    `${dependencyId}:${key}.members`,
  ).map((value, index) => {
    const member = requiredObject(
      value,
      `${dependencyId}:${key}.members[${index}]`,
    );
    if (dependencyId === RAW_PRESET_TEAM_DEPENDENCY_ID) {
      return {
        characterId: member.characterId,
        investment: { status: "unspecified" },
        selectedArtifact: member.selectedArtifact,
        selectedWeapon: { weaponId: member.selectedWeaponId },
      };
    }
    if (dependencyId !== REPOSITORY_TEAM_DEPENDENCY_ID) {
      throw new Error(`Unexpected Xiao team parity dependency ${dependencyId}.`);
    }
    return {
      characterId: member.characterId,
      investment: member.investment,
      selectedArtifact: member.selectedArtifact,
      selectedWeapon: member.selectedWeapon,
    };
  });
  return { members };
}

function manualSourceRecordId(record: unknown): string {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Xiao formula manual record is not an object.");
  }
  const sourceRecordId = (record as { sourceRecordId?: unknown })
    .sourceRecordId;
  if (typeof sourceRecordId !== "string" || sourceRecordId.length === 0) {
    throw new Error("Xiao formula manual record has no exact sourceRecordId.");
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
      `Authenticated Xiao formula scope expected one ${dependencyId} selection, found ${matches.length}.`,
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
