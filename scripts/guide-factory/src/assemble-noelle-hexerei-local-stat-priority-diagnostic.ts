import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace } from "./assemble-noelle-hexerei-equipment-response-surface";
import { readJson, sha256File, writeJson } from "./io";
import {
  authenticateNoelleHexereiLocalStatPriorityDiagnosticReport,
  buildNoelleHexereiLocalStatPriorityDiagnosticReport,
  NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
  type NoelleHexereiLocalStatPriorityDiagnosticInput,
  type NoelleHexereiLocalStatPriorityDiagnosticReport,
} from "./noelleHexereiLocalStatPriorityDiagnostic";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiLocalStatPriorityDiagnosticSummary(
  report: NoelleHexereiLocalStatPriorityDiagnosticReport,
): string {
  return (
    `Completed ${report.operationSummary.freshCellCount}-cell Noelle local-stat diagnostic; ` +
    `${report.operationSummary.localMarginalCount} one-roll marginals, ` +
    `${report.operationSummary.sensitivityEdgeCount} Nicole/Husk sensitivity edges, ` +
    `${report.operationSummary.sourceOrderDiagnosticCount} ordinal diagnostics, ` +
    `${report.operationSummary.contextRobustnessRowCount} context-robustness rows, ` +
    `${report.operationSummary.cp55ReproductionCount} CP55 reproductions, selections/ER: ` +
    `${report.operationSummary.selectedStatCount}/` +
    `${report.operationSummary.energyRecoveryComputationCount}.`
  );
}

export async function loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace(): Promise<NoelleHexereiLocalStatPriorityDiagnosticInput> {
  const [cp55Input, cp55ReportInput, sourceFiles, generatedFrom] =
    await Promise.all([
      loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace(),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
        ),
      ),
      Promise.all(
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            bytesBase64: (
              await readFile(path.join(REPOSITORY_ROOT, relativePath))
            ).toString("base64"),
          }),
        ),
      ),
      Promise.all(
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS.map(
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
    cp55ReportInput:
      cp55ReportInput as NoelleHexereiLocalStatPriorityDiagnosticInput["cp55ReportInput"],
    cp55Input,
    technicalRequest: structuredClone(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
    ),
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiLocalStatPriorityDiagnosticFromWorkspace(): Promise<NoelleHexereiLocalStatPriorityDiagnosticReport> {
  const input =
    await loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace();
  return buildNoelleHexereiLocalStatPriorityDiagnosticReport(input);
}

export async function authenticateNoelleHexereiLocalStatPriorityDiagnosticFromWorkspace(
  serializedReport: NoelleHexereiLocalStatPriorityDiagnosticReport,
): Promise<NoelleHexereiLocalStatPriorityDiagnosticReport> {
  const input =
    await loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace();
  const authentication =
    await authenticateNoelleHexereiLocalStatPriorityDiagnosticReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP56 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleHexereiLocalStatPriorityDiagnosticCli(): Promise<void> {
  const report =
    await buildNoelleHexereiLocalStatPriorityDiagnosticFromWorkspace();
  await writeJson(
    NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
    report,
  );
  console.log(formatNoelleHexereiLocalStatPriorityDiagnosticSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleHexereiLocalStatPriorityDiagnosticCli();
}
