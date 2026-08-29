import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameCatalogs } from "./catalogs";
import {
  buildDionaComparisonReport,
  DIONA_COMPARISON_INPUT_PATHS,
} from "./comparison";
import { consolidateKnowledge } from "./consolidation";
import {
  buildDionaErCalibrationReport,
  DIONA_ER_ENGINE_INPUT_PATHS,
} from "./dionaErCalibration";
import {
  importGenshinToolsPresets,
  importLegacyTeamResearch,
} from "./importers";
import { readJson, sha256File, stableJson } from "./io";
import {
  DIONA_COMPARISON_REPORT_PATH,
  DIONA_ER_CALIBRATION_REPORT_PATH,
  GENSHINTOOLS_SNAPSHOT_PATH,
  KQM_MANUAL_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  LEGACY_SNAPSHOT_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
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
  validateSourceRegistry,
  validateWorkspaceBoundary,
  type ValidationDiagnostic,
} from "./validation";

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
    kqmInput,
    knowledgeInput,
    comparisonInput,
    erCalibrationInput,
  ] =
    await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(GENSHINTOOLS_SNAPSHOT_PATH),
      readJson(LEGACY_SNAPSHOT_PATH),
      readJson(KQM_MANUAL_SNAPSHOT_PATH),
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(DIONA_COMPARISON_REPORT_PATH),
      readJson(DIONA_ER_CALIBRATION_REPORT_PATH),
    ]);

  diagnostics.push(...validateSourceRegistry(registryInput));
  diagnostics.push(
    ...validateGenshinToolsSnapshot(genshinToolsInput, catalogs)
  );
  diagnostics.push(...validateLegacySnapshot(legacyInput, catalogs));
  diagnostics.push(
    ...validateManualObservationSnapshot(kqmInput, catalogs, "kqm")
  );

  const registry = SourceRegistrySchema.safeParse(registryInput);
  const genshinTools =
    GenshinToolsPresetSnapshotSchema.safeParse(genshinToolsInput);
  const legacy = LegacyTeamSnapshotSchema.safeParse(legacyInput);
  const kqm = ManualObservationSnapshotSchema.safeParse(kqmInput);
  const knowledge = KnowledgeRepositorySchema.safeParse(knowledgeInput);
  if (
    registry.success &&
    genshinTools.success &&
    legacy.success &&
    kqm.success &&
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
        manualSnapshots: [kqm.data],
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
        sourceRegistrySha256,
        genshinTools: expectedGenshinTools,
        legacy: expectedLegacy,
        kqm: kqm.data,
        kqmSnapshotFile: {
          path: KQM_MANUAL_SNAPSHOT_PATH.slice(
            REPOSITORY_ROOT.length + 1
          ).replaceAll("\\", "/"),
          sha256: await sha256File(KQM_MANUAL_SNAPSHOT_PATH),
        },
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

      const comparisonGeneratedFrom = await hashRelativePaths(
        DIONA_COMPARISON_INPUT_PATHS
      );
      const expectedComparison = buildDionaComparisonReport(
        expectedKnowledge,
        kqm.data,
        comparisonGeneratedFrom
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
