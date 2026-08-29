import { sha256Text, stableJson } from "./io";
import type { KeqingIneffaFormulaDraftReport } from "./keqingIneffaFormulaDraft";
import type {
  KeqingLunarCandidateEquipmentGroup,
  KeqingLunarCandidateStatClaim,
  KeqingLunarSourceConditionedCandidateLatticeReport,
} from "./keqingLunarSourceConditionedCandidateLattice";

type ConditionResolution = NonNullable<
  KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
>["teams"][number]["statClaimCells"][number]["conditionResolution"];

type FormulaAssumption =
  KeqingIneffaFormulaDraftReport["assumptions"]["characters"][number];

type FormulaEquipmentEvidence =
  KeqingIneffaFormulaDraftReport["equipmentFixture"]["evidence"][number];

export type KeqingLunarCompositionContractIssue = {
  code: string;
  path: string;
  message: string;
};

export type KeqingLunarCompositionStatEvidence = {
  claimId: string;
  sourceRecordId: string;
  sourceClaim: KeqingLunarCandidateStatClaim["sourceClaim"];
  sourceConditions: string[];
  conditionResolution: ConditionResolution;
  conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
};

export type KeqingLunarCrossRecordComposition = {
  compositionId:
    | "guide-factory:keqing-lunar:marechaussee-hunter"
    | "guide-factory:keqing-lunar:night-of-the-skys-unveiling-one-nod-krai";
  authoredBy: "guide-factory";
  sourceAuthored: false;
  sourceAuthoredBuild: false;
  joinKind: "cross-record-evidence-composition";
  crossRecordOrdering: "none";
  teamRecordId: typeof TARGET_TEAM_ID;
  characterId: "keqing";
  weapon: {
    groupId: typeof GENERAL_MISTSPLITTER_GROUP_ID;
    claimId: typeof GENERAL_MISTSPLITTER_CLAIM_ID;
    weaponId: "mistsplitter_reforged";
    conditionResolution: "matched-by-exact-team-facts";
    conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
    sourceRefinement: null;
    experimentPolicyReference: "originLedger.r1ExperimentPolicy";
  };
  artifact: {
    groupId: string;
    claimId: string;
    artifact:
      | { type: "4pc"; setId: "marechaussee_hunter" }
      | { type: "4pc"; setId: "night_of_the_skys_unveiling" };
    sourceClassification: "default" | "alternative";
    conditionResolution: "matched-by-exact-team-facts";
    conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
    searchRepresentability: "initially-representable";
  };
  statProfile: {
    profileSourceRecordId: typeof DEFAULT_STAT_SOURCE_RECORD_ID;
    crossRecordJoinAuthoredByGuideFactory: true;
    matchedClaims: KeqingLunarCompositionStatEvidence[];
    withheldClaims: Array<
      KeqingLunarCompositionStatEvidence & {
        withholdingReason: "unresolved-no-overcap-condition";
      }
    >;
    matchedClaimCount: 7;
    withheldClaimCount: 1;
  };
  formulaFixtureReference: {
    fixtureId: "keqing-ineffa-source-rotation-comparison-v1";
    teamRecordId: typeof TARGET_TEAM_ID;
    reviewStatus: "unreviewed";
    sourceBindingEstablished: false;
    technicalExecutionAuthorized: false;
  };
  teammateEquipmentReference: "originLedger.teammateEquipment";
};

export type KeqingLunarCrossRecordCompositionContractReport = {
  schemaVersion: 1;
  classification: "keqing-lunar-cross-record-composition-contract";
  contractStatus: "comparable" | "not-comparable";
  supportsGuideClaims: false;
  supportsSourceAuthoredBuildClaims: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRelativeArtifactClaims: false;
  supportsTechnicalComparison: false;
  supportsEnergyRecoveryClaims: false;
  sourceAuthoredCompositionCount: 0;
  guideFactoryAuthoredCompositionCount: 0 | 2;
  crossRecordOrdering: "none";
  generatorExecuted: false;
  damageComputationExecuted: false;
  technicalComparisonExecuted: false;
  energyRecoveryInputsUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  inputBoundary: {
    candidateLatticeSha256: string;
    candidateLatticeClassification: string;
    candidateLatticeStatus: string;
    formulaDraftSha256: string;
    formulaFixtureId: string;
    formulaSourceTeamRecordId: string;
    targetTeamRecordId: typeof TARGET_TEAM_ID;
  };
  targetBoundary:
    | null
    | {
        teamRecordId: typeof TARGET_TEAM_ID;
        characterIds: ["keqing", "ineffa", "furina", "xilonen"];
        sourceRosterAndDeclaredReactionFactsOnly: true;
        exactTeamConditionFactsOnly: true;
        conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
      };
  compositions: KeqingLunarCrossRecordComposition[];
  excludedSourceBranches: Array<{
    groupId: typeof TWO_NOD_NOTSU_GROUP_ID;
    claimId: typeof TWO_NOD_NOTSU_CLAIM_ID;
    artifact: { type: "4pc"; setId: "night_of_the_skys_unveiling" };
    conditionResolution: "not-matched-by-exact-team-facts";
    conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
    includedInCompositions: false;
    reason: "two-nod-krai-condition-does-not-match-exact-team";
  }>;
  originLedger: null | {
    sourceRoster: {
      origin: "kqm-exact-team-record";
      sourceAuthored: true;
      teamRecordId: typeof TARGET_TEAM_ID;
      characterIds: ["keqing", "ineffa", "furina", "xilonen"];
      supportsEquipmentBinding: false;
    };
    sourceClaims: {
      origin: "kqm-character-guide-claim-records";
      sourceAuthored: true;
      sharedWeaponClaimId: typeof GENERAL_MISTSPLITTER_CLAIM_ID;
      artifactClaimIds: [
        typeof MARECHAUSSEE_HUNTER_CLAIM_ID,
        typeof ONE_NOD_NOTSU_CLAIM_ID,
      ];
      matchedDefaultStatClaimIds: string[];
      withheldDefaultStatClaimIds: [typeof CR_CIRCLET_CLAIM_ID];
      excludedArtifactClaimIds: [typeof TWO_NOD_NOTSU_CLAIM_ID];
      sourceAuthoredCrossRecordJoin: false;
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper";
    };
    fixtureAssumptions: {
      origin: "guide-factory-formula-fixture-assumptions";
      sourceAuthored: false;
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1";
      assumptions: FormulaAssumption[];
      appliedByThisContract: false;
    };
    r1ExperimentPolicy: {
      origin: "guide-factory-experiment-policy";
      sourceAuthored: false;
      characterId: "keqing";
      weaponId: "mistsplitter_reforged";
      sourceRefinement: null;
      experimentRefinement: 1;
      experimentRefinementIsSourceFact: false;
      appliedByThisContract: false;
    };
    teammateEquipment: {
      origin: "genshintools-baseline-equipment-fixture";
      sourceAuthoredForExactKqmTeam: false;
      exactTeamSourceBindsEquipment: false;
      members: Array<{
        characterId: "ineffa" | "furina" | "xilonen";
        characterGuideId: string;
        guideStatus: "baseline" | "accepted";
        guideSourceRefs: FormulaEquipmentEvidence["guideSourceRefs"];
        weaponId: string;
        buildSourceRecordId: string;
        artifact: FormulaEquipmentEvidence["build"]["artifact"];
      }>;
      appliedByThisContract: false;
    };
    unreviewedFormulaLines: {
      origin: "guide-factory-authored-source-translation";
      sourceAuthored: false;
      reviewStatus: "unreviewed";
      sourceBindingEstablished: false;
      lines: Array<{
        characterId: string;
        formulaId: string;
        count: number;
        sourceTokenCoverage: "complete" | "partial";
        relation: string;
      }>;
      appliedByThisContract: false;
    };
    calcContext: {
      origin: "guide-factory-experiment-policy";
      sourceAuthored: false;
      value: typeof TECHNICAL_CALC_CONTEXT;
      appliedByThisContract: false;
    };
    energyRecovery: {
      origin: "absent-by-contract";
      inputsUsed: false;
      thresholdsUsed: false;
      targetsUsed: false;
      sequenceInputUsed: false;
    };
  };
  issues: KeqingLunarCompositionContractIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
};

export type KeqingLunarCrossRecordCompositionContractAuthentication =
  | {
      authenticated: true;
      canonicalReport: KeqingLunarCrossRecordCompositionContractReport;
    }
  | {
      authenticated: false;
      reason:
        | "canonical-inputs-not-comparable"
        | "serialized-contract-mismatch";
      issues: KeqingLunarCompositionContractIssue[];
    };

export const KEQING_LUNAR_CROSS_RECORD_COMPOSITION_CONTRACT_INPUT_PATHS = [
  "scripts/guide-factory/src/keqingLunarCrossRecordCompositionContract.ts",
  "scripts/guide-factory/reports/keqing-lunar-source-conditioned-candidate-lattice.json",
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
] as const;

const TARGET_TEAM_ID =
  "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example" as const;
const TARGET_CHARACTER_IDS = ["keqing", "ineffa", "furina", "xilonen"] as const;

const GENERAL_MISTSPLITTER_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i:weapon:0" as const;
const GENERAL_MISTSPLITTER_CLAIM_ID =
  `${GENERAL_MISTSPLITTER_GROUP_ID}:0` as const;

const MARECHAUSSEE_HUNTER_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-furina-marechaussee-hunter-luna-i:artifact:0" as const;
const MARECHAUSSEE_HUNTER_CLAIM_ID =
  `${MARECHAUSSEE_HUNTER_GROUP_ID}:0` as const;

const ONE_NOD_NOTSU_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:0" as const;
const ONE_NOD_NOTSU_CLAIM_ID = `${ONE_NOD_NOTSU_GROUP_ID}:0` as const;

const TWO_NOD_NOTSU_GROUP_ID =
  "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:artifact:1" as const;
const TWO_NOD_NOTSU_CLAIM_ID = `${TWO_NOD_NOTSU_GROUP_ID}:0` as const;

const LUNAR_CHARGED_CONDITION =
  "Keqing is used in a Lunar-Charged team." as const;
const FURINA_CONDITION = "The team contains Furina." as const;
const EXACTLY_ONE_NOD_KRAI_CONDITION =
  "The team contains exactly one Nod-Krai character." as const;
const TWO_NOD_KRAI_CONDITION =
  "The team contains Ineffa and Aino as its two Nod-Krai characters." as const;
const NO_CRIT_OVERCAP_CONDITION =
  "Keqing does not overcap CRIT Rate after A4 and artifact-set bonuses." as const;

const EXPECTED_REQUIRED_EQUIPMENT_GROUPS = [
  {
    groupId: GENERAL_MISTSPLITTER_GROUP_ID,
    repositoryRecordId:
      "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i",
    sourceRecordId: "keqing-lunar-charged-general-mistsplitter-luna-i",
    recommendationId: "lunar-charged-general-mistsplitter",
    recommendationScope: "weapons",
    roles: ["dps"],
    kind: "weapon",
    recommendationOrdering: "unranked",
    groupIndex: 0,
    grouping: "single",
    classification: "default",
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    members: [
      {
        claimId: GENERAL_MISTSPLITTER_CLAIM_ID,
        sourceClaim: {
          kind: "weapon",
          weaponId: "mistsplitter_reforged",
          weaponIndex: 0,
          groupIndex: 0,
          grouping: "single",
          classification: "default",
          recommendationOrdering: "unranked",
        },
        sourceRefinement: null,
        searchCoverage: {
          kind: "weapon-search-coverage",
          observationId:
            "kqm:character-guide:keqing-lunar-charged-general-mistsplitter-luna-i:recommendation:lunar-charged-general-mistsplitter:weapon-group:0:0",
          weaponIdDomainOutcome: "in-released-candidate-domain",
          nativeTypeCompatibilityOutcome: "compatible",
          refinementCoverageOutcome: "unspecified",
          candidateRefinements: [1, 5],
        },
        representability: "initially-representable",
      },
    ],
  },
  {
    groupId: MARECHAUSSEE_HUNTER_GROUP_ID,
    repositoryRecordId:
      "kqm:character-guide:keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
    sourceRecordId:
      "keqing-lunar-charged-furina-marechaussee-hunter-luna-i",
    recommendationId: "lunar-charged-furina-marechaussee-hunter",
    recommendationScope: "artifact-sets",
    roles: ["dps"],
    kind: "artifact",
    recommendationOrdering: "unranked",
    groupIndex: 0,
    grouping: "single",
    classification: "default",
    sourceConditions: [
      LUNAR_CHARGED_CONDITION,
      FURINA_CONDITION,
      EXACTLY_ONE_NOD_KRAI_CONDITION,
    ],
    members: [
      {
        claimId: MARECHAUSSEE_HUNTER_CLAIM_ID,
        sourceClaim: {
          kind: "artifact",
          artifact: { type: "4pc", setId: "marechaussee_hunter" },
          artifactIndex: 0,
          groupIndex: 0,
          grouping: "single",
          classification: "default",
          recommendationOrdering: "unranked",
        },
        sourceRefinement: null,
        searchCoverage: {
          kind: "artifact-search-coverage",
          observationId:
            "kqm:character-guide:keqing-lunar-charged-furina-marechaussee-hunter-luna-i:recommendation:lunar-charged-furina-marechaussee-hunter:0:0",
          outcome: "enumerated-initially",
          failureReason: null,
        },
        representability: "initially-representable",
      },
    ],
  },
  {
    groupId: ONE_NOD_NOTSU_GROUP_ID,
    repositoryRecordId:
      "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i",
    sourceRecordId: "keqing-lunar-charged-notsu-contexts-luna-i",
    recommendationId: "lunar-charged-notsu-contexts",
    recommendationScope: "artifact-sets",
    roles: ["dps"],
    kind: "artifact",
    recommendationOrdering: "unranked",
    groupIndex: 0,
    grouping: "single",
    classification: "alternative",
    sourceConditions: [
      LUNAR_CHARGED_CONDITION,
      EXACTLY_ONE_NOD_KRAI_CONDITION,
    ],
    members: [
      {
        claimId: ONE_NOD_NOTSU_CLAIM_ID,
        sourceClaim: {
          kind: "artifact",
          artifact: {
            type: "4pc",
            setId: "night_of_the_skys_unveiling",
          },
          artifactIndex: 0,
          groupIndex: 0,
          grouping: "single",
          classification: "alternative",
          recommendationOrdering: "unranked",
        },
        sourceRefinement: null,
        searchCoverage: {
          kind: "artifact-search-coverage",
          observationId:
            "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:recommendation:lunar-charged-notsu-contexts:0:0",
          outcome: "enumerated-initially",
          failureReason: null,
        },
        representability: "initially-representable",
      },
    ],
  },
  {
    groupId: TWO_NOD_NOTSU_GROUP_ID,
    repositoryRecordId:
      "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i",
    sourceRecordId: "keqing-lunar-charged-notsu-contexts-luna-i",
    recommendationId: "lunar-charged-notsu-contexts",
    recommendationScope: "artifact-sets",
    roles: ["dps"],
    kind: "artifact",
    recommendationOrdering: "unranked",
    groupIndex: 1,
    grouping: "single",
    classification: "default",
    sourceConditions: [LUNAR_CHARGED_CONDITION, TWO_NOD_KRAI_CONDITION],
    members: [
      {
        claimId: TWO_NOD_NOTSU_CLAIM_ID,
        sourceClaim: {
          kind: "artifact",
          artifact: {
            type: "4pc",
            setId: "night_of_the_skys_unveiling",
          },
          artifactIndex: 0,
          groupIndex: 1,
          grouping: "single",
          classification: "default",
          recommendationOrdering: "unranked",
        },
        sourceRefinement: null,
        searchCoverage: {
          kind: "artifact-search-coverage",
          observationId:
            "kqm:character-guide:keqing-lunar-charged-notsu-contexts-luna-i:recommendation:lunar-charged-notsu-contexts:1:0",
          outcome: "enumerated-initially",
          failureReason: null,
        },
        representability: "initially-representable",
      },
    ],
  },
] as const;

const DEFAULT_STAT_SOURCE_RECORD_ID =
  "keqing-lunar-charged-default-artifact-stats-luna-i" as const;
const DEFAULT_STAT_RECORD_PREFIX =
  `kqm:character-guide:${DEFAULT_STAT_SOURCE_RECORD_ID}` as const;
const CR_CIRCLET_CLAIM_ID =
  `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:circlet:1` as const;

const EXPECTED_MATCHED_DEFAULT_STAT_CLAIM_IDS = [
  `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:circlet:0`,
  `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:goblet:0`,
  `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:goblet:1`,
  `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:sands:0`,
  `${DEFAULT_STAT_RECORD_PREFIX}:substat:0`,
  `${DEFAULT_STAT_RECORD_PREFIX}:substat:1`,
  `${DEFAULT_STAT_RECORD_PREFIX}:substat:2`,
] as const;

const EXPECTED_DEFAULT_STAT_PROVENANCE = {
  repositoryRecordId: DEFAULT_STAT_RECORD_PREFIX,
  sourceRecordId: DEFAULT_STAT_SOURCE_RECORD_ID,
  recommendationId: "lunar-charged-default-artifact-stats",
  recommendationScope: "artifact-stats",
  roles: ["dps"],
} as const;

const EXPECTED_DEFAULT_STAT_STRUCTURE = [
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:circlet:0`,
    sourceClaim: {
      kind: "main-stat",
      slot: "circlet",
      entryIndex: 0,
      statIds: ["cd"],
      priority: null,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: CR_CIRCLET_CLAIM_ID,
    sourceClaim: {
      kind: "main-stat",
      slot: "circlet",
      entryIndex: 1,
      statIds: ["cr"],
      priority: null,
      target: null,
    },
    sourceConditions: [
      LUNAR_CHARGED_CONDITION,
      NO_CRIT_OVERCAP_CONDITION,
    ],
    resolution: "withheld-unresolved-source-condition",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:goblet:0`,
    sourceClaim: {
      kind: "main-stat",
      slot: "goblet",
      entryIndex: 0,
      statIds: ["electro%"],
      priority: 1,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:goblet:1`,
    sourceClaim: {
      kind: "main-stat",
      slot: "goblet",
      entryIndex: 1,
      statIds: ["atk%"],
      priority: 2,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:main-stat:sands:0`,
    sourceClaim: {
      kind: "main-stat",
      slot: "sands",
      entryIndex: 0,
      statIds: ["atk%"],
      priority: null,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:substat:0`,
    sourceClaim: {
      kind: "substat",
      entryIndex: 0,
      statIds: ["cr", "cd"],
      priority: 1,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:substat:1`,
    sourceClaim: {
      kind: "substat",
      entryIndex: 1,
      statIds: ["atk%"],
      priority: 2,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
  {
    claimId: `${DEFAULT_STAT_RECORD_PREFIX}:substat:2`,
    sourceClaim: {
      kind: "substat",
      entryIndex: 2,
      statIds: ["em"],
      priority: 3,
      target: null,
    },
    sourceConditions: [LUNAR_CHARGED_CONDITION],
    resolution: "matched-by-exact-team-facts",
  },
] as const;

const EXPECTED_FORMULA_ASSUMPTIONS = [
  {
    characterId: "keqing",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: { type: "4pc", setId: "thundering_fury" },
    selectedWeaponId: "mistsplitter_reforged",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "ineffa",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: {
      type: "4pc",
      setId: "aubade_of_morningstar_and_moon",
    },
    selectedWeaponId: "fractured_halo",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "furina",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: { type: "4pc", setId: "golden_troupe" },
    selectedWeaponId: "splendor_of_tranquil_waters",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
  {
    characterId: "xilonen",
    charLevel: 90,
    constellation: 0,
    refinement: 1,
    selectedArtifact: {
      type: "4pc",
      setId: "scroll_of_the_hero_of_cinder_city",
    },
    selectedWeaponId: "peak_patrol_song",
    talentLevels: { auto: 10, skill: 10, burst: 10 },
  },
] as const;

const EXPECTED_TEAMMATE_EQUIPMENT = [
  {
    characterId: "ineffa",
    characterGuideId: "genshintools-presets:character-guide:ineffa",
    guideStatus: "baseline",
    guideSourceRefs: [
      {
        sourceId: "genshintools-presets",
        sourceRecordId: "ineffa",
        locator: {
          file: "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
          recordId: "ineffa",
        },
      },
    ],
    weaponId: "fractured_halo",
    buildSourceRecordId: "FeFiQU8",
    artifact: { type: "4pc", setId: "aubade_of_morningstar_and_moon" },
  },
  {
    characterId: "furina",
    characterGuideId: "genshintools-presets:character-guide:furina",
    guideStatus: "baseline",
    guideSourceRefs: [
      {
        sourceId: "genshintools-presets",
        sourceRecordId: "furina",
        locator: {
          file: "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
          recordId: "furina",
        },
      },
    ],
    weaponId: "splendor_of_tranquil_waters",
    buildSourceRecordId: "BQAI0BO",
    artifact: { type: "4pc", setId: "golden_troupe" },
  },
  {
    characterId: "xilonen",
    characterGuideId: "genshintools-presets:character-guide:xilonen",
    guideStatus: "baseline",
    guideSourceRefs: [
      {
        sourceId: "genshintools-presets",
        sourceRecordId: "xilonen",
        locator: {
          file: "src/presets/artifact-builds/[GGArtifact] 全角色配装 AllCharacterBuilds.json",
          recordId: "xilonen",
        },
      },
    ],
    weaponId: "peak_patrol_song",
    buildSourceRecordId: "Dbt0Wkm",
    artifact: {
      type: "4pc",
      setId: "scroll_of_the_hero_of_cinder_city",
    },
  },
] as const;

const EXPECTED_UNREVIEWED_FORMULA_LINES = [
  ["furina", "furina-burst", 1, "complete", "matches"],
  ["furina", "furina-skill-bubble", 1, "complete", "matches"],
  ["ineffa", "ineffa-burst", 1, "complete", "matches"],
  ["ineffa", "ineffa-skill-initial", 1, "complete", "matches"],
  ["keqing", "keqing-burst", 1, "complete", "matches"],
  [
    "keqing",
    "keqing-charged",
    8,
    "partial",
    "source-translation-higher",
  ],
  [
    "keqing",
    "keqing-skill-slash",
    2,
    "complete",
    "source-translation-higher",
  ],
  [
    "keqing",
    "keqing-stiletto",
    2,
    "complete",
    "source-translation-higher",
  ],
  [
    "xilonen",
    "xilonen-e-rush",
    2,
    "complete",
    "source-translation-higher",
  ],
  [
    "xilonen",
    "xilonen-normal-2",
    2,
    "complete",
    "source-translation-higher",
  ],
  [
    "xilonen",
    "xilonen-q-initial",
    1,
    "complete",
    "source-translation-higher",
  ],
] as const;

const TECHNICAL_CALC_CONTEXT = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
} as const;

type ResolvedInputs = {
  targetTeam: NonNullable<
    KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
  >["teams"][number];
  weaponGroup: KeqingLunarCandidateEquipmentGroup;
  marechausseeGroup: KeqingLunarCandidateEquipmentGroup;
  oneNodNotsuGroup: KeqingLunarCandidateEquipmentGroup;
  twoNodNotsuGroup: KeqingLunarCandidateEquipmentGroup;
  matchedStats: KeqingLunarCompositionStatEvidence[];
  withheldCrCirclet: KeqingLunarCompositionStatEvidence;
  formulaLines: NonNullable<
    KeqingLunarCrossRecordCompositionContractReport["originLedger"]
  >["unreviewedFormulaLines"]["lines"];
  teammateEquipment: FormulaEquipmentEvidence[];
};

/**
 * Author exactly two cross-record technical input compositions without
 * presenting either join as source-authored or relatively ordered.
 */
export function buildKeqingLunarCrossRecordCompositionContractReport(
  candidateLattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
): KeqingLunarCrossRecordCompositionContractReport {
  const issues: KeqingLunarCompositionContractIssue[] = [];
  validateTopLevelBoundary(candidateLattice, formulaDraft, issues);
  const resolved = resolveAndValidateInputs(candidateLattice, formulaDraft, issues);
  const inputBoundary = {
    candidateLatticeSha256: sha256Text(stableJson(candidateLattice)),
    candidateLatticeClassification: candidateLattice.classification,
    candidateLatticeStatus: candidateLattice.comparisonStatus,
    formulaDraftSha256: sha256Text(stableJson(formulaDraft)),
    formulaFixtureId: formulaDraft.fixtureId,
    formulaSourceTeamRecordId: formulaDraft.sourceTeamRecordId,
    targetTeamRecordId: TARGET_TEAM_ID,
  };
  const common = {
    schemaVersion: 1 as const,
    classification: "keqing-lunar-cross-record-composition-contract" as const,
    supportsGuideClaims: false as const,
    supportsSourceAuthoredBuildClaims: false as const,
    supportsEquipmentRecommendations: false as const,
    supportsStatRecommendations: false as const,
    supportsRelativeArtifactClaims: false as const,
    supportsTechnicalComparison: false as const,
    supportsEnergyRecoveryClaims: false as const,
    sourceAuthoredCompositionCount: 0 as const,
    crossRecordOrdering: "none" as const,
    generatorExecuted: false as const,
    damageComputationExecuted: false as const,
    technicalComparisonExecuted: false as const,
    energyRecoveryInputsUsed: false as const,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    inputBoundary,
    cautions: [
      "The two compositions are Guide Factory-authored joins across separate source claim records; KQM did not publish either as one atomic build.",
      "Source classifications are retained per claim, while crossRecordOrdering remains none and establishes no relation between the two artifacts.",
      "The CRIT Rate Circlet claim remains withheld because the exact team does not resolve the source's no-overcap condition.",
      "R1, teammate equipment, formula lines, and calculator context are separately attributed experiment inputs and are not source facts about either composition.",
      "The formula translation remains unreviewed and this contract executes no generator or numerical comparison.",
      "Energy Recharge is absent from the contract and from every composition.",
    ],
    prohibitedInterpretations: [
      "source-authored-build",
      "relative-artifact-rank",
      "equipment-recommendation",
      "stat-recommendation",
      "refinement-recommendation",
      "generated-build",
      "damage-result",
      "score",
      "winner",
      "energy-requirement",
    ],
  };

  if (issues.length > 0 || resolved == null) {
    return {
      ...common,
      contractStatus: "not-comparable",
      guideFactoryAuthoredCompositionCount: 0,
      targetBoundary: null,
      compositions: [],
      excludedSourceBranches: [],
      originLedger: null,
      issues: sortIssues(issues),
    };
  }

  const compositions = [
    buildComposition(
      "guide-factory:keqing-lunar:marechaussee-hunter",
      resolved.weaponGroup,
      resolved.marechausseeGroup,
      resolved,
    ),
    buildComposition(
      "guide-factory:keqing-lunar:night-of-the-skys-unveiling-one-nod-krai",
      resolved.weaponGroup,
      resolved.oneNodNotsuGroup,
      resolved,
    ),
  ];

  return {
    ...common,
    contractStatus: "comparable",
    guideFactoryAuthoredCompositionCount: 2,
    targetBoundary: {
      teamRecordId: TARGET_TEAM_ID,
      characterIds: [...TARGET_CHARACTER_IDS],
      sourceRosterAndDeclaredReactionFactsOnly: true,
      exactTeamConditionFactsOnly: true,
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
    },
    compositions,
    excludedSourceBranches: [
      {
        groupId: TWO_NOD_NOTSU_GROUP_ID,
        claimId: TWO_NOD_NOTSU_CLAIM_ID,
        artifact: {
          type: "4pc",
          setId: "night_of_the_skys_unveiling",
        },
        conditionResolution: "not-matched-by-exact-team-facts",
        conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
        includedInCompositions: false,
        reason: "two-nod-krai-condition-does-not-match-exact-team",
      },
    ],
    originLedger: buildOriginLedger(formulaDraft, resolved),
    issues: [],
  };
}

/**
 * Rebuild the canonical contract from its typed source inputs before comparing
 * a supplied serialized report. Callers must provide the current generatedFrom
 * hashes; no serialized composition is trusted as an authorization source.
 */
export function authenticateKeqingLunarCrossRecordCompositionContract(
  serializedReport: KeqingLunarCrossRecordCompositionContractReport,
  candidateLattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
  generatedFrom: Array<{ path: string; sha256: string }>,
): KeqingLunarCrossRecordCompositionContractAuthentication {
  const canonicalReport =
    buildKeqingLunarCrossRecordCompositionContractReport(
      candidateLattice,
      formulaDraft,
      generatedFrom,
    );
  if (canonicalReport.contractStatus !== "comparable") {
    return {
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
      issues: canonicalReport.issues.map((issue) => ({ ...issue })),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-contract-mismatch",
      issues: [
        {
          code: "authentication.serialized_contract_mismatch",
          path: "serializedReport",
          message:
            "The supplied serialized contract does not exactly match the contract rebuilt from current typed inputs and generatedFrom hashes.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

function validateTopLevelBoundary(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
  issues: KeqingLunarCompositionContractIssue[],
): void {
  const technicalBoundary = lattice.technicalComparisonBoundary;
  const availableFixtures =
    technicalBoundary.status === "availability-only-no-comparison-authorized"
      ? technicalBoundary.teamFixtures.filter(
          (fixture) =>
            fixture.status === "fixture-available-but-not-authorized",
        )
      : [];
  const availableFixture = availableFixtures[0];
  expectInvariant(
    lattice.schemaVersion === 1 &&
      lattice.classification ===
        "keqing-lunar-source-conditioned-candidate-lattice" &&
      lattice.comparisonStatus === "comparable" &&
      lattice.lattice != null &&
      lattice.issues.length === 0,
    issues,
    "input.candidate_lattice_not_comparable",
    "inputBoundary.candidateLattice",
    "The durable source-conditioned candidate lattice must be comparable and issue-free.",
  );
  expectInvariant(
    !lattice.crossProductConstructed &&
      lattice.assembledBuildCount === 0 &&
      !lattice.candidateGenerationExecuted &&
      !lattice.technicalComparisonExecuted &&
      !lattice.energyRecoveryInputsUsed,
    issues,
    "input.candidate_lattice_safety_boundary_changed",
    "inputBoundary.candidateLattice.safety",
    "The input lattice must remain a non-executable, non-Cartesian classification boundary.",
  );
  expectInvariant(
    !lattice.supportsGuideClaims &&
      !lattice.supportsEquipmentRecommendations &&
      !lattice.supportsStatRecommendations &&
      !lattice.supportsConditionApplicabilityClaims &&
      !lattice.supportsRankClaims &&
      !lattice.supportsDamageClaims &&
      !lattice.supportsEnergyRecoveryClaims,
    issues,
    "input.candidate_lattice_claim_support_changed",
    "inputBoundary.candidateLattice.claimSupport",
    "Every upstream guide, recommendation, applicability, rank, damage, and Energy Recharge support flag must remain false.",
  );
  expectInvariant(
    technicalBoundary.status ===
      "availability-only-no-comparison-authorized" &&
      technicalBoundary.exactFixtureCount === 1 &&
      technicalBoundary.authorizedSourceConditionedComparisonCount === 0 &&
      technicalBoundary.teamFixtures.length === 4 &&
      availableFixtures.length === 1 &&
      availableFixture?.teamRecordId === TARGET_TEAM_ID &&
      availableFixture.reviewStatus === "unreviewed" &&
      !availableFixture.damageReplayReady &&
      availableFixture.keqingAnchor.sourceRefinement === null &&
      !availableFixture.keqingAnchor.fixtureRefinementIsSourceFact &&
      !availableFixture.keqingAnchor.completeSourceConditionedEquipmentAnchor,
    issues,
    "input.candidate_lattice_technical_boundary_changed",
    "inputBoundary.candidateLattice.technicalComparisonBoundary",
    "The upstream technical boundary must remain availability-only with one fixture and zero authorized comparisons.",
  );
  expectInvariant(
    formulaDraft.fixtureId ===
      "keqing-ineffa-source-rotation-comparison-v1" &&
      formulaDraft.sourceTeamRecordId === TARGET_TEAM_ID,
    issues,
    "formula.fixture_or_team_changed",
    "inputBoundary.formulaDraft",
    "The formula draft must remain the exact Keqing/Ineffa/Furina/Xilonen fixture.",
  );
  expectInvariant(
    lattice.inputBoundary.formulaDraftSha256 ===
      sha256Text(stableJson(formulaDraft)) &&
      lattice.inputBoundary.formulaFixtureId === formulaDraft.fixtureId &&
      lattice.inputBoundary.formulaSourceTeamRecordId ===
        formulaDraft.sourceTeamRecordId,
    issues,
    "formula.lattice_binding_drift",
    "inputBoundary.formulaBinding",
    "The durable lattice and supplied formula draft no longer have the same exact binding.",
  );
  expectInvariant(
    formulaDraft.sourceRotation.recordId === TARGET_TEAM_ID &&
      formulaDraft.equipmentFixture.sourceTeamRecordId === TARGET_TEAM_ID &&
      formulaDraft.damageReplayReadiness.sourceTeamRecordId === TARGET_TEAM_ID,
    issues,
    "formula.nested_team_drift",
    "originLedger.fixtureAssumptions",
    "Formula rotation, equipment, and readiness lineage must all target the exact team.",
  );
  expectInvariant(
    formulaDraft.authoredTranslation.reviewStatus === "unreviewed" &&
      !formulaDraft.damageReplayReadiness.readyForDamageReplay &&
      formulaDraft.status === "needs-domain-review" &&
      !formulaDraft.promotionEligible,
    issues,
    "formula.review_boundary_changed",
    "originLedger.unreviewedFormulaLines",
    "This contract expects an unreviewed, promotion-ineligible, replay-blocked formula fixture.",
  );
}

function resolveAndValidateInputs(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  formulaDraft: KeqingIneffaFormulaDraftReport,
  issues: KeqingLunarCompositionContractIssue[],
): ResolvedInputs | null {
  const latticeBody = lattice.lattice;
  if (latticeBody == null) return null;
  const targetMatches = latticeBody.teams.filter(
    ({ teamRecordId }) => teamRecordId === TARGET_TEAM_ID,
  );
  expectInvariant(
    targetMatches.length === 1 &&
      sameStrings(targetMatches[0]?.characterIds ?? [], TARGET_CHARACTER_IDS),
    issues,
    "target.exact_team_boundary_changed",
    "targetBoundary",
    "Expected exactly one Keqing/Ineffa/Furina/Xilonen lattice target.",
  );
  const targetTeam = targetMatches[0];
  if (targetTeam == null) return null;

  validateRequiredEquipmentGroupBoundaries(lattice, issues);

  const weaponGroup = requiredGroup(
    lattice,
    targetTeam,
    GENERAL_MISTSPLITTER_GROUP_ID,
    GENERAL_MISTSPLITTER_CLAIM_ID,
    "weapon",
    "mistsplitter_reforged",
    "matched-by-exact-team-facts",
    issues,
  );
  const marechausseeGroup = requiredGroup(
    lattice,
    targetTeam,
    MARECHAUSSEE_HUNTER_GROUP_ID,
    MARECHAUSSEE_HUNTER_CLAIM_ID,
    "artifact",
    "marechaussee_hunter",
    "matched-by-exact-team-facts",
    issues,
  );
  const oneNodNotsuGroup = requiredGroup(
    lattice,
    targetTeam,
    ONE_NOD_NOTSU_GROUP_ID,
    ONE_NOD_NOTSU_CLAIM_ID,
    "artifact",
    "night_of_the_skys_unveiling",
    "matched-by-exact-team-facts",
    issues,
  );
  const twoNodNotsuGroup = requiredGroup(
    lattice,
    targetTeam,
    TWO_NOD_NOTSU_GROUP_ID,
    TWO_NOD_NOTSU_CLAIM_ID,
    "artifact",
    "night_of_the_skys_unveiling",
    "not-matched-by-exact-team-facts",
    issues,
  );

  if (weaponGroup != null) {
    const member = weaponGroup.members[0];
    expectInvariant(
      weaponGroup.grouping === "single" &&
        weaponGroup.recommendationOrdering === "unranked" &&
        weaponGroup.classification === "default" &&
        member.sourceRefinement === null &&
        member.searchCoverage.kind === "weapon-search-coverage" &&
        member.searchCoverage.refinementCoverageOutcome === "unspecified",
      issues,
      "weapon.source_refinement_or_group_changed",
      `equipmentGroups.${GENERAL_MISTSPLITTER_GROUP_ID}`,
      "General Mistsplitter must remain a single matched source claim with unspecified refinement.",
    );
  }
  if (marechausseeGroup != null) {
    expectInvariant(
      marechausseeGroup.classification === "default" &&
        marechausseeGroup.grouping === "single" &&
        marechausseeGroup.recommendationOrdering === "unranked",
      issues,
      "artifact.marechaussee_group_changed",
      `equipmentGroups.${MARECHAUSSEE_HUNTER_GROUP_ID}`,
      "The Marechaussee source group structure changed.",
    );
  }
  if (oneNodNotsuGroup != null) {
    expectInvariant(
      oneNodNotsuGroup.classification === "alternative" &&
        oneNodNotsuGroup.groupIndex === 0 &&
        oneNodNotsuGroup.grouping === "single" &&
        oneNodNotsuGroup.recommendationOrdering === "unranked",
      issues,
      "artifact.one_nod_notsu_branch_changed",
      `equipmentGroups.${ONE_NOD_NOTSU_GROUP_ID}`,
      "The exactly-one-Nod-Krai NotSU branch structure changed.",
    );
  }
  if (twoNodNotsuGroup != null) {
    expectInvariant(
      twoNodNotsuGroup.classification === "default" &&
        twoNodNotsuGroup.groupIndex === 1 &&
        twoNodNotsuGroup.grouping === "single" &&
        twoNodNotsuGroup.recommendationOrdering === "unranked",
      issues,
      "artifact.two_nod_notsu_branch_changed",
      `equipmentGroups.${TWO_NOD_NOTSU_GROUP_ID}`,
      "The excluded two-Nod-Krai NotSU branch structure changed.",
    );
  }

  const statEvidence = resolveDefaultStats(lattice, targetTeam, issues);
  validateFormulaInputs(formulaDraft, issues);
  const formulaLines = buildUnreviewedFormulaLines(formulaDraft, issues);
  const teammateEquipment = formulaDraft.equipmentFixture.evidence.filter(
    ({ characterId }) => characterId !== "keqing",
  );

  if (
    weaponGroup == null ||
    marechausseeGroup == null ||
    oneNodNotsuGroup == null ||
    twoNodNotsuGroup == null ||
    statEvidence == null
  ) {
    return null;
  }
  return {
    targetTeam,
    weaponGroup,
    marechausseeGroup,
    oneNodNotsuGroup,
    twoNodNotsuGroup,
    matchedStats: statEvidence.matched,
    withheldCrCirclet: statEvidence.withheld,
    formulaLines,
    teammateEquipment,
  };
}

function validateRequiredEquipmentGroupBoundaries(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  issues: KeqingLunarCompositionContractIssue[],
): void {
  for (const expected of EXPECTED_REQUIRED_EQUIPMENT_GROUPS) {
    const matches = lattice.equipmentGroups.filter(
      ({ groupId }) => groupId === expected.groupId,
    );
    expectInvariant(
      matches.length === 1 && stableJson(matches[0]) === stableJson(expected),
      issues,
      "claim.required_group_provenance_changed",
      `equipmentGroups.${expected.groupId}.sourceBoundary`,
      "Required equipment source conditions, provenance, recommendation metadata, claim metadata, and search coverage must remain exact.",
    );
  }
}

function requiredGroup(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  targetTeam: NonNullable<
    KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
  >["teams"][number],
  groupId: string,
  claimId: string,
  kind: "weapon" | "artifact",
  expectedItemId: string,
  expectedResolution: ConditionResolution,
  issues: KeqingLunarCompositionContractIssue[],
): KeqingLunarCandidateEquipmentGroup | null {
  const groups = lattice.equipmentGroups.filter((group) => group.groupId === groupId);
  const cells = targetTeam.equipmentGroupCells.filter(
    (cell) => cell.groupId === groupId,
  );
  const group = groups[0];
  const cell = cells[0];
  let exactItem = false;
  if (group?.members.length === 1) {
    const member = group.members[0];
    exactItem =
      member.claimId === claimId &&
      member.sourceClaim.kind === kind &&
      (kind === "weapon"
        ? member.sourceClaim.kind === "weapon" &&
          member.sourceClaim.weaponId === expectedItemId
        : member.sourceClaim.kind === "artifact" &&
          member.sourceClaim.artifact.type === "4pc" &&
          member.sourceClaim.artifact.setId === expectedItemId) &&
      member.representability === "initially-representable";
  }
  expectInvariant(
    groups.length === 1 &&
      cells.length === 1 &&
      group?.kind === kind &&
      exactItem &&
      cell?.conditionResolution === expectedResolution &&
      cell.searchRepresentability === "all-members-initially-representable" &&
      cell.members.length === 1 &&
      cell.members[0].claimId === claimId &&
      cell.members[0].searchRepresentability === "initially-representable" &&
      cell.members[0].conditionResolution === expectedResolution,
    issues,
    "claim.required_group_or_resolution_changed",
    `equipmentGroups.${groupId}`,
    `Required ${groupId} must occur exactly once with claim ${claimId}, expected item, initial representability, and ${expectedResolution}.`,
  );
  return groups.length === 1 && cells.length === 1 ? group : null;
}

function resolveDefaultStats(
  lattice: KeqingLunarSourceConditionedCandidateLatticeReport,
  targetTeam: NonNullable<
    KeqingLunarSourceConditionedCandidateLatticeReport["lattice"]
  >["teams"][number],
  issues: KeqingLunarCompositionContractIssue[],
): {
  matched: KeqingLunarCompositionStatEvidence[];
  withheld: KeqingLunarCompositionStatEvidence;
} | null {
  const definitions = lattice.statClaims.filter(
    ({ sourceRecordId }) => sourceRecordId === DEFAULT_STAT_SOURCE_RECORD_ID,
  );
  const expectedClaimIds = new Set(
    EXPECTED_DEFAULT_STAT_STRUCTURE.map(({ claimId }) => claimId),
  );
  const relevantCells = targetTeam.statClaimCells.filter(({ claimId }) =>
    expectedClaimIds.has(
      claimId as (typeof EXPECTED_DEFAULT_STAT_STRUCTURE)[number]["claimId"],
    ),
  );
  const relevantCellCounts = new Map<string, number>();
  for (const cell of relevantCells) {
    relevantCellCounts.set(
      cell.claimId,
      (relevantCellCounts.get(cell.claimId) ?? 0) + 1,
    );
  }
  expectInvariant(
    relevantCells.length === 8 &&
      expectedClaimIds.size === 8 &&
      [...expectedClaimIds].every(
        (claimId) => relevantCellCounts.get(claimId) === 1,
      ),
    issues,
    "stats.default_profile_cell_inventory_changed",
    "statProfile.targetCells",
    "The exact team must contain exactly one cell for each of the eight default stat claims.",
  );
  const cellsById = new Map(
    relevantCells.map((cell) => [cell.claimId, cell]),
  );
  const observed = definitions.map((definition) => ({
    claimId: definition.claimId,
    sourceClaim: definition.sourceClaim,
    sourceConditions: definition.sourceConditions,
    resolution: cellsById.get(definition.claimId)?.conditionResolution ?? null,
  }));
  expectInvariant(
    stableJson(observed) === stableJson(EXPECTED_DEFAULT_STAT_STRUCTURE),
    issues,
    "stats.default_profile_changed",
    "statProfile",
    "The default stat profile must retain seven exact-team matches and one withheld CRIT Rate Circlet.",
  );
  expectInvariant(
    definitions.every(
      ({
        repositoryRecordId,
        sourceRecordId,
        recommendationId,
        recommendationScope,
        roles,
      }) =>
        stableJson({
          repositoryRecordId,
          sourceRecordId,
          recommendationId,
          recommendationScope,
          roles,
        }) === stableJson(EXPECTED_DEFAULT_STAT_PROVENANCE),
    ),
    issues,
    "stats.default_profile_provenance_changed",
    "statProfile.sourceBoundary",
    "Every default stat claim must retain the exact source record, recommendation identity and scope, and role provenance.",
  );
  expectInvariant(
    definitions.length === 8 &&
      definitions.every((definition) =>
        expectedClaimIds.has(
          definition.claimId as (typeof EXPECTED_DEFAULT_STAT_STRUCTURE)[number]["claimId"],
        ),
      ) &&
      definitions.every((definition) => cellsById.has(definition.claimId)),
    issues,
    "stats.default_profile_missing_or_duplicated",
    "statProfile",
    "The default stat profile must contain exactly its eight source claims.",
  );
  if (definitions.length !== 8) return null;
  const evidence = definitions.map((definition) => ({
    claimId: definition.claimId,
    sourceRecordId: definition.sourceRecordId,
    sourceClaim: structuredClone(definition.sourceClaim),
    sourceConditions: [...definition.sourceConditions],
      conditionResolution:
        cellsById.get(definition.claimId)?.conditionResolution ??
        "withheld-unresolved-source-condition",
      conditionResolutionOrigin:
        "guide-factory-exact-team-facts-wrapper" as const,
  }));
  const matched = evidence.filter(
    ({ conditionResolution }) =>
      conditionResolution === "matched-by-exact-team-facts",
  );
  const withheld = evidence.filter(
    ({ claimId, conditionResolution }) =>
      claimId === CR_CIRCLET_CLAIM_ID &&
      conditionResolution === "withheld-unresolved-source-condition",
  );
  expectInvariant(
    matched.length === 7 &&
      sameStrings(
        matched.map(({ claimId }) => claimId),
        EXPECTED_MATCHED_DEFAULT_STAT_CLAIM_IDS,
      ) &&
      withheld.length === 1,
    issues,
    "stats.match_or_withhold_set_changed",
    "statProfile.resolutions",
    "No default stat claim may be promoted, dropped, or moved between matched and withheld sets.",
  );
  return withheld.length === 1 ? { matched, withheld: withheld[0] } : null;
}

function validateFormulaInputs(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  issues: KeqingLunarCompositionContractIssue[],
): void {
  expectInvariant(
    stableJson(formulaDraft.assumptions.characters) ===
      stableJson(EXPECTED_FORMULA_ASSUMPTIONS),
    issues,
    "formula.assumptions_changed",
    "originLedger.fixtureAssumptions",
    "The exact four-character formula fixture assumptions changed.",
  );
  const teammateEquipment = formulaDraft.equipmentFixture.evidence
    .filter(({ characterId }) => characterId !== "keqing")
    .map((evidence) => ({
      characterId: evidence.characterId,
      characterGuideId: evidence.characterGuideId,
      guideStatus: evidence.guideStatus,
      guideSourceRefs: evidence.guideSourceRefs,
      weaponId: evidence.weaponId,
      buildSourceRecordId: evidence.buildSourceRecordId,
      artifact: evidence.build.artifact,
    }));
  expectInvariant(
    stableJson(teammateEquipment) === stableJson(EXPECTED_TEAMMATE_EQUIPMENT),
    issues,
    "formula.teammate_equipment_changed",
    "originLedger.teammateEquipment",
    "The independent baseline teammate-equipment fixture changed.",
  );
  const keqingEvidence = formulaDraft.equipmentFixture.evidence.filter(
    ({ characterId }) => characterId === "keqing",
  );
  expectInvariant(
    keqingEvidence.length === 1 &&
      keqingEvidence[0].weaponId === "mistsplitter_reforged" &&
      keqingEvidence[0].build.artifact.type === "4pc" &&
      keqingEvidence[0].build.artifact.setId === "thundering_fury",
    issues,
    "formula.keqing_fixture_anchor_changed",
    "originLedger.fixtureAssumptions.keqing",
    "The formula fixture must retain its independent baseline Keqing anchor.",
  );
}

function buildUnreviewedFormulaLines(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  issues: KeqingLunarCompositionContractIssue[],
): NonNullable<
  KeqingLunarCrossRecordCompositionContractReport["originLedger"]
>["unreviewedFormulaLines"]["lines"] {
  const lines = formulaDraft.authoredTranslation.formulaComparisons.flatMap(
    (comparison) =>
      comparison.sourceCountClaim.type !== "exact"
        ? []
        : [
            {
              characterId: comparison.characterId,
              formulaId: comparison.formulaId,
              count: comparison.sourceCountClaim.value,
              sourceTokenCoverage: comparison.sourceTokenCoverage,
              relation: comparison.relation,
            },
          ],
  );
  const structural = lines.map((line) => [
    line.characterId,
    line.formulaId,
    line.count,
    line.sourceTokenCoverage,
    line.relation,
  ]);
  expectInvariant(
    lines.length === formulaDraft.authoredTranslation.formulaComparisons.length &&
      stableJson(structural) === stableJson(EXPECTED_UNREVIEWED_FORMULA_LINES),
    issues,
    "formula.unreviewed_lines_changed",
    "originLedger.unreviewedFormulaLines.lines",
    "The exact-valued unreviewed source-translation formula lines changed.",
  );
  return lines;
}

function buildComposition(
  compositionId: KeqingLunarCrossRecordComposition["compositionId"],
  weaponGroup: KeqingLunarCandidateEquipmentGroup,
  artifactGroup: KeqingLunarCandidateEquipmentGroup,
  resolved: ResolvedInputs,
): KeqingLunarCrossRecordComposition {
  const weaponMember = weaponGroup.members[0];
  const artifactMember = artifactGroup.members[0];
  if (
    weaponMember.sourceClaim.kind !== "weapon" ||
    artifactMember.sourceClaim.kind !== "artifact" ||
    artifactMember.sourceClaim.artifact.type !== "4pc"
  ) {
    throw new Error("Validated composition members changed kind.");
  }
  return {
    compositionId,
    authoredBy: "guide-factory",
    sourceAuthored: false,
    sourceAuthoredBuild: false,
    joinKind: "cross-record-evidence-composition",
    crossRecordOrdering: "none",
    teamRecordId: TARGET_TEAM_ID,
    characterId: "keqing",
    weapon: {
      groupId: GENERAL_MISTSPLITTER_GROUP_ID,
      claimId: GENERAL_MISTSPLITTER_CLAIM_ID,
      weaponId: "mistsplitter_reforged",
      conditionResolution: "matched-by-exact-team-facts",
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
      sourceRefinement: null,
      experimentPolicyReference: "originLedger.r1ExperimentPolicy",
    },
    artifact: {
      groupId: artifactGroup.groupId,
      claimId: artifactMember.claimId,
      artifact: structuredClone(artifactMember.sourceClaim.artifact) as
        | { type: "4pc"; setId: "marechaussee_hunter" }
        | { type: "4pc"; setId: "night_of_the_skys_unveiling" },
      sourceClassification: artifactGroup.classification as
        | "default"
        | "alternative",
      conditionResolution: "matched-by-exact-team-facts",
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
      searchRepresentability: "initially-representable",
    },
    statProfile: {
      profileSourceRecordId: DEFAULT_STAT_SOURCE_RECORD_ID,
      crossRecordJoinAuthoredByGuideFactory: true,
      matchedClaims: resolved.matchedStats.map(cloneStatEvidence),
      withheldClaims: [
        {
          ...cloneStatEvidence(resolved.withheldCrCirclet),
          withholdingReason: "unresolved-no-overcap-condition",
        },
      ],
      matchedClaimCount: 7,
      withheldClaimCount: 1,
    },
    formulaFixtureReference: {
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
      teamRecordId: TARGET_TEAM_ID,
      reviewStatus: "unreviewed",
      sourceBindingEstablished: false,
      technicalExecutionAuthorized: false,
    },
    teammateEquipmentReference: "originLedger.teammateEquipment",
  };
}

function buildOriginLedger(
  formulaDraft: KeqingIneffaFormulaDraftReport,
  resolved: ResolvedInputs,
): NonNullable<
  KeqingLunarCrossRecordCompositionContractReport["originLedger"]
> {
  return {
    sourceRoster: {
      origin: "kqm-exact-team-record",
      sourceAuthored: true,
      teamRecordId: TARGET_TEAM_ID,
      characterIds: [...TARGET_CHARACTER_IDS],
      supportsEquipmentBinding: false,
    },
    sourceClaims: {
      origin: "kqm-character-guide-claim-records",
      sourceAuthored: true,
      sharedWeaponClaimId: GENERAL_MISTSPLITTER_CLAIM_ID,
      artifactClaimIds: [
        MARECHAUSSEE_HUNTER_CLAIM_ID,
        ONE_NOD_NOTSU_CLAIM_ID,
      ],
      matchedDefaultStatClaimIds: resolved.matchedStats.map(
        ({ claimId }) => claimId,
      ),
      withheldDefaultStatClaimIds: [CR_CIRCLET_CLAIM_ID],
      excludedArtifactClaimIds: [TWO_NOD_NOTSU_CLAIM_ID],
      sourceAuthoredCrossRecordJoin: false,
      conditionResolutionOrigin: "guide-factory-exact-team-facts-wrapper",
    },
    fixtureAssumptions: {
      origin: "guide-factory-formula-fixture-assumptions",
      sourceAuthored: false,
      fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
      assumptions: structuredClone(formulaDraft.assumptions.characters),
      appliedByThisContract: false,
    },
    r1ExperimentPolicy: {
      origin: "guide-factory-experiment-policy",
      sourceAuthored: false,
      characterId: "keqing",
      weaponId: "mistsplitter_reforged",
      sourceRefinement: null,
      experimentRefinement: 1,
      experimentRefinementIsSourceFact: false,
      appliedByThisContract: false,
    },
    teammateEquipment: {
      origin: "genshintools-baseline-equipment-fixture",
      sourceAuthoredForExactKqmTeam: false,
      exactTeamSourceBindsEquipment: false,
      members: resolved.teammateEquipment.map((evidence) => ({
        characterId: evidence.characterId as "ineffa" | "furina" | "xilonen",
        characterGuideId: evidence.characterGuideId,
        guideStatus: evidence.guideStatus,
        guideSourceRefs: structuredClone(evidence.guideSourceRefs),
        weaponId: evidence.weaponId,
        buildSourceRecordId: evidence.buildSourceRecordId,
        artifact: structuredClone(evidence.build.artifact),
      })),
      appliedByThisContract: false,
    },
    unreviewedFormulaLines: {
      origin: "guide-factory-authored-source-translation",
      sourceAuthored: false,
      reviewStatus: "unreviewed",
      sourceBindingEstablished: false,
      lines: resolved.formulaLines.map((line) => ({ ...line })),
      appliedByThisContract: false,
    },
    calcContext: {
      origin: "guide-factory-experiment-policy",
      sourceAuthored: false,
      value: { ...TECHNICAL_CALC_CONTEXT },
      appliedByThisContract: false,
    },
    energyRecovery: {
      origin: "absent-by-contract",
      inputsUsed: false,
      thresholdsUsed: false,
      targetsUsed: false,
      sequenceInputUsed: false,
    },
  };
}

function cloneStatEvidence(
  evidence: KeqingLunarCompositionStatEvidence,
): KeqingLunarCompositionStatEvidence {
  return {
    claimId: evidence.claimId,
    sourceRecordId: evidence.sourceRecordId,
    sourceClaim: structuredClone(evidence.sourceClaim),
    sourceConditions: [...evidence.sourceConditions],
    conditionResolution: evidence.conditionResolution,
    conditionResolutionOrigin: evidence.conditionResolutionOrigin,
  };
}

function expectInvariant(
  condition: boolean,
  issues: KeqingLunarCompositionContractIssue[],
  code: string,
  path: string,
  message: string,
): void {
  if (!condition) issues.push({ code, path, message });
}

function sortIssues(
  issues: readonly KeqingLunarCompositionContractIssue[],
): KeqingLunarCompositionContractIssue[] {
  return [...issues].sort((left, right) =>
    compareText(
      `${left.path}\u0000${left.code}\u0000${left.message}`,
      `${right.path}\u0000${right.code}\u0000${right.message}`,
    ),
  );
}

function sameStrings(
  observed: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    observed.length === expected.length &&
    observed.every((value, index) => value === expected[index])
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
