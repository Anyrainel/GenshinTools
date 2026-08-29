import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameCatalogs } from "./catalogs";
import {
  buildIttoRequestContextApplicabilityReport,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH,
  ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
  ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
  readHashedJsonSnapshot,
  type IttoRequestContextApplicabilityReport,
} from "./ittoRequestContextApplicability";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const ITTO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-itto-manual.json",
);
export function formatIttoRequestContextApplicabilitySummary(
  report: IttoRequestContextApplicabilityReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return `Itto request-context applicability is not comparable: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote ${report.summary.contextCount} independent Itto request-context projections ` +
    `over ${report.summary.claimCellCount} cells: ` +
    `${report.summary.applicableUnderSuppliedContextCellCount} source-unresolved cells became applicable, ` +
    `${report.summary.unaddressedSourceUnresolvedCellCount} non-ER source-unresolved cells remain outside the typed context grammar, ` +
    `${report.summary.deferredEnergyCellCount} ER cells remain deferred, and 0 builds were assembled.`
  );
}

export function requireComparableIttoRequestContextApplicabilityReport(
  report: IttoRequestContextApplicabilityReport,
): void {
  const safe =
    report.comparisonStatus === "comparable" &&
    report.issues.length === 0 &&
    report.sourceControlBoundary.status === "authenticated-canonical-control" &&
    report.sourceControlBoundary.snapshotClosure === "accepted" &&
    report.sourceControlBoundary.semanticContract === "accepted" &&
    report.contextFixtureBoundary.status === "validated" &&
    report.contextFixtureBoundary.snapshotClosure === "accepted" &&
    report.contextProjectionExecuted &&
    !report.supportsSourceAuthorization &&
    !report.supportsGuideClaims &&
    !report.supportsAccountAdvice &&
    !report.playerFacingRecommendations &&
    !report.ranking &&
    !report.buildComposition &&
    !report.damage &&
    !report.optimality &&
    !report.formulas &&
    !report.rotations &&
    !report.ER &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryInputsUsed &&
    !report.baselineEquipmentUsed &&
    !report.axesMultipliedIntoBuilds &&
    !report.sourceCellsMutated &&
    report.summary.contextCount === 3 &&
    report.summary.claimCellCount === 135 &&
    report.summary.contextAddressableSourceUnresolvedCellCount === 21 &&
    report.summary.unaddressedSourceUnresolvedCellCount === 6 &&
    report.summary.assembledBuildCount === 0;
  if (safe) return;
  const details = report.issues
    .map(({ code, message }) => `${code}: ${message}`)
    .join("; ");
  throw new Error(
    `Refusing to write an unsafe or non-comparable Itto request-context report${
      details.length > 0 ? `: ${details}` : "."
    }`,
  );
}

export async function runIttoRequestContextApplicabilityCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    sourceReportSnapshot,
    contextFixtureSnapshot,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(ITTO_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    readHashedJsonSnapshot(
      REPOSITORY_ROOT,
      ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
    ),
    readHashedJsonSnapshot(
      REPOSITORY_ROOT,
      ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
    ),
  ]);
  const snapshotHashes = new Map([
    [sourceReportSnapshot.path, sourceReportSnapshot.fileSha256],
    [contextFixtureSnapshot.path, contextFixtureSnapshot.fileSha256],
  ]);
  const generatedFrom = await Promise.all(
    ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256:
          snapshotHashes.get(relativePath) ??
          (await sha256File(path.join(REPOSITORY_ROOT, relativePath))),
      }),
    ),
  );
  const report = await buildIttoRequestContextApplicabilityReport({
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    sourceReportSnapshot,
    contextFixtureSnapshot,
    generatedFrom,
  });
  requireComparableIttoRequestContextApplicabilityReport(report);
  await writeJson(ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH, report);
  console.log(formatIttoRequestContextApplicabilitySummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runIttoRequestContextApplicabilityCli();
}
