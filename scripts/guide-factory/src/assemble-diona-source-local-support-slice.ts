import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDionaSourceLocalSupportSliceReport,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_SOURCE_FILE_PATHS,
  requireComparableDionaSourceLocalSupportSliceReport,
  type DionaSourceLocalSupportSliceReport,
} from "./dionaSourceLocalSupportSlice";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const DIONA_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-diona-manual.json",
);

export function formatDionaSourceLocalSupportSliceSummary(
  report: DionaSourceLocalSupportSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Diona source-local support slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.selectedOccurrenceCount} exact same-record support-role bindings ` +
    `over ${report.summary.sourceTeamCount} Diona source team and ${report.summary.sourceCellCount} cells: ` +
    `${report.summary.sourceMatchedCount} source-matched, ` +
    `${report.summary.sourceInapplicableCount} source-inapplicable, ` +
    `${report.summary.sourceUnresolvedCount} source-unresolved, and ` +
    `${report.summary.contextApplicableCount} applicable under explicit exact-team role context; ` +
    `${report.summary.holdoutOccurrenceCount} nonempty occurrences were held out ` +
    `(${report.summary.ordinaryHoldoutInventoryCount} ordinary, ` +
    `${report.summary.erDeferredHoldoutInventoryCount} ER-deferred), ` +
    `${report.summary.emptyConditionArrayCount} empty arrays remained outside the slice, and 0 builds were assembled.`
  );
}

export async function runDionaSourceLocalSupportSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(DIONA_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
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
    Promise.all(
      DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const input = {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  };
  const report = buildDionaSourceLocalSupportSliceReport(input);
  requireComparableDionaSourceLocalSupportSliceReport(report, input);
  await writeJson(DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH, report);
  console.log(formatDionaSourceLocalSupportSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runDionaSourceLocalSupportSliceCli();
}
