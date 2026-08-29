import { describe, expect, it } from "vitest";
import {
  buildArtifactGenerationPreflight,
  COMPARISON_BASELINE_REFINEMENT_POLICY,
  type ArtifactGenerationPreflightEnvironment,
} from "../src/artifactGenerationPreflight";
import type {
  FormulaPlanReadinessAssessment,
  FormulaPlanReadinessBlocker,
} from "../src/formulaPlanReadiness";
import type { FormulaPlanDraftOutput } from "../src/formulaPlanDraft";
import {
  buildKeqingIneffaFormulaDraftReport,
  buildKeqingIneffaSourceBackedEquipmentScenario,
  KEQING_INEFFA_EXTERNAL_TEAM_ID,
} from "../src/keqingIneffaFormulaDraft";
import { readJson, stableJson } from "../src/io";
import { KNOWLEDGE_REPOSITORY_PATH } from "../src/paths";
import type { SourceBackedEquipmentScenario } from "../src/sourceBackedEquipmentScenario";
import {
  KnowledgeRepositorySchema,
  KnowledgeTeamSchema,
  type ArtifactChoice,
} from "../src/schemas";

describe("artifact-generation experiment preflight", () => {
  it("resolves the real Keqing-Ineffa fixture while retaining formula blockers", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH),
    );
    const fixture = buildKeqingIneffaSourceBackedEquipmentScenario(repository);
    const draft = await buildKeqingIneffaFormulaDraftReport(repository, []);
    const fixtureBefore = structuredClone(fixture);
    const readinessBefore = structuredClone(draft.damageReplayReadiness);

    const report = buildArtifactGenerationPreflight({
      fixture,
      formulaDraft: draft,
      formulaReadiness: draft.damageReplayReadiness,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      classification: "artifact-generation-experiment-preflight",
      supportsGuideClaims: false,
      sourceTeamRecordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
      refinementPolicy: COMPARISON_BASELINE_REFINEMENT_POLICY,
      gates: {
        uniqueTeamCharacters: true,
        equipmentComplete: true,
        fixtureEvidenceConsistent: true,
        refinementsResolved: true,
        exactCandidatePairs: true,
        nativeTypesCompatible: true,
        artifactsInitiallyEnumerated: true,
        formulaDraftMatchesResolvedFixture: true,
        formulaPlanSourceMatches: true,
        formulaReadinessMatchesDraft: true,
        formulaPlanReady: false,
      },
      equipmentReadyForTechnicalProbe: true,
      readyForReviewedGeneratorExperiment: false,
      readyForGenerator: false,
      formulaReadiness: {
        reviewStatus: "unreviewed",
        readyForDamageReplay: false,
        positiveDefaultCoverage: {
          total: 13,
          mapped: 10,
          unresolved: 3,
          sourceAbsent: 0,
          unclassified: 0,
        },
      },
      blockers: [{ code: "formula-plan-not-ready" }],
    });
    expect(
      report.members.map(({ characterId, weapon, artifact, ready }) => ({
        characterId,
        fixtureRefinement: weapon.fixtureRefinement,
        experimentRefinement: weapon.experimentRefinement,
        refinementOrigin: weapon.refinementOrigin,
        exactCandidatePair: weapon.exactCandidatePair,
        nativeTypeCompatibility: weapon.nativeTypeCompatibility,
        artifactCoverage: artifact.initialGrammarCoverage,
        ready,
      })),
    ).toEqual([
      resolvedRealMember("keqing"),
      resolvedRealMember("ineffa"),
      resolvedRealMember("furina"),
      resolvedRealMember("xilonen"),
    ]);
    expect(report.formulaReadiness.blockers).toHaveLength(8);
    expect(report.formulaReadiness.blockers.map(({ code }) => code)).toEqual([
      "translation-unreviewed",
      "partial-token-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-formula-mapping",
      "unresolved-source-token",
    ]);
    expect(report.formulaDraftBinding).toMatchObject({
      assumptionClassification: "calculator-fixture-experiment-assumptions",
      characters: expect.arrayContaining([
        expect.objectContaining({
          characterId: "keqing",
          charLevel: 90,
          constellation: 0,
          refinement: 1,
          talentLevels: { auto: 10, skill: 10, burst: 10 },
        }),
      ]),
    });
    expect(fixture).toEqual(fixtureBefore);
    expect(draft.damageReplayReadiness).toEqual(readinessBefore);
  });

  it("can pass a reviewed synthetic fixture with explicit policy provenance", () => {
    const fixture = syntheticFixture();
    const draft = syntheticFormulaDraft(fixture);
    const readiness = syntheticReadiness();
    const environment = syntheticEnvironment();
    const before = structuredClone({ fixture, draft, readiness });

    const first = buildArtifactGenerationPreflight(
      { fixture, formulaDraft: draft, formulaReadiness: readiness },
      [],
      environment,
    );
    const second = buildArtifactGenerationPreflight(
      { fixture, formulaDraft: draft, formulaReadiness: readiness },
      [],
      environment,
    );

    expect(first.gates).toEqual({
      uniqueTeamCharacters: true,
      equipmentComplete: true,
      fixtureEvidenceConsistent: true,
      refinementsResolved: true,
      exactCandidatePairs: true,
      nativeTypesCompatible: true,
      artifactsInitiallyEnumerated: true,
      formulaDraftMatchesResolvedFixture: true,
      formulaPlanSourceMatches: true,
      formulaReadinessMatchesDraft: true,
      formulaPlanReady: true,
    });
    expect(first.equipmentReadyForTechnicalProbe).toBe(true);
    expect(first.readyForReviewedGeneratorExperiment).toBe(true);
    expect(first.readyForGenerator).toBe(true);
    expect(first.blockers).toEqual([]);
    expect(
      first.members.map(({ characterId, weapon }) => ({
        characterId,
        fixtureRefinement: weapon.fixtureRefinement,
        experimentRefinement: weapon.experimentRefinement,
        refinementOrigin: weapon.refinementOrigin,
        candidateRefinements: weapon.candidateRefinements,
      })),
    ).toEqual([
      {
        characterId: "a",
        fixtureRefinement: null,
        experimentRefinement: 5,
        refinementOrigin: "experiment-policy",
        candidateRefinements: [5],
      },
      {
        characterId: "b",
        fixtureRefinement: null,
        experimentRefinement: 1,
        refinementOrigin: "experiment-policy",
        candidateRefinements: [1, 5],
      },
      {
        characterId: "c",
        fixtureRefinement: 5,
        experimentRefinement: 5,
        refinementOrigin: "fixture-explicit",
        candidateRefinements: [1, 5],
      },
      {
        characterId: "d",
        fixtureRefinement: 5,
        experimentRefinement: 5,
        refinementOrigin: "fixture-explicit",
        candidateRefinements: [5],
      },
    ]);
    expect(stableJson(second)).toBe(stableJson(first));
    expect({ fixture, draft, readiness }).toEqual(before);
    const prohibitedKeys = new Set([
      "artifactsByChar",
      "sheetsByChar",
      "totalDamage",
      "lineDamages",
      "damage",
      "score",
      "winner",
      "rank",
      "er",
      "energy",
    ]);
    expect(collectKeys(first).filter((key) => prohibitedKeys.has(key))).toEqual(
      [],
    );
  });

  it("blocks unsupported refinements, wrong types, absent candidates, and non-initial artifacts", () => {
    const fixture = syntheticFixture([
      syntheticMember("a", "four_bow", 1, fourPiece("set_a")),
      syntheticMember("b", "five_sword", null, fourPiece("set_b")),
      syntheticMember(
        "c",
        "five_catalyst",
        5,
        { type: "2pc+2pc", halfSetIds: ["atk%-18", "er-20"] },
      ),
      syntheticMember("d", "beta_polearm", null, fourPiece("set_d")),
    ]);
    const environment = syntheticEnvironment();
    environment.characterWeaponTypes = {
      ...environment.characterWeaponTypes,
      b: "Bow",
    };
    const draft = syntheticFormulaDraft(fixture, {
      a: 1,
      b: 1,
      c: 5,
      d: 1,
    });

    const report = buildArtifactGenerationPreflight(
      {
        fixture,
        formulaDraft: draft,
        formulaReadiness: syntheticReadiness(),
      },
      [],
      environment,
    );

    expect(report.readyForGenerator).toBe(false);
    expect(report.gates).toMatchObject({
      refinementsResolved: false,
      exactCandidatePairs: false,
      nativeTypesCompatible: false,
      artifactsInitiallyEnumerated: false,
    });
    expect(report.blockers.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "explicit-refinement-not-candidate",
        "native-weapon-type-mismatch",
        "artifact-not-in-initial-grammar",
        "weapon-outside-released-candidate-domain",
        "formula-draft-refinement-mismatch",
      ]),
    );
    expect(
      report.members.find(({ characterId }) => characterId === "c")?.artifact,
    ).toMatchObject({
      initialGrammarCoverage: "not-enumerated-initially",
      failureReason: "two-piece-choice-is-not-in-initial-grammar",
    });
  });

  it("binds draft, readiness, investment, and global evidence to the exact fixture", () => {
    const fixture = syntheticFixture();
    fixture.team.members[3].investment = {
      status: "partial",
      constellation: 2,
    };
    const draft = syntheticFormulaDraft(fixture);
    draft.assumptions.characters[0].selectedWeaponId = "five_sword";
    draft.assumptions.characters[1].selectedArtifact = fourPiece("set_a");
    draft.assumptions.characters[2].refinement = 1;
    draft.lines.push({ characterId: "a", formulaId: "a-skill", count: 1 });

    const report = buildArtifactGenerationPreflight(
      {
        fixture,
        formulaDraft: draft,
        formulaReadiness: syntheticReadiness(),
      },
      [],
      syntheticEnvironment(),
    );

    expect(report.gates.formulaDraftMatchesResolvedFixture).toBe(false);
    expect(report.readyForGenerator).toBe(false);
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "formula-draft-equipment-mismatch",
          characterId: "a",
        }),
        expect.objectContaining({
          code: "formula-draft-equipment-mismatch",
          characterId: "b",
        }),
        expect.objectContaining({
          code: "formula-draft-refinement-mismatch",
          characterId: "c",
        }),
        expect.objectContaining({
          code: "formula-draft-investment-mismatch",
          characterId: "d",
        }),
        expect.objectContaining({
          code: "formula-readiness-draft-mismatch",
        }),
      ]),
    );

    const extraEvidenceFixture = syntheticFixture();
    extraEvidenceFixture.evidence.push({
      ...structuredClone(extraEvidenceFixture.evidence[0]),
      characterId: "outsider",
    });
    const extraEvidenceReport = buildArtifactGenerationPreflight(
      {
        fixture: extraEvidenceFixture,
        formulaDraft: syntheticFormulaDraft(extraEvidenceFixture),
        formulaReadiness: syntheticReadiness(),
      },
      [],
      syntheticEnvironment(),
    );

    expect(extraEvidenceReport.gates.fixtureEvidenceConsistent).toBe(false);
    expect(extraEvidenceReport.equipmentReadyForTechnicalProbe).toBe(false);
    expect(extraEvidenceReport.readyForGenerator).toBe(false);
    expect(extraEvidenceReport.blockers).toContainEqual(
      expect.objectContaining({
        code: "fixture-evidence-for-non-member",
        characterId: "outsider",
      }),
    );
  });

  it("rejects duplicate or internally inconsistent candidate-domain metadata", () => {
    const fixture = syntheticFixture();
    const input = {
      fixture,
      formulaDraft: syntheticFormulaDraft(fixture),
      formulaReadiness: syntheticReadiness(),
    };
    const duplicate = syntheticEnvironment();
    duplicate.weaponCandidateDomain.candidates.push({
      ...duplicate.weaponCandidateDomain.candidates[0],
    });
    expect(() =>
      buildArtifactGenerationPreflight(input, [], duplicate),
    ).toThrow("repeats candidate four_bow@R5");

    const inconsistent = syntheticEnvironment();
    inconsistent.weaponCandidateDomain.candidates =
      inconsistent.weaponCandidateDomain.candidates.filter(
        ({ weaponId, refinement }) =>
          weaponId !== "five_sword" || refinement !== 5,
      );
    inconsistent.weaponCandidateDomain.candidates.push({
      weaponId: "five_sword",
      weaponType: "Bow",
      rarity: 5,
      refinement: 5,
    });
    expect(() =>
      buildArtifactGenerationPreflight(input, [], inconsistent),
    ).toThrow("inconsistent metadata for five_sword");
  });
});

function resolvedRealMember(characterId: string) {
  return {
    characterId,
    fixtureRefinement: null,
    experimentRefinement: 1,
    refinementOrigin: "experiment-policy",
    exactCandidatePair: true,
    nativeTypeCompatibility: "compatible",
    artifactCoverage: "enumerated-initially",
    ready: true,
  };
}

function syntheticEnvironment(): ArtifactGenerationPreflightEnvironment {
  return {
    weaponCandidateDomain: {
      candidates: [
        candidate("four_bow", "Bow", 4, 5),
        candidate("five_sword", "Sword", 5, 1),
        candidate("five_sword", "Sword", 5, 5),
        candidate("five_catalyst", "Catalyst", 5, 1),
        candidate("five_catalyst", "Catalyst", 5, 5),
        candidate("four_polearm", "Polearm", 4, 5),
      ],
    },
    characterWeaponTypes: {
      a: "Bow",
      b: "Sword",
      c: "Catalyst",
      d: "Polearm",
    },
    initialFourPieceArtifactSetIds: new Set([
      "set_a",
      "set_b",
      "set_c",
      "set_d",
    ]),
  };
}

function candidate(
  weaponId: string,
  weaponType: string,
  rarity: number,
  refinement: 1 | 5,
) {
  return { weaponId, weaponType, rarity, refinement };
}

function syntheticFixture(
  members = [
    syntheticMember("a", "four_bow", null, fourPiece("set_a")),
    syntheticMember("b", "five_sword", null, fourPiece("set_b")),
    syntheticMember("c", "five_catalyst", 5, fourPiece("set_c")),
    syntheticMember("d", "four_polearm", 5, fourPiece("set_d")),
  ],
): SourceBackedEquipmentScenario {
  const team = KnowledgeTeamSchema.parse({
    id: "synthetic:team",
    kind: "team",
    status: "candidate",
    members,
    damagePlans: [],
    sourceRefs: [sourceRef("synthetic:team")],
    unknowns: [],
  });
  return {
    schemaVersion: 1,
    classification: "source-backed-equipment-fixture",
    supportsGuideClaims: false,
    sourceTeamRecordId: team.id,
    team,
    evidence: team.members.map((member, index) => ({
      characterId: member.characterId,
      characterGuideId: `guide:${member.characterId}`,
      guideStatus: "baseline",
      guideSourceRefs: [sourceRef(`guide:${member.characterId}`)],
      weaponId: member.selectedWeapon?.weaponId ?? "missing",
      weaponOrderIndex: index,
      buildSourceRecordId: `build:${member.characterId}`,
      build: {
        visible: true,
        artifact: member.selectedArtifact ?? fourPiece("missing"),
      },
    })),
    cautions: [],
  };
}

function syntheticMember(
  characterId: string,
  weaponId: string | null,
  refinement: number | null,
  artifact: ArtifactChoice | null,
) {
  return {
    characterId,
    investment: { status: "unspecified" as const },
    selectedWeapon:
      weaponId == null
        ? null
        : {
            weaponId,
            ...(refinement == null ? {} : { refinement }),
          },
    selectedArtifact: artifact,
  };
}

function syntheticFormulaDraft(
  fixture: SourceBackedEquipmentScenario,
  refinementOverrides: Record<string, number> = {},
): FormulaPlanDraftOutput {
  return {
    schemaVersion: 1,
    classification: "calculator-default-draft",
    supportsGuideClaims: false,
    sourceTeamRecordId: fixture.sourceTeamRecordId,
    assumptions: {
      combatOptions: "calculator-defaults",
      characters: fixture.team.members.map((member) => {
        const weaponId = member.selectedWeapon?.weaponId ?? "missing";
        const defaultRefinement =
          member.selectedWeapon?.refinement ??
          (weaponId.startsWith("four_") ? 5 : 1);
        return {
          characterId: member.characterId,
          charLevel: 90,
          constellation: 0,
          selectedWeaponId: weaponId,
          refinement:
            refinementOverrides[member.characterId] ?? defaultRefinement,
          selectedArtifact:
            member.selectedArtifact ?? fourPiece("missing"),
          talentLevels: { auto: 10, skill: 10, burst: 10 },
        };
      }),
    },
    cautions: [],
    lines: [],
    zeroCountAvailableFormulas: [],
  };
}

function syntheticReadiness(
  blockers: FormulaPlanReadinessBlocker[] = [],
): FormulaPlanReadinessAssessment {
  const coverage = {
    total: 0,
    mapped: 0,
    unresolved: 0,
    sourceAbsent: 0,
    unclassified: 0,
    rows: [],
  };
  return {
    schemaVersion: 1,
    classification: "formula-plan-readiness-assessment",
    supportsGuideClaims: false,
    sourceTeamRecordId: "synthetic:team",
    reviewStatus: blockers.length === 0 ? "reviewed" : "unreviewed",
    readyForDamageReplay: blockers.length === 0,
    availableFormulaCoverage: { ...coverage, rows: [] },
    positiveDefaultCoverage: { ...coverage, rows: [] },
    sourceMappingSummary: {
      comparisons: 0,
      exactClaims: 0,
      rangeClaims: 0,
      completeTokenMappings: 0,
      partialTokenMappings: 0,
      unresolvedMappings: 0,
      nonNullFormulaUnresolvedMappings: 0,
      nullFormulaUnresolvedMappings: 0,
      sourceAbsentMappings: 0,
    },
    blockers: blockers.map((blocker) => ({ ...blocker })),
  };
}

function fourPiece(setId: string): ArtifactChoice {
  return { type: "4pc", setId };
}

function sourceRef(sourceRecordId: string) {
  return {
    sourceId: "genshintools-presets",
    sourceRecordId,
    locator: { file: "synthetic.json", recordId: sourceRecordId },
  };
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (value == null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
