import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  buildKeqingLunarSourceConditionedCandidateLatticeReport,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS,
  type KeqingLunarSourceConditionedCandidateLatticeReport,
} from "./keqingLunarSourceConditionedCandidateLattice";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  REPOSITORY_ROOT,
} from "./paths";

export function formatKeqingLunarSourceConditionedCandidateLatticeSummary(
  report: KeqingLunarSourceConditionedCandidateLatticeReport,
): string {
  if (!report.lattice) {
    return (
      `Wrote Keqing Lunar source-conditioned candidate lattice: ${report.comparisonStatus}; ` +
      `${report.issues.length} issue(s); lattice withheld.`
    );
  }
  return (
    `Wrote Keqing Lunar source-conditioned candidate lattice: ${report.comparisonStatus}; ` +
    `${report.lattice.equipmentGroupCount} equipment groups, ` +
    `${report.lattice.statClaimCount} stat claims, ` +
    `${report.lattice.equipmentGroupCellCount + report.lattice.statClaimCellCount} classified cells; ` +
    `0 assembled builds and 0 authorized technical comparisons.`
  );
}

export async function runKeqingLunarSourceConditionedCandidateLatticeCli(): Promise<void> {
  const [evidenceInput, formulaDraftInput, generatedFrom] = await Promise.all([
    readJson(KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH),
    readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
    Promise.all(
      KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = buildKeqingLunarSourceConditionedCandidateLatticeReport(
    evidenceInput as KeqingLunarEquipmentEvidenceValidationReport,
    formulaDraftInput as KeqingIneffaFormulaDraftReport,
    generatedFrom,
  );
  await writeJson(
    KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
    report,
  );
  console.log(formatKeqingLunarSourceConditionedCandidateLatticeSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingLunarSourceConditionedCandidateLatticeCli();
}
