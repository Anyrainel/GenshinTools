import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import { KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS } from "./keqingIneffaFormulaDraft";
import { KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS } from "./keqingLunarCrossRecordCompositionContract";
import type { KeqingLunarCrossRecordCompositionContractReport } from "./keqingLunarCrossRecordCompositionContract";
import {
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS,
  runKeqingLunarCrossRecordTechnicalMatrix,
  type KeqingLunarCrossRecordTechnicalMatrixReport,
} from "./keqingLunarCrossRecordTechnicalMatrix";
import type { KeqingLunarSourceConditionedCandidateLatticeReport } from "./keqingLunarSourceConditionedCandidateLattice";
import {
  KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH,
  KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import type { KnowledgeRepository } from "./schemas";

export function formatKeqingLunarCrossRecordTechnicalMatrixSummary(
  report: KeqingLunarCrossRecordTechnicalMatrixReport,
): string {
  return report.matrixStatus === "comparable"
    ? "Wrote Keqing Lunar cross-record technical matrix: 8 structural nodes, no cross-node or artifact-set comparison, ranking, recommendation, retained numerical result, or ER computation."
    : `Wrote Keqing Lunar cross-record technical matrix: not comparable; ${report.issues.length} issue(s); all structural node outputs withheld.`;
}

export async function runKeqingLunarCrossRecordTechnicalMatrixCli(): Promise<void> {
  const [
    repositoryInput,
    candidateLatticeInput,
    formulaDraftInput,
    serializedContractInput,
    formulaDraftGeneratedFrom,
    contractGeneratedFrom,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(KEQING_LUNAR_SOURCE_CONDITIONED_CANDIDATE_LATTICE_REPORT_PATH),
    readJson(KEQING_INEFFA_FORMULA_DRAFT_REPORT_PATH),
    readJson(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_REPORT_PATH),
    hashInputs(KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS),
    hashInputs(KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS),
    hashInputs(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_INPUT_PATHS),
  ]);
  const report = await runKeqingLunarCrossRecordTechnicalMatrix({
    repository: repositoryInput as KnowledgeRepository,
    candidateLattice:
      candidateLatticeInput as KeqingLunarSourceConditionedCandidateLatticeReport,
    formulaDraft: formulaDraftInput as KeqingIneffaFormulaDraftReport,
    serializedContract:
      serializedContractInput as KeqingLunarCrossRecordCompositionContractReport,
    formulaDraftGeneratedFrom,
    contractGeneratedFrom,
    generatedFrom,
  });
  await writeJson(
    KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPORT_PATH,
    report,
  );
  console.log(formatKeqingLunarCrossRecordTechnicalMatrixSummary(report));
}

async function hashInputs(
  relativePaths: readonly string[],
): Promise<Array<{ path: string; sha256: string }>> {
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingLunarCrossRecordTechnicalMatrixCli();
}
