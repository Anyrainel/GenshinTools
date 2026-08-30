import { beforeAll, describe, expect, it } from "vitest";
import {
  authenticateKeqingIneffaFormulaSemanticScope,
  buildKeqingIneffaFormulaSemanticScopeAuthenticationInput,
  deriveKeqingIneffaFormulaSemanticScopeCandidate,
  KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION,
  requireKeqingIneffaFormulaSemanticScope,
} from "../src/keqingIneffaFormulaSemanticScope";
import { authenticateScopedSemanticDependencies } from "../src/scopedSemanticDependency";
import { readJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRepository,
} from "../src/schemas";

const TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const INEFFA_GUIDE_ID = "genshintools-presets:character-guide:ineffa";

let repository: KnowledgeRepository;

beforeAll(async () => {
  repository = KnowledgeRepositorySchema.parse(
    await readJson(KNOWLEDGE_REPOSITORY_PATH),
  );
});

describe("Keqing-Ineffa formula semantic scope", () => {
  it("authenticates exactly five narrow repository records against pinned digests", () => {
    const scope = requireKeqingIneffaFormulaSemanticScope(repository);

    expect(scope.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        KEQING_INEFFA_FORMULA_SEMANTIC_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(scope.audit.dependencies).toHaveLength(1);
    expect(scope.audit.dependencies[0].requiredKeys).toEqual([
      TEAM_ID,
      "genshintools-presets:character-guide:keqing",
      INEFFA_GUIDE_ID,
      "genshintools-presets:character-guide:furina",
      "genshintools-presets:character-guide:xilonen",
    ]);
    expect(scope.audit.dependencies[0].selectedEntries).toHaveLength(5);
    expect(scope.team.id).toBe(TEAM_ID);
    expect(scope.team.rotations).toHaveLength(2);
    expect(scope.guides).toHaveLength(4);

    const candidate = deriveKeqingIneffaFormulaSemanticScopeCandidate(repository);
    expect(candidate.status).toBe("candidate");
    if (candidate.status !== "candidate") throw new Error("Expected candidate.");
    const serialized = JSON.stringify(candidate.audit);
    expect(serialized).not.toContain("FeFi2JG");
    expect(serialized).not.toContain("sample-rotation-max-shield-uptime");
    expect(serialized).not.toContain("sourceRegistrySha256");
  });

  it("rejects missing and duplicate exact repository records", () => {
    const missing = structuredClone(repository);
    missing.records = missing.records.filter(({ id }) => id !== TEAM_ID);
    expect(issueCodes(authenticateKeqingIneffaFormulaSemanticScope(missing))).toContain(
      "selection.required_key_missing",
    );

    const duplicated = structuredClone(repository);
    const guide = requiredRecord(duplicated, INEFFA_GUIDE_ID);
    duplicated.records.push(structuredClone(guide));
    expect(
      issueCodes(authenticateKeqingIneffaFormulaSemanticScope(duplicated)),
    ).toContain("selection.required_key_duplicated");

    const duplicatedBuild = structuredClone(repository);
    const ineffa = requiredGuide(duplicatedBuild, INEFFA_GUIDE_ID);
    const selectedBuild = ineffa.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "FeFiQU8",
    );
    if (!selectedBuild) throw new Error("Missing selected Ineffa build.");
    ineffa.builds.push(structuredClone(selectedBuild));
    expect(
      issueCodes(authenticateKeqingIneffaFormulaSemanticScope(duplicatedBuild)),
    ).toContain("projection.adapter_failed");
  });

  it("rejects selected artifact, weapon-order, and exposed team drift", () => {
    const artifactDrift = structuredClone(repository);
    const guide = requiredGuide(artifactDrift, INEFFA_GUIDE_ID);
    const build = guide.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "FeFiQU8",
    );
    if (!build || build.artifact.type !== "4pc") {
      throw new Error("Missing selected Ineffa formula build.");
    }
    build.artifact.setId = "changed_selected_artifact";
    expect(
      issueCodes(authenticateKeqingIneffaFormulaSemanticScope(artifactDrift)),
    ).toContain("authentication.scope_projection_mismatch");

    const weaponDrift = structuredClone(repository);
    const furina = requiredGuide(
      weaponDrift,
      "genshintools-presets:character-guide:furina",
    );
    const selectedIndex = furina.weaponOrder?.indexOf(
      "splendor_of_tranquil_waters",
    );
    if (selectedIndex == null || selectedIndex < 1 || !furina.weaponOrder) {
      throw new Error("Missing selected Furina formula weapon.");
    }
    const [selected] = furina.weaponOrder.splice(selectedIndex, 1);
    furina.weaponOrder.unshift(selected);
    expect(
      issueCodes(authenticateKeqingIneffaFormulaSemanticScope(weaponDrift)),
    ).toContain("authentication.scope_projection_mismatch");

    const teamDrift = structuredClone(repository);
    const team = requiredRecord(teamDrift, TEAM_ID);
    if (team.kind !== "team" || !team.rotations?.[1]) {
      throw new Error("Missing second source rotation.");
    }
    team.rotations[1].notation = "changed exposed source rotation";
    expect(
      issueCodes(authenticateKeqingIneffaFormulaSemanticScope(teamDrift)),
    ).toContain("authentication.scope_projection_mismatch");
  });

  it("binds selector path and schema identity to the manifest pin", () => {
    const input = buildKeqingIneffaFormulaSemanticScopeAuthenticationInput(
      repository,
    );
    input.manifest.dependencies[0].collectionPath = "/items";
    expect(issueCodes(authenticateScopedSemanticDependencies(input))).toContain(
      "authentication.manifest_mismatch",
    );

    const schemaDrift =
      buildKeqingIneffaFormulaSemanticScopeAuthenticationInput(repository);
    schemaDrift.manifest.dependencies[0].keySchemaId =
      "knowledge-record-id-v2";
    expect(
      issueCodes(authenticateScopedSemanticDependencies(schemaDrift)),
    ).toContain("authentication.manifest_mismatch");
  });

  it("is stable across unrelated records and unselected guide facts", () => {
    const baseline = requireKeqingIneffaFormulaSemanticScope(repository).audit;
    const changed = structuredClone(repository);
    const unrelated = structuredClone(
      changed.records.find(({ id }) => !id.startsWith("genshintools-presets:")) ??
        changed.records[0],
    );
    unrelated.id = "test:unrelated-new-guide-factory-record";
    changed.records.push(unrelated);

    const ineffa = requiredGuide(changed, INEFFA_GUIDE_ID);
    const unselectedBuild = ineffa.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "FeFi2JG",
    );
    if (!unselectedBuild || unselectedBuild.artifact.type !== "4pc") {
      throw new Error("Missing unselected Ineffa guide build.");
    }
    unselectedBuild.artifact.setId = "changed_unselected_artifact";
    unselectedBuild.substats = [];

    expect(requireKeqingIneffaFormulaSemanticScope(changed).audit).toEqual(
      baseline,
    );
  });
});

function issueCodes(
  result: ReturnType<typeof authenticateKeqingIneffaFormulaSemanticScope>,
): string[] {
  if (result.status === "accepted") return [];
  return result.issues.map(({ code }) => code);
}

function requiredRecord(repository: KnowledgeRepository, id: string) {
  const record = repository.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing test record ${id}.`);
  return record;
}

function requiredGuide(repository: KnowledgeRepository, id: string) {
  const record = requiredRecord(repository, id);
  if (record.kind !== "character_guide") {
    throw new Error(`Test record ${id} is not a character guide.`);
  }
  return record;
}
