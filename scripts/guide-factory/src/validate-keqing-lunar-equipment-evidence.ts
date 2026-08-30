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
import {
  KnowledgeRepositorySchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "./schemas";

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

export function assertKeqingLunarEquipmentEvidenceValidationReportIsSafeToWrite(
  report: KeqingLunarEquipmentEvidenceValidationReport,
): void {
  const unsafeCapabilities = [
    report.supportsGuideClaims,
    report.supportsEquipmentRecommendations,
    report.supportsStatRecommendations,
    report.supportsRankClaims,
    report.supportsConditionApplicabilityClaims,
    report.supportsDamageClaims,
    report.supportsEnergyRecoveryClaims,
    report.candidateGenerationInput,
    report.candidateGenerationExecuted,
    report.damageOrRankingComputationExecuted,
    report.energyRecoveryInputsUsed,
  ].some((enabled) => enabled !== false);
  const unsafeSourceConditions =
    !report.sourceConditionBoundary.allSourceConditionsMappedExactly ||
    !report.sourceConditionBoundary
      .buildGameplayAndRefinementConditionsRemainUnresolved ||
    !report.sourceConditionBoundary
      .allowedRosterKnownFalseConjunctTeamsMatchExpectation ||
    report.sourceConditionBoundary
      .unexpectedGameplayBuildOrRefinementResolutionCount !== 0 ||
    report.claims.some(
      ({ allSourceConditionsMappedExactly }) =>
        !allSourceConditionsMappedExactly,
    );
  const unsafeSearchCoverage =
    !report.searchCoverageBoundary
      .allEquipmentClaimsHaveExactlyOneCoverageReference ||
    !report.searchCoverageBoundary.allWeaponIdsInReleasedCandidateDomain ||
    !report.searchCoverageBoundary.allWeaponNativeTypesCompatible ||
    report.searchCoverageBoundary.sourceRefinementInferenceCount !== 0 ||
    report.searchCoverageBoundary.sourceRefinementsInferred;
  const unauthenticatedScope =
    report.semanticScope.status !== "accepted" ||
    report.semanticScope.trust !==
      "authenticated-current-input-rebuild-and-pinned-expectation";

  if (
    report.validationStatus !== "comparable" ||
    unsafeCapabilities ||
    unsafeSourceConditions ||
    unsafeSearchCoverage ||
    unauthenticatedScope
  ) {
    throw new Error(
      "Refusing to write a non-comparable, unauthenticated, capability-crossing, or interpretively unsafe Keqing Lunar equipment evidence validation report.",
    );
  }
}

export async function writeKeqingLunarEquipmentEvidenceValidationReport(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  outputPath = KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
): Promise<void> {
  assertKeqingLunarEquipmentEvidenceValidationReportIsSafeToWrite(report);
  await writeJson(outputPath, report);
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
  const manualIndex = ManualSnapshotIndexSchema.parse(manualIndexInput);
  const sourceRegistry = SourceRegistrySchema.parse(sourceRegistryInput);
  const manualInputs = await loadManualSnapshotInputs(
    manualIndex,
    sourceRegistry,
  );
  const report = buildKeqingLunarEquipmentEvidenceValidationReport(
    KnowledgeRepositorySchema.parse(repositoryInput),
    manualInputs,
    { manualIndex, sourceRegistry },
    generatedFrom,
  );
  await writeKeqingLunarEquipmentEvidenceValidationReport(report);
  console.log(formatKeqingLunarEquipmentEvidenceValidationSummary(report));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runKeqingLunarEquipmentEvidenceValidationCli();
}
