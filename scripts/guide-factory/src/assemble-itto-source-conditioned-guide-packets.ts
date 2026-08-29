import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadGameCatalogs } from "./catalogs";
import {
  buildIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
} from "./ittoSourceConditionedGuidePacket";
import { readJson, sha256File, writeJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";
import type { SourceConditionedGuidePacketReport } from "./sourceConditionedGuidePacket";

const ITTO_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-itto-manual.json",
);

export function formatIttoSourceConditionedGuidePacketSummary(
  report: SourceConditionedGuidePacketReport,
): string {
  if (report.comparisonStatus !== "comparable") {
    return (
      `Wrote Itto source-conditioned guide packets: not comparable; ` +
      `${report.issues.length} issue(s); all claim cells withheld.`
    );
  }
  return (
    `Wrote ${report.summary.packetCount} Itto source-team packets with ` +
    `${report.summary.sourceClaimCount} atomic claims and ` +
    `${report.summary.claimCellCount} cells: ` +
    `${report.summary.matchedCellCount} matched, ` +
    `${report.summary.inapplicableCellCount} definitely inapplicable, and ` +
    `${report.summary.withheldCellCount} withheld ` +
    `(${report.summary.unresolvedCellCount} unresolved context + ` +
    `${report.summary.deferredEnergyCellCount} deferred energy prerequisite); ` +
    `0 assembled builds and 0 guide claims.`
  );
}

export function requireComparableIttoSourceConditionedGuidePacketReport(
  report: SourceConditionedGuidePacketReport,
): void {
  if (report.comparisonStatus === "comparable") return;
  const details = report.issues
    .map(({ code, message }) => `${code}: ${message}`)
    .join("; ");
  throw new Error(
    `Refusing to write a non-comparable Itto source-conditioned packet${
      details.length > 0 ? `: ${details}` : "."
    }`,
  );
}

export async function runIttoSourceConditionedGuidePacketCli(): Promise<void> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(ITTO_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    Promise.all(
      ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = await buildIttoSourceConditionedGuidePacketReport({
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    generatedFrom,
  });
  requireComparableIttoSourceConditionedGuidePacketReport(report);
  await writeJson(ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH, report);
  console.log(formatIttoSourceConditionedGuidePacketSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runIttoSourceConditionedGuidePacketCli();
}
