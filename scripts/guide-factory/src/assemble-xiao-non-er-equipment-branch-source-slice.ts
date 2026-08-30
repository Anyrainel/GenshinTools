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
  buildXiaoNonErEquipmentBranchSourceSliceReport,
  requireComparableXiaoNonErEquipmentBranchSourceSliceReport,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH,
  XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS,
  type XiaoNonErEquipmentBranchSourceSliceReport,
} from "./xiaoNonErEquipmentBranchSourceSlice";
import { XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "./xiaoSourceLocalConditionSlice";

const XIAO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);

export function formatXiaoNonErEquipmentBranchSourceSliceSummary(
  report: XiaoNonErEquipmentBranchSourceSliceReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Xiao non-ER equipment branch source slice is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.occurrenceCount} Xiao non-ER source observations ` +
    `across ${report.summary.weaponGroupCount} weapon groups, ` +
    `${report.summary.mainStatChoiceGroupCount} main-stat groups, and ` +
    `${report.summary.substatPriorityGroupCount} substat-priority groups; ` +
    `candidates/builds: 0/0.`
  );
}

export async function runXiaoNonErEquipmentBranchSourceSliceCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
    Promise.all(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_INPUT_PATHS.map(
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
    xiaoSourceLocalDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
  const report = buildXiaoNonErEquipmentBranchSourceSliceReport(input);
  requireComparableXiaoNonErEquipmentBranchSourceSliceReport(report, input);
  await writeJson(XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH, report);
  console.log(formatXiaoNonErEquipmentBranchSourceSliceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoNonErEquipmentBranchSourceSliceCli();
}
