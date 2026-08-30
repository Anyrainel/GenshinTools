import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "./keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  type KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
} from "./keqingIneffaFurinaXilonenGeneratedSheetEvidence";
import type { KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport } from "./keqingIneffaFurinaXilonenEquipmentTechnicalComputation";
import { REPOSITORY_ROOT } from "./paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
} from "./schemas";

const SOURCE_TECHNICAL_REPORT =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-technical-computation.json";
const EQUIPMENT_LATTICE_REPORT =
  "scripts/guide-factory/reports/keqing-ineffa-furina-xilonen-equipment-candidate-lattice.json";
const KNOWLEDGE_REPOSITORY =
  "scripts/guide-factory/data/knowledge/repository.json";
const GENSHINTOOLS_SNAPSHOT =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const LIVE_BUILD_PRESET =
  "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json";
const KQM_EVIDENCE_REPORT =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";

export function formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary(
  report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
): string {
  if (
    report.validationStatus !==
    "authenticated-completed-occurrence-evidence-source-not-ready"
  ) {
    return `Keqing/Ineffa/Furina/Xilonen generated-sheet evidence is not authenticated: ${report.issues.length} issue(s).`;
  }
  return (
    `Wrote authenticated occurrence-scoped generated-sheet evidence: ` +
    `${report.executionBoundary.nodeCount} nodes, ` +
    `replayable evidence for ${report.executionBoundary.observedGeneratorInvocationCount} generator runs using the existing damage-objective artifact optimization (not an execution attestation), ` +
    `${report.comparisonBoundary.occurrenceCount} node/carry/character occurrences, ` +
    `${report.comparisonBoundary.comparisonRowCount} observable membership rows, and ` +
    `${report.comparisonBoundary.targetCoverageCount} target coverage summaries; ` +
    `0 damage replays, downstream optimizer calls, ranks, recommendations, guides, or ER requirements. ` +
    `ER values are retained only as deferred provenance.`
  );
}

export async function writeKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
  report: KeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport,
  outputPath = KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_REPORT_PATH,
): Promise<void> {
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(
    report,
  );
  await writeJson(outputPath, report);
}

export async function runKeqingIneffaFurinaXilonenGeneratedSheetEvidenceCli(): Promise<void> {
  const readInput = (relativePath: string) =>
    readJson(path.join(REPOSITORY_ROOT, relativePath));
  const [
    sourceTechnicalReport,
    equipmentLatticeReport,
    repository,
    genshinToolsSnapshot,
    liveBuildPreset,
    evidenceReport,
    inputFiles,
  ] = await Promise.all([
    readInput(SOURCE_TECHNICAL_REPORT),
    readInput(EQUIPMENT_LATTICE_REPORT),
    readInput(KNOWLEDGE_REPOSITORY),
    readInput(GENSHINTOOLS_SNAPSHOT),
    readInput(LIVE_BUILD_PRESET),
    readInput(KQM_EVIDENCE_REPORT),
    Promise.all(
      KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_EVIDENCE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report =
    await buildKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport({
      sourceTechnicalReport:
        sourceTechnicalReport as KeqingIneffaFurinaXilonenEquipmentTechnicalComputationReport,
      knowledgeTargetInput: {
        equipmentLatticeReport:
          equipmentLatticeReport as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
        repository: repository as KnowledgeRepository,
        genshinToolsSnapshot:
          genshinToolsSnapshot as GenshinToolsPresetSnapshot,
        liveBuildPreset,
        evidenceReport:
          evidenceReport as KeqingLunarEquipmentEvidenceValidationReport,
      },
      inputFiles,
    });
  await writeKeqingIneffaFurinaXilonenGeneratedSheetEvidenceReport(report);
  console.log(
    formatKeqingIneffaFurinaXilonenGeneratedSheetEvidenceSummary(report),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaFurinaXilonenGeneratedSheetEvidenceCli();
}
