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
import { XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH } from "./xiaoFfxxApplicableClaimProjectionContract";
import {
  authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic,
  buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_REPORT_PATH,
  XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS,
  type XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
} from "./xiaoFfxxFiveStarSourceGroupValidationDiagnostic";
import { XIAO_FFXX_GROUPED_REPLAY_REPRESENTATION_PREFLIGHT_REPORT_PATH } from "./xiaoFfxxGroupedReplayRepresentationPreflight";
import { XIAO_FFXX_NON_ER_CONDITION_FREE_BRANCH_CANDIDATE_REPORT_PATH } from "./xiaoFfxxNonErConditionFreeBranchCandidateContract";
import { XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH } from "./xiaoFfxxPartialArtifactCandidateContract";
import { XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH } from "./xiaoFfxxUnitExpandedExecutionGate";
import { XIAO_FORMULA_COUNT_PARITY_REPORT_PATH } from "./xiaoFormulaCountParity";
import { XIAO_NON_ER_EQUIPMENT_BRANCH_SOURCE_SLICE_REPORT_PATH } from "./xiaoNonErEquipmentBranchSourceSlice";
import { XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "./xiaoSourceLocalConditionSlice";

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

export function formatXiaoFfxxFiveStarSourceGroupValidationDiagnosticSummary(
  report: XiaoFfxxFiveStarSourceGroupValidationDiagnosticReport,
): string {
  return (
    `Wrote ${report.summary.exhaustiveCrossGroupPairCount} authenticated Xiao FFXX five-star source-group validation pairs ` +
    `(${report.summary.sourceOrderAlignedPairCount} aligned, ` +
    `${report.summary.sourceOrderCounterexamplePairCount} counterexamples, ` +
    `${report.summary.withinToleranceTiePairCount} ties); no rank, winner, or recommendation produced.`
  );
}

export async function runXiaoFfxxFiveStarSourceGroupValidationDiagnosticCli(): Promise<void> {
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
    unitExpandedDurableReportInput,
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
    readJson(XIAO_FFXX_UNIT_EXPANDED_EXECUTION_GATE_REPORT_PATH),
    Promise.all(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_INPUT_PATHS.map(
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
    unitExpandedDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
  const report =
    await buildXiaoFfxxFiveStarSourceGroupValidationDiagnosticReport(input);
  const authentication =
    await authenticateXiaoFfxxFiveStarSourceGroupValidationDiagnostic(
      report,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `Fresh Xiao FFXX five-star source-group diagnostic failed self-authentication (${authentication.reason}).`,
    );
  }
  await writeJson(
    XIAO_FFXX_FIVE_STAR_SOURCE_GROUP_VALIDATION_DIAGNOSTIC_REPORT_PATH,
    report,
  );
  console.log(
    formatXiaoFfxxFiveStarSourceGroupValidationDiagnosticSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoFfxxFiveStarSourceGroupValidationDiagnosticCli();
}
