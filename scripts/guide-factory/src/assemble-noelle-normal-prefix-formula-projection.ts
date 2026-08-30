import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace } from "./assemble-noelle-hexerei-partial-equipment-composition";
import { readJson, sha256File, writeJson } from "./io";
import {
  authenticateNoelleNormalPrefixFormulaProjectionReport,
  buildNoelleNormalPrefixFormulaProjectionReport,
  NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_REPORT_PATH,
  requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport,
  type NoelleNormalPrefixFormulaProjectionInput,
  type NoelleNormalPrefixFormulaProjectionReport,
} from "./noelleNormalPrefixFormulaProjection";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleNormalPrefixFormulaProjectionSummary(
  report: NoelleNormalPrefixFormulaProjectionReport,
): string {
  const agreement = report.technicalHarness.calculatorAgreement;
  return (
    `Accepted exact Noelle 5/5/3/0 static formula-count projection; ` +
    `direct/compiled technical totals ${agreement.directTotalDamage}/${agreement.compiledTotalDamage}, ` +
    `team replays/optimizer/ER: ${report.operationSummary.sourceRotationReplayCount}/` +
    `${report.operationSummary.optimizerRunCount}/${report.operationSummary.energyRecoveryComputationCount}.`
  );
}

export async function loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace(): Promise<NoelleNormalPrefixFormulaProjectionInput> {
  const [cp53Input, cp53ReportInput, sourceFiles, generatedFrom] =
    await Promise.all([
      loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace(),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
        ),
      ),
      Promise.all(
        NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            bytesBase64: (
              await readFile(path.join(REPOSITORY_ROOT, relativePath))
            ).toString("base64"),
          }),
        ),
      ),
      Promise.all(
        NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            sha256: await sha256File(
              path.join(REPOSITORY_ROOT, relativePath),
            ),
          }),
        ),
      ),
    ]);
  return {
    cp53ReportInput:
      cp53ReportInput as NoelleNormalPrefixFormulaProjectionInput["cp53ReportInput"],
    cp53Input,
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleNormalPrefixFormulaProjectionFromWorkspace(): Promise<NoelleNormalPrefixFormulaProjectionReport> {
  const input =
    await loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace();
  const report = await buildNoelleNormalPrefixFormulaProjectionReport(input);
  return requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport(
    report,
    input,
  );
}

export async function authenticateNoelleNormalPrefixFormulaProjectionFromWorkspace(
  serializedReport: NoelleNormalPrefixFormulaProjectionReport,
): Promise<NoelleNormalPrefixFormulaProjectionReport> {
  const input =
    await loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace();
  const authentication =
    await authenticateNoelleNormalPrefixFormulaProjectionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP54 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleNormalPrefixFormulaProjectionCli(): Promise<void> {
  const report = await buildNoelleNormalPrefixFormulaProjectionFromWorkspace();
  await writeJson(NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_REPORT_PATH, report);
  console.log(formatNoelleNormalPrefixFormulaProjectionSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleNormalPrefixFormulaProjectionCli();
}
