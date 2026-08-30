import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace } from "./assemble-noelle-normal-prefix-formula-projection";
import { readJson, sha256File, writeJson } from "./io";
import {
  authenticateNoelleHexereiEquipmentResponseSurfaceReport,
  buildNoelleHexereiEquipmentResponseSurfaceReport,
  NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
  type NoelleHexereiEquipmentResponseSurfaceInput,
  type NoelleHexereiEquipmentResponseSurfaceReport,
} from "./noelleHexereiEquipmentResponseSurface";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiEquipmentResponseSurfaceSummary(
  report: NoelleHexereiEquipmentResponseSurfaceReport,
): string {
  const varyingBranches = report.surface.branchSandsVariationSummaries.filter(
    ({ crossWitnessSignVariationObserved }) =>
      crossWitnessSignVariationObserved,
  ).length;
  return (
    `Completed ${report.operationSummary.responseCellCount}-cell Noelle equipment response surface; ` +
    `${report.surface.directCompiledAgreement.agreementCount} direct/compiled agreements, ` +
    `${varyingBranches} source branches with cross-witness Sands sign variation, selections/ER: ` +
    `${report.operationSummary.sourceCandidateSelectionCount}/` +
    `${report.operationSummary.energyRecoveryComputationCount}.`
  );
}

export async function loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace(): Promise<NoelleHexereiEquipmentResponseSurfaceInput> {
  const [cp54Input, cp54ReportInput, sourceFiles, generatedFrom] =
    await Promise.all([
      loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace(),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
        ),
      ),
      Promise.all(
        NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            bytesBase64: (
              await readFile(path.join(REPOSITORY_ROOT, relativePath))
            ).toString("base64"),
          }),
        ),
      ),
      Promise.all(
        NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS.map(
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
    cp54ReportInput:
      cp54ReportInput as NoelleHexereiEquipmentResponseSurfaceInput["cp54ReportInput"],
    cp54Input,
    technicalRequest: structuredClone(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
    ),
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiEquipmentResponseSurfaceFromWorkspace(): Promise<NoelleHexereiEquipmentResponseSurfaceReport> {
  const input =
    await loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace();
  return buildNoelleHexereiEquipmentResponseSurfaceReport(input);
}

export async function authenticateNoelleHexereiEquipmentResponseSurfaceFromWorkspace(
  serializedReport: NoelleHexereiEquipmentResponseSurfaceReport,
): Promise<NoelleHexereiEquipmentResponseSurfaceReport> {
  const input =
    await loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace();
  const authentication =
    await authenticateNoelleHexereiEquipmentResponseSurfaceReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP55 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleHexereiEquipmentResponseSurfaceCli(): Promise<void> {
  const report =
    await buildNoelleHexereiEquipmentResponseSurfaceFromWorkspace();
  await writeJson(
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
    report,
  );
  console.log(formatNoelleHexereiEquipmentResponseSurfaceSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleHexereiEquipmentResponseSurfaceCli();
}
