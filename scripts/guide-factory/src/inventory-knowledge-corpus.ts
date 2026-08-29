import path from "node:path";
import {
  buildKnowledgeCorpusInventoryReport,
  KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS,
} from "./corpusInventory";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import {
  KnowledgeRepositorySchema,
  SourceRegistrySchema,
} from "./schemas";

const [repositoryInput, sourceRegistryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  readJson(SOURCE_REGISTRY_PATH),
  Promise.all(
    KNOWLEDGE_CORPUS_INVENTORY_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  ),
]);

const report = buildKnowledgeCorpusInventoryReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  SourceRegistrySchema.parse(sourceRegistryInput),
  generatedFrom,
);
await writeJson(KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH, report);

console.log(
  `Wrote a descriptive inventory of ${report.totals.records} records, ` +
    `${report.sources.length} generated sources, and ` +
    `${report.characters.length} explicitly derivable character rows.`,
);
