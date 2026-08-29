import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import {
  buildKeqingLunarCrossRecordCompositionContractReport,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS,
  type KeqingLunarCrossRecordCompositionContractReport,
} from "./keqingLunarCrossRecordCompositionContract";
import type { KeqingLunarSourceConditionedCandidateLatticeReport } from "./keqingLunarSourceConditionedCandidateLattice";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  REPOSITORY_ROOT,
} from "./paths";

export function formatKeqingLunarCrossRecordCompositionContractSummary(
  report: KeqingLunarCrossRecordCompositionContractReport,
): string {
  return report.contractStatus === "comparable"
    ? `Wrote Keqing Lunar cross-record composition contract: 2 Guide Factory-authored compositions, no ordering, comparison, generator, or ER execution.`
    : `Wrote Keqing Lunar cross-record composition contract: not comparable; ${report.issues.length} issue(s); compositions withheld.`;
}

export async function runKeqingLunarCrossRecordCompositionContractCli(): Promise<void> {
  const [candidateLatticeInput, formulaDraftInput, generatedFrom] =
    await Promise.all([
      readJson(
        KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
      ),
      readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
      Promise.all(
        KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
          }),
        ),
      ),
    ]);
  const report = buildKeqingLunarCrossRecordCompositionContractReport(
    candidateLatticeInput as KeqingLunarSourceConditionedCandidateLatticeReport,
    formulaDraftInput as KeqingIneffaFormulaDraftReport,
    generatedFrom,
  );
  await writeJson(
    KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
    report,
  );
  console.log(formatKeqingLunarCrossRecordCompositionContractSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingLunarCrossRecordCompositionContractCli();
}
