import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKeqingLunarEquipmentEvidenceValidationReport,
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS,
  type KeqingLunarEquipmentEvidenceValidationReport,
} from "./keqingLunarEquipmentEvidenceValidation";
import { readJson, sha256File, writeJson } from "./io";
import { loadManualSnapshotInputs } from "./manualSnapshots";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import { KnowledgeRepositorySchema } from "./schemas";

export function formatKeqingLunarEquipmentEvidenceValidationSummary(
  report: KeqingLunarEquipmentEvidenceValidationReport,
): string {
  const matchedClaimRows = report.claims.reduce(
    (count, claim) =>
      count +
      claim.teamResolutions.filter(
        ({ resolution }) =>
          resolution === "matched-by-exact-team-facts",
      ).length,
    0,
  );
  const totalClaimRows = report.claims.reduce(
    (count, claim) => count + claim.teamResolutions.length,
    0,
  );
  return (
    `Wrote Keqing Lunar equipment evidence validation: ${report.validationStatus}; ` +
    `${report.claims.length} source claim units; ` +
    `${matchedClaimRows}/${totalClaimRows} claim/team rows matched by exact team facts.`
  );
}

export async function runKeqingLunarEquipmentEvidenceValidationCli(): Promise<void> {
  const [repositoryInput, manualIndexInput, sourceRegistryInput, generatedFrom] =
    await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      readJson(SOURCE_REGISTRY_PATH),
      Promise.all(
        KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS.map(
          async (relativePath) => ({
            path: relativePath,
            sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
          }),
        ),
      ),
    ]);
  const manualInputs = await loadManualSnapshotInputs(
    manualIndexInput,
    sourceRegistryInput,
  );
  const report = buildKeqingLunarEquipmentEvidenceValidationReport(
    KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs,
    generatedFrom,
  );
  await writeJson(
    KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
    report,
  );
  console.log(formatKeqingLunarEquipmentEvidenceValidationSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingLunarEquipmentEvidenceValidationCli();
}
