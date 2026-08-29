import {
  runArtifactGenerationSensitivityProbe,
  type ArtifactGenerationSensitivityProbeEnvironment,
  type ArtifactGenerationSensitivityProbeInput,
  type ArtifactGenerationSensitivityProbeReport,
} from "./artifactGenerationSensitivityProbe";
import {
  buildKeqingIneffaArtifactGenerationTechnicalProbeInput,
  KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
} from "./keqingIneffaArtifactGenerationTechnicalProbe";
import type { KnowledgeRepository } from "./schemas";

export const KEQING_INEFFA_ARTIFACT_GENERATION_SENSITIVITY_INPUT_PATHS = [
  "scripts/guide-factory/src/artifactGenerationSensitivityProbe.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/keqingIneffaArtifactGenerationSensitivityProbe.ts",
  "src/data/enums.ts",
  "src/data/types.ts",
  ...KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS,
] as const;

export const KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID =
  "01-seed-aubade-golden";
export const KEQING_INEFFA_SENSITIVITY_SECOND_CANDIDATE_ID =
  "04-silken-tenacity";

export async function runKeqingIneffaArtifactGenerationSensitivityProbe(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment?: ArtifactGenerationSensitivityProbeEnvironment,
): Promise<ArtifactGenerationSensitivityProbeReport> {
  return runArtifactGenerationSensitivityProbe(
    await buildKeqingIneffaArtifactGenerationSensitivityProbeInput(
      repository,
      generatedFrom,
    ),
    environment,
  );
}

export async function buildKeqingIneffaArtifactGenerationSensitivityProbeInput(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): Promise<ArtifactGenerationSensitivityProbeInput> {
  return {
    baseProbeInput:
      await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(
        repository,
        [],
      ),
    firstCandidateId: KEQING_INEFFA_SENSITIVITY_FIRST_CANDIDATE_ID,
    secondCandidateId: KEQING_INEFFA_SENSITIVITY_SECOND_CANDIDATE_ID,
    primaryCarryCharacterId: "keqing",
    additionalCarryCharacterIds: ["ineffa", "furina", "xilonen"],
    generatedFrom,
  };
}
