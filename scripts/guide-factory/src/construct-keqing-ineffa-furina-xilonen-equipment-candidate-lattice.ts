import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ArtifactChoiceSearchCoverageReport } from "./artifactChoiceSearchCoverage";
import { readJson, writeJson } from "./io";
import {
  buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
  type KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
} from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "./paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
  ManualObservationSnapshot,
  ManualSnapshotIndex,
  SourceRegistry,
} from "./schemas";
import type { WeaponChoiceSearchCoverageReport } from "./weaponChoiceSearchCoverage";

export function formatKeqingIneffaFurinaXilonenEquipmentCandidateLatticeSummary(
  report: KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
): string {
  if (report.validationStatus !== "authenticated-enumeration-only") {
    return `Keqing/Ineffa/Furina/Xilonen equipment lattice is not authenticated: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote authenticated enumeration-only equipment lattice: ` +
    `${report.summary.candidateNodeCount} nodes, ` +
    `${report.summary.candidateReferenceCount} selection references, ` +
    `${report.inventoryBoundary.activeOccurrenceCount} active of ` +
    `${report.inventoryBoundary.occurrenceCount} source occurrences; ` +
    `0 evaluations, recommendations, ranks, guides, damage results, or ER requirements.`
  );
}

export async function runKeqingIneffaFurinaXilonenEquipmentCandidateLatticeCli(): Promise<void> {
  const values = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_INPUT_PATHS.map(
      (relativePath) => readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  const report =
    buildKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport({
      repository: values[0] as KnowledgeRepository,
      kqmSnapshot: values[1] as ManualObservationSnapshot,
      genshinToolsSnapshot: values[2] as GenshinToolsPresetSnapshot,
      manualIndex: values[3] as ManualSnapshotIndex,
      sourceRegistry: values[4] as SourceRegistry,
      liveBuildPreset: values[5],
      evidenceReport:
        values[6] as KeqingLunarEquipmentEvidenceValidationReport,
      weaponCoverageReport: values[7] as WeaponChoiceSearchCoverageReport,
      artifactCoverageReport: values[8] as ArtifactChoiceSearchCoverageReport,
    });
  requireAuthenticatedKeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport(
    report,
  );
  await writeJson(
    KEQING_INEFFA_FURINA_XILONEN_EQUIPMENT_CANDIDATE_LATTICE_REPORT_PATH,
    report,
  );
  console.log(
    formatKeqingIneffaFurinaXilonenEquipmentCandidateLatticeSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenEquipmentCandidateLatticeCli();
}
