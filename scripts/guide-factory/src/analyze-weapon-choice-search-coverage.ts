import path from "node:path";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
  WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";
import {
  buildWeaponChoiceSearchCoverageReport,
  WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
} from "./weaponChoiceSearchCoverage";

const [repositoryInput, generatedFrom] = await Promise.all([
  readJson(KNOWLEDGE_REPOSITORY_PATH),
  Promise.all(
    WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      }),
    ),
  ),
]);

const report = buildWeaponChoiceSearchCoverageReport(
  KnowledgeRepositorySchema.parse(repositoryInput),
  generatedFrom,
);
await writeJson(WEAPON_CHOICE_SEARCH_COVERAGE_REPORT_PATH, report);

const { all, weaponIdDomain, refinementCoverage, nativeTypeCompatibility } =
  report.summary;
console.log(
  `Wrote ${all.total} non-ER weapon-choice observations: ` +
    `${weaponIdDomain.inReleasedCandidateDomain} IDs in the released domain; ` +
    `${refinementCoverage.unspecified} refinements unspecified; ` +
    `${nativeTypeCompatibility.compatible} native-type compatible, ` +
    `${nativeTypeCompatibility.mismatched} mismatched, and ` +
    `${nativeTypeCompatibility.unknown} unknown.`,
);
