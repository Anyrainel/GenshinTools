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
import { XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "./xiaoSourceLocalConditionSlice";
import {
  buildXiaoFfxxPartialArtifactCandidateContractReport,
  requireComparableXiaoFfxxPartialArtifactCandidateContract,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH,
  XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS,
  type XiaoFfxxPartialArtifactCandidateContractReport,
} from "./xiaoFfxxPartialArtifactCandidateContract";
import { XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH } from "./xiaoFfxxApplicableClaimProjectionContract";

const XIAO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);

export function formatXiaoFfxxPartialArtifactCandidateSummary(
  report: XiaoFfxxPartialArtifactCandidateContractReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Xiao FFXX partial artifact candidate is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.uniquePartialTechnicalCandidateCount} Xiao FFXX partial technical candidate ` +
    `with ${report.summary.viewCandidateBindingCount} provenance bindings, ` +
    `${report.summary.presentAxisCount} present axes, ${report.summary.missingAxisCount} missing axes, ` +
    `and 0 complete builds.`
  );
}

export async function runXiaoFfxxPartialArtifactCandidateCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    xiaoSourceLocalDurableReportInput,
    applicableClaimDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
    readJson(XIAO_FFXX_APPLICABLE_CLAIM_PROJECTION_REPORT_PATH),
    Promise.all(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_INPUT_PATHS.map(
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
    applicableClaimDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
  const report = buildXiaoFfxxPartialArtifactCandidateContractReport(input);
  requireComparableXiaoFfxxPartialArtifactCandidateContract(report, input);
  await writeJson(XIAO_FFXX_PARTIAL_ARTIFACT_CANDIDATE_REPORT_PATH, report);
  console.log(formatXiaoFfxxPartialArtifactCandidateSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoFfxxPartialArtifactCandidateCli();
}
