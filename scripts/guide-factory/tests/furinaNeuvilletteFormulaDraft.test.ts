import { describe, expect, it } from "vitest";
import {
  buildFurinaNeuvilletteFormulaDraftReport,
  FURINA_NEUVILLETTE_BASELINE_TEAM_ID,
  FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
  FURINA_NEUVILLETTE_SOURCE_ROTATION_ID,
} from "../src/furinaNeuvilletteFormulaDraft";
import { readJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import { KnowledgeRepositorySchema } from "../src/schemas";

describe("Furina-Neuvillette formula-plan review fixture", () => {
  it("exposes source-rotation mismatches without promoting the translated counts", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const report = await buildFurinaNeuvilletteFormulaDraftReport(
      repository,
      [],
    );

    expect(report).toMatchObject({
      status: "needs-domain-review",
      classification: "calculator-default-draft",
      supportsGuideClaims: false,
      promotionEligible: false,
      sourceTeamRecordId: FURINA_NEUVILLETTE_BASELINE_TEAM_ID,
      rosterAgreement: { exact: true },
      sourceRotation: {
        recordId: FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
        rotationId: FURINA_NEUVILLETTE_SOURCE_ROTATION_ID,
      },
      authoredTranslation: {
        reviewStatus: "unreviewed",
      },
    });
    expect(report.validationTargets).toEqual([
      {
        recordId: FURINA_NEUVILLETTE_BASELINE_TEAM_ID,
        supports: ["roster", "selected-weapons", "selected-artifact-sets"],
      },
      {
        recordId: FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
        supports: ["roster", "rotation"],
      },
    ]);
    expect(report.lines.length).toBeGreaterThan(0);
    expect(report.authoredTranslation.mismatches).toEqual([
      expect.objectContaining({
        characterId: "neuvillette",
        formulaId: "neuvillette-judgment",
        sourceTranslatedCount: 4,
        calculatorDefaultCount: 3,
        relation: "source-translation-higher",
      }),
      expect.objectContaining({
        characterId: "neuvillette",
        formulaId: "neuvillette-skill",
        sourceTranslatedCount: 2,
        calculatorDefaultCount: 3,
        relation: "calculator-default-higher",
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-e-rush",
        sourceTranslatedCount: 2,
        calculatorDefaultCount: 1,
        relation: "source-translation-higher",
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-normal-2",
        sourceTranslatedCount: 2,
        calculatorDefaultCount: 1,
        relation: "source-translation-higher",
      }),
      expect.objectContaining({
        characterId: "xilonen",
        formulaId: "xilonen-q-initial",
        sourceTranslatedCount: 1,
        calculatorDefaultCount: 0,
        relation: "source-translation-higher",
      }),
    ]);
    expect(report.authoredTranslation.unresolvedMappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          characterId: "furina",
          sourceToken: "N1",
          calculatorFormulaId: null,
        }),
        expect.objectContaining({
          calculatorFormulaId: "furina-salon-total",
        }),
        expect.objectContaining({
          calculatorFormulaId: "rx-swirl-Hydro-kaedehara_kazuha",
        }),
        expect.objectContaining({
          calculatorFormulaId: "neuvillette-spiritbreath",
        }),
        expect.objectContaining({
          calculatorFormulaId: "kazuha-plunge-hydro",
        }),
        expect.objectContaining({
          calculatorFormulaId: "kazuha-burst-hydro",
        }),
      ]),
    );
    expect(report.cautions.join(" ")).toContain(
      "not source-reviewed rotation truth",
    );
  });
});
