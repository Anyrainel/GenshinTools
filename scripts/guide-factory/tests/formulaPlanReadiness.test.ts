import { describe, expect, it } from "vitest";
import type {
  FormulaCountClaimComparison,
  FormulaPlanDraftOutput,
} from "../src/formulaPlanDraft";
import {
  assessFormulaPlanReadiness,
  type UnresolvedFormulaMapping,
} from "../src/formulaPlanReadiness";

describe("formula-plan readiness", () => {
  it("is ready when a reviewed translation exactly and completely maps every positive default", () => {
    const draft = formulaDraft(
      [
        { characterId: "a", formulaId: "a-skill", count: 1 },
        { characterId: "b", formulaId: "b-burst", count: 2 },
      ],
      [{ characterId: "a", formulaId: "a-passive" }],
    );
    const comparisons = [
      comparison("a", "a-skill", 1, exact(3), "complete"),
      comparison("b", "b-burst", 2, exact(2), "complete"),
      comparison("a", "a-passive", 0, exact(1), "complete"),
    ];
    const draftBefore = structuredClone(draft);
    const comparisonsBefore = structuredClone(comparisons);

    const assessment = assessFormulaPlanReadiness(
      draft,
      comparisons,
      [],
      [],
      "reviewed",
    );

    expect(assessment).toEqual({
      schemaVersion: 1,
      classification: "formula-plan-readiness-assessment",
      supportsGuideClaims: false,
      sourceTeamRecordId: "external:team",
      reviewStatus: "reviewed",
      readyForDamageReplay: true,
      availableFormulaCoverage: {
        total: 3,
        mapped: 3,
        unresolved: 0,
        sourceAbsent: 0,
        unclassified: 0,
        rows: [
          {
            characterId: "a",
            formulaId: "a-passive",
            calculatorDefaultCount: 0,
            classification: "mapped",
            sourceCountClaim: { type: "exact", value: 1 },
            sourceTokenCoverage: "complete",
          },
          {
            characterId: "a",
            formulaId: "a-skill",
            calculatorDefaultCount: 1,
            classification: "mapped",
            sourceCountClaim: { type: "exact", value: 3 },
            sourceTokenCoverage: "complete",
          },
          {
            characterId: "b",
            formulaId: "b-burst",
            calculatorDefaultCount: 2,
            classification: "mapped",
            sourceCountClaim: { type: "exact", value: 2 },
            sourceTokenCoverage: "complete",
          },
        ],
      },
      positiveDefaultCoverage: {
        total: 2,
        mapped: 2,
        unresolved: 0,
        sourceAbsent: 0,
        unclassified: 0,
        rows: [
          {
            characterId: "a",
            formulaId: "a-skill",
            calculatorDefaultCount: 1,
            classification: "mapped",
            sourceCountClaim: { type: "exact", value: 3 },
            sourceTokenCoverage: "complete",
          },
          {
            characterId: "b",
            formulaId: "b-burst",
            calculatorDefaultCount: 2,
            classification: "mapped",
            sourceCountClaim: { type: "exact", value: 2 },
            sourceTokenCoverage: "complete",
          },
        ],
      },
      sourceMappingSummary: {
        comparisons: 3,
        exactClaims: 3,
        rangeClaims: 0,
        completeTokenMappings: 3,
        partialTokenMappings: 0,
        unresolvedMappings: 0,
        nonNullFormulaUnresolvedMappings: 0,
        nullFormulaUnresolvedMappings: 0,
        sourceAbsentMappings: 0,
      },
      blockers: [],
    });
    expect(draft).toEqual(draftBefore);
    expect(comparisons).toEqual(comparisonsBefore);
  });

  it("blocks a fully classified translation with review, range, partial, and unresolved work", () => {
    const draft = formulaDraft(
      [
        { characterId: "keqing", formulaId: "keqing-burst", count: 1 },
        { characterId: "keqing", formulaId: "keqing-charged", count: 5 },
        { characterId: "support", formulaId: "optional-skill", count: 1 },
        { characterId: "ineffa", formulaId: "ineffa-birgitta", count: 1 },
      ],
      [{ characterId: "xilonen", formulaId: "xilonen-burst" }],
    );
    const comparisons = [
      comparison("keqing", "keqing-burst", 1, exact(1), "complete"),
      comparison(
        "support",
        "optional-skill",
        1,
        { type: "range", minimum: 0, maximum: 1 },
        "complete",
      ),
      comparison("keqing", "keqing-charged", 5, exact(8), "partial"),
    ];
    const unresolved: UnresolvedFormulaMapping[] = [
      {
        characterId: "ineffa",
        sourceToken: "off-field hits",
        calculatorFormulaId: "ineffa-birgitta",
        reason: "the source does not enumerate hit count",
      },
      {
        characterId: "xilonen",
        sourceToken: "optional Q",
        calculatorFormulaId: "xilonen-burst",
        reason: "the zero default does not establish the optional branch",
      },
      {
        characterId: "keqing",
        sourceToken: "8[N1]",
        calculatorFormulaId: null,
        reason: "no matching normal-attack aggregate exists",
      },
    ];

    const assessment = assessFormulaPlanReadiness(
      draft,
      comparisons,
      unresolved,
      [],
      "unreviewed",
    );

    expect(assessment.readyForDamageReplay).toBe(false);
    expect(assessment.positiveDefaultCoverage).toMatchObject({
      total: 4,
      mapped: 3,
      unresolved: 1,
      unclassified: 0,
    });
    expect(
      assessment.positiveDefaultCoverage.rows.map(
        ({ characterId, formulaId, classification }) => ({
          characterId,
          formulaId,
          classification,
        }),
      ),
    ).toEqual([
      {
        characterId: "ineffa",
        formulaId: "ineffa-birgitta",
        classification: "unresolved",
      },
      {
        characterId: "keqing",
        formulaId: "keqing-burst",
        classification: "mapped",
      },
      {
        characterId: "keqing",
        formulaId: "keqing-charged",
        classification: "mapped",
      },
      {
        characterId: "support",
        formulaId: "optional-skill",
        classification: "mapped",
      },
    ]);
    expect(assessment.sourceMappingSummary).toEqual({
      comparisons: 3,
      exactClaims: 2,
      rangeClaims: 1,
      completeTokenMappings: 2,
      partialTokenMappings: 1,
      unresolvedMappings: 3,
      nonNullFormulaUnresolvedMappings: 2,
      nullFormulaUnresolvedMappings: 1,
      sourceAbsentMappings: 0,
    });
    expect(assessment.blockers.map(({ code }) => code)).toEqual([
      "translation-unreviewed",
      "range-count-claim",
      "partial-token-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-source-token",
    ]);
  });

  it("blocks an unclassified positive default", () => {
    const assessment = assessFormulaPlanReadiness(
      formulaDraft([
        { characterId: "a", formulaId: "a-skill", count: 1 },
        { characterId: "b", formulaId: "b-burst", count: 1 },
      ]),
      [comparison("a", "a-skill", 1, exact(1), "complete")],
      [],
      [],
      "reviewed",
    );

    expect(assessment.readyForDamageReplay).toBe(false);
    expect(assessment.positiveDefaultCoverage).toMatchObject({
      mapped: 1,
      unresolved: 0,
      unclassified: 1,
    });
    expect(assessment.blockers).toEqual([
      expect.objectContaining({
        code: "unclassified-formula",
        characterId: "b",
        formulaId: "b-burst",
      }),
    ]);
  });

  it("requires every zero-default formula to be mapped, unresolved, or explicitly source-absent", () => {
    const draft = formulaDraft(
      [{ characterId: "a", formulaId: "a-skill", count: 1 }],
      [{ characterId: "a", formulaId: "a-unused-option" }],
    );
    const comparisons = [
      comparison("a", "a-skill", 1, exact(1), "complete"),
    ];

    const unclassified = assessFormulaPlanReadiness(
      draft,
      comparisons,
      [],
      [],
      "reviewed",
    );
    expect(unclassified.readyForDamageReplay).toBe(false);
    expect(unclassified.blockers).toEqual([
      expect.objectContaining({
        code: "unclassified-formula",
        characterId: "a",
        formulaId: "a-unused-option",
      }),
    ]);

    const classified = assessFormulaPlanReadiness(
      draft,
      comparisons,
      [],
      [
        {
          characterId: "a",
          formulaId: "a-unused-option",
          reason: "the source uses a different mutually exclusive option",
        },
      ],
      "reviewed",
    );
    expect(classified.readyForDamageReplay).toBe(true);
    expect(classified.availableFormulaCoverage).toMatchObject({
      total: 2,
      mapped: 1,
      unresolved: 0,
      sourceAbsent: 1,
      unclassified: 0,
    });
    expect(classified.sourceMappingSummary.sourceAbsentMappings).toBe(1);
  });

  it("lets reviewed source absence override a positive calculator default", () => {
    const assessment = assessFormulaPlanReadiness(
      formulaDraft([
        { characterId: "a", formulaId: "a-skill", count: 1 },
        { characterId: "a", formulaId: "a-generic-default", count: 2 },
      ]),
      [comparison("a", "a-skill", 1, exact(1), "complete")],
      [],
      [
        {
          characterId: "a",
          formulaId: "a-generic-default",
          reason: "the reviewed source rotation omits this generic action",
        },
      ],
      "reviewed",
    );

    expect(assessment.readyForDamageReplay).toBe(true);
    expect(assessment.positiveDefaultCoverage).toMatchObject({
      total: 2,
      mapped: 1,
      unresolved: 0,
      sourceAbsent: 1,
      unclassified: 0,
    });
  });

  it("rejects duplicate, overlapping, and unknown formula classifications", () => {
    const draft = formulaDraft(
      [{ characterId: "a", formulaId: "a-skill", count: 1 }],
      [{ characterId: "a", formulaId: "a-zero" }],
    );
    const mapped = comparison("a", "a-skill", 1, exact(1), "complete");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [mapped, mapped],
        [],
        [],
        "reviewed",
      ),
    ).toThrow("duplicate comparison for a.a-skill");

    const unresolved = unresolvedMapping("a", "a-skill");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [],
        [unresolved, unresolved],
        [],
        "reviewed",
      ),
    ).toThrow("duplicate unresolved formula a.a-skill");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [mapped],
        [unresolved],
        [],
        "reviewed",
      ),
    ).toThrow("a.a-skill is both mapped and unresolved");

    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [comparison("a", "unknown", 0, exact(1), "complete")],
        [],
        [],
        "reviewed",
      ),
    ).toThrow("comparison references unknown draft formula a.unknown");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [],
        [unresolvedMapping("a", "unknown")],
        [],
        "reviewed",
      ),
    ).toThrow("unresolved mapping references unknown draft formula a.unknown");

    const sourceAbsent = {
      characterId: "a",
      formulaId: "a-zero",
      reason: "synthetic absence",
    };
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [],
        [],
        [sourceAbsent, sourceAbsent],
        "reviewed",
      ),
    ).toThrow("duplicate source-absent formula a.a-zero");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [],
        [unresolvedMapping("a", "a-zero")],
        [sourceAbsent],
        "reviewed",
      ),
    ).toThrow("a.a-zero is both unresolved and source-absent");
    expect(() =>
      assessFormulaPlanReadiness(
        draft,
        [],
        [],
        [{ ...sourceAbsent, reason: "  " }],
        "reviewed",
      ),
    ).toThrow("source-absent formula a.a-zero requires a reason");
  });
});

function formulaDraft(
  lines: FormulaPlanDraftOutput["lines"],
  zeroCountAvailableFormulas: FormulaPlanDraftOutput["zeroCountAvailableFormulas"] = [],
): FormulaPlanDraftOutput {
  return {
    schemaVersion: 1,
    classification: "calculator-default-draft",
    supportsGuideClaims: false,
    sourceTeamRecordId: "external:team",
    assumptions: { combatOptions: "calculator-defaults", characters: [] },
    cautions: [],
    lines,
    zeroCountAvailableFormulas,
  };
}

function exact(value: number) {
  return { type: "exact" as const, value };
}

function comparison(
  characterId: string,
  formulaId: string,
  calculatorDefaultCount: number,
  sourceCountClaim: FormulaCountClaimComparison["sourceCountClaim"],
  sourceTokenCoverage: FormulaCountClaimComparison["sourceTokenCoverage"],
): FormulaCountClaimComparison {
  const relation =
    sourceCountClaim.type === "range"
      ? "calculator-default-within-source-range"
      : sourceCountClaim.value === calculatorDefaultCount
        ? "matches"
        : sourceCountClaim.value > calculatorDefaultCount
          ? "source-translation-higher"
          : "calculator-default-higher";
  return {
    characterId,
    formulaId,
    sourceCountClaim,
    calculatorDefaultCount,
    relation,
    sourceTokenCoverage,
    mappingBasis: "synthetic source token mapping",
  };
}

function unresolvedMapping(
  characterId: string,
  calculatorFormulaId: string,
): UnresolvedFormulaMapping {
  return {
    characterId,
    sourceToken: "source token",
    calculatorFormulaId,
    reason: "synthetic unresolved reason",
  };
}
