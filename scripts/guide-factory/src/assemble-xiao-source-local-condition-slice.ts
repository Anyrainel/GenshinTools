import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";
import {
  buildXiaoSourceLocalConditionSliceReport,
  requireComparableXiaoSourceLocalConditionSliceReport,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  type XiaoSourceLocalConditionSliceReport,
} from "./xiaoSourceLocalConditionSlice";

const XIAO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);

export function formatXiaoSourceLocalConditionSliceSummary(
  report: XiaoSourceLocalConditionSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Xiao source-local condition slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.selectedOccurrenceCount} exact Xiao condition bindings ` +
    `over ${report.summary.sourceTeamCount} source team and ${report.summary.sourceCellCount} cells: ` +
    `${report.summary.sourceMatchedCount} source-matched, ` +
    `${report.summary.sourceUnresolvedCount} source-unresolved, and ` +
    `${report.summary.contextApplicableCount} applicable under explicit team-scoped C6 context; ` +
    `${report.summary.holdoutOccurrenceCount} nonempty occurrences and ` +
    `${report.summary.emptyConditionArrayCount} empty arrays remain unconsumed, and 0 builds were assembled.`
  );
}

export async function runXiaoSourceLocalConditionSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualSnapshotText,
    manualIndexInput,
    sourceRegistryInput,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_SNAPSHOT_PATH),
    readFile(XIAO_MANUAL_SNAPSHOT_PATH, "utf8"),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
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
    manualSnapshotText,
    manualIndexInput,
    sourceRegistryInput,
    generatedFrom,
  };
  const report = buildXiaoSourceLocalConditionSliceReport(input);
  requireComparableXiaoSourceLocalConditionSliceReport(report, input);
  await writeJson(XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH, report);
  console.log(formatXiaoSourceLocalConditionSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoSourceLocalConditionSliceCli();
}
