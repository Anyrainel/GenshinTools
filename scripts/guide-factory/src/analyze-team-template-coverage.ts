import path from "node:path";
import { loadGameCatalogs } from "./catalogs";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  TEAM_TEMPLATE_COVERAGE_REPORT_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";
import {
  buildTeamTemplateCoverageReport,
  TEAM_TEMPLATE_COVERAGE_INPUT_PATHS,
} from "./teamTemplateCoverage";

const [repositoryInput, catalogs, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  loadGameCatalogs(),
  Promise.all(
    TEAM_TEMPLATE_COVERAGE_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  ),
]);

const report = buildTeamTemplateCoverageReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  catalogs,
  generatedFrom,
);
await writeJson(TEAM_TEMPLATE_COVERAGE_REPORT_PATH, report);

const outcomeCounts = Object.fromEntries(
  ["present", "unresolved", "uncovered"].map((outcome) => [
    outcome,
    report.templates.filter((template) => template.outcome === outcome).length,
  ]),
);
console.log(
  `Wrote ${report.templates.length} template and ${report.exactTeams.length} external exact-team coverage rows: ` +
    Object.entries(outcomeCounts)
      .map(([outcome, count]) => `${outcome}=${count}`)
      .join(", "),
);
