import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";
import {
  runTeamRosterCandidateDomainExperiment,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS,
  type TeamRosterCandidateDomainExperimentReport,
} from "./teamRosterCandidateDomainExperiment";

export function formatTeamRosterCandidateDomainExperimentSummary(
  report: TeamRosterCandidateDomainExperimentReport,
): string {
  const comparableCount = report.domain.templates.filter(
    ({ status }) => status === "comparable",
  ).length;
  const withheldCount = report.domain.templates.filter(
    ({ status }) => status === "withheld-unresolved-role",
  ).length;
  const notComparableCount = report.domain.templates.filter(
    ({ status }) => status === "not-comparable",
  ).length;
  const matchingHoldoutCount = report.domain.holdouts.filter(
    ({ matchesExpectation }) => matchesExpectation,
  ).length;
  return (
    `Wrote bounded team-roster candidate domain: ${report.comparisonStatus}; ` +
    `${comparableCount} comparable, ${withheldCount} role-withheld, ` +
    `${notComparableCount} not-comparable templates; ` +
    `${matchingHoldoutCount}/${report.domain.holdouts.length} validation associations matched.`
  );
}

export async function runTeamRosterCandidateDomainExperimentCli(): Promise<void> {
  const [repositoryInput, generatedFrom] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    Promise.all(
      TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = await runTeamRosterCandidateDomainExperiment(
    KnowledgeRepositorySchema.parse(repositoryInput),
    generatedFrom,
  );
  await writeJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH, report);
  console.log(formatTeamRosterCandidateDomainExperimentSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runTeamRosterCandidateDomainExperimentCli();
}
