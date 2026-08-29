import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS,
  runKeqingIneffaTeamStatMarginalDiagnostic,
  type KeqingIneffaTeamStatMarginalDiagnosticReport,
} from "./keqingIneffaTeamStatMarginalDiagnostic";
import {
  KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

export function formatKeqingIneffaTeamStatMarginalDiagnosticSummary(
  report: KeqingIneffaTeamStatMarginalDiagnosticReport,
): string {
  const captured = report.capture.runs.filter(
    ({ outcome }) => outcome === "captured",
  ).length;
  const observedReplays =
    report.marginalDiagnostic?.execution.observedReplayCount ?? 0;
  const plannedReplays =
    report.marginalDiagnostic?.execution.plannedReplayCount ?? 148;
  const objectiveCoverageReviews =
    report.sourcePriorityOverlap?.objectiveCoverageReview.length ?? 0;
  return (
    `Wrote Keqing/Ineffa team-stat marginal diagnostic: ${captured}/4 endpoints captured, ` +
    `${observedReplays}/${plannedReplays} dual-path replays observed, ` +
    `${objectiveCoverageReviews} baseline-listed objective-coverage review case${objectiveCoverageReviews === 1 ? "" : "s"}, ` +
    `comparison ${report.comparisonStatus}.`
  );
}

export async function runKeqingIneffaTeamStatMarginalDiagnosticCli(): Promise<void> {
  const [repositoryInput, generatedFrom] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    Promise.all(
      KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = await runKeqingIneffaTeamStatMarginalDiagnostic(
    KnowledgeRepositorySchema.parse(repositoryInput),
    generatedFrom,
  );
  await writeJson(
    KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH,
    report,
  );
  console.log(formatKeqingIneffaTeamStatMarginalDiagnosticSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaTeamStatMarginalDiagnosticCli();
}
