import path from "node:path";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingIneffaFormulaDraftReport,
  KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
} from "./keqingIneffaFormulaDraft";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    }))
  ),
]);

const report = await buildKeqingIneffaFormulaDraftReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom
);
await writeJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH, report);

console.log(
  `Wrote ${report.lines.length} positive defaults, ` +
    `${report.zeroCountAvailableFormulas.length} zero defaults, ` +
    `${report.authoredTranslation.discrepancies.length} direct-count discrepancies, and ` +
    `${report.damageReplayReadiness.blockers.length} damage-replay readiness blockers for domain review.`
);
