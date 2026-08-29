import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, sha256File, writeJson } from "./io";
import {
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS,
  runKeqingIneffaBoundedJointArtifactExperiment,
  type KeqingIneffaBoundedJointArtifactExperimentReport,
} from "./keqingIneffaBoundedJointArtifactExperiment";
import {
  KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  REPOSITORY_ROOT,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

export function formatKeqingIneffaBoundedJointArtifactExperimentSummary(
  report: KeqingIneffaBoundedJointArtifactExperimentReport,
): string {
  const comparableNodes = report.nodes.filter(
    ({ comparisonStatus }) => comparisonStatus === "comparable",
  ).length;
  const failedGeneratorOrCaptureRuns = report.nodes.reduce(
    (count, node) =>
      count +
      node.carryRuns.filter(({ outcome }) => outcome === "not-comparable")
        .length,
    0,
  );
  const failedEvaluations = report.nodes.reduce(
    (count, node) =>
      count +
      node.compositions.filter(({ outcome }) => outcome === "evaluation-failed")
        .length,
    0,
  );
  const nodeConfigurationFailures = report.nodes.reduce(
    (count, node) => count + node.nodeFailures.length,
    0,
  );
  return (
    `Wrote bounded joint artifact experiment: ${comparableNodes}/4 nodes comparable, ` +
    `${report.latticeBoundary.totalObservedCompositions} compositions observed, ` +
    `${formatCount(failedGeneratorOrCaptureRuns, "generator/capture failure")}, ` +
    `${formatCount(nodeConfigurationFailures, "node configuration failure")}, ` +
    `${formatCount(failedEvaluations, "evaluation failure")}, ` +
    `cached policy replay ${report.cachedPolicyReplay.status}.`
  );
}

function formatCount(count: number, singularLabel: string): string {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

export async function runKeqingIneffaBoundedJointArtifactExperimentCli(): Promise<void> {
  const [repositoryInput, generatedFrom] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    Promise.all(
      KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const report = await runKeqingIneffaBoundedJointArtifactExperiment(
    KnowledgeRepositorySchema.parse(repositoryInput),
    generatedFrom,
  );
  await writeJson(
    KEQING_INEFFA_BOUNDED_JOINT_ARTIFACT_EXPERIMENT_REPORT_PATH,
    report,
  );
  console.log(formatKeqingIneffaBoundedJointArtifactExperimentSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingIneffaBoundedJointArtifactExperimentCli();
}
