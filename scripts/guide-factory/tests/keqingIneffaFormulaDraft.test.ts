import { describe, expect, it } from "vitest";
import {
  buildKeqingIneffaFormulaDraftReport,
  KEQING_INEFFA_EXTERNAL_TEAM_ID,
  KEQING_INEFFA_SOURCE_ROTATION_ID,
} from "../src/keqingIneffaFormulaDraft";
import { readJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("Keqing-Ineffa formula-plan review fixture", () => {
  it("preserves equipment provenance, branch counts, partial tokens, and unresolved aggregates", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH)
    );
    const report = await buildKeqingIneffaFormulaDraftReport(repository, []);

    expect(report).toMatchObject({
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
      status: "needs-domain-review",
      classification: "calculator-default-draft",
      supportsGuideClaims: false,
      promotionEligible: false,
      sourceTeamRecordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
      equipmentFixture: {
        classification: "source-backed-equipment-fixture",
        supportsGuideClaims: false,
        sourceTeamRecordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
      },
      sourceRotation: {
        recordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
        rotationId: KEQING_INEFFA_SOURCE_ROTATION_ID,
      },
      damageReplayReadiness: {
        classification: "formula-plan-readiness-assessment",
        supportsGuideClaims: false,
        reviewStatus: "unreviewed",
        readyForDamageReplay: false,
      },
      authoredTranslation: { reviewStatus: "unreviewed" },
    });
    expect(report.equipmentFixture.evidence).toHaveLength(4);
    expect(
      report.equipmentFixture.evidence.map(
        ({ characterId, weaponId, buildSourceRecordId }) => ({
          characterId,
          weaponId,
          buildSourceRecordId,
        })
      )
    ).toEqual([
      {
        characterId: "keqing",
        weaponId: "mistsplitter_reforged",
        buildSourceRecordId: "1WswsAu",
      },
      {
        characterId: "ineffa",
        weaponId: "fractured_halo",
        buildSourceRecordId: "FeFiQU8",
      },
      {
        characterId: "furina",
        weaponId: "splendor_of_tranquil_waters",
        buildSourceRecordId: "BQAI0BO",
      },
      {
        characterId: "xilonen",
        weaponId: "peak_patrol_song",
        buildSourceRecordId: "Dbt0Wkm",
      },
    ]);
    expect(report.assumptions.characters).toHaveLength(4);
    expect(
      report.assumptions.characters.every(
        ({ charLevel, constellation, refinement, talentLevels }) =>
          charLevel === 90 &&
          constellation === 0 &&
          refinement === 1 &&
          talentLevels.auto === 10 &&
          talentLevels.skill === 10 &&
          talentLevels.burst === 10
      )
    ).toBe(true);

    const relocatedFurinaSkill =
      report.authoredTranslation.formulaComparisons.find(
        ({ characterId, formulaId }) =>
          characterId === "furina" && formulaId === "furina-skill-bubble"
      );
    expect(relocatedFurinaSkill).toMatchObject({
      sourceCountClaim: { type: "exact", value: 1 },
      calculatorDefaultCount: 1,
      relation: "matches",
      sourceTokenCoverage: "complete",
    });
    const partialChargedAttack =
      report.authoredTranslation.formulaComparisons.find(
        ({ characterId, formulaId }) =>
          characterId === "keqing" && formulaId === "keqing-charged"
      );
    expect(partialChargedAttack).toMatchObject({
      sourceCountClaim: { type: "exact", value: 8 },
      calculatorDefaultCount: 5,
      relation: "source-translation-higher",
      sourceTokenCoverage: "partial",
    });

    expect(report.authoredTranslation.discrepancies).toEqual([
      expect.objectContaining({
        characterId: "keqing",
        formulaId: "keqing-charged",
        sourceCountClaim: { type: "exact", value: 8 },
        calculatorDefaultCount: 5,
      }),
      expect.objectContaining({
        characterId: "keqing",
        formulaId: "keqing-skill-slash",
        sourceCountClaim: { type: "exact", value: 2 },
        calculatorDefaultCount: 1,
      }),
      expect.objectContaining({
        characterId: "keqing",
        formulaId: "keqing-stiletto",
        sourceCountClaim: { type: "exact", value: 2 },
        calculatorDefaultCount: 1,
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-e-rush",
        sourceCountClaim: { type: "exact", value: 2 },
        calculatorDefaultCount: 1,
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-normal-2",
        sourceCountClaim: { type: "exact", value: 2 },
        calculatorDefaultCount: 1,
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-q-initial",
        sourceCountClaim: { type: "exact", value: 1 },
        calculatorDefaultCount: 0,
      }),
    ]);
    expect(report.authoredTranslation.unresolvedMappings).toHaveLength(6);
    expect(report.authoredTranslation.unresolvedMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          characterId: "keqing",
          calculatorFormulaId: null,
          sourceToken: expect.stringContaining("8[N1]"),
        }),
        expect.objectContaining({
          calculatorFormulaId: "ineffa-birgitta",
        }),
        expect.objectContaining({
          calculatorFormulaId: "furina-salon-total",
        }),
        expect.objectContaining({
          calculatorFormulaId: "rx-lunarCharged-ineffa",
        }),
      ])
    );
    expect(report.authoredTranslation.sourceAbsentMappings).toEqual([
      expect.objectContaining({
        characterId: "keqing",
        formulaId: "keqing-skill-thunderclap",
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-normal",
      }),
    ]);
    expect(report.damageReplayReadiness.availableFormulaCoverage).toMatchObject(
      {
        total: 18,
        mapped: 11,
        unresolved: 5,
        sourceAbsent: 2,
        unclassified: 0,
      }
    );
    expect(report.damageReplayReadiness.positiveDefaultCoverage).toMatchObject({
      total: 13,
      mapped: 10,
      unresolved: 3,
      sourceAbsent: 0,
      unclassified: 0,
    });
    expect(report.damageReplayReadiness.sourceMappingSummary).toEqual({
      comparisons: 11,
      exactClaims: 11,
      rangeClaims: 0,
      completeTokenMappings: 10,
      partialTokenMappings: 1,
      unresolvedMappings: 6,
      nonNullFormulaUnresolvedMappings: 5,
      nullFormulaUnresolvedMappings: 1,
      sourceAbsentMappings: 2,
    });
    expect(
      report.damageReplayReadiness.blockers.map(({ code }) => code)
    ).toEqual([
      "translation-unreviewed",
      "partial-token-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-source-token",
    ]);
    expect(report.cautions.join(" ")).toContain(
      "does not prove that the guide build applies to this team"
    );
    expect(report.cautions.join(" ")).toContain(
      "parenthesized Skill changes position rather than count"
    );
    expect(report.cautions.join(" ")).toContain(
      "off-field hit counts"
    );
  });

  it("fails closed when the captured rotation or build investment changes", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH)
    );
    const changedRotation = structuredClone(repository);
    const team = changedRotation.records.find(
      ({ id }) => id === KEQING_INEFFA_EXTERNAL_TEAM_ID
    );
    if (!team || team.kind !== "team" || !team.rotations?.[0]) {
      throw new Error("Missing Keqing-Ineffa source rotation fixture.");
    }
    team.rotations[0].notation = "changed source rotation";
    await expect(
      buildKeqingIneffaFormulaDraftReport(changedRotation, [])
    ).rejects.toThrow("source rotation evidence changed");

    const changedFootnote = structuredClone(repository);
    const footnoteTeam = changedFootnote.records.find(
      ({ id }) => id === KEQING_INEFFA_EXTERNAL_TEAM_ID
    );
    if (!footnoteTeam || footnoteTeam.kind !== "team" || !footnoteTeam.rotations?.[0]) {
      throw new Error("Missing Keqing-Ineffa source rotation fixture.");
    }
    footnoteTeam.rotations[0].assumptions[0] = "changed source footnote";
    await expect(
      buildKeqingIneffaFormulaDraftReport(changedFootnote, [])
    ).rejects.toThrow("source rotation evidence changed");

    const newlyUnresolved = structuredClone(repository);
    const unresolvedTeam = newlyUnresolved.records.find(
      ({ id }) => id === KEQING_INEFFA_EXTERNAL_TEAM_ID
    );
    if (!unresolvedTeam || unresolvedTeam.kind !== "team" || !unresolvedTeam.rotations?.[0]) {
      throw new Error("Missing Keqing-Ineffa source rotation fixture.");
    }
    unresolvedTeam.rotations[0].unresolvedSegments.push("new ambiguity");
    await expect(
      buildKeqingIneffaFormulaDraftReport(newlyUnresolved, [])
    ).rejects.toThrow("source rotation evidence changed");

    const incompatibleBuild = structuredClone(repository);
    const guide = incompatibleBuild.records.find(
      ({ id }) => id === "genshintools-presets:character-guide:keqing"
    );
    if (!guide || guide.kind !== "character_guide") {
      throw new Error("Missing Keqing baseline guide fixture.");
    }
    const build = guide.builds.find(
      ({ sourceRecordId }) => sourceRecordId === "1WswsAu"
    );
    if (!build) throw new Error("Missing Keqing artifact build fixture.");
    build.minConstellation = 6;
    await expect(
      buildKeqingIneffaFormulaDraftReport(incompatibleBuild, [])
    ).rejects.toThrow("requires constellation 6");
  });
});
