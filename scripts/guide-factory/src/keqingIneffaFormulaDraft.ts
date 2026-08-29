import {
  compareSourceFormulaCountClaims,
  draftCalculatorDefaultFormulaPlan,
  type FormulaCountClaimComparison,
  type FormulaPlanDraftOutput,
  type KnowledgeTeam,
  type SourceFormulaCountClaim,
  type SourceFormulaCountClaimLine,
} from "./formulaPlanDraft";
import {
  materializeSourceBackedEquipmentScenario,
  type SourceBackedEquipmentScenario,
  type SourceBackedEquipmentSelection,
} from "./sourceBackedEquipmentScenario";
import {
  assessFormulaPlanReadiness,
  type FormulaPlanReadinessAssessment,
  type SourceAbsentFormulaMapping,
  type UnresolvedFormulaMapping,
} from "./formulaPlanReadiness";
import type { KnowledgeRepository } from "./schemas";

export const KEQING_INEFFA_FORMULA_DRAFT_INPUT_PATHS = [
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/formulaPlanDraft.ts",
  "scripts/guide-factory/src/formulaPlanReadiness.ts",
  "scripts/guide-factory/src/sourceBackedEquipmentScenario.ts",
  "scripts/guide-factory/src/keqingIneffaFormulaDraft.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/charInfo.ts",
  "src/data/gameStatsLoader.ts",
  "src/lib/dmgcalc/index.ts",
  "src/lib/dmgcalc/constants.ts",
  "src/lib/dmgcalc/core/charBuild.ts",
  "src/lib/dmgcalc/core/combo.ts",
  "src/lib/dmgcalc/core/implModel.ts",
  "src/lib/dmgcalc/core/registry.ts",
  "src/lib/dmgcalc/core/teamBuild.ts",
  "src/lib/dmgcalc/core/teamFormulaCatalog.ts",
  "src/lib/dmgcalc/core/teamMeta.ts",
  "src/lib/dmgcalc/core/teamReaction.ts",
  "src/lib/dmgcalc/impl/artifact4pc.ts",
  "src/lib/dmgcalc/impl/character5Fontaine.ts",
  "src/lib/dmgcalc/impl/character5Liyue.ts",
  "src/lib/dmgcalc/impl/character5Natlan.ts",
  "src/lib/dmgcalc/impl/character5NodKrai.ts",
  "src/lib/dmgcalc/impl/weapon5Polearm.ts",
  "src/lib/dmgcalc/impl/weapon5Sword.ts",
] as const;

export const KEQING_INEFFA_EXTERNAL_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example";
export const KEQING_INEFFA_SOURCE_ROTATION_ID = "sample-rotation";
const KEQING_INEFFA_SOURCE_ROTATION_NOTATION =
  "(Furina ED) > Ineffa E > Xilonen EQ N2 > Furina Q > Keqing EQE 5[N1C] > Xilonen E N2 > Ineffa Q > Keqing EE 3[N1C]";
const KEQING_INEFFA_SOURCE_ROTATION_ASSUMPTIONS = [
  "On subsequent rotations, the opening Furina Skill can be moved from the opening position to be performed together with her Burst.",
] as const;

type AuthoredActionCount = {
  characterId: string;
  action: string;
  countClaim: SourceFormulaCountClaim;
  sourceTokens: string[];
};

type EquipmentFixtureEvidence = Omit<
  SourceBackedEquipmentScenario,
  "team"
>;

export interface KeqingIneffaFormulaDraftReport
  extends FormulaPlanDraftOutput {
  fixtureId: "keqing-ineffa-source-rotation-comparison-v1";
  status: "needs-domain-review";
  promotionEligible: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  validationTargets: Array<{
    recordId: string;
    supports: Array<
      "roster" | "rotation" | "weapon-presence" | "artifact-build"
    >;
  }>;
  equipmentFixture: EquipmentFixtureEvidence;
  damageReplayReadiness: FormulaPlanReadinessAssessment;
  sourceRotation: {
    recordId: typeof KEQING_INEFFA_EXTERNAL_TEAM_ID;
    rotationId: typeof KEQING_INEFFA_SOURCE_ROTATION_ID;
    notation: string;
    unresolvedSegments: string[];
    assumptions: string[];
  };
  authoredTranslation: {
    reviewStatus: "unreviewed";
    actionCounts: AuthoredActionCount[];
    formulaComparisons: FormulaCountClaimComparison[];
    discrepancies: FormulaCountClaimComparison[];
    unresolvedMappings: UnresolvedFormulaMapping[];
    sourceAbsentMappings: SourceAbsentFormulaMapping[];
  };
}

const C0_R1_LEVEL_90_10_10_10 = {
  charLevel: 90,
  constellation: 0,
  refinement: 1,
  talentLevels: { auto: 10, skill: 10, burst: 10 },
} as const;

const EQUIPMENT_SELECTIONS: SourceBackedEquipmentSelection[] = [
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

const AUTHORED_ACTION_COUNTS: AuthoredActionCount[] = [
  {
    characterId: "keqing",
    action: "stiletto-cast",
    countClaim: { type: "exact", value: 2 },
    sourceTokens: ["EQE:first E", "EE:first E"],
  },
  {
    characterId: "keqing",
    action: "skill-slash-recast",
    countClaim: { type: "exact", value: 2 },
    sourceTokens: ["EQE:second E", "EE:second E"],
  },
  {
    characterId: "keqing",
    action: "burst-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["EQE:Q"],
  },
  {
    characterId: "keqing",
    action: "normal-plus-charged-sequence",
    countClaim: { type: "exact", value: 8 },
    sourceTokens: ["5[N1C]", "3[N1C]"],
  },
  {
    characterId: "ineffa",
    action: "skill-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["E"],
  },
  {
    characterId: "ineffa",
    action: "burst-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["Q"],
  },
  {
    characterId: "furina",
    action: "skill-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["(ED), relocated beside Q on subsequent rotations"],
  },
  {
    characterId: "furina",
    action: "burst-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["Q"],
  },
  {
    characterId: "xilonen",
    action: "skill-cast",
    countClaim: { type: "exact", value: 2 },
    sourceTokens: ["E", "E"],
  },
  {
    characterId: "xilonen",
    action: "two-normal-sequence",
    countClaim: { type: "exact", value: 2 },
    sourceTokens: ["N2", "N2"],
  },
  {
    characterId: "xilonen",
    action: "burst-cast",
    countClaim: { type: "exact", value: 1 },
    sourceTokens: ["Q"],
  },
];

const SOURCE_FORMULA_COUNT_CLAIMS: SourceFormulaCountClaimLine[] = [
  {
    characterId: "keqing",
    formulaId: "keqing-stiletto",
    countClaim: { type: "exact", value: 2 },
    sourceTokenCoverage: "complete",
    mappingBasis:
      "The leading E in each of EQE and EE maps to one Stiletto cast.",
  },
  {
    characterId: "keqing",
    formulaId: "keqing-skill-slash",
    countClaim: { type: "exact", value: 2 },
    sourceTokenCoverage: "complete",
    mappingBasis:
      "The second E in each of EQE and EE maps to one Skill slash recast.",
  },
  {
    characterId: "keqing",
    formulaId: "keqing-burst",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis: "The source contains one Keqing Q cast.",
  },
  {
    characterId: "keqing",
    formulaId: "keqing-charged",
    countClaim: { type: "exact", value: 8 },
    sourceTokenCoverage: "partial",
    mappingBasis:
      "The C portion of 5[N1C] plus 3[N1C] maps to eight Charged Attack formulas; the eight N1 hits remain unsupported.",
  },
  {
    characterId: "ineffa",
    formulaId: "ineffa-skill-initial",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis: "The source contains one Ineffa E cast.",
  },
  {
    characterId: "ineffa",
    formulaId: "ineffa-burst",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis: "The source contains one Ineffa Q cast.",
  },
  {
    characterId: "furina",
    formulaId: "furina-skill-bubble",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis:
      "The source footnote moves the parenthesized Furina ED beside her Burst on subsequent rotations, so both stated orderings contain one Skill cast.",
  },
  {
    characterId: "furina",
    formulaId: "furina-burst",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis: "The source contains one Furina Q cast.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-e-rush",
    countClaim: { type: "exact", value: 2 },
    sourceTokenCoverage: "complete",
    mappingBasis: "Each of the two source E casts maps to one Rush formula.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-normal-2",
    countClaim: { type: "exact", value: 2 },
    sourceTokenCoverage: "complete",
    mappingBasis:
      "Each source N2 maps to one calculator two-Normal sequence.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-q-initial",
    countClaim: { type: "exact", value: 1 },
    sourceTokenCoverage: "complete",
    mappingBasis: "The source contains one Xilonen Q cast.",
  },
];

const UNRESOLVED_MAPPINGS: UnresolvedFormulaMapping[] = [
  {
    characterId: "keqing",
    sourceToken: "8[N1] within 5[N1C] + 3[N1C]",
    calculatorFormulaId: null,
    reason:
      "The calculator exposes no C0 Keqing Normal Attack formula, so the Charged Attack mapping covers only part of each N1C token.",
  },
  {
    characterId: "ineffa",
    sourceToken: "E (Birgitta discharges after cast)",
    calculatorFormulaId: "ineffa-birgitta",
    reason:
      "The calculator formula bakes in ten Birgitta discharges and ten additional Lunar-Direct parts with Hydro, while the source gives no duration or hit count proving that the aggregate fits.",
  },
  {
    characterId: "furina",
    sourceToken: "ED (Salon Members after cast)",
    calculatorFormulaId: "furina-salon-total",
    reason:
      "The calculator formula bakes in 32 Salon Member hits, while the source gives no duration or hit count proving that the aggregate fits.",
  },
  {
    characterId: "ineffa",
    sourceToken: "Lunar-Charged occurrences and ownership",
    calculatorFormulaId: "rx-lunarCharged-ineffa",
    reason:
      "The calculator assigns nine default Lunar-Charged triggers to Ineffa through an internal ownership heuristic; the source notation does not establish trigger count or ownership.",
  },
  {
    characterId: "keqing",
    sourceToken: "Lunar-Charged occurrences and ownership",
    calculatorFormulaId: "rx-lunarCharged-keqing",
    reason:
      "The calculator exposes a zero-count Keqing Lunar-Charged formula, but the source does not establish that Keqing owns zero triggers.",
  },
  {
    characterId: "furina",
    sourceToken: "Lunar-Charged occurrences and ownership",
    calculatorFormulaId: "rx-lunarCharged-furina",
    reason:
      "The calculator exposes a zero-count Furina Lunar-Charged formula, but the source does not establish that Furina owns zero triggers.",
  },
];

const SOURCE_ABSENT_MAPPINGS: SourceAbsentFormulaMapping[] = [
  {
    characterId: "keqing",
    formulaId: "keqing-skill-thunderclap",
    reason:
      "The authored translation maps both EQE and EE tokens to Stiletto and Skill Slash formulas and assigns no source token to the alternative Thunderclap formula.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-normal",
    reason:
      "Both source N2 tokens map to the calculator's two-Normal aggregate, while the source has no N4 sequence to assign to the four-Normal aggregate.",
  },
];

export async function buildKeqingIneffaFormulaDraftReport(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }>
): Promise<KeqingIneffaFormulaDraftReport> {
  const scenario = materializeSourceBackedEquipmentScenario(
    repository,
    KEQING_INEFFA_EXTERNAL_TEAM_ID,
    EQUIPMENT_SELECTIONS
  );
  const sourceRotation = requiredRotation(
    scenario.team,
    KEQING_INEFFA_SOURCE_ROTATION_ID
  );
  if (
    sourceRotation.notation !== KEQING_INEFFA_SOURCE_ROTATION_NOTATION ||
    sourceRotation.assumptions.length !==
      KEQING_INEFFA_SOURCE_ROTATION_ASSUMPTIONS.length ||
    sourceRotation.assumptions.some(
      (assumption, index) =>
        assumption !== KEQING_INEFFA_SOURCE_ROTATION_ASSUMPTIONS[index]
    ) ||
    sourceRotation.unresolvedSegments.length !== 0
  ) {
    throw new Error(
      "The KQM Keqing-Ineffa source rotation evidence changed; review the authored action and formula translation before regenerating this report."
    );
  }

  const assumptions = Object.fromEntries(
    scenario.team.members.map(({ characterId }) => [
      characterId,
      {
        ...C0_R1_LEVEL_90_10_10_10,
        talentLevels: { ...C0_R1_LEVEL_90_10_10_10.talentLevels },
      },
    ])
  );
  for (const evidence of scenario.evidence) {
    const assumption = assumptions[evidence.characterId];
    if (!assumption) {
      throw new Error(
        `Missing formula assumptions for equipment fixture member ${evidence.characterId}.`
      );
    }
    if (
      evidence.build.minConstellation != null &&
      evidence.build.minConstellation > assumption.constellation
    ) {
      throw new Error(
        `Equipment fixture build ${evidence.buildSourceRecordId} requires constellation ${evidence.build.minConstellation}, above the formula assumption for ${evidence.characterId}.`
      );
    }
  }

  const draft = await draftCalculatorDefaultFormulaPlan({
    team: scenario.team,
    assumptions,
  });
  const { formulaComparisons, discrepancies } =
    compareSourceFormulaCountClaims(draft, SOURCE_FORMULA_COUNT_CLAIMS);
  const damageReplayReadiness = assessFormulaPlanReadiness(
    draft,
    formulaComparisons,
    UNRESOLVED_MAPPINGS,
    SOURCE_ABSENT_MAPPINGS,
    "unreviewed",
  );
  const { team: _materializedTeam, ...equipmentFixture } = scenario;

  return {
    ...draft,
    cautions: [
      ...draft.cautions,
      ...scenario.cautions,
      "The source action-to-formula translation is agent-authored and unreviewed; direct token correspondence does not prove equivalent damage semantics or buff timing.",
      "The source omits duration, off-field hit counts, and Lunar-Charged trigger ownership, so aggregate and reaction defaults remain unresolved.",
      "Furina's parenthesized Skill changes position rather than count: the source footnote relocates it beside her Burst on subsequent rotations, leaving action order unresolved.",
    ],
    fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
    status: "needs-domain-review",
    promotionEligible: false,
    generatedFrom: generatedFrom
      .map((file) => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    validationTargets: [
      {
        recordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
        supports: ["roster", "rotation"],
      },
      ...scenario.evidence.map((evidence) => ({
        recordId: evidence.characterGuideId,
        supports: ["weapon-presence", "artifact-build"] as Array<
          "weapon-presence" | "artifact-build"
        >,
      })),
    ],
    equipmentFixture,
    damageReplayReadiness,
    sourceRotation: {
      recordId: KEQING_INEFFA_EXTERNAL_TEAM_ID,
      rotationId: KEQING_INEFFA_SOURCE_ROTATION_ID,
      notation: sourceRotation.notation,
      unresolvedSegments: [...sourceRotation.unresolvedSegments],
      assumptions: [...sourceRotation.assumptions],
    },
    authoredTranslation: {
      reviewStatus: "unreviewed",
      actionCounts: AUTHORED_ACTION_COUNTS.map((action) => ({
        ...action,
        countClaim: { ...action.countClaim },
        sourceTokens: [...action.sourceTokens],
      })),
      formulaComparisons,
      discrepancies,
      unresolvedMappings: UNRESOLVED_MAPPINGS.map((mapping) => ({
        ...mapping,
      })),
      sourceAbsentMappings: SOURCE_ABSENT_MAPPINGS.map((mapping) => ({
        ...mapping,
      })),
    },
  };
}

function requiredRotation(
  team: KnowledgeTeam,
  rotationId: string
): NonNullable<KnowledgeTeam["rotations"]>[number] {
  const rotation = team.rotations?.find(({ id }) => id === rotationId);
  if (!rotation) {
    throw new Error(
      `Missing rotation ${rotationId} on exact team knowledge record ${team.id}.`
    );
  }
  return rotation;
}
