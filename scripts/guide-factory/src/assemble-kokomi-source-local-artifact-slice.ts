import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKokomiSourceLocalArtifactSliceReport,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS,
  requireComparableKokomiSourceLocalArtifactSliceReport,
  type KokomiSourceLocalArtifactSliceReport,
} from "./kokomiSourceLocalArtifactSlice";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const KOKOMI_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-kokomi-manual.json",
);

export function formatKokomiSourceLocalArtifactSliceSummary(
  report: KokomiSourceLocalArtifactSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Kokomi source-local artifact slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.selectedOccurrenceCount} exact same-record artifact binding ` +
    `over ${report.summary.sourceTeamCount} Kokomi source team and ${report.summary.sourceCellCount} cell: ` +
    `${report.summary.sourceMatchedCount} source-matched, ` +
    `${report.summary.sourceInapplicableCount} source-inapplicable, ` +
    `${report.summary.sourceUnresolvedCount} source-unresolved, and ` +
    `${report.summary.sourceAlreadyMatchedCount} source-already-matched; ` +
    `${report.summary.holdoutOccurrenceCount} nonempty occurrences were held out without new bindings or classifications, ` +
    `${report.summary.emptyConditionArrayCount} empty arrays remained outside the slice, and 0 builds were assembled.`
  );
}

export async function runKokomiSourceLocalArtifactSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KOKOMI_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_SOURCE_FILE_PATHS.map(
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
      KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS.map(
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
  const report = buildKokomiSourceLocalArtifactSliceReport(input);
  requireComparableKokomiSourceLocalArtifactSliceReport(report, input);
  await writeJson(KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH, report);
  console.log(formatKokomiSourceLocalArtifactSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKokomiSourceLocalArtifactSliceCli();
}
