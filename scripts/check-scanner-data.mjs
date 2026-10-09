import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const good = new URL("../public/good/", import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, good)));
const shared = await read("genshin_scanner_data.json");
const { mappings, capture } = shared;
assert.deepEqual(Object.keys(shared).sort(), ["capture", "formatVersion", "mappings", "sourceRevision"]);
assert.equal(shared.formatVersion, 1);
assert.equal(shared.sourceRevision, capture.git_hash);
assert.equal(capture.version, 1);
assert.ok(shared.sourceRevision);
for (const section of ["character_map", "weapon_map", "artifact_map", "affix_map", "property_map", "set_map", "skill_type_map"]) {
  assert.ok(Object.keys(capture[section]).length, `Empty capture table: ${section}`);
}
assert.ok(Object.keys(capture.artifact_map).length >= 100);
for (const section of ["characters", "weapons", "artifactSets"]) {
  const entries = mappings[section];
  assert.ok(entries.length, `Empty mappings: ${section}`);
  assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
  for (const entry of entries) assert.ok(entry.id && entry.n.zh);
}
for (const oldFile of ["mappings.json", "data_cache.json"]) {
  await assert.rejects(stat(new URL(oldFile, good)), { code: "ENOENT" });
}
console.log("Shared Genshin scanner/capture data verified; achievements remain separate.");
