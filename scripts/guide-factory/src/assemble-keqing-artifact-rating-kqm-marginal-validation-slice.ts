import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ArtifactRatingModelSnapshot } from "./artifactRatingModel";
import { readJson, sha256File, writeJson } from "./io";
import {
  buildKeqingArtifactRatingKqmMarginalValidationSliceReport,
  KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_INPUT_PATHS,
  KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_PATH,
  KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH,
  KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH,
  requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport,
  type KeqingArtifactRatingKqmMarginalValidationSliceReport,
} from "./keqingArtifactRatingKqmMarginalValidationSlice";
import type { KeqingIneffaTeamStatMarginalDiagnosticReport } from "./keqingIneffaTeamStatMarginalDiagnostic";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "./paths";
import type {
  KnowledgeRepository,
  ManualObservationSnapshot,
} from "./schemas";

export function formatKeqingArtifactRatingKqmMarginalValidationSliceSummary(
  report: KeqingArtifactRatingKqmMarginalValidationSliceReport,
): string {
  if (report.validationStatus !== "authenticated-isolated-observation") {
    return `Keqing ArtifactRatingDB/KQM/local-marginal slice is not authenticated: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote isolated Keqing validation slice: ` +
    `${report.summary.sourceNonzeroLocalPositiveCount} source-nonzero/local-positive, ` +
    `${report.summary.sourceZeroLocalZeroCount} source-zero/local-zero, ` +
    `${report.summary.objectiveCoverageMismatchCount} objective-coverage mismatch, ` +
    `${report.summary.sourceMainOnlyCount} source-main-only row, and ` +
    `${report.summary.deferredEnergyOccurrenceCount} deferred SPRatioBase occurrences; ` +
    `0 guides, ranks, stat weights, or ER requirements produced.`
  );
}

export async function runKeqingArtifactRatingKqmMarginalValidationSliceCli(): Promise<void> {
  const dataPaths = KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_INPUT_PATHS;
  const [
    artifactRatingSnapshot,
    repository,
    marginalReport,
    kqmRawSnapshot,
    kqmEquipmentReport,
    inputFiles,
  ] = await Promise.all([
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_SNAPSHOT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KNOWLEDGE_REPOSITORY_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_MARGINAL_REPORT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KQM_RAW_SNAPSHOT_RELATIVE_PATH,
        ),
      ),
      readJson(
        path.join(
          REPOSITORY_ROOT,
          KEQING_ARTIFACT_RATING_KQM_EQUIPMENT_REPORT_RELATIVE_PATH,
        ),
      ),
      Promise.all(
        dataPaths.map(async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        })),
      ),
    ]);
  const report = buildKeqingArtifactRatingKqmMarginalValidationSliceReport({
    artifactRatingSnapshot:
      artifactRatingSnapshot as ArtifactRatingModelSnapshot,
    repository: repository as KnowledgeRepository,
    marginalReport:
      marginalReport as KeqingIneffaTeamStatMarginalDiagnosticReport,
    kqmRawSnapshot: kqmRawSnapshot as ManualObservationSnapshot,
    kqmEquipmentReport:
      kqmEquipmentReport as KeqingLunarEquipmentEvidenceValidationReport,
    inputFiles,
  });
  requireAuthenticatedKeqingArtifactRatingKqmMarginalValidationSliceReport(
    report,
  );
  await writeJson(
    KEQING_ARTIFACT_RATING_KQM_MARGINAL_SLICE_REPORT_PATH,
    report,
  );
  console.log(
    formatKeqingArtifactRatingKqmMarginalValidationSliceSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingArtifactRatingKqmMarginalValidationSliceCli();
}
