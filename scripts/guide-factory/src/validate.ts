import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  buildArtifactChoiceSearchCoverageReport,
} from "./artifactChoiceSearchCoverage";
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
  buildKeqingLunarSourceConditionedCandidateLatticeReport,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
} from "./keqingLunarSourceConditionedCandidateLattice";
import {
  buildKeqingLunarCrossRecordCompositionContractReport,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
} from "./keqingLunarCrossRecordCompositionContract";
import {
  importGenshinToolsPresets,
  importLegacyTeamResearch,
} from "./importers";
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
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
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
  SourceRegistrySchema,
} from "./schemas";
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

export async function runValidation(): Promise<ValidationRunResult> {
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
    knowledgeCorpusInventoryInput,
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
    keqingLunarSourceConditionedCandidateLatticeInput,
    keqingLunarCrossRecordCompositionContractInput,
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
      readJson(KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH),
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
        KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
      ),
      readJson(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH),
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

      const comparisonStaticGeneratedFrom = await hashRelativePaths(
        DIONA_COMPARISON_INPUT_PATHS
      );
      const dionaInput = requiredManualSnapshotInputContaining(
        manualInputs,
        "kqm",
        "diona-support-weapons-luna-viii"
      );
      const expectedComparison = buildDionaComparisonReport(
        expectedKnowledge,
        ManualObservationSnapshotSchema.parse(dionaInput.snapshot),
        [...comparisonStaticGeneratedFrom, dionaInput.snapshotFile]
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
        DIONA_ER_ENGINE_INPUT_PATHS
      );
      const expectedErCalibration = buildDionaErCalibrationReport(
        expectedKnowledge,
        erEngineInputs
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
  const result = await runValidation();
  if (result.diagnostics.length > 0) {
    console.log(formatDiagnostics(result.diagnostics));
  }
  console.log(
    `Validation finished with ${result.errorCount} error(s) and ${result.warningCount} warning(s).`
  );
  if (result.errorCount > 0) process.exitCode = 1;
}
