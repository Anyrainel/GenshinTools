import characterStatsInput from "@/data/game/character_stats.json";
import weaponStatsInput from "@/data/game/weapon_stats.json";
import { weapons } from "@/data/resources";
import { betaWeapons } from "@/data/resources_beta";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  buildArtifactChoiceSearchCoverageReport,
  type ArtifactChoiceSearchCoverageObservation,
} from "./artifactChoiceSearchCoverage";
import { sha256Text, stableJson } from "./io";
import {
  KEQING_ROLE_PAIR_PAGE_URL,
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
} from "./keqingSourceScopedRolePairSample";
import {
  authenticateKeqingLunarEquipmentScope,
  KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS,
  type KeqingLunarEquipmentCharacterFact,
  type KeqingLunarEquipmentScopeAuthority,
} from "./keqingLunarEquipmentEvidenceScope";
import type { ManualSnapshotInput } from "./manualSnapshots";
import {
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
} from "./schemas";
import {
  buildWeaponChoiceSearchCoverageReport,
  type WeaponChoiceSearchCoverageObservation,
  type WeaponChoiceSearchCoveragePolicyInputs,
  WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
} from "./weaponChoiceSearchCoverage";
import type {
  ScopedSemanticDependencyAcceptedAudit,
} from "./scopedSemanticDependency";

type KnowledgeCharacterGuide = Extract<
  KnowledgeRecord,
  { kind: "character_guide" }
>;
type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;
type ManualCharacterGuide = Extract<
  ManualObservationSnapshot["records"][number],
  { kind: "character_guide" }
>;
type GuideRecommendation = NonNullable<
  KnowledgeCharacterGuide["recommendations"]
>[number];

export const KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS =
  KEQING_LUNAR_EQUIPMENT_SCOPE_SOURCE_RECORD_IDS;

type ParticipatingSourceRecordId =
  (typeof KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS)[number];

export const KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_IDS =
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS.map(
    (sourceRecordId) => `kqm:character-guide:${sourceRecordId}`,
  );

export const KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS = {
  lunarCharged:
    "Keqing is used in a Lunar-Charged team.",
  furina: "The team contains Furina.",
  exactlyOneNodKrai:
    "The team contains exactly one Nod-Krai character.",
  ainoTwoNodKrai:
    "The team contains Ineffa and Aino as its two Nod-Krai characters.",
  traditional:
    "The comparison is restricted to the source's traditional artifact-set options.",
  topLunarCharged:
    "Keqing is the team's top Lunar-Charged contributor without using a CRIT Rate artifact set.",
  highBuff:
    "Keqing has both a high-Base-ATK weapon and large amounts of DMG Bonus.",
  exceptionalElementalMastery:
    "Keqing has an exceptional amount of Elemental Mastery.",
  ineffaShield:
    "Ineffa's shield remains active for the compared damage window.",
  finaleR5: "Finale of the Deep is R5.",
  finaleBondCleared:
    "A healer clears Finale of the Deep's Bond of Life for every Keqing combo.",
  equalRefinement: "The compared weapons have equal Refinement.",
  critRateDoesNotOvercap:
    "Keqing does not overcap CRIT Rate after A4 and artifact-set bonuses.",
  eshuFullShield:
    "Calamity of Eshu is compared against R5 Lion's Roar, and its shield-dependent passive has full uptime.",
  harbingerOfDawn:
    "Harbinger of Dawn's passive remains active, Furina is absent, and Keqing is not using 4pc Marechaussee Hunter.",
  noBetterWeapon: "No stronger listed weapon is available.",
} as const;

type SourceCondition =
  (typeof KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS)[keyof typeof KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS];

type ConditionPredicateId =
  | "roster-contains-keqing-and-declares-lunar-charged"
  | "roster-contains-furina"
  | "roster-contains-exactly-one-nod-krai-character"
  | "roster-contains-exactly-ineffa-and-aino-as-two-nod-krai-characters"
  | "traditional-artifact-set-comparison-input-unavailable"
  | "top-lunar-charged-contributor-and-non-crit-set-inputs-unavailable"
  | "weapon-base-atk-and-team-dmg-bonus-inputs-unavailable"
  | "exceptional-elemental-mastery-threshold-unavailable"
  | "ineffa-shield-window-uptime-unavailable"
  | "finale-refinement-input-unavailable"
  | "finale-bond-clearance-timing-unavailable"
  | "equal-refinement-input-unavailable"
  | "crit-rate-overcap-inputs-unavailable"
  | "eshu-comparison-and-shield-uptime-inputs-unavailable"
  | "harbinger-passive-and-artifact-inputs-unavailable"
  | "weapon-availability-order-input-unavailable";

export type KeqingLunarConditionResolution =
  | "matched-by-exact-team-facts"
  | "not-matched-by-exact-team-facts"
  | "withheld-unresolved-source-condition";

type TargetTeamContext = {
  teamRecordId: string;
  characterIds: string[];
  nodKraiCharacterIds: string[];
  nodKraiCharacterCount: number;
  containsFurina: boolean;
  containsAino: boolean;
  containsIneffa: boolean;
  containsKeqing: boolean;
  recordsLunarCharged: boolean;
  declaredLunarChargedFactsMatch: boolean;
  allInvestmentsUnspecified: boolean;
  allEquipmentUnselected: boolean;
  sourceStatus: KnowledgeTeam["status"];
  promotionEligible: boolean | null;
  intent: KnowledgeTeam["intent"] | null;
  rankingClaim: KnowledgeTeam["rankingClaim"] | null;
  sourcePageMatches: boolean;
  matchesExpectedBoundary: boolean;
};

type SourceConditionAcknowledgement = {
  conditionIndex: number;
  predicateId: ConditionPredicateId | null;
  resolution: KeqingLunarConditionResolution;
  reason: string;
};

type ClaimTeamResolution = {
  teamRecordId: string;
  resolution: KeqingLunarConditionResolution;
  conditionAcknowledgements: SourceConditionAcknowledgement[];
};

type WeaponSearchCoverageReference = {
  kind: "weapon-search-coverage";
  observationId: string;
  weaponIdDomainOutcome: WeaponChoiceSearchCoverageObservation["weaponIdDomain"]["outcome"];
  candidateRefinements: number[];
  refinementCoverageOutcome: WeaponChoiceSearchCoverageObservation["refinementCoverage"]["outcome"];
  nativeTypeCompatibilityOutcome: WeaponChoiceSearchCoverageObservation["nativeTypeCompatibility"]["outcome"];
};

type ArtifactSearchCoverageReference = {
  kind: "artifact-search-coverage";
  observationId: string;
  outcome: ArtifactChoiceSearchCoverageObservation["outcome"];
  failureReason: ArtifactChoiceSearchCoverageObservation["failureReason"] | null;
};

type NoSearchCoverageReference = {
  kind: "not-an-equipment-search-candidate";
};

type SearchCoverageReference =
  | WeaponSearchCoverageReference
  | ArtifactSearchCoverageReference
  | NoSearchCoverageReference;

type SourceClaim =
  | {
      kind: "weapon";
      recommendationOrdering: GuideRecommendation["weaponOrdering"] | null;
      groupIndex: number;
      weaponIndex: number;
      weaponId: string;
      grouping: "single" | "alternatives" | "tied";
      classification:
        | "default"
        | "recommended"
        | "alternative"
        | "conditional"
        | "available-only";
    }
  | {
      kind: "artifact";
      recommendationOrdering: GuideRecommendation["artifactOrdering"] | null;
      groupIndex: number;
      artifactIndex: number;
      artifact: ArtifactChoiceSearchCoverageObservation["artifact"];
      grouping: "single" | "alternatives" | "tied";
      classification:
        | "default"
        | "recommended"
        | "alternative"
        | "conditional"
        | "available-only";
    }
  | {
      kind: "main-stat";
      slot: "sands" | "goblet" | "circlet";
      entryIndex: number;
      statIds: string[];
      priority: number | null;
      target: string | null;
    }
  | {
      kind: "substat";
      entryIndex: number;
      statIds: string[];
      priority: number | null;
      target: string | null;
    };

export interface KeqingLunarEquipmentEvidenceClaim {
  claimId: string;
  repositoryRecordId: string;
  sourceRecordId: string;
  recommendationId: string;
  recommendationScope: GuideRecommendation["scope"];
  roles: string[];
  sourceClaim: SourceClaim;
  sourceConditions: string[];
  allSourceConditionsMappedExactly: boolean;
  conditionMappingKind: "wrapper-authored-exact-text-acknowledgement";
  searchCoverage: SearchCoverageReference;
  teamResolutions: ClaimTeamResolution[];
}

export interface KeqingLunarEquipmentEvidenceValidationReport {
  schemaVersion: 1;
  classification: "keqing-lunar-equipment-evidence-structural-validation";
  validationStatus: "comparable" | "not-comparable";
  supportsGuideClaims: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsConditionApplicabilityClaims: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  candidateGenerationInput: false;
  candidateGenerationExecuted: false;
  damageOrRankingComputationExecuted: false;
  energyRecoveryInputsUsed: false;
  generatedFrom: Array<{ path: string; sha256: string }>;
  semanticScope: KeqingLunarEquipmentSemanticScopeAudit;
  sourceBoundary: {
    sourceId: "kqm";
    expectedPage: typeof EXPECTED_PAGE;
    observedPage: ManualObservationSnapshot["page"];
    expectedCapturedAt: typeof EXPECTED_CAPTURED_AT;
    observedCapturedAt: string;
    pageMatchesExpectation: boolean;
    expectedParticipatingRecordCount: 17;
    observedParticipatingRecordCount: number;
    records: Array<{
      sourceRecordId: ParticipatingSourceRecordId;
      repositoryRecordId: string;
      manualOccurrenceCount: number;
      repositoryOccurrenceCount: number;
      extractionMethod: string | null;
      reviewStatus: string | null;
      manualPayloadSha256: string | null;
      expectedManualPayloadSha256: string;
      manualPayloadMatchesExpectation: boolean;
      repositoryPayloadSha256: string | null;
      expectedRepositoryPayloadSha256: string;
      repositoryPayloadMatchesExpectation: boolean;
      repositoryRecommendationMatchesManual: boolean;
      repositoryStateMatchesExpectation: boolean;
      repositoryUsesExactPage: boolean;
    }>;
    allRecordsPresentExactlyOnce: boolean;
    allExtractionStatesMatch: boolean;
    allManualPayloadsMatch: boolean;
    allRepositoryPayloadsMatch: boolean;
    allRepositoryRecommendationsMatchManual: boolean;
    allRepositoryStatesMatch: boolean;
    allRepositoryPagesMatch: boolean;
  };
  baselineBoundary: {
    guideId: typeof BASELINE_GUIDE_ID;
    expectedStatus: "baseline";
    buildSourceRecordId: typeof BASELINE_BUILD_SOURCE_RECORD_ID;
    expectedWeaponOrder: ["mistsplitter_reforged"];
    guidePresentExactlyOnce: boolean;
    guideStatusMatches: boolean;
    characterMatches: boolean;
    weaponOrderMatchesExactly: boolean;
    buildPresentExactlyOnce: boolean;
    buildPayloadMatchesExactly: boolean;
    allChecksMatch: boolean;
  };
  publishedTeamBoundary: {
    expectedTargetCount: 4;
    targetTeamIds: string[];
    allTargetsMatchExpectation: boolean;
    targets: TargetTeamContext[];
  };
  sourceConditionBoundary: {
    mappingKind: "wrapper-authored-exact-text-acknowledgement";
    rosterAndDeclaredReactionFactsOnly: true;
    buildGameplayAndRefinementConditionsRemainUnresolved: boolean;
    distinctSourceConditionCount: number;
    mappedSourceConditionCount: number;
    unmappedSourceConditions: string[];
    allSourceConditionsMappedExactly: boolean;
    gameplayBuildAndRefinementAcknowledgementCount: number;
    matchedGameplayBuildOrRefinementAcknowledgementCount: number;
    allowedRosterKnownFalseConjunctCount: number;
    allowedRosterKnownFalseConjunctTeamIds: string[];
    expectedRosterKnownFalseConjunctTeamIds: string[];
    allowedRosterKnownFalseConjunctTeamsMatchExpectation: boolean;
    unexpectedGameplayBuildOrRefinementResolutionCount: number;
  };
  searchCoverageBoundary: {
    candidateDomainUse: "read-only-coverage-cross-reference-only";
    equipmentClaimCount: number;
    weaponClaimCount: number;
    artifactClaimCount: number;
    exactCoverageReferenceCount: number;
    allEquipmentClaimsHaveExactlyOneCoverageReference: boolean;
    allWeaponIdsInReleasedCandidateDomain: boolean;
    allWeaponNativeTypesCompatible: boolean;
    allArtifactsRepresentable: boolean;
    sourceRefinementInferenceCount: number;
    sourceRefinementsInferred: boolean;
  };
  baselineComparison: {
    classification: "structural-source-vs-baseline-observations";
    candidateSourceRecordsUsedAsGenerationInputs: false;
    comparisonProducesRecommendationOrRank: false;
    defaultMainStatCoverage: {
      sourceRecordId: "keqing-lunar-charged-default-artifact-stats-luna-i";
      baselineBuildSourceRecordId: typeof BASELINE_BUILD_SOURCE_RECORD_ID;
      sands: BaselineMainStatCoverage;
      goblet: BaselineMainStatCoverage;
      circlet: BaselineMainStatCoverage;
      allBaselineMainStatsCoveredBySourceObservation: boolean;
    };
    conditionalAtkGoblet: {
      sourceRecordId: "keqing-lunar-charged-high-buff-goblet-stats-luna-i";
      sourceCondition: string;
      sourceIncludesAtkGoblet: boolean;
      baselineIncludesAtkGoblet: boolean;
      relation: "not-established-by-baseline";
    };
    substatPriority: {
      sourceRecordId: "keqing-lunar-charged-default-artifact-stats-luna-i";
      baselinePriorityGroups: string[][];
      sourcePriorityGroups: string[][];
      sharedStatIds: string[];
      relation: "explicit-partial-order-disagreement";
      disagreements: Array<{
        higherStatId: "atk%";
        lowerStatId: "em";
        baselineRelation: "tied";
        sourceRelation: "higher-priority";
      }>;
      interpretedAsValidationError: false;
    };
    generalWeapon: {
      sourceRecordId: "keqing-lunar-charged-general-mistsplitter-luna-i";
      baselineWeaponOrder: string[];
      sourceWeaponIds: string[];
      exactStructuralMatch: boolean;
    };
    baselineArtifact: {
      baselineArtifact: { type: "4pc"; setId: "thundering_fury" };
      sourceRecordId:
        "keqing-lunar-charged-top-contributor-artifact-options-luna-i";
      sourceListsBaselineArtifact: boolean;
      sourceConditionResolutionAcrossTargets: KeqingLunarConditionResolution[];
      relation: "source-observed-only-under-unresolved-top-contributor-condition";
      traditionalSourceRecordId:
        "keqing-lunar-charged-traditional-artifact-options-luna-i";
      sourceTraditionalRecordListsBaselineArtifact: boolean;
      authoredTraditionalMappingInstalled: false;
      directContradictionClaimed: false;
    };
  };
  claims: KeqingLunarEquipmentEvidenceClaim[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export interface KeqingLunarEquipmentSemanticScopeAudit {
  status: "accepted";
  trust: "authenticated-current-input-rebuild-and-pinned-expectation";
  scopeId: string;
  manifestSha256: string;
  scopeProjectionSha256: string;
  dependencies: Array<{
    dependencyId: string;
    selectedCount: number;
    selectedKeySetSha256: string;
    selectedPayloadSha256: string;
  }>;
  parity: {
    configuredCount: number;
    exactCount: number;
    parityIdsSha256: string;
    normalizedPairsSha256: string;
  };
}

interface BaselineMainStatCoverage {
  baselineStatIds: string[];
  sourceObservedStatIds: string[];
  sourceConditionalStatIds: string[];
  allBaselineStatIdsCovered: boolean;
}

export interface KeqingLunarEvidenceClaimSafety {
  gameplayBuildAndRefinementAcknowledgementCount: number;
  matchedGameplayBuildOrRefinementAcknowledgementCount: number;
  allowedRosterKnownFalseConjunctCount: number;
  allowedRosterKnownFalseConjunctTeamIds: string[];
  expectedRosterKnownFalseConjunctTeamIds: string[];
  allowedRosterKnownFalseConjunctTeamsMatchExpectation: boolean;
  unexpectedGameplayBuildOrRefinementResolutionCount: number;
  buildGameplayAndRefinementConditionsRemainUnresolved: boolean;
  sourceRefinementInferenceCount: number;
  sourceRefinementsInferred: boolean;
}

const SEMANTICALLY_SCOPED_INPUT_PATHS = new Set([
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/manual-index.json",
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  "scripts/guide-factory/sources/registry.json",
  "scripts/guide-factory/src/schemas.ts",
  "src/data/game/character_stats.json",
]);

export const KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/keqingLunarEquipmentEvidenceValidation.ts",
    "scripts/guide-factory/src/keqingLunarEquipmentEvidenceScope.ts",
    "scripts/guide-factory/src/scopedSemanticDependency.ts",
    "scripts/guide-factory/src/keqingSourceScopedRolePairSample.ts",
    "scripts/guide-factory/src/manualSnapshots.ts",
    "scripts/guide-factory/src/schemas.ts",
    ...ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
    ...WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  ]),
].filter((path) => !SEMANTICALLY_SCOPED_INPUT_PATHS.has(path));

const EXPECTED_CAPTURED_AT = "2026-08-29" as const;
const EXPECTED_PAGE = {
  title: "Keqing Quick Guide",
  url: KEQING_ROLE_PAIR_PAGE_URL,
  publisher: "KeqingMains",
  sourceVersion: "Luna I",
  attributionNote:
    "KQM asks readers to link the original guide when using it as a content reference; this snapshot stores narrow paraphrased claims and source locators.",
} as const;

const BASELINE_GUIDE_ID = "genshintools-presets:character-guide:keqing" as const;
const BASELINE_BUILD_SOURCE_RECORD_ID = "1WswsAu" as const;
const EXPECTED_BASELINE_BUILD = {
  sourceRecordId: BASELINE_BUILD_SOURCE_RECORD_ID,
  visible: true,
  artifact: { type: "4pc", setId: "thundering_fury" },
  styles: ["on-field"],
  roles: ["dps"],
  sands: [{ stat: "atk%", weight: 100 }],
  goblet: [{ stat: "electro%", weight: 100 }],
  circlet: [
    { stat: "cd", weight: 100 },
    { stat: "cr", weight: 100 },
  ],
  substats: [
    { stat: "cd", weight: 100 },
    { stat: "cr", weight: 100 },
    { stat: "atk%", weight: 75 },
    { stat: "em", weight: 75 },
  ],
} as const;

const EXPECTED_TEAM_ROSTERS: Record<string, readonly string[]> = {
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[0]]: [
    "keqing",
    "ineffa",
    "aino",
    "sucrose",
  ],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1]]: [
    "keqing",
    "ineffa",
    "furina",
    "jean",
  ],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2]]: [
    "keqing",
    "ineffa",
    "furina",
    "xilonen",
  ],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[3]]: [
    "keqing",
    "ineffa",
    "yelan",
    "kaedehara_kazuha",
  ],
};

const EXPECTED_TEAM_NOD_KRAI_ROSTERS: Record<string, readonly string[]> = {
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[0]]: ["ineffa", "aino"],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1]]: ["ineffa"],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2]]: ["ineffa"],
  [KEQING_ROLE_PAIR_TARGET_TEAM_IDS[3]]: ["ineffa"],
};

const EXPECTED_HARBINGER_FURINA_FALSE_TARGET_TEAM_IDS = [
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS[1],
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS[2],
] as const;

// These hashes intentionally pin the complete manual source records, including
// locator, extraction state, recommendation payload, and unknowns. They are
// populated only after the source adapter has produced the captured checkpoint
// fixture; using independent hashes avoids treating the observed payload as its
// own expectation.
const EXPECTED_MANUAL_RECORD_PAYLOAD_SHA256: Record<
  ParticipatingSourceRecordId,
  string
> = {
  "keqing-lunar-charged-default-artifact-stats-luna-i":
    "f3e479a9fcc59d1d0bc09f03fd5cb9cd7894be2a259bb3edb331fe8555a5399b",
  "keqing-lunar-charged-high-buff-goblet-stats-luna-i":
    "81577f19b22ddda89c3e7e3dd24832de142abc5ba0a9a2709a3cfa81c8613953",
  "keqing-lunar-charged-furina-marechaussee-hunter-luna-i":
    "fb11da8d6d3bee734557617f858dd74d7e6b9aefddd2996f1f83fdae1824a3fa",
  "keqing-lunar-charged-notsu-contexts-luna-i":
    "2aa82ef0559c614491a5099da0b8a72b1da1b895df2099800e1bcb6fcd22cdab",
  "keqing-lunar-charged-traditional-artifact-options-luna-i":
    "84194569fb93daaf51d57ebb6d9f9d7673c90d42f00e72eba0c9397a56d12c30",
  "keqing-lunar-charged-top-contributor-artifact-options-luna-i":
    "866f18494a4b7069e245fd4c7d6d2c8d01c9ec36923f73840f81b96b1c1fc245",
  "keqing-lunar-charged-general-mistsplitter-luna-i":
    "83fb88fd9ac8ec251c691928cabfe30f558149fb1645fc33f755b3ccf974b82a",
  "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i":
    "b77363ebe5cab22f6adbc9a573c7e3f2940da4d7078acee79e24e1208ba7e60c",
  "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i":
    "f64aca16887a3aae79be8fc4464b3d8a2a5c9005ffd1a55f87891ea447d63f11",
  "keqing-lunar-charged-shielded-summit-shaper-luna-i":
    "e9f8ee2f817fb8807b63d61f7e387b5703433592f710d7f175d7bc3a0b06a3bd",
  "keqing-lunar-charged-other-five-star-crit-options-luna-i":
    "247d6221ada35981e48e075db269753de4337c73228908c324de8c50feb2e4c8",
  "keqing-lunar-charged-r5-finale-healer-luna-i":
    "8d2c6a68a27c10859ecdd2759716d3c58ecccf29bb8cbb8b82be1d1b87d382e1",
  "keqing-lunar-charged-freedom-sworn-luna-i":
    "0d794971d5a7b09427bb235dbd6faffbdd98e7a88e342e6c5f0f29a09f04406d",
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i":
    "ad12fb26aa2b5ed09c104817b11209edde258bc390a6e335bb9dabd5137cd349",
  "keqing-lunar-charged-full-shield-eshu-lions-roar-tie-luna-i":
    "dba3e50ddeaf34e14461dc0c278c95130c1c279fd76506bb6f5e2833c4f6a0a8",
  "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i":
    "854e0a6f73f39cbd66cdde9b9d9c57625d4010c15181e3d67efedd9839706644",
  "keqing-lunar-charged-low-rarity-fallbacks-luna-i":
    "0194f1108e1c5c7cd5f45164d005a2c39b781455fe75eb7c9a5ad25d00f878bf",
};

// These hashes independently pin each complete consolidated record. This
// closes the adapter seam around exact sourceRefs, supporting locators,
// unknowns, recommendation payload, status, and promotion state instead of
// assuming recommendation equality alone proves faithful consolidation.
const EXPECTED_REPOSITORY_RECORD_PAYLOAD_SHA256: Record<
  ParticipatingSourceRecordId,
  string
> = {
  "keqing-lunar-charged-default-artifact-stats-luna-i":
    "d74cf45e5372fd3d634ebbcfc990d007e64f2c081334b3d3b0d45541d6841b2b",
  "keqing-lunar-charged-high-buff-goblet-stats-luna-i":
    "2b526806c89a228b019c55e367a400e0c837778a80899f3f5b0bb982b082eef2",
  "keqing-lunar-charged-furina-marechaussee-hunter-luna-i":
    "1b5fa8ed1ba41da7cd299d1b847aa63e77608e9721c3d0552b88c6c4483e5f38",
  "keqing-lunar-charged-notsu-contexts-luna-i":
    "221235137bf8d0cba666b964c956612c853833b22f6ce121ab209883b33e3162",
  "keqing-lunar-charged-traditional-artifact-options-luna-i":
    "d9fc134f7f7b4d3e6d135cb369b74cb940fc41a86cb540fbe1d849d9b445232a",
  "keqing-lunar-charged-top-contributor-artifact-options-luna-i":
    "679be7b20736211df33efb98b2c9cb3bd498bcb9c44ef377f203cddb4626bb67",
  "keqing-lunar-charged-general-mistsplitter-luna-i":
    "87ed323f6500d97c0eb25326a4d730e75e20976f069119172fbe5618ec3d3ffb",
  "keqing-lunar-charged-traditional-jade-cutter-ranking-luna-i":
    "ac242b4236b4fec7dfbb90d43b52b7ad6342cf98893e417091ad53bb6e0e9aa1",
  "keqing-lunar-charged-exceptional-em-foliar-tie-luna-i":
    "75d80607b42fc2a008614fb95c979ad5e6619bcc2bb270e1c5d96ac5d371e23e",
  "keqing-lunar-charged-shielded-summit-shaper-luna-i":
    "378d387cf9a28082d7bf46b70b621f39184706a50d9f71bedcd8089b0295b0db",
  "keqing-lunar-charged-other-five-star-crit-options-luna-i":
    "50ad2ed06362429d1005702dd78cea191c978a8105334b22b6401825f1d2fea0",
  "keqing-lunar-charged-r5-finale-healer-luna-i":
    "a33677eb4e0215756d63fe41cab6653c6600bb8f2a8037dc243322465e415a20",
  "keqing-lunar-charged-freedom-sworn-luna-i":
    "af193b0b7e8377f955e1fc91bf90e7c3ab27af22b613af3ab98c6ac9673f4758",
  "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i":
    "84b295006a00d5ed98a3c443f9d65289c4ceb3f6c45b2e4afa48186f31d55ed9",
  "keqing-lunar-charged-full-shield-eshu-lions-roar-tie-luna-i":
    "8e94cb4a4a1f442569d9f5221a9834eccb62db1061cbc0e9a6fbec7c4756ea50",
  "keqing-lunar-charged-harbinger-of-dawn-availability-luna-i":
    "3b91c6dff96b05621ee09c0ee4a22640f74c233240d3c54267c53d887e3aa3f0",
  "keqing-lunar-charged-low-rarity-fallbacks-luna-i":
    "e854cb682bcd4400e11f848dec4727240b2fde0fe1a4fb9297089b20e1e8e4e3",
};

interface ValidationEnvironment {
  characterFacts: Readonly<
    Record<string, KeqingLunarEquipmentCharacterFact | undefined>
  >;
}

type ValidatorOnlyKnowledgeRecordCarrier = Pick<
  KnowledgeRepository,
  "records"
>;

const DEFAULT_ENVIRONMENT: ValidationEnvironment = {
  characterFacts: Object.fromEntries(
    Object.entries(characterStatsInput).map(([characterId, stats]) => [
      characterId,
      { region: stats.region, weaponType: stats.weaponType },
    ]),
  ),
};

const WEAPON_POLICY_INPUTS_WITHOUT_CHARACTER_TYPES = {
  weaponStats: weaponStatsInput,
  releasedWeaponResources: Object.fromEntries(
    weapons.map(({ id, rarity }) => [id, { rarity }]),
  ),
  betaOnlyWeaponIds: new Set(
    betaWeapons
      .filter((betaWeapon) =>
        weapons.every((releasedWeapon) => releasedWeapon.id !== betaWeapon.id),
      )
      .map(({ id }) => id),
  ),
} satisfies Omit<
  WeaponChoiceSearchCoveragePolicyInputs,
  "characterWeaponTypes"
>;

/**
 * Validate source-conditioned Keqing equipment evidence against four exact KQM
 * teams. This is an acknowledgement and search-coverage boundary only: it does
 * not materialize candidate guides, run the generator, or evaluate gameplay.
 */
export function buildKeqingLunarEquipmentEvidenceValidationReport(
  repository: KnowledgeRepository,
  manualInputs: readonly ManualSnapshotInput[],
  authority: KeqingLunarEquipmentScopeAuthority,
  generatedFrom: Array<{ path: string; sha256: string }> = [],
  environment: ValidationEnvironment = DEFAULT_ENVIRONMENT,
): KeqingLunarEquipmentEvidenceValidationReport {
  const authenticatedScope = authenticateKeqingLunarEquipmentScope({
    repository,
    manualInputs,
    characterFacts: environment.characterFacts,
    ...authority,
  });
  // The coverage builders currently consume only `records`. Keep this carrier
  // intentionally free of unauthenticated whole-repository provenance fields.
  const scopedRepository: ValidatorOnlyKnowledgeRecordCarrier = {
    records: [...authenticatedScope.repositoryRecords],
  };
  const snapshot = ManualObservationSnapshotSchema.parse(
    authenticatedScope.snapshot,
  );
  const scopedEnvironment: ValidationEnvironment = {
    characterFacts: authenticatedScope.characterFacts,
  };
  const sourceBoundary = buildSourceBoundary(scopedRepository, snapshot);
  const baselineBoundary = buildBaselineBoundary(scopedRepository);
  const targets = KEQING_ROLE_PAIR_TARGET_TEAM_IDS.map((teamRecordId) =>
    buildTargetContext(scopedRepository, teamRecordId, scopedEnvironment),
  );
  const publishedTeamBoundary = {
    expectedTargetCount: 4 as const,
    targetTeamIds: [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS],
    allTargetsMatchExpectation: targets.every(
      ({ matchesExpectedBoundary }) => matchesExpectedBoundary,
    ),
    targets,
  };

  const artifactCoverage = buildArtifactChoiceSearchCoverageReport(
    scopedRepository as KnowledgeRepository,
  );
  const weaponCoverage = buildWeaponChoiceSearchCoverageReport(
    scopedRepository as KnowledgeRepository,
    [],
    {
      policyInputs: {
        ...WEAPON_POLICY_INPUTS_WITHOUT_CHARACTER_TYPES,
        characterWeaponTypes: Object.fromEntries(
          Object.entries(authenticatedScope.characterFacts).map(
            ([characterId, fact]) => [characterId, fact?.weaponType],
          ),
        ),
      },
    },
  );
  const claims = sourceBoundary.records.flatMap((boundary) => {
    const guide = requiredUniqueCharacterGuide(
      scopedRepository,
      boundary.repositoryRecordId,
    );
    const recommendation = requiredSingleRecommendation(guide);
    return extractClaims(
      boundary.sourceRecordId,
      guide,
      recommendation,
      targets,
      artifactCoverage.observations,
      weaponCoverage.observations,
    );
  });
  requireUniqueClaimIds(claims);
  const claimSafety = deriveKeqingLunarEvidenceClaimSafety(claims);

  const distinctSourceConditions = [
    ...new Set(claims.flatMap(({ sourceConditions }) => sourceConditions)),
  ].sort(compareText);
  const unmappedSourceConditions = distinctSourceConditions.filter(
    (condition) => conditionPredicateId(condition) == null,
  );
  const sourceConditionBoundary = {
    mappingKind: "wrapper-authored-exact-text-acknowledgement" as const,
    rosterAndDeclaredReactionFactsOnly: true as const,
    buildGameplayAndRefinementConditionsRemainUnresolved:
      claimSafety.buildGameplayAndRefinementConditionsRemainUnresolved,
    distinctSourceConditionCount: distinctSourceConditions.length,
    mappedSourceConditionCount:
      distinctSourceConditions.length - unmappedSourceConditions.length,
    unmappedSourceConditions,
    allSourceConditionsMappedExactly: unmappedSourceConditions.length === 0,
    gameplayBuildAndRefinementAcknowledgementCount:
      claimSafety.gameplayBuildAndRefinementAcknowledgementCount,
    matchedGameplayBuildOrRefinementAcknowledgementCount:
      claimSafety.matchedGameplayBuildOrRefinementAcknowledgementCount,
    allowedRosterKnownFalseConjunctCount:
      claimSafety.allowedRosterKnownFalseConjunctCount,
    allowedRosterKnownFalseConjunctTeamIds:
      claimSafety.allowedRosterKnownFalseConjunctTeamIds,
    expectedRosterKnownFalseConjunctTeamIds:
      claimSafety.expectedRosterKnownFalseConjunctTeamIds,
    allowedRosterKnownFalseConjunctTeamsMatchExpectation:
      claimSafety.allowedRosterKnownFalseConjunctTeamsMatchExpectation,
    unexpectedGameplayBuildOrRefinementResolutionCount:
      claimSafety.unexpectedGameplayBuildOrRefinementResolutionCount,
  };

  const equipmentClaims = claims.filter(
    ({ sourceClaim }) =>
      sourceClaim.kind === "weapon" || sourceClaim.kind === "artifact",
  );
  const weaponClaims = claims.filter(
    ({ sourceClaim }) => sourceClaim.kind === "weapon",
  );
  const artifactClaims = claims.filter(
    ({ sourceClaim }) => sourceClaim.kind === "artifact",
  );
  const exactCoverageReferences = equipmentClaims.filter(
    ({ searchCoverage }) =>
      searchCoverage.kind === "weapon-search-coverage" ||
      searchCoverage.kind === "artifact-search-coverage",
  );
  const searchCoverageBoundary = {
    candidateDomainUse: "read-only-coverage-cross-reference-only" as const,
    equipmentClaimCount: equipmentClaims.length,
    weaponClaimCount: weaponClaims.length,
    artifactClaimCount: artifactClaims.length,
    exactCoverageReferenceCount: exactCoverageReferences.length,
    allEquipmentClaimsHaveExactlyOneCoverageReference:
      exactCoverageReferences.length === equipmentClaims.length,
    allWeaponIdsInReleasedCandidateDomain: weaponClaims.every(
      ({ searchCoverage }) =>
        searchCoverage.kind === "weapon-search-coverage" &&
        searchCoverage.weaponIdDomainOutcome ===
          "in-released-candidate-domain",
    ),
    allWeaponNativeTypesCompatible: weaponClaims.every(
      ({ searchCoverage }) =>
        searchCoverage.kind === "weapon-search-coverage" &&
        searchCoverage.nativeTypeCompatibilityOutcome === "compatible",
    ),
    allArtifactsRepresentable: artifactClaims.every(
      ({ searchCoverage }) =>
        searchCoverage.kind === "artifact-search-coverage" &&
        searchCoverage.outcome !== "not-representable",
    ),
    sourceRefinementInferenceCount:
      claimSafety.sourceRefinementInferenceCount,
    sourceRefinementsInferred: claimSafety.sourceRefinementsInferred,
  };
  const baselineComparison = buildBaselineComparison(scopedRepository, claims);

  const validationStatus =
    sourceBoundary.pageMatchesExpectation &&
    sourceBoundary.allRecordsPresentExactlyOnce &&
    sourceBoundary.allExtractionStatesMatch &&
    sourceBoundary.allManualPayloadsMatch &&
    sourceBoundary.allRepositoryPayloadsMatch &&
    sourceBoundary.allRepositoryRecommendationsMatchManual &&
    sourceBoundary.allRepositoryStatesMatch &&
    sourceBoundary.allRepositoryPagesMatch &&
    baselineBoundary.allChecksMatch &&
    publishedTeamBoundary.allTargetsMatchExpectation &&
    sourceConditionBoundary.allSourceConditionsMappedExactly &&
    keqingLunarEvidenceClaimSafetyPermitsComparability({
      buildGameplayAndRefinementConditionsRemainUnresolved:
        sourceConditionBoundary
          .buildGameplayAndRefinementConditionsRemainUnresolved,
      sourceRefinementsInferred:
        searchCoverageBoundary.sourceRefinementsInferred,
    }) &&
    baselineComparison.defaultMainStatCoverage
      .allBaselineMainStatsCoveredBySourceObservation &&
    baselineComparison.generalWeapon.exactStructuralMatch &&
    baselineComparison.baselineArtifact.sourceListsBaselineArtifact &&
    searchCoverageBoundary.allEquipmentClaimsHaveExactlyOneCoverageReference &&
    searchCoverageBoundary.allWeaponIdsInReleasedCandidateDomain &&
    searchCoverageBoundary.allWeaponNativeTypesCompatible
      ? "comparable"
      : "not-comparable";

  return {
    schemaVersion: 1,
    classification:
      "keqing-lunar-equipment-evidence-structural-validation",
    validationStatus,
    supportsGuideClaims: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsConditionApplicabilityClaims: false,
    supportsDamageClaims: false,
    supportsEnergyRecoveryClaims: false,
    candidateGenerationInput: false,
    candidateGenerationExecuted: false,
    damageOrRankingComputationExecuted: false,
    energyRecoveryInputsUsed: false,
    generatedFrom: generatedFrom
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    semanticScope: compactSemanticScopeAudit(authenticatedScope.audit),
    sourceBoundary,
    baselineBoundary,
    publishedTeamBoundary,
    sourceConditionBoundary,
    searchCoverageBoundary,
    baselineComparison,
    claims,
    cautions: [
      "A matched condition means only that exact published team data exposes the required roster or declared-reaction fact; it is not computed equipment applicability or gameplay validation.",
      "The wrapper-authored condition map acknowledges exact source prose and deliberately withholds build, gameplay, timing, refinement, and threshold conditions.",
      "Search coverage proves only that the current released analyzer policy can name an observed weapon or artifact choice; it does not prove suitability, generation success, or damage performance.",
      "Source ordering, ties, classifications, and stat priorities are retained as validation targets and are not endorsed or recomputed by this report.",
      "V1 recommendation ordering is record-local; no cross-record ordering between the Other 5-star CRIT options and Mistsplitter is represented or inferred.",
      "V1 cannot encode only Splendor of Tranquil Waters as worst within its five-option group or only the 2pc Marechaussee Hunter mixed combinations as weakest without over-ranking sibling alternatives; both remain explicit source-fidelity gaps, not report ranks.",
      "The GenshinTools baseline is an independent comparison seed; this report never combines it with candidate KQM equipment evidence.",
      "No Energy Recharge field, threshold, computation, or interpretation participates in this checkpoint.",
    ],
    prohibitedInterpretations: [
      "computed-applicability",
      "generated-build",
      "equipment-recommendation",
      "stat-recommendation",
      "source-rank-validation",
      "damage-result",
      "winner",
      "global-optimum",
      "energy-requirement",
    ],
  };
}

function compactSemanticScopeAudit(
  audit: ScopedSemanticDependencyAcceptedAudit,
): KeqingLunarEquipmentSemanticScopeAudit {
  return {
    status: audit.status,
    trust: audit.trust,
    scopeId: audit.scopeId,
    manifestSha256: audit.selector.manifestSha256,
    scopeProjectionSha256: audit.scopeProjectionSha256,
    dependencies: audit.dependencies.map(
      ({
        dependencyId,
        selectedEntries,
        selectedKeySetSha256,
        selectedPayloadSha256,
      }) => ({
        dependencyId,
        selectedCount: selectedEntries.length,
        selectedKeySetSha256,
        selectedPayloadSha256,
      }),
    ),
    parity: {
      configuredCount: audit.parities.length,
      exactCount: audit.parities.filter(({ status }) => status === "exact").length,
      parityIdsSha256: sha256Text(
        stableJson(audit.parities.map(({ parityId }) => parityId)),
      ),
      normalizedPairsSha256: sha256Text(
        stableJson(
          audit.parities.map(
            ({
              parityId,
              leftNormalizedSha256,
              rightNormalizedSha256,
              status,
            }) => ({
              parityId,
              leftNormalizedSha256,
              rightNormalizedSha256,
              status,
            }),
          ),
        ),
      ),
    },
  };
}

function buildSourceBoundary(
  repository: ValidatorOnlyKnowledgeRecordCarrier,
  snapshot: ManualObservationSnapshot,
): KeqingLunarEquipmentEvidenceValidationReport["sourceBoundary"] {
  const records = KEQING_LUNAR_EQUIPMENT_EVIDENCE_RECORD_SOURCE_IDS.map(
    (sourceRecordId) => {
      const manualMatches = snapshot.records.filter(
        (record): record is ManualCharacterGuide =>
          record.kind === "character_guide" &&
          record.sourceRecordId === sourceRecordId,
      );
      const repositoryRecordId = `kqm:character-guide:${sourceRecordId}`;
      const repositoryMatches = repository.records.filter(
        (record): record is KnowledgeCharacterGuide =>
          record.kind === "character_guide" && record.id === repositoryRecordId,
      );
      const manualRecord = manualMatches.length === 1 ? manualMatches[0] : null;
      const repositoryRecord =
        repositoryMatches.length === 1 ? repositoryMatches[0] : null;
      const manualPayloadSha256 = manualRecord
        ? sha256Text(stableJson(manualRecord))
        : null;
      const expectedManualPayloadSha256 =
        EXPECTED_MANUAL_RECORD_PAYLOAD_SHA256[sourceRecordId];
      const repositoryPayloadSha256 = repositoryRecord
        ? sha256Text(stableJson(repositoryRecord))
        : null;
      const expectedRepositoryPayloadSha256 =
        EXPECTED_REPOSITORY_RECORD_PAYLOAD_SHA256[sourceRecordId];
      return {
        sourceRecordId,
        repositoryRecordId,
        manualOccurrenceCount: manualMatches.length,
        repositoryOccurrenceCount: repositoryMatches.length,
        extractionMethod: manualRecord?.extraction.method ?? null,
        reviewStatus: manualRecord?.extraction.reviewStatus ?? null,
        manualPayloadSha256,
        expectedManualPayloadSha256,
        manualPayloadMatchesExpectation:
          manualPayloadSha256 === expectedManualPayloadSha256,
        repositoryPayloadSha256,
        expectedRepositoryPayloadSha256,
        repositoryPayloadMatchesExpectation:
          repositoryPayloadSha256 === expectedRepositoryPayloadSha256,
        repositoryRecommendationMatchesManual:
          manualRecord != null &&
          repositoryRecord != null &&
          repositoryRecord.recommendations?.length === 1 &&
          stableJson(repositoryRecord.recommendations[0]) ===
            stableJson(manualRecord.recommendation),
        repositoryStateMatchesExpectation:
          repositoryRecord?.status === "candidate" &&
          repositoryRecord.promotionEligible === false &&
          repositoryRecord.characterId === "keqing" &&
          repositoryRecord.builds.length === 0 &&
          repositoryRecord.weaponOrder == null,
        repositoryUsesExactPage:
          repositoryRecord != null &&
          repositoryRecord.sourceRefs.length > 0 &&
          repositoryRecord.sourceRefs.every(
            ({ sourceId, locator }) =>
              sourceId === "kqm" &&
              "url" in locator &&
              locator.url === KEQING_ROLE_PAIR_PAGE_URL,
          ),
      };
    },
  );
  return {
    sourceId: "kqm",
    expectedPage: { ...EXPECTED_PAGE },
    observedPage: { ...snapshot.page },
    expectedCapturedAt: EXPECTED_CAPTURED_AT,
    observedCapturedAt: snapshot.capturedAt,
    pageMatchesExpectation:
      snapshot.sourceId === "kqm" &&
      snapshot.capturedAt === EXPECTED_CAPTURED_AT &&
      stableJson(snapshot.page) === stableJson(EXPECTED_PAGE),
    expectedParticipatingRecordCount: 17,
    observedParticipatingRecordCount: snapshot.records.length,
    records,
    allRecordsPresentExactlyOnce: records.every(
      ({ manualOccurrenceCount, repositoryOccurrenceCount }) =>
        manualOccurrenceCount === 1 && repositoryOccurrenceCount === 1,
    ),
    allExtractionStatesMatch: records.every(
      ({ extractionMethod, reviewStatus }) =>
        extractionMethod === "agent-assisted" && reviewStatus === "unreviewed",
    ),
    allManualPayloadsMatch: records.every(
      ({ manualPayloadMatchesExpectation }) => manualPayloadMatchesExpectation,
    ),
    allRepositoryPayloadsMatch: records.every(
      ({ repositoryPayloadMatchesExpectation }) =>
        repositoryPayloadMatchesExpectation,
    ),
    allRepositoryRecommendationsMatchManual: records.every(
      ({ repositoryRecommendationMatchesManual }) =>
        repositoryRecommendationMatchesManual,
    ),
    allRepositoryStatesMatch: records.every(
      ({ repositoryStateMatchesExpectation }) =>
        repositoryStateMatchesExpectation,
    ),
    allRepositoryPagesMatch: records.every(
      ({ repositoryUsesExactPage }) => repositoryUsesExactPage,
    ),
  };
}

function buildBaselineBoundary(
  repository: ValidatorOnlyKnowledgeRecordCarrier,
): KeqingLunarEquipmentEvidenceValidationReport["baselineBoundary"] {
  const guides = repository.records.filter(
    (record): record is KnowledgeCharacterGuide =>
      record.kind === "character_guide" && record.id === BASELINE_GUIDE_ID,
  );
  const guide = guides.length === 1 ? guides[0] : null;
  const builds =
    guide?.builds.filter(
      ({ sourceRecordId }) =>
        sourceRecordId === BASELINE_BUILD_SOURCE_RECORD_ID,
    ) ?? [];
  const build = builds.length === 1 ? builds[0] : null;
  const boundary = {
    guideId: BASELINE_GUIDE_ID,
    expectedStatus: "baseline" as const,
    buildSourceRecordId: BASELINE_BUILD_SOURCE_RECORD_ID,
    expectedWeaponOrder: ["mistsplitter_reforged"] as [
      "mistsplitter_reforged",
    ],
    guidePresentExactlyOnce: guides.length === 1,
    guideStatusMatches: guide?.status === "baseline",
    characterMatches: guide?.characterId === "keqing",
    weaponOrderMatchesExactly:
      stableJson(guide?.weaponOrder ?? null) ===
      stableJson(["mistsplitter_reforged"]),
    buildPresentExactlyOnce: builds.length === 1,
    buildPayloadMatchesExactly:
      build != null && stableJson(build) === stableJson(EXPECTED_BASELINE_BUILD),
    allChecksMatch: false,
  };
  boundary.allChecksMatch =
    boundary.guidePresentExactlyOnce &&
    boundary.guideStatusMatches &&
    boundary.characterMatches &&
    boundary.weaponOrderMatchesExactly &&
    boundary.buildPresentExactlyOnce &&
    boundary.buildPayloadMatchesExactly;
  return boundary;
}

function buildBaselineComparison(
  repository: ValidatorOnlyKnowledgeRecordCarrier,
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
): KeqingLunarEquipmentEvidenceValidationReport["baselineComparison"] {
  const baselineGuide = requiredUniqueCharacterGuide(
    repository,
    BASELINE_GUIDE_ID,
  );
  const baselineBuilds = baselineGuide.builds.filter(
    ({ sourceRecordId }) =>
      sourceRecordId === BASELINE_BUILD_SOURCE_RECORD_ID,
  );
  if (baselineBuilds.length !== 1) {
    throw new Error(
      `Expected exactly one baseline build ${BASELINE_BUILD_SOURCE_RECORD_ID}, found ${baselineBuilds.length}.`,
    );
  }
  const baselineBuild = baselineBuilds[0];

  const defaultStatsRecordId =
    "keqing-lunar-charged-default-artifact-stats-luna-i" as const;
  const highBuffRecordId =
    "keqing-lunar-charged-high-buff-goblet-stats-luna-i" as const;
  const generalMistsplitterRecordId =
    "keqing-lunar-charged-general-mistsplitter-luna-i" as const;
  const topContributorArtifactRecordId =
    "keqing-lunar-charged-top-contributor-artifact-options-luna-i" as const;
  const traditionalArtifactRecordId =
    "keqing-lunar-charged-traditional-artifact-options-luna-i" as const;

  const defaultStatsClaims = claims.filter(
    ({ sourceRecordId }) => sourceRecordId === defaultStatsRecordId,
  );
  const mainStatCoverage = (
    slot: "sands" | "goblet" | "circlet",
    baselineStatIds: readonly string[],
  ): BaselineMainStatCoverage => {
    const slotClaims = defaultStatsClaims.filter(
      ({ sourceClaim }) =>
        sourceClaim.kind === "main-stat" && sourceClaim.slot === slot,
    );
    const sourceObservedStatIds = uniqueSortedStrings(
      slotClaims.flatMap(({ sourceClaim }) =>
        sourceClaim.kind === "main-stat" ? sourceClaim.statIds : [],
      ),
    );
    const sourceConditionalStatIds = uniqueSortedStrings(
      slotClaims.flatMap(({ sourceClaim, sourceConditions }) =>
        sourceClaim.kind === "main-stat" &&
        sourceConditions.some(
          (condition) =>
            condition !==
            KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.lunarCharged,
        )
          ? sourceClaim.statIds
          : [],
      ),
    );
    return {
      baselineStatIds: [...baselineStatIds],
      sourceObservedStatIds,
      sourceConditionalStatIds,
      allBaselineStatIdsCovered: baselineStatIds.every((statId) =>
        sourceObservedStatIds.includes(statId),
      ),
    };
  };
  const sands = mainStatCoverage(
    "sands",
    baselineBuild.sands.map(({ stat }) => stat),
  );
  const goblet = mainStatCoverage(
    "goblet",
    baselineBuild.goblet.map(({ stat }) => stat),
  );
  const circlet = mainStatCoverage(
    "circlet",
    baselineBuild.circlet.map(({ stat }) => stat),
  );

  const highBuffGobletClaims = claims.filter(
    ({ sourceRecordId, sourceClaim }) =>
      sourceRecordId === highBuffRecordId &&
      sourceClaim.kind === "main-stat" &&
      sourceClaim.slot === "goblet",
  );
  const sourceIncludesAtkGoblet = highBuffGobletClaims.some(
    ({ sourceClaim }) =>
      sourceClaim.kind === "main-stat" &&
      sourceClaim.statIds.includes("atk%"),
  );

  const defaultSubstatClaims = defaultStatsClaims.filter(
    ({ sourceClaim }) => sourceClaim.kind === "substat",
  );
  const sourcePriorityGroups = defaultSubstatClaims
    .slice()
    .sort((left, right) => {
      const leftPriority =
        left.sourceClaim.kind === "substat"
          ? (left.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER;
      const rightPriority =
        right.sourceClaim.kind === "substat"
          ? (right.sourceClaim.priority ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority || compareText(left.claimId, right.claimId);
    })
    .map(({ sourceClaim }) =>
      sourceClaim.kind === "substat" ? [...sourceClaim.statIds] : [],
    );
  const baselinePriorityGroups = groupStatsByDescendingWeight(
    baselineBuild.substats,
  );
  const sharedStatIds = uniqueSortedStrings(
    baselineBuild.substats
      .map(({ stat }) => stat)
      .filter((statId) =>
        sourcePriorityGroups.some((group) => group.includes(statId)),
      ),
  );

  const generalWeaponClaims = claims.filter(
    ({ sourceRecordId, sourceClaim }) =>
      sourceRecordId === generalMistsplitterRecordId &&
      sourceClaim.kind === "weapon",
  );
  const sourceWeaponIds = generalWeaponClaims.map(({ sourceClaim }) => {
    if (sourceClaim.kind !== "weapon") {
      throw new Error("Unexpected non-weapon Mistsplitter claim.");
    }
    return sourceClaim.weaponId;
  });
  const baselineWeaponOrder = [...(baselineGuide.weaponOrder ?? [])];

  const topContributorArtifactClaims = claims.filter(
    ({ sourceRecordId, sourceClaim }) =>
      sourceRecordId === topContributorArtifactRecordId &&
      sourceClaim.kind === "artifact",
  );
  const baselineArtifactClaim = topContributorArtifactClaims.find(
    ({ sourceClaim }) =>
      sourceClaim.kind === "artifact" &&
      sourceClaim.artifact.type === "4pc" &&
      sourceClaim.artifact.setId === "thundering_fury",
  );
  const traditionalArtifactClaims = claims.filter(
    ({ sourceRecordId, sourceClaim }) =>
      sourceRecordId === traditionalArtifactRecordId &&
      sourceClaim.kind === "artifact",
  );

  return {
    classification: "structural-source-vs-baseline-observations",
    candidateSourceRecordsUsedAsGenerationInputs: false,
    comparisonProducesRecommendationOrRank: false,
    defaultMainStatCoverage: {
      sourceRecordId: defaultStatsRecordId,
      baselineBuildSourceRecordId: BASELINE_BUILD_SOURCE_RECORD_ID,
      sands,
      goblet,
      circlet,
      allBaselineMainStatsCoveredBySourceObservation:
        sands.allBaselineStatIdsCovered &&
        goblet.allBaselineStatIdsCovered &&
        circlet.allBaselineStatIdsCovered,
    },
    conditionalAtkGoblet: {
      sourceRecordId: highBuffRecordId,
      sourceCondition: KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS.highBuff,
      sourceIncludesAtkGoblet,
      baselineIncludesAtkGoblet: baselineBuild.goblet.some(
        ({ stat }) => stat === "atk%",
      ),
      relation: "not-established-by-baseline",
    },
    substatPriority: {
      sourceRecordId: defaultStatsRecordId,
      baselinePriorityGroups,
      sourcePriorityGroups,
      sharedStatIds,
      relation: "explicit-partial-order-disagreement",
      disagreements: [
        {
          higherStatId: "atk%",
          lowerStatId: "em",
          baselineRelation: "tied",
          sourceRelation: "higher-priority",
        },
      ],
      interpretedAsValidationError: false,
    },
    generalWeapon: {
      sourceRecordId: generalMistsplitterRecordId,
      baselineWeaponOrder,
      sourceWeaponIds,
      exactStructuralMatch:
        stableJson(baselineWeaponOrder) === stableJson(sourceWeaponIds),
    },
    baselineArtifact: {
      baselineArtifact: { type: "4pc", setId: "thundering_fury" },
      sourceRecordId: topContributorArtifactRecordId,
      sourceListsBaselineArtifact: baselineArtifactClaim != null,
      sourceConditionResolutionAcrossTargets:
        baselineArtifactClaim?.teamResolutions.map(({ resolution }) =>
          resolution,
        ) ?? [],
      relation:
        "source-observed-only-under-unresolved-top-contributor-condition",
      traditionalSourceRecordId: traditionalArtifactRecordId,
      sourceTraditionalRecordListsBaselineArtifact:
        traditionalArtifactClaims.some(
          ({ sourceClaim }) =>
            sourceClaim.kind === "artifact" &&
            sourceClaim.artifact.type === "4pc" &&
            sourceClaim.artifact.setId === "thundering_fury",
        ),
      authoredTraditionalMappingInstalled: false,
      directContradictionClaimed: false,
    },
  };
}

function groupStatsByDescendingWeight(
  stats: readonly { stat: string; weight: number }[],
): string[][] {
  const byWeight = new Map<number, string[]>();
  for (const { stat, weight } of stats) {
    const group = byWeight.get(weight) ?? [];
    group.push(stat);
    byWeight.set(weight, group);
  }
  return [...byWeight.entries()]
    .sort(([leftWeight], [rightWeight]) => rightWeight - leftWeight)
    .map(([, statIds]) => statIds);
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function buildTargetContext(
  repository: ValidatorOnlyKnowledgeRecordCarrier,
  teamRecordId: string,
  environment: ValidationEnvironment,
): TargetTeamContext {
  const matches = repository.records.filter(
    (record): record is KnowledgeTeam =>
      record.kind === "team" && record.id === teamRecordId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Keqing Lunar equipment validation expected exactly one ${teamRecordId}, found ${matches.length}.`,
    );
  }
  const team = matches[0];
  const characterIds = team.members.map(({ characterId }) => characterId);
  const nodKraiCharacterIds = characterIds.filter(
    (characterId) =>
      environment.characterFacts[characterId]?.region === "Nod-Krai",
  );
  const expectedRoster = EXPECTED_TEAM_ROSTERS[teamRecordId];
  const expectedNodKraiRoster = EXPECTED_TEAM_NOD_KRAI_ROSTERS[teamRecordId];
  if (!expectedRoster) {
    throw new Error(`No expected roster is configured for ${teamRecordId}.`);
  }
  if (!expectedNodKraiRoster) {
    throw new Error(
      `No expected Nod-Krai roster is configured for ${teamRecordId}.`,
    );
  }
  const sourcePageMatches =
    team.sourceRefs.length > 0 &&
    team.sourceRefs.every(
      ({ sourceId, locator }) =>
        sourceId === "kqm" &&
        "url" in locator &&
        locator.url === KEQING_ROLE_PAIR_PAGE_URL,
    );
  const containsIneffa = characterIds.includes("ineffa");
  const containsAino = characterIds.includes("aino");
  const containsKeqing = characterIds.includes("keqing");
  const recordsLunarCharged =
    team.reactions?.includes("lunarCharged") ?? false;
  const declaredLunarChargedFactsMatch =
    containsKeqing && recordsLunarCharged;
  const allInvestmentsUnspecified = team.members.every(
    ({ investment }) => investment.status === "unspecified",
  );
  const allEquipmentUnselected = team.members.every(
    ({ selectedArtifact, selectedWeapon }) =>
      selectedArtifact == null && selectedWeapon == null,
  );
  const matchesExpectedBoundary =
    sameStrings(characterIds, expectedRoster) &&
    sameStrings(nodKraiCharacterIds, expectedNodKraiRoster) &&
    team.status === "candidate" &&
    team.promotionEligible === false &&
    team.intent === "example" &&
    team.rankingClaim === "none" &&
    declaredLunarChargedFactsMatch &&
    containsIneffa &&
    allInvestmentsUnspecified &&
    allEquipmentUnselected &&
    sourcePageMatches;
  return {
    teamRecordId,
    characterIds,
    nodKraiCharacterIds,
    nodKraiCharacterCount: nodKraiCharacterIds.length,
    containsFurina: characterIds.includes("furina"),
    containsAino,
    containsIneffa,
    containsKeqing,
    recordsLunarCharged,
    declaredLunarChargedFactsMatch,
    allInvestmentsUnspecified,
    allEquipmentUnselected,
    sourceStatus: team.status,
    promotionEligible: team.promotionEligible ?? null,
    intent: team.intent ?? null,
    rankingClaim: team.rankingClaim ?? null,
    sourcePageMatches,
    matchesExpectedBoundary,
  };
}

function extractClaims(
  sourceRecordId: ParticipatingSourceRecordId,
  guide: KnowledgeCharacterGuide,
  recommendation: GuideRecommendation,
  targets: readonly TargetTeamContext[],
  artifactCoverage: readonly ArtifactChoiceSearchCoverageObservation[],
  weaponCoverage: readonly WeaponChoiceSearchCoverageObservation[],
): KeqingLunarEquipmentEvidenceClaim[] {
  const common = {
    repositoryRecordId: guide.id,
    sourceRecordId,
    recommendationId: recommendation.id,
    recommendationScope: recommendation.scope,
    roles: [...recommendation.roles],
    conditionMappingKind:
      "wrapper-authored-exact-text-acknowledgement" as const,
  };
  const claims: KeqingLunarEquipmentEvidenceClaim[] = [];

  for (const [groupIndex, group] of (
    recommendation.weaponRecommendations ?? []
  ).entries()) {
    for (const [weaponIndex, weaponId] of group.weaponIds.entries()) {
      const sourceConditions = [...group.conditions];
      const sourceClaim: SourceClaim = {
        kind: "weapon",
        recommendationOrdering: recommendation.weaponOrdering ?? null,
        groupIndex,
        weaponIndex,
        weaponId,
        grouping: group.grouping,
        classification: group.classification,
      };
      claims.push({
        ...common,
        claimId: `${guide.id}:weapon:${groupIndex}:${weaponIndex}`,
        sourceClaim,
        sourceConditions,
        allSourceConditionsMappedExactly: sourceConditions.every(
          (condition) => conditionPredicateId(condition) != null,
        ),
        searchCoverage: requiredWeaponCoverage(
          guide.id,
          recommendation.id,
          groupIndex,
          weaponIndex,
          weaponCoverage,
        ),
        teamResolutions: targets.map((target) =>
          resolveClaimForTarget(sourceConditions, target),
        ),
      });
    }
  }

  for (const [groupIndex, group] of (
    recommendation.artifactRecommendations ?? []
  ).entries()) {
    for (const [artifactIndex, artifact] of group.artifacts.entries()) {
      const sourceConditions = [...group.conditions];
      const sourceClaim: SourceClaim = {
        kind: "artifact",
        recommendationOrdering: recommendation.artifactOrdering ?? null,
        groupIndex,
        artifactIndex,
        artifact: cloneArtifact(artifact),
        grouping: group.grouping,
        classification: group.classification,
      };
      claims.push({
        ...common,
        claimId: `${guide.id}:artifact:${groupIndex}:${artifactIndex}`,
        sourceClaim,
        sourceConditions,
        allSourceConditionsMappedExactly: sourceConditions.every(
          (condition) => conditionPredicateId(condition) != null,
        ),
        searchCoverage: requiredArtifactCoverage(
          guide.id,
          recommendation.id,
          groupIndex,
          artifactIndex,
          artifactCoverage,
        ),
        teamResolutions: targets.map((target) =>
          resolveClaimForTarget(sourceConditions, target),
        ),
      });
    }
  }

  for (const slot of ["sands", "goblet", "circlet"] as const) {
    for (const [entryIndex, entry] of (
      recommendation.mainStats?.[slot] ?? []
    ).entries()) {
      const sourceConditions = [...entry.conditions];
      claims.push({
        ...common,
        claimId: `${guide.id}:main-stat:${slot}:${entryIndex}`,
        sourceClaim: {
          kind: "main-stat",
          slot,
          entryIndex,
          statIds: [...entry.statIds],
          priority: entry.priority ?? null,
          target: entry.target ?? null,
        },
        sourceConditions,
        allSourceConditionsMappedExactly: sourceConditions.every(
          (condition) => conditionPredicateId(condition) != null,
        ),
        searchCoverage: { kind: "not-an-equipment-search-candidate" },
        teamResolutions: targets.map((target) =>
          resolveClaimForTarget(sourceConditions, target),
        ),
      });
    }
  }

  for (const [entryIndex, entry] of (
    recommendation.substats ?? []
  ).entries()) {
    const sourceConditions = [...entry.conditions];
    claims.push({
      ...common,
      claimId: `${guide.id}:substat:${entryIndex}`,
      sourceClaim: {
        kind: "substat",
        entryIndex,
        statIds: [...entry.statIds],
        priority: entry.priority ?? null,
        target: entry.target ?? null,
      },
      sourceConditions,
      allSourceConditionsMappedExactly: sourceConditions.every(
        (condition) => conditionPredicateId(condition) != null,
      ),
      searchCoverage: { kind: "not-an-equipment-search-candidate" },
      teamResolutions: targets.map((target) =>
        resolveClaimForTarget(sourceConditions, target),
      ),
    });
  }

  return claims;
}

function requiredWeaponCoverage(
  recordId: string,
  recommendationId: string,
  groupIndex: number,
  weaponIndex: number,
  observations: readonly WeaponChoiceSearchCoverageObservation[],
): WeaponSearchCoverageReference {
  const matches = observations.filter(
    (observation) =>
      observation.sourceKind === "character-guide-recommendation" &&
      observation.recordId === recordId &&
      observation.recommendationId === recommendationId &&
      observation.recommendationGroupIndex === groupIndex &&
      observation.weaponIndex === weaponIndex,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one weapon coverage observation for ${recordId}/${recommendationId}/${groupIndex}/${weaponIndex}, found ${matches.length}.`,
    );
  }
  const observation = matches[0];
  return {
    kind: "weapon-search-coverage",
    observationId: observation.observationId,
    weaponIdDomainOutcome: observation.weaponIdDomain.outcome,
    candidateRefinements: [...observation.weaponIdDomain.candidateRefinements],
    refinementCoverageOutcome: observation.refinementCoverage.outcome,
    nativeTypeCompatibilityOutcome:
      observation.nativeTypeCompatibility.outcome,
  };
}

function requiredArtifactCoverage(
  recordId: string,
  recommendationId: string,
  groupIndex: number,
  artifactIndex: number,
  observations: readonly ArtifactChoiceSearchCoverageObservation[],
): ArtifactSearchCoverageReference {
  const matches = observations.filter(
    (observation) =>
      observation.sourceKind === "character-guide-recommendation" &&
      observation.recordId === recordId &&
      observation.sourceRecordId === recommendationId &&
      observation.recommendationGroupIndex === groupIndex &&
      observation.artifactIndex === artifactIndex,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected one artifact coverage observation for ${recordId}/${recommendationId}/${groupIndex}/${artifactIndex}, found ${matches.length}.`,
    );
  }
  const observation = matches[0];
  return {
    kind: "artifact-search-coverage",
    observationId: observation.observationId,
    outcome: observation.outcome,
    failureReason: observation.failureReason ?? null,
  };
}

function resolveClaimForTarget(
  conditions: readonly string[],
  target: TargetTeamContext,
): ClaimTeamResolution {
  const conditionAcknowledgements = conditions.map((condition, index) => {
    const predicateId = conditionPredicateId(condition);
    if (predicateId == null) {
      return {
        conditionIndex: index,
        predicateId: null,
        resolution: "withheld-unresolved-source-condition" as const,
        reason:
          "The exact source condition has no wrapper-authored mapping; no prose parsing or inferred applicability is allowed.",
      };
    }
    const evaluation = evaluateConditionPredicate(predicateId, target);
    return {
      conditionIndex: index,
      predicateId,
      ...evaluation,
    };
  });
  const resolution = conditionAcknowledgements.some(
    (condition) =>
      condition.resolution === "not-matched-by-exact-team-facts",
  )
    ? ("not-matched-by-exact-team-facts" as const)
    : conditionAcknowledgements.some(
          (condition) =>
            condition.resolution === "withheld-unresolved-source-condition",
        )
      ? ("withheld-unresolved-source-condition" as const)
      : ("matched-by-exact-team-facts" as const);
  return {
    teamRecordId: target.teamRecordId,
    resolution,
    conditionAcknowledgements,
  };
}

function conditionPredicateId(
  condition: string,
): ConditionPredicateId | null {
  const conditions = KEQING_LUNAR_EQUIPMENT_SOURCE_CONDITIONS;
  const mapping: Record<SourceCondition, ConditionPredicateId> = {
    [conditions.lunarCharged]:
      "roster-contains-keqing-and-declares-lunar-charged",
    [conditions.furina]: "roster-contains-furina",
    [conditions.exactlyOneNodKrai]:
      "roster-contains-exactly-one-nod-krai-character",
    [conditions.ainoTwoNodKrai]:
      "roster-contains-exactly-ineffa-and-aino-as-two-nod-krai-characters",
    [conditions.traditional]:
      "traditional-artifact-set-comparison-input-unavailable",
    [conditions.topLunarCharged]:
      "top-lunar-charged-contributor-and-non-crit-set-inputs-unavailable",
    [conditions.highBuff]:
      "weapon-base-atk-and-team-dmg-bonus-inputs-unavailable",
    [conditions.exceptionalElementalMastery]:
      "exceptional-elemental-mastery-threshold-unavailable",
    [conditions.ineffaShield]: "ineffa-shield-window-uptime-unavailable",
    [conditions.finaleR5]: "finale-refinement-input-unavailable",
    [conditions.finaleBondCleared]:
      "finale-bond-clearance-timing-unavailable",
    [conditions.equalRefinement]: "equal-refinement-input-unavailable",
    [conditions.critRateDoesNotOvercap]:
      "crit-rate-overcap-inputs-unavailable",
    [conditions.eshuFullShield]:
      "eshu-comparison-and-shield-uptime-inputs-unavailable",
    [conditions.harbingerOfDawn]:
      "harbinger-passive-and-artifact-inputs-unavailable",
    [conditions.noBetterWeapon]: "weapon-availability-order-input-unavailable",
  };
  return mapping[condition as SourceCondition] ?? null;
}

function evaluateConditionPredicate(
  predicateId: ConditionPredicateId,
  target: TargetTeamContext,
): Pick<SourceConditionAcknowledgement, "resolution" | "reason"> {
  if (predicateId === "roster-contains-keqing-and-declares-lunar-charged") {
    return target.declaredLunarChargedFactsMatch
      ? {
          resolution: "matched-by-exact-team-facts",
          reason:
            "The declared team roster contains Keqing and the team record declares Lunar-Charged; this does not validate role execution or gameplay.",
        }
      : {
          resolution: "not-matched-by-exact-team-facts",
          reason:
            "The declared team roster does not contain Keqing or the team record does not declare Lunar-Charged.",
        };
  }
  if (predicateId === "roster-contains-furina") {
    return target.containsFurina
      ? {
          resolution: "matched-by-exact-team-facts",
          reason: "The exact team roster contains Furina.",
        }
      : {
          resolution: "not-matched-by-exact-team-facts",
          reason: "The exact team roster does not contain Furina.",
        };
  }
  if (predicateId === "roster-contains-exactly-one-nod-krai-character") {
    return target.nodKraiCharacterCount === 1
      ? {
          resolution: "matched-by-exact-team-facts",
          reason: `The released character-region catalog identifies exactly one Nod-Krai roster member (${target.nodKraiCharacterIds.join(", ")}).`,
        }
      : {
          resolution: "not-matched-by-exact-team-facts",
          reason: `The released character-region catalog identifies ${target.nodKraiCharacterCount} Nod-Krai roster members (${target.nodKraiCharacterIds.join(", ")}).`,
        };
  }
  if (
    predicateId ===
    "roster-contains-exactly-ineffa-and-aino-as-two-nod-krai-characters"
  ) {
    const exactPair =
      target.nodKraiCharacterCount === 2 &&
      sameStrings(target.nodKraiCharacterIds, ["ineffa", "aino"]);
    return exactPair
      ? {
          resolution: "matched-by-exact-team-facts",
          reason:
            "The exact team roster and released region catalog identify Ineffa and Aino as its two Nod-Krai members.",
        }
      : {
          resolution: "not-matched-by-exact-team-facts",
          reason:
            "The exact team roster does not contain exactly Ineffa and Aino as its two Nod-Krai members.",
        };
  }
  if (predicateId === "harbinger-passive-and-artifact-inputs-unavailable") {
    return target.containsFurina
      ? {
          resolution: "not-matched-by-exact-team-facts",
          reason:
            "The exact roster contains Furina, contradicting one explicit part of the combined source condition; passive uptime and artifact choice are not evaluated.",
        }
      : {
          resolution: "withheld-unresolved-source-condition",
          reason:
            "Furina is absent, but Harbinger passive uptime and Keqing's artifact choice are not source-bound team facts.",
        };
  }
  return {
    resolution: "withheld-unresolved-source-condition",
    reason: unresolvedPredicateReason(predicateId),
  };
}

function unresolvedPredicateReason(predicateId: ConditionPredicateId): string {
  const reasons: Partial<Record<ConditionPredicateId, string>> = {
    "traditional-artifact-set-comparison-input-unavailable":
      "The exact team record does not bind Keqing to the source's traditional artifact-set comparison domain.",
    "top-lunar-charged-contributor-and-non-crit-set-inputs-unavailable":
      "Reaction ownership, contribution share, and Keqing's artifact choice are not computed or bound by the exact team record.",
    "weapon-base-atk-and-team-dmg-bonus-inputs-unavailable":
      "The exact team record binds neither Keqing's weapon nor a quantified team DMG Bonus threshold.",
    "exceptional-elemental-mastery-threshold-unavailable":
      "The exact team record supplies no Keqing stat sheet or source threshold for exceptional Elemental Mastery.",
    "ineffa-shield-window-uptime-unavailable":
      "Roster presence does not establish shield activation or coverage of the compared damage window.",
    "finale-refinement-input-unavailable":
      "The source recommendation schema does not bind Finale of the Deep to a structured refinement value.",
    "finale-bond-clearance-timing-unavailable":
      "Roster healing capability does not establish Bond of Life clearance for every Keqing combo.",
    "equal-refinement-input-unavailable":
      "The source recommendation schema does not bind compared weapons to structured refinement values.",
    "crit-rate-overcap-inputs-unavailable":
      "The exact team record contains no Keqing stat sheet or computed total CRIT Rate after character and artifact bonuses.",
    "eshu-comparison-and-shield-uptime-inputs-unavailable":
      "The source recommendation schema and exact team record do not establish the R5 Lion's Roar comparison input or full shield-passive uptime.",
    "weapon-availability-order-input-unavailable":
      "The exact team record contains no account weapon inventory or stronger-weapon availability ordering.",
  };
  return (
    reasons[predicateId] ??
    "This condition depends on build or gameplay inputs that the exact team record does not supply."
  );
}

function requiredUniqueCharacterGuide(
  repository: ValidatorOnlyKnowledgeRecordCarrier,
  guideId: string,
): KnowledgeCharacterGuide {
  const matches = repository.records.filter(
    (record): record is KnowledgeCharacterGuide =>
      record.kind === "character_guide" && record.id === guideId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one character guide ${guideId}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function requiredSingleRecommendation(
  guide: KnowledgeCharacterGuide,
): GuideRecommendation {
  const recommendations = guide.recommendations ?? [];
  if (recommendations.length !== 1) {
    throw new Error(
      `Expected exactly one recommendation in ${guide.id}, found ${recommendations.length}.`,
    );
  }
  return recommendations[0];
}

function requireUniqueClaimIds(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
): void {
  const seen = new Set<string>();
  for (const claim of claims) {
    if (seen.has(claim.claimId)) {
      throw new Error(`Duplicate Keqing equipment claim ID ${claim.claimId}.`);
    }
    seen.add(claim.claimId);
  }
}

export function deriveKeqingLunarEvidenceClaimSafety(
  claims: readonly KeqingLunarEquipmentEvidenceClaim[],
): KeqingLunarEvidenceClaimSafety {
  let gameplayBuildAndRefinementAcknowledgementCount = 0;
  let matchedGameplayBuildOrRefinementAcknowledgementCount = 0;
  const allowedRosterKnownFalseConjunctTeamIds: string[] = [];
  let unexpectedGameplayBuildOrRefinementResolutionCount = 0;

  for (const claim of claims) {
    for (const {
      conditionAcknowledgements,
      teamRecordId,
    } of claim.teamResolutions) {
      for (const acknowledgement of conditionAcknowledgements) {
        if (
          acknowledgement.predicateId == null ||
          isRosterFactPredicate(acknowledgement.predicateId)
        ) {
          continue;
        }
        gameplayBuildAndRefinementAcknowledgementCount += 1;
        if (acknowledgement.resolution === "matched-by-exact-team-facts") {
          matchedGameplayBuildOrRefinementAcknowledgementCount += 1;
          unexpectedGameplayBuildOrRefinementResolutionCount += 1;
          continue;
        }
        if (
          acknowledgement.resolution ===
            "not-matched-by-exact-team-facts" &&
          acknowledgement.predicateId ===
            "harbinger-passive-and-artifact-inputs-unavailable" &&
          EXPECTED_HARBINGER_FURINA_FALSE_TARGET_TEAM_IDS.includes(
            teamRecordId as (typeof EXPECTED_HARBINGER_FURINA_FALSE_TARGET_TEAM_IDS)[number],
          )
        ) {
          allowedRosterKnownFalseConjunctTeamIds.push(teamRecordId);
          continue;
        }
        if (
          acknowledgement.resolution !==
          "withheld-unresolved-source-condition"
        ) {
          unexpectedGameplayBuildOrRefinementResolutionCount += 1;
        }
      }
    }
  }

  const sourceRefinementInferenceCount = claims.filter(
    ({ searchCoverage }) =>
      searchCoverage.kind === "weapon-search-coverage" &&
      searchCoverage.refinementCoverageOutcome !== "unspecified",
  ).length;
  allowedRosterKnownFalseConjunctTeamIds.sort(compareText);
  const expectedRosterKnownFalseConjunctTeamIds = [
    ...EXPECTED_HARBINGER_FURINA_FALSE_TARGET_TEAM_IDS,
  ].sort(compareText);
  const allowedRosterKnownFalseConjunctTeamsMatchExpectation = sameStrings(
    allowedRosterKnownFalseConjunctTeamIds,
    expectedRosterKnownFalseConjunctTeamIds,
  );
  return {
    gameplayBuildAndRefinementAcknowledgementCount,
    matchedGameplayBuildOrRefinementAcknowledgementCount,
    allowedRosterKnownFalseConjunctCount:
      allowedRosterKnownFalseConjunctTeamIds.length,
    allowedRosterKnownFalseConjunctTeamIds,
    expectedRosterKnownFalseConjunctTeamIds,
    allowedRosterKnownFalseConjunctTeamsMatchExpectation,
    unexpectedGameplayBuildOrRefinementResolutionCount,
    buildGameplayAndRefinementConditionsRemainUnresolved:
      matchedGameplayBuildOrRefinementAcknowledgementCount === 0 &&
      unexpectedGameplayBuildOrRefinementResolutionCount === 0 &&
      allowedRosterKnownFalseConjunctTeamsMatchExpectation,
    sourceRefinementInferenceCount,
    sourceRefinementsInferred: sourceRefinementInferenceCount > 0,
  };
}

export function keqingLunarEvidenceClaimSafetyPermitsComparability(
  safety: Pick<
    KeqingLunarEvidenceClaimSafety,
    | "buildGameplayAndRefinementConditionsRemainUnresolved"
    | "sourceRefinementsInferred"
  >,
): boolean {
  return (
    safety.buildGameplayAndRefinementConditionsRemainUnresolved &&
    !safety.sourceRefinementsInferred
  );
}

function isRosterFactPredicate(predicateId: ConditionPredicateId): boolean {
  return (
    predicateId === "roster-contains-keqing-and-declares-lunar-charged" ||
    predicateId === "roster-contains-furina" ||
    predicateId === "roster-contains-exactly-one-nod-krai-character" ||
    predicateId ===
      "roster-contains-exactly-ineffa-and-aino-as-two-nod-krai-characters"
  );
}

function cloneArtifact(
  artifact: ArtifactChoiceSearchCoverageObservation["artifact"],
): ArtifactChoiceSearchCoverageObservation["artifact"] {
  return artifact.type === "4pc"
    ? { type: "4pc", setId: artifact.setId }
    : {
        type: "2pc+2pc",
        halfSetIds: [artifact.halfSetIds[0], artifact.halfSetIds[1]],
      };
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
