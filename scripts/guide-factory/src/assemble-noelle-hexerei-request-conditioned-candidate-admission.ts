import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace } from "./assemble-noelle-hexerei-partial-equipment-composition";
import { loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace } from "./assemble-noelle-hexerei-local-stat-priority-diagnostic";
import { readJson, sha256File, writeJson } from "./io";
import {
  authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport,
  buildNoelleHexereiRequestConditionedCandidateAdmissionReport,
  NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
  NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
  type NoelleHexereiRequestConditionedCandidateAdmissionInput,
  type NoelleHexereiRequestConditionedCandidateAdmissionReport,
} from "./noelleHexereiRequestConditionedCandidateAdmission";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiRequestConditionedCandidateAdmissionSummary(
  report: NoelleHexereiRequestConditionedCandidateAdmissionReport,
): string {
  return (
    `Conditioned ${report.summary.requestConditionedEnvelopeCount} Noelle partial candidates across ` +
    `${report.summary.relationAdmissionCount} local relation gates; admitted/withheld/evidence: ` +
    `${report.summary.admittedRelationCount}/` +
    `${report.summary.withheldCounterexampleRelationCount}/` +
    `${report.evidenceConsumptionLedger.consumedDiagnosticReferenceCount}; selections/ER: ` +
    `${report.summary.sourceSelectionCount}/${report.summary.energyRecoveryComputationCount}.`
  );
}

export async function loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace(): Promise<NoelleHexereiRequestConditionedCandidateAdmissionInput> {
  const [
    cp53Input,
    cp56Input,
    cp53ReportInput,
    cp56ReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    loadNoelleHexereiPartialEquipmentCompositionInputFromWorkspace(),
    loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace(),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_CP53_REPORT_RELATIVE_PATH),
    ),
    readJson(
      path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_CP56_REPORT_RELATIVE_PATH),
    ),
    Promise.all(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          bytesBase64: (
            await readFile(path.join(REPOSITORY_ROOT, relativePath))
          ).toString("base64"),
        }),
      ),
    ),
    Promise.all(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_INPUT_PATHS.map(
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
      cp53ReportInput as NoelleHexereiRequestConditionedCandidateAdmissionInput["cp53ReportInput"],
    cp53Input,
    cp56ReportInput:
      cp56ReportInput as NoelleHexereiRequestConditionedCandidateAdmissionInput["cp56ReportInput"],
    cp56Input,
    technicalRequest: structuredClone(
      NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REQUEST,
    ),
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiRequestConditionedCandidateAdmissionFromWorkspace(): Promise<NoelleHexereiRequestConditionedCandidateAdmissionReport> {
  const input =
    await loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace();
  return buildNoelleHexereiRequestConditionedCandidateAdmissionReport(input);
}

export async function authenticateNoelleHexereiRequestConditionedCandidateAdmissionFromWorkspace(
  serializedReport: NoelleHexereiRequestConditionedCandidateAdmissionReport,
): Promise<NoelleHexereiRequestConditionedCandidateAdmissionReport> {
  const input =
    await loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace();
  const authentication =
    await authenticateNoelleHexereiRequestConditionedCandidateAdmissionReport(
      serializedReport,
      input,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP57 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleHexereiRequestConditionedCandidateAdmissionCli(): Promise<void> {
  const report =
    await buildNoelleHexereiRequestConditionedCandidateAdmissionFromWorkspace();
  await writeJson(
    NOELLE_HEXEREI_REQUEST_CONDITIONED_CANDIDATE_ADMISSION_REPORT_PATH,
    report,
  );
  console.log(
    formatNoelleHexereiRequestConditionedCandidateAdmissionSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleHexereiRequestConditionedCandidateAdmissionCli();
}
