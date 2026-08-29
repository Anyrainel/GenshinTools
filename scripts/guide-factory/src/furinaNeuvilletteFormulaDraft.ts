import {
  compareSourceTranslatedFormulaPlan,
  draftCalculatorDefaultFormulaPlan,
  type FormulaPlanCountComparison,
  type FormulaPlanDraftOutput,
  type KnowledgeTeam,
  type SourceTranslatedFormulaPlanLine,
} from "./formulaPlanDraft";
import type { KnowledgeRepository } from "./schemas";

export const FURINA_NEUVILLETTE_FORMULA_DRAFT_INPUT_PATHS = [
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/formulaPlanDraft.ts",
  "scripts/guide-factory/src/furinaNeuvilletteFormulaDraft.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
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
  "src/lib/dmgcalc/impl/character5Fontaine.ts",
  "src/lib/dmgcalc/impl/character5Inazuma.ts",
  "src/lib/dmgcalc/impl/character5Natlan.ts",
] as const;

export const FURINA_NEUVILLETTE_BASELINE_TEAM_ID =
  "genshintools-presets:team:JQC4wxT0jJgK50gc0O";
export const FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID =
  "kqm:team:furina-neuvillette-kazuha-xilonen-example";
export const FURINA_NEUVILLETTE_SOURCE_ROTATION_ID =
  "sample-rotation-xilonen";
const FURINA_NEUVILLETTE_SOURCE_ROTATION_NOTATION =
  "Neuvillette E > Furina ED N1 > Xilonen EQ N2 > Kazuha tEPQ > Furina Q > Neuvillette C E C Q > Xilonen E N2 > Kazuha tEP > Neuvillette 2[C]";

type AuthoredActionCount = {
  characterId: string;
  action: string;
  count: number;
  sourceTokens: string[];
};

export interface FurinaNeuvilletteFormulaDraftReport
  extends FormulaPlanDraftOutput {
  fixtureId: "furina-neuvillette-source-rotation-comparison-v2";
  status: "needs-domain-review";
  promotionEligible: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  validationTargets: [
    {
      recordId: typeof FURINA_NEUVILLETTE_BASELINE_TEAM_ID;
      supports: ["roster", "selected-weapons", "selected-artifact-sets"];
    },
    {
      recordId: typeof FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID;
      supports: ["roster", "rotation"];
    },
  ];
  rosterAgreement: {
    exact: true;
    characterIds: string[];
  };
  sourceRotation: {
    recordId: typeof FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID;
    rotationId: typeof FURINA_NEUVILLETTE_SOURCE_ROTATION_ID;
    notation: string;
    unresolvedSegments: string[];
    assumptions: string[];
  };
  authoredTranslation: {
    reviewStatus: "unreviewed";
    actionCounts: AuthoredActionCount[];
    formulaComparisons: FormulaPlanCountComparison[];
    mismatches: FormulaPlanCountComparison[];
    unresolvedMappings: Array<{
      characterId: string;
      sourceToken: string;
      calculatorFormulaId: string | null;
      reason: string;
    }>;
  };
}

const C0_R1_LEVEL_90_10_10_10 = {
  charLevel: 90,
  constellation: 0,
  refinement: 1,
  talentLevels: { auto: 10, skill: 10, burst: 10 },
} as const;

const AUTHORED_ACTION_COUNTS: AuthoredActionCount[] = [
  {
    characterId: "neuvillette",
    action: "skill-cast",
    count: 2,
    sourceTokens: ["E", "E"],
  },
  {
    characterId: "neuvillette",
    action: "charged-attack",
    count: 4,
    sourceTokens: ["C", "C", "2[C]"],
  },
  {
    characterId: "neuvillette",
    action: "burst-cast",
    count: 1,
    sourceTokens: ["Q"],
  },
  {
    characterId: "furina",
    action: "skill-cast",
    count: 1,
    sourceTokens: ["E"],
  },
  {
    characterId: "furina",
    action: "normal-attack",
    count: 1,
    sourceTokens: ["N1"],
  },
  {
    characterId: "furina",
    action: "burst-cast",
    count: 1,
    sourceTokens: ["Q"],
  },
  {
    characterId: "xilonen",
    action: "skill-cast",
    count: 2,
    sourceTokens: ["E", "E"],
  },
  {
    characterId: "xilonen",
    action: "two-normal-sequence",
    count: 2,
    sourceTokens: ["N2", "N2"],
  },
  {
    characterId: "xilonen",
    action: "burst-cast",
    count: 1,
    sourceTokens: ["Q"],
  },
  {
    characterId: "kaedehara_kazuha",
    action: "tap-skill-cast",
    count: 2,
    sourceTokens: ["tE", "tE"],
  },
  {
    characterId: "kaedehara_kazuha",
    action: "plunging-attack",
    count: 2,
    sourceTokens: ["P", "P"],
  },
  {
    characterId: "kaedehara_kazuha",
    action: "burst-cast",
    count: 1,
    sourceTokens: ["Q"],
  },
];

const SOURCE_TRANSLATED_FORMULA_COUNTS: SourceTranslatedFormulaPlanLine[] = [
  {
    characterId: "neuvillette",
    formulaId: "neuvillette-judgment",
    count: 4,
    mappingBasis: "Each source C maps to one full Equitable Judgment formula.",
  },
  {
    characterId: "neuvillette",
    formulaId: "neuvillette-skill",
    count: 2,
    mappingBasis: "Each source E maps to one Skill damage formula.",
  },
  {
    characterId: "neuvillette",
    formulaId: "neuvillette-burst",
    count: 1,
    mappingBasis: "The source contains one Q cast.",
  },
  {
    characterId: "furina",
    formulaId: "furina-skill-bubble",
    count: 1,
    mappingBasis: "The source contains one E cast.",
  },
  {
    characterId: "furina",
    formulaId: "furina-burst",
    count: 1,
    mappingBasis: "The source contains one Q cast.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-e-rush",
    count: 2,
    mappingBasis: "Each of the two source E casts maps to one Rush formula.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-normal-2",
    count: 2,
    mappingBasis: "Each source N2 maps to one calculator two-Normal sequence.",
  },
  {
    characterId: "xilonen",
    formulaId: "xilonen-q-initial",
    count: 1,
    mappingBasis: "The source contains one Q cast.",
  },
  {
    characterId: "kaedehara_kazuha",
    formulaId: "kazuha-skill",
    count: 2,
    mappingBasis: "Each source tE maps to the calculator Tap Skill formula.",
  },
];

export async function buildFurinaNeuvilletteFormulaDraftReport(
  repository: KnowledgeRepository,
  generatedFrom: Array<{ path: string; sha256: string }>,
): Promise<FurinaNeuvilletteFormulaDraftReport> {
  const baseline = requiredTeam(
    repository,
    FURINA_NEUVILLETTE_BASELINE_TEAM_ID,
  );
  const external = requiredTeam(
    repository,
    FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
  );
  const characterIds = rosterKey(baseline);
  const externalCharacterIds = rosterKey(external);
  if (characterIds.join("\0") !== externalCharacterIds.join("\0")) {
    throw new Error(
      "The Furina-Neuvillette external validation target no longer matches the baseline team roster.",
    );
  }

  const sourceRotation = requiredRotation(
    external,
    FURINA_NEUVILLETTE_SOURCE_ROTATION_ID,
  );
  if (
    sourceRotation.notation !== FURINA_NEUVILLETTE_SOURCE_ROTATION_NOTATION
  ) {
    throw new Error(
      "The KQM Furina-Neuvillette source rotation changed; review the authored action and formula translation before regenerating this report.",
    );
  }

  const assumptions = Object.fromEntries(
    baseline.members.map(({ characterId }) => [
      characterId,
      {
        ...C0_R1_LEVEL_90_10_10_10,
        talentLevels: { ...C0_R1_LEVEL_90_10_10_10.talentLevels },
      },
    ]),
  );
  const draft = await draftCalculatorDefaultFormulaPlan({
    team: baseline,
    assumptions,
  });
  const { formulaComparisons, mismatches } =
    compareSourceTranslatedFormulaPlan(
      draft,
      SOURCE_TRANSLATED_FORMULA_COUNTS,
    );

  return {
    ...draft,
    cautions: [
      ...draft.cautions,
      "The source action-to-formula translation is agent-authored and unreviewed; matching the written tokens does not prove the calculator formula semantics or buff timing are equivalent.",
      "The source rotation does not specify duration, Salon Member hit counts, Swirl occurrences, or reaction ownership, so those values remain unresolved.",
    ],
    fixtureId: "furina-neuvillette-source-rotation-comparison-v2",
    status: "needs-domain-review",
    promotionEligible: false,
    generatedFrom: generatedFrom
      .map((file) => ({ ...file }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    validationTargets: [
      {
        recordId: FURINA_NEUVILLETTE_BASELINE_TEAM_ID,
        supports: ["roster", "selected-weapons", "selected-artifact-sets"],
      },
      {
        recordId: FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
        supports: ["roster", "rotation"],
      },
    ],
    rosterAgreement: { exact: true, characterIds },
    sourceRotation: {
      recordId: FURINA_NEUVILLETTE_EXTERNAL_TEAM_ID,
      rotationId: FURINA_NEUVILLETTE_SOURCE_ROTATION_ID,
      notation: sourceRotation.notation,
      unresolvedSegments: [...sourceRotation.unresolvedSegments],
      assumptions: [...sourceRotation.assumptions],
    },
    authoredTranslation: {
      reviewStatus: "unreviewed",
      actionCounts: AUTHORED_ACTION_COUNTS.map((action) => ({
        ...action,
        sourceTokens: [...action.sourceTokens],
      })),
      formulaComparisons,
      mismatches,
      unresolvedMappings: [
        {
          characterId: "furina",
          sourceToken: "N1",
          calculatorFormulaId: null,
          reason:
            "The source uses one C0 Normal Attack, but this calculator implementation exposes no C0 Furina Normal Attack formula.",
        },
        {
          characterId: "furina",
          sourceToken: "E (Salon Members after cast)",
          calculatorFormulaId: "furina-salon-total",
          reason:
            "The calculator formula bakes in 32 Salon Member hits, while the source gives no rotation duration or hit count proving that the full aggregate fits this rotation.",
        },
        {
          characterId: "neuvillette",
          sourceToken: "E (Spiritbreath Thorn proc)",
          calculatorFormulaId: "neuvillette-spiritbreath",
          reason:
            "Two source Skill casts do not establish two Spiritbreath procs because the source supplies no rotation duration or proc timing.",
        },
        {
          characterId: "kaedehara_kazuha",
          sourceToken: "2[P]",
          calculatorFormulaId: "kazuha-plunge-hydro",
          reason:
            "The source establishes two plunges but does not establish the calculator's Hydro-absorbed formula variant or absorption timing.",
        },
        {
          characterId: "kaedehara_kazuha",
          sourceToken: "Q",
          calculatorFormulaId: "kazuha-burst-hydro",
          reason:
            "The source establishes one Burst but does not establish the calculator's Hydro-absorbed formula variant or absorption timing.",
        },
        {
          characterId: "kaedehara_kazuha",
          sourceToken: "Swirl occurrences",
          calculatorFormulaId: "rx-swirl-Hydro-kaedehara_kazuha",
          reason:
            "The source action notation does not enumerate reaction ownership or Swirl occurrence counts.",
        },
      ],
    },
  };
}

function requiredTeam(
  repository: KnowledgeRepository,
  recordId: string,
): KnowledgeTeam {
  const record = repository.records.find(({ id }) => id === recordId);
  if (!record || record.kind !== "team") {
    throw new Error(`Missing exact team knowledge record ${recordId}.`);
  }
  return record;
}

function requiredRotation(
  team: KnowledgeTeam,
  rotationId: string,
): NonNullable<KnowledgeTeam["rotations"]>[number] {
  const rotation = team.rotations?.find(({ id }) => id === rotationId);
  if (!rotation) {
    throw new Error(
      `Missing rotation ${rotationId} on exact team knowledge record ${team.id}.`,
    );
  }
  return rotation;
}

function rosterKey(team: KnowledgeTeam): string[] {
  return team.members
    .map(({ characterId }) => characterId)
    .sort((left, right) => left.localeCompare(right));
}
