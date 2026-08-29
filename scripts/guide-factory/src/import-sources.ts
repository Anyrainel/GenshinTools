import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  LEGACY_SNAPSHOT_PATH,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import { readJson, writeJson } from "./io";
import {
  importGenshinToolsPresets,
  importLegacyTeamResearch,
} from "./importers";

const registry = await readJson(SOURCE_REGISTRY_PATH);
const genshinTools = await importGenshinToolsPresets(registry);
const legacy = await importLegacyTeamResearch(registry);

await writeJson(GENSHINTOOLS_SNAPSHOT_PATH, genshinTools);
await writeJson(LEGACY_SNAPSHOT_PATH, legacy);

console.log(
  `Imported ${genshinTools.teams.length} baseline teams, ` +
    `${genshinTools.characterGuides.length} baseline character guides, and ` +
    `${legacy.records.length} legacy candidate teams.`
);
