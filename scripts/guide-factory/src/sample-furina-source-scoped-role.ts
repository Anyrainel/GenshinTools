import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS,
  runFurinaSourceScopedRoleSample,
  type FurinaSourceScopedRoleSampleReport,
} from "./furinaSourceScopedRoleSample";
import { readJson, sha256File, writeJson } from "./io";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

export function formatFurinaSourceScopedRoleSampleSummary(
  report: FurinaSourceScopedRoleSampleReport,
): string {
  const survivor = report.roleSample.survivor;
  return (
    `Wrote Furina source-scoped role sample: ${report.comparisonStatus}; ` +
    `${report.releasedCatalogBoundary.eligibleCharacterCount} eligible IDs; ` +
    `Xilonen binding multiplicity ${survivor?.structuralBindingMultiplicity ?? "withheld"}; ` +
    `broader roster status ${report.existingRosterDomainBoundary.observedStatus ?? "missing"}.`
  );
}

export async function runFurinaSourceScopedRoleSampleCli(): Promise<void> {
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
        FURINA_SOURCE_SCOPED_ROLE_SAMPLE_INPUT_PATHS.map(
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
  const report = await runFurinaSourceScopedRoleSample(
    KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs,
    checkedInRosterDomainReportInput,
    generatedFrom,
  );
  await writeJson(FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH, report);
  console.log(formatFurinaSourceScopedRoleSampleSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runFurinaSourceScopedRoleSampleCli();
}
