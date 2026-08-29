import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKleeSourceLocalConditionSliceReport,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  requireComparableKleeSourceLocalConditionSliceReport,
  type KleeSourceLocalConditionSliceReport,
} from "./kleeSourceLocalConditionSlice";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const KLEE_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-klee-manual.json",
);

export function formatKleeSourceLocalConditionSliceSummary(
  report: KleeSourceLocalConditionSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Klee source-local condition slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.selectedOccurrenceCount} exact Klee condition bindings ` +
    `over ${report.summary.sourceTeamCount} source teams and ${report.summary.sourceCellCount} cells: ` +
    `${report.summary.sourceMatchedCount} source-matched, ` +
    `${report.summary.sourceInapplicableCount} source-inapplicable, ` +
    `${report.summary.sourceUnresolvedCount} source-unresolved, and ` +
    `${report.summary.contextApplicableCount} applicable under explicit team-scoped role context; ` +
    `${report.summary.holdoutOccurrenceCount} Klee occurrences were held out from this binding slice and 0 builds were assembled.`
  );
}

export async function runKleeSourceLocalConditionSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KLEE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS.map(
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
      KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
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
  const report = buildKleeSourceLocalConditionSliceReport(input);
  requireComparableKleeSourceLocalConditionSliceReport(report, input);
  await writeJson(KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH, report);
  console.log(formatKleeSourceLocalConditionSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKleeSourceLocalConditionSliceCli();
}
