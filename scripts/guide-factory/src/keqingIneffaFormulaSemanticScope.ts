import { z } from "zod";
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
import {
  ArtifactChoiceSchema,
  KnowledgeTeamSchema,
  SourceLocatorSchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

const REPOSITORY_DEPENDENCY_ID = "knowledge-repository";
const REPOSITORY_CONTAINER_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const TEAM_RECORD_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const ROTATION_ID = "sample-rotation";

const GUIDE_SELECTIONS = [
  {
    recordId: "genshintools-presets:character-guide:keqing",
    characterId: "keqing",
    weaponId: "mistsplitter_reforged",
    buildSourceRecordId: "1WswsAu",
  },
  {
    recordId: "genshintools-presets:character-guide:ineffa",
    characterId: "ineffa",
    weaponId: "fractured_halo",
    buildSourceRecordId: "FeFiQU8",
  },
  {
    recordId: "genshintools-presets:character-guide:furina",
    characterId: "furina",
    weaponId: "splendor_of_tranquil_waters",
    buildSourceRecordId: "BQAI0BO",
  },
  {
    recordId: "genshintools-presets:character-guide:xilonen",
    characterId: "xilonen",
    weaponId: "peak_patrol_song",
    buildSourceRecordId: "Dbt0Wkm",
  },
] as const;

const REQUIRED_RECORD_IDS = [
  TEAM_RECORD_ID,
  ...GUIDE_SELECTIONS.map(({ recordId }) => recordId),
];

const SourceReferenceSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceRecordId: z.string().min(1),
    locator: SourceLocatorSchema,
  })
  .strict();
const TeamProjectionSchema = z
  .object({
    projectionType: z.literal("keqing-ineffa-formula-team-v1"),
    team: KnowledgeTeamSchema,
  })
  .strict();
const GuideProjectionSchema = z
  .object({
    projectionType: z.literal("keqing-ineffa-formula-guide-v1"),
    id: z.string().min(1),
    kind: z.literal("character_guide"),
    status: z.enum(["baseline", "accepted"]),
    characterId: z.string().min(1),
    sourceRefs: z.array(SourceReferenceSchema).min(1),
    selectedWeapon: z
      .object({
        weaponId: z.string().min(1),
        orderIndex: z.number().int().nonnegative(),
      })
      .strict(),
    selectedBuild: z
      .object({
        sourceRecordId: z.string().min(1),
        visible: z.boolean(),
        minConstellation: z.number().int().min(0).max(6).optional(),
        artifact: ArtifactChoiceSchema,
      })
      .strict(),
  })
  .strict();

export const KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION = {
  scopeId: "keqing-ineffa-formula-fixture-repository-v1",
  manifestSha256:
    "8b93f93844b29fae7483a16d484945fe1f4376dd1fb0d1a579d0f55b0197008b",
  scopeProjectionSha256:
    "860ad7388a681147ab68e45b5730bcede1efc864a71667bd1f5497b6dbdd1c41",
} as const;

export type KeqingIneffaFormulaSemanticScope = {
  audit: ScopedSemanticDependencyAcceptedAudit;
  team: z.infer<typeof KnowledgeTeamSchema>;
  guides: KeqingIneffaFormulaSelectedGuide[];
};

export type KeqingIneffaFormulaSelectedGuide = z.infer<
  typeof GuideProjectionSchema
>;

export function deriveKeqingIneffaFormulaSemanticScopeCandidate(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyCandidateDerivationResult {
  const input = buildKeqingIneffaFormulaSemanticScopeAuthenticationInput(
    repository,
  );
  return deriveScopedSemanticDependencyCandidate({
    manifest: input.manifest,
    dependencies: input.dependencies,
    parityAdapters: input.parityAdapters,
  });
}

export function authenticateKeqingIneffaFormulaSemanticScope(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyAuthenticationResult {
  return authenticateScopedSemanticDependencies(
    buildKeqingIneffaFormulaSemanticScopeAuthenticationInput(repository),
  );
}

export function requireKeqingIneffaFormulaSemanticScope(
  repository: KnowledgeRepository,
): KeqingIneffaFormulaSemanticScope {
  const result = authenticateKeqingIneffaFormulaSemanticScope(repository);
  if (result.status !== "accepted") {
    throw new Error(
      `Keqing-Ineffa formula semantic scope authentication failed: ${result.issues
        .map(({ code }) => code)
        .join(", ")}.`,
    );
  }
  const facts = materializeSelectedPayloads(result.selection);
  return { audit: result.audit, ...facts };
}

/** Exposed so adversarial tests can prove selector identity is pin-bound. */
export function buildKeqingIneffaFormulaSemanticScopeAuthenticationInput(
  repository: KnowledgeRepository,
): ScopedSemanticDependencyAuthenticationInput {
  return {
    manifest: buildManifest(),
    dependencies: [
      defineScopedSemanticDependencyInput({
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_CONTAINER_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        records: repository.records,
        adapter: {
          projectionAdapterId:
            "keqing-ineffa-formula-repository-projection-v1",
          keyOf: (record) => record.id,
          project: projectRequiredRecord,
        },
      }),
    ],
    parityAdapters: [],
    expectation: { ...KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION },
  };
}

function buildManifest(): ScopedSemanticDependencyManifest {
  return {
    schemaVersion: 1,
    scopeId: KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeId,
    selectorMode: "exact-key-manifest",
    dependencyOrderPolicy: "declared",
    requiredKeyOrderPolicy: "declared",
    parityOrderPolicy: "declared",
    dependencies: [
      {
        dependencyId: REPOSITORY_DEPENDENCY_ID,
        containerPath: REPOSITORY_CONTAINER_PATH,
        collectionPath: "/records",
        keySchemaId: "knowledge-record-id-v1",
        projectionAdapterId:
          "keqing-ineffa-formula-repository-projection-v1",
        requiredKeys: [...REQUIRED_RECORD_IDS],
      },
    ],
    parities: [],
  };
}

function projectRequiredRecord(record: KnowledgeRecord): unknown {
  if (record.id === TEAM_RECORD_ID) return projectTeam(record);
  const selection = GUIDE_SELECTIONS.find(
    ({ recordId }) => recordId === record.id,
  );
  if (!selection) {
    throw new Error(`Unexpected formula semantic-scope record ${record.id}.`);
  }
  return projectGuide(record, selection);
}

function projectTeam(record: KnowledgeRecord): unknown {
  if (record.kind !== "team") {
    throw new Error(`${TEAM_RECORD_ID} must remain an exact team record.`);
  }
  const rotations = (record.rotations ?? []).filter(({ id }) => id === ROTATION_ID);
  if (rotations.length !== 1) {
    throw new Error(
      `${TEAM_RECORD_ID} must contain exactly one ${ROTATION_ID} rotation, found ${rotations.length}.`,
    );
  }
  return {
    projectionType: "keqing-ineffa-formula-team-v1",
    team: record,
  };
}

function projectGuide(
  record: KnowledgeRecord,
  selection: (typeof GUIDE_SELECTIONS)[number],
): unknown {
  if (record.kind !== "character_guide") {
    throw new Error(`${selection.recordId} must remain a character guide.`);
  }
  if (record.characterId !== selection.characterId) {
    throw new Error(
      `${selection.recordId} must remain a ${selection.characterId} guide.`,
    );
  }
  const weaponIndices = (record.weaponOrder ?? []).flatMap((weaponId, index) =>
    weaponId === selection.weaponId ? [index] : [],
  );
  if (weaponIndices.length !== 1) {
    throw new Error(
      `${selection.recordId} must contain ${selection.weaponId} exactly once in weaponOrder, found ${weaponIndices.length}.`,
    );
  }
  const builds = record.builds.filter(
    ({ sourceRecordId }) =>
      sourceRecordId === selection.buildSourceRecordId,
  );
  if (builds.length !== 1) {
    throw new Error(
      `${selection.recordId} must contain build ${selection.buildSourceRecordId} exactly once, found ${builds.length}.`,
    );
  }
  const build = builds[0];
  return {
    projectionType: "keqing-ineffa-formula-guide-v1",
    id: record.id,
    kind: record.kind,
    status: record.status,
    characterId: record.characterId,
    sourceRefs: record.sourceRefs,
    selectedWeapon: {
      weaponId: selection.weaponId,
      orderIndex: weaponIndices[0],
    },
    selectedBuild: {
      sourceRecordId: build.sourceRecordId,
      visible: build.visible,
      ...(build.minConstellation == null
        ? {}
        : { minConstellation: build.minConstellation }),
      artifact: build.artifact,
    },
  };
}

function materializeSelectedPayloads(
  selection: {
    readonly dependencies: readonly {
      readonly dependencyId: string;
      readonly entries: readonly {
        readonly key: string;
        readonly payload: unknown;
      }[];
    }[];
  },
): {
  team: z.infer<typeof KnowledgeTeamSchema>;
  guides: KeqingIneffaFormulaSelectedGuide[];
} {
  const dependency = selection.dependencies.find(
    ({ dependencyId }) => dependencyId === REPOSITORY_DEPENDENCY_ID,
  );
  if (!dependency) {
    throw new Error("Authenticated formula semantic scope omitted its repository dependency.");
  }
  const byKey = new Map(
    dependency.entries.map(({ key, payload }) => [key, payload]),
  );
  const teamProjection = TeamProjectionSchema.parse(byKey.get(TEAM_RECORD_ID));
  const guides = GUIDE_SELECTIONS.map((expected) => {
    const guide = GuideProjectionSchema.parse(byKey.get(expected.recordId));
    if (
      guide.id !== expected.recordId ||
      guide.characterId !== expected.characterId ||
      guide.selectedWeapon.weaponId !== expected.weaponId ||
      guide.selectedBuild.sourceRecordId !== expected.buildSourceRecordId
    ) {
      throw new Error(
        `Authenticated formula semantic payload ${expected.recordId} does not match its fixed selection.`,
      );
    }
    return guide;
  });

  if (teamProjection.team.id !== TEAM_RECORD_ID) {
    throw new Error(
      `Authenticated formula semantic payload ${TEAM_RECORD_ID} changed identity.`,
    );
  }
  return { team: teamProjection.team, guides };
}
