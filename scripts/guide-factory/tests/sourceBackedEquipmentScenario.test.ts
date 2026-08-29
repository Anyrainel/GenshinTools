import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import {
  materializeSourceBackedEquipmentScenario,
  type SourceBackedEquipmentSelection,
} from "../src/sourceBackedEquipmentScenario";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "../src/schemas";

const TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
const REAL_SELECTIONS: SourceBackedEquipmentSelection[] = [
  {
    characterId: "keqing",
    characterGuideId: "genshintools-presets:character-guide:keqing",
    weaponId: "mistsplitter_reforged",
    buildSourceRecordId: "1WswsAu",
  },
  {
    characterId: "ineffa",
    characterGuideId: "genshintools-presets:character-guide:ineffa",
    weaponId: "fractured_halo",
    buildSourceRecordId: "FeFiQU8",
  },
  {
    characterId: "furina",
    characterGuideId: "genshintools-presets:character-guide:furina",
    weaponId: "splendor_of_tranquil_waters",
    buildSourceRecordId: "BQAI0BO",
  },
  {
    characterId: "xilonen",
    characterGuideId: "genshintools-presets:character-guide:xilonen",
    weaponId: "peak_patrol_song",
    buildSourceRecordId: "Dbt0Wkm",
  },
];

describe("source-backed equipment scenario", () => {
  it("materializes one explicit equipment fixture per exact-team member without adding ER", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const repositoryBefore = structuredClone(repository);
    const selectionsBefore = structuredClone(REAL_SELECTIONS);

    const scenario = materializeSourceBackedEquipmentScenario(
      repository,
      TEAM_ID,
      REAL_SELECTIONS,
    );

    expect(scenario).toMatchObject({
      schemaVersion: 1,
      classification: "source-backed-equipment-fixture",
      supportsGuideClaims: false,
      sourceTeamRecordId: TEAM_ID,
    });
    expect(
      scenario.team.members.map(
        ({ characterId, selectedWeapon, selectedArtifact }) => ({
          characterId,
          selectedWeapon,
          selectedArtifact,
        }),
      ),
    ).toEqual([
      {
        characterId: "keqing",
        selectedWeapon: { weaponId: "mistsplitter_reforged" },
        selectedArtifact: { type: "4pc", setId: "thundering_fury" },
      },
      {
        characterId: "ineffa",
        selectedWeapon: { weaponId: "fractured_halo" },
        selectedArtifact: {
          type: "4pc",
          setId: "aubade_of_morningstar_and_moon",
        },
      },
      {
        characterId: "furina",
        selectedWeapon: { weaponId: "splendor_of_tranquil_waters" },
        selectedArtifact: { type: "4pc", setId: "golden_troupe" },
      },
      {
        characterId: "xilonen",
        selectedWeapon: { weaponId: "peak_patrol_song" },
        selectedArtifact: {
          type: "4pc",
          setId: "scroll_of_the_hero_of_cinder_city",
        },
      },
    ]);
    expect(scenario.evidence).toEqual([
      expect.objectContaining({
        characterId: "keqing",
        guideStatus: "baseline",
        weaponOrderIndex: 0,
        buildSourceRecordId: "1WswsAu",
        build: {
          visible: true,
          artifact: { type: "4pc", setId: "thundering_fury" },
        },
      }),
      expect.objectContaining({
        characterId: "ineffa",
        guideStatus: "baseline",
        weaponOrderIndex: 0,
        buildSourceRecordId: "FeFiQU8",
        build: {
          visible: true,
          artifact: {
            type: "4pc",
            setId: "aubade_of_morningstar_and_moon",
          },
        },
      }),
      expect.objectContaining({
        characterId: "furina",
        guideStatus: "baseline",
        weaponOrderIndex: 2,
        buildSourceRecordId: "BQAI0BO",
        build: {
          visible: true,
          artifact: { type: "4pc", setId: "golden_troupe" },
        },
      }),
      expect.objectContaining({
        characterId: "xilonen",
        guideStatus: "baseline",
        weaponOrderIndex: 0,
        buildSourceRecordId: "Dbt0Wkm",
        build: {
          visible: true,
          artifact: {
            type: "4pc",
            setId: "scroll_of_the_hero_of_cinder_city",
          },
        },
      }),
    ]);
    expect(
      scenario.team.members.every(
        (member) =>
          !("erFloorPercent" in member) && !("erTargets" in member),
      ),
    ).toBe(true);
    expect(
      scenario.team.members.every(
        ({ selectedWeapon }) =>
          selectedWeapon != null && !("refinement" in selectedWeapon),
      ),
    ).toBe(true);
    expect(scenario.cautions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not prove"),
        expect.stringContaining("not computed winners"),
        expect.stringContaining("refinements are unspecified"),
        expect.stringContaining("stat sheets"),
        expect.stringContaining("synergy"),
        expect.stringContaining("No ER floor"),
      ]),
    );

    const sourceTeam = repository.records.find(({ id }) => id === TEAM_ID);
    const sourceGuide = repository.records.find(
      ({ id }) => id === "genshintools-presets:character-guide:keqing",
    );
    expect(scenario.team).not.toBe(sourceTeam);
    expect(scenario.team.sourceRefs[0]).not.toBe(sourceTeam?.sourceRefs[0]);
    expect(scenario.evidence[0].guideSourceRefs[0]).not.toBe(
      sourceGuide?.sourceRefs[0],
    );
    expect(scenario.evidence[0].build.artifact).not.toBe(
      scenario.team.members[0].selectedArtifact,
    );
    expect(repository).toEqual(repositoryBefore);
    expect(REAL_SELECTIONS).toEqual(selectionsBefore);
  });

  it("rejects duplicate, missing, and extra character selections", () => {
    const repository = syntheticRepository();
    const selections = syntheticSelections();
    expect(() =>
      materializeSourceBackedEquipmentScenario(repository, "external:team", [
        ...selections.slice(0, 3),
        { ...selections[0] },
      ]),
    ).toThrow("duplicate selection for a");
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        repository,
        "external:team",
        selections.slice(0, 3),
      ),
    ).toThrow("selections are missing team characters (d)");
    expect(() =>
      materializeSourceBackedEquipmentScenario(repository, "external:team", [
        ...selections,
        { ...selections[0], characterId: "outsider" },
      ]),
    ).toThrow("characters outside the team (outsider)");
  });

  it("refuses to overwrite equipment already present on the source exact team", () => {
    const withWeapon = syntheticRepository();
    const weaponTeam = withWeapon.records.find(
      ({ id }) => id === "external:team",
    );
    if (!weaponTeam || weaponTeam.kind !== "team") {
      throw new Error("Missing synthetic external team.");
    }
    weaponTeam.members[0].selectedWeapon = { weaponId: "source:weapon" };
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        withWeapon,
        "external:team",
        syntheticSelections(),
      ),
    ).toThrow(
      "source team member a already has selectedWeapon; refusing to overwrite source-backed equipment provenance",
    );

    const withArtifact = syntheticRepository();
    const artifactTeam = withArtifact.records.find(
      ({ id }) => id === "external:team",
    );
    if (!artifactTeam || artifactTeam.kind !== "team") {
      throw new Error("Missing synthetic external team.");
    }
    artifactTeam.members[0].selectedArtifact = {
      type: "4pc",
      setId: "source:artifact",
    };
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        withArtifact,
        "external:team",
        syntheticSelections(),
      ),
    ).toThrow(
      "source team member a already has selectedArtifact; refusing to overwrite source-backed equipment provenance",
    );
  });

  it("rejects non-guide, mismatched, unaccepted, absent-weapon, and absent-build evidence", () => {
    const base = syntheticRepository();
    const selections = syntheticSelections();

    const nonGuide = structuredClone(selections);
    nonGuide[0].characterGuideId = "external:team";
    expect(() =>
      materializeSourceBackedEquipmentScenario(base, "external:team", nonGuide),
    ).toThrow("must be a character guide");

    const mismatch = structuredClone(selections);
    mismatch[0].characterGuideId = "guide:b";
    expect(() =>
      materializeSourceBackedEquipmentScenario(base, "external:team", mismatch),
    ).toThrow("belongs to b, not a");

    const candidateGuide = structuredClone(base);
    const guideA = candidateGuide.records.find(({ id }) => id === "guide:a");
    if (!guideA || guideA.kind !== "character_guide") {
      throw new Error("Missing synthetic guide:a.");
    }
    guideA.status = "candidate";
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        candidateGuide,
        "external:team",
        selections,
      ),
    ).toThrow("must have baseline or accepted status");

    const missingWeapon = structuredClone(selections);
    missingWeapon[0].weaponId = "not-listed";
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        base,
        "external:team",
        missingWeapon,
      ),
    ).toThrow("not explicitly present");

    const missingBuild = structuredClone(selections);
    missingBuild[0].buildSourceRecordId = "not-present";
    expect(() =>
      materializeSourceBackedEquipmentScenario(
        base,
        "external:team",
        missingBuild,
      ),
    ).toThrow("expected exactly one build not-present");
  });
});

function syntheticRepository(): KnowledgeRepository {
  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: "0".repeat(64),
    generatedFrom: [],
    records: [
      team("external:team", ["a", "b", "c", "d"]),
      guide("a"),
      guide("b"),
      guide("c"),
      guide("d"),
    ],
  });
}

function syntheticSelections(): SourceBackedEquipmentSelection[] {
  return ["a", "b", "c", "d"].map((characterId) => ({
    characterId,
    characterGuideId: `guide:${characterId}`,
    weaponId: `weapon:${characterId}`,
    buildSourceRecordId: `build:${characterId}`,
  }));
}

function team(
  id: string,
  characterIds: [string, string, string, string],
): KnowledgeRecord {
  return {
    id,
    kind: "team",
    status: "candidate",
    promotionEligible: false,
    members: characterIds.map((characterId) => ({
      characterId,
      investment: { status: "unspecified" as const },
      selectedWeapon: null,
      selectedArtifact: null,
    })) as Extract<KnowledgeRecord, { kind: "team" }>["members"],
    damagePlans: [],
    sourceRefs: [sourceRef(id)],
    unknowns: [],
  };
}

function guide(
  characterId: string,
): Extract<KnowledgeRecord, { kind: "character_guide" }> {
  return {
    id: `guide:${characterId}`,
    kind: "character_guide",
    status: "baseline",
    characterId,
    weaponOrder: [`weapon:${characterId}`],
    builds: [
      {
        sourceRecordId: `build:${characterId}`,
        visible: true,
        artifact: { type: "4pc", setId: `artifact:${characterId}` },
        sands: [],
        goblet: [],
        circlet: [],
        substats: [],
      },
    ],
    sourceRefs: [sourceRef(`guide:${characterId}`)],
    unknowns: [],
  };
}

function sourceRef(sourceRecordId: string) {
  return {
    sourceId: "synthetic",
    sourceRecordId,
    locator: { file: "synthetic.json", recordId: sourceRecordId },
  };
}
