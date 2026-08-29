import { consolidateKnowledge } from "./consolidation";
import { readJson, sha256File, writeJson } from "./io";
import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  LEGACY_SNAPSHOT_PATH,
  SOURCE_REGISTRY_PATH,
} from "./paths";

const [genshinTools, legacy, sourceRegistrySha256] = await Promise.all([
  readJson(GENSHINTOOLS_SNAPSHOT_PATH),
  readJson(LEGACY_SNAPSHOT_PATH),
  sha256File(SOURCE_REGISTRY_PATH),
]);

const repository = consolidateKnowledge({
  sourceRegistrySha256,
  genshinTools,
  legacy,
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
