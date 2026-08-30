import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";
import {
  buildXiaoFormulaCountParityReport,
  requireComparableXiaoFormulaCountParityReport,
  XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
  XIAO_FORMULA_COUNT_PARITY_REPORT_PATH,
  XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
  type XiaoFormulaCountParityReport,
} from "./xiaoFormulaCountParity";

const XIAO_FIXTURE_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-rotation-fixture-manual.json",
);

export function formatXiaoFormulaCountParitySummary(
  report: XiaoFormulaCountParityReport,
): string {
  return (
    `Wrote authenticated Xiao formula-count witness for ${report.summary.translatedFormulaCountRowCount} source-token aliases: ` +
    `${report.summary.matchedCount} calculator-default match and ${report.summary.mismatchCount} mismatch ` +
    `(High Plunge source 12 versus calculator default 11); ` +
    "0 damage evaluations, builds, recommendations, optimizations, or ER computations."
  );
}

export async function runXiaoFormulaCountParityCli(): Promise<void> {
  const [
    repositoryInput,
    manualFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(XIAO_FIXTURE_SNAPSHOT_PATH),
    readJson(GENSHINTOOLS_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FORMULA_COUNT_PARITY_CODE_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    ),
  ]);
  const input = {
    repositoryInput,
    manualFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  };
  const report = await buildXiaoFormulaCountParityReport(input);
  await requireComparableXiaoFormulaCountParityReport(report, input);
  await writeJson(XIAO_FORMULA_COUNT_PARITY_REPORT_PATH, report);
  console.log(formatXiaoFormulaCountParitySummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runXiaoFormulaCountParityCli();
}
