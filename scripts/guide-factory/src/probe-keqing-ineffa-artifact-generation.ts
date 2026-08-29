import path from "node:path";
import { readJson, sha256File, writeJson } from "./io";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
  runKeqingIneffaArtifactGenerationTechnicalProbe,
} from "./keqingIneffaArtifactGenerationTechnicalProbe";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  ),
]);

const report = await runKeqingIneffaArtifactGenerationTechnicalProbe(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom,
);
await writeJson(
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH,
  report,
);

const completed = report.candidates.filter(
  ({ outcome }) => outcome === "completed-structurally",
).length;
const rejected = report.candidates.filter(
  ({ outcome }) => outcome === "rejected-before-run",
).length;
const failed = report.candidates.filter(
  ({ outcome }) => outcome === "failed-during-run",
).length;

console.log(
  `Wrote artifact-generation technical probe: ${completed} completed, ` +
    `${rejected} rejected before run, ${failed} failed during run.`,
);
