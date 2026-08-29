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
  loadManualSnapshotInputs,
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "./manualSnapshots";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
  DIONA_COMPARISON_REPORT_PATH,
  DIONA_ER_CALIBRATION_REPORT_PATH,
  FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH,
  GENSHINTOOLS_SNAPSHOT_PATH,
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  LEGACY_SNAPSHOT_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_TEMPLATE_COVERAGE_REPORT_PATH,
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
