import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import {
  buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
  type KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
} from "./keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import { REPOSITORY_ROOT } from "./paths";

export function formatKeqingIneffaFurinaXilonenEquipmentRuntimePreflightSummary(
  report: KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
): string {
  if (
    report.validationStatus !==
    "authenticated-materialized-objective-not-ready"
  ) {
    return `Keqing/Ineffa/Furina/Xilonen equipment runtime preflight is not authenticated: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote authenticated materialization-only equipment preflight: ` +
    `${report.summary.materializedNodeCount}/${report.summary.candidateNodeCount} nodes, ` +
    `${report.summary.objectiveFormulaAvailabilityCheckCount} objective formula checks, ` +
    `${report.sourceBoundary.sourceReadiness.blockerCount} retained source-readiness blockers; ` +
    `0 generator calls, replays, damage results, ranks, recommendations, or ER requirements.`
  );
}

export async function runKeqingIneffaFurinaXilonenEquipmentRuntimePreflightCli(): Promise<void> {
  const [latticeReport, formulaDraft, inputFiles] = await Promise.all([
    readJson(
      path.join(
        REPOSITORY_ROOT,
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[0],
      ),
    ),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS[1],
      ),
    ),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report =
    await buildKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport({
      latticeReport:
        latticeReport as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
      formulaDraft: formulaDraft as KeqingIneffaFormulaDraftReport,
      inputFiles,
    });
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport(
    report,
  );
  await writeJson(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_RUNTIME_PREFLIGHT_REPORT_PATH,
    report,
  );
  console.log(
    formatKeqingIneffaFurinaXilonenEquipmentRuntimePreflightSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenEquipmentRuntimePreflightCli();
}
