import { beforeAll, describe, expect, it } from "vitest";
import { loadGameCatalogs, type GameCatalogs } from "../src/catalogs";
import {
  CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS,
  CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS,
  recordContributesCharacterGuideInputCoverage,
  requireCurrentCharacterGuideInputRepositoryProjection,
  selectCharacterGuideInputManualSnapshots,
} from "../src/characterGuideInputCoverage";
import { consolidateKnowledge } from "../src/consolidation";
import { buildKnowledgeCorpusInventoryReport } from "../src/corpusInventory";
import {
  compareSourceTranslatedFormulaPlan,
  draftCalculatorDefaultFormulaPlan,
  type FormulaPlanCharacterAssumption,
} from "../src/formulaPlanDraft";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  loadManualSnapshotInputs,
  requiredManualSnapshotInputContaining,
  type ManualSnapshotInput,
} from "../src/manualSnapshots";
import { extractManualConditionOccurrences } from "../src/manualConditionArrayCoverage";
import {
  MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS,
  MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
  MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
  requireCurrentManualConditionRepositoryProjection,
  selectManualConditionCoverageIndex,
  selectManualConditionCoverageSnapshots,
} from "../src/manualConditionArrayCoverageReport";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  GENSHINTOOLS_SNAPSHOT_PATH,
  LEGACY_SNAPSHOT_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import {
  knowledgeRepositoryProjectionSha256,
  projectKnowledgeRepository,
} from "../src/repositoryProjection";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  SourceRegistrySchema,
  type GenshinToolsPresetSnapshot,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type LegacyTeamSnapshot,
  type ManualObservationSnapshot,
  type SourceRegistry,
} from "../src/schemas";
import {
  validateKnowledgeRepository,
  validateManualObservationSnapshot,
} from "../src/validation";

const PACKAGE_PATH = "package.json";
const GUIDE_SOURCE_RECORD_ID =
  "xiao-offensive-artifact-stats-version-5-5";
const SOURCE_RECORD_ID =
  "xiao-no-buff-eeq12hp-rotation-fixture-version-5-5";
const BASELINE_TEAM_ID = "genshintools-presets:team:CX03obKWOJgK51-fWO";

let catalogs: GameCatalogs;
let guideSnapshot: ManualObservationSnapshot;
let fixtureSnapshot: ManualObservationSnapshot;
let repository: KnowledgeRepository;
let currentRepository: KnowledgeRepository;
let sourceRegistry: SourceRegistry;
let genshinToolsSnapshot: GenshinToolsPresetSnapshot;
let legacySnapshot: LegacyTeamSnapshot;
let sourceRegistrySha256: string;
let xiaoGuideSnapshotPath: string;
let xiaoFixtureSnapshotPath: string;
let manualIndexInput: unknown;
let manualInputs: ManualSnapshotInput[];

beforeAll(async () => {
  const [
    loadedManualIndexInput,
    sourceRegistryInput,
    packageSha256,
    loadedCatalogs,
    genshinToolsInput,
    legacyInput,
  ] =
    await Promise.all([
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
      readJson(SOURCE_REGISTRY_PATH),
      sha256File(`${REPOSITORY_ROOT}/${PACKAGE_PATH}`),
      loadGameCatalogs(),
      readJson(GENSHINTOOLS_SNAPSHOT_PATH),
      readJson(LEGACY_SNAPSHOT_PATH),
    ]);
  manualIndexInput = loadedManualIndexInput;
  sourceRegistry = SourceRegistrySchema.parse(sourceRegistryInput);
  sourceRegistrySha256 = await sha256File(SOURCE_REGISTRY_PATH);
  catalogs = loadedCatalogs;

  manualInputs = await loadManualSnapshotInputs(
    manualIndexInput,
    sourceRegistryInput,
  );
  const xiaoGuideInput = requiredManualSnapshotInputContaining(
    manualInputs,
    "kqm",
    GUIDE_SOURCE_RECORD_ID,
  );
  const xiaoFixtureInput = requiredManualSnapshotInputContaining(
    manualInputs,
    "kqm",
    SOURCE_RECORD_ID,
  );
  xiaoGuideSnapshotPath = xiaoGuideInput.snapshotFile.path;
  xiaoFixtureSnapshotPath = xiaoFixtureInput.snapshotFile.path;
  guideSnapshot = ManualObservationSnapshotSchema.parse(
    xiaoGuideInput.snapshot,
  );
  fixtureSnapshot = ManualObservationSnapshotSchema.parse(
    xiaoFixtureInput.snapshot,
  );
  genshinToolsSnapshot = emptyGenshinToolsSnapshot(packageSha256);
  legacySnapshot = emptyLegacySnapshot(packageSha256);
  repository = consolidateKnowledge({
    sourceRegistry,
    sourceRegistrySha256,
    genshinTools: genshinToolsSnapshot,
    legacy: legacySnapshot,
    manualSnapshots: [xiaoGuideInput, xiaoFixtureInput],
  });
  currentRepository = consolidateKnowledge({
    sourceRegistry,
    sourceRegistrySha256,
    genshinTools: genshinToolsInput,
    legacy: legacyInput,
    manualSnapshots: manualInputs,
  });
});

describe("KQM Xiao narrow manual corpus", () => {
  it("indexes seven guide/team records separately from one fixture and validates every local game ID", () => {
    expect(guideSnapshot.page).toMatchObject({
      title: "Xiao Guide: Adeptal Guide to Conquering Xiao",
      url: "https://keqingmains.com/xiao/",
      sourceVersion: "Version 5.5",
    });
    expect(fixtureSnapshot.page).toMatchObject({
      title: guideSnapshot.page.title,
      url: guideSnapshot.page.url,
      sourceVersion: guideSnapshot.page.sourceVersion,
    });
    expect(guideSnapshot.records).toHaveLength(7);
    expect(fixtureSnapshot.records).toHaveLength(1);
    expect(
      [...guideSnapshot.records, ...fixtureSnapshot.records].every(
        ({ extraction }) =>
          extraction.method === "agent-assisted" &&
          extraction.reviewStatus === "unreviewed",
      ),
    ).toBe(true);
    expect(
      guideSnapshot.records.some(
        ({ kind }) => kind === "rotation_fixture",
      ),
    ).toBe(false);
    expect(fixtureSnapshot.records[0]?.kind).toBe("rotation_fixture");
    expect(
      validateManualObservationSnapshot(guideSnapshot, catalogs, "kqm"),
    ).toEqual([]);
    expect(
      validateManualObservationSnapshot(fixtureSnapshot, catalogs, "kqm"),
    ).toEqual([]);
    expect(
      validateKnowledgeRepository(repository, {
        catalogs,
        sourceRegistry,
        expectedSourceRegistrySha256: sourceRegistrySha256,
        genshinToolsSnapshot,
        legacySnapshot,
        manualSnapshots: [guideSnapshot, fixtureSnapshot],
      }),
    ).toEqual([]);

    expect(repository.records).toHaveLength(8);
    expect(
      repository.records.every(
        ({ status, promotionEligible }) =>
          status === "candidate" && promotionEligible === false,
      ),
    ).toBe(true);
  });

  it("preserves offensive stats and the three context branches while deferring ER", () => {
    expect(
      guideSnapshot.records.some(({ kind }) => kind === "energy_guidance"),
    ).toBe(false);

    const stats = manualGuide(
      "xiao-offensive-artifact-stats-version-5-5",
    ).recommendation;
    expect(stats).toMatchObject({
      scope: "artifact-stats",
      mainStats: {
        sands: [{ statIds: ["atk%"], conditions: [] }],
        circlet: [{ statIds: ["cr", "cd"] }],
      },
      substats: [
        { statIds: ["cr", "cd"], priority: 1 },
        { statIds: ["atk%"], priority: 2 },
      ],
    });
    const structuredStatIds = [
      ...(stats.mainStats?.sands ?? []),
      ...(stats.mainStats?.goblet ?? []),
      ...(stats.mainStats?.circlet ?? []),
      ...(stats.substats ?? []),
    ].flatMap(({ statIds }) => statIds);
    expect(structuredStatIds).not.toContain("er");
    expect(stats).not.toHaveProperty("erTargets");

    const vha = manualGuide(
      "xiao-vha-artifact-branch-version-5-5",
    ).recommendation;
    const mh = manualGuide(
      "xiao-mh-artifact-branch-version-5-5",
    ).recommendation;
    const lno = manualGuide(
      "xiao-lno-artifact-branch-c0-c5-version-5-5",
    ).recommendation;
    expect(vha).not.toHaveProperty("maxConstellation");
    expect(mh).not.toHaveProperty("maxConstellation");
    expect(lno).toMatchObject({
      scope: "artifact-sets",
      maxConstellation: 5,
      artifactOrdering: "unranked",
      artifactRecommendations: [
        {
          artifacts: [{ type: "4pc", setId: "long_nights_oath" }],
          grouping: "single",
          classification: "recommended",
        },
      ],
    });

    const consolidatedTeam = knowledgeRecord(
      "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5",
    );
    if (consolidatedTeam.kind !== "team") {
      throw new Error("Expected consolidated Xiao team.");
    }
    expect(
      consolidatedTeam.members.every((member) => !("erTargets" in member)),
    ).toBe(true);
  });

  it("keeps grouped five-star tiers distinct from an unranked four-star list", () => {
    const fiveStar = manualGuide(
      "xiao-five-star-weapon-tiers-version-5-5",
    ).recommendation;
    expect(fiveStar.weaponOrdering).toBe("ranked-groups");
    expect(
      fiveStar.weaponRecommendations?.map(({ weaponIds, grouping }) => ({
        weaponIds,
        grouping,
      })),
    ).toEqual([
      {
        weaponIds: [
          "primordial_jade_wingedspear",
          "staff_of_homa",
          "lumidouce_elegy",
        ],
        grouping: "tied",
      },
      {
        weaponIds: ["vortex_vanquisher", "calamity_queller"],
        grouping: "tied",
      },
      {
        weaponIds: [
          "staff_of_the_scarlet_sands",
          "engulfing_lightning",
          "skyward_spine",
        ],
        grouping: "tied",
      },
    ]);

    const fourStar = manualGuide(
      "xiao-unranked-four-star-weapons-version-5-5",
    ).recommendation;
    expect(fourStar.weaponOrdering).toBe("unranked");
    expect(
      fourStar.weaponRecommendations?.map(({ weaponIds, grouping }) => ({
        weaponIds,
        grouping,
      })),
    ).toEqual(
      [
        "lithic_spear",
        "deathmatch",
        "prospectors_drill",
        "blackcliff_pole",
        "favonius_lance",
        "missive_windspear",
      ].map((weaponId) => ({
        weaponIds: [weaponId],
        grouping: "single",
      })),
    );
  });

  it("preserves the exact FFXX roster and both Faruzan-dependent setup strings", () => {
    const team = manualRecord(
      "xiao-xianyun-furina-faruzan-ffxx-version-5-5",
    );
    if (team.kind !== "team") throw new Error("Missing Xiao FFXX team.");

    expect(team.members.map(({ characterId }) => characterId)).toEqual([
      "xiao",
      "xianyun",
      "furina",
      "faruzan",
    ]);
    expect(team.members.flatMap(({ erTargets }) => erTargets)).toEqual([]);
    const faruzan = team.members[3];
    expect(faruzan).not.toHaveProperty("constellation");
    expect(faruzan).not.toHaveProperty("minConstellation");
    expect(faruzan).not.toHaveProperty("maxConstellation");
    expect(team.rotations).toEqual([
      expect.objectContaining({
        id: "c6-faruzan-setup",
        notation: "Faruzan Q > Furina EQ > Xianyun EPQ > Xiao EE Q",
        unresolvedSegments: [],
        assumptions: ["Faruzan is C6."],
      }),
      expect.objectContaining({
        id: "non-c6-faruzan-setup",
        notation:
          "Faruzan EQ > Furina EQ > Xianyun EPQ > Faruzan CA > Xiao EE Q E",
        unresolvedSegments: [],
        assumptions: ["Faruzan is C0–C5."],
      }),
    ]);

    const consolidated = knowledgeRecord(
      "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5",
    );
    if (consolidated.kind !== "team") {
      throw new Error("Missing consolidated Xiao FFXX team.");
    }
    expect(consolidated.members[3]?.investment).toEqual({
      status: "unspecified",
    });
    expect(consolidated.rotations).toEqual(team.rotations);
  });

  it("consolidates the source-authored EEQ12HP counts without formula-ID claims", () => {
    const fixture = manualRecord(SOURCE_RECORD_ID);
    if (fixture.kind !== "rotation_fixture") {
      throw new Error("Missing Xiao rotation fixture.");
    }
    expect(fixture.rotation).toEqual({
      id: "no-buff-eeq12hp",
      label: "KQM no-buff weapon-comparison rotation",
      notation: "EEQ12HP",
      unresolvedSegments: [],
      assumptions: [
        "This is one Burst rotation used for a weapon-and-refinement damage comparison.",
        "No external buffs are assumed.",
        "Energy Recharge is not considered.",
        "Xiao's Talent Levels are 10/10/10.",
        "Twenty-five perfect artifact rolls are distributed optimally across ATK%, CRIT Rate, and CRIT DMG.",
      ],
    });
    expect(fixture.formulaCounts).toEqual([
      { sourceToken: "E", label: "Elemental Skill", count: 2 },
      { sourceToken: "HP", label: "High Plunge", count: 12 },
    ]);
    expect(
      fixture.formulaCounts.every((count) => !("formulaId" in count)),
    ).toBe(true);

    const consolidated = knowledgeRecord(
      `kqm:rotation-fixture:${SOURCE_RECORD_ID}`,
    );
    expect(consolidated).toMatchObject({
      kind: "rotation_fixture",
      status: "candidate",
      promotionEligible: false,
      characterId: "xiao",
      formulaCounts: fixture.formulaCounts,
    });
    expect(consolidated).not.toBe(fixture);
    if (consolidated.kind !== "rotation_fixture") {
      throw new Error("Missing consolidated Xiao rotation fixture.");
    }
    expect(consolidated.rotation).not.toBe(fixture.rotation);
    expect(consolidated.formulaCounts).not.toBe(fixture.formulaCounts);

    const mappedSnapshot = structuredClone(fixtureSnapshot);
    const mappedFixture = mappedSnapshot.records.find(
      (record) => record.kind === "rotation_fixture",
    );
    if (!mappedFixture) throw new Error("Missing cloned rotation fixture.");
    mappedFixture.formulaCounts[0] = {
      ...mappedFixture.formulaCounts[0],
      formulaId: "xiao-skill",
    } as (typeof mappedFixture.formulaCounts)[number];
    expect(
      ManualObservationSnapshotSchema.safeParse(mappedSnapshot).success,
    ).toBe(false);
  });

  it("counts the fixture without treating it as recommendation or condition-array evidence", () => {
    const fixture = knowledgeRecord(
      `kqm:rotation-fixture:${SOURCE_RECORD_ID}`,
    );
    const fixtureOnlyRepository = KnowledgeRepositorySchema.parse({
      ...repository,
      records: [fixture],
    });
    const inventory = buildKnowledgeCorpusInventoryReport(
      fixtureOnlyRepository,
      sourceRegistry,
    );
    expect(inventory.totals.byKind.rotation_fixture).toBe(1);
    expect(inventory.totals.evidence).toEqual({
      recordsWithWeapons: 0,
      weaponIdOccurrences: 0,
      recordsWithArtifacts: 0,
      artifactChoiceOccurrences: 0,
      recordsWithMainStats: 0,
      mainStatGroups: 0,
      mainStatIdOccurrences: 0,
      recordsWithSubstats: 0,
      substatGroups: 0,
      substatIdOccurrences: 0,
      exactTeamRecords: 0,
      teamTemplateRecords: 0,
      exactTeamRecordsWithRotations: 0,
      exactTeamRotationEntries: 0,
    });
    expect(inventory.characters).toEqual([]);
    expect(recordContributesCharacterGuideInputCoverage(fixture)).toBe(false);
    expect(CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS).toContain(
      xiaoGuideSnapshotPath,
    );
    expect(CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS).not.toContain(
      xiaoFixtureSnapshotPath,
    );
    expect(MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS).toContain(
      xiaoGuideSnapshotPath,
    );
    expect(MANUAL_CONDITION_COVERAGE_SNAPSHOT_PATHS).not.toContain(
      xiaoFixtureSnapshotPath,
    );

    const characterGuideInputs =
      selectCharacterGuideInputManualSnapshots(manualInputs);
    const manualConditionInputs =
      selectManualConditionCoverageSnapshots(manualInputs);
    expect(
      characterGuideInputs.map(({ snapshotFile }) => snapshotFile.path),
    ).toContain(xiaoGuideSnapshotPath);
    expect(
      characterGuideInputs.map(({ snapshotFile }) => snapshotFile.path),
    ).not.toContain(xiaoFixtureSnapshotPath);
    expect(
      manualConditionInputs.map(({ snapshotFile }) => snapshotFile.path),
    ).toContain(xiaoGuideSnapshotPath);
    expect(
      manualConditionInputs.map(({ snapshotFile }) => snapshotFile.path),
    ).not.toContain(xiaoFixtureSnapshotPath);
    const manualConditionIndex = selectManualConditionCoverageIndex(
      manualIndexInput,
    );
    expect(manualConditionIndex.snapshots.map(({ path }) => path)).toContain(
      xiaoGuideSnapshotPath,
    );
    expect(manualConditionIndex.snapshots.map(({ path }) => path)).not.toContain(
      xiaoFixtureSnapshotPath,
    );

    const authenticatedBoundary = {
      characterGuideInput: characterGuideInputs.map(
        ({ snapshotFile }) => snapshotFile.path,
      ),
      manualConditions: manualConditionInputs.map(
        ({ snapshotFile }) => snapshotFile.path,
      ),
      manualConditionIndex,
    };
    const boundarySha256 = sha256Text(stableJson(authenticatedBoundary));
    const editedFixture = structuredClone(fixtureSnapshot);
    const editedFormulaCount = editedFixture.records[0];
    if (!editedFormulaCount || editedFormulaCount.kind !== "rotation_fixture") {
      throw new Error("Missing editable rotation fixture.");
    }
    editedFormulaCount.formulaCounts[1].count = 13;
    expect(sha256Text(stableJson(editedFixture))).not.toBe(
      sha256Text(stableJson(fixtureSnapshot)),
    );
    expect(sha256Text(stableJson(authenticatedBoundary))).toBe(
      boundarySha256,
    );

    const editedManualInputs = manualInputs.map((manualInput) =>
      manualInput.snapshotFile.path === xiaoFixtureSnapshotPath
        ? {
            ...manualInput,
            snapshot: editedFixture,
            snapshotFile: {
              ...manualInput.snapshotFile,
              sha256: sha256Text(stableJson(editedFixture)),
            },
          }
        : manualInput,
    );
    expect(
      stableJson(
        selectCharacterGuideInputManualSnapshots(editedManualInputs),
      ),
    ).toBe(stableJson(characterGuideInputs));
    expect(
      stableJson(selectManualConditionCoverageSnapshots(editedManualInputs)),
    ).toBe(stableJson(manualConditionInputs));

    const extraction = extractManualConditionOccurrences(
      manualConditionIndex,
      manualConditionInputs.map((manualInput) => ({
        path: manualInput.snapshotFile.path,
        snapshotInput: manualInput.snapshot,
      })),
    );
    expect(
      extraction.snapshots.find(({ path }) => path === xiaoGuideSnapshotPath),
    ).toMatchObject({ recordCount: 7 });
    expect(
      extraction.snapshots.some(({ path }) => path === xiaoFixtureSnapshotPath),
    ).toBe(false);
    expect(
      extraction.occurrences.some(
        ({ sourceRecordId }) => sourceRecordId === SOURCE_RECORD_ID,
      ),
    ).toBe(false);
  });

  it("pins semantic repository projections while isolating fixture-only repository drift", () => {
    const repositoryPath =
      "scripts/guide-factory/data/knowledge/repository.json";
    expect(CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS).not.toContain(
      repositoryPath,
    );
    expect(MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS).not.toContain(
      repositoryPath,
    );
    expect(MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS).not.toContain(
      repositoryPath,
    );

    const guidePaths = selectCharacterGuideInputManualSnapshots(
      manualInputs,
    ).map(({ snapshotFile }) => snapshotFile.path);
    const conditionPaths = selectManualConditionCoverageSnapshots(
      manualInputs,
    ).map(({ snapshotFile }) => snapshotFile.path);
    const characterProjection = projectKnowledgeRepository(
      currentRepository,
      "character-guide-input",
      guidePaths,
    );
    const conditionProjection = projectKnowledgeRepository(
      currentRepository,
      "manual-condition-coverage",
      conditionPaths,
    );
    expect(() =>
      requireCurrentCharacterGuideInputRepositoryProjection(
        characterProjection,
      ),
    ).not.toThrow();
    expect(() =>
      requireCurrentManualConditionRepositoryProjection(conditionProjection),
    ).not.toThrow();
    expect(
      characterProjection.records.some(
        ({ kind }) => kind === "rotation_fixture" || kind === "energy_guidance",
      ),
    ).toBe(false);
    expect(
      conditionProjection.records.some(
        ({ kind }) => kind === "rotation_fixture",
      ),
    ).toBe(false);
    expect(
      conditionProjection.records.some(
        ({ kind }) => kind === "energy_guidance",
      ),
    ).toBe(true);
    expect(
      characterProjection.generatedFrom
        .flatMap(({ files }) => files)
        .map(({ path }) => path),
    ).not.toContain(xiaoFixtureSnapshotPath);
    expect(
      conditionProjection.generatedFrom
        .flatMap(({ files }) => files)
        .map(({ path }) => path),
    ).not.toContain(xiaoFixtureSnapshotPath);

    const fixtureEdited = structuredClone(currentRepository);
    const fixtureRecord = fixtureEdited.records.find(
      ({ id }) => id === `kqm:rotation-fixture:${SOURCE_RECORD_ID}`,
    );
    if (!fixtureRecord || fixtureRecord.kind !== "rotation_fixture") {
      throw new Error("Missing current Xiao rotation fixture.");
    }
    fixtureRecord.formulaCounts[1].count = 13;
    fixtureRecord.rotation.assumptions[0] =
      "Edited fixture-only comparison assumption.";
    updateRepositoryRevision(
      fixtureEdited,
      xiaoFixtureSnapshotPath,
      sha256Text(stableJson(fixtureRecord)),
    );
    const fixtureEditedCharacterProjection = projectKnowledgeRepository(
      fixtureEdited,
      "character-guide-input",
      guidePaths,
    );
    const fixtureEditedConditionProjection = projectKnowledgeRepository(
      fixtureEdited,
      "manual-condition-coverage",
      conditionPaths,
    );
    expect(fixtureEditedCharacterProjection).toEqual(characterProjection);
    expect(fixtureEditedConditionProjection).toEqual(conditionProjection);
    expect(
      knowledgeRepositoryProjectionSha256(fixtureEditedCharacterProjection),
    ).toBe(knowledgeRepositoryProjectionSha256(characterProjection));
    expect(
      knowledgeRepositoryProjectionSha256(fixtureEditedConditionProjection),
    ).toBe(knowledgeRepositoryProjectionSha256(conditionProjection));
    expect(() =>
      requireCurrentCharacterGuideInputRepositoryProjection(
        fixtureEditedCharacterProjection,
      ),
    ).not.toThrow();
    expect(() =>
      requireCurrentManualConditionRepositoryProjection(
        fixtureEditedConditionProjection,
      ),
    ).not.toThrow();

    const guideEdited = structuredClone(currentRepository);
    const guideRecord = guideEdited.records.find(
      ({ id }) =>
        id === `kqm:character-guide:${GUIDE_SOURCE_RECORD_ID}`,
    );
    if (!guideRecord || guideRecord.kind !== "character_guide") {
      throw new Error("Missing current Xiao offensive-stat guide.");
    }
    const sands = guideRecord.recommendations?.[0]?.mainStats?.sands?.[0];
    if (!sands) throw new Error("Missing Xiao sands recommendation.");
    sands.conditions.push("Selected guide condition changed.");
    updateRepositoryRevision(
      guideEdited,
      xiaoGuideSnapshotPath,
      sha256Text(stableJson(guideRecord)),
    );
    const guideEditedCharacterProjection = projectKnowledgeRepository(
      guideEdited,
      "character-guide-input",
      guidePaths,
    );
    const guideEditedConditionProjection = projectKnowledgeRepository(
      guideEdited,
      "manual-condition-coverage",
      conditionPaths,
    );
    expect(
      knowledgeRepositoryProjectionSha256(guideEditedCharacterProjection),
    ).not.toBe(knowledgeRepositoryProjectionSha256(characterProjection));
    expect(
      knowledgeRepositoryProjectionSha256(guideEditedConditionProjection),
    ).not.toBe(knowledgeRepositoryProjectionSha256(conditionProjection));
    expect(() =>
      requireCurrentCharacterGuideInputRepositoryProjection(
        guideEditedCharacterProjection,
      ),
    ).toThrow(/projection drifted/);
    expect(() =>
      requireCurrentManualConditionRepositoryProjection(
        guideEditedConditionProjection,
      ),
    ).toThrow(/projection drifted/);
  });

  it("rejects duplicate source tokens and promotion of source-authored fixtures", () => {
    const duplicateSnapshot = structuredClone(fixtureSnapshot);
    const duplicateFixture = duplicateSnapshot.records.find(
      (record) => record.kind === "rotation_fixture",
    );
    if (!duplicateFixture) throw new Error("Missing cloned rotation fixture.");
    duplicateFixture.formulaCounts[1] = {
      ...duplicateFixture.formulaCounts[1],
      sourceToken: "E",
    };
    expect(
      validateManualObservationSnapshot(
        duplicateSnapshot,
        catalogs,
        "kqm",
      ).map(({ code }) => code),
    ).toContain("rotation_fixture.duplicate_source_token");

    const promotedRepository = structuredClone(repository);
    const promotedFixture = promotedRepository.records.find(
      (record) => record.kind === "rotation_fixture",
    );
    if (!promotedFixture) throw new Error("Missing consolidated fixture.");
    promotedFixture.status = "accepted";
    promotedFixture.promotionEligible = true;
    promotedFixture.formulaCounts[1] = {
      ...promotedFixture.formulaCounts[1],
      sourceToken: "E",
    };
    expect(
      validateKnowledgeRepository(promotedRepository, {
        catalogs,
        sourceRegistry,
        expectedSourceRegistrySha256: sourceRegistrySha256,
        genshinToolsSnapshot,
        legacySnapshot,
        manualSnapshots: [guideSnapshot, fixtureSnapshot],
      }).map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining([
        "rotation_fixture.invalid_status",
        "rotation_fixture.promotion_eligible",
        "rotation_fixture.duplicate_source_token",
      ]),
    );
  });

  it("observes source 12 versus calculator-default 11 without making a guide claim", async () => {
    const baselineRepository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const team = baselineRepository.records.find(
      ({ id }) => id === BASELINE_TEAM_ID,
    );
    if (!team || team.kind !== "team") {
      throw new Error(`Missing baseline team ${BASELINE_TEAM_ID}.`);
    }
    const investment: FormulaPlanCharacterAssumption = {
      charLevel: 90,
      constellation: 0,
      refinement: 1,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    };
    const assumptions = Object.fromEntries(
      team.members.map(({ characterId }) => [characterId, investment]),
    );
    const draft = await draftCalculatorDefaultFormulaPlan({
      team,
      assumptions,
    });

    const fixture = manualRecord(SOURCE_RECORD_ID);
    if (fixture.kind !== "rotation_fixture") {
      throw new Error("Missing Xiao rotation fixture.");
    }
    const formulaIdBySourceToken = {
      E: "xiao-skill",
      HP: "xiao-plunge-high",
    } as const;
    const comparison = compareSourceTranslatedFormulaPlan(
      draft,
      fixture.formulaCounts.map(({ sourceToken, count }) => {
        const formulaId =
          formulaIdBySourceToken[
            sourceToken as keyof typeof formulaIdBySourceToken
          ];
        if (!formulaId) {
          throw new Error(`Unmapped Xiao source token ${sourceToken}.`);
        }
        return {
          characterId: "xiao",
          formulaId,
          count,
          mappingBasis:
            `Test-only unreviewed mapping from KQM source token ${sourceToken}; ` +
            "the source record itself does not claim a calculator formula ID.",
        };
      }),
    );

    expect(draft.supportsGuideClaims).toBe(false);
    expect(draft.cautions).toEqual(
      expect.arrayContaining([
        expect.stringContaining("not source-reviewed rotation truth"),
        expect.stringContaining("does not establish an optimal rotation"),
      ]),
    );
    expect(comparison.formulaComparisons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          formulaId: "xiao-skill",
          sourceTranslatedCount: 2,
          calculatorDefaultCount: 2,
          relation: "matches",
        }),
        expect.objectContaining({
          formulaId: "xiao-plunge-high",
          sourceTranslatedCount: 12,
          calculatorDefaultCount: 11,
          relation: "source-translation-higher",
        }),
      ]),
    );
    expect(comparison.mismatches).toEqual([
      expect.objectContaining({
        formulaId: "xiao-plunge-high",
        sourceTranslatedCount: 12,
        calculatorDefaultCount: 11,
      }),
    ]);
  });
});

function manualRecord(sourceRecordId: string) {
  const record = [guideSnapshot, fixtureSnapshot]
    .flatMap(({ records }) => records)
    .find((candidate) => candidate.sourceRecordId === sourceRecordId);
  if (!record) throw new Error(`Missing manual record ${sourceRecordId}.`);
  return record;
}

function manualGuide(sourceRecordId: string) {
  const record = manualRecord(sourceRecordId);
  if (record.kind !== "character_guide") {
    throw new Error(`Expected character guide ${sourceRecordId}.`);
  }
  return record;
}

function knowledgeRecord(id: string): KnowledgeRecord {
  const record = repository.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Missing knowledge record ${id}.`);
  return record;
}

function updateRepositoryRevision(
  target: KnowledgeRepository,
  sourcePath: string,
  sha256: string,
): void {
  const matches = target.generatedFrom.flatMap(({ files }) =>
    files.filter(({ path }) => path === sourcePath),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one repository revision for ${sourcePath}; found ${matches.length}.`,
    );
  }
  matches[0]!.sha256 = sha256;
}

function emptyGenshinToolsSnapshot(
  sha256: string,
): GenshinToolsPresetSnapshot {
  return {
    schemaVersion: 1,
    sourceId: "genshintools-presets",
    capturedAt: "2026-08-30",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    teams: [],
    characterGuides: [],
  };
}

function emptyLegacySnapshot(sha256: string): LegacyTeamSnapshot {
  return {
    schemaVersion: 1,
    sourceId: "legacy-team-research",
    capturedAt: "2026-08-30",
    sourceRevision: { files: [{ path: PACKAGE_PATH, sha256 }] },
    upstreamDomains: [],
    records: [],
  };
}
