import path from "node:path";
import {
  buildFurinaNeuvilletteFormulaDraftReport,
  FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS,
} from "./furinaNeuvilletteFormulaDraft";
import { readJson, sha256File, writeJson } from "./io";
import {
  FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  ),
]);

const report = await buildFurinaNeuvilletteFormulaDraftReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom,
);
await writeJson(FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH, report);

console.log(
  `Wrote ${report.lines.length} positive defaults, ${report.zeroCountAvailableFormulas.length} zero defaults, and ${report.authoredTranslation.mismatches.length} source-rotation mismatches for domain review.`,
);
