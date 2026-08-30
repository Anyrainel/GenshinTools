import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { characters } from "@/data/resources";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  buildArtifactChoiceSearchCoverageReport,
} from "./artifactChoiceSearchCoverage";
import {
  buildCharacterGuideInputCoverageReport,
  buildReleasedGuideDomainCatalog,
  CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS,
  CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS,
} from "./characterGuideInputCoverage";
import { loadGameCatalogs } from "./catalogs";
import {
  buildDionaComparisonReport,
  DIONA_COMPARISON_INPUT_PATHS,
} from "./comparison";
import { consolidateKnowledge } from "./consolidation";
import {
  buildKnowledgeCorpusInventoryReport,
  KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS,
} from "./corpusInventory";
import {
  buildDionaErCalibrationReport,
  DIONA_ER_ENGINE_INPUT_PATHS,
} from "./dionaErCalibration";
import {
  authenticateDionaSourceLocalSupportSliceReport,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  type DionaSourceLocalSupportSliceReport,
} from "./dionaSourceLocalSupportSlice";
import {
  buildDerivedFormulaFixtureCoverageReport,
  DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS,
  DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS,
  DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS,
  DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
} from "./derivedFormulaFixtureCoverage";
import {
  buildFurinaNeuvilletteFormulaDraftReport,
  FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS,
} from "./furinaNeuvilletteFormulaDraft";
import {
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS,
  runFurinaSourceScopedRoleSample,
} from "./furinaSourceScopedRoleSample";
import {
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
  runKeqingSourceScopedRolePairSample,
} from "./keqingSourceScopedRolePairSample";
import {
  buildKeqingLunarEquipmentEvidenceValidationReport,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
} from "./keqingLunarEquipmentEvidenceValidation";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyAudit";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyRobustnessCensus";
import {
  buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import {
  buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
} from "./keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import {
  buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import {
  buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
} from "./keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import {
  authenticateKleeSourceLocalConditionSliceReport,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  type KleeSourceLocalConditionSliceReport,
} from "./kleeSourceLocalConditionSlice";
import {
  authenticateKleeTeamScopedClaimJoinWitnessReport,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS,
  type KleeTeamScopedClaimJoinWitnessReport,
} from "./kleeTeamScopedClaimJoinWitness";
import {
  authenticateKokomiSourceLocalArtifactSliceReport,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  type KokomiSourceLocalArtifactSliceReport,
} from "./kokomiSourceLocalArtifactSlice";
import {
  authenticateNoelleSourceLocalHighInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import {
  authenticateNoelleSourceLocalLowerInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "./noelleSourceLocalLowerInvestmentSlice";
import {
  buildKeqingLunarSourceConditionedCandidateLatticeReport,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
} from "./keqingLunarSourceConditionedCandidateLattice";
import {
  buildKeqingLunarCrossRecordCompositionContractReport,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
} from "./keqingLunarCrossRecordCompositionContract";
import {
  isCompleteKeqingLunarCrossRecordTechnicalMatrixReport,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
  runKeqingLunarCrossRecordTechnicalMatrix,
  type KeqingLunarCrossRecordTechnicalMatrixInput,
} from "./keqingLunarCrossRecordTechnicalMatrix";
import {
  importGenshinToolsPresets,
  importLegacyTeamResearch,
} from "./importers";
import {
  authenticateIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
} from "./ittoSourceConditionedGuidePacket";
import {
  authenticateIttoRequestContextApplicabilityReport,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH,
  ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
  ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
  readHashedJsonSnapshot,
  type IttoRequestContextApplicabilityReport,
} from "./ittoRequestContextApplicability";
import { readJson, sha256File, stableJson } from "./io";
import {
  buildKeqingIneffaFormulaDraftReport,
  KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
} from "./keqingIneffaFormulaDraft";
import {
  buildKeqingIneffaArtifactGenerationPreflightReport,
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
} from "./keqingIneffaArtifactGenerationPreflight";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
  runKeqingIneffaArtifactGenerationTechnicalProbe,
} from "./keqingIneffaArtifactGenerationTechnicalProbe";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_INPUT_PATHS,
  runKeqingIneffaArtifactGenerationSensitivityProbe,
} from "./keqingIneffaArtifactGenerationSensitivityProbe";
import {
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
  runKeqingIneffaBoundedJointArtifactExperiment,
} from "./keqingIneffaBoundedJointArtifactExperiment";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
  runKeqingIneffaTeamStatMarginalDiagnostic,
} from "./keqingIneffaTeamStatMarginalDiagnostic";
import {
  runTeamRosterCandidateDomainExperiment,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
} from "./teamRosterCandidateDomainExperiment";
import {
  loadManualSnapshotInputs,
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "./manualSnapshots";
import {
  buildManualConditionArrayCoverageReport,
  MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
  MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH,
  MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
} from "./manualConditionArrayCoverageReport";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
  CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH,
  DERIVED_FORMULA_FIXTURE_COVERAGE_REPORT_PATH,
  DIONA_COMPARISON_REPORT_PATH,
  DIONA_ER_CALIBRATION_REPORT_PATH,
  FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH,
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH,
  GENSHINTOOLS_SNAPSHOT_PATH,
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
  KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_REPORT_PATH,
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  LEGACY_SNAPSHOT_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_TEMPLATE_COVERAGE_REPORT_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
  WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
} from "./paths";
import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  LegacyTeamSnapshotSchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "./schemas";
import type { SourceConditionedGuidePacketReport } from "./sourceConditionedGuidePacket";
import {
  formatDiagnostics,
  validateGenshinToolsSnapshot,
  validateKnowledgeRepository,
  validateLegacySnapshot,
  validateManualObservationSnapshot,
  validateManualSnapshotCollection,
  validateSourceRegistry,
  validateWorkspaceBoundary,
  type ValidationDiagnostic,
} from "./validation";
import {
  buildTeamTemplateCoverageReport,
  TEAM_TEMPLATE_COVERAGE_INPUT_PATHS,
} from "./teamTemplateCoverage";
import {
  buildWeaponChoiceSearchCoverageReport,
  WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
} from "./weaponChoiceSearchCoverage";

export interface ValidationRunResult {
  diagnostics: ValidationDiagnostic[];
  errorCount: number;
  warningCount: number;
}

export interface ValidationRunOptions {
  includeErReports?: boolean;
}

export function parseValidationCliArgs(
  args: readonly string[],
): ValidationRunOptions {
  const unsupportedArgs = args.filter((arg) => arg !== "--defer-er");
  if (unsupportedArgs.length > 0) {
    throw new Error(
      `Unsupported validation argument(s): ${unsupportedArgs.join(", ")}`,
    );
  }

  return {
    includeErReports: !args.includes("--defer-er"),
  };
}

export async function runValidation(
  options: ValidationRunOptions = {},
): Promise<ValidationRunResult> {
  const includeErReports = options.includeErReports ?? true;
  const diagnostics: ValidationDiagnostic[] = [];
  const catalogs = await loadGameCatalogs();
  const [
    registryInput,
    genshinToolsInput,
    legacyInput,
    manualIndexInput,
    knowledgeInput,
    comparisonInput,
    erCalibrationInput,
    teamTemplateCoverageInput,
    furinaNeuvilletteFormulaDraftInput,
    keqingIneffaFormulaDraftInput,
    derivedFormulaFixtureCoverageInput,
    derivedFormulaFixtureCoverageSourceFiles,
    knowledgeCorpusInventoryInput,
    characterGuideInputCoverageInput,
    characterGuideInputCoverageSourceFiles,
    artifactChoiceSearchCoverageInput,
    weaponChoiceSearchCoverageInput,
    keqingIneffaArtifactGenerationPreflightInput,
    keqingIneffaArtifactGenerationTechnicalProbeInput,
    keqingIneffaArtifactGenerationSensitivityInput,
    keqingIneffaBoundedJointArtifactExperimentInput,
    teamRosterCandidateDomainExperimentInput,
    keqingIneffaTeamStatMarginalDiagnosticInput,
    furinaSourceScopedRoleSampleInput,
    keqingSourceScopedRolePairSampleInput,
    keqingLunarEquipmentEvidenceValidationInput,
    keqingIneffaFurinaXilonenEquipmentCandidateLatticeInput,
    keqingIneffaFurinaXilonenEquipmentRuntimePreflightInput,
    keqingIneffaFurinaXilonenEquipmentTechnicalComputationInput,
    keqingIneffaFurinaXilonenGeneratedSheetEvidenceInput,
    keqingIneffaFurinaXilonenCachedPolicyAuditInput,
    keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput,
    keqingLunarSourceConditionedCandidateLatticeInput,
    keqingLunarCrossRecordCompositionContractInput,
    keqingLunarCrossRecordTechnicalMatrixInput,
    ittoSourceConditionedGuidePacketInput,
    ittoRequestContextApplicabilityInput,
    manualConditionArrayCoverageInput,
    manualConditionArrayCoverageSourceFiles,
    kleeSourceLocalConditionSliceInput,
    kleeSourceLocalConditionSliceSourceFiles,
    dionaSourceLocalSupportSliceInput,
    dionaSourceLocalSupportSliceSourceFiles,
    kokomiSourceLocalArtifactSliceInput,
    kokomiSourceLocalArtifactSliceSourceFiles,
    noelleSourceLocalHighInvestmentSliceInput,
    noelleSourceLocalHighInvestmentSliceSourceFiles,
    noelleSourceLocalLowerInvestmentSliceInput,
    noelleSourceLocalLowerInvestmentSliceSourceFiles,
    kleeTeamScopedClaimJoinWitnessInput,
    kleeTeamScopedClaimJoinWitnessSourceFiles,
  ] =
    await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(GENSHINTOOLS_SNAPSHOT_PATH),
      readJson(LEGACY_SNAPSHOT_PATH),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(DIONA_COMPARISON_REPORT_PATH),
      readJson(DIONA_ER_CALIBRATION_REPORT_PATH),
      readJson(TEAM_TEMPLATE_COVERAGE_REPORT_PATH),
      readJson(FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH),
      readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
      readJson(DERIVED_FORMULA_FIXTURE_COVERAGE_REPORT_PATH),
      Promise.all(
        DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH),
      readJson(CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH),
      Promise.all(
        CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
      readJson(WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
      readJson(KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH),
      readJson(
        KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
      ),
      readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
      readJson(KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH),
      readJson(FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH),
      readJson(KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH),
      readJson(KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
      ),
      readJson(
        KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
      ),
      readJson(
        KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
      ),
      readJson(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH),
      readJson(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH),
      readJson(ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH),
      readJson(ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH),
      readJson(MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH),
      Promise.all(
        MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
      Promise.all(
        KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH),
      Promise.all(
        DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH),
      Promise.all(
        KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH),
      Promise.all(
        NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH),
      Promise.all(
        NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
      readJson(KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH),
      Promise.all(
        KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            text: await readFile(
              path.join(REPOSITORY_ROOT, relativePath),
              "utf8",
            ),
          }),
        ),
      ),
    ]);

  diagnostics.push(...validateSourceRegistry(registryInput));
  diagnostics.push(
    ...validateGenshinToolsSnapshot(genshinToolsInput, catalogs)
  );
  diagnostics.push(...validateLegacySnapshot(legacyInput, catalogs));
  let manualInputs: ManualSnapshotInput[] = [];
  try {
    manualInputs = await loadManualSnapshotInputs(
      manualIndexInput,
      registryInput
    );
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "pipeline.manual_snapshot_load_failed",
      path: "manual-snapshots",
      message:
        error instanceof Error
          ? error.message
          : "Manual snapshot loading failed.",
    });
  }
  for (const manualInput of manualInputs) {
    diagnostics.push(
      ...validateManualObservationSnapshot(
        manualInput.snapshot,
        catalogs,
        manualInput.expectedSourceId
      )
    );
  }

  const registry = SourceRegistrySchema.safeParse(registryInput);
  const genshinTools =
    GenshinToolsPresetSnapshotSchema.safeParse(genshinToolsInput);
  const legacy = LegacyTeamSnapshotSchema.safeParse(legacyInput);
  const manualSnapshots = manualInputs.map(({ snapshot }) =>
    ManualObservationSnapshotSchema.safeParse(snapshot)
  );
  const validManualSnapshots = manualSnapshots.flatMap((parsed) =>
    parsed.success ? [parsed.data] : []
  );
  if (
    registry.success &&
    validManualSnapshots.length === manualInputs.length
  ) {
    diagnostics.push(
      ...validateManualSnapshotCollection(
        validManualSnapshots,
        registry.data
      )
    );
  }
  const knowledge = KnowledgeRepositorySchema.safeParse(knowledgeInput);
  if (
    registry.success &&
    genshinTools.success &&
    legacy.success &&
    manualInputs.length > 0 &&
    validManualSnapshots.length === manualInputs.length &&
    knowledge.success
  ) {
    const sourceRegistrySha256 = await sha256File(SOURCE_REGISTRY_PATH);
    diagnostics.push(
      ...validateKnowledgeRepository(knowledge.data, {
        catalogs,
        sourceRegistry: registry.data,
        expectedSourceRegistrySha256: sourceRegistrySha256,
        genshinToolsSnapshot: genshinTools.data,
        legacySnapshot: legacy.data,
        manualSnapshots: validManualSnapshots,
      })
    );

    try {
      const [expectedGenshinTools, expectedLegacy] = await Promise.all([
        importGenshinToolsPresets(registry.data),
        importLegacyTeamResearch(registry.data),
      ]);
      if (stableJson(expectedGenshinTools) !== stableJson(genshinTools.data)) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_source_snapshot",
          path: "genshintools-presets",
          message:
            "The saved GenshinTools snapshot does not match a fresh deterministic import.",
        });
      }
      if (stableJson(expectedLegacy) !== stableJson(legacy.data)) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_source_snapshot",
          path: "legacy-team-research",
          message:
            "The saved legacy snapshot does not match a fresh deterministic import.",
        });
      }

      const expectedKnowledge = consolidateKnowledge({
        sourceRegistry: registry.data,
        sourceRegistrySha256,
        genshinTools: expectedGenshinTools,
        legacy: expectedLegacy,
        manualSnapshots: manualInputs,
      });
      if (stableJson(expectedKnowledge) !== stableJson(knowledge.data)) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_knowledge_repository",
          path: "knowledge",
          message:
            "The saved knowledge repository does not match fresh deterministic consolidation.",
        });
      }

      const corpusInventoryGeneratedFrom = await hashRelativePaths(
        KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS
      );
      const expectedCorpusInventory = buildKnowledgeCorpusInventoryReport(
        expectedKnowledge,
        registry.data,
        corpusInventoryGeneratedFrom
      );
      if (
        stableJson(expectedCorpusInventory) !==
        stableJson(knowledgeCorpusInventoryInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_knowledge_corpus_inventory",
          path: "reports.knowledge-corpus-inventory",
          message:
            "The saved knowledge-corpus inventory does not match current knowledge and source metadata.",
        });
      }

      const artifactChoiceSearchCoverageGeneratedFrom =
        await hashRelativePaths(ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS);
      const expectedArtifactChoiceSearchCoverage =
        buildArtifactChoiceSearchCoverageReport(
          expectedKnowledge,
          artifactChoiceSearchCoverageGeneratedFrom,
        );
      if (
        stableJson(expectedArtifactChoiceSearchCoverage) !==
        stableJson(artifactChoiceSearchCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_artifact_choice_search_coverage_report",
          path: "reports.artifact-choice-search-coverage",
          message:
            "The saved artifact-choice search coverage does not match the current knowledge repository and analyzer candidate grammar.",
        });
      }

      const weaponChoiceSearchCoverageGeneratedFrom = await hashRelativePaths(
        WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS
      );
      const expectedWeaponChoiceSearchCoverage =
        buildWeaponChoiceSearchCoverageReport(
          expectedKnowledge,
          weaponChoiceSearchCoverageGeneratedFrom
        );
      if (
        stableJson(expectedWeaponChoiceSearchCoverage) !==
        stableJson(weaponChoiceSearchCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_weapon_choice_search_coverage_report",
          path: "reports.weapon-choice-search-coverage",
          message:
            "The saved weapon-choice search coverage does not match the current knowledge repository and mirrored analyzer candidate policy.",
        });
      }

      const teamTemplateCoverageGeneratedFrom = await hashRelativePaths(
        TEAM_TEMPLATE_COVERAGE_INPUT_PATHS
      );
      const expectedTeamTemplateCoverage = buildTeamTemplateCoverageReport(
        expectedKnowledge,
        catalogs,
        teamTemplateCoverageGeneratedFrom
      );
      if (
        stableJson(expectedTeamTemplateCoverage) !==
        stableJson(teamTemplateCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_team_template_coverage_report",
          path: "reports.team-template-coverage",
          message:
            "The saved team-template coverage report does not match current knowledge and character catalogs.",
        });
      }

      const formulaDraftGeneratedFrom = await hashRelativePaths(
        FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS
      );
      const expectedFormulaDraft =
        await buildFurinaNeuvilletteFormulaDraftReport(
          expectedKnowledge,
          formulaDraftGeneratedFrom
        );
      if (
        stableJson(expectedFormulaDraft) !==
        stableJson(furinaNeuvilletteFormulaDraftInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_formula_plan_draft",
          path: "reports.furina-neuvillette-formula-plan-draft",
          message:
            "The saved Furina-Neuvillette formula-plan draft does not match current knowledge and calculator defaults.",
        });
      }

      const keqingIneffaFormulaDraftGeneratedFrom = await hashRelativePaths(
        KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS
      );
      const expectedKeqingIneffaFormulaDraft =
        await buildKeqingIneffaFormulaDraftReport(
          expectedKnowledge,
          keqingIneffaFormulaDraftGeneratedFrom
        );
      if (
        stableJson(expectedKeqingIneffaFormulaDraft) !==
        stableJson(keqingIneffaFormulaDraftInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_formula_plan_draft",
          path: "reports.keqing-ineffa-formula-plan-draft",
          message:
            "The saved Keqing-Ineffa formula-plan draft does not match current knowledge, equipment evidence, and calculator defaults.",
        });
      }

      const keqingIneffaArtifactGenerationPreflightGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS
        );
      const expectedKeqingIneffaArtifactGenerationPreflight =
        await buildKeqingIneffaArtifactGenerationPreflightReport(
          expectedKnowledge,
          keqingIneffaArtifactGenerationPreflightGeneratedFrom
        );
      if (
        stableJson(expectedKeqingIneffaArtifactGenerationPreflight) !==
        stableJson(keqingIneffaArtifactGenerationPreflightInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_artifact_generation_preflight",
          path: "reports.keqing-ineffa-artifact-generation-preflight",
          message:
            "The saved Keqing-Ineffa artifact-generation preflight does not match current source equipment, refinement policy, formula readiness, and analyzer candidate grammar.",
        });
      }

      const keqingIneffaArtifactGenerationTechnicalProbeGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
        );
      const expectedKeqingIneffaArtifactGenerationTechnicalProbe =
        await runKeqingIneffaArtifactGenerationTechnicalProbe(
          expectedKnowledge,
          keqingIneffaArtifactGenerationTechnicalProbeGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingIneffaArtifactGenerationTechnicalProbe) !==
        stableJson(keqingIneffaArtifactGenerationTechnicalProbeInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_artifact_generation_technical_probe",
          path: "reports.keqing-ineffa-artifact-generation-technical-probe",
          message:
            "The saved Keqing-Ineffa artifact-generation technical probe does not match current source builds, calculator defaults, candidate policy, and generator implementation.",
        });
      }

      const keqingIneffaArtifactGenerationSensitivityGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_INPUT_PATHS,
        );
      const expectedKeqingIneffaArtifactGenerationSensitivity =
        await runKeqingIneffaArtifactGenerationSensitivityProbe(
          expectedKnowledge,
          keqingIneffaArtifactGenerationSensitivityGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingIneffaArtifactGenerationSensitivity) !==
        stableJson(keqingIneffaArtifactGenerationSensitivityInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_artifact_generation_sensitivity",
          path: "reports.keqing-ineffa-artifact-generation-sensitivity",
          message:
            "The saved Keqing-Ineffa artifact-generation sensitivity probe does not match current repository builds, calculator defaults, candidate schedule, and generator implementation.",
        });
      }

      const keqingIneffaBoundedJointArtifactExperimentGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
        );
      const expectedKeqingIneffaBoundedJointArtifactExperiment =
        await runKeqingIneffaBoundedJointArtifactExperiment(
          expectedKnowledge,
          keqingIneffaBoundedJointArtifactExperimentGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingIneffaBoundedJointArtifactExperiment) !==
        stableJson(keqingIneffaBoundedJointArtifactExperimentInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_bounded_joint_artifact_experiment",
          path: "reports.keqing-ineffa-bounded-joint-artifact-experiment",
          message:
            "The saved Keqing-Ineffa bounded joint artifact experiment does not match the current four-node input lattice, unreviewed technical objective, generator implementation, and replay implementation.",
        });
      }

      const teamRosterCandidateDomainExperimentGeneratedFrom =
        await hashRelativePaths(
          TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
        );
      const expectedTeamRosterCandidateDomainExperiment =
        await runTeamRosterCandidateDomainExperiment(
          expectedKnowledge,
          teamRosterCandidateDomainExperimentGeneratedFrom,
        );
      if (
        stableJson(expectedTeamRosterCandidateDomainExperiment) !==
        stableJson(teamRosterCandidateDomainExperimentInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_team_roster_candidate_domain_experiment",
          path: "reports.team-roster-candidate-domain-experiment",
          message:
            "The saved team-roster candidate-domain experiment does not match the selected repository templates, eligible stable character boundary, runtime reaction gate, and validation targets.",
        });
      }

      const ittoSourceConditionedGuidePacketGeneratedFrom =
        await hashRelativePaths(
          ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
        );
      const ittoManualInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "itto-on-field-artifact-stats-version-5-6",
      );
      const ittoPacketAuthentication =
        await authenticateIttoSourceConditionedGuidePacketReport(
          ittoSourceConditionedGuidePacketInput as SourceConditionedGuidePacketReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: ittoManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            catalogs,
            generatedFrom: ittoSourceConditionedGuidePacketGeneratedFrom,
          },
        );
      if (!ittoPacketAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            ittoPacketAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_itto_source_conditioned_guide_packets"
              : "pipeline.stale_itto_source_conditioned_guide_packets",
          path: "reports.itto-source-conditioned-guide-packets",
          message:
            ittoPacketAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Itto source-conditioned packet is not comparable; a matching non-comparable serialized report is not valid durable evidence."
              : "The saved Itto source-conditioned packet does not match the authenticated source records, exact condition map, roster runtime, constellation-only baseline comparison, and current input hashes.",
        });
      }

      const [
        ittoRequestContextGeneratedFrom,
        ittoRequestContextSourceReportSnapshot,
        ittoRequestContextFixtureSnapshot,
      ] = await Promise.all([
        hashRelativePaths(ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS),
        readHashedJsonSnapshot(
          REPOSITORY_ROOT,
          ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
        ),
        readHashedJsonSnapshot(
          REPOSITORY_ROOT,
          ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
        ),
      ]);
      const ittoRequestContextAuthentication =
        await authenticateIttoRequestContextApplicabilityReport(
          ittoRequestContextApplicabilityInput as IttoRequestContextApplicabilityReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: ittoManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            catalogs,
            sourceReportSnapshot: ittoRequestContextSourceReportSnapshot,
            contextFixtureSnapshot: ittoRequestContextFixtureSnapshot,
            generatedFrom: ittoRequestContextGeneratedFrom,
          },
        );
      if (!ittoRequestContextAuthentication.authenticated) {
        const diagnosticByReason = {
          "upstream-control-authentication-failed": {
            code: "pipeline.unauthenticated_itto_request_context_control",
            message:
              "The Itto request-context projection cannot authenticate its checked-in checkpoint 23 source control against a fresh canonical rebuild.",
          },
          "context-input-invalid": {
            code: "pipeline.invalid_itto_request_context_input",
            message:
              "The Itto request-context fixture, hashed snapshot, or generatedFrom boundary is invalid.",
          },
          "canonical-projection-not-comparable": {
            code: "pipeline.non_comparable_itto_request_context_applicability",
            message:
              "The freshly rebuilt Itto request-context projection is not comparable and cannot serve as durable evidence.",
          },
          "serialized-report-mismatch": {
            code: "pipeline.stale_itto_request_context_applicability",
            message:
              "The saved Itto request-context report does not match the authenticated source control, strict context fixture, pinned claim bindings, and current input hashes.",
          },
        } as const;
        const diagnostic =
          diagnosticByReason[ittoRequestContextAuthentication.reason];
        diagnostics.push({
          severity: "error",
          code: diagnostic.code,
          path: "reports.itto-request-context-applicability",
          message: diagnostic.message,
        });
      }

      const kleeSourceLocalGeneratedFrom = await hashRelativePaths(
        KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
      );
      const kleeManualInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "klee-on-field-artifact-stats-luna-iv",
      );
      const kleeCanonicalInput = {
        repositoryInput: expectedKnowledge,
        manualSnapshotInput: kleeManualInput.snapshot,
        manualIndexInput,
        sourceRegistryInput: registry.data,
        sourceFiles: kleeSourceLocalConditionSliceSourceFiles,
        generatedFrom: kleeSourceLocalGeneratedFrom,
      };
      const kleeSourceLocalAuthentication =
        authenticateKleeSourceLocalConditionSliceReport(
          kleeSourceLocalConditionSliceInput as KleeSourceLocalConditionSliceReport,
          kleeCanonicalInput,
        );
      if (!kleeSourceLocalAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            kleeSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_klee_source_local_condition_slice"
              : "pipeline.stale_klee_source_local_condition_slice",
          path: "reports.klee-source-local-condition-slice",
          message:
            kleeSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Klee source-local condition slice could not authenticate its exact source, repository, team, predicate, or holdout boundary."
              : "The saved Klee source-local condition slice does not match the current raw source, consolidated records, exact typed bindings, scoped request projection, and input hashes.",
        });
      }
      const dionaSourceLocalGeneratedFrom = await hashRelativePaths(
        DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
      );
      const dionaManualInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "c6-diona-mavuika-citlali-bennett-forward-melt",
      );
      const dionaSourceLocalAuthentication =
        authenticateDionaSourceLocalSupportSliceReport(
          dionaSourceLocalSupportSliceInput as DionaSourceLocalSupportSliceReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: dionaManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            sourceFiles: dionaSourceLocalSupportSliceSourceFiles,
            generatedFrom: dionaSourceLocalGeneratedFrom,
          },
        );
      if (!dionaSourceLocalAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            dionaSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_diona_source_local_support_slice"
              : "pipeline.stale_diona_source_local_support_slice",
          path: "reports.diona-source-local-support-slice",
          message:
            dionaSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Diona source-local support slice could not authenticate its exact source, repository, same-record team, support-role predicates, or holdout boundary."
              : "The saved Diona source-local support slice does not match the current raw source, consolidated records, exact typed bindings, scoped request projection, and input hashes.",
        });
      }
      const kokomiSourceLocalGeneratedFrom = await hashRelativePaths(
        KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS,
      );
      const kokomiManualInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
      );
      const kokomiSourceLocalAuthentication =
        authenticateKokomiSourceLocalArtifactSliceReport(
          kokomiSourceLocalArtifactSliceInput as KokomiSourceLocalArtifactSliceReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: kokomiManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            sourceFiles: kokomiSourceLocalArtifactSliceSourceFiles,
            generatedFrom: kokomiSourceLocalGeneratedFrom,
          },
        );
      if (!kokomiSourceLocalAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            kokomiSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_kokomi_source_local_artifact_slice"
              : "pipeline.stale_kokomi_source_local_artifact_slice",
          path: "reports.kokomi-source-local-artifact-slice",
          message:
            kokomiSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Kokomi source-local artifact slice could not authenticate its exact source snapshot, repository team, ordered roster predicate, selected artifact payload, or holdout boundary."
              : "The saved Kokomi source-local artifact slice does not match the current raw source, consolidated records, exact one-claim roster binding, zero-request-binding boundary, and input hashes.",
        });
      }
      const noelleSourceLocalGeneratedFrom = await hashRelativePaths(
        NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
      );
      const noelleManualInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "noelle-c6-or-talent-10-artifact-stats-luna-viii",
      );
      const noelleSourceLocalAuthentication =
        authenticateNoelleSourceLocalHighInvestmentSliceReport(
          noelleSourceLocalHighInvestmentSliceInput as NoelleSourceLocalHighInvestmentSliceReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: noelleManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            sourceFiles: noelleSourceLocalHighInvestmentSliceSourceFiles,
            generatedFrom: noelleSourceLocalGeneratedFrom,
          },
        );
      if (!noelleSourceLocalAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            noelleSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_noelle_source_local_high_investment_slice"
              : "pipeline.stale_noelle_source_local_high_investment_slice",
          path: "reports.noelle-source-local-high-investment-slice",
          message:
            noelleSourceLocalAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Noelle source-local high-investment slice could not authenticate its exact source snapshot, guide/team cross-record boundary, three main-stat payloads, numeric request predicate, twelve holdouts, or one empty array."
              : "The saved Noelle source-local high-investment slice does not match the current raw source, consolidated records, exact three-claim numeric request projection, holdout/empty closure, and input hashes.",
        });
      }
      const noelleSourceLocalLowerInvestmentGeneratedFrom =
        await hashRelativePaths(
          NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
        );
      const noelleLowerInvestmentManualInput =
        requiredManualSnapshotInputContaining(
          manualInputs,
          "kqm",
          "noelle-c0-c5-talent-9-artifact-stats-luna-viii",
        );
      const noelleSourceLocalLowerInvestmentAuthentication =
        authenticateNoelleSourceLocalLowerInvestmentSliceReport(
          noelleSourceLocalLowerInvestmentSliceInput as NoelleSourceLocalLowerInvestmentSliceReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: noelleLowerInvestmentManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            sourceFiles: noelleSourceLocalLowerInvestmentSliceSourceFiles,
            generatedFrom: noelleSourceLocalLowerInvestmentGeneratedFrom,
          },
        );
      if (!noelleSourceLocalLowerInvestmentAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            noelleSourceLocalLowerInvestmentAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_noelle_source_local_lower_investment_slice"
              : "pipeline.stale_noelle_source_local_lower_investment_slice",
          path: "reports.noelle-source-local-lower-investment-slice",
          message:
            noelleSourceLocalLowerInvestmentAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The freshly rebuilt Noelle source-local lower-investment slice could not authenticate its exact source snapshot, guide/team cross-record boundary, three main-stat payloads, conjunction request predicate, twelve holdouts, or one empty array."
              : "The saved Noelle source-local lower-investment slice does not match the current raw source, consolidated records, exact three-claim C5-and-Burst-9 request projection, holdout/empty closure, and input hashes.",
        });
      }
      const manualConditionArrayCoverageGeneratedFrom =
        await hashRelativePaths(MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS);
      const expectedManualConditionArrayCoverage =
        await buildManualConditionArrayCoverageReport({
          repositoryInput: expectedKnowledge,
          manualIndexInput,
          sourceRegistryInput: registry.data,
          manualInputs,
          catalogs,
          checkedInRosterDomainReportInput:
            teamRosterCandidateDomainExperimentInput,
          ittoDurableReportInput: ittoSourceConditionedGuidePacketInput,
          keqingEquipmentDurableReportInput:
            keqingLunarEquipmentEvidenceValidationInput,
          keqingRolePairDurableReportInput:
            keqingSourceScopedRolePairSampleInput,
          sourceFiles: manualConditionArrayCoverageSourceFiles,
          generatedFrom: manualConditionArrayCoverageGeneratedFrom,
        });
      if (expectedManualConditionArrayCoverage.comparisonStatus !== "comparable") {
        diagnostics.push({
          severity: "error",
          code: "pipeline.non_comparable_manual_condition_array_coverage",
          path: "reports.manual-condition-array-coverage",
          message:
            "The freshly rebuilt manual condition-array inventory could not authenticate exact source arrays, repository parity, or its seven current wrapper families.",
        });
      } else if (
        stableJson(expectedManualConditionArrayCoverage) !==
        stableJson(manualConditionArrayCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_manual_condition_array_coverage",
          path: "reports.manual-condition-array-coverage",
          message:
            "The saved manual condition-array coverage does not match the seven indexed source snapshots, exact repository paths, authenticated condition bindings, and current input hashes.",
        });
      }

      const kleeTeamScopedClaimJoinGeneratedFrom = await hashRelativePaths(
        KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS,
      );
      const kleeTeamScopedClaimJoinAuthentication =
        authenticateKleeTeamScopedClaimJoinWitnessReport(
          kleeTeamScopedClaimJoinWitnessInput as KleeTeamScopedClaimJoinWitnessReport,
          {
            repositoryInput: expectedKnowledge,
            manualSnapshotInput: kleeManualInput.snapshot,
            manualIndexInput,
            sourceRegistryInput: registry.data,
            kleeDurableReportInput: kleeSourceLocalConditionSliceInput,
            manualCoverageDurableReportInput:
              manualConditionArrayCoverageInput,
            sourceFiles: kleeTeamScopedClaimJoinWitnessSourceFiles,
            generatedFrom: kleeTeamScopedClaimJoinGeneratedFrom,
          },
        );
      if (!kleeTeamScopedClaimJoinAuthentication.authenticated) {
        diagnostics.push({
          severity: "error",
          code:
            kleeTeamScopedClaimJoinAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "pipeline.non_comparable_klee_team_scoped_claim_join_witness"
              : "pipeline.stale_klee_team_scoped_claim_join_witness",
          path: "reports.klee-team-scoped-claim-join-witness",
          message:
            kleeTeamScopedClaimJoinAuthentication.reason ===
            "canonical-inputs-not-comparable"
              ? "The Klee team-scoped claim-join witness could not authenticate its source slice, current binding coverage, exact positive team, or negative roster control."
              : "The saved Klee team-scoped claim-join witness does not match the current authenticated four-claim applicability evidence and zero-composition boundary.",
        });
      }

      const derivedFormulaFixtureCoverageGeneratedFrom =
        await hashRelativePaths(DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS);
      const derivedFormulaFixtureManualInputs = manualInputs
        .filter(({ snapshotFile }) =>
          DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS.some(
            (relativePath) => relativePath === snapshotFile.path,
          ),
        )
        .map(({ snapshot, snapshotFile }) => ({
          path: snapshotFile.path,
          snapshotInput: snapshot,
        }));
      const expectedDerivedFormulaFixtureCoverage =
        buildDerivedFormulaFixtureCoverageReport({
          fixtureReportInputs: [
            {
              path: DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
              reportInput: expectedFormulaDraft,
            },
            {
              path: DERIVED_FORMULA_FIXTURE_REPORT_PATHS[1],
              reportInput: expectedKeqingIneffaFormulaDraft,
            },
          ],
          repositoryInput: expectedKnowledge,
          sourceRegistryInput: registry.data,
          manualIndexInput,
          manualSnapshotInputs: derivedFormulaFixtureManualInputs,
          sourceFiles: derivedFormulaFixtureCoverageSourceFiles,
          releasedCharacterIds: characters.map(({ id }) => id),
          checkedInRosterReportInput:
            expectedTeamRosterCandidateDomainExperiment,
          generatedFrom: derivedFormulaFixtureCoverageGeneratedFrom,
        });
      if (
        stableJson(expectedDerivedFormulaFixtureCoverage) !==
        stableJson(derivedFormulaFixtureCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_derived_formula_fixture_coverage",
          path: "reports.derived-formula-fixture-coverage",
          message:
            "The saved derived formula-fixture coverage does not match the two authenticated technical fixtures, source provenance, local C0 assumptions, and withheld-use boundary.",
        });
      }

      const characterGuideInputCoverageGeneratedFrom =
        await hashRelativePaths(CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS);
      const expectedCharacterGuideInputCoverage =
        buildCharacterGuideInputCoverageReport({
          repositoryInput: expectedKnowledge,
          sourceRegistryInput: registry.data,
          manualSnapshotInputs: manualInputs,
          sourceFiles: characterGuideInputCoverageSourceFiles,
          releasedCharacters: buildReleasedGuideDomainCatalog(
            characters.map(({ id }) => id),
            catalogs.characterElements,
          ),
          checkedInRosterReportInput:
            expectedTeamRosterCandidateDomainExperiment,
          weaponChoiceSearchCoverageReportInput:
            expectedWeaponChoiceSearchCoverage,
          artifactChoiceSearchCoverageReportInput:
            expectedArtifactChoiceSearchCoverage,
          generatedFrom: characterGuideInputCoverageGeneratedFrom,
        });
      if (
        stableJson(expectedCharacterGuideInputCoverage) !==
        stableJson(characterGuideInputCoverageInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_character_guide_input_coverage",
          path: "reports.character-guide-input-coverage",
          message:
            "The saved character-guide input coverage does not match the current knowledge repository, source metadata, search coverage, and C0-C6 guide boundary.",
        });
      }

      const keqingIneffaTeamStatMarginalDiagnosticGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
        );
      const expectedKeqingIneffaTeamStatMarginalDiagnostic =
        await runKeqingIneffaTeamStatMarginalDiagnostic(
          expectedKnowledge,
          keqingIneffaTeamStatMarginalDiagnosticGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingIneffaTeamStatMarginalDiagnostic) !==
        stableJson(keqingIneffaTeamStatMarginalDiagnosticInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_team_stat_marginal_diagnostic",
          path: "reports.keqing-ineffa-team-stat-marginal-diagnostic",
          message:
            "The saved Keqing-Ineffa team-stat marginal diagnostic does not match the fixed generator endpoint domain, non-ER marginal domain, unreviewed technical objective, and GenshinTools baseline priority-band overlap.",
        });
      }

      const furinaSourceScopedRoleSampleGeneratedFrom =
        await hashRelativePaths(FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS);
      const expectedFurinaSourceScopedRoleSample =
        await runFurinaSourceScopedRoleSample(
          expectedKnowledge,
          manualInputs,
          teamRosterCandidateDomainExperimentInput,
          furinaSourceScopedRoleSampleGeneratedFrom,
        );
      if (
        stableJson(expectedFurinaSourceScopedRoleSample) !==
        stableJson(furinaSourceScopedRoleSampleInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_furina_source_scoped_role_sample",
          path: "reports.furina-source-scoped-role-sample",
          message:
            "The saved Furina source-scoped role sample does not match the indexed extraction status, exact same-page role/template/team records, stable eligible-character boundary, and role-withheld roster-domain status.",
        });
      }

      const keqingSourceScopedRolePairSampleGeneratedFrom =
        await hashRelativePaths(
          KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
        );
      const expectedKeqingSourceScopedRolePairSample =
        await runKeqingSourceScopedRolePairSample(
          expectedKnowledge,
          manualInputs,
          teamRosterCandidateDomainExperimentInput,
          keqingSourceScopedRolePairSampleGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingSourceScopedRolePairSample) !==
        stableJson(keqingSourceScopedRolePairSampleInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_source_scoped_role_pair_sample",
          path: "reports.keqing-source-scoped-role-pair-sample",
          message:
            "The saved Keqing source-scoped role-pair sample does not match the seven indexed extraction states, exact full role inventories, four same-page published targets, independently checked catalog boundary, and fresh plus checked-in role-withheld roster statuses.",
        });
      }

      const keqingLunarEquipmentEvidenceValidationGeneratedFrom =
        await hashRelativePaths(
          KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
        );
      const expectedKeqingLunarEquipmentEvidenceValidation =
        buildKeqingLunarEquipmentEvidenceValidationReport(
          expectedKnowledge,
          manualInputs,
          {
            manualIndex: ManualSnapshotIndexSchema.parse(manualIndexInput),
            sourceRegistry: registry.data,
          },
          keqingLunarEquipmentEvidenceValidationGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingLunarEquipmentEvidenceValidation) !==
        stableJson(keqingLunarEquipmentEvidenceValidationInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_lunar_equipment_evidence_validation",
          path: "reports.keqing-lunar-equipment-evidence-validation",
          message:
            "The saved Keqing Lunar equipment-evidence validation does not match the exact source records, published team facts, baseline build, and read-only search-coverage boundary.",
        });
      }

      const keqingLatticeKqmManualInput =
        requiredManualSnapshotInputContaining(
          manualInputs,
          "kqm",
          "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i",
        );
      const liveBuildPresetInput = await readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS[5],
        ),
      );
      const expectedKeqingIneffaFurinaXilonenEquipmentCandidateLattice =
        buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport({
          repository: expectedKnowledge,
          kqmSnapshot: ManualObservationSnapshotSchema.parse(
            keqingLatticeKqmManualInput.snapshot,
          ),
          genshinToolsSnapshot: expectedGenshinTools,
          manualIndex: ManualSnapshotIndexSchema.parse(manualIndexInput),
          sourceRegistry: registry.data,
          liveBuildPreset: liveBuildPresetInput,
          evidenceReport: expectedKeqingLunarEquipmentEvidenceValidation,
          weaponCoverageReport: expectedWeaponChoiceSearchCoverage,
          artifactCoverageReport: expectedArtifactChoiceSearchCoverage,
        });
      let keqingIneffaFurinaXilonenEquipmentCandidateLatticeAuthenticated =
        true;
      try {
        requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
          expectedKeqingIneffaFurinaXilonenEquipmentCandidateLattice,
        );
      } catch (error) {
        keqingIneffaFurinaXilonenEquipmentCandidateLatticeAuthenticated = false;
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_equipment_candidate_lattice",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-candidate-lattice",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt source-backed equipment lattice did not authenticate its source, request, holdout, provenance, or complete Cartesian boundary.",
        });
      }
      if (
        keqingIneffaFurinaXilonenEquipmentCandidateLatticeAuthenticated &&
        stableJson(
          expectedKeqingIneffaFurinaXilonenEquipmentCandidateLattice,
        ) !==
          stableJson(
            keqingIneffaFurinaXilonenEquipmentCandidateLatticeInput as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_equipment_candidate_lattice",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-candidate-lattice",
          message:
            "The saved source-backed equipment lattice does not match the fresh nine-input source closure, 20-occurrence inventory, request conditions, and complete 36-node wrapper-authored product.",
        });
      }

      const keqingIneffaFurinaXilonenEquipmentRuntimePreflightGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS,
        );
      const expectedKeqingIneffaFurinaXilonenEquipmentRuntimePreflight =
        await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport({
          latticeReport:
            expectedKeqingIneffaFurinaXilonenEquipmentCandidateLattice,
          formulaDraft: expectedKeqingIneffaFormulaDraft,
          inputFiles:
            keqingIneffaFurinaXilonenEquipmentRuntimePreflightGeneratedFrom,
        });
      let keqingIneffaFurinaXilonenEquipmentRuntimePreflightAuthenticated =
        true;
      try {
        requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
          expectedKeqingIneffaFurinaXilonenEquipmentRuntimePreflight,
        );
      } catch (error) {
        keqingIneffaFurinaXilonenEquipmentRuntimePreflightAuthenticated = false;
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_equipment_runtime_preflight",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-runtime-preflight",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt equipment runtime preflight did not authenticate its upstream reports, exact resolutions, 36 materializations, formula coverage, or deferred evaluation boundary.",
        });
      }
      if (
        keqingIneffaFurinaXilonenEquipmentRuntimePreflightAuthenticated &&
        stableJson(
          expectedKeqingIneffaFurinaXilonenEquipmentRuntimePreflight,
        ) !==
          stableJson(
            keqingIneffaFurinaXilonenEquipmentRuntimePreflightInput as KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_equipment_runtime_preflight",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-runtime-preflight",
          message:
            "The saved equipment runtime preflight does not match the fresh authenticated lattice, exact unreviewed source formula boundary, 14 occurrence resolutions, and 36 current TeamBuild materializations.",
        });
      }

      const keqingIneffaFurinaXilonenEquipmentTechnicalComputationGeneratedFrom =
        await hashRelativePaths(
          KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS,
        );
      const expectedKeqingIneffaFurinaXilonenEquipmentTechnicalComputation =
        await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
          {
            sourcePreflight:
              expectedKeqingIneffaFurinaXilonenEquipmentRuntimePreflight,
            inputFiles:
              keqingIneffaFurinaXilonenEquipmentTechnicalComputationGeneratedFrom,
          },
        );
      let keqingIneffaFurinaXilonenEquipmentTechnicalComputationAuthenticated =
        true;
      try {
        requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
          expectedKeqingIneffaFurinaXilonenEquipmentTechnicalComputation,
        );
      } catch (error) {
        keqingIneffaFurinaXilonenEquipmentTechnicalComputationAuthenticated =
          false;
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_equipment_technical_computation",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-technical-computation",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt bounded equipment technical computation did not authenticate its selected inputs, source-specific authority boundary, complete finite execution, provenance, or withheld-claim surface.",
        });
      }
      if (
        keqingIneffaFurinaXilonenEquipmentTechnicalComputationAuthenticated &&
        stableJson(
          expectedKeqingIneffaFurinaXilonenEquipmentTechnicalComputation,
        ) !==
          stableJson(
            keqingIneffaFurinaXilonenEquipmentTechnicalComputationInput as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_equipment_technical_computation",
          path: "reports.keqing-ineffa-furina-xilonen-equipment-technical-computation",
          message:
            "The saved bounded equipment technical computation does not match the fresh authenticated 36-node, four-carry, node-local generator and replay execution under the same source-not-ready objective boundary.",
        });
      }

      let expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence:
        | KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport
        | null = null;
      let keqingIneffaFurinaXilonenGeneratedSheetEvidenceAuthenticated = false;
      try {
        const keqingIneffaFurinaXilonenGeneratedSheetEvidenceGeneratedFrom =
          await hashRelativePaths(
            KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS,
          );
        expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence =
          await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport({
            sourceTechnicalReport:
              expectedKeqingIneffaFurinaXilonenEquipmentTechnicalComputation,
            knowledgeTargetInput: {
              equipmentLatticeReport:
                expectedKeqingIneffaFurinaXilonenEquipmentCandidateLattice,
              repository: expectedKnowledge,
              genshinToolsSnapshot: expectedGenshinTools,
              liveBuildPreset: liveBuildPresetInput,
              evidenceReport: expectedKeqingLunarEquipmentEvidenceValidation,
            },
            inputFiles:
              keqingIneffaFurinaXilonenGeneratedSheetEvidenceGeneratedFrom,
          });
        requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
          expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence,
        );
        keqingIneffaFurinaXilonenGeneratedSheetEvidenceAuthenticated = true;
      } catch (error) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_generated_sheet_evidence",
          path: "reports.keqing-ineffa-furina-xilonen-generated-sheet-evidence",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt generated-sheet evidence did not authenticate its selected inputs, nested CP38 reports, exact 144-capture output, occurrence-scoped target joins, or withheld-claim boundary.",
        });
      }
      if (
        keqingIneffaFurinaXilonenGeneratedSheetEvidenceAuthenticated &&
        expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence !== null &&
        stableJson(expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence) !==
          stableJson(
            keqingIneffaFurinaXilonenGeneratedSheetEvidenceInput as KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_generated_sheet_evidence",
          path: "reports.keqing-ineffa-furina-xilonen-generated-sheet-evidence",
          message:
            "The saved generated-sheet evidence does not match the fresh authenticated CP36 lattice, CP37 materializations, CP38 technical domain, exact eight-input hash set, 144 generator captures, occurrence-scoped source targets, or deferred-ER provenance boundary.",
        });
      }

      let expectedKeqingIneffaFurinaXilonenCachedPolicyAudit:
        | KeqingIneffaFurinaXilonenCachedPolicyAuditReport
        | null = null;
      let keqingIneffaFurinaXilonenCachedPolicyAuditAuthenticated = false;
      try {
        if (!expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence) {
          throw new Error(
            "The freshly rebuilt CP39 generated-sheet evidence is unavailable for the cached-policy audit.",
          );
        }
        const keqingIneffaFurinaXilonenCachedPolicyAuditGeneratedFrom =
          await hashRelativePaths(
            KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS,
          );
        expectedKeqingIneffaFurinaXilonenCachedPolicyAudit =
          buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport({
            cp38Report:
              expectedKeqingIneffaFurinaXilonenEquipmentTechnicalComputation,
            cp39Report:
              expectedKeqingIneffaFurinaXilonenGeneratedSheetEvidence,
            inputFiles:
              keqingIneffaFurinaXilonenCachedPolicyAuditGeneratedFrom,
          });
        requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(
          expectedKeqingIneffaFurinaXilonenCachedPolicyAudit,
        );
        keqingIneffaFurinaXilonenCachedPolicyAuditAuthenticated = true;
      } catch (error) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_cached_policy_audit",
          path: "reports.keqing-ineffa-furina-xilonen-cached-policy-audit",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt cached-policy audit did not authenticate its exact CP38, CP39, and policy inputs; complete 36-node table; occurrence-scoped review projection; default cached-policy traces; execution provenance; or withheld-claim boundary.",
        });
      }
      if (
        keqingIneffaFurinaXilonenCachedPolicyAuditAuthenticated &&
        expectedKeqingIneffaFurinaXilonenCachedPolicyAudit !== null &&
        stableJson(expectedKeqingIneffaFurinaXilonenCachedPolicyAudit) !==
          stableJson(
            keqingIneffaFurinaXilonenCachedPolicyAuditInput as KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_cached_policy_audit",
          path: "reports.keqing-ineffa-furina-xilonen-cached-policy-audit",
          message:
            "The saved cached-policy audit does not match the fresh authenticated CP38 and CP39 reports, exact three-input hash set, complete 36-node compact table, four default cached-policy traces, occurrence-scoped review diagnostics, or zero-call and deferred-ER provenance boundaries.",
        });
      }

      let expectedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensus:
        | KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport
        | null = null;
      let keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusAuthenticated =
        false;
      try {
        if (
          !keqingIneffaFurinaXilonenCachedPolicyAuditAuthenticated ||
          !expectedKeqingIneffaFurinaXilonenCachedPolicyAudit
        ) {
          throw new Error(
            "The freshly rebuilt CP40 cached-policy audit is unavailable for the robustness census.",
          );
        }
        const keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusGeneratedFrom =
          await hashRelativePaths(
            KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS,
          );
        expectedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensus =
          buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport({
            cp40Report: expectedKeqingIneffaFurinaXilonenCachedPolicyAudit,
            inputFiles:
              keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusGeneratedFrom,
          });
        requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
          expectedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensus,
        );
        keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusAuthenticated =
          true;
      } catch (error) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_ineffa_furina_xilonen_cached_policy_robustness_census",
          path: "reports.keqing-ineffa-furina-xilonen-cached-policy-robustness-census",
          message:
            error instanceof Error
              ? error.message
              : "The freshly rebuilt cached-policy robustness census did not authenticate its exact CP40/core inputs, complete 36-start and 864-order census, cached-only execution provenance, or withheld-claim and deferred-ER boundaries.",
        });
      }
      if (
        keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusAuthenticated &&
        expectedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensus !==
          null &&
        stableJson(
          expectedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensus,
        ) !==
          stableJson(
            keqingIneffaFurinaXilonenCachedPolicyRobustnessCensusInput as KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
          )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_ineffa_furina_xilonen_cached_policy_robustness_census",
          path: "reports.keqing-ineffa-furina-xilonen-cached-policy-robustness-census",
          message:
            "The saved cached-policy robustness census does not match the fresh authenticated CP40 projection, exact three-input hash set, all 36 starts, all 864 effective declared orders, deterministic aggregate/witness digests, cached-only execution boundary, or deferred-ER provenance boundary.",
        });
      }

      const keqingLunarSourceConditionedCandidateLatticeGeneratedFrom =
        await hashRelativePaths(
          KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
        );
      const expectedKeqingLunarSourceConditionedCandidateLattice =
        buildKeqingLunarSourceConditionedCandidateLatticeReport(
          expectedKeqingLunarEquipmentEvidenceValidation,
          expectedKeqingIneffaFormulaDraft,
          keqingLunarSourceConditionedCandidateLatticeGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingLunarSourceConditionedCandidateLattice) !==
        stableJson(keqingLunarSourceConditionedCandidateLatticeInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_lunar_source_conditioned_candidate_lattice",
          path: "reports.keqing-lunar-source-conditioned-candidate-lattice",
          message:
            "The saved Keqing Lunar source-conditioned candidate lattice does not match the validated claim groups, four exact team resolutions, search-representability holdouts, and blocked technical-fixture boundary.",
        });
      }

      const keqingLunarCrossRecordCompositionContractGeneratedFrom =
        await hashRelativePaths(
          KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
        );
      const expectedKeqingLunarCrossRecordCompositionContract =
        buildKeqingLunarCrossRecordCompositionContractReport(
          expectedKeqingLunarSourceConditionedCandidateLattice,
          expectedKeqingIneffaFormulaDraft,
          keqingLunarCrossRecordCompositionContractGeneratedFrom,
        );
      if (
        stableJson(expectedKeqingLunarCrossRecordCompositionContract) !==
        stableJson(keqingLunarCrossRecordCompositionContractInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_lunar_cross_record_composition_contract",
          path: "reports.keqing-lunar-cross-record-composition-contract",
          message:
            "The saved Keqing Lunar cross-record composition contract does not match the exact source-conditioned claims, withheld branches, formula lineage, and Guide Factory-authored no-ordering join boundary.",
        });
      }

      const keqingLunarCrossRecordTechnicalMatrixGeneratedFrom =
        await hashRelativePaths(
          KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
        );
      const expectedKeqingLunarCrossRecordTechnicalMatrix =
        await runKeqingLunarCrossRecordTechnicalMatrix({
          repository: expectedKnowledge,
          candidateLattice:
            expectedKeqingLunarSourceConditionedCandidateLattice as KeqingLunarCrossRecordTechnicalMatrixInput["candidateLattice"],
          formulaDraft:
            expectedKeqingIneffaFormulaDraft as KeqingLunarCrossRecordTechnicalMatrixInput["formulaDraft"],
          serializedContract:
            expectedKeqingLunarCrossRecordCompositionContract as KeqingLunarCrossRecordTechnicalMatrixInput["serializedContract"],
          formulaDraftGeneratedFrom: keqingIneffaFormulaDraftGeneratedFrom,
          contractGeneratedFrom:
            keqingLunarCrossRecordCompositionContractGeneratedFrom,
          generatedFrom: keqingLunarCrossRecordTechnicalMatrixGeneratedFrom,
        });
      if (
        !isCompleteKeqingLunarCrossRecordTechnicalMatrixReport(
          expectedKeqingLunarCrossRecordTechnicalMatrix,
        )
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.incomplete_keqing_lunar_cross_record_technical_matrix",
          path: "reports.keqing-lunar-cross-record-technical-matrix",
          message:
            "The freshly rebuilt Keqing Lunar cross-record technical matrix did not complete all eight structural cells without issues.",
        });
      }
      if (
        stableJson(expectedKeqingLunarCrossRecordTechnicalMatrix) !==
        stableJson(keqingLunarCrossRecordTechnicalMatrixInput)
      ) {
        diagnostics.push({
          severity: "error",
          code: "pipeline.stale_keqing_lunar_cross_record_technical_matrix",
          path: "reports.keqing-lunar-cross-record-technical-matrix",
          message:
            "The saved Keqing Lunar cross-record technical matrix does not match the authenticated composition contract, current evidence snapshots, bounded carry schedule, generator implementation, and fail-closed structural execution policy.",
        });
      }

      if (includeErReports) {
        const comparisonStaticGeneratedFrom = await hashRelativePaths(
          DIONA_COMPARISON_INPUT_PATHS,
        );
        const dionaInput = requiredManualSnapshotInputContaining(
          manualInputs,
          "kqm",
          "diona-support-weapons-luna-viii",
        );
        const expectedComparison = buildDionaComparisonReport(
          expectedKnowledge,
          ManualObservationSnapshotSchema.parse(dionaInput.snapshot),
          [...comparisonStaticGeneratedFrom, dionaInput.snapshotFile],
        );
        if (stableJson(expectedComparison) !== stableJson(comparisonInput)) {
          diagnostics.push({
            severity: "error",
            code: "pipeline.stale_comparison_report",
            path: "reports.kqm-diona-comparison",
            message:
              "The saved Diona comparison does not match current source and baseline inputs.",
          });
        }

        const erEngineInputs = await hashRelativePaths(
          DIONA_ER_ENGINE_INPUT_PATHS,
        );
        const expectedErCalibration = buildDionaErCalibrationReport(
          expectedKnowledge,
          erEngineInputs,
        );
        if (
          stableJson(expectedErCalibration) !== stableJson(erCalibrationInput)
        ) {
          diagnostics.push({
            severity: "error",
            code: "pipeline.stale_calibration_report",
            path: "reports.kqm-diona-er-calibration",
            message:
              "The saved Diona ER calibration does not match current source and engine inputs.",
          });
        }
      }
    } catch (error) {
      diagnostics.push({
        severity: "error",
        code: "pipeline.regeneration_failed",
        path: "pipeline",
        message:
          error instanceof Error
            ? error.message
            : "Fresh import and consolidation failed.",
      });
    }
  }

  diagnostics.push(...(await validateWorkspaceBoundary()));

  return {
    diagnostics,
    errorCount: diagnostics.filter(({ severity }) => severity === "error")
      .length,
    warningCount: diagnostics.filter(({ severity }) => severity === "warning")
      .length,
  };
}

async function hashRelativePaths(
  relativePaths: readonly string[]
): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    }))
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const options = parseValidationCliArgs(process.argv.slice(2));
  const result = await runValidation(options);
  if (result.diagnostics.length > 0) {
    console.log(formatDiagnostics(result.diagnostics));
  }
  console.log(
    `Validation finished with ${result.errorCount} error(s) and ${result.warningCount} warning(s).`
  );
  if (options.includeErReports === false) {
    console.log(
      "Diona comparison and ER-calibration regeneration were explicitly deferred.",
    );
  }
  if (result.errorCount > 0) process.exitCode = 1;
}
