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
import { XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH } from "./xiaoFfxxNonErConditionFreeBranchCandidateContract";
import { XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH } from "./xiaoFfxxPartialArtifactCandidateContract";
import { XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH } from "./xiaoFfxxApplicableClaimProjectionContract";
import { XIAO_FORMULA_COUNT_PARITY_REPORT_PATH } from "./xiaoFormulaCountParity";
import { XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH } from "./xiaoNonErEquipmentBranchSourceSlice";
import { XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "./xiaoSourceLocalConditionSlice";
import {
  XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH,
} from "./xiaoFfxxGroupedReplayRepresentationPreflight";
import {
  authenticateXiaoFfxxUnitExpandedExecutionGate,
  buildXiaoFfxxUnitExpandedExecutionGateReport,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH,
  XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS,
  type XiaoFfxxUnitExpandedExecutionGateReport,
} from "./xiaoFfxxUnitExpandedExecutionGate";

const XIAO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);
const XIAO_ROTATION_FIXTURE_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-rotation-fixture-manual.json",
);
const GENSHINTOOLS_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "genshintools-presets.json",
);

export function formatXiaoFfxxUnitExpandedExecutionGateSummary(
  report: XiaoFfxxUnitExpandedExecutionGateReport,
): string {
  return (
    `Wrote ${report.summary.technicalObservationEligibleCount} authenticated Xiao FFXX unit-expanded technical observations; ` +
    "comparison/rank/winner/recommendation not performed."
  );
}

export async function runXiaoFfxxUnitExpandedExecutionGateCli(): Promise<void> {
  const [
    repositoryInput,
    xiaoManualSnapshotInput,
    xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    partialCandidateDurableReportInput,
    branchSourceDurableReportInput,
    branchCandidateDurableReportInput,
    formulaCountDurableReportInput,
    groupedReplayDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_SNAPSHOT_PATH),
    readJson(XIAO_ROTATION_FIXTURE_SNAPSHOT_PATH),
    readJson(GENSHINTOOLS_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
    readJson(XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH),
    readJson(XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH),
    readJson(XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH),
    readJson(XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH),
    readJson(XIAO_FORMULA_COUNT_PARITY_REPORT_PATH),
    readJson(XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH),
    Promise.all(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const input = {
    repositoryInput,
    xiaoManualSnapshotInput,
    xiaoRotationFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    partialCandidateDurableReportInput,
    branchSourceDurableReportInput,
    branchCandidateDurableReportInput,
    formulaCountDurableReportInput,
    groupedReplayDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
  const report = await buildXiaoFfxxUnitExpandedExecutionGateReport(input);
  const authentication = await authenticateXiaoFfxxUnitExpandedExecutionGate(
    report,
    input,
  );
  if (!authentication.authenticated) {
    throw new Error(
      `Fresh Xiao FFXX unit-expanded gate failed self-authentication (${authentication.reason}).`,
    );
  }
  await writeJson(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH, report);
  console.log(formatXiaoFfxxUnitExpandedExecutionGateSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoFfxxUnitExpandedExecutionGateCli();
}
