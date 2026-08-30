import {
  authenticateScopedSemanticDependencies,
  defineScopedSemanticDependencyInput,
  deriveScopedSemanticDependencyCandidate,
  type ScopedSemanticDependencyAcceptedAudit,
  type ScopedSemanticDependencyAuthenticationInput,
  type ScopedSemanticDependencyAuthenticationResult,
  type ScopedSemanticDependencyCandidateDerivationResult,
  type ScopedSemanticDependencyManifest,
} from "./scopedSemanticDependency";
import type { KnowledgeRecord, KnowledgeRepository } from "./schemas";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const REPOSITORY_TARGET_DEPENDENCY_ID =
  "keqing-lunar-technical-matrix-repository-targets";

export const KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS =
  [
    {
      characterId: "ineffa",
      characterGuideId: "genshintools-presets:character-guide:ineffa",
      buildSourceRecordId: "FeFiQU8",
      artifactSetId: "aubade_of_morningstar_and_moon",
    },
    {
      characterId: "furina",
      characterGuideId: "genshintools-presets:character-guide:furina",
      buildSourceRecordId: "BQAI0BO",
      artifactSetId: "golden_troupe",
    },
    {
      characterId: "xilonen",
      characterGuideId: "genshintools-presets:character-guide:xilonen",
      buildSourceRecordId: "Dbt0Wkm",
      artifactSetId: "scroll_of_the_hero_of_cinder_city",
    },
  ] as const;

export const KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION =
  Object.freeze({
    scopeId: "keqing-lunar-cross-record-technical-matrix-repository-targets-v1",
    manifestSha256:
      "52c3bc238eb6fafeae45eaaeaa1ac92dec674dab4d07a2abd359eb75ce3835f3",
    scopeProjectionSha256:
      "f675da6830e4ab72fe926c7dcb8a394a063b5211a48c2d181634b2b44d52a5c1",
  } as const);

type RepositoryTargetBoundary =
  (typeof KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS)[number];

export type KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection = {
  projectionType: "keqing-lunar-cross-record-technical-matrix-repository-target-v1";
  guideKind: "character_guide";
  characterId: RepositoryTargetBoundary["characterId"];
  characterGuideId: RepositoryTargetBoundary["characterGuideId"];
  buildSourceRecordId: RepositoryTargetBoundary["buildSourceRecordId"];
  artifact: {
    type: "4pc";
    setId: RepositoryTargetBoundary["artifactSetId"];
  };
  sands: string[];
  goblet: string[];
  circlet: string[];
  substats: string[];
};

export type AuthenticatedKeqingLunarCrossRecordTechnicalMatrixScope = {
  audit: ScopedSemanticDependencyAcceptedAudit;
  repositoryTargets: KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection[];
};

export function deriveKeqingLunarCrossRecordTechnicalMatrixScopeCandidate(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyCandidateDerivationResult {
  const input =
    buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput(
      repository,
    );
  return deriveScopedSemanticDependencyCandidate({
    manifest: input.manifest,
    dependencies: input.dependencies,
    parityAdapters: input.parityAdapters,
  });
}

export function authenticateKeqingLunarCrossRecordTechnicalMatrixScope(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyAuthenticationResult {
  return authenticateScopedSemanticDependencies(
    buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput(
      repository,
    ),
  );
}

export function requireKeqingLunarCrossRecordTechnicalMatrixScope(
  repository: KnowledgeRepository,
): AuthenticatedKeqingLunarCrossRecordTechnicalMatrixScope {
  const result = authenticateKeqingLunarCrossRecordTechnicalMatrixScope(
    repository,
  );
  if (result.status !== "accepted") {
    throw new Error(
      `Keqing Lunar cross-record technical-matrix repository scope authentication failed: ${result.issues
        .map(({ code, path }) => `${code} at ${path}`)
        .join("; ")}.`,
    );
  }

  const dependency = result.selection.dependencies.find(
    ({ dependencyId }) => dependencyId === REPOSITORY_TARGET_DEPENDENCY_ID,
  );
  if (!dependency) {
    throw new Error(
      "Authenticated technical-matrix scope omitted its repository-target dependency.",
    );
  }
  const byGuideId = new Map(
    dependency.entries.map(({ key, payload }) => [key, payload]),
  );
  const repositoryTargets =
    KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.map(
      ({ characterGuideId }) => {
        const payload = byGuideId.get(characterGuideId);
        if (!isRepositoryTargetProjection(payload)) {
          throw new Error(
            `Authenticated technical-matrix target ${characterGuideId} changed shape.`,
          );
        }
        return structuredClone(payload);
      },
    );

  return { audit: result.audit, repositoryTargets };
}

/** Exposed so adversarial tests can prove selector identity is pin-bound. */
export function buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyAuthenticationInput {
  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_TARGET_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: repository.records,
        adapter: {
          projectionAdapterId:
            "keqing-lunar-technical-matrix-repository-target-v1",
          keyOf: ({ id }) => id,
          project: projectRepositoryTarget,
        },
      }),
    ],
    parityAdapters: [],
    expectation: {
      ...KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION,
    },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId:
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: REPOSITORY_TARGET_DEPENDENCY_ID,
        containerPath: REPOSITORY_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId:
          "keqing-lunar-technical-matrix-repository-target-v1",
        requiredKeys:
          KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.map(
            ({ characterGuideId }) => characterGuideId,
          ),
      },
    ],
    parities: [],
  };
}

function projectRepositoryTarget(
  record: KnowledgeRecord,
): KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection {
  const boundary =
    KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.find(
      ({ characterGuideId }) => characterGuideId === record.id,
    );
  if (!boundary) {
    throw new Error(`Unexpected technical-matrix repository record ${record.id}.`);
  }
  if (
    record.kind !== "character_guide" ||
    record.characterId !== boundary.characterId
  ) {
    throw new Error(
      `${boundary.characterGuideId} must remain a ${boundary.characterId} character guide.`,
    );
  }
  const builds = record.builds.filter(
    ({ sourceRecordId }) =>
      sourceRecordId === boundary.buildSourceRecordId,
  );
  if (builds.length !== 1) {
    throw new Error(
      `${boundary.characterGuideId} must contain build ${boundary.buildSourceRecordId} exactly once, found ${builds.length}.`,
    );
  }
  const build = builds[0];
  if (
    build.artifact.type !== "4pc" ||
    build.artifact.setId !== boundary.artifactSetId
  ) {
    throw new Error(
      `${boundary.characterGuideId}/${boundary.buildSourceRecordId} must retain 4pc ${boundary.artifactSetId}.`,
    );
  }
  const projection = {
    projectionType:
      "keqing-lunar-cross-record-technical-matrix-repository-target-v1" as const,
    guideKind: record.kind,
    characterId: boundary.characterId,
    characterGuideId: boundary.characterGuideId,
    buildSourceRecordId: boundary.buildSourceRecordId,
    artifact: {
      type: build.artifact.type,
      setId: build.artifact.setId,
    },
    sands: build.sands.map(({ stat }) => stat),
    goblet: build.goblet.map(({ stat }) => stat),
    circlet: build.circlet.map(({ stat }) => stat),
    substats: build.substats.map(({ stat }) => stat),
  };
  if (
    projection.sands.length === 0 ||
    projection.goblet.length === 0 ||
    projection.circlet.length === 0 ||
    projection.substats.length === 0
  ) {
    throw new Error(
      `${boundary.characterGuideId}/${boundary.buildSourceRecordId} must retain nonempty stat observations.`,
    );
  }
  return projection;
}

function isRepositoryTargetProjection(
  payload: unknown,
): payload is KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection {
  if (!payload || typeof payload !== "object") return false;
  const projection = payload as Partial<
    KeqingLunarCrossRecordTechnicalMatrixRepositoryTargetProjection
  >;
  const boundary =
    KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.find(
      ({ characterGuideId }) =>
        characterGuideId === projection.characterGuideId,
    );
  return (
    boundary != null &&
    projection.projectionType ===
      "keqing-lunar-cross-record-technical-matrix-repository-target-v1" &&
    projection.guideKind === "character_guide" &&
    projection.characterId === boundary.characterId &&
    projection.buildSourceRecordId === boundary.buildSourceRecordId &&
    projection.artifact?.type === "4pc" &&
    projection.artifact.setId === boundary.artifactSetId &&
    [
      projection.sands,
      projection.goblet,
      projection.circlet,
      projection.substats,
    ].every(
      (stats) =>
        Array.isArray(stats) &&
        stats.length > 0 &&
        stats.every((stat) => typeof stat === "string" && stat.length > 0),
    )
  );
}
