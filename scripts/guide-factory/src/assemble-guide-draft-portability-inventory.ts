import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  authenticateGuideDraftPortabilityInventoryReport,
  buildGuideDraftPortabilityInventoryReport,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS,
  GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH,
  type GuideDraftPortabilityInventoryInput,
  type GuideDraftPortabilityInventoryReport,
} from "./guideDraftPortabilityInventory";
import { readJson, sha256File, writeJson } from "./io";
import { REPOSITORY_ROOT } from "./paths";

export function formatGuideDraftPortabilityInventorySummary(
  report: GuideDraftPortabilityInventoryReport,
): string {
  return (
    `Inventoried ${report.summary.subjectCount} character surfaces across ` +
    `${report.summary.fieldStateCount} field-family states; evidence-gate/current-format/selected: ` +
    `${report.summary.evidenceGateEligibleSubjectCount}/` +
    `${report.summary.currentFormatAcceptedSubjectCount}/` +
    `${report.summary.selectedTrialSubjectCount}.`
  );
}

export async function loadGuideDraftPortabilityInventoryInputFromWorkspace(): Promise<GuideDraftPortabilityInventoryInput> {
  const [sourceFiles, generatedFrom] = await Promise.all([
    Promise.all(
      GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        bytesBase64: (
          await readFile(path.join(REPOSITORY_ROOT, relativePath))
        ).toString("base64"),
      })),
    ),
    Promise.all(
      GUIDE_DRAFT_PORTABILITY_INVENTORY_INPUT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    ),
  ]);
  return { sourceFiles, generatedFrom };
}

export async function buildGuideDraftPortabilityInventoryFromWorkspace(): Promise<GuideDraftPortabilityInventoryReport> {
  return buildGuideDraftPortabilityInventoryReport(
    await loadGuideDraftPortabilityInventoryInputFromWorkspace(),
  );
}

export async function authenticateGuideDraftPortabilityInventoryFromWorkspace(
  serializedReport: GuideDraftPortabilityInventoryReport,
): Promise<GuideDraftPortabilityInventoryReport> {
  const authentication = authenticateGuideDraftPortabilityInventoryReport(
    serializedReport,
    await loadGuideDraftPortabilityInventoryInputFromWorkspace(),
  );
  if (!authentication.authenticated) {
    throw new Error(
      `CP59 workspace authentication failed (${authentication.reason}): ${authentication.message}`,
    );
  }
  return authentication.canonicalReport;
}

export async function runGuideDraftPortabilityInventoryCli(): Promise<void> {
  const report = await buildGuideDraftPortabilityInventoryFromWorkspace();
  await writeJson(GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH, report);
  console.log(formatGuideDraftPortabilityInventorySummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runGuideDraftPortabilityInventoryCli();
}

export async function readGuideDraftPortabilityInventoryReportFromWorkspace(): Promise<GuideDraftPortabilityInventoryReport> {
  return (await readJson(
    GUIDE_DRAFT_PORTABILITY_INVENTORY_REPORT_PATH,
  )) as GuideDraftPortabilityInventoryReport;
}
