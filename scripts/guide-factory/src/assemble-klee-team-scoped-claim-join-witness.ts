import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKleeTeamScopedClaimJoinWitnessReport,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH,
  KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS,
  requireComparableKleeTeamScopedClaimJoinWitnessReport,
  type KleeTeamScopedClaimJoinWitnessReport,
} from "./kleeTeamScopedClaimJoinWitness";
import { KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH } from "./kleeSourceLocalConditionSlice";
import { readJson, sha256File, writeJson } from "./io";
import { MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH } from "./manualConditionArrayCoverageReport";
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

export function formatKleeTeamScopedClaimJoinWitnessSummary(
  report: KleeTeamScopedClaimJoinWitnessReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Klee team-scoped claim-join witness is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.positiveWitnessCount} flat Klee same-team witness with ` +
    `${report.summary.positiveClaimCount} independently applicable claims from ` +
    `${report.summary.positiveSourceRecordCount} source records; the Overload control retains ` +
    `${report.summary.negativeControlInapplicableClaimCount} source-definitely-inapplicable roster claim, ` +
    `with 0 builds and 0 candidates assembled.`
  );
}

export async function runKleeTeamScopedClaimJoinWitnessCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    kleeDurableReportInput,
    manualCoverageDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KLEE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH),
    readJson(MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH),
    Promise.all(
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_SOURCE_FILE_PATHS.map(
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
      KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_INPUT_PATHS.map(
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
    kleeDurableReportInput,
    manualCoverageDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
  const report = buildKleeTeamScopedClaimJoinWitnessReport(input);
  requireComparableKleeTeamScopedClaimJoinWitnessReport(report, input);
  await writeJson(KLEE_TEAM_SCOPED_CLAIM_JOIN_WITNESS_REPORT_PATH, report);
  console.log(formatKleeTeamScopedClaimJoinWitnessSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKleeTeamScopedClaimJoinWitnessCli();
}
