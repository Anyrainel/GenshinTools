import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildNoelleHexereiWeaponTeamSourceBindingReport,
  NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH,
  NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH,
  NOELLE_HEXEREI_SOURCE_REGISTRY_RELATIVE_PATH,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_REPORT_PATH,
  NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
  requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport,
  type NoelleHexereiWeaponTeamSourceBindingInput,
  type NoelleHexereiWeaponTeamSourceBindingReport,
} from "./noelleHexereiWeaponTeamSourceBinding";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiWeaponTeamSourceBindingSummary(
  report: NoelleHexereiWeaponTeamSourceBindingReport,
): string {
  return (
    `Authenticated ${report.summary.localBindingCount} exact-team Noelle Hexerei weapon applicability ` +
    `validation target from ${report.summary.sourceRecordCount} same-source records; ` +
    `equipment assignments/candidates/optimizations: ` +
    `${report.summary.equipmentAssignmentCount}/${report.summary.candidateCount}/${report.summary.optimizerRunCount}.`
  );
}

export async function loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace(): Promise<NoelleHexereiWeaponTeamSourceBindingInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    highSliceReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(
      path.join(
        REPOSITORY_ROOT,
        NOELLE_HEXEREI_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
      ),
    ),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        NOELLE_HEXEREI_MANUAL_SNAPSHOT_RELATIVE_PATH,
      ),
    ),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_MANUAL_INDEX_RELATIVE_PATH),
    ),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_SOURCE_REGISTRY_RELATIVE_PATH),
    ),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        NOELLE_HEXEREI_HIGH_SLICE_REPORT_RELATIVE_PATH,
      ),
    ),
    readSourceFiles(
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_SOURCE_FILE_PATHS,
    ),
    readGeneratedFrom(
      NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_INPUT_PATHS,
    ),
  ]);
  return {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    highSliceReportInput:
      highSliceReportInput as NoelleHexereiWeaponTeamSourceBindingInput["highSliceReportInput"],
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiWeaponTeamSourceBindingFromWorkspace(): Promise<NoelleHexereiWeaponTeamSourceBindingReport> {
  const input =
    await loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace();
  const report = buildNoelleHexereiWeaponTeamSourceBindingReport(input);
  return requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
    report,
    input,
  );
}

export async function authenticateNoelleHexereiWeaponTeamSourceBindingFromWorkspace(
  serializedReport: NoelleHexereiWeaponTeamSourceBindingReport,
): Promise<NoelleHexereiWeaponTeamSourceBindingReport> {
  const input =
    await loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace();
  return requireAuthenticatedNoelleHexereiWeaponTeamSourceBindingReport(
    serializedReport,
    input,
  );
}

export async function runNoelleHexereiWeaponTeamSourceBindingCli(): Promise<void> {
  const report =
    await buildNoelleHexereiWeaponTeamSourceBindingFromWorkspace();
  await writeJson(
    NOELLE_HEXEREI_WEAPON_TEAM_SOURCE_BINDING_REPORT_PATH,
    report,
  );
  console.log(formatNoelleHexereiWeaponTeamSourceBindingSummary(report));
}

async function readSourceFiles(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
    })),
  );
}

async function readGeneratedFrom(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleHexereiWeaponTeamSourceBindingCli();
}
