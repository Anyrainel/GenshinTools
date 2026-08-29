import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS,
  runKeqingSourceScopedRolePairSample,
  type KeqingSourceScopedRolePairSampleReport,
} from "./keqingSourceScopedRolePairSample";
import { readJson, sha256File, writeJson } from "./io";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

export function formatKeqingSourceScopedRolePairSampleSummary(
  report: KeqingSourceScopedRolePairSampleReport,
): string {
  const comparableTargets = report.rolePairSample.targets.filter(
    ({ comparisonStatus }) => comparisonStatus === "comparable",
  ).length;
  return (
    `Wrote Keqing source-scoped role-pair sample: ${report.comparisonStatus}; ` +
    `${comparableTargets}/${report.rolePairSample.targets.length} named targets comparable; ` +
    `fresh roster status ${report.existingRosterDomainBoundary.freshObservedStatus ?? "missing"}; ` +
    `checked-in roster status ${report.existingRosterDomainBoundary.checkedInObservedStatus ?? "missing"}.`
  );
}

export async function runKeqingSourceScopedRolePairSampleCli(): Promise<void> {
  const [
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    checkedInRosterDomainReportInput,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
    Promise.all(
      KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const manualInputs = await loadManualSnapshotInputs(
    manualIndexInput,
    sourceRegistryInput,
  );
  const report = await runKeqingSourceScopedRolePairSample(
    KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs,
    checkedInRosterDomainReportInput,
    generatedFrom,
  );
  await writeJson(
    KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
    report,
  );
  console.log(formatKeqingSourceScopedRolePairSampleSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingSourceScopedRolePairSampleCli();
}
