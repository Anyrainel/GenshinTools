import { consolidateKnowledge } from "./consolidation";
import { readJson, sha256File, writeJson } from "./io";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  LEGACY_SNAPSHOT_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "./paths";

const [genshinTools, legacy, manualIndex, sourceRegistry, sourceRegistrySha256] =
  await Promise.all([
  readJson(GENSHINTOOLS_SNAPSHOT_PATH),
  readJson(LEGACY_SNAPSHOT_PATH),
  readJson(MANUAL_SNAPSHOT_INDEX_PATH),
  readJson(SOURCE_REGISTRY_PATH),
  sha256File(SOURCE_REGISTRY_PATH),
]);
const manualSnapshots = await loadManualSnapshotInputs(
  manualIndex,
  sourceRegistry
);

const repository = consolidateKnowledge({
  sourceRegistry,
  sourceRegistrySha256,
  genshinTools,
  legacy,
  manualSnapshots,
});

await writeJson(KNOWLEDGE_REPOSITORY_PATH, repository);

const baselineCount = repository.records.filter(
  (record) => record.status === "baseline"
).length;
const candidateCount = repository.records.filter(
  (record) => record.status === "candidate"
).length;

console.log(
  `Consolidated ${baselineCount} baseline records and ` +
    `${candidateCount} candidate records.`
);
