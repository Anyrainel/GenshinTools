import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { characters } from "@/data/resources";
import {
  buildDerivedFormulaFixtureCoverageReport,
  DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS,
  DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS,
  DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS,
  DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
} from "./derivedFormulaFixtureCoverage";
import { readJson, sha256File, writeJson } from "./io";
import { DERIVED_FORMULA_FIXTURE_COVERAGE_REPORT_PATH } from "./paths";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const repositoryPath =
  "scripts/guide-factory/data/knowledge/repository.json";
const sourceRegistryPath = "scripts/guide-factory/sources/registry.json";
const manualIndexPath =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const rosterReportPath =
  "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json";

function absolute(relativePath: string): string {
  return path.join(repositoryRoot, relativePath);
}

const [
  fixtureReportInputs,
  repositoryInput,
  sourceRegistryInput,
  manualIndexInput,
  manualSnapshotInputs,
  checkedInRosterReportInput,
  sourceFiles,
  generatedFrom,
] = await Promise.all([
  Promise.all(
    DERIVED_FORMULA_FIXTURE_REPORT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      reportInput: await readJson(absolute(relativePath)),
    })),
  ),
  readJson(absolute(repositoryPath)),
  readJson(absolute(sourceRegistryPath)),
  readJson(absolute(manualIndexPath)),
  Promise.all(
    DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS.map(async (relativePath) => ({
      path: relativePath,
      snapshotInput: await readJson(absolute(relativePath)),
    })),
  ),
  readJson(absolute(rosterReportPath)),
  Promise.all(
    DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        text: await readFile(absolute(relativePath), "utf8"),
      }),
    ),
  ),
  Promise.all(
    DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(absolute(relativePath)),
      }),
    ),
  ),
]);

const report = buildDerivedFormulaFixtureCoverageReport({
  fixtureReportInputs,
  repositoryInput,
  sourceRegistryInput,
  manualIndexInput,
  manualSnapshotInputs,
  sourceFiles,
  releasedCharacterIds: characters.map(({ id }) => id),
  checkedInRosterReportInput,
  generatedFrom,
});
await writeJson(DERIVED_FORMULA_FIXTURE_COVERAGE_REPORT_PATH, report);

console.log(
  `Wrote ${report.summary.fixtureCount} derived formula fixtures with ` +
    `${report.summary.characterScenarioObservationCount} scenario-member ` +
    `observations across ${report.summary.uniqueCharacterCount} characters; ` +
    `all remain withheld from guide use.`,
);
