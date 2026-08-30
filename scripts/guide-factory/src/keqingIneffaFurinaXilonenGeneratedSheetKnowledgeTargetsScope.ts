import { sha256Text, stableJson } from "./io";
import type {
  EquipmentInventoryOccurrence,
  KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  type ScopedSemanticDependencyAcceptedAudit,
  type ScopedSemanticDependencyAuthenticationInput,
  type ScopedSemanticDependencyAuthenticationResult,
  type ScopedSemanticDependencyCandidateDerivationResult,
  type ScopedSemanticDependencyManifest,
  type ScopedSemanticDependencySelection,
  type ScopedSemanticJsonValue,
} from "./scopedSemanticDependency";
import {
  KnowledgeRecordSchema,
  PresetCharacterGuideRecordSchema,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const PRESET_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const LIVE_PRESET_PATH =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
const EVIDENCE_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const EQUIPMENT_LATTICE_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json";

const REPOSITORY_DEPENDENCY_ID = "cp39-repository-records";
const REPOSITORY_CLAIM_ENTRY_DEPENDENCY_ID =
  "cp39-repository-recommendation-entries";
const PRESET_GUIDE_DEPENDENCY_ID = "cp39-preset-guides";
const PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID =
  "cp39-preset-snapshot-envelope";
const PRESET_BUILD_DEPENDENCY_ID = "cp39-preset-builds";
const LIVE_BUILD_DEPENDENCY_ID = "cp39-live-builds";
const LIVE_CHARACTER_BUILDS_DEPENDENCY_ID =
  "cp39-live-character-build-ids";
const EVIDENCE_CLAIM_DEPENDENCY_ID = "cp39-evidence-claims";
const EVIDENCE_SOURCE_BOUNDARY_DEPENDENCY_ID =
  "cp39-evidence-source-boundaries";
const EVIDENCE_CAPABILITY_DEPENDENCY_ID = "cp39-evidence-capability";
const CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID = "cp39-cp36-active-artifacts";

const SNAPSHOT_REPOSITORY_PARITY_ADAPTER_ID =
  "cp39-snapshot-repository-guide-parity-v1";
const BUILD_LIVE_PARITY_ADAPTER_ID = "cp39-build-live-parity-v1";
const CLAIM_REPOSITORY_ENTRY_PARITY_ADAPTER_ID =
  "cp39-claim-repository-entry-parity-v1";
const ACTIVE_ARTIFACT_BUILD_PARITY_ADAPTER_ID =
  "cp39-active-artifact-build-identity-parity-v1";

const CAPABILITY_KEY = "generated-sheet-knowledge-target-capability";
const PRESET_SNAPSHOT_ENVELOPE_KEY = "genshintools-preset-snapshot-envelope";

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_REPOSITORY_RECORD_IDS =
  [
    "genshintools-presets:character-guide:keqing",
    "genshintools-presets:character-guide:ineffa",
    "genshintools-presets:character-guide:furina",
    "genshintools-presets:character-guide:xilonen",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i",
    "kqm:character-guide:furina-post-er-substats-luna-ii",
  ] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_PRESET_CHARACTER_IDS =
  ["keqing", "ineffa", "furina", "xilonen"] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS =
  [
    {
      characterId: "keqing",
      buildId: "1WswsAu",
      occurrenceId:
        "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:0",
    },
    {
      characterId: "ineffa",
      buildId: "FeFiQU8",
      occurrenceId:
        "genshintools-presets:character-guide:ineffa:build:FeFiQU8",
    },
    {
      characterId: "furina",
      buildId: "BQAI0BO",
      occurrenceId:
        "genshintools-presets:character-guide:furina:build:BQAI0BO",
    },
    {
      characterId: "furina",
      buildId: "BQA4H1m",
      occurrenceId:
        "genshintools-presets:character-guide:furina:build:BQA4H1m",
    },
    {
      characterId: "xilonen",
      buildId: "Dbt0Wkm",
      occurrenceId:
        "genshintools-presets:character-guide:xilonen:build:Dbt0Wkm",
    },
  ] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_STAT_RECORD_IDS =
  [
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i",
  ] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_CLAIM_IDS =
  [
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:sands:0",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:goblet:0",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:goblet:1",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:0",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:main-stat:circlet:1",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:0",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:1",
    "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:2",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:sands:0",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:goblet:0",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:circlet:0",
    "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:circlet:1",
  ] as const;

export const KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION =
  Object.freeze({
    scopeId:
      "keqing-ineffa-furina-xilonen-generated-sheet-knowledge-targets-v1",
    manifestSha256:
      "d7c66a48751deffcbae499e5b67d4d3212c65a8fbd769c1b23bb15c3aa67f3cd",
    scopeProjectionSha256:
      "610087fda9d902936ee55c8b8ea74ddc9247701aef19a47bdf1777bef5f331cf",
  });

export type KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput = {
  equipmentLatticeReport: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport;
  repository: KnowledgeRepository;
  genshinToolsSnapshot: GenshinToolsPresetSnapshot;
  liveBuildPreset: unknown;
  evidenceReport: KeqingLunarEquipmentEvidenceValidationReport;
};

type PresetGuide = GenshinToolsPresetSnapshot["characterGuides"][number];
type PresetBuild = PresetGuide["builds"][number];
type EvidenceClaim =
  KeqingLunarEquipmentEvidenceValidationReport["claims"][number];
type EvidenceSourceBoundary =
  KeqingLunarEquipmentEvidenceValidationReport["sourceBoundary"]["records"][number];

type SelectedBuildRow = {
  characterId: string;
  buildId: string;
  build: PresetBuild;
};

type CharacterBuildRow = { characterId: string; buildIds: string[] };
type RawLiveBuildRow = {
  characterId: string;
  buildId: string;
  rawBuild: unknown;
};
type RawCharacterBuildRow = { characterId: string; buildIds: unknown };

type RepositoryClaimEntry = {
  claimId: string;
  repositoryRecordId: string;
  sourceRecordId: string;
  recommendationId: string;
  recommendationScope: string;
  roles: string[];
  sourceClaim: {
    kind: "main-stat" | "substat";
    slot?: "sands" | "goblet" | "circlet";
    entryIndex: number;
    statIds: string[];
    priority: number | null;
    target: string | null;
  };
  sourceConditions: string[];
};

type EvidenceCapability = ReturnType<typeof projectEvidenceCapability>;
type ActiveArtifactIdentity = ReturnType<typeof projectActiveArtifact>;
type PresetSnapshotEnvelope = ReturnType<typeof projectPresetSnapshotEnvelope>;

export type AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope = {
  audit: ScopedSemanticDependencyAcceptedAudit;
  repositoryRecords: readonly KnowledgeRecord[];
  presetGuides: readonly PresetGuide[];
  presetSnapshotEnvelope: PresetSnapshotEnvelope;
  presetBuilds: readonly SelectedBuildRow[];
  liveBuilds: readonly SelectedBuildRow[];
  liveCharacterBuilds: readonly CharacterBuildRow[];
  evidence: {
    claims: readonly EvidenceClaim[];
    sourceBoundaries: readonly EvidenceSourceBoundary[];
    capability: EvidenceCapability;
  };
  cp36ActiveArtifacts: readonly ActiveArtifactIdentity[];
};

export type CompactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit = {
  scopeId: string;
  trust: ScopedSemanticDependencyAcceptedAudit["trust"];
  manifestSha256: string;
  scopeProjectionSha256: string;
  dependencies: Array<{
    dependencyId: string;
    selectedEntryCount: number;
    selectedKeySetSha256: string;
    selectedPayloadSha256: string;
  }>;
  paritySummary: {
    parityCount: number;
    exactParityCount: number;
    normalizedPairDigestSha256: string;
  };
};

export function deriveKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeCandidate(
  input: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput = buildAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
  input: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput,
): ScopedSemanticDependencyAuthenticationResult {
  return authenticateScopedSemanticDependencies(buildAuthenticationInput(input));
}

export function requireKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
  input: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput,
): AuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope {
  const result =
    authenticateKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScope(
      input,
    );
  if (result.status !== "accepted") {
    throw new Error(
      `CP39 knowledge-target semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  return {
    audit: result.audit,
    repositoryRecords: selectedPayloads(
      result.selection,
      REPOSITORY_DEPENDENCY_ID,
    ).map((payload) => KnowledgeRecordSchema.parse(payload)),
    presetGuides: selectedPayloads(
      result.selection,
      PRESET_GUIDE_DEPENDENCY_ID,
    ).map((payload) => PresetCharacterGuideRecordSchema.parse(payload)),
    presetSnapshotEnvelope: structuredClone(
      selectedPayload(
        result.selection,
        PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        PRESET_SNAPSHOT_ENVELOPE_KEY,
      ),
    ) as PresetSnapshotEnvelope,
    presetBuilds: selectedPayloads(
      result.selection,
      PRESET_BUILD_DEPENDENCY_ID,
    ).map((payload) => structuredClone(payload) as SelectedBuildRow),
    liveBuilds: selectedPayloads(
      result.selection,
      LIVE_BUILD_DEPENDENCY_ID,
    ).map((payload) => structuredClone(payload) as SelectedBuildRow),
    liveCharacterBuilds: selectedPayloads(
      result.selection,
      LIVE_CHARACTER_BUILDS_DEPENDENCY_ID,
    ).map((payload) => structuredClone(payload) as CharacterBuildRow),
    evidence: {
      claims: selectedPayloads(
        result.selection,
        EVIDENCE_CLAIM_DEPENDENCY_ID,
      ).map(
        (payload) => structuredClone(payload) as unknown as EvidenceClaim,
      ),
      sourceBoundaries: selectedPayloads(
        result.selection,
        EVIDENCE_SOURCE_BOUNDARY_DEPENDENCY_ID,
      ).map((payload) => structuredClone(payload) as EvidenceSourceBoundary),
      capability: structuredClone(
        selectedPayload(
          result.selection,
          EVIDENCE_CAPABILITY_DEPENDENCY_ID,
          CAPABILITY_KEY,
        ),
      ) as EvidenceCapability,
    },
    cp36ActiveArtifacts: selectedPayloads(
      result.selection,
      CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID,
    ).map((payload) => structuredClone(payload) as ActiveArtifactIdentity),
  };
}

export function compactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit(
  audit: ScopedSemanticDependencyAcceptedAudit,
): CompactKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAudit {
  return {
    scopeId: audit.scopeId,
    trust: audit.trust,
    manifestSha256: audit.selector.manifestSha256,
    scopeProjectionSha256: audit.scopeProjectionSha256,
    dependencies: audit.dependencies.map((dependency) => ({
      dependencyId: dependency.dependencyId,
      selectedEntryCount: dependency.selectedEntries.length,
      selectedKeySetSha256: dependency.selectedKeySetSha256,
      selectedPayloadSha256: dependency.selectedPayloadSha256,
    })),
    paritySummary: {
      parityCount: audit.parities.length,
      exactParityCount: audit.parities.filter(({ status }) => status === "exact")
        .length,
      normalizedPairDigestSha256: sha256Text(
        stableJson(
          audit.parities.map(
            ({
              parityId,
              leftNormalizedSha256,
              rightNormalizedSha256,
              status,
            }) => ({
              parityId,
              leftNormalizedSha256,
              rightNormalizedSha256,
              status,
            }),
          ),
        ),
      ),
    },
  };
}

/** Exposed only for focused adversarial selector-identity tests. */
export function buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeAuthenticationInput(
  input: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return buildAuthenticationInput(input);
}

function buildAuthenticationInput(
  input: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  const repositoryClaimEntries = projectRepositoryClaimEntries(
    input.repository.records,
  );
  const presetBuildRows = projectPresetBuildRows(
    input.genshinToolsSnapshot.characterGuides,
  );
  const live = projectLiveInput(input.liveBuildPreset);
  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.repository.records,
        adapter: {
          projectionAdapterId: "cp39-repository-record-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_CLAIM_ENTRY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records/*/recommendations/(mainStats|substats)",
        keySchemaId: "generated-sheet-kqm-claim-id-v1",
        records: repositoryClaimEntries,
        adapter: {
          projectionAdapterId: "cp39-repository-recommendation-entry-v1",
          keyOf: ({ claimId }) => claimId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_GUIDE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides",
        keySchemaId: "preset-character-id-v1",
        records: input.genshinToolsSnapshot.characterGuides,
        adapter: {
          projectionAdapterId: "cp39-preset-guide-v1",
          keyOf: ({ characterId }) => characterId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "cp39-preset-snapshot-envelope-key-v1",
        records: [input.genshinToolsSnapshot],
        adapter: {
          projectionAdapterId: "cp39-preset-snapshot-envelope-v1",
          keyOf: () => PRESET_SNAPSHOT_ENVELOPE_KEY,
          project: projectPresetSnapshotEnvelope,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_BUILD_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides/*/builds",
        keySchemaId: "preset-character-build-id-v1",
        records: presetBuildRows,
        adapter: {
          projectionAdapterId: "cp39-preset-build-v1",
          keyOf: selectedBuildKey,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_BUILD_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/builds",
        keySchemaId: "preset-character-build-id-v1",
        records: live.rawBuildRows,
        adapter: {
          projectionAdapterId: "cp39-live-build-v1",
          keyOf: selectedBuildKey,
          project: ({ characterId, buildId, rawBuild }) => ({
            characterId,
            buildId,
            build: projectLiveBuild(rawBuild, buildId),
          }),
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_CHARACTER_BUILDS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterBuilds",
        keySchemaId: "preset-character-id-v1",
        records: live.characterBuildRows,
        adapter: {
          projectionAdapterId: "cp39-live-character-build-ids-v1",
          keyOf: ({ characterId }) => characterId,
          project: ({ characterId, buildIds }) => ({
            characterId,
            buildIds: requiredStringArray(
              buildIds,
              `live characterBuilds.${characterId}`,
            ),
          }),
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        records: input.evidenceReport.claims,
        adapter: {
          projectionAdapterId: "cp39-evidence-claim-v1",
          keyOf: ({ claimId }) => claimId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_SOURCE_BOUNDARY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/sourceBoundary/records",
        keySchemaId: "knowledge-record-id-v1",
        records: input.evidenceReport.sourceBoundary.records,
        adapter: {
          projectionAdapterId: "cp39-evidence-source-boundary-v1",
          keyOf: ({ repositoryRecordId }) => repositoryRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_CAPABILITY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp39-capability-key-v1",
        records: [input.evidenceReport],
        adapter: {
          projectionAdapterId: "cp39-evidence-capability-v1",
          keyOf: () => CAPABILITY_KEY,
          project: projectEvidenceCapability,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID,
        containerPath: EQUIPMENT_LATTICE_REPORT_PATH,
        collectionPath: "/inventoryBoundary/occurrences",
        keySchemaId: "equipment-occurrence-id-v1",
        records: input.equipmentLatticeReport.inventoryBoundary.occurrences,
        adapter: {
          projectionAdapterId: "cp39-active-artifact-identity-v1",
          keyOf: ({ occurrenceId }) => occurrenceId,
          project: projectActiveArtifact,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: SNAPSHOT_REPOSITORY_PARITY_ADAPTER_ID,
        normalize: normalizeSnapshotRepositoryParity,
      },
      {
        parityAdapterId: BUILD_LIVE_PARITY_ADAPTER_ID,
        normalize: ({ payload }) => payload,
      },
      {
        parityAdapterId: CLAIM_REPOSITORY_ENTRY_PARITY_ADAPTER_ID,
        normalize: normalizeClaimRepositoryEntryParity,
      },
      {
        parityAdapterId: ACTIVE_ARTIFACT_BUILD_PARITY_ADAPTER_ID,
        normalize: normalizeActiveArtifactBuildParity,
      },
    ],
    expectation: {
      ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION,
    },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  const buildKeys =
    KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
      selectedBuildKey,
    );
  return {
    schemaVersion: 1,
    scopeId:
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "cp39-repository-record-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_REPOSITORY_RECORD_IDS,
        ],
      },
      {
        dependencyId: REPOSITORY_CLAIM_ENTRY_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records/*/recommendations/(mainStats|substats)",
        keySchemaId: "generated-sheet-kqm-claim-id-v1",
        projectionAdapterId: "cp39-repository-recommendation-entry-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_CLAIM_IDS,
        ],
      },
      {
        dependencyId: PRESET_GUIDE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp39-preset-guide-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_PRESET_CHARACTER_IDS,
        ],
      },
      {
        dependencyId: PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "cp39-preset-snapshot-envelope-key-v1",
        projectionAdapterId: "cp39-preset-snapshot-envelope-v1",
        requiredKeys: [PRESET_SNAPSHOT_ENVELOPE_KEY],
      },
      {
        dependencyId: PRESET_BUILD_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides/*/builds",
        keySchemaId: "preset-character-build-id-v1",
        projectionAdapterId: "cp39-preset-build-v1",
        requiredKeys: [...buildKeys],
      },
      {
        dependencyId: LIVE_BUILD_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/builds",
        keySchemaId: "preset-character-build-id-v1",
        projectionAdapterId: "cp39-live-build-v1",
        requiredKeys: [...buildKeys],
      },
      {
        dependencyId: LIVE_CHARACTER_BUILDS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterBuilds",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp39-live-character-build-ids-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_PRESET_CHARACTER_IDS,
        ],
      },
      {
        dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        projectionAdapterId: "cp39-evidence-claim-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_CLAIM_IDS,
        ],
      },
      {
        dependencyId: EVIDENCE_SOURCE_BOUNDARY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/sourceBoundary/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId: "cp39-evidence-source-boundary-v1",
        requiredKeys: [
          ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_STAT_RECORD_IDS,
        ],
      },
      {
        dependencyId: EVIDENCE_CAPABILITY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp39-capability-key-v1",
        projectionAdapterId: "cp39-evidence-capability-v1",
        requiredKeys: [CAPABILITY_KEY],
      },
      {
        dependencyId: CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID,
        containerPath: EQUIPMENT_LATTICE_REPORT_PATH,
        collectionPath: "/inventoryBoundary/occurrences",
        keySchemaId: "equipment-occurrence-id-v1",
        projectionAdapterId: "cp39-active-artifact-identity-v1",
        requiredKeys:
          KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
            ({ occurrenceId }) => occurrenceId,
          ),
      },
    ],
    parities: [
      ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_PRESET_CHARACTER_IDS.map(
        (characterId) => ({
          parityId: `snapshot-repository:${characterId}`,
          parityAdapterId: SNAPSHOT_REPOSITORY_PARITY_ADAPTER_ID,
          left: {
            dependencyId: PRESET_GUIDE_DEPENDENCY_ID,
            key: characterId,
          },
          right: {
            dependencyId: REPOSITORY_DEPENDENCY_ID,
            key: `genshintools-presets:character-guide:${characterId}`,
          },
        }),
      ),
      ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
        (association) => ({
          parityId: `build-live:${association.characterId}:${association.buildId}`,
          parityAdapterId: BUILD_LIVE_PARITY_ADAPTER_ID,
          left: {
            dependencyId: PRESET_BUILD_DEPENDENCY_ID,
            key: selectedBuildKey(association),
          },
          right: {
            dependencyId: LIVE_BUILD_DEPENDENCY_ID,
            key: selectedBuildKey(association),
          },
        }),
      ),
      ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_CLAIM_IDS.map(
        (claimId) => ({
          parityId: `claim-repository-entry:${claimId}`,
          parityAdapterId: CLAIM_REPOSITORY_ENTRY_PARITY_ADAPTER_ID,
          left: {
            dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
            key: claimId,
          },
          right: {
            dependencyId: REPOSITORY_CLAIM_ENTRY_DEPENDENCY_ID,
            key: claimId,
          },
        }),
      ),
      ...KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
        (association) => ({
          parityId: `active-artifact-build:${association.characterId}:${association.buildId}`,
          parityAdapterId: ACTIVE_ARTIFACT_BUILD_PARITY_ADAPTER_ID,
          left: {
            dependencyId: CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID,
            key: association.occurrenceId,
          },
          right: {
            dependencyId: PRESET_BUILD_DEPENDENCY_ID,
            key: selectedBuildKey(association),
          },
        }),
      ),
    ],
  };
}

function projectPresetBuildRows(guides: readonly PresetGuide[]): SelectedBuildRow[] {
  return guides.flatMap(({ characterId, builds }) =>
    builds.map((build) => ({
      characterId,
      buildId: build.sourceRecordId,
      build,
    })),
  );
}

function projectLiveInput(input: unknown): {
  rawBuildRows: RawLiveBuildRow[];
  characterBuildRows: RawCharacterBuildRow[];
} {
  const live = requiredRecord(input, "live preset");
  const builds = requiredRecord(live.builds, "live preset builds");
  const characterBuilds = requiredRecord(
    live.characterBuilds,
    "live preset characterBuilds",
  );
  const characterByBuildId = new Map<string, string>(
    KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_ASSOCIATIONS.map(
      ({ characterId, buildId }) => [buildId, characterId] as const,
    ),
  );
  return {
    rawBuildRows: Object.entries(builds).map(([buildId, rawBuild]) => {
      const characterId = characterByBuildId.get(buildId) ?? "unselected";
      return {
        characterId,
        buildId,
        rawBuild,
      };
    }),
    characterBuildRows: Object.entries(characterBuilds).map(
      ([characterId, buildIds]) => ({
        characterId,
        buildIds,
      }),
    ),
  };
}

function projectLiveBuild(input: unknown, expectedBuildId: string): PresetBuild {
  const build = requiredRecord(input, `live build ${expectedBuildId}`);
  if (build.id !== expectedBuildId) {
    throw new Error(`Live build ${expectedBuildId} changed embedded identity.`);
  }
  if (typeof build.visible !== "boolean") {
    throw new Error(`Live build ${expectedBuildId} has no boolean visible flag.`);
  }
  const composition = requiredString(
    build.composition,
    `live build ${expectedBuildId}.composition`,
  );
  const artifact = composition === "4pc"
    ? {
        type: "4pc" as const,
        setId: requiredString(
          build.artifactSet,
          `live build ${expectedBuildId}.artifactSet`,
        ),
      }
    : composition === "2pc+2pc"
      ? {
          type: "2pc+2pc" as const,
          halfSetIds: [
            requiredString(
              build.halfSet1,
              `live build ${expectedBuildId}.halfSet1`,
            ),
            requiredString(
              build.halfSet2,
              `live build ${expectedBuildId}.halfSet2`,
            ),
          ] as [string, string],
        }
      : (() => {
          throw new Error(
            `Live build ${expectedBuildId} has unsupported composition ${composition}.`,
          );
        })();
  const result: PresetBuild = {
    sourceRecordId: expectedBuildId,
    visible: build.visible,
    artifact,
    sands: requiredStatRows(build.sandsWeights, `${expectedBuildId}.sandsWeights`),
    goblet: requiredStatRows(
      build.gobletWeights,
      `${expectedBuildId}.gobletWeights`,
    ),
    circlet: requiredStatRows(
      build.circletWeights,
      `${expectedBuildId}.circletWeights`,
    ),
    substats: requiredStatRows(build.substats, `${expectedBuildId}.substats`),
  };
  if (typeof build.name === "string" && build.name.length > 0) {
    result.name = build.name;
  }
  if (typeof build.minCons === "number") {
    result.minConstellation = build.minCons;
  }
  const styles = optionalStringArray(build.styles, `${expectedBuildId}.styles`);
  if (styles.length > 0) result.styles = styles;
  const roles = optionalStringArray(build.roles, `${expectedBuildId}.roles`);
  if (roles.length > 0) result.roles = roles;
  return result;
}

function projectRepositoryClaimEntries(
  records: readonly KnowledgeRecord[],
): RepositoryClaimEntry[] {
  return records.flatMap((record) => {
    if (
      record.kind !== "character_guide" ||
      !KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_KQM_STAT_RECORD_IDS.includes(
        record.id as never,
      )
    ) {
      return [];
    }
    if (record.sourceRefs.length !== 1) return [];
    const sourceRecordId = record.sourceRefs[0]?.sourceRecordId;
    if (!sourceRecordId) return [];
    return (record.recommendations ?? []).flatMap((recommendation) => {
      const common = {
        repositoryRecordId: record.id,
        sourceRecordId,
        recommendationId: recommendation.id,
        recommendationScope: recommendation.scope,
        roles: [...(recommendation.roles ?? [])],
      };
      const mainStatEntries = (["sands", "goblet", "circlet"] as const).flatMap(
        (slot) =>
          (recommendation.mainStats?.[slot] ?? []).map((entry, entryIndex) => ({
            claimId: `${record.id}:main-stat:${slot}:${entryIndex}`,
            ...common,
            sourceClaim: {
              kind: "main-stat" as const,
              slot,
              entryIndex,
              statIds: [...entry.statIds],
              priority: entry.priority ?? null,
              target: entry.target ?? null,
            },
            sourceConditions: [...entry.conditions],
          })),
      );
      const substatEntries = (recommendation.substats ?? []).map(
        (entry, entryIndex) => ({
          claimId: `${record.id}:substat:${entryIndex}`,
          ...common,
          sourceClaim: {
            kind: "substat" as const,
            entryIndex,
            statIds: [...entry.statIds],
            priority: entry.priority ?? null,
            target: entry.target ?? null,
          },
          sourceConditions: [...entry.conditions],
        }),
      );
      return [...mainStatEntries, ...substatEntries];
    });
  });
}

function projectPresetSnapshotEnvelope(snapshot: GenshinToolsPresetSnapshot) {
  return {
    key: PRESET_SNAPSHOT_ENVELOPE_KEY,
    schemaVersion: snapshot.schemaVersion,
    sourceId: snapshot.sourceId,
  };
}

function projectEvidenceCapability(
  report: KeqingLunarEquipmentEvidenceValidationReport,
) {
  return {
    key: CAPABILITY_KEY,
    validationStatus: report.validationStatus,
    supportsGuideClaims: report.supportsGuideClaims,
    supportsEquipmentRecommendations: report.supportsEquipmentRecommendations,
    supportsStatRecommendations: report.supportsStatRecommendations,
    supportsRankClaims: report.supportsRankClaims,
    supportsConditionApplicabilityClaims:
      report.supportsConditionApplicabilityClaims,
    supportsDamageClaims: report.supportsDamageClaims,
    supportsEnergyRecoveryClaims: report.supportsEnergyRecoveryClaims,
    candidateGenerationInput: report.candidateGenerationInput,
    candidateGenerationExecuted: report.candidateGenerationExecuted,
    damageOrRankingComputationExecuted:
      report.damageOrRankingComputationExecuted,
    energyRecoveryInputsUsed: report.energyRecoveryInputsUsed,
    sourceConditionSafety: {
      mappingKind: report.sourceConditionBoundary.mappingKind,
      rosterAndDeclaredReactionFactsOnly:
        report.sourceConditionBoundary.rosterAndDeclaredReactionFactsOnly,
      allSourceConditionsMappedExactly:
        report.sourceConditionBoundary.allSourceConditionsMappedExactly,
      unexpectedGameplayBuildOrRefinementResolutionCount:
        report.sourceConditionBoundary
          .unexpectedGameplayBuildOrRefinementResolutionCount,
    },
  };
}

function projectActiveArtifact(occurrence: EquipmentInventoryOccurrence) {
  return {
    occurrenceId: occurrence.occurrenceId,
    characterId: occurrence.characterId,
    equipmentKind: occurrence.equipmentKind,
    equipmentId: occurrence.equipmentId,
    status: occurrence.status,
  };
}

function normalizeSnapshotRepositoryParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  if (dependencyId === PRESET_GUIDE_DEPENDENCY_ID) return payload;
  if (dependencyId !== REPOSITORY_DEPENDENCY_ID) {
    throw new Error(`Unexpected CP39 guide parity input ${dependencyId}.`);
  }
  const guide = jsonObject(payload);
  const sourceRefs = requiredJsonArray(guide.sourceRefs, "preset sourceRefs");
  if (sourceRefs.length !== 1) {
    throw new Error("CP39 repository preset guide must have one sourceRef.");
  }
  const sourceRef = jsonObject(sourceRefs[0]);
  return {
    builds: guide.builds,
    characterId: guide.characterId,
    kind: "character_guide",
    locator: sourceRef.locator,
    sourceRecordId: sourceRef.sourceRecordId,
    unknowns: guide.unknowns,
    weaponOrder: guide.weaponOrder,
  };
}

function normalizeClaimRepositoryEntryParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  if (dependencyId === REPOSITORY_CLAIM_ENTRY_DEPENDENCY_ID) return payload;
  if (dependencyId !== EVIDENCE_CLAIM_DEPENDENCY_ID) {
    throw new Error(`Unexpected CP39 claim parity input ${dependencyId}.`);
  }
  const claim = jsonObject(payload);
  const sourceClaim = jsonObject(claim.sourceClaim);
  if (sourceClaim.kind !== "main-stat" && sourceClaim.kind !== "substat") {
    throw new Error("CP39 selected evidence claim must be a stat claim.");
  }
  return {
    claimId: claim.claimId,
    repositoryRecordId: claim.repositoryRecordId,
    sourceRecordId: claim.sourceRecordId,
    recommendationId: claim.recommendationId,
    recommendationScope: claim.recommendationScope,
    roles: claim.roles,
    sourceClaim,
    sourceConditions: claim.sourceConditions,
  };
}

function normalizeActiveArtifactBuildParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  const value = jsonObject(payload);
  if (dependencyId === CP36_ACTIVE_ARTIFACT_DEPENDENCY_ID) {
    return {
      characterId: value.characterId,
      artifactIdentity: value.equipmentId,
      equipmentKind: value.equipmentKind,
      status: value.status,
    };
  }
  if (dependencyId === PRESET_BUILD_DEPENDENCY_ID) {
    const build = jsonObject(value.build);
    return {
      characterId: value.characterId,
      artifactIdentity: artifactIdentity(jsonObject(build.artifact)),
      equipmentKind: "artifact",
      status: "active-experiment-axis",
    };
  }
  throw new Error(`Unexpected CP39 active-artifact parity input ${dependencyId}.`);
}

function artifactIdentity(artifact: Record<string, ScopedSemanticJsonValue>) {
  if (artifact.type === "4pc") {
    return `4pc:${requiredJsonString(artifact.setId, "artifact setId")}`;
  }
  if (artifact.type === "2pc+2pc") {
    const ids = requiredJsonArray(artifact.halfSetIds, "artifact halfSetIds");
    if (ids.length !== 2 || ids.some((id) => typeof id !== "string")) {
      throw new Error("CP39 2pc+2pc artifact identity requires two half-set IDs.");
    }
    return `2pc+2pc:${ids.join("+")}`;
  }
  throw new Error("CP39 artifact identity has an unsupported type.");
}

function selectedBuildKey(input: { characterId: string; buildId: string }): string {
  return `${input.characterId}:${input.buildId}`;
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
      `CP39 semantic selection expected one ${dependencyId}, found ${matches.length}.`,
    );
  }
  return matches[0].entries.map(({ payload }) => payload);
}

function selectedPayload(
  selection: ScopedSemanticDependencySelection,
  dependencyId: string,
  key: string,
): ScopedSemanticJsonValue {
  const dependencies = selection.dependencies.filter(
    (dependency) => dependency.dependencyId === dependencyId,
  );
  if (dependencies.length !== 1) {
    throw new Error(`CP39 semantic selection has no unique ${dependencyId}.`);
  }
  const entries = dependencies[0].entries.filter((entry) => entry.key === key);
  if (entries.length !== 1) {
    throw new Error(
      `CP39 semantic selection has no unique ${dependencyId}/${key}.`,
    );
  }
  return entries[0].payload;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be a string array.`);
  }
  return [...value];
}

function optionalStringArray(value: unknown, label: string): string[] {
  return value == null ? [] : requiredStringArray(value, label);
}

function requiredStatRows(
  value: unknown,
  label: string,
): Array<{ stat: string; weight: number }> {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((entry, index) => {
    const row = requiredRecord(entry, `${label}[${index}]`);
    if (typeof row.stat !== "string" || typeof row.weight !== "number") {
      throw new Error(`${label}[${index}] must contain stat and weight.`);
    }
    return { stat: row.stat, weight: row.weight };
  });
}

function jsonObject(
  value: ScopedSemanticJsonValue,
): Record<string, ScopedSemanticJsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CP39 parity payload must be an object.");
  }
  return value as unknown as Record<string, ScopedSemanticJsonValue>;
}

function requiredJsonArray(
  value: ScopedSemanticJsonValue | undefined,
  label: string,
): readonly ScopedSemanticJsonValue[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requiredJsonString(
  value: ScopedSemanticJsonValue | undefined,
  label: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}
