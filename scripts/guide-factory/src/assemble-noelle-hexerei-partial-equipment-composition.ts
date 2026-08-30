import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import { loadNoelleInvestmentArtifactProfileComputationAdmissionInputFromWorkspace } from "./assemble-noelle-investment-artifact-profile-computation-admission";
import { loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace } from "./assemble-noelle-hexerei-weapon-team-source-binding";
import {
  authenticateNoelleHexereiPartialEquipmentCompositionReport,
  buildNoelleHexereiPartialEquipmentCompositionReport,
  NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_REPORT_PATH,
  NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_SOURCE_FILE_PATHS,
  requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport,
  type NoelleHexereiPartialEquipmentCompositionInput,
  type NoelleHexereiPartialEquipmentCompositionReport,
} from "./noelleHexereiPartialEquipmentComposition";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiPartialEquipmentCompositionSummary(
  report: NoelleHexereiPartialEquipmentCompositionReport,
): string {
  return (
    `Composed ${report.summary.partialValidationCandidateCount} request-parameterized partial Noelle validation candidates ` +
    `from ${report.summary.uniqueWeaponCount} applicable unranked weapon option and ` +
    `${report.summary.uniqueArtifactSetCount} artifact-set option; selections/builds/generator runs: ` +
    `${report.summary.selectionCount}/${report.summary.completeBuildCount}/${report.summary.generatorRunCount}.`
  );
}

export async function loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace(): Promise<NoelleHexereiPartialEquipmentCompositionInput> {
  const [
    cp51Input,
    cp52Input,
    cp51ReportInput,
    cp52ReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    loadNoelleInvestmentArtifactProfileComputationAdmissionInputFromWorkspace(),
    loadNoelleHexereiWeaponTeamSourceBindingInputFromWorkspace(),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_CP51_REPORT_RELATIVE_PATH),
    ),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_CP52_REPORT_RELATIVE_PATH),
    ),
    readSourceFiles(
      NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_SOURCE_FILE_PATHS,
    ),
    readGeneratedFrom(
      NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_INPUT_PATHS,
    ),
  ]);
  return {
    cp51ReportInput:
      cp51ReportInput as NoelleHexereiPartialEquipmentCompositionInput["cp51ReportInput"],
    cp51Input,
    cp52ReportInput:
      cp52ReportInput as NoelleHexereiPartialEquipmentCompositionInput["cp52ReportInput"],
    cp52Input,
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiPartialEquipmentCompositionFromWorkspace(): Promise<NoelleHexereiPartialEquipmentCompositionReport> {
  const input =
    await loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace();
  const report = buildNoelleHexereiPartialEquipmentCompositionReport(input);
  return requireAuthenticatedNoelleHexereiPartialEquipmentCompositionReport(
    report,
    input,
  );
}

export async function authenticateNoelleHexereiPartialEquipmentCompositionFromWorkspace(
  serializedReport: NoelleHexereiPartialEquipmentCompositionReport,
): Promise<NoelleHexereiPartialEquipmentCompositionReport> {
  const input =
    await loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace();
  const authentication =
    authenticateNoelleHexereiPartialEquipmentCompositionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP53 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleHexereiPartialEquipmentCompositionCli(): Promise<void> {
  const report =
    await buildNoelleHexereiPartialEquipmentCompositionFromWorkspace();
  await writeJson(
    NOELLE_HEXEREI_PARTIAL_EQUIPMENT_COMPOSITION_REPORT_PATH,
    report,
  );
  console.log(formatNoelleHexereiPartialEquipmentCompositionSummary(report));
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
  await runNoelleHexereiPartialEquipmentCompositionCli();
}
