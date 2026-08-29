import path from "node:path";
import { fileURLToPath } from "node:url";

export const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const REPOSITORY_ROOT = path.resolve(FACTORY_ROOT, "../..");

export const SOURCE_REGISTRY_PATH = path.join(
  FACTORY_ROOT,
  "sources",
  "registry.json"
);
export const TEAM_PRESET_PATH = path.join(
  REPOSITORY_ROOT,
  "src",
  "presets",
  "team-comp",
  "[GGArtifact] 战舰队伍 Flagship Teams.json"
);
export const BUILD_PRESET_PATH = path.join(
  REPOSITORY_ROOT,
  "src",
  "presets",
  "artifact-builds",
  "[GGArtifact] 全角色配装 AllCharacterBuilds.json"
);
export const LEGACY_RESEARCH_PATH = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "team_comps_research.json"
);
export const GENSHINTOOLS_SNAPSHOT_PATH = path.join(
  FACTORY_ROOT,
  "data",
  "source-snapshots",
  "genshintools-presets.json"
);
export const LEGACY_SNAPSHOT_PATH = path.join(
  FACTORY_ROOT,
  "data",
  "source-snapshots",
  "legacy-team-research.json"
);
export const KQM_MANUAL_SNAPSHOT_PATH = path.join(
  FACTORY_ROOT,
  "data",
  "source-snapshots",
  "kqm-diona-manual.json"
);
export const KNOWLEDGE_REPOSITORY_PATH = path.join(
  FACTORY_ROOT,
  "data",
  "knowledge",
  "repository.json"
);
export const DIONA_COMPARISON_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "kqm-diona-comparison.json"
);
export const DIONA_ER_CALIBRATION_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "kqm-diona-er-calibration.json"
);
