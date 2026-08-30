import { z } from "zod";
import type { ArtifactChoiceSearchCoverageReport } from "./artifactChoiceSearchCoverage";
import { sha256Text, stableJson } from "./io";
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
  ManualObservationRecordSchema,
  PresetCharacterGuideRecordSchema,
  SourceManifestSchema,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";
import type {
  WeaponChoiceSearchCoverageObservation,
  WeaponChoiceSearchCoverageReport,
} from "./weaponChoiceSearchCoverage";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const KQM_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";
const PRESET_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const LIVE_PRESET_PATH =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
const EVIDENCE_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const WEAPON_COVERAGE_PATH =
  "scripts/guide-factory/reports/weapon-choice-search-coverage.json";
const ARTIFACT_COVERAGE_PATH =
  "scripts/guide-factory/reports/artifact-choice-search-coverage.json";

const REPOSITORY_DEPENDENCY_ID = "cp36-repository-records";
const KQM_SNAPSHOT_ENVELOPE_DEPENDENCY_ID =
  "cp36-kqm-snapshot-envelope";
const RAW_KQM_DEPENDENCY_ID = "cp36-raw-kqm-records";
const PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID =
  "cp36-preset-snapshot-envelope";
const PRESET_SNAPSHOT_DEPENDENCY_ID = "cp36-preset-snapshot-guides";
const LIVE_PRESET_DEPENDENCY_ID = "cp36-live-preset-guides";
const LIVE_BUILD_DEPENDENCY_ID = "cp36-live-build-records";
const LIVE_CHARACTER_BUILDS_DEPENDENCY_ID = "cp36-live-character-build-ids";
const LIVE_CHARACTER_WEAPONS_DEPENDENCY_ID = "cp36-live-character-weapon-ids";
const MANUAL_INDEX_DEPENDENCY_ID = "cp36-manual-index-entry";
const SOURCE_REGISTRY_DEPENDENCY_ID = "cp36-source-registry-entries";
const EVIDENCE_CAPABILITY_DEPENDENCY_ID = "cp36-evidence-capability";
const EVIDENCE_TEAM_DEPENDENCY_ID = "cp36-evidence-team-target";
const EVIDENCE_CLAIM_DEPENDENCY_ID = "cp36-evidence-claims";
const WEAPON_COVERAGE_DEPENDENCY_ID = "cp36-weapon-coverage";
const ARTIFACT_COVERAGE_DEPENDENCY_ID = "cp36-artifact-coverage";

const CAPABILITY_KEY = "keqing-lunar-equipment-evidence-capability";
const EXACT_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const RAW_TEAM_ID =
  "keqing-ineffa-furina-xilonen-lunar-charged-example";
const KQM_WEAPON_GUIDE_ID =
  "kqm:character-guide:keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const RAW_KQM_WEAPON_GUIDE_ID =
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i";
const KQM_ARTIFACT_GUIDE_ID =
  "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i";
const RAW_KQM_ARTIFACT_GUIDE_ID =
  "keqing-lunar-charged-top-contributor-artifact-options-luna-i";
const PRESET_CHARACTER_IDS = ["ineffa", "furina", "xilonen"] as const;
const PRESET_GUIDE_IDS = PRESET_CHARACTER_IDS.map(
  (characterId) => `genshintools-presets:character-guide:${characterId}`,
);

const EVIDENCE_CLAIM_IDS = [
  `${KQM_WEAPON_GUIDE_ID}:weapon:0:0`,
  `${KQM_WEAPON_GUIDE_ID}:weapon:0:1`,
  `${KQM_WEAPON_GUIDE_ID}:weapon:1:0`,
  `${KQM_ARTIFACT_GUIDE_ID}:artifact:0:0`,
  `${KQM_ARTIFACT_GUIDE_ID}:artifact:0:1`,
] as const;

const WEAPON_OBSERVATION_IDS = [
  `${KQM_WEAPON_GUIDE_ID}:recommendation:lunar-charged-equal-refinement-four-star-ranking:weapon-group:0:0`,
  `${KQM_WEAPON_GUIDE_ID}:recommendation:lunar-charged-equal-refinement-four-star-ranking:weapon-group:0:1`,
  `${KQM_WEAPON_GUIDE_ID}:recommendation:lunar-charged-equal-refinement-four-star-ranking:weapon-group:1:0`,
  "genshintools-presets:character-guide:furina:weapon-order:0",
  "genshintools-presets:character-guide:furina:weapon-order:1",
  "genshintools-presets:character-guide:furina:weapon-order:2",
  "genshintools-presets:character-guide:ineffa:weapon-order:0",
  "genshintools-presets:character-guide:xilonen:weapon-order:0",
] as const;

const ARTIFACT_OBSERVATION_IDS = [
  `${KQM_ARTIFACT_GUIDE_ID}:recommendation:lunar-charged-top-contributor-artifact-options:0:0`,
  `${KQM_ARTIFACT_GUIDE_ID}:recommendation:lunar-charged-top-contributor-artifact-options:0:1`,
  "genshintools-presets:character-guide:furina:build:BQAI0BO",
  "genshintools-presets:character-guide:furina:build:BQA4H1m",
  "genshintools-presets:character-guide:furina:build:BOfjRIm",
  "genshintools-presets:character-guide:ineffa:build:FeFiQU8",
  "genshintools-presets:character-guide:ineffa:build:FeFi2JG",
  "genshintools-presets:character-guide:ineffa:build:FeFbxRe",
  "genshintools-presets:character-guide:ineffa:build:FeFQVGG",
  "genshintools-presets:character-guide:xilonen:build:Dbt0Wkm",
  "genshintools-presets:character-guide:xilonen:build:Dbspw5m",
  "genshintools-presets:character-guide:xilonen:build:Dbt0reG",
] as const;

const BUILD_IDS_BY_CHARACTER = {
  ineffa: ["FeFiQU8", "FeFi2JG", "FeFbxRe", "FeFQVGG"],
  furina: ["BQAI0BO", "BQA4H1m", "BOfjRIm"],
  xilonen: ["Dbt0Wkm", "Dbspw5m", "Dbt0reG"],
} as const;
const LIVE_BUILD_IDS = PRESET_CHARACTER_IDS.flatMap((characterId) => [
  ...BUILD_IDS_BY_CHARACTER[characterId],
]);

const RAW_REPOSITORY_PARITY_ADAPTER_ID =
  "cp36-raw-repository-record-parity-v1";
const PRESET_REPOSITORY_PARITY_ADAPTER_ID =
  "cp36-preset-repository-guide-parity-v1";
const PRESET_LIVE_PARITY_ADAPTER_ID =
  "cp36-preset-live-guide-parity-v1";
const EVIDENCE_COVERAGE_PARITY_ADAPTER_ID =
  "cp36-evidence-coverage-reference-parity-v1";

export const KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION =
  Object.freeze({
    scopeId: "keqing-ineffa-furina-xilonen-equipment-candidate-lattice-v1",
    manifestSha256:
      "696b2c4c1e0ffee57eb35f9cd4f055bf2d5ebb8a4b28e85629167860500f2b80",
    scopeProjectionSha256:
      "0cf0bcfe97370ad607ba0837d2fdf3015f73304059aed6e8e018fe68bfdcb3d6",
  });

export type KeqingIneffaFurinaXilonenEquipmentScopeInput = {
  repository: KnowledgeRepository;
  kqmSnapshot: ManualObservationSnapshot;
  genshinToolsSnapshot: GenshinToolsPresetSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
  liveBuildPreset: unknown;
  evidenceReport: KeqingLunarEquipmentEvidenceValidationReport;
  weaponCoverageReport: WeaponChoiceSearchCoverageReport;
  artifactCoverageReport: ArtifactChoiceSearchCoverageReport;
};

type ManualRecord = ManualObservationSnapshot["records"][number];
type PresetGuide = GenshinToolsPresetSnapshot["characterGuides"][number];
type EvidenceClaim =
  KeqingLunarEquipmentEvidenceValidationReport["claims"][number];
type EvidenceTeam =
  KeqingLunarEquipmentEvidenceValidationReport["publishedTeamBoundary"]["targets"][number];
type ArtifactObservation = ArtifactChoiceSearchCoverageReport["observations"][number];

export type AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope = {
  audit: ScopedSemanticDependencyAcceptedAudit;
  repositoryRecords: readonly KnowledgeRecord[];
  rawKqmRecords: readonly ManualRecord[];
  presetSnapshotGuides: readonly PresetGuide[];
  livePresetGuides: readonly PresetGuide[];
  manualIndexEntry: ManualSnapshotIndex["snapshots"][number];
  sourceRegistryEntries: readonly SourceRegistry["sources"][number][];
  evidence: {
    capability: ReturnType<typeof projectEvidenceCapability>;
    exactTeam: EvidenceTeam;
    claims: readonly ReturnType<typeof projectEvidenceClaim>[];
  };
  coverage: {
    weapons: readonly WeaponChoiceSearchCoverageObservation[];
    artifacts: readonly ArtifactObservation[];
  };
};

export type CompactKeqingIneffaFurinaXilonenEquipmentScopeAudit = {
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

export function deriveKeqingIneffaFurinaXilonenEquipmentScopeCandidate(
  input: KeqingIneffaFurinaXilonenEquipmentScopeInput,
): ScopedSemanticDependencyCandidateDerivationResult {
  const authenticationInput = buildAuthenticationInput(input);
  return deriveScopedSemanticDependencyCandidate({
    manifest: authenticationInput.manifest,
    dependencies: authenticationInput.dependencies,
    parityAdapters: authenticationInput.parityAdapters,
  });
}

export function authenticateKeqingIneffaFurinaXilonenEquipmentScope(
  input: KeqingIneffaFurinaXilonenEquipmentScopeInput,
): ScopedSemanticDependencyAuthenticationResult {
  return authenticateScopedSemanticDependencies(buildAuthenticationInput(input));
}

export function requireKeqingIneffaFurinaXilonenEquipmentScope(
  input: KeqingIneffaFurinaXilonenEquipmentScopeInput,
): AuthenticatedKeqingIneffaFurinaXilonenEquipmentScope {
  const result = authenticateKeqingIneffaFurinaXilonenEquipmentScope(input);
  if (result.status !== "accepted") {
    throw new Error(
      `CP36 equipment semantic scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const repositoryRecords = selectedPayloads(
    result.selection,
    REPOSITORY_DEPENDENCY_ID,
  ).map((payload) => KnowledgeRecordSchema.parse(payload));
  const rawKqmRecords = selectedPayloads(
    result.selection,
    RAW_KQM_DEPENDENCY_ID,
  ).map((payload) => ManualObservationRecordSchema.parse(payload));
  const presetSnapshotGuides = selectedPayloads(
    result.selection,
    PRESET_SNAPSHOT_DEPENDENCY_ID,
  ).map((payload) => PresetCharacterGuideRecordSchema.parse(payload));
  const livePresetGuides = selectedPayloads(
    result.selection,
    LIVE_PRESET_DEPENDENCY_ID,
  ).map((payload) => PresetCharacterGuideRecordSchema.parse(payload));
  const sourceRegistryEntries = selectedPayloads(
    result.selection,
    SOURCE_REGISTRY_DEPENDENCY_ID,
  ).map((payload) => SourceManifestSchema.parse(payload));

  return {
    audit: result.audit,
    repositoryRecords,
    rawKqmRecords,
    presetSnapshotGuides,
    livePresetGuides,
    manualIndexEntry: ManualIndexEntrySchema.parse(
      selectedPayload(
        result.selection,
        MANUAL_INDEX_DEPENDENCY_ID,
        KQM_SNAPSHOT_PATH,
      ),
    ),
    sourceRegistryEntries,
    evidence: {
      capability: structuredClone(
        selectedPayload(
          result.selection,
          EVIDENCE_CAPABILITY_DEPENDENCY_ID,
          CAPABILITY_KEY,
        ),
      ) as ReturnType<typeof projectEvidenceCapability>,
      exactTeam: structuredClone(
        selectedPayload(
          result.selection,
          EVIDENCE_TEAM_DEPENDENCY_ID,
          EXACT_TEAM_ID,
        ),
      ) as EvidenceTeam,
      claims: EVIDENCE_CLAIM_IDS.map(
        (claimId) =>
          structuredClone(
            selectedPayload(
              result.selection,
              EVIDENCE_CLAIM_DEPENDENCY_ID,
              claimId,
            ),
          ) as ReturnType<typeof projectEvidenceClaim>,
      ),
    },
    coverage: {
      weapons: WEAPON_OBSERVATION_IDS.map(
        (observationId) =>
          structuredClone(
            selectedPayload(
              result.selection,
              WEAPON_COVERAGE_DEPENDENCY_ID,
              observationId,
            ),
          ) as WeaponChoiceSearchCoverageObservation,
      ),
      artifacts: ARTIFACT_OBSERVATION_IDS.map(
        (observationId) =>
          structuredClone(
            selectedPayload(
              result.selection,
              ARTIFACT_COVERAGE_DEPENDENCY_ID,
              observationId,
            ),
          ) as ArtifactObservation,
      ),
    },
  };
}

export function compactKeqingIneffaFurinaXilonenEquipmentScopeAudit(
  audit: ScopedSemanticDependencyAcceptedAudit,
): CompactKeqingIneffaFurinaXilonenEquipmentScopeAudit {
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
      normalizedPairDigestSha256: digestParityPairs(audit),
    },
  };
}

/** Exposed for adversarial tests proving selector identity is pin-bound. */
export function buildKeqingIneffaFurinaXilonenEquipmentScopeAuthenticationInput(
  input: KeqingIneffaFurinaXilonenEquipmentScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  return buildAuthenticationInput(input);
}

function buildAuthenticationInput(
  input: KeqingIneffaFurinaXilonenEquipmentScopeInput,
): ScopedSemanticDependencyAuthenticationInput {
  const live = projectLivePresetInput(input.liveBuildPreset);
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
          projectionAdapterId: "cp36-repository-record-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: KQM_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: KQM_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "snapshot-envelope-path-v1",
        records: [
          {
            path: KQM_SNAPSHOT_PATH,
            schemaVersion: input.kqmSnapshot.schemaVersion,
            sourceId: input.kqmSnapshot.sourceId,
          },
        ],
        adapter: {
          projectionAdapterId: "cp36-kqm-snapshot-envelope-v1",
          keyOf: ({ path }) => path,
          project: ({ schemaVersion, sourceId }) => ({
            schemaVersion,
            sourceId,
          }),
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: RAW_KQM_DEPENDENCY_ID,
        containerPath: KQM_SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        records: input.kqmSnapshot.records,
        adapter: {
          projectionAdapterId: "cp36-raw-kqm-record-v1",
          keyOf: manualSourceRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "snapshot-envelope-path-v1",
        records: [
          {
            path: PRESET_SNAPSHOT_PATH,
            schemaVersion: input.genshinToolsSnapshot.schemaVersion,
            sourceId: input.genshinToolsSnapshot.sourceId,
          },
        ],
        adapter: {
          projectionAdapterId: "cp36-preset-snapshot-envelope-v1",
          keyOf: ({ path }) => path,
          project: ({ schemaVersion, sourceId }) => ({
            schemaVersion,
            sourceId,
          }),
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: PRESET_SNAPSHOT_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides",
        keySchemaId: "preset-character-id-v1",
        records: input.genshinToolsSnapshot.characterGuides,
        adapter: {
          projectionAdapterId: "cp36-preset-snapshot-guide-v1",
          keyOf: ({ characterId }) => characterId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_PRESET_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath:
          "/derivedCharacterGuides(/builds,/characterBuilds,/characterWeapons)",
        keySchemaId: "preset-character-id-v1",
        records: live.guides,
        adapter: {
          projectionAdapterId: "cp36-live-preset-guide-v1",
          keyOf: ({ characterId }) => characterId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_BUILD_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/builds",
        keySchemaId: "live-build-id-v1",
        records: live.buildRecords,
        adapter: {
          projectionAdapterId: "cp36-live-build-record-v1",
          keyOf: (record) => requiredStringField(record, "id", "live build"),
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_CHARACTER_BUILDS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterBuilds",
        keySchemaId: "preset-character-id-v1",
        records: live.characterBuildRows,
        adapter: {
          projectionAdapterId: "cp36-live-character-build-ids-v1",
          keyOf: ({ characterId }) => characterId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: LIVE_CHARACTER_WEAPONS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterWeapons",
        keySchemaId: "preset-character-id-v1",
        records: live.characterWeaponRows,
        adapter: {
          projectionAdapterId: "cp36-live-character-weapon-ids-v1",
          keyOf: ({ characterId }) => characterId,
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
          projectionAdapterId: "cp36-manual-index-entry-v1",
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
          projectionAdapterId: "cp36-source-manifest-v1",
          keyOf: ({ id }) => id,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_CAPABILITY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp36-capability-key-v1",
        records: [input.evidenceReport],
        adapter: {
          projectionAdapterId: "cp36-evidence-capability-v1",
          keyOf: () => CAPABILITY_KEY,
          project: projectEvidenceCapability,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_TEAM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/publishedTeamBoundary/targets",
        keySchemaId: "equipment-team-record-id-v1",
        records: input.evidenceReport.publishedTeamBoundary.targets,
        adapter: {
          projectionAdapterId: "cp36-evidence-team-target-v1",
          keyOf: ({ teamRecordId }) => teamRecordId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        records: input.evidenceReport.claims,
        adapter: {
          projectionAdapterId: "cp36-evidence-exact-team-claim-v1",
          keyOf: ({ claimId }) => claimId,
          project: projectEvidenceClaim,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: WEAPON_COVERAGE_DEPENDENCY_ID,
        containerPath: WEAPON_COVERAGE_PATH,
        collectionPath: "/observations",
        keySchemaId: "weapon-coverage-observation-id-v1",
        records: input.weaponCoverageReport.observations,
        adapter: {
          projectionAdapterId: "cp36-weapon-coverage-observation-v1",
          keyOf: ({ observationId }) => observationId,
          project: (record) => record,
        },
      }),
      defineScopedSemanticDependencyInput({
        dependencyId: ARTIFACT_COVERAGE_DEPENDENCY_ID,
        containerPath: ARTIFACT_COVERAGE_PATH,
        collectionPath: "/observations",
        keySchemaId: "artifact-coverage-observation-id-v1",
        records: input.artifactCoverageReport.observations,
        adapter: {
          projectionAdapterId: "cp36-artifact-coverage-observation-v1",
          keyOf: ({ observationId }) => observationId,
          project: (record) => record,
        },
      }),
    ],
    parityAdapters: [
      {
        parityAdapterId: RAW_REPOSITORY_PARITY_ADAPTER_ID,
        normalize: normalizeRawRepositoryParity,
      },
      {
        parityAdapterId: PRESET_REPOSITORY_PARITY_ADAPTER_ID,
        normalize: normalizePresetRepositoryParity,
      },
      {
        parityAdapterId: PRESET_LIVE_PARITY_ADAPTER_ID,
        normalize: ({ payload }) => payload,
      },
      {
        parityAdapterId: EVIDENCE_COVERAGE_PARITY_ADAPTER_ID,
        normalize: normalizeEvidenceCoverageParity,
      },
    ],
    expectation: {
      ...KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION,
    },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  const rawRepositoryPairs = [
    [RAW_TEAM_ID, EXACT_TEAM_ID],
    [RAW_KQM_WEAPON_GUIDE_ID, KQM_WEAPON_GUIDE_ID],
    [RAW_KQM_ARTIFACT_GUIDE_ID, KQM_ARTIFACT_GUIDE_ID],
  ] as const;
  return {
    schemaVersion: 1,
    scopeId: KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_SCOPE_EXPECTATION.scopeId,
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
        projectionAdapterId: "cp36-repository-record-v1",
        requiredKeys: [
          EXACT_TEAM_ID,
          KQM_WEAPON_GUIDE_ID,
          KQM_ARTIFACT_GUIDE_ID,
          ...PRESET_GUIDE_IDS,
        ],
      },
      {
        dependencyId: KQM_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: KQM_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "snapshot-envelope-path-v1",
        projectionAdapterId: "cp36-kqm-snapshot-envelope-v1",
        requiredKeys: [KQM_SNAPSHOT_PATH],
      },
      {
        dependencyId: RAW_KQM_DEPENDENCY_ID,
        containerPath: KQM_SNAPSHOT_PATH,
        collectionPath: "/records",
        keySchemaId: "manual-source-record-id-v1",
        projectionAdapterId: "cp36-raw-kqm-record-v1",
        requiredKeys: [
          RAW_TEAM_ID,
          RAW_KQM_WEAPON_GUIDE_ID,
          RAW_KQM_ARTIFACT_GUIDE_ID,
        ],
      },
      {
        dependencyId: PRESET_SNAPSHOT_ENVELOPE_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/",
        keySchemaId: "snapshot-envelope-path-v1",
        projectionAdapterId: "cp36-preset-snapshot-envelope-v1",
        requiredKeys: [PRESET_SNAPSHOT_PATH],
      },
      {
        dependencyId: PRESET_SNAPSHOT_DEPENDENCY_ID,
        containerPath: PRESET_SNAPSHOT_PATH,
        collectionPath: "/characterGuides",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp36-preset-snapshot-guide-v1",
        requiredKeys: [...PRESET_CHARACTER_IDS],
      },
      {
        dependencyId: LIVE_PRESET_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath:
          "/derivedCharacterGuides(/builds,/characterBuilds,/characterWeapons)",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp36-live-preset-guide-v1",
        requiredKeys: [...PRESET_CHARACTER_IDS],
      },
      {
        dependencyId: LIVE_BUILD_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/builds",
        keySchemaId: "live-build-id-v1",
        projectionAdapterId: "cp36-live-build-record-v1",
        requiredKeys: [...LIVE_BUILD_IDS],
      },
      {
        dependencyId: LIVE_CHARACTER_BUILDS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterBuilds",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp36-live-character-build-ids-v1",
        requiredKeys: [...PRESET_CHARACTER_IDS],
      },
      {
        dependencyId: LIVE_CHARACTER_WEAPONS_DEPENDENCY_ID,
        containerPath: LIVE_PRESET_PATH,
        collectionPath: "/characterWeapons",
        keySchemaId: "preset-character-id-v1",
        projectionAdapterId: "cp36-live-character-weapon-ids-v1",
        requiredKeys: [...PRESET_CHARACTER_IDS],
      },
      {
        dependencyId: MANUAL_INDEX_DEPENDENCY_ID,
        containerPath: MANUAL_INDEX_PATH,
        collectionPath: "/snapshots",
        keySchemaId: "manual-snapshot-path-v1",
        projectionAdapterId: "cp36-manual-index-entry-v1",
        requiredKeys: [KQM_SNAPSHOT_PATH],
      },
      {
        dependencyId: SOURCE_REGISTRY_DEPENDENCY_ID,
        containerPath: SOURCE_REGISTRY_PATH,
        collectionPath: "/sources",
        keySchemaId: "source-manifest-id-v1",
        projectionAdapterId: "cp36-source-manifest-v1",
        requiredKeys: ["kqm", "genshintools-presets"],
      },
      {
        dependencyId: EVIDENCE_CAPABILITY_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/",
        keySchemaId: "cp36-capability-key-v1",
        projectionAdapterId: "cp36-evidence-capability-v1",
        requiredKeys: [CAPABILITY_KEY],
      },
      {
        dependencyId: EVIDENCE_TEAM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/publishedTeamBoundary/targets",
        keySchemaId: "equipment-team-record-id-v1",
        projectionAdapterId: "cp36-evidence-team-target-v1",
        requiredKeys: [EXACT_TEAM_ID],
      },
      {
        dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
        containerPath: EVIDENCE_REPORT_PATH,
        collectionPath: "/claims",
        keySchemaId: "equipment-claim-id-v1",
        projectionAdapterId: "cp36-evidence-exact-team-claim-v1",
        requiredKeys: [...EVIDENCE_CLAIM_IDS],
      },
      {
        dependencyId: WEAPON_COVERAGE_DEPENDENCY_ID,
        containerPath: WEAPON_COVERAGE_PATH,
        collectionPath: "/observations",
        keySchemaId: "weapon-coverage-observation-id-v1",
        projectionAdapterId: "cp36-weapon-coverage-observation-v1",
        requiredKeys: [...WEAPON_OBSERVATION_IDS],
      },
      {
        dependencyId: ARTIFACT_COVERAGE_DEPENDENCY_ID,
        containerPath: ARTIFACT_COVERAGE_PATH,
        collectionPath: "/observations",
        keySchemaId: "artifact-coverage-observation-id-v1",
        projectionAdapterId: "cp36-artifact-coverage-observation-v1",
        requiredKeys: [...ARTIFACT_OBSERVATION_IDS],
      },
    ],
    parities: [
      ...rawRepositoryPairs.map(([rawId, repositoryId]) => ({
        parityId: `raw-repository:${rawId}`,
        parityAdapterId: RAW_REPOSITORY_PARITY_ADAPTER_ID,
        left: { dependencyId: RAW_KQM_DEPENDENCY_ID, key: rawId },
        right: {
          dependencyId: REPOSITORY_DEPENDENCY_ID,
          key: repositoryId,
        },
      })),
      ...PRESET_CHARACTER_IDS.flatMap((characterId) => [
        {
          parityId: `preset-repository:${characterId}`,
          parityAdapterId: PRESET_REPOSITORY_PARITY_ADAPTER_ID,
          left: {
            dependencyId: PRESET_SNAPSHOT_DEPENDENCY_ID,
            key: characterId,
          },
          right: {
            dependencyId: REPOSITORY_DEPENDENCY_ID,
            key: `genshintools-presets:character-guide:${characterId}`,
          },
        },
        {
          parityId: `preset-live:${characterId}`,
          parityAdapterId: PRESET_LIVE_PARITY_ADAPTER_ID,
          left: {
            dependencyId: PRESET_SNAPSHOT_DEPENDENCY_ID,
            key: characterId,
          },
          right: {
            dependencyId: LIVE_PRESET_DEPENDENCY_ID,
            key: characterId,
          },
        },
      ]),
      ...EVIDENCE_CLAIM_IDS.map((claimId, index) => ({
        parityId: `evidence-coverage:${claimId}`,
        parityAdapterId: EVIDENCE_COVERAGE_PARITY_ADAPTER_ID,
        left: {
          dependencyId: EVIDENCE_CLAIM_DEPENDENCY_ID,
          key: claimId,
        },
        right: {
          dependencyId:
            index < 3
              ? WEAPON_COVERAGE_DEPENDENCY_ID
              : ARTIFACT_COVERAGE_DEPENDENCY_ID,
          key:
            index < 3
              ? WEAPON_OBSERVATION_IDS[index]
              : ARTIFACT_OBSERVATION_IDS[index - 3],
        },
      })),
    ],
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
  };
}

function projectEvidenceClaim(claim: EvidenceClaim) {
  const teamResolutions = claim.teamResolutions.filter(
    ({ teamRecordId }) => teamRecordId === EXACT_TEAM_ID,
  );
  if (teamResolutions.length !== 1) {
    throw new Error(
      `CP36 evidence claim ${claim.claimId} must have exactly one exact-team resolution.`,
    );
  }
  return {
    claimId: claim.claimId,
    repositoryRecordId: claim.repositoryRecordId,
    sourceRecordId: claim.sourceRecordId,
    recommendationId: claim.recommendationId,
    recommendationScope: claim.recommendationScope,
    roles: claim.roles,
    sourceClaim: claim.sourceClaim,
    sourceConditions: claim.sourceConditions,
    conditionMappingKind: claim.conditionMappingKind,
    allSourceConditionsMappedExactly: claim.allSourceConditionsMappedExactly,
    exactTeamResolution: teamResolutions[0],
    searchCoverage: claim.searchCoverage,
  };
}

function normalizeRawRepositoryParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  const value = jsonObject(payload);
  if (dependencyId === RAW_KQM_DEPENDENCY_ID) {
    if (value.kind === "team") return normalizeRawTeam(value);
    if (value.kind === "character_guide") {
      return {
        sourceRecordId: value.sourceRecordId,
        characterId: value.characterId,
        recommendation: value.recommendation,
      };
    }
  }
  if (dependencyId === REPOSITORY_DEPENDENCY_ID) {
    if (value.kind === "team") return normalizeRepositoryTeam(value);
    if (value.kind === "character_guide") {
      const recommendations = value.recommendations;
      if (!Array.isArray(recommendations) || recommendations.length !== 1) {
        throw new Error("CP36 repository KQM guide must have one recommendation.");
      }
      return {
        sourceRecordId: exactKqmSourceRecordId(value),
        characterId: value.characterId,
        recommendation: recommendations[0],
      };
    }
  }
  throw new Error(`Unexpected CP36 raw/repository parity input ${dependencyId}.`);
}

function normalizeRawTeam(value: Record<string, ScopedSemanticJsonValue>) {
  const members = requiredJsonArray(value.members, "raw team members");
  return {
    sourceRecordId: value.sourceRecordId,
    label: value.label,
    intent: value.intent,
    rankingClaim: value.rankingClaim,
    reactions: value.reactions,
    rotations: value.rotations,
    members: members.map((member) => jsonObject(member).characterId),
  };
}

function normalizeRepositoryTeam(value: Record<string, ScopedSemanticJsonValue>) {
  const members = requiredJsonArray(value.members, "repository team members");
  return {
    sourceRecordId: exactKqmSourceRecordId(value),
    label: value.label,
    intent: value.intent,
    rankingClaim: value.rankingClaim,
    reactions: value.reactions,
    rotations: value.rotations,
    members: members.map((member) => jsonObject(member).characterId),
  };
}

function normalizePresetRepositoryParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  if (dependencyId === PRESET_SNAPSHOT_DEPENDENCY_ID) return payload;
  if (dependencyId !== REPOSITORY_DEPENDENCY_ID) {
    throw new Error(`Unexpected CP36 preset parity input ${dependencyId}.`);
  }
  const guide = jsonObject(payload);
  const sourceRefs = requiredJsonArray(guide.sourceRefs, "preset sourceRefs");
  if (sourceRefs.length !== 1) {
    throw new Error("CP36 repository preset guide must have one sourceRef.");
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

function normalizeEvidenceCoverageParity({
  dependencyId,
  payload,
}: {
  dependencyId: string;
  key: string;
  payload: ScopedSemanticJsonValue;
}): unknown {
  const value = jsonObject(payload);
  if (dependencyId === EVIDENCE_CLAIM_DEPENDENCY_ID) {
    return value.searchCoverage;
  }
  if (dependencyId === WEAPON_COVERAGE_DEPENDENCY_ID) {
    const weaponDomain = jsonObject(value.weaponIdDomain);
    const compatibility = jsonObject(value.nativeTypeCompatibility);
    const refinement = jsonObject(value.refinementCoverage);
    return {
      candidateRefinements: weaponDomain.candidateRefinements,
      kind: "weapon-search-coverage",
      nativeTypeCompatibilityOutcome: compatibility.outcome,
      observationId: value.observationId,
      refinementCoverageOutcome: refinement.outcome,
      weaponIdDomainOutcome: weaponDomain.outcome,
    };
  }
  if (dependencyId === ARTIFACT_COVERAGE_DEPENDENCY_ID) {
    return {
      failureReason: value.failureReason ?? null,
      kind: "artifact-search-coverage",
      observationId: value.observationId,
      outcome: value.outcome,
    };
  }
  throw new Error(`Unexpected CP36 evidence/coverage parity input ${dependencyId}.`);
}

function projectLivePresetInput(input: unknown): {
  guides: PresetGuide[];
  buildRecords: Record<string, unknown>[];
  characterBuildRows: Array<{ characterId: string; buildIds: string[] }>;
  characterWeaponRows: Array<{ characterId: string; weaponIds: string[] }>;
} {
  const live = requiredRecord(input, "live preset");
  const builds = requiredRecord(live.builds, "live preset builds");
  const characterBuilds = requiredRecord(
    live.characterBuilds,
    "live preset characterBuilds",
  );
  const characterWeapons = requiredRecord(
    live.characterWeapons,
    "live preset characterWeapons",
  );
  const characterBuildRows = PRESET_CHARACTER_IDS.map((characterId) => ({
    characterId,
    buildIds: requiredStringArray(
      characterBuilds[characterId],
      `live characterBuilds.${characterId}`,
    ),
  }));
  const characterWeaponRows = PRESET_CHARACTER_IDS.map((characterId) => ({
    characterId,
    weaponIds: requiredStringArray(
      characterWeapons[characterId],
      `live characterWeapons.${characterId}`,
    ),
  }));
  const guides = PRESET_CHARACTER_IDS.map((characterId) => {
    const buildIds = requiredStringArray(
      characterBuilds[characterId],
      `live characterBuilds.${characterId}`,
    );
    const expectedIds = BUILD_IDS_BY_CHARACTER[characterId];
    if (JSON.stringify(buildIds) !== JSON.stringify(expectedIds)) {
      // Keep the observed row so the scoped digest provides the rejection. The
      // explicit check only prevents silently materializing missing build data.
      for (const buildId of buildIds) {
        if (!(buildId in builds)) {
          throw new Error(`Missing live build ${buildId} for ${characterId}.`);
        }
      }
    }
    return PresetCharacterGuideRecordSchema.parse({
      builds: buildIds.map((buildId) => projectLiveBuild(builds[buildId], buildId)),
      characterId,
      kind: "character_guide",
      locator: { file: LIVE_PRESET_PATH, recordId: characterId },
      sourceRecordId: characterId,
      unknowns: [
        "team applicability",
        "weapon refinement assumptions",
        "ER floors",
        "formula counts",
      ],
      weaponOrder: requiredStringArray(
        characterWeapons[characterId],
        `live characterWeapons.${characterId}`,
      ),
    });
  });
  return {
    guides,
    buildRecords: Object.values(builds).map((build, index) =>
      requiredRecord(build, `live preset builds[${index}]`),
    ),
    characterBuildRows,
    characterWeaponRows,
  };
}

function projectLiveBuild(input: unknown, expectedBuildId: string) {
  const build = requiredRecord(input, `live build ${expectedBuildId}`);
  if (build.id !== expectedBuildId) {
    throw new Error(`Live build ${expectedBuildId} changed embedded identity.`);
  }
  const composition = String(build.composition ?? "");
  const artifact =
    composition === "4pc"
      ? { type: "4pc" as const, setId: String(build.artifactSet ?? "") }
      : {
          type: "2pc+2pc" as const,
          halfSetIds: [
            String(build.halfSet1 ?? ""),
            String(build.halfSet2 ?? ""),
          ] as [string, string],
        };
  return {
    artifact,
    circlet: build.circletWeights,
    goblet: build.gobletWeights,
    ...(typeof build.name === "string" && build.name.length > 0
      ? { name: build.name }
      : {}),
    ...(typeof build.minCons === "number"
      ? { minConstellation: build.minCons }
      : {}),
    roles: build.roles,
    sands: build.sandsWeights,
    sourceRecordId: build.id,
    styles: build.styles,
    substats: build.substats,
    visible: build.visible,
  };
}

function exactKqmSourceRecordId(
  record: Record<string, ScopedSemanticJsonValue>,
): ScopedSemanticJsonValue {
  const refs = requiredJsonArray(record.sourceRefs, "KQM sourceRefs");
  const matches = refs
    .map((ref) => jsonObject(ref))
    .filter((ref) => ref.sourceId === "kqm");
  if (matches.length !== 1) {
    throw new Error("CP36 repository KQM record must have one KQM sourceRef.");
  }
  return matches[0].sourceRecordId;
}

function manualSourceRecordId(record: ManualRecord): string {
  return record.sourceRecordId;
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
      `CP36 semantic selection expected one ${dependencyId}, found ${matches.length}.`,
    );
  }
  return matches[0].entries.map(({ payload }) => payload);
}

function selectedPayload(
  selection: ScopedSemanticDependencySelection,
  dependencyId: string,
  key: string,
): ScopedSemanticJsonValue {
  const dependency = selection.dependencies.find(
    (candidate) => candidate.dependencyId === dependencyId,
  );
  if (!dependency) {
    throw new Error(`CP36 semantic selection omitted ${dependencyId}.`);
  }
  const matches = dependency.entries.filter((entry) => entry.key === key);
  if (matches.length !== 1) {
    throw new Error(
      `CP36 semantic selection expected one ${dependencyId}/${key}, found ${matches.length}.`,
    );
  }
  return matches[0].payload;
}

function digestParityPairs(
  audit: ScopedSemanticDependencyAcceptedAudit,
): string {
  return sha256Text(
    stableJson(
      audit.parities.map((parity) => ({
        parityId: parity.parityId,
        status: parity.status,
        leftNormalizedSha256: parity.leftNormalizedSha256,
        rightNormalizedSha256: parity.rightNormalizedSha256,
      })),
    ),
  );
}

function jsonObject(
  value: ScopedSemanticJsonValue,
): Record<string, ScopedSemanticJsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CP36 parity payload is not an object.");
  }
  return value as Record<string, ScopedSemanticJsonValue>;
}

function requiredJsonArray(
  value: ScopedSemanticJsonValue | undefined,
  label: string,
): readonly ScopedSemanticJsonValue[] {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array.`);
  return value;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${label} is not a string array.`);
  }
  return [...value];
}

function requiredStringField(
  value: unknown,
  field: string,
  label: string,
): string {
  const record = requiredRecord(value, label);
  const selected = record[field];
  if (typeof selected !== "string" || selected.length === 0) {
    throw new Error(`${label}.${field} is not a non-empty string.`);
  }
  return selected;
}

const ManualIndexEntrySchema = z
  .object({ sourceId: z.string().min(1), path: z.string().min(1) })
  .strict();
