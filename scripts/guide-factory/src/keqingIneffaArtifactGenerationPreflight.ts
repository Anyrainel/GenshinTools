import {
  ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
  buildArtifactGenerationPreflight,
  type ArtifactGenerationPreflightReport,
} from "./artifactGenerationPreflight";
import {
  buildKeqingIneffaFormulaDraftReport,
  buildKeqingIneffaSourceBackedEquipmentScenario,
  KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
} from "./keqingIneffaFormulaDraft";
import type { KnowledgeRepository } from "./schemas";

export const KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS = [
  "scripts/guide-factory/src/keqingIneffaArtifactGenerationPreflight.ts",
  ...new Set([
    ...ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
    ...KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS,
  ]),
] as const;

/**
 * Compose the fixed source-backed equipment fixture, its current formula-plan
 * draft, and the generic artifact-generation preflight. This is still a gate,
 * not a generator run.
 */
export async function buildKeqingIneffaArtifactGenerationPreflightReport(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }>,
): Promise<ArtifactGenerationPreflightReport> {
  const fixture = buildKeqingIneffaSourceBackedEquipmentScenario(repository);
  const formulaDraft = await buildKeqingIneffaFormulaDraftReport(
    repository,
    [],
  );

  return buildArtifactGenerationPreflight(
    {
      fixture,
      formulaDraft,
      formulaReadiness: formulaDraft.damageReplayReadiness,
    },
    generatedFrom,
  );
}
