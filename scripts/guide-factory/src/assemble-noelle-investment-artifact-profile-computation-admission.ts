import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalHighInvestmentSliceInput,
  type NoelleSourceLocalHighInvestmentSliceReport,
} from "./noelleSourceLocalHighInvestmentSlice";
import {
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH,
  NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
  type BuildNoelleSourceLocalLowerInvestmentSliceInput,
  type NoelleSourceLocalLowerInvestmentSliceReport,
} from "./noelleSourceLocalLowerInvestmentSlice";
import {
  authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport,
  buildNoelleInvestmentArtifactProfileComputationAdmissionReport,
  NOELLE_COMPILED_DAMAGE_RELATIVE_PATH,
  NOELLE_DIRECT_DAMAGE_RELATIVE_PATH,
  NOELLE_IMPLEMENTATION_RELATIVE_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_REPORT_PATH,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
  NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
  NOELLE_REPLAY_ADAPTER_RELATIVE_PATH,
  type NoelleInvestmentArtifactProfileComputationAdmissionInput,
  type NoelleInvestmentArtifactProfileComputationAdmissionReport,
} from "./noelleInvestmentArtifactProfileComputationAdmission";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "./paths";

const NOELLE_MANUAL_SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-noelle-manual.json",
);

export function formatNoelleInvestmentArtifactProfileComputationAdmissionSummary(
  report: NoelleInvestmentArtifactProfileComputationAdmissionReport,
): string {
  return (
    `Wrote ${report.summary.profileCount} authenticated partial Noelle artifact profiles ` +
    `with ${report.summary.sourceMainStatOptionCount} source main-stat options and ` +
    `${report.summary.sourceSubstatPriorityGroupCount} newly source-bound substat groups; ` +
    `the exact source rotation replay was rejected because N3D/N2 prefixes cannot be represented ` +
    `by the current four-hit noelle-na aggregate, so ${report.summary.numericResultCount} numeric results were emitted.`
  );
}

export async function loadNoelleInvestmentArtifactProfileComputationAdmissionInputFromWorkspace(): Promise<NoelleInvestmentArtifactProfileComputationAdmissionInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    highSliceReportInput,
    lowerSliceReportInput,
    sourceFiles,
    generatedFrom,
    implementationFile,
    directDamageFile,
    compiledDamageFile,
    replayAdapterFile,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(NOELLE_MANUAL_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    readJson(NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_REPORT_PATH),
    readJson(NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_REPORT_PATH),
    readSourceFiles(
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_SOURCE_FILE_PATHS,
    ),
    readGeneratedFrom(
      NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_INPUT_PATHS,
    ),
    readPinnedTextFile(NOELLE_IMPLEMENTATION_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_DIRECT_DAMAGE_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_COMPILED_DAMAGE_RELATIVE_PATH),
    readPinnedTextFile(NOELLE_REPLAY_ADAPTER_RELATIVE_PATH),
  ]);

  const sourceFileByPath = new Map(
    sourceFiles.map((entry) => [entry.path, entry] as const),
  );
  const generatedFromByPath = new Map(
    generatedFrom.map((entry) => [entry.path, entry] as const),
  );
  const selectSourceFiles = (paths: readonly string[]) =>
    paths.map((sourcePath) => {
      const entry = sourceFileByPath.get(sourcePath);
      if (!entry) throw new Error(`Missing CP51 source file ${sourcePath}.`);
      return entry;
    });
  const selectGeneratedFrom = (paths: readonly string[]) =>
    paths.map((sourcePath) => {
      const entry = generatedFromByPath.get(sourcePath);
      if (!entry) throw new Error(`Missing CP51 generatedFrom entry ${sourcePath}.`);
      return entry;
    });

  const highSliceInput: BuildNoelleSourceLocalHighInvestmentSliceInput = {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles: selectSourceFiles(
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
  const lowerSliceInput: BuildNoelleSourceLocalLowerInvestmentSliceInput = {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles: selectSourceFiles(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_SOURCE_FILE_PATHS,
    ),
    generatedFrom: selectGeneratedFrom(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS,
    ),
  };
  return {
    highSliceReport:
      highSliceReportInput as NoelleSourceLocalHighInvestmentSliceReport,
    highSliceInput,
    lowerSliceReport:
      lowerSliceReportInput as NoelleSourceLocalLowerInvestmentSliceReport,
    lowerSliceInput,
    implementationFile,
    directDamageFile,
    compiledDamageFile,
    replayAdapterFile,
    sourceFiles,
    generatedFrom,
  };
}

export async function buildNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace(): Promise<NoelleInvestmentArtifactProfileComputationAdmissionReport> {
  const input =
    await loadNoelleInvestmentArtifactProfileComputationAdmissionInputFromWorkspace();
  const report =
    buildNoelleInvestmentArtifactProfileComputationAdmissionReport(input);
  return authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
    report,
    input,
  );
}

export async function authenticateNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace(
  serializedReport: NoelleInvestmentArtifactProfileComputationAdmissionReport,
): Promise<NoelleInvestmentArtifactProfileComputationAdmissionReport> {
  const input =
    await loadNoelleInvestmentArtifactProfileComputationAdmissionInputFromWorkspace();
  return authenticateNoelleInvestmentArtifactProfileComputationAdmissionReport(
    serializedReport,
    input,
  );
}

export async function runNoelleInvestmentArtifactProfileComputationAdmissionCli(): Promise<void> {
  const report =
    await buildNoelleInvestmentArtifactProfileComputationAdmissionFromWorkspace();
  await writeJson(
    NOELLE_INVESTMENT_ARTIFACT_PROFILE_COMPUTATION_ADMISSION_REPORT_PATH,
    report,
  );
  console.log(
    formatNoelleInvestmentArtifactProfileComputationAdmissionSummary(report),
  );
}

async function readSourceFiles(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
    })),
  );
}

async function readGeneratedFrom(paths: readonly string[]) {
  return Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
    })),
  );
}

async function readPinnedTextFile<TPath extends string>(relativePath: TPath) {
  const absolutePath = path.join(REPOSITORY_ROOT, relativePath);
  const [text, sha256] = await Promise.all([
    readFile(absolutePath, "utf8"),
    sha256File(absolutePath),
  ]);
  return { path: relativePath, text, sha256 };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runNoelleInvestmentArtifactProfileComputationAdmissionCli();
}
