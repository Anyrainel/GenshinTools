import path from "node:path";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  buildArtifactChoiceSearchCoverageReport,
} from "./artifactChoiceSearchCoverage";
import { readJson, sha256File, writeJson } from "./io";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  ),
]);

const report = buildArtifactChoiceSearchCoverageReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom,
);
await writeJson(ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH, report);

const {
  all,
  guideBuilds,
  teamSelectedArtifacts,
  recommendations,
  teamArtifactPlanAssignments,
} = report.summary;
console.log(
  `Wrote ${all.total} artifact-choice coverage observations: ` +
    `guide-builds=${formatCounts(guideBuilds)}; ` +
    `team-selections=${formatCounts(teamSelectedArtifacts)}; ` +
    `recommendations=${formatCounts(recommendations)}; ` +
    `coupled-plan-assignments=${formatCounts(teamArtifactPlanAssignments)}.`,
);

function formatCounts(counts: typeof guideBuilds): string {
  return (
    `${counts.total} (${counts.enumeratedInitially} initial, ` +
    `${counts.conditionallyRepresentable} conditional, ` +
    `${counts.notRepresentable} not-representable)`
  );
}
