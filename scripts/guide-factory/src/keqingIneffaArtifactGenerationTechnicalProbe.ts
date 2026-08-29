import type { MainStat, SubStat } from "@/data/enums";
import { buildArtifactGenerationPreflight } from "./artifactGenerationPreflight";
import {
  runArtifactGenerationTechnicalProbe,
  type ArtifactGenerationTechnicalCandidate,
  type ArtifactGenerationTechnicalProbeInput,
  type ArtifactGenerationTechnicalProbeEnvironment,
  type ArtifactGenerationTechnicalProbeReport,
  type ArtifactGenerationValidationTarget,
} from "./artifactGenerationTechnicalProbe";
import {
  buildKeqingIneffaFormulaDraftReport,
  buildKeqingIneffaSourceBackedEquipmentScenario,
} from "./keqingIneffaFormulaDraft";
import { KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS } from "./keqingIneffaArtifactGenerationPreflight";
import type { KnowledgeRepository, KnowledgeRecord } from "./schemas";

export const KEQING_INEFFA_ARTIFACT_GENERATION_TECHNICAL_PROBE_INPUT_PATHS = [
  "scripts/guide-factory/src/artifactGenerationTechnicalProbe.ts",
  "scripts/guide-factory/src/keqingIneffaArtifactGenerationTechnicalProbe.ts",
  ...new Set([
    ...KEQING_INEFFA_ARTIFACT_GENERATION_PREFLIGHT_INPUT_PATHS,
    "src/lib/artifact/scoring/sheetBuilder.ts",
    "src/lib/artifact/scoring/utils.ts",
    "src/lib/dmgcalc/core/formulaCompiler.ts",
    "src/lib/dmgcalc/core/statSheet.ts",
    "src/lib/team-comp/generator/constrainedGreedy.ts",
    "src/lib/team-comp/generator/generator.ts",
    "src/lib/team-comp/generator/substatBudget.ts",
    "src/lib/team-comp/optimizer/erCrConstraints.ts",
    "src/lib/team-comp/teamConfigUtils.ts",
  ]),
] as const;

type CharacterGuide = Extract<KnowledgeRecord, { kind: "character_guide" }>;
type CharacterGuideBuild = CharacterGuide["builds"][number];

type CandidateDefinition = Omit<
  ArtifactGenerationTechnicalCandidate,
  "validationTargets"
>;

const KEQING_INEFFA_CANDIDATE_DEFINITIONS: CandidateDefinition[] = [
  {
    candidateId: "01-seed-aubade-golden",
    classification: "repository-build-seed",
    artifactSetIdsByCharacter: {
      keqing: "thundering_fury",
      ineffa: "aubade_of_morningstar_and_moon",
      furina: "golden_troupe",
      xilonen: "scroll_of_the_hero_of_cinder_city",
    },
  },
  {
    candidateId: "02-aubade-tenacity",
    classification: "repository-build-composition",
    artifactSetIdsByCharacter: {
      keqing: "thundering_fury",
      ineffa: "aubade_of_morningstar_and_moon",
      furina: "tenacity_of_the_millelith",
      xilonen: "scroll_of_the_hero_of_cinder_city",
    },
  },
  {
    candidateId: "03-silken-golden",
    classification: "repository-build-composition",
    artifactSetIdsByCharacter: {
      keqing: "thundering_fury",
      ineffa: "silken_moons_serenade",
      furina: "golden_troupe",
      xilonen: "scroll_of_the_hero_of_cinder_city",
    },
  },
  {
    candidateId: "04-silken-tenacity",
    classification: "repository-build-composition",
    artifactSetIdsByCharacter: {
      keqing: "thundering_fury",
      ineffa: "silken_moons_serenade",
      furina: "tenacity_of_the_millelith",
      xilonen: "scroll_of_the_hero_of_cinder_city",
    },
  },
  {
    candidateId: "05-instructor-negative-control",
    classification: "repository-build-negative-control",
    artifactSetIdsByCharacter: {
      keqing: "thundering_fury",
      ineffa: "aubade_of_morningstar_and_moon",
      furina: "golden_troupe",
      xilonen: "instructor",
    },
  },
];

/**
 * Run the first bounded artifact-generation probe over a small matrix composed
 * from independently recorded character-guide builds. No source record binds
 * the four builds to this exact team. The matrix is deliberately not a
 * candidate ranking: its paired case only proves that the direct generator can
 * receive two simultaneous set changes, while the Instructor case proves
 * deterministic pre-run rejection.
 */
export async function runKeqingIneffaArtifactGenerationTechnicalProbe(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment?: ArtifactGenerationTechnicalProbeEnvironment,
): Promise<ArtifactGenerationTechnicalProbeReport> {
  return runArtifactGenerationTechnicalProbe(
    await buildKeqingIneffaArtifactGenerationTechnicalProbeInput(
      repository,
      generatedFrom,
    ),
    environment,
  );
}

export async function buildKeqingIneffaArtifactGenerationTechnicalProbeInput(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): Promise<ArtifactGenerationTechnicalProbeInput> {
  const fixture = buildKeqingIneffaSourceBackedEquipmentScenario(repository);
  const formulaDraft = await buildKeqingIneffaFormulaDraftReport(repository, []);
  const preflight = buildArtifactGenerationPreflight({
    fixture,
    formulaDraft,
    formulaReadiness: formulaDraft.damageReplayReadiness,
  });
  const candidates = KEQING_INEFFA_CANDIDATE_DEFINITIONS.map(
    (definition): ArtifactGenerationTechnicalCandidate => ({
      ...definition,
      artifactSetIdsByCharacter: {
        ...definition.artifactSetIdsByCharacter,
      },
      validationTargets: Object.entries(
        definition.artifactSetIdsByCharacter,
      ).map(([characterId, artifactSetId]) =>
        buildValidationTarget(repository, characterId, artifactSetId),
      ),
    }),
  );

  return {
    preflight,
    formulaDraft,
    validationProvenance: {
      repository,
    },
    carryCharacterId: "keqing",
    candidates,
    generatedFrom,
  };
}

function buildValidationTarget(
  repository: KnowledgeRepository,
  characterId: string,
  artifactSetId: string,
): ArtifactGenerationValidationTarget {
  const characterGuideId = `genshintools-presets:character-guide:${characterId}`;
  const guide = repository.records.find(
    (record): record is CharacterGuide =>
      record.id === characterGuideId && record.kind === "character_guide",
  );
  if (!guide) {
    throw new Error(
      `Artifact-generation candidate requires source guide ${characterGuideId}.`,
    );
  }
  const matchingBuilds = guide.builds.filter(
    (build) =>
      build.artifact.type === "4pc" &&
      build.artifact.setId === artifactSetId,
  );
  if (matchingBuilds.length !== 1) {
    throw new Error(
      `Artifact-generation candidate expected one ${characterId}/${artifactSetId} source build, found ${matchingBuilds.length}.`,
    );
  }
  const build = matchingBuilds[0];
  validateSourceBuildTarget(characterId, artifactSetId, build);

  return {
    kind: "repository-build",
    characterId,
    characterGuideId,
    buildSourceRecordId: build.sourceRecordId,
    artifactSetId,
    sands: build.sands.map(({ stat }) => stat) as MainStat[],
    goblet: build.goblet.map(({ stat }) => stat) as MainStat[],
    circlet: build.circlet.map(({ stat }) => stat) as MainStat[],
    substats: build.substats.map(({ stat }) => stat) as SubStat[],
  };
}

function validateSourceBuildTarget(
  characterId: string,
  artifactSetId: string,
  build: CharacterGuideBuild,
): asserts build is CharacterGuideBuild & {
  sands: Array<{ stat: MainStat }>;
  goblet: Array<{ stat: MainStat }>;
  circlet: Array<{ stat: MainStat }>;
  substats: Array<{ stat: SubStat }>;
} {
  if (
    build.sands.length === 0 ||
    build.goblet.length === 0 ||
    build.circlet.length === 0 ||
    build.substats.length === 0
  ) {
    throw new Error(
      `Artifact-generation validation target ${characterId}/${artifactSetId} has incomplete stat observations.`,
    );
  }
}
