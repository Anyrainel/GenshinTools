import path from "node:path";
import {
  buildDionaComparisonReport,
  DIONA_COMPARISON_INPUT_PATHS,
} from "./comparison";
import { readJson, sha256File, writeJson } from "./io";
import {
  DIONA_COMPARISON_REPORT_PATH,
  KQM_MANUAL_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
} from "./schemas";

const [repositoryInput, snapshotInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  readJson(KQM_MANUAL_SNAPSHOT_PATH),
  Promise.all(
    DIONA_COMPARISON_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    }))
  ),
]);

const report = buildDionaComparisonReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  ManualObservationSnapshotSchema.parse(snapshotInput),
  generatedFrom
);

await writeJson(DIONA_COMPARISON_REPORT_PATH, report);
console.log(
  `Wrote ${report.assertions.length} assertion-level Diona comparisons.`
);
