import path from "node:path";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingIneffaArtifactGenerationPreflightReport,
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
} from "./keqingIneffaArtifactGenerationPreflight";
import {
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  ),
]);

const report = await buildKeqingIneffaArtifactGenerationPreflightReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom,
);
await writeJson(
  KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH,
  report,
);

console.log(
  `Wrote artifact-generation preflight for ${report.members.length} members: ` +
    `technical probe ${report.equipmentReadyForTechnicalProbe ? "ready" : "blocked"}; ` +
    `reviewed experiment ${report.readyForReviewedGeneratorExperiment ? "ready" : "blocked"}; ` +
    `${report.blockers.length} blocker(s).`,
);
