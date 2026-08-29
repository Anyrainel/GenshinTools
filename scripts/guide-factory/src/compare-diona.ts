import path from "node:path";
import {
  buildDionaComparisonReport,
  DIONA_COMPARISON_INPUT_PATHS,
} from "./comparison";
import { readJson, sha256File, writeJson } from "./io";
import {
  loadManualSnapshotInputs,
  requiredManualSnapshotInputContaining,
} from "./manualSnapshots";
import {
  DIONA_COMPARISON_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
} from "./schemas";

const [repositoryInput, manualIndexInput, sourceRegistryInput, staticGeneratedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  readJson(MANUAL_SNAPSHOT_INDEX_PATH),
  readJson(SOURCE_REGISTRY_PATH),
  Promise.all(
    DIONA_COMPARISON_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    }))
  ),
]);
const manualInputs = await loadManualSnapshotInputs(
  manualIndexInput,
  sourceRegistryInput
);
const dionaInput = requiredManualSnapshotInputContaining(
  manualInputs,
  "kqm",
  "diona-support-weapons-luna-viii",
);

const report = buildDionaComparisonReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  ManualObservationSnapshotSchema.parse(dionaInput.snapshot),
  [...staticGeneratedFrom, dionaInput.snapshotFile]
);

await writeJson(DIONA_COMPARISON_REPORT_PATH, report);
console.log(
  `Wrote ${report.assertions.length} assertion-level Diona comparisons.`
);
