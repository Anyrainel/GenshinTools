import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  type KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyRobustnessCensus";
import {
  KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH,
  type KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
} from "./keqingIneffaFurinaXilonenCachedPolicyAudit";
import { REPOSITORY_ROOT } from "./paths";

export function formatKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusSummary(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
): string {
  if (
    report.validationStatus !==
      "authenticated-completed-cached-policy-robustness-census-source-not-ready" ||
    !report.census
  ) {
    return `Keqing/Ineffa/Furina/Xilonen cached-policy robustness census is not authenticated: ${report.issues.length} issue(s).`;
  }
  const forbiddenSeamSummary =
    report.executionBoundary.forbiddenSeamCallCountsAttestation ===
    "verified-zero-default-environment"
      ? "0 generator, replay, downstream optimizer, recommendation, rank, or ER calls; CP40 ER-deferral provenance authenticated and no ER values projected."
      : "generator, replay, downstream optimizer, recommendation, rank, and ER calls are uncharacterized for the injected census builder; CP40 ER-deferral provenance authenticated and no ER values projected by this wrapper.";
  return (
    `Wrote authenticated cached-policy robustness census for ${report.census.nodeCount} nodes and ${report.census.startCount} starts: ` +
    `${report.census.declaredOrderFamily.effectiveOrderCount} effective declared orders, ` +
    `${report.census.declaredOrderFamily.traceCount} declared-order traces, ` +
    `${report.census.bestImprovementAllStarts.terminalBasins.length} best-improvement basins, and ` +
    `${report.census.execution.totalPolicyCalls} reported cached policy calls; ${forbiddenSeamSummary} ` +
    "This is a source-not-ready technical policy census, not a guide, rank, recommendation, or optimality claim."
  );
}

export async function writeAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
  report: KeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport,
  writer: typeof writeJson = writeJson,
): Promise<void> {
  requireAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
    report,
  );
  await writer(
    KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_REPORT_PATH,
    report,
  );
}

export async function runKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusCli(): Promise<void> {
  const [cp40Report, inputFiles] = await Promise.all([
    readJson(KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_AUDIT_REPORT_PATH),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_CACHED_POLICY_ROBUSTNESS_CENSUS_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report =
    buildKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport({
      cp40Report:
        cp40Report as KeqingIneffaFurinaXilonenCachedPolicyAuditReport,
      inputFiles,
    });
  await writeAuthenticatedKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusReport(
    report,
  );
  console.log(
    formatKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenCachedPolicyRobustnessCensusCli();
}
