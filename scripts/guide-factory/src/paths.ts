import path from "node:path";
import { fileURLToPath } from "node:url";

export const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
export const REPOSITORY_ROOT = path.resolve(FACTORY_ROOT, "../..");
export const SOURCE_SNAPSHOT_ROOT = path.join(
  FACTORY_ROOT,
  "data",
  "source-snapshots"
);

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
  SOURCE_SNAPSHOT_ROOT,
  "genshintools-presets.json"
);
export const LEGACY_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "legacy-team-research.json"
);
export const KQM_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-diona-manual.json"
);
export const MANUAL_SNAPSHOT_INDEX_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "manual-index.json"
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
export const TEAM_TEMPLATE_COVERAGE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "team-template-coverage.json"
);
export const FURINA_NEUVILLETTE_FORMULA_DRAFT_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "furina-neuvillette-formula-plan-draft.json"
);
export const KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "keqing-ineffa-formula-plan-draft.json"
);
export const KNOWLEDGE_CORPUS_INVENTORY_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "knowledge-corpus-inventory.json"
);
export const ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "artifact-choice-search-coverage.json"
);
export const WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "weapon-choice-search-coverage.json"
);
export const KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "keqing-ineffa-artifact-generation-preflight.json"
  );
export const KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "keqing-ineffa-artifact-generation-technical-probe.json"
  );
export const KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "keqing-ineffa-artifact-generation-sensitivity.json"
  );
export const KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "keqing-ineffa-bounded-joint-artifact-experiment.json"
  );
export const TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "team-roster-candidate-domain-experiment.json"
);
export const KEQING_INEFFA_TEAM_STAT_MARGINAL_DIAGNOSTIC_REPORT_PATH =
  path.join(
    FACTORY_ROOT,
    "reports",
    "keqing-ineffa-team-stat-marginal-diagnostic.json"
  );
export const FURINA_SOURCE_SCOPED_ROLE_SAMPLE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "furina-source-scoped-role-sample.json"
);
export const KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "keqing-source-scoped-role-pair-sample.json"
);
