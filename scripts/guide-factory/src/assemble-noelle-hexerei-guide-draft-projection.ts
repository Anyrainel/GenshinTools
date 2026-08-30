import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace } from "./assemble-noelle-hexerei-request-conditioned-candidate-admission";
import { readJson, sha256File, writeJson } from "./io";
import {
  authenticateNoelleHexereiGuideDraftProjectionReport,
  buildNoelleHexereiGuideDraftProjectionReport,
  NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH,
  NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
  type NoelleHexereiGuideDraftProjectionInput,
  type NoelleHexereiGuideDraftProjectionReport,
} from "./noelleHexereiGuideDraftProjection";
import { REPOSITORY_ROOT } from "./paths";

export function formatNoelleHexereiGuideDraftProjectionSummary(
  report: NoelleHexereiGuideDraftProjectionReport,
): string {
  return (
    `Projected ${report.summary.packetCount} authenticated Noelle draft packets with ` +
    `${report.summary.fieldCount} explicit fields and ${report.summary.blockerCount} blockers; ` +
    `all-local/partial/publishable/ER: ${report.summary.allRelationsAdmittedPacketCount}/` +
    `${report.summary.partialRelationPacketCount}/${report.summary.publicationReadyPacketCount}/` +
    `${report.summary.energyRecoveryComputationCount}.`
  );
}

export async function loadNoelleHexereiGuideDraftProjectionInputFromWorkspace(): Promise<NoelleHexereiGuideDraftProjectionInput> {
  const [cp57Input, cp57ReportInput, sourceFiles, generatedFrom] =
    await Promise.all([
      loadNoelleHexereiRequestConditionedCandidateAdmissionInputFromWorkspace(),
      readJson(
        path.join(REPOSITORY_ROOT, NOELLE_HEXEREI_CP57_REPORT_RELATIVE_PATH),
      ),
      Promise.all(
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            bytesBase64: (
              await readFile(path.join(REPOSITORY_ROOT, relativePath))
            ).toString("base64"),
          }),
        ),
      ),
      Promise.all(
        NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_INPUT_PATHS.map(
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
    cp57ReportInput:
      cp57ReportInput as NoelleHexereiGuideDraftProjectionInput["cp57ReportInput"],
    cp57Input,
    technicalRequest: structuredClone(
      NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REQUEST,
    ),
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleHexereiGuideDraftProjectionFromWorkspace(): Promise<NoelleHexereiGuideDraftProjectionReport> {
  return buildNoelleHexereiGuideDraftProjectionReport(
    await loadNoelleHexereiGuideDraftProjectionInputFromWorkspace(),
  );
}

export async function authenticateNoelleHexereiGuideDraftProjectionFromWorkspace(
  serializedReport: NoelleHexereiGuideDraftProjectionReport,
): Promise<NoelleHexereiGuideDraftProjectionReport> {
  const authentication =
    await authenticateNoelleHexereiGuideDraftProjectionReport(
      serializedReport,
      await loadNoelleHexereiGuideDraftProjectionInputFromWorkspace(),
    );
  if (!authentication.authenticated) {
    throw new Error(
      `CP58 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runNoelleHexereiGuideDraftProjectionCli(): Promise<void> {
  const report = await buildNoelleHexereiGuideDraftProjectionFromWorkspace();
  await writeJson(NOELLE_HEXEREI_GUIDE_DRAFT_PROJECTION_REPORT_PATH, report);
  console.log(formatNoelleHexereiGuideDraftProjectionSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleHexereiGuideDraftProjectionCli();
}
