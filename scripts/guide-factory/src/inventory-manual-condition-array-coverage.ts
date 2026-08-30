import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameCatalogs } from "./catalogs";
import { readJson, sha256File, writeJson } from "./io";
import { ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH } from "./ittoSourceConditionedGuidePacket";
import {
  buildManualConditionArrayCoverageReport,
  MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
  MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH,
  MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
  requireComparableManualConditionArrayCoverageReport,
  selectManualConditionCoverageSnapshots,
  type ManualConditionArrayCoverageReport,
} from "./manualConditionArrayCoverageReport";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "./paths";

export function formatManualConditionArrayCoverageSummary(
  report: ManualConditionArrayCoverageReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Manual condition-array coverage is not comparable: ${report.issues.length} issue(s).`;
  }
  const coverage = report.summary.nonStructuralBindingCoverage;
  return (
    `Wrote ${report.summary.total.occurrenceCount} exact manual condition arrays: ` +
    `${coverage.typedBoundOccurrenceCount} typed-bound, ` +
    `${coverage.exactTextAcknowledgedOccurrenceCount} exact-text acknowledged, and ` +
    `${coverage.unboundOccurrenceCount} unbound across ` +
    `${coverage.occurrenceCount} non-structural binding-coverage occurrences; ` +
    `${report.summary.displayStatusCounts["er-deferred"]} ER-related occurrences remain deferred.`
  );
}

export async function runManualConditionArrayCoverageCli(): Promise<void> {
  const [
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    checkedInRosterDomainReportInput,
    ittoDurableReportInput,
    keqingEquipmentDurableReportInput,
    keqingRolePairDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
    readJson(ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH),
    readJson(KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH),
    readJson(KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH),
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
    Promise.all(
      MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const manualInputs = selectManualConditionCoverageSnapshots(
    await loadManualSnapshotInputs(manualIndexInput, sourceRegistryInput),
  );
  const report = await buildManualConditionArrayCoverageReport({
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    manualInputs,
    catalogs,
    checkedInRosterDomainReportInput,
    ittoDurableReportInput,
    keqingEquipmentDurableReportInput,
    keqingRolePairDurableReportInput,
    sourceFiles,
    generatedFrom,
  });
  requireComparableManualConditionArrayCoverageReport(report, generatedFrom);
  await writeJson(MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH, report);
  console.log(formatManualConditionArrayCoverageSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runManualConditionArrayCoverageCli();
}
