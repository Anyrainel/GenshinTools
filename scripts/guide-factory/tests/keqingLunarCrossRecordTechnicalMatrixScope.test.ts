import { beforeAll, describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import {
  authenticateKeqingLunarCrossRecordTechnicalMatrixScope,
  buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput,
  deriveKeqingLunarCrossRecordTechnicalMatrixScopeCandidate,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS,
  KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION,
  requireKeqingLunarCrossRecordTechnicalMatrixScope,
} from "../src/keqingLunarCrossRecordTechnicalMatrixScope";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  type KnowledgeRepository,
  KnowledgeRepositorySchema,
} from "../src/schemas";
import { authenticateScopedSemanticDependencies } from "../src/scopedSemanticDependency";

let repository: KnowledgeRepository;

beforeAll(async () => {
  repository = (await readJson(
    KNOWLEDGE_REPOSITORY_PATH,
  )) as KnowledgeRepository;
});

describe("Keqing Lunar cross-record technical-matrix repository scope", () => {
  it("derives and authenticates the exact three repository-build projections", () => {
    const candidate =
      deriveKeqingLunarCrossRecordTechnicalMatrixScopeCandidate(repository);
    expect(candidate.status).toBe("candidate");
    if (candidate.status !== "candidate") {
      throw new Error(JSON.stringify(candidate.issues));
    }
    expect(candidate.audit.selector.manifestSha256).toBe(
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.manifestSha256,
    );
    expect(candidate.audit.scopeProjectionSha256).toBe(
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeProjectionSha256,
    );
    expect(candidate.audit.dependencies).toHaveLength(1);
    expect(candidate.audit.dependencies[0].requiredKeys).toEqual(
      KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.map(
        ({ characterGuideId }) => characterGuideId,
      ),
    );
    expect(candidate.audit.parities).toEqual([]);

    const scope =
      requireKeqingLunarCrossRecordTechnicalMatrixScope(repository);
    expect(scope.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId:
        KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_SCOPE_EXPECTATION.scopeId,
    });
    expect(
      scope.repositoryTargets.map(
        ({
          characterId,
          characterGuideId,
          buildSourceRecordId,
          artifact,
        }) => ({
          characterId,
          characterGuideId,
          buildSourceRecordId,
          artifactSetId: artifact.setId,
        }),
      ),
    ).toEqual(KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS);
    expect(
      scope.repositoryTargets.find(({ characterId }) => characterId === "furina"),
    ).toMatchObject({
      sands: ["er", "hp%"],
      goblet: ["hp%", "hydro%"],
      circlet: ["cr"],
      substats: ["cd", "cr", "hp%", "er"],
    });
  });

  it("rejects drift in every selected field family and duplicate identities", () => {
    const mutations: Array<(input: KnowledgeRepository) => void> = [
      (input) => {
        requiredGuide(input, "genshintools-presets:character-guide:furina")
          .characterId = "barbara";
      },
      (input) => {
        requiredBuild(
          input,
          "genshintools-presets:character-guide:furina",
          "BQAI0BO",
        ).artifact = { type: "4pc", setId: "heart_of_depth" };
      },
      (input) => {
        requiredBuild(
          input,
          "genshintools-presets:character-guide:ineffa",
          "FeFiQU8",
        ).sands[0].stat = "em";
      },
      (input) => {
        requiredBuild(
          input,
          "genshintools-presets:character-guide:furina",
          "BQAI0BO",
        ).goblet.reverse();
      },
      (input) => {
        requiredBuild(
          input,
          "genshintools-presets:character-guide:xilonen",
          "Dbt0Wkm",
        ).circlet[0].stat = "hb";
      },
      (input) => {
        requiredBuild(
          input,
          "genshintools-presets:character-guide:xilonen",
          "Dbt0Wkm",
        ).substats.reverse();
      },
      (input) => {
        input.records.push(
          structuredClone(
            requiredGuide(
              input,
              "genshintools-presets:character-guide:furina",
            ),
          ),
        );
      },
      (input) => {
        const guide = requiredGuide(
          input,
          "genshintools-presets:character-guide:furina",
        );
        guide.builds.push(
          structuredClone(requiredBuild(input, guide.id, "BQAI0BO")),
        );
      },
    ];

    for (const mutate of mutations) {
      const changed = structuredClone(repository);
      mutate(changed);
      expect(
        authenticateKeqingLunarCrossRecordTechnicalMatrixScope(changed).status,
      ).toBe("rejected");
    }
  });

  it("binds selector path and adapter identity to the manifest pin", () => {
    const pathDrift =
      buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput(
        repository,
      );
    pathDrift.manifest.dependencies[0].collectionPath = "/guides";
    expect(sharedIssueCodes(pathDrift)).toContain(
      "authentication.manifest_mismatch",
    );

    const adapterDrift =
      buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput(
        repository,
      );
    adapterDrift.manifest.dependencies[0].projectionAdapterId =
      "keqing-lunar-technical-matrix-repository-target-v2";
    expect(sharedIssueCodes(adapterDrift)).toContain(
      "authentication.manifest_mismatch",
    );
  });

  it("is stable across unrelated records and fields the matrix never reads", () => {
    const baseline =
      requireKeqingLunarCrossRecordTechnicalMatrixScope(repository).audit;
    const changed = structuredClone(repository);
    const unrelated = changed.records.find(
      ({ id }) =>
        !KEQING_LUNAR_CROSS_RECORD_TECHNICAL_MATRIX_REPOSITORY_TARGETS.some(
          ({ characterGuideId }) => characterGuideId === id,
        ),
    );
    if (!unrelated) throw new Error("Missing unrelated repository fixture.");
    unrelated.status = unrelated.status === "candidate" ? "accepted" : "candidate";

    const selectedBuild = requiredBuild(
      changed,
      "genshintools-presets:character-guide:furina",
      "BQAI0BO",
    );
    selectedBuild.sands[0].weight = 99;
    selectedBuild.roles = [...(selectedBuild.roles ?? []), "test-unused-role"];

    expect(KnowledgeRepositorySchema.safeParse(changed).success).toBe(true);
    expect(
      requireKeqingLunarCrossRecordTechnicalMatrixScope(changed).audit,
    ).toEqual(baseline);
  });
});

function sharedIssueCodes(
  input: ReturnType<
    typeof buildKeqingLunarCrossRecordTechnicalMatrixScopeAuthenticationInput
  >,
): string[] {
  const result = authenticateScopedSemanticDependencies(input);
  return result.status === "accepted"
    ? []
    : result.issues.map(({ code }) => code);
}

function requiredGuide(repositoryInput: KnowledgeRepository, id: string) {
  const record = repositoryInput.records.find(
    (candidate) => candidate.id === id,
  );
  if (!record || record.kind !== "character_guide") {
    throw new Error(`Missing character-guide fixture ${id}.`);
  }
  return record;
}

function requiredBuild(
  repositoryInput: KnowledgeRepository,
  guideId: string,
  buildSourceRecordId: string,
) {
  const guide = requiredGuide(repositoryInput, guideId);
  const build = guide.builds.find(
    (candidate) => candidate.sourceRecordId === buildSourceRecordId,
  );
  if (!build) {
    throw new Error(`Missing build fixture ${guideId}/${buildSourceRecordId}.`);
  }
  return build;
}
