import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildNoelleSourceLocalHighInvestmentSliceReport,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  requireComparableNoelleSourceLocalHighInvestmentSliceReport,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const NOELLE_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-noelle-manual.json",
);

export function formatNoelleSourceLocalHighInvestmentSliceSummary(
  report: NoelleSourceLocalHighInvestmentSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Noelle source-local high-investment slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.selectedOccurrenceCount} exact Noelle high-investment numeric bindings ` +
    `over ${report.summary.sourceTeamCount} exact source team and ${report.summary.sourceCellCount} cells: ` +
    `${report.summary.sourceMatchedCount} source-matched, ` +
    `${report.summary.sourceInapplicableCount} source-inapplicable, ` +
    `${report.summary.sourceUnresolvedCount} source-unresolved, and ` +
    `${report.summary.contextApplicableCount} applicable under the supplied C6 request context; ` +
    `${report.summary.holdoutOccurrenceCount} nonempty occurrences were held out without new bindings or classifications, ` +
    `${report.summary.emptyConditionArrayCount} empty array was authenticated without a binding, and 0 candidates, equipment assignments, optimizations, or builds were produced.`
  );
}

export async function runNoelleSourceLocalHighInvestmentSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(NOELLE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS.map(
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
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS.map(
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
  const report = buildNoelleSourceLocalHighInvestmentSliceReport(input);
  requireComparableNoelleSourceLocalHighInvestmentSliceReport(report, input);
  await writeJson(NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH, report);
  console.log(formatNoelleSourceLocalHighInvestmentSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleSourceLocalHighInvestmentSliceCli();
}
