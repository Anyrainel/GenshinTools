import { readFile } from "node:fs/promises";
import path from "node:path";
import { characters } from "@/data/resources";
import {
  buildCharacterGuideInputCoverageReport,
  buildReleasedGuideDomainCatalog,
  CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS,
  CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS,
} from "./characterGuideInputCoverage";
import { loadGameCatalogs } from "./catalogs";
import { readJson, sha256File, writeJson } from "./io";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
  CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
  WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
} from "./paths";

const [
  repositoryInput,
  sourceRegistryInput,
  manualIndexInput,
  checkedInRosterReportInput,
  weaponChoiceSearchCoverageReportInput,
  artifactChoiceSearchCoverageReportInput,
  catalogs,
  generatedFrom,
] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  readJson(SOURCE_REGISTRY_PATH),
  readJson(MANUAL_SNAPSHOT_INDEX_PATH),
  readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
  readJson(WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
  readJson(ARTIFACT_CHOICE_SEARCH_COVERAGE_REPORT_PATH),
  loadGameCatalogs(),
  Promise.all(
    CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  ),
]);

const manualSnapshotInputs = await loadManualSnapshotInputs(
  manualIndexInput,
  sourceRegistryInput,
);
const sourceFiles = await Promise.all(
  CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS.map(
    async (relativePath) => ({
      path: relativePath,
      text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
    }),
  ),
);
const releasedCharacters = buildReleasedGuideDomainCatalog(
  characters.map(({ id }) => id),
  catalogs.characterElements,
);
const report = buildCharacterGuideInputCoverageReport({
  repositoryInput,
  sourceRegistryInput,
  manualSnapshotInputs,
  sourceFiles,
  releasedCharacters,
  checkedInRosterReportInput,
  weaponChoiceSearchCoverageReportInput,
  artifactChoiceSearchCoverageReportInput,
  generatedFrom,
});
await writeJson(CHARACTER_GUIDE_INPUT_COVERAGE_REPORT_PATH, report);

console.log(
  `Wrote ${report.summary.characterCount} characters and ` +
    `${report.summary.constellationRowCount} C0-C6 rows from ` +
    `${report.summary.observationCount} non-rejected source observations; ` +
    `${report.summary.repositoryAuthoredDamagePlanObservationCount} repository-authored formula observations.`,
);
