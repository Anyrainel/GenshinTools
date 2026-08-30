import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
  type KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
} from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import type { KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport } from "./keqingIneffaFurinaXilonenEquipmentRuntimePreflight";
import { REPOSITORY_ROOT } from "./paths";

export function formatKeqingIneffaFurinaXilonenEquipmentTechnicalComputationSummary(
  report: KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
): string {
  if (
    report.validationStatus !==
    "authenticated-completed-technical-objective-source-not-ready"
  ) {
    return `Keqing/Ineffa/Furina/Xilonen bounded equipment technical computation is not authenticated: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote authenticated bounded equipment technical computation: ` +
    `${report.executionBoundary.nodeCount} nodes, ` +
    `${report.executionBoundary.observedGeneratorInvocationCount} fresh generator runs, ` +
    `${report.executionBoundary.observedReplayCount} node-local technical replays ` +
    `(${report.provenanceBoundary.intactGeneratorEndpointCompositionCount} intact-generator-endpoint and ` +
    `${report.provenanceBoundary.crossEndpointRecombinationCount} cross-endpoint recombinations); ` +
    `all ${report.provenanceBoundary.nodesWithCrossEndpointBoundedTechnicalReference} node maxima are synthetic technical references; ` +
    `0 ranks, recommendations, guides, damage/DPS claims, optimality claims, or ER requirements.`
  );
}

export async function runKeqingIneffaFurinaXilonenEquipmentTechnicalComputationCli(): Promise<void> {
  const sourceReportPath = path.join(
    REPOSITORY_ROOT,
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS[0],
  );
  const [sourcePreflight, inputFiles] = await Promise.all([
    readJson(sourceReportPath),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report =
    await buildKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport({
      sourcePreflight:
        sourcePreflight as KeqingIneffaFurinaXilonenEquipmentRuntimePreflightReport,
      inputFiles,
    });
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport(
    report,
  );
  await writeJson(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_TECHNICAL_COMPUTATION_REPORT_PATH,
    report,
  );
  console.log(
    formatKeqingIneffaFurinaXilonenEquipmentTechnicalComputationSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenEquipmentTechnicalComputationCli();
}
