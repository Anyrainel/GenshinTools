import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const good = new URL("../public/good/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, good)));
const [shared, mappings, capture] = await Promise.all([
  read("genshin_scanner_data.json"),
  read("mappings.json"),
  read("data_cache.json"),
]);
assert.deepEqual(Object.keys(shared).sort(), ["capture", "formatVersion", "mappings", "sourceRevision"]);
assert.equal(shared.formatVersion, 1);
assert.equal(shared.sourceRevision, capture.git_hash);
assert.deepEqual(shared.mappings, mappings);
assert.deepEqual(shared.capture, capture);
assert.ok(Object.keys(capture.artifact_map).length >= 100);
for (const section of ["characters", "weapons", "artifactSets"]) assert.ok(mappings[section].length);
console.log("Shared Genshin scanner/capture data verified; achievements remain separate.");
