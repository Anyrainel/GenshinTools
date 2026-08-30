import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyAudit";
import type { KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport } from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import type { KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport } from "./keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import { REPOSITORY_ROOT } from "./paths";

const CP38_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json";
const CP39_REPORT_PATH =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-generated-sheet-evidence.json";

export function formatKeqingIneffaFurinaXilonenCachedPolicyAuditSummary(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
): string {
  if (
    report.validationStatus !==
      "authenticated-completed-cached-policy-audit-source-not-ready" ||
    !report.policyAudit
  ) {
    return `Keqing/Ineffa/Furina/Xilonen cached-policy audit is not authenticated: ${report.issues.length} issue(s).`;
  }
  const forbiddenSeamSummary =
    report.executionBoundary.forbiddenSeamCallCountsAttestation ===
    "verified-zero-default-environment"
      ? "0 evaluator, generator, replay, optimizer, rank, recommendation, or ER calls. CP39 ER-deferral provenance was authenticated; no ER value influenced the default cached policies."
      : "Evaluator, generator, replay, optimizer, rank, recommendation, and ER call counts are uncharacterized for the injected policy environment. CP39 ER-deferral provenance was authenticated; CP40 projected no ER values, while injected-policy ER-value influence remains uncharacterized.";
  return (
    `Wrote authenticated cached-policy audit for ${report.nodes.length} CP38 nodes: ` +
    `one-shot sequence ${sequencePath(report, report.policyAudit.oneShotBestNeighbor.pathNodeIds)}, ` +
    `iterative best-improvement sequence ${sequencePath(report, report.policyAudit.iterativeBestImprovement.pathNodeIds)}, ` +
    `declared first-improvement sequence ${sequencePath(report, report.policyAudit.declaredFirstImprovement.pathNodeIds)}; ` +
    `${report.reviewBoundary.occurrenceCount} exact CP39 node/carry/character diagnostics; ` +
    `${forbiddenSeamSummary} ` +
    `This is a source-not-ready technical policy audit, not a guide or equipment recommendation.`
  );
}

export async function runKeqingIneffaFurinaXilonenCachedPolicyAuditCli(): Promise<void> {
  const readInput = (relativePath: string) =>
    readJson(path.join(REPOSITORY_ROOT, relativePath));
  const [cp38Report, cp39Report, inputFiles] = await Promise.all([
    readInput(CP38_REPORT_PATH),
    readInput(CP39_REPORT_PATH),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = buildKeqingIneffaFurinaXilonenCachedPolicyAuditReport({
    cp38Report:
      cp38Report as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
    cp39Report:
      cp39Report as KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
    inputFiles,
  });
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyAuditReport(report);
  await writeJson(
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
    report,
  );
  console.log(formatKeqingIneffaFurinaXilonenCachedPolicyAuditSummary(report));
}

function sequencePath(
  report: KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
  nodeIds: readonly string[],
): string {
  const sequenceByNodeId = new Map(
    report.nodes.map(({ sequence, nodeId }) => [nodeId, sequence]),
  );
  return nodeIds.map((nodeId) => sequenceByNodeId.get(nodeId)).join("→");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenCachedPolicyAuditCli();
}
