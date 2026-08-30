import { sha256Text, stableJson } from "./io";
import type { DionaSourceLocalSupportSliceReport } from "./dionaSourceLocalSupportSlice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "./keqingLunarEquipmentEvidenceValidation";
import {
  KEQING_ROLE_PAIR_TARGET_TEAM_IDS,
  KEQING_ROLE_PAIR_VV_CONDITION,
  KEQING_SHRED_ROLE_RECORD_ID,
  type KeqingSourceScopedRolePairSampleReport,
} from "./keqingSourceScopedRolePairSample";
import type { KleeSourceLocalConditionSliceReport } from "./kleeSourceLocalConditionSlice";
import type { KokomiSourceLocalArtifactSliceReport } from "./kokomiSourceLocalArtifactSlice";
import type { NoelleSourceLocalHighInvestmentSliceReport } from "./noelleSourceLocalHighInvestmentSlice";
import type {
  SourceLocalConditionRequestPredicateAst,
  SourceLocalConditionSliceReport,
} from "./sourceLocalConditionSlice";
import type {
  SourceConditionedGuidePacketAuthentication,
  SourceConditionedGuidePacketReport,
  SourceConditionedClaimPayload,
  SourceConditionPredicateAst,
} from "./sourceConditionedGuidePacket";

export type CurrentConditionBindingClassification =
  | "typed-bound"
  | "exact-text-acknowledged"
  | "unbound"
  | "invalid";

export type CurrentConditionEnergyClassification =
  | "energy-unclassified"
  | "not-energy-deferred"
  | "structural-er"
  | "deferred-energy-prerequisite"
  | "exact-authored-energy-related-deferral";

export interface CurrentConditionArrayOccurrenceIdentity {
  sourceId: string;
  recordKind: "character_guide" | "character_role" | "team";
  sourceRecordId: string;
  manualClaimPath: string;
  conditionsSha256: string;
}

export type CurrentConditionBindingEvidence =
  | {
      kind: "itto-typed-predicate-ast";
      claimIds: string[];
      conditionMapKeys: string[];
      predicateAst: SourceConditionPredicateAst;
      predicateAstSha256: string;
    }
  | {
      kind: "keqing-equipment-typed-predicate-ids";
      atomicClaimIds: string[];
      predicateIds: string[];
      exactTeamResolutionEvidenceSha256: string;
    }
  | {
      kind: "keqing-role-exact-text-acknowledgement";
      characterId: string;
      roleRecordId: string;
      targetTeamIds: string[];
      targetIds: string[];
      acknowledgementCount: number;
    }
  | {
      kind: "source-local-typed-predicate-ast";
      sliceId: string;
      selectedOccurrenceId: string;
      selectedOccurrenceSha256: string;
      predicateAst: SourceConditionPredicateAst;
      predicateAstSha256: string;
      payloadSha256: string;
      occurrenceControlSha256: string;
    };

export type CurrentConditionEnergyEvidence =
  | {
      kind: "not-energy-deferred";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: false;
    }
  | {
      kind: "structural-er";
      structuralErEvidencePresent: true;
      energyRelatedWorkDeferred: true;
      evidenceIds: string[];
    }
  | {
      kind: "deferred-energy-prerequisite";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: true;
      reasons: string[];
    }
  | {
      kind: "exact-authored-energy-related-deferral";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: true;
      category: string;
      reason: string;
      occurrenceKey: string;
    }
  | {
      kind: "source-local-not-energy-deferred";
      structuralErEvidencePresent: false;
      energyRelatedWorkDeferred: false;
      sliceId: string;
      selectedOccurrenceId: string;
      selectedOccurrenceSha256: string;
    };

export interface CurrentConditionBindingCatalogEntry
  extends CurrentConditionArrayOccurrenceIdentity {
  occurrenceId: string;
  occurrenceKey: string;
  /** Expected manual extractor subject; closes same-hash role-member reorder leaks. */
  subject: string;
  orderedConditions: string[];
  bindingClassification: CurrentConditionBindingClassification;
  energyClassification: CurrentConditionEnergyClassification;
  typedBinding: boolean;
  bindingEvidence: CurrentConditionBindingEvidence;
  energyEvidence: CurrentConditionEnergyEvidence | null;
}

export interface AuthenticatedCurrentReportPair<T> {
  durableReport: unknown;
  currentReport: T;
}

export interface BuildCurrentConditionBindingCatalogInput {
  ittoAuthentication: SourceConditionedGuidePacketAuthentication;
  keqingEquipment: AuthenticatedCurrentReportPair<KeqingLunarEquipmentEvidenceValidationReport>;
  keqingRolePair: AuthenticatedCurrentReportPair<KeqingSourceScopedRolePairSampleReport>;
  kleeSourceLocal: AuthenticatedCurrentReportPair<KleeSourceLocalConditionSliceReport>;
  dionaSourceLocal: AuthenticatedCurrentReportPair<DionaSourceLocalSupportSliceReport>;
  kokomiSourceLocal: AuthenticatedCurrentReportPair<KokomiSourceLocalArtifactSliceReport>;
  noelleSourceLocal: AuthenticatedCurrentReportPair<NoelleSourceLocalHighInvestmentSliceReport>;
}

export interface CurrentConditionBindingCatalogIssue {
  code: string;
  path: string;
  message: string;
}

export interface CurrentConditionBindingCatalogReport {
  schemaVersion: 1;
  reportType: "authenticated-current-condition-binding-catalog";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "internal-validation-only";
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsEnergyRecoveryClaims: false;
  energyRecoveryComputationExecuted: false;
  authenticationBoundary: {
    ittoAuthenticated: boolean;
    keqingEquipmentDurableMatchesCurrent: boolean;
    keqingRolePairDurableMatchesCurrent: boolean;
    kleeSourceLocalDurableMatchesCurrent: boolean;
    dionaSourceLocalDurableMatchesCurrent: boolean;
    kokomiSourceLocalDurableMatchesCurrent: boolean;
    noelleSourceLocalDurableMatchesCurrent: boolean;
  };
  entries: CurrentConditionBindingCatalogEntry[];
  summary: {
    occurrenceCount: number;
    bindingClassificationCounts: Record<
      CurrentConditionBindingClassification,
      number
    >;
    energyClassificationCounts: Record<
      CurrentConditionEnergyClassification,
      number
    >;
    typedBindingCount: number;
    ittoOccurrenceCount: number;
    ittoTypedBindingCount: number;
    ittoDeferredEnergyPrerequisiteCount: number;
    keqingEquipmentOccurrenceCount: number;
    keqingEquipmentAtomicClaimCount: number;
    keqingVvAcknowledgedOccurrenceCount: number;
    keqingVvExactTextAcknowledgementCount: number;
    keqingVvUnacknowledgedSourceMemberIds: string[];
    kleeSourceLocalOccurrenceCount: number;
    kleeSourceLocalTypedBindingCount: number;
    kleeSourceLocalNotEnergyDeferredCount: number;
    dionaSourceLocalOccurrenceCount: number;
    dionaSourceLocalTypedBindingCount: number;
    dionaSourceLocalNotEnergyDeferredCount: number;
    kokomiSourceLocalOccurrenceCount: number;
    kokomiSourceLocalTypedBindingCount: number;
    kokomiSourceLocalNotEnergyDeferredCount: number;
    noelleSourceLocalOccurrenceCount: number;
    noelleSourceLocalTypedBindingCount: number;
    noelleSourceLocalNotEnergyDeferredCount: number;
  };
  issues: CurrentConditionBindingCatalogIssue[];
}

const ITTO_EXPERIMENT_ID = "itto-source-conditioned-guide-packets-v1";
const ITTO_EXPECTED_OCCURRENCE_COUNT = 15;
const ITTO_EXPECTED_DEFERRED_COUNT = 3;
const KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT = 42;
const KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT = 31;
const KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS = [
  "jean",
  "kaedehara_kazuha",
  "sucrose",
] as const;
const KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS = ["sayu", "xianyun"] as const;
const KEQING_SHRED_ROLE_SOURCE_RECORD_ID =
  "keqing-lunar-charged-resistance-shred-options";
const KLEE_SOURCE_LOCAL_SLICE_ID =
  "kqm-klee-source-local-condition-slice-luna-iv";
const KLEE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCE_IDS = [
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.circlet[0].conditions",
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[0].conditions",
  "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.sands[0].conditions",
  "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions",
] as const;
const DIONA_SOURCE_LOCAL_SLICE_ID =
  "kqm-diona-source-local-support-slice-luna-viii";
const DIONA_SOURCE_LOCAL_SOURCE_RECORD_ID =
  "c6-diona-mavuika-citlali-bennett-forward-melt";
const DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID =
  "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt";
const DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[0].artifactRecommendations[0].conditions",
    characterId: "diona",
    memberIndex: 0,
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[2].artifactRecommendations[0].conditions",
    characterId: "citlali",
    memberIndex: 2,
  },
  {
    occurrenceId:
      "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[3].artifactRecommendations[0].conditions",
    characterId: "bennett",
    memberIndex: 3,
  },
] as const;
const KOKOMI_SOURCE_LOCAL_SLICE_ID =
  "kqm-kokomi-source-local-artifact-slice-luna-v";
const KOKOMI_SOURCE_LOCAL_PAGE_URL =
  "https://keqingmains.com/q/kokomi-quickguide/";
const KOKOMI_SOURCE_LOCAL_SOURCE_VERSION = "Luna V";
const KOKOMI_SOURCE_LOCAL_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json";
const KOKOMI_SOURCE_LOCAL_SOURCE_RECORD_ID =
  "kokomi-ineffa-columbina-sucrose-lunar-charged-example";
const KOKOMI_SOURCE_LOCAL_REPOSITORY_RECORD_ID =
  "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example";
const KOKOMI_SOURCE_LOCAL_RAW_RECORD_IDS = [
  "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
  "kokomi-on-field-nod-krai-artifact-delegation-luna-v",
] as const;
const KOKOMI_SOURCE_LOCAL_SELECTED_OCCURRENCE_ID =
  "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[0].conditions";
const KOKOMI_SOURCE_LOCAL_SELECTED_CONDITIONS = [
  "For Kokomi in this exact Lunar-Charged example team.",
] as const;
const KOKOMI_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 =
  "a9c6d3b2681ecb2119368d210164542577464049656217eb1fcc296ff4fd2295";
const KOKOMI_SOURCE_LOCAL_SELECTED_PREDICATE = {
  type: "all",
  predicates: [
    {
      type: "exact-team-roster-includes",
      characterId: "sangonomiya_kokomi",
    },
    { type: "exact-team-roster-includes", characterId: "ineffa" },
    { type: "exact-team-roster-includes", characterId: "columbina" },
    { type: "exact-team-roster-includes", characterId: "sucrose" },
  ],
} as const satisfies SourceConditionPredicateAst;
const KOKOMI_SOURCE_LOCAL_SELECTED_PREDICATE_SHA256 =
  "2c60322cf3d1b6691dbde84bd5484364752c87bb18634bd9303fd6ec2e03dcda";
const KOKOMI_SOURCE_LOCAL_SELECTED_PAYLOAD = {
  type: "artifact-group",
  artifacts: [{ type: "4pc", setId: "oceanhued_clam" }],
} as const satisfies SourceConditionedClaimPayload;
const KOKOMI_SOURCE_LOCAL_SELECTED_PAYLOAD_SHA256 =
  "bfd412bb94e8e50e9deec6813ef5329eb71c656fdd1af64fc8b5a2243543e1a0";
const KOKOMI_SOURCE_LOCAL_EXPECTED_RECOMMENDATION = {
  recommendationId:
    "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations",
  scope: "team-member-artifact-sets",
  roles: [],
  ordering: "unranked",
  label: null,
  classification: "recommended",
  grouping: "single",
  sourceIndex: 0,
} as const;
const KOKOMI_SOURCE_LOCAL_EXPECTED_HOLDOUTS = [
  {
    occurrenceId:
      "kqm:character_guide:kokomi-on-field-nod-krai-artifact-delegation-luna-v:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "a2933a2e2f7adf74da82241024b08ef3cc933e97875a60ed24a995e23dff7300",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:artifactPlans[0].conditions",
    conditionsSha256:
      "2e7b7109ed56cdbdbe8106429ff4a37bf8a76c4af7a6a96c1f71f123fbc19320",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[1].conditions",
    conditionsSha256:
      "345334cc6648346f0746fcee75a300703ef38cbbf2c290e80d9e0bb3ddbf12e9",
  },
  {
    occurrenceId:
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[2].artifactRecommendations[0].conditions",
    conditionsSha256:
      "2b615a74c769bcf02abb64b35d64bf8baf94eefb23f5f9a6e3044b540184d50f",
  },
] as const;

const NOELLE_SOURCE_LOCAL_SLICE_ID =
  "kqm-noelle-source-local-high-investment-slice-luna-viii";
const NOELLE_SOURCE_LOCAL_PAGE_URL =
  "https://keqingmains.com/q/noelle-quickguide/";
const NOELLE_SOURCE_LOCAL_SOURCE_VERSION = "Luna VIII";
const NOELLE_SOURCE_LOCAL_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json";
const NOELLE_SOURCE_LOCAL_SNAPSHOT_SHA256 =
  "d6927fed20fc0f77e8f721e18b7c9f8db37009258ba5c582b7184fb16be558e0";
const NOELLE_SOURCE_LOCAL_GENERATED_FROM_SHA256 =
  "7307fb51f4b484c51f8c3b901e91baa685a1e32b8e1e79c457f3ef8ab64a73c1";
const NOELLE_SOURCE_LOCAL_RAW_INPUT_BOUNDARY_SHA256 =
  "3401c39d4b62ae7f24b39222907fbce19085160960d7dec591e36e02139dc2f7";
const NOELLE_SOURCE_LOCAL_COMPOSITION_POLICY_SHA256 =
  "86c4d35478d2aa167b5476a93bdf56ddfcf89324115d3b88374e4115f67cb7c6";
const NOELLE_SOURCE_LOCAL_REQUEST_CONTEXT_REPORT_SHA256 =
  "8a897d52c3cc12267065066cfdd8ad89f18186d16e7ea9210d86e78199a0613d";
const NOELLE_SOURCE_LOCAL_SOURCE_RECORD_ID =
  "noelle-c6-or-talent-10-artifact-stats-luna-viii";
const NOELLE_SOURCE_LOCAL_REPOSITORY_RECORD_ID =
  "kqm:character-guide:noelle-c6-or-talent-10-artifact-stats-luna-viii";
const NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID =
  "kqm:team:noelle-durin-nicole-xilonen-hexerei-example-luna-viii";
const NOELLE_SOURCE_LOCAL_RAW_RECORD_IDS = [
  "noelle-c0-c5-talent-9-artifact-stats-luna-viii",
  "noelle-c6-or-talent-10-artifact-stats-luna-viii",
  "noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
  "noelle-general-husk-luna-viii",
  "noelle-hexerei-gest-luna-viii",
] as const;
const NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS = [
  "Noelle is C6 or her Burst Talent is Level 10 or higher.",
] as const;
const NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 =
  "92f5c76c15a1f1ce2d172a8ac6a669ee17a26c3bb7749770379d3deed39d0cf4";
const NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE = {
  type: "unresolved-context",
  category: "investment-threshold",
  reason:
    "Noelle's constellation and Burst Talent level are not facts authored by the exact source team roster and must be supplied independently by the request context.",
} as const satisfies SourceConditionPredicateAst;
const NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 =
  "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a";
const NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE = {
  type: "any",
  predicates: [
    {
      type: "constellation-at-least",
      characterId: "noelle",
      threshold: 6,
    },
    {
      type: "talent-level-at-least",
      characterId: "noelle",
      talent: "burst",
      threshold: 10,
    },
  ],
} as const satisfies SourceLocalConditionRequestPredicateAst;
const NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE_SHA256 =
  "b93bfd12ebefae9aaae8434d4d316315a78fe6081698a73dd0ee047bcbbbc596";
const NOELLE_SOURCE_LOCAL_EXPECTED_RECOMMENDATION = {
  recommendationId: "c6-or-talent-10-artifact-stats",
  label: "C6 or Burst Talent Level 10+ artifact stats",
  scope: "artifact-stats",
  roles: ["dps"],
  ordering: null,
  classification: null,
  grouping: null,
  sourceIndex: 0,
} as const;
const NOELLE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions",
    manualClaimPath: "recommendation.mainStats.sands[0].conditions",
    repositoryPath: "recommendations[0].mainStats.sands[0].conditions",
    mainStatSlot: "sands",
    payload: {
      type: "main-stat",
      slot: "sands",
      statIds: ["def%"],
      target: null,
      priority: null,
    },
    payloadSha256:
      "804a06075305e59b97c800d1a8ba0fdfff51f9f5cbe37862d3f574721b38d53e",
    selectedObjectSha256:
      "665f593660b1c644c0711a4fa95de5dbc2074a144fd9100648fbc43563463f0b",
    claimObjectSha256:
      "12e0ca4fe5e6d5c15eccc3f552a71da2dffab5227ce27eff26ec899587982307",
    controlObjectSha256:
      "e6bb4067ded3b1a9e6fcdad4f0629cd919d8d34a1a139f7eac1b31ea041f5049",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions",
    manualClaimPath: "recommendation.mainStats.goblet[0].conditions",
    repositoryPath: "recommendations[0].mainStats.goblet[0].conditions",
    mainStatSlot: "goblet",
    payload: {
      type: "main-stat",
      slot: "goblet",
      statIds: ["geo%"],
      target: null,
      priority: null,
    },
    payloadSha256:
      "27b0565556c4d4cb4abe6c800046b0e1269484e769b15ce91ec7581ec6e9026a",
    selectedObjectSha256:
      "a32a578a42e7d22f141e9a90a4255e361c968c9043d159ff9a2de9ec4b64fc95",
    claimObjectSha256:
      "a752931a7c3a630b9966ba7999aecea7739cd5f644bb308d314bc162ab9ab086",
    controlObjectSha256:
      "c1f6163303261847941bf381693c17b8f2a4b0ba5c29520be87b56a4446b1f3a",
  },
  {
    occurrenceId:
      "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions",
    manualClaimPath: "recommendation.mainStats.circlet[0].conditions",
    repositoryPath: "recommendations[0].mainStats.circlet[0].conditions",
    mainStatSlot: "circlet",
    payload: {
      type: "main-stat",
      slot: "circlet",
      statIds: ["cr", "cd"],
      target: null,
      priority: null,
    },
    payloadSha256:
      "d227c8c1fb0defbc9cfba9365cea3a70d5ae13927f0f1438188c48dd5e437603",
    selectedObjectSha256:
      "9afd7187adad4a9ea1bf8e2ef3971fe650cb1ce2657c82e3a195e175771c9829",
    claimObjectSha256:
      "648d0313653e7d48fb26eab6125eeda2bd3c9be395ad07f17575a70d4b2e55fe",
    controlObjectSha256:
      "e474f9f978da5fde9e750c6702e87968a76c6b78c606dd43395552899f5417b2",
  },
] as const;
const NOELLE_SOURCE_LOCAL_EXPECTED_HOLDOUTS = [
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.circlet[0].conditions",
    "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
    "3172857f1aee97220600b592520a43df54da914be2ecbbb8d8feaa4ce1ea1802",
  ],
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.goblet[0].conditions",
    "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
    "c8468a9d42285b4642dbba82a3527aaa466ea5b2f83c7d19c2d9ce3819ba5c1f",
  ],
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.mainStats.sands[0].conditions",
    "6da7375f731b4225cc74ace0f54f350efdcbf7f2cad0655fcab7490d54875436",
    "f030f650757f8f4df845605cb472de20ab2037a7d79b2f990c175068475935a2",
  ],
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[0].conditions",
    "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
    "4d88cd0bb5f6b0a5ec72e0636d1efffbff9016d1e123cde0460083fd971ce5f5",
  ],
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[1].conditions",
    "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
    "4ee089dadb55d1354b247e78a97842ef54f29a640273c5c7070f195ec365330a",
  ],
  [
    "kqm:character_guide:noelle-c0-c5-talent-9-artifact-stats-luna-viii:recommendation.substats[2].conditions",
    "25653d703f7c6fc7863846ee96926f944835256820cf3ab86738761bfc0bc675",
    "9adedeaeeaaa20d48e1a873b9f298a04861edfd8d741020b466eae0eb7f33682",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.circlet[1].conditions",
    "7444217b95d562ae6cffb22b51e7c6ef6da6891851967415925d6713c254e2c6",
    "4f19172dd1394d8d652e55d884574c5ccdd6b3843b33a23734e3a6598093077b",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.mainStats.goblet[1].conditions",
    "778b1c674223e02b4b58c3903c6ac809f5bab52e2c216e93003320fd1657f748",
    "c87b11f59b07c0d187b6790cbc67fd59665b13f501def82f34b450fdcae74871",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[0].conditions",
    "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
    "c1d8e5700711577021d22ac4e86cee840f7d132350b700074eb57fd951780549",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[1].conditions",
    "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
    "a5dad12f662b269df282ced46013b63678e402c88546ce70c330c81285eeeb03",
  ],
  [
    "kqm:character_guide:noelle-c6-or-talent-10-artifact-stats-luna-viii:recommendation.substats[2].conditions",
    "2dd077d3312b7d4e833de6e6269283f80373dda48bf20a5099878325c980018d",
    "ebe8274c4adb5dea8c4d3ffcdd1594594f8a17690db3478c60a5904b8088c904",
  ],
  [
    "kqm:character_guide:noelle-hexerei-gest-luna-viii:recommendation.weaponRecommendations[0].conditions",
    "f27375a8ce8833cc0326a17c94f52c71ed4f44a72868e15d087390b864e490cf",
    "03fdf057141aff7029b31fbaf178e958c7bfd23fac0c809e02b6b5b70f412faa",
  ],
] as const;
const NOELLE_SOURCE_LOCAL_EXPECTED_EMPTY = {
  occurrenceId:
    "kqm:character_guide:noelle-general-husk-luna-viii:recommendation.artifactRecommendations[0].conditions",
  conditionsSha256:
    "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
  objectSha256:
    "3f126ff92f47f4c8e265c8608382a699310c2f3e33ae5af42c55353a63036c05",
} as const;

const KEQING_SHRED_SOURCE_MEMBER_INDEX: Readonly<Record<string, number>> = {
  kaedehara_kazuha: 0,
  sucrose: 1,
  jean: 2,
  xianyun: 3,
  sayu: 4,
  xilonen: 5,
};

/**
 * Construct the canonical key shared by condition-array extraction and binding
 * evidence. The ordered-array hash is deliberately part of the identity, so a
 * prose edit creates a new occurrence instead of silently inheriting a binding.
 */
export function buildCurrentConditionArrayOccurrenceKey(
  identity: CurrentConditionArrayOccurrenceIdentity,
): string {
  for (const [field, value] of [
    ["sourceId", identity.sourceId],
    ["recordKind", identity.recordKind],
    ["sourceRecordId", identity.sourceRecordId],
    ["manualClaimPath", identity.manualClaimPath],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Condition occurrence ${field} must be a non-empty string.`);
    }
  }
  if (!/^[0-9a-f]{64}$/.test(identity.conditionsSha256)) {
    throw new Error(
      "Condition occurrence conditionsSha256 must be a lowercase SHA-256 digest.",
    );
  }
  return `${buildCurrentConditionArrayOccurrenceId(identity)}:${identity.conditionsSha256}`;
}

/** Match key emitted by the generic manual-snapshot condition extractor. */
export function buildCurrentConditionArrayOccurrenceId(
  identity: Pick<
    CurrentConditionArrayOccurrenceIdentity,
    "sourceId" | "recordKind" | "sourceRecordId" | "manualClaimPath"
  >,
): string {
  for (const [field, value] of [
    ["sourceId", identity.sourceId],
    ["recordKind", identity.recordKind],
    ["sourceRecordId", identity.sourceRecordId],
    ["manualClaimPath", identity.manualClaimPath],
  ] as const) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Condition occurrence ${field} must be a non-empty string.`);
    }
  }
  return `${identity.sourceId}:${identity.recordKind}:${identity.sourceRecordId}:${identity.manualClaimPath}`;
}

export function buildCurrentConditionBindingCatalog(
  input: BuildCurrentConditionBindingCatalogInput,
): CurrentConditionBindingCatalogReport {
  const issues: CurrentConditionBindingCatalogIssue[] = [];
  const ittoAuthenticated = input.ittoAuthentication.authenticated === true;
  const keqingEquipmentDurableMatchesCurrent = exactCurrentReportMatches(
    input.keqingEquipment,
  );
  const keqingRolePairDurableMatchesCurrent = exactCurrentReportMatches(
    input.keqingRolePair,
  );
  const kleeSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.kleeSourceLocal,
  );
  const dionaSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.dionaSourceLocal,
  );
  const kokomiSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.kokomiSourceLocal,
  );
  const noelleSourceLocalDurableMatchesCurrent = exactCurrentReportMatches(
    input.noelleSourceLocal,
  );
  const authenticationBoundary = {
    ittoAuthenticated,
    keqingEquipmentDurableMatchesCurrent,
    keqingRolePairDurableMatchesCurrent,
    kleeSourceLocalDurableMatchesCurrent,
    dionaSourceLocalDurableMatchesCurrent,
    kokomiSourceLocalDurableMatchesCurrent,
    noelleSourceLocalDurableMatchesCurrent,
  };

  if (!ittoAuthenticated) {
    addIssue(
      issues,
      "authentication.itto-not-authenticated",
      "ittoAuthentication",
      "The Itto report was not authenticated against current typed inputs.",
    );
  }
  if (!keqingEquipmentDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.keqing-equipment-stale",
      "keqingEquipment",
      "The durable Keqing equipment report differs from the current rebuilt report.",
    );
  }
  if (!keqingRolePairDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.keqing-role-pair-stale",
      "keqingRolePair",
      "The durable Keqing role-pair report differs from the current rebuilt report.",
    );
  }
  if (!kleeSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.klee-source-local-stale",
      "kleeSourceLocal",
      "The durable Klee source-local report differs from the current rebuilt report.",
    );
  }
  if (!dionaSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.diona-source-local-stale",
      "dionaSourceLocal",
      "The durable Diona source-local report differs from the current rebuilt report.",
    );
  }
  if (!kokomiSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.kokomi-source-local-stale",
      "kokomiSourceLocal",
      "The durable Kokomi source-local report differs from the current rebuilt report.",
    );
  }
  if (!noelleSourceLocalDurableMatchesCurrent) {
    addIssue(
      issues,
      "authentication.noelle-source-local-stale",
      "noelleSourceLocal",
      "The durable Noelle source-local report differs from the current rebuilt report.",
    );
  }
  if (issues.length > 0) {
    return failedReport(authenticationBoundary, issues);
  }

  try {
    const ittoReport = authenticatedIttoReport(input.ittoAuthentication);
    const entries = [
      ...extractIttoEntries(ittoReport, issues),
      ...extractKeqingEquipmentEntries(
        input.keqingEquipment.currentReport,
        issues,
      ),
      ...extractKeqingVvEntries(input.keqingRolePair.currentReport, issues),
      ...extractKleeSourceLocalEntries(
        input.kleeSourceLocal.currentReport,
        issues,
      ),
      ...extractDionaSourceLocalEntries(
        input.dionaSourceLocal.currentReport,
        issues,
      ),
      ...extractKokomiSourceLocalEntries(
        input.kokomiSourceLocal.currentReport,
        issues,
      ),
      ...extractNoelleSourceLocalEntries(
        input.noelleSourceLocal.currentReport,
        issues,
      ),
    ];
    validateCombinedEntries(entries, issues);
    if (issues.length > 0) {
      return failedReport(authenticationBoundary, issues);
    }
    const canonicalEntries = entries.sort((left, right) =>
      left.occurrenceKey.localeCompare(right.occurrenceKey),
    );
    return {
      ...baseReport(authenticationBoundary),
      comparisonStatus: "comparable",
      entries: canonicalEntries,
      summary: summarize(canonicalEntries),
      issues: [],
    };
  } catch (error) {
    addIssue(
      issues,
      "catalog.unexpected-input-shape",
      "input",
      error instanceof Error ? error.message : String(error),
    );
    return failedReport(authenticationBoundary, issues);
  }
}

export function requireComparableCurrentConditionBindingCatalog(
  report: CurrentConditionBindingCatalogReport,
): CurrentConditionBindingCatalogReport & { comparisonStatus: "comparable" } {
  if (report.comparisonStatus !== "comparable") {
    const details = report.issues
      .map(({ code, path }) => `${code} at ${path}`)
      .join("; ");
    throw new Error(
      `Current condition-binding catalog is not comparable${details ? `: ${details}` : "."}`,
    );
  }
  return report as CurrentConditionBindingCatalogReport & {
    comparisonStatus: "comparable";
  };
}

function exactCurrentReportMatches<T>(
  pair: AuthenticatedCurrentReportPair<T>,
): boolean {
  return stableJson(pair.durableReport) === stableJson(pair.currentReport);
}

function authenticatedIttoReport(
  authentication: SourceConditionedGuidePacketAuthentication,
): SourceConditionedGuidePacketReport {
  if (!authentication.authenticated) {
    throw new Error("Itto authentication unexpectedly failed after preflight.");
  }
  return authentication.canonicalReport;
}

function extractIttoEntries(
  report: SourceConditionedGuidePacketReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "source-conditioned-guide-packet-report" ||
    report.experimentId !== ITTO_EXPERIMENT_ID ||
    report.issues.length !== 0
  ) {
    addIssue(
      issues,
      "itto.non-comparable",
      "ittoAuthentication.canonicalReport",
      "The authenticated Itto report does not expose the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.ER !== false ||
    report.energyRecoveryInputsUsed !== false
  ) {
    addIssue(
      issues,
      "itto.policy-boundary-drift",
      "ittoAuthentication.canonicalReport",
      "The Itto checkpoint crossed a prohibited guide or energy-computation boundary.",
    );
  }
  if (
    report.sourceClaimCatalog.length !== ITTO_EXPECTED_OCCURRENCE_COUNT ||
    report.summary.sourceClaimCount !== ITTO_EXPECTED_OCCURRENCE_COUNT
  ) {
    addIssue(
      issues,
      "itto.partial-claim-catalog",
      "ittoAuthentication.canonicalReport.sourceClaimCatalog",
      `Expected ${ITTO_EXPECTED_OCCURRENCE_COUNT} Itto condition occurrences.`,
    );
    return [];
  }

  const claimsById = new Map<string, number>();
  for (const claim of report.sourceClaimCatalog) {
    claimsById.set(claim.claimId, (claimsById.get(claim.claimId) ?? 0) + 1);
  }
  for (const [claimId, count] of claimsById) {
    if (count !== 1) {
      addIssue(
        issues,
        "itto.duplicate-claim-id",
        `ittoAuthentication.canonicalReport.sourceClaimCatalog.${claimId}`,
        `Expected one Itto atomic claim, found ${count}.`,
      );
    }
  }

  const mapKeys = Object.keys(report.policyBoundary.conditionMap).sort();
  const claimIds = report.sourceClaimCatalog
    .map(({ claimId }) => claimId)
    .sort();
  if (stableJson(mapKeys) !== stableJson(claimIds)) {
    addIssue(
      issues,
      "itto.partial-condition-map",
      "ittoAuthentication.canonicalReport.policyBoundary.conditionMap",
      "The exact Itto condition map does not contain exactly one entry per atomic claim.",
    );
  }

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const claim of report.sourceClaimCatalog) {
    const path = ittoManualClaimPath(claim);
    const conditionsSha256 = sha256Text(
      stableJson(claim.sourceConditions),
    );
    const mapEntry = report.policyBoundary.conditionMap[claim.claimId];
    if (
      claim.sourceConditionsSha256 !== conditionsSha256 ||
      mapEntry?.sourceConditionsSha256 !== conditionsSha256 ||
      stableJson(mapEntry?.predicate) !== stableJson(claim.predicate)
    ) {
      addIssue(
        issues,
        "itto.conflicting-condition-evidence",
        `ittoAuthentication.canonicalReport.sourceClaimCatalog.${claim.claimId}`,
        "The claim, ordered condition hash, and typed condition-map evidence do not agree exactly.",
      );
      continue;
    }
    const deferredReasons = deferredEnergyReasons(claim.predicate);
    const energyClassification =
      deferredReasons.length > 0
        ? "deferred-energy-prerequisite"
        : "not-energy-deferred";
    entries.push(
      makeEntry({
        sourceId: claim.sourceId,
        recordKind: "character_guide",
        sourceRecordId: claim.sourceRecordId,
        manualClaimPath: path,
        subject: claim.characterId,
        orderedConditions: claim.sourceConditions,
        bindingClassification: "typed-bound",
        energyClassification,
        bindingEvidence: {
          kind: "itto-typed-predicate-ast",
          claimIds: [claim.claimId],
          conditionMapKeys: [claim.claimId],
          predicateAst: structuredClone(claim.predicate),
          predicateAstSha256: sha256Text(stableJson(claim.predicate)),
        },
        energyEvidence:
          energyClassification === "deferred-energy-prerequisite"
            ? {
                kind: "deferred-energy-prerequisite",
                structuralErEvidencePresent: false,
                energyRelatedWorkDeferred: true,
                reasons: deferredReasons,
              }
            : notEnergyDeferredEvidence(),
      }),
    );
  }
  const deferredCount = entries.filter(
    ({ energyClassification }) =>
      energyClassification === "deferred-energy-prerequisite",
  ).length;
  if (deferredCount !== ITTO_EXPECTED_DEFERRED_COUNT) {
    addIssue(
      issues,
      "itto.deferred-energy-count-drift",
      "ittoAuthentication.canonicalReport.sourceClaimCatalog",
      `Expected ${ITTO_EXPECTED_DEFERRED_COUNT} ER-deferred Itto occurrences, found ${deferredCount}.`,
    );
  }
  return entries;
}

function ittoManualClaimPath(
  claim: SourceConditionedGuidePacketReport["sourceClaimCatalog"][number],
): string {
  const prefix = "recommendation";
  const index = claim.recommendation.sourceIndex;
  switch (claim.payload.type) {
    case "main-stat":
      return `${prefix}.mainStats.${claim.payload.slot}[${index}].conditions`;
    case "substat":
      return `${prefix}.substats[${index}].conditions`;
    case "artifact-group":
      return `${prefix}.artifactRecommendations[${index}].conditions`;
    case "weapon-group":
      return `${prefix}.weaponRecommendations[${index}].conditions`;
  }
}

function extractKeqingEquipmentEntries(
  report: KeqingLunarEquipmentEvidenceValidationReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.validationStatus !== "comparable" ||
    report.classification !==
      "keqing-lunar-equipment-evidence-structural-validation" ||
    report.sourceBoundary.sourceId !== "kqm"
  ) {
    addIssue(
      issues,
      "keqing-equipment.non-comparable",
      "keqingEquipment.currentReport",
      "The Keqing equipment evidence report is not the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.energyRecoveryInputsUsed !== false ||
    report.sourceConditionBoundary.allSourceConditionsMappedExactly !== true
  ) {
    addIssue(
      issues,
      "keqing-equipment.policy-boundary-drift",
      "keqingEquipment.currentReport",
      "The Keqing equipment checkpoint crossed a prohibited guide/energy boundary or lost exact condition mappings.",
    );
  }
  if (
    report.claims.length !== KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT ||
    report.sourceBoundary.expectedParticipatingRecordCount !== 17 ||
    report.sourceBoundary.records.length !== 17 ||
    !report.sourceBoundary.allRecordsPresentExactlyOnce ||
    !report.sourceBoundary.allManualPayloadsMatch ||
    !report.sourceBoundary.allRepositoryPayloadsMatch ||
    !report.sourceBoundary.allRepositoryRecommendationsMatchManual
  ) {
    addIssue(
      issues,
      "keqing-equipment.partial-evidence",
      "keqingEquipment.currentReport.claims",
      `Expected a closed 17-record, ${KEQING_EQUIPMENT_EXPECTED_ATOMIC_CLAIM_COUNT}-claim Keqing evidence checkpoint.`,
    );
    return [];
  }

  const claimIdCounts = new Map<string, number>();
  const groups = new Map<
    string,
    {
      sourceId: string;
      recordKind: "character_guide";
      sourceRecordId: string;
      manualClaimPath: string;
      orderedConditions: string[];
      atomicClaimIds: string[];
      predicateIds: string[];
      teamResolutionEvidence: unknown;
      locatorKey: string;
    }
  >();
  const locatorHashes = new Map<string, Set<string>>();

  for (const claim of report.claims) {
    claimIdCounts.set(
      claim.claimId,
      (claimIdCounts.get(claim.claimId) ?? 0) + 1,
    );
    if (!claim.allSourceConditionsMappedExactly) {
      addIssue(
        issues,
        "keqing-equipment.unbound-condition-array",
        `keqingEquipment.currentReport.claims.${claim.claimId}`,
        "Every current Keqing equipment condition must retain an exact typed mapping.",
      );
      continue;
    }
    const manualClaimPath = keqingEquipmentManualClaimPath(claim);
    const orderedConditions = [...claim.sourceConditions];
    const conditionsSha256 = sha256Text(stableJson(orderedConditions));
    const locatorKey = stableJson({
      sourceId: report.sourceBoundary.sourceId,
      recordKind: "character_guide",
      sourceRecordId: claim.sourceRecordId,
      manualClaimPath,
    });
    const hashes = locatorHashes.get(locatorKey) ?? new Set<string>();
    hashes.add(conditionsSha256);
    locatorHashes.set(locatorKey, hashes);

    const predicateIds = exactKeqingPredicateIds(claim, issues);
    const teamResolutionEvidence = claim.teamResolutions;
    const occurrenceKey = buildCurrentConditionArrayOccurrenceKey({
      sourceId: report.sourceBoundary.sourceId,
      recordKind: "character_guide",
      sourceRecordId: claim.sourceRecordId,
      manualClaimPath,
      conditionsSha256,
    });
    const existing = groups.get(occurrenceKey);
    if (existing) {
      if (
        stableJson(existing.orderedConditions) !== stableJson(orderedConditions) ||
        stableJson(existing.predicateIds) !== stableJson(predicateIds) ||
        stableJson(existing.teamResolutionEvidence) !==
          stableJson(teamResolutionEvidence)
      ) {
        addIssue(
          issues,
          "keqing-equipment.conflicting-atomic-evidence",
          `keqingEquipment.currentReport.claims.${claim.claimId}`,
          "Atomic claims sharing one source condition array expose conflicting binding evidence.",
        );
      }
      existing.atomicClaimIds.push(claim.claimId);
    } else {
      groups.set(occurrenceKey, {
        sourceId: report.sourceBoundary.sourceId,
        recordKind: "character_guide",
        sourceRecordId: claim.sourceRecordId,
        manualClaimPath,
        orderedConditions,
        atomicClaimIds: [claim.claimId],
        predicateIds,
        teamResolutionEvidence,
        locatorKey,
      });
    }
  }

  for (const [claimId, count] of claimIdCounts) {
    if (count !== 1) {
      addIssue(
        issues,
        "keqing-equipment.duplicate-atomic-claim-id",
        `keqingEquipment.currentReport.claims.${claimId}`,
        `Expected one atomic claim ID, found ${count}.`,
      );
    }
  }
  for (const [locatorKey, hashes] of locatorHashes) {
    if (hashes.size !== 1) {
      addIssue(
        issues,
        "keqing-equipment.conflicting-condition-array-hash",
        `keqingEquipment.currentReport.locator.${sha256Text(locatorKey)}`,
        "One exact source schema path produced multiple ordered condition-array hashes.",
      );
    }
  }
  if (groups.size !== KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT) {
    addIssue(
      issues,
      "keqing-equipment.occurrence-count-drift",
      "keqingEquipment.currentReport.claims",
      `Expected ${KEQING_EQUIPMENT_EXPECTED_OCCURRENCE_COUNT} unique source condition arrays backed by 42 atomic claims, found ${groups.size}.`,
    );
  }

  return [...groups.values()].map((group) =>
    makeEntry({
      sourceId: group.sourceId,
      recordKind: group.recordKind,
      sourceRecordId: group.sourceRecordId,
      manualClaimPath: group.manualClaimPath,
      subject: "keqing",
      orderedConditions: group.orderedConditions,
      bindingClassification: "typed-bound",
      energyClassification: "not-energy-deferred",
      bindingEvidence: {
        kind: "keqing-equipment-typed-predicate-ids",
        atomicClaimIds: group.atomicClaimIds.sort(),
        predicateIds: group.predicateIds,
        exactTeamResolutionEvidenceSha256: sha256Text(
          stableJson(group.teamResolutionEvidence),
        ),
      },
      energyEvidence: notEnergyDeferredEvidence(),
    }),
  );
}

function keqingEquipmentManualClaimPath(
  claim: KeqingLunarEquipmentEvidenceValidationReport["claims"][number],
): string {
  const prefix = "recommendation";
  switch (claim.sourceClaim.kind) {
    case "weapon":
      return `${prefix}.weaponRecommendations[${claim.sourceClaim.groupIndex}].conditions`;
    case "artifact":
      return `${prefix}.artifactRecommendations[${claim.sourceClaim.groupIndex}].conditions`;
    case "main-stat":
      return `${prefix}.mainStats.${claim.sourceClaim.slot}[${claim.sourceClaim.entryIndex}].conditions`;
    case "substat":
      return `${prefix}.substats[${claim.sourceClaim.entryIndex}].conditions`;
  }
}

function exactKeqingPredicateIds(
  claim: KeqingLunarEquipmentEvidenceValidationReport["claims"][number],
  issues: CurrentConditionBindingCatalogIssue[],
): string[] {
  if (claim.teamResolutions.length !== KEQING_ROLE_PAIR_TARGET_TEAM_IDS.length) {
    addIssue(
      issues,
      "keqing-equipment.partial-team-resolution-evidence",
      `keqingEquipment.currentReport.claims.${claim.claimId}.teamResolutions`,
      "Each condition array must carry evidence for all four exact published teams.",
    );
    return [];
  }
  const expectedTeamIds = [...KEQING_ROLE_PAIR_TARGET_TEAM_IDS].sort();
  const actualTeamIds = claim.teamResolutions
    .map(({ teamRecordId }) => teamRecordId)
    .sort();
  if (stableJson(expectedTeamIds) !== stableJson(actualTeamIds)) {
    addIssue(
      issues,
      "keqing-equipment.conflicting-team-resolution-targets",
      `keqingEquipment.currentReport.claims.${claim.claimId}.teamResolutions`,
      "The condition acknowledgement targets differ from the four published source teams.",
    );
  }
  const predicateIds: string[] = [];
  for (const conditionIndex of claim.sourceConditions.keys()) {
    const ids = new Set<string>();
    for (const resolution of claim.teamResolutions) {
      const acknowledgements = resolution.conditionAcknowledgements.filter(
        (acknowledgement) => acknowledgement.conditionIndex === conditionIndex,
      );
      if (acknowledgements.length !== 1 || !acknowledgements[0]?.predicateId) {
        addIssue(
          issues,
          "keqing-equipment.partial-predicate-evidence",
          `keqingEquipment.currentReport.claims.${claim.claimId}.sourceConditions.${conditionIndex}`,
          "Every exact condition must have one stable typed predicate ID in every team resolution.",
        );
        continue;
      }
      ids.add(acknowledgements[0].predicateId);
    }
    if (ids.size !== 1) {
      addIssue(
        issues,
        "keqing-equipment.conflicting-predicate-evidence",
        `keqingEquipment.currentReport.claims.${claim.claimId}.sourceConditions.${conditionIndex}`,
        "The same ordered source condition maps to conflicting typed predicate IDs.",
      );
      continue;
    }
    predicateIds.push([...ids][0]!);
  }
  return predicateIds;
}

function extractKeqingVvEntries(
  report: KeqingSourceScopedRolePairSampleReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  if (
    report.comparisonStatus !== "comparable" ||
    report.classification !== "keqing-source-scoped-role-pair-sample" ||
    report.sourceExtractionBoundary.sourceId !== "kqm" ||
    report.rolePairSample.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "keqing-role-pair.non-comparable",
      "keqingRolePair.currentReport",
      "The Keqing role-pair evidence report is not the expected comparable checkpoint.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.energyRecoveryInputsUsed !== false ||
    report.sourceExtractionBoundary.expectedParticipatingRecordCount !== 7 ||
    !report.sourceExtractionBoundary.configuredRecordsPresentExactlyOnce ||
    !report.sourceExtractionBoundary.allExtractionStatesMatch ||
    report.rolePairSample.targets.length !== 4 ||
    !report.publishedTargetBoundary.configuredTargetsMatchExpectation ||
    !report.publishedTargetBoundary.evaluatedTargetsMatchConfiguration
  ) {
    addIssue(
      issues,
      "keqing-role-pair.partial-evidence",
      "keqingRolePair.currentReport",
      "The Keqing role-pair checkpoint does not expose the complete four-target authenticated boundary.",
    );
    return [];
  }

  const shredRole = report.roleInventoryBoundary.roleRecords.find(
    ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
  );
  if (!shredRole) {
    addIssue(
      issues,
      "keqing-role-pair.missing-shred-role",
      "keqingRolePair.currentReport.roleInventoryBoundary",
      "The resistance-shred source role is missing.",
    );
    return [];
  }
  const roleConditionsByCharacter = new Map(
    shredRole.members.map(({ characterId, conditions }) => [
      characterId,
      [...conditions],
    ]),
  );
  for (const characterId of [
    ...KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS,
    ...KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS,
  ]) {
    if (
      stableJson(roleConditionsByCharacter.get(characterId)) !==
      stableJson([KEQING_ROLE_PAIR_VV_CONDITION])
    ) {
      addIssue(
        issues,
        "keqing-role-pair.source-member-condition-drift",
        `keqingRolePair.currentReport.roleInventoryBoundary.${characterId}`,
        "The source role member no longer carries the exact VV condition array.",
      );
    }
  }
  if (stableJson(roleConditionsByCharacter.get("xilonen")) !== stableJson([])) {
    addIssue(
      issues,
      "keqing-role-pair.xilonen-condition-drift",
      "keqingRolePair.currentReport.roleInventoryBoundary.xilonen",
      "Xilonen must remain the unconditioned resistance-shred member.",
    );
  }

  type VvAcknowledgement = {
    characterId: string;
    targetTeamId: string;
    targetId: string;
  };
  const acknowledgements: VvAcknowledgement[] = [];
  for (const target of report.rolePairSample.targets) {
    if (target.comparisonStatus !== "comparable" || target.issues.length !== 0) {
      addIssue(
        issues,
        "keqing-role-pair.target-not-comparable",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}`,
        "Every published role-pair target must remain individually comparable.",
      );
      continue;
    }
    const shredBindings = target.roleMemberBindings.filter(
      ({ roleRecordId }) => roleRecordId === KEQING_SHRED_ROLE_RECORD_ID,
    );
    if (shredBindings.length !== 1) {
      addIssue(
        issues,
        "keqing-role-pair.ambiguous-shred-binding",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}`,
        `Expected one resistance-shred binding, found ${shredBindings.length}.`,
      );
      continue;
    }
    const binding = shredBindings[0]!;
    const sourceConditions = roleConditionsByCharacter.get(binding.characterId);
    if (
      !sourceConditions ||
      stableJson(binding.requiredConditions) !== stableJson(sourceConditions) ||
      stableJson(binding.acknowledgedConditions) !==
        stableJson(sourceConditions) ||
      !binding.conditionsMatch
    ) {
      addIssue(
        issues,
        "keqing-role-pair.conflicting-acknowledgement",
        `keqingRolePair.currentReport.rolePairSample.targets.${target.targetId}.${binding.characterId}`,
        "The published target acknowledgement conflicts with the exact source member condition array.",
      );
      continue;
    }
    const configured = report.configuredPublishedTargets.find(
      ({ targetId }) => targetId === target.targetId,
    );
    if (
      !configured ||
      stableJson(
        configured.acknowledgedConditionsByRoleRecordId[
          KEQING_SHRED_ROLE_RECORD_ID
        ] ?? [],
      ) !== stableJson(sourceConditions)
    ) {
      addIssue(
        issues,
        "keqing-role-pair.configured-acknowledgement-conflict",
        `keqingRolePair.currentReport.configuredPublishedTargets.${target.targetId}`,
        "Configured and evaluated exact-text acknowledgements do not agree.",
      );
      continue;
    }
    if (sourceConditions.length > 0) {
      acknowledgements.push({
        characterId: binding.characterId,
        targetTeamId: target.targetTeamId,
        targetId: target.targetId,
      });
    }
  }

  const acknowledgedCharacters = acknowledgements
    .map(({ characterId }) => characterId)
    .sort();
  if (
    stableJson(acknowledgedCharacters) !==
    stableJson([...KEQING_VV_EXPECTED_ACKNOWLEDGED_CHARACTERS].sort())
  ) {
    addIssue(
      issues,
      "keqing-role-pair.vv-acknowledgement-scope-drift",
      "keqingRolePair.currentReport.rolePairSample.targets",
      "VV acknowledgements must remain limited to Jean, Kaedehara Kazuha, and Sucrose; Sayu and Xianyun are unexercised source members.",
    );
  }

  const groups = new Map<string, VvAcknowledgement[]>();
  for (const acknowledgement of acknowledgements) {
    const existing = groups.get(acknowledgement.characterId) ?? [];
    existing.push(acknowledgement);
    groups.set(acknowledgement.characterId, existing);
  }
  return [...groups.entries()].map(([characterId, evidence]) => {
    const sourceIndex = KEQING_SHRED_SOURCE_MEMBER_INDEX[characterId];
    if (sourceIndex == null) {
      throw new Error(`Missing pinned source member index for ${characterId}.`);
    }
    return makeEntry({
      sourceId: report.sourceExtractionBoundary.sourceId,
      recordKind: "character_role",
      sourceRecordId: KEQING_SHRED_ROLE_SOURCE_RECORD_ID,
      manualClaimPath: `members[${sourceIndex}].conditions`,
      subject: characterId,
      orderedConditions: [KEQING_ROLE_PAIR_VV_CONDITION],
      bindingClassification: "exact-text-acknowledged",
      energyClassification: "energy-unclassified",
      bindingEvidence: {
        kind: "keqing-role-exact-text-acknowledgement",
        characterId,
        roleRecordId: KEQING_SHRED_ROLE_RECORD_ID,
        targetTeamIds: evidence.map(({ targetTeamId }) => targetTeamId).sort(),
        targetIds: evidence.map(({ targetId }) => targetId).sort(),
        acknowledgementCount: evidence.length,
      },
      energyEvidence: null,
    });
  });
}

function extractKleeSourceLocalEntries(
  report: KleeSourceLocalConditionSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "klee-source-local-condition-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.sliceId !== KLEE_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "klee-source-local.non-comparable",
      "kleeSourceLocal.currentReport",
      "The Klee source-local report is not the expected comparable authenticated slice.",
    );
    return [];
  }
  if (
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds.length !== 4 ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllKleeConditions ||
    report.sourceBoundary.selectedOccurrenceCount !== 4 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 11 ||
    report.selectedOccurrences.length !== 4 ||
    report.holdoutOccurrences.length !== 11 ||
    report.summary.selectedOccurrenceCount !== 4 ||
    report.summary.selectedNotEnergyDeferredCount !== 4 ||
    report.summary.holdoutOccurrenceCount !== 11 ||
    report.summary.holdoutWithoutAuthoredEnergyClassificationCount !== 11 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.sourceClaimCatalog.length !== 4 ||
    sourceLocalSlice.conditionControls.length !== 4
  ) {
    addIssue(
      issues,
      "klee-source-local.partial-or-capability-crossing-evidence",
      "kleeSourceLocal.currentReport",
      "The Klee checkpoint lost its exact four-selected/eleven-holdout boundary or crossed a prohibited computation boundary.",
    );
    return [];
  }

  const actualSelectedIds = report.selectedOccurrences
    .map(({ occurrenceId }) => occurrenceId)
    .sort();
  if (
    stableJson(actualSelectedIds) !==
    stableJson([...KLEE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCE_IDS].sort())
  ) {
    addIssue(
      issues,
      "klee-source-local.selected-occurrence-scope-drift",
      "kleeSourceLocal.currentReport.selectedOccurrences",
      "The Klee typed slice must remain limited to the four exact authenticated occurrences.",
    );
    return [];
  }
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(holdoutIds).size !== 11 ||
    holdoutIds.some((occurrenceId) => actualSelectedIds.includes(occurrenceId)) ||
    report.holdoutOccurrences.some(
      (holdout) =>
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice,
    )
  ) {
    addIssue(
      issues,
      "klee-source-local.selected-holdout-partition-drift",
      "kleeSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected and holdout occurrence sets must remain unique, disjoint, and limited to slice-authored dispositions.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "klee-source-local.duplicate-source-claim",
    "kleeSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "klee-source-local.duplicate-condition-control",
    "kleeSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const selected of report.selectedOccurrences) {
    const claim = claimById.get(selected.occurrenceId);
    const control = controlById.get(selected.occurrenceId);
    const entry = buildSourceLocalCatalogEntry(
      {
        diagnosticCode: "klee-source-local.conflicting-occurrence-evidence",
        diagnosticPath: `kleeSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
        diagnosticMessage:
          "The selected occurrence, source claim, condition control, predicate, payload, and exact source identity do not agree.",
        sliceId: report.sliceId,
        sourceId: "kqm",
        recordKind: "character_guide",
        subject: "klee",
        selected,
        claim,
        control,
      },
      issues,
    );
    if (entry) entries.push(entry);
  }
  return entries;
}

function extractDionaSourceLocalEntries(
  report: DionaSourceLocalSupportSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "diona-source-local-support-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.sliceId !== DIONA_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "diona-source-local.non-comparable",
      "dionaSourceLocal.currentReport",
      "The Diona source-local report is not the expected comparable authenticated slice.",
    );
    return [];
  }
  if (
    report.arbitraryEnglishParsingAllowed !== false ||
    report.supportsSourceAuthorization !== false ||
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsBuildRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsRotationClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.conditionTruthEstablishedFromRecommendationMetadata !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.artifactAssignmentExecuted !== false ||
    report.teamCompositionExecuted !== false ||
    report.buildCompositionExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.rotationComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    report.rawInputBoundary.status !== "accepted" ||
    !report.rawInputBoundary.exactPathSet ||
    !report.rawInputBoundary.byteAndParsedObjectClosure ||
    report.rawInputBoundary.sourceFileCount !== 4 ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds.length !== 3 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds.length !== 1 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds[0] !==
      DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllNonemptyDionaConditions ||
    !report.sourceBoundary.samePageLineage ||
    !report.sourceBoundary.selectedClaimsAndTeamShareExactSourceRecord ||
    report.sourceBoundary.rawRecordCount !== 5 ||
    report.sourceBoundary.totalConditionArrayCount !== 26 ||
    report.sourceBoundary.nonemptyConditionArrayCount !== 18 ||
    report.sourceBoundary.emptyConditionArrayCount !== 8 ||
    report.sourceBoundary.selectedOccurrenceCount !== 3 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 15 ||
    report.sourceBoundary.ordinaryHoldoutInventoryCount !== 10 ||
    report.sourceBoundary.erDeferredHoldoutInventoryCount !== 5 ||
    report.selectedOccurrences.length !== 3 ||
    report.holdoutOccurrences.length !== 15 ||
    report.summary.totalConditionArrayCount !== 26 ||
    report.summary.nonemptyConditionArrayCount !== 18 ||
    report.summary.emptyConditionArrayCount !== 8 ||
    report.summary.selectedOccurrenceCount !== 3 ||
    report.summary.selectedUniqueConditionArrayCount !== 3 ||
    report.summary.selectedNotEnergyDeferredCount !== 3 ||
    report.summary.holdoutOccurrenceCount !== 15 ||
    report.summary.ordinaryHoldoutInventoryCount !== 10 ||
    report.summary.erDeferredHoldoutInventoryCount !== 5 ||
    report.summary.holdoutConsumedCount !== 0 ||
    report.summary.holdoutBindingAuthoredCount !== 0 ||
    report.summary.holdoutEnergyClassificationAuthoredCount !== 0 ||
    report.summary.sourceTeamCount !== 1 ||
    report.summary.sourceCellCount !== 3 ||
    report.summary.sourceMatchedCount !== 0 ||
    report.summary.sourceInapplicableCount !== 0 ||
    report.summary.sourceUnresolvedCount !== 3 ||
    report.summary.contextApplicableCount !== 3 ||
    report.summary.sourceAlreadyMatchedCount !== 0 ||
    report.summary.sourceDefinitelyInapplicableCount !== 0 ||
    report.summary.effectiveMatchedCount !== 3 ||
    report.summary.effectiveInapplicableCount !== 0 ||
    report.summary.effectiveUnresolvedCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.summary.claimCount !== 3 ||
    sourceLocalSlice.summary.teamCount !== 1 ||
    sourceLocalSlice.summary.cellCount !== 3 ||
    sourceLocalSlice.summary.sourceMatchedCount !== 0 ||
    sourceLocalSlice.summary.sourceInapplicableCount !== 0 ||
    sourceLocalSlice.summary.sourceUnresolvedCount !== 3 ||
    sourceLocalSlice.summary.effectiveMatchedCount !== 3 ||
    sourceLocalSlice.summary.effectiveInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.deferredEnergyCount !== 0 ||
    sourceLocalSlice.sourceClaimCatalog.length !== 3 ||
    sourceLocalSlice.conditionControls.length !== 3
  ) {
    addIssue(
      issues,
      "diona-source-local.partial-or-capability-crossing-evidence",
      "dionaSourceLocal.currentReport",
      "The Diona checkpoint lost its exact three-selected/fifteen-holdout boundary or crossed a prohibited computation boundary.",
    );
    return [];
  }

  const actualSelectedIds = report.selectedOccurrences
    .map(({ occurrenceId }) => occurrenceId)
    .sort();
  const expectedSelectedIds = DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.map(
    ({ occurrenceId }) => occurrenceId,
  ).sort();
  if (
    stableJson(actualSelectedIds) !== stableJson(expectedSelectedIds) ||
    stableJson(
      [...sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds].sort(),
    ) !== stableJson(expectedSelectedIds)
  ) {
    addIssue(
      issues,
      "diona-source-local.selected-occurrence-scope-drift",
      "dionaSourceLocal.currentReport.selectedOccurrences",
      "The Diona typed slice must remain limited to the three exact same-record team-member occurrences.",
    );
    return [];
  }
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(holdoutIds).size !== 15 ||
    holdoutIds.some((occurrenceId) => actualSelectedIds.includes(occurrenceId)) ||
    report.holdoutOccurrences.filter(
      ({ descriptiveInventory }) => descriptiveInventory === "ordinary-holdout",
    ).length !== 10 ||
    report.holdoutOccurrences.filter(
      ({ descriptiveInventory }) => descriptiveInventory === "er-deferred-holdout",
    ).length !== 5 ||
    report.holdoutOccurrences.some(
      (holdout) =>
        holdout.conditions.length === 0 ||
        holdout.conditionsSha256 !== sha256Text(stableJson(holdout.conditions)) ||
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.consumedBySlice ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice,
    )
  ) {
    addIssue(
      issues,
      "diona-source-local.selected-holdout-partition-drift",
      "dionaSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected and holdout occurrence sets must remain unique, disjoint, and limited to slice-authored dispositions.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "diona-source-local.duplicate-source-claim",
    "dionaSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "diona-source-local.duplicate-condition-control",
    "dionaSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];

  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const selected of report.selectedOccurrences) {
    const expected = DIONA_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.find(
      ({ occurrenceId }) => occurrenceId === selected.occurrenceId,
    );
    const claim = claimById.get(selected.occurrenceId);
    const control = controlById.get(selected.occurrenceId);
    if (
      expected == null ||
      selected.characterId !== expected.characterId ||
      selected.memberIndex !== expected.memberIndex ||
      selected.sourceRecordId !== DIONA_SOURCE_LOCAL_SOURCE_RECORD_ID ||
      selected.repositoryRecordId !== DIONA_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
      selected.manualClaimPath !==
        `members[${expected.memberIndex}].artifactRecommendations[0].conditions` ||
      selected.repositoryPath !== selected.manualClaimPath ||
      selected.claimAxis !== "artifact-recommendation"
    ) {
      addIssue(
        issues,
        "diona-source-local.conflicting-occurrence-evidence",
        `dionaSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
        "The selected occurrence, character/member identity, source claim, condition control, predicate, payload, and exact source identity do not agree.",
      );
      continue;
    }

    const entry = buildSourceLocalCatalogEntry(
      {
        diagnosticCode: "diona-source-local.conflicting-occurrence-evidence",
        diagnosticPath: `dionaSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
        diagnosticMessage:
          "The selected occurrence, character/member identity, source claim, condition control, predicate, payload, and exact source identity do not agree.",
        sliceId: report.sliceId,
        sourceId: "kqm",
        recordKind: "team",
        subject: selected.characterId,
        selected,
        claim,
        control,
      },
      issues,
    );
    if (entry) entries.push(entry);
  }
  return entries;
}

function extractKokomiSourceLocalEntries(
  report: KokomiSourceLocalArtifactSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "kokomi-source-local-artifact-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.publicationStatus !== "withheld-unreviewed-source-slice" ||
    report.sliceId !== KOKOMI_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "kokomi-source-local.non-comparable",
      "kokomiSourceLocal.currentReport",
      "The Kokomi source-local report is not the expected comparable authenticated slice.",
    );
    return [];
  }
  if (
    report.arbitraryEnglishParsingAllowed !== false ||
    report.supportsSourceAuthorization !== false ||
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsBuildRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsRotationClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.conditionTruthEstablishedFromRecommendationMetadata !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.artifactAssignmentExecuted !== false ||
    report.teamCompositionExecuted !== false ||
    report.buildCompositionExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.rotationComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    report.rawInputBoundary.status !== "accepted" ||
    !report.rawInputBoundary.exactPathSet ||
    !report.rawInputBoundary.byteAndParsedObjectClosure ||
    report.rawInputBoundary.sourceFileCount !== 4 ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.pageUrl !==
      KOKOMI_SOURCE_LOCAL_PAGE_URL ||
    sourceLocalSlice.sourceDocumentBoundary.sourceVersion !==
      KOKOMI_SOURCE_LOCAL_SOURCE_VERSION ||
    sourceLocalSlice.sourceDocumentBoundary.snapshotPath !==
      KOKOMI_SOURCE_LOCAL_SNAPSHOT_PATH ||
    sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds.length !== 1 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds.length !== 1 ||
    sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds[0] !==
      KOKOMI_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.pageUrl !== KOKOMI_SOURCE_LOCAL_PAGE_URL ||
    report.sourceBoundary.sourceVersion !== KOKOMI_SOURCE_LOCAL_SOURCE_VERSION ||
    report.sourceBoundary.snapshotPath !== KOKOMI_SOURCE_LOCAL_SNAPSHOT_PATH ||
    stableJson([...report.sourceBoundary.rawRecordIds].sort()) !==
      stableJson([...KOKOMI_SOURCE_LOCAL_RAW_RECORD_IDS].sort()) ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllNonemptyKokomiConditions ||
    !report.sourceBoundary.samePageLineage ||
    !report.sourceBoundary.selectedClaimsAndTeamShareExactSourceRecord ||
    report.sourceBoundary.rawRecordCount !== 2 ||
    report.sourceBoundary.totalConditionArrayCount !== 5 ||
    report.sourceBoundary.nonemptyConditionArrayCount !== 5 ||
    report.sourceBoundary.emptyConditionArrayCount !== 0 ||
    report.sourceBoundary.selectedOccurrenceCount !== 1 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 4 ||
    report.sourceBoundary.extractionMethod !== "agent-assisted" ||
    report.sourceBoundary.reviewStatus !== "unreviewed" ||
    report.sourceBoundary.sourceRegistryStatus !== "active" ||
    report.sourceBoundary.sourceRegistryIngestionMode !==
      "manual-observation" ||
    report.sourceBoundary.sourceRegistryPermission !== "unknown" ||
    report.sourceBoundary.promotionEligible !== false ||
    report.selectedOccurrences.length !== 1 ||
    report.holdoutOccurrences.length !== 4 ||
    report.summary.totalConditionArrayCount !== 5 ||
    report.summary.nonemptyConditionArrayCount !== 5 ||
    report.summary.emptyConditionArrayCount !== 0 ||
    report.summary.selectedOccurrenceCount !== 1 ||
    report.summary.selectedUniqueConditionArrayCount !== 1 ||
    report.summary.selectedNotEnergyDeferredCount !== 1 ||
    report.summary.holdoutOccurrenceCount !== 4 ||
    report.summary.holdoutConsumedCount !== 0 ||
    report.summary.holdoutBindingAuthoredCount !== 0 ||
    report.summary.holdoutEnergyClassificationAuthoredCount !== 0 ||
    report.summary.sourceTeamCount !== 1 ||
    report.summary.sourceCellCount !== 1 ||
    report.summary.sourceMatchedCount !== 1 ||
    report.summary.sourceInapplicableCount !== 0 ||
    report.summary.sourceUnresolvedCount !== 0 ||
    report.summary.contextApplicableCount !== 0 ||
    report.summary.sourceAlreadyMatchedCount !== 1 ||
    report.summary.sourceDefinitelyInapplicableCount !== 0 ||
    report.summary.effectiveMatchedCount !== 1 ||
    report.summary.effectiveInapplicableCount !== 0 ||
    report.summary.effectiveUnresolvedCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.summary.claimCount !== 1 ||
    sourceLocalSlice.summary.teamCount !== 1 ||
    sourceLocalSlice.summary.cellCount !== 1 ||
    sourceLocalSlice.summary.sourceMatchedCount !== 1 ||
    sourceLocalSlice.summary.sourceInapplicableCount !== 0 ||
    sourceLocalSlice.summary.sourceUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.applicableUnderSuppliedContextCount !== 0 ||
    sourceLocalSlice.summary.sourceAlreadyMatchedCount !== 1 ||
    sourceLocalSlice.summary.sourceDefinitelyInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveMatchedCount !== 1 ||
    sourceLocalSlice.summary.effectiveInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.deferredEnergyCount !== 0 ||
    sourceLocalSlice.summary.assembledBuildCount !== 0
  ) {
    addIssue(
      issues,
      "kokomi-source-local.partial-or-capability-crossing-evidence",
      "kokomiSourceLocal.currentReport",
      "The Kokomi checkpoint lost its exact one-selected/four-holdout boundary or crossed a prohibited computation boundary.",
    );
    return [];
  }

  const actualSelectedIds = report.selectedOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    stableJson(actualSelectedIds) !==
      stableJson([KOKOMI_SOURCE_LOCAL_SELECTED_OCCURRENCE_ID]) ||
    stableJson(sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds) !==
      stableJson([KOKOMI_SOURCE_LOCAL_SELECTED_OCCURRENCE_ID])
  ) {
    addIssue(
      issues,
      "kokomi-source-local.selected-occurrence-scope-drift",
      "kokomiSourceLocal.currentReport.selectedOccurrences",
      "The Kokomi typed slice must remain limited to the one exact team-member artifact occurrence.",
    );
    return [];
  }

  const expectedHoldoutById = new Map<
    string,
    (typeof KOKOMI_SOURCE_LOCAL_EXPECTED_HOLDOUTS)[number]
  >(
    KOKOMI_SOURCE_LOCAL_EXPECTED_HOLDOUTS.map((holdout) => [
      holdout.occurrenceId,
      holdout,
    ]),
  );
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(holdoutIds).size !== 4 ||
    holdoutIds.some((occurrenceId) => actualSelectedIds.includes(occurrenceId)) ||
    stableJson([...holdoutIds].sort()) !==
      stableJson(
        KOKOMI_SOURCE_LOCAL_EXPECTED_HOLDOUTS.map(
          ({ occurrenceId }) => occurrenceId,
        ).sort(),
      ) ||
    report.holdoutOccurrences.some((holdout) => {
      const expected = expectedHoldoutById.get(holdout.occurrenceId);
      return (
        expected == null ||
        holdout.conditions.length === 0 ||
        holdout.conditionsSha256 !== expected.conditionsSha256 ||
        holdout.conditionsSha256 !== sha256Text(stableJson(holdout.conditions)) ||
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.consumedBySlice ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice
      );
    })
  ) {
    addIssue(
      issues,
      "kokomi-source-local.selected-holdout-partition-drift",
      "kokomiSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected and four holdout occurrences must remain unique, disjoint, unconsumed, and unauthored by the slice.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "kokomi-source-local.duplicate-source-claim",
    "kokomiSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "kokomi-source-local.duplicate-condition-control",
    "kokomiSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];
  if (claimById.size !== 1 || controlById.size !== 1) {
    addIssue(
      issues,
      "kokomi-source-local.partial-or-capability-crossing-evidence",
      "kokomiSourceLocal.currentReport.sourceLocalSlice",
      "The Kokomi source-local slice must expose exactly one source claim and one condition control.",
    );
    return [];
  }

  const selected = report.selectedOccurrences[0]!;
  const claim = claimById.get(selected.occurrenceId);
  const control = controlById.get(selected.occurrenceId);
  if (
    selected.occurrenceId !== KOKOMI_SOURCE_LOCAL_SELECTED_OCCURRENCE_ID ||
    selected.characterId !== "sangonomiya_kokomi" ||
    selected.memberIndex !== 0 ||
    selected.sourceRecordId !== KOKOMI_SOURCE_LOCAL_SOURCE_RECORD_ID ||
    selected.repositoryRecordId !==
      KOKOMI_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
    selected.manualClaimPath !==
      "members[0].artifactRecommendations[0].conditions" ||
    selected.repositoryPath !== selected.manualClaimPath ||
    selected.claimAxis !== "artifact-recommendation" ||
    stableJson(selected.conditions) !==
      stableJson(KOKOMI_SOURCE_LOCAL_SELECTED_CONDITIONS) ||
    selected.conditionsSha256 !==
      KOKOMI_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 ||
    stableJson(selected.predicate) !==
      stableJson(KOKOMI_SOURCE_LOCAL_SELECTED_PREDICATE) ||
    selected.predicateSha256 !==
      KOKOMI_SOURCE_LOCAL_SELECTED_PREDICATE_SHA256 ||
    stableJson(selected.payload) !==
      stableJson(KOKOMI_SOURCE_LOCAL_SELECTED_PAYLOAD) ||
    selected.payloadSha256 !== KOKOMI_SOURCE_LOCAL_SELECTED_PAYLOAD_SHA256 ||
    claim == null ||
    claim.catalogIndex !== 0 ||
    stableJson(claim.recommendation) !==
      stableJson(KOKOMI_SOURCE_LOCAL_EXPECTED_RECOMMENDATION) ||
    control == null ||
    control.catalogIndex !== 0 ||
    control.requestBindings.length !== 0
  ) {
    addIssue(
      issues,
      "kokomi-source-local.conflicting-occurrence-evidence",
      `kokomiSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
      "The selected Kokomi occurrence drifted from its exact literal condition, ordered roster predicate, artifact payload, source metadata, or zero-request-binding boundary.",
    );
    return [];
  }

  const entry = buildSourceLocalCatalogEntry(
    {
      diagnosticCode: "kokomi-source-local.conflicting-occurrence-evidence",
      diagnosticPath: `kokomiSourceLocal.currentReport.selectedOccurrences.${selected.occurrenceId}`,
      diagnosticMessage:
        "The selected occurrence, source claim, condition control, predicate, payload, and exact source identity do not agree.",
      sliceId: report.sliceId,
      sourceId: "kqm",
      recordKind: "team",
      subject: "sangonomiya_kokomi",
      selected,
      claim,
      control,
    },
    issues,
  );
  return entry ? [entry] : [];
}

function extractNoelleSourceLocalEntries(
  report: NoelleSourceLocalHighInvestmentSliceReport,
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry[] {
  const sourceLocalSlice = report.sourceLocalSlice;
  const requestContextReport = sourceLocalSlice?.requestContextReport ?? null;
  if (
    report.comparisonStatus !== "comparable" ||
    report.reportType !== "noelle-source-local-high-investment-slice" ||
    report.classification !==
      "authenticated-source-local-condition-binding-slice" ||
    report.publicationStatus !== "withheld-unreviewed-source-slice" ||
    report.sliceId !== NOELLE_SOURCE_LOCAL_SLICE_ID ||
    report.issues.length !== 0 ||
    sourceLocalSlice == null ||
    sourceLocalSlice.comparisonStatus !== "comparable" ||
    requestContextReport == null ||
    requestContextReport.comparisonStatus !== "comparable"
  ) {
    addIssue(
      issues,
      "noelle-source-local.non-comparable",
      "noelleSourceLocal.currentReport",
      "The Noelle source-local report is not the expected comparable authenticated numeric slice.",
    );
    return [];
  }

  const expectedSelectedIds =
    NOELLE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.map(
      ({ occurrenceId }) => occurrenceId,
    );
  const expectedTeamControl = {
    packetIndex: 0,
    teamRecordId: NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID,
    snapshotPath: NOELLE_SOURCE_LOCAL_SNAPSHOT_PATH,
    sourceId: "kqm",
    sourceRecordId:
      "noelle-durin-nicole-xilonen-hexerei-example-luna-viii",
    label: "Noelle — Durin — Nicole — Xilonen",
    intent: "example",
    exhaustiveness: "non-exhaustive",
    rankingClaim: "none",
    memberCharacterIds: ["noelle", "durin", "nicole", "xilonen"],
  };
  if (
    report.arbitraryEnglishParsingAllowed !== false ||
    report.supportsSourceAuthorization !== false ||
    report.supportsGuideClaims !== false ||
    report.supportsTeamRecommendations !== false ||
    report.supportsBuildRecommendations !== false ||
    report.supportsEquipmentRecommendations !== false ||
    report.supportsStatRecommendations !== false ||
    report.supportsRankClaims !== false ||
    report.supportsDamageClaims !== false ||
    report.supportsRotationClaims !== false ||
    report.supportsEnergyRecoveryClaims !== false ||
    report.conditionTruthEstablishedFromRecommendationMetadata !== false ||
    report.recommendationCompositionExecuted !== false ||
    report.candidateGenerationExecuted !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.artifactAssignmentExecuted !== false ||
    report.equipmentAssignmentExecuted !== false ||
    report.teamCompositionExecuted !== false ||
    report.buildCompositionExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.rotationComputationExecuted !== false ||
    report.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.supportsSourceAuthorization !== false ||
    sourceLocalSlice.supportsGuideClaims !== false ||
    sourceLocalSlice.supportsTeamRecommendations !== false ||
    sourceLocalSlice.supportsBuildRecommendations !== false ||
    sourceLocalSlice.supportsStatRecommendations !== false ||
    sourceLocalSlice.supportsRankClaims !== false ||
    sourceLocalSlice.supportsDamageClaims !== false ||
    sourceLocalSlice.supportsRotationClaims !== false ||
    sourceLocalSlice.supportsEnergyRecoveryClaims !== false ||
    sourceLocalSlice.playerFacingRecommendations !== false ||
    sourceLocalSlice.ranking !== false ||
    sourceLocalSlice.buildComposition !== false ||
    sourceLocalSlice.damage !== false ||
    sourceLocalSlice.formulas !== false ||
    sourceLocalSlice.rotations !== false ||
    sourceLocalSlice.ER !== false ||
    sourceLocalSlice.recommendationCompositionExecuted !== false ||
    sourceLocalSlice.generatorExecuted !== false ||
    sourceLocalSlice.optimizerExecuted !== false ||
    sourceLocalSlice.damageComputationExecuted !== false ||
    sourceLocalSlice.energyRecoveryComputationExecuted !== false ||
    sourceLocalSlice.assembledBuildCount !== 0 ||
    sourceLocalSlice.issues.length !== 0 ||
    sourceLocalSlice.sliceId !== report.sliceId ||
    !hasExactNoelleSnapshotHash(report.generatedFrom) ||
    !hasExactNoelleSnapshotHash(sourceLocalSlice.generatedFrom) ||
    sha256Text(stableJson(report.generatedFrom)) !==
      NOELLE_SOURCE_LOCAL_GENERATED_FROM_SHA256 ||
    sha256Text(stableJson(sourceLocalSlice.generatedFrom)) !==
      NOELLE_SOURCE_LOCAL_GENERATED_FROM_SHA256 ||
    sha256Text(stableJson(report.rawInputBoundary)) !==
      NOELLE_SOURCE_LOCAL_RAW_INPUT_BOUNDARY_SHA256 ||
    sha256Text(stableJson(sourceLocalSlice.compositionPolicy)) !==
      NOELLE_SOURCE_LOCAL_COMPOSITION_POLICY_SHA256 ||
    sha256Text(stableJson(requestContextReport)) !==
      NOELLE_SOURCE_LOCAL_REQUEST_CONTEXT_REPORT_SHA256 ||
    report.rawInputBoundary.status !== "accepted" ||
    !report.rawInputBoundary.exactPathSet ||
    !report.rawInputBoundary.byteAndParsedObjectClosure ||
    report.rawInputBoundary.sourceFileCount !== 4 ||
    sourceLocalSlice.sourceDocumentBoundary.status !== "accepted" ||
    sourceLocalSlice.sourceDocumentBoundary.sourceId !== "kqm" ||
    sourceLocalSlice.sourceDocumentBoundary.pageUrl !==
      NOELLE_SOURCE_LOCAL_PAGE_URL ||
    sourceLocalSlice.sourceDocumentBoundary.sourceVersion !==
      NOELLE_SOURCE_LOCAL_SOURCE_VERSION ||
    sourceLocalSlice.sourceDocumentBoundary.snapshotPath !==
      NOELLE_SOURCE_LOCAL_SNAPSHOT_PATH ||
    stableJson(sourceLocalSlice.sourceDocumentBoundary.exactOccurrenceIds) !==
      stableJson(expectedSelectedIds) ||
    stableJson(sourceLocalSlice.sourceDocumentBoundary.exactTeamRecordIds) !==
      stableJson([NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID]) ||
    !sourceLocalSlice.sourceDocumentBoundary
      .allClaimsAndTeamsShareExactSourceDocument ||
    sourceLocalSlice.exactTeamControls.length !== 1 ||
    stableJson(sourceLocalSlice.exactTeamControls[0]) !==
      stableJson(expectedTeamControl) ||
    report.sourceBoundary.status !== "accepted" ||
    report.sourceBoundary.sourceId !== "kqm" ||
    report.sourceBoundary.pageUrl !== NOELLE_SOURCE_LOCAL_PAGE_URL ||
    report.sourceBoundary.sourceVersion !== NOELLE_SOURCE_LOCAL_SOURCE_VERSION ||
    report.sourceBoundary.snapshotPath !== NOELLE_SOURCE_LOCAL_SNAPSHOT_PATH ||
    stableJson([...report.sourceBoundary.rawRecordIds].sort()) !==
      stableJson([...NOELLE_SOURCE_LOCAL_RAW_RECORD_IDS].sort()) ||
    report.sourceBoundary.rawRecordCount !== 5 ||
    report.sourceBoundary.totalConditionArrayCount !== 16 ||
    report.sourceBoundary.nonemptyConditionArrayCount !== 15 ||
    report.sourceBoundary.emptyConditionArrayCount !== 1 ||
    report.sourceBoundary.selectedOccurrenceCount !== 3 ||
    report.sourceBoundary.holdoutOccurrenceCount !== 12 ||
    !report.sourceBoundary.selectedAndHoldoutsCloseAllNonemptyNoelleConditions ||
    !report.sourceBoundary.emptyOccurrenceClosureExact ||
    report.sourceBoundary.repositoryParity !== "exact" ||
    !report.sourceBoundary.samePageLineage ||
    !report.sourceBoundary.guideAndTeamShareExactSourceDocument ||
    !report.sourceBoundary.crossRecordJoinOwnedByWrapper ||
    report.sourceBoundary.sourceAuthoredCrossRecordJoin !== false ||
    report.sourceBoundary.extractionMethod !== "agent-assisted" ||
    report.sourceBoundary.reviewStatus !== "unreviewed" ||
    report.sourceBoundary.sourceRegistryStatus !== "active" ||
    report.sourceBoundary.sourceRegistryIngestionMode !==
      "manual-observation" ||
    report.sourceBoundary.sourceRegistryPermission !== "unknown" ||
    report.sourceBoundary.promotionEligible !== false ||
    stableJson(report.numericEvaluationBoundary) !==
      stableJson({
        sourcePredicateAstPreserved: true,
        sourceTalentLevelsEvaluated: false,
        requestOverlayOwnsNumericEvaluation: true,
        constellationDerivedTalentBehavior: false,
        requestPredicateSha256:
          NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE_SHA256,
      }) ||
    report.selectedOccurrences.length !== 3 ||
    report.holdoutOccurrences.length !== 12 ||
    report.emptyOccurrences.length !== 1 ||
    report.summary.totalConditionArrayCount !== 16 ||
    report.summary.nonemptyConditionArrayCount !== 15 ||
    report.summary.emptyConditionArrayCount !== 1 ||
    report.summary.selectedOccurrenceCount !== 3 ||
    report.summary.selectedUniqueConditionArrayCount !== 1 ||
    report.summary.holdoutOccurrenceCount !== 12 ||
    report.summary.sourceTeamCount !== 1 ||
    report.summary.sourceCellCount !== 3 ||
    report.summary.sourceMatchedCount !== 0 ||
    report.summary.sourceInapplicableCount !== 0 ||
    report.summary.sourceUnresolvedCount !== 3 ||
    report.summary.contextApplicableCount !== 3 ||
    report.summary.sourceAlreadyMatchedCount !== 0 ||
    report.summary.sourceDefinitelyInapplicableCount !== 0 ||
    report.summary.effectiveMatchedCount !== 3 ||
    report.summary.effectiveInapplicableCount !== 0 ||
    report.summary.effectiveUnresolvedCount !== 0 ||
    report.summary.selectedNotEnergyDeferredCount !== 3 ||
    report.summary.holdoutConsumedCount !== 0 ||
    report.summary.holdoutBindingAuthoredCount !== 0 ||
    report.summary.holdoutEnergyClassificationAuthoredCount !== 0 ||
    report.summary.emptyConsumedCount !== 0 ||
    report.summary.candidateCount !== 0 ||
    report.summary.equipmentAssignmentCount !== 0 ||
    report.summary.optimizationCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    sourceLocalSlice.summary.claimCount !== 3 ||
    sourceLocalSlice.summary.teamCount !== 1 ||
    sourceLocalSlice.summary.cellCount !== 3 ||
    sourceLocalSlice.summary.sourceMatchedCount !== 0 ||
    sourceLocalSlice.summary.sourceInapplicableCount !== 0 ||
    sourceLocalSlice.summary.sourceUnresolvedCount !== 3 ||
    sourceLocalSlice.summary.applicableUnderSuppliedContextCount !== 3 ||
    sourceLocalSlice.summary.notApplicableUnderSuppliedContextCount !== 0 ||
    sourceLocalSlice.summary.stillUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.sourceAlreadyMatchedCount !== 0 ||
    sourceLocalSlice.summary.sourceDefinitelyInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveMatchedCount !== 3 ||
    sourceLocalSlice.summary.effectiveInapplicableCount !== 0 ||
    sourceLocalSlice.summary.effectiveUnresolvedCount !== 0 ||
    sourceLocalSlice.summary.deferredEnergyCount !== 0 ||
    sourceLocalSlice.summary.assembledBuildCount !== 0 ||
    !matchesExactNoelleRequestProjection(sourceLocalSlice, expectedSelectedIds)
  ) {
    addIssue(
      issues,
      "noelle-source-local.partial-or-capability-crossing-evidence",
      "noelleSourceLocal.currentReport",
      "The Noelle checkpoint lost its exact three-selected/twelve-holdout/one-empty numeric boundary or crossed a prohibited computation capability.",
    );
    return [];
  }

  const selectedIds = report.selectedOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  if (
    new Set(selectedIds).size !== 3 ||
    stableJson(selectedIds) !== stableJson(expectedSelectedIds)
  ) {
    addIssue(
      issues,
      "noelle-source-local.selected-occurrence-scope-drift",
      "noelleSourceLocal.currentReport.selectedOccurrences",
      "The Noelle typed slice must remain limited to the three exact high-investment main-stat occurrences.",
    );
    return [];
  }

  const expectedHoldoutById = new Map<
    string,
    {
      occurrenceId: string;
      conditionsSha256: string;
      objectSha256: string;
    }
  >(
    NOELLE_SOURCE_LOCAL_EXPECTED_HOLDOUTS.map(
      ([occurrenceId, conditionsSha256, objectSha256]) => [
        occurrenceId,
        { occurrenceId, conditionsSha256, objectSha256 },
      ],
    ),
  );
  const holdoutIds = report.holdoutOccurrences.map(
    ({ occurrenceId }) => occurrenceId,
  );
  const empty = report.emptyOccurrences[0];
  if (
    new Set(holdoutIds).size !== 12 ||
    holdoutIds.some((occurrenceId) => selectedIds.includes(occurrenceId)) ||
    stableJson([...holdoutIds].sort()) !==
      stableJson([...expectedHoldoutById.keys()].sort()) ||
    report.holdoutOccurrences.some((holdout) => {
      const expected = expectedHoldoutById.get(holdout.occurrenceId);
      return (
        expected == null ||
        holdout.occurrenceId !==
          `kqm:character_guide:${holdout.sourceRecordId}:${holdout.manualClaimPath}` ||
        holdout.repositoryRecordId !==
          `kqm:character-guide:${holdout.sourceRecordId}` ||
        holdout.repositoryPath !==
          holdout.manualClaimPath.replace(
            /^recommendation\./,
            "recommendations[0].",
          ) ||
        holdout.claimAxis !==
          expectedNoelleClaimAxis(holdout.manualClaimPath) ||
        holdout.mainStatSlot !==
          expectedNoelleMainStatSlot(holdout.manualClaimPath) ||
        holdout.conditions.length === 0 ||
        holdout.conditionsSha256 !== expected.conditionsSha256 ||
        holdout.conditionsSha256 !== sha256Text(stableJson(holdout.conditions)) ||
        sha256Text(stableJson(holdout)) !== expected.objectSha256 ||
        holdout.structuralEnergyDimension !== "not-structural-er" ||
        holdout.repositoryParity !== "exact" ||
        holdout.sliceDisposition !== "holdout" ||
        holdout.consumedBySlice ||
        holdout.bindingAuthoredBySlice ||
        holdout.energyClassificationAuthoredBySlice
      );
    }) ||
    empty == null ||
    empty.occurrenceId !== NOELLE_SOURCE_LOCAL_EXPECTED_EMPTY.occurrenceId ||
    empty.occurrenceId !==
      `kqm:character_guide:${empty.sourceRecordId}:${empty.manualClaimPath}` ||
    empty.repositoryRecordId !== `kqm:character-guide:${empty.sourceRecordId}` ||
    empty.repositoryPath !==
      empty.manualClaimPath.replace(
        /^recommendation\./,
        "recommendations[0].",
      ) ||
    empty.claimAxis !== "artifact-recommendation" ||
    empty.conditions.length !== 0 ||
    empty.conditionsSha256 !==
      NOELLE_SOURCE_LOCAL_EXPECTED_EMPTY.conditionsSha256 ||
    empty.conditionsSha256 !== sha256Text(stableJson(empty.conditions)) ||
    sha256Text(stableJson(empty)) !==
      NOELLE_SOURCE_LOCAL_EXPECTED_EMPTY.objectSha256 ||
    empty.repositoryParity !== "exact" ||
    empty.sliceDisposition !== "empty-unconditional" ||
    empty.consumedBySlice ||
    empty.bindingAuthoredBySlice ||
    empty.energyClassificationAuthoredBySlice
  ) {
    addIssue(
      issues,
      "noelle-source-local.selected-holdout-empty-partition-drift",
      "noelleSourceLocal.currentReport.holdoutOccurrences",
      "The exact selected, twelve holdout, and one empty occurrences must remain unique, disjoint, unconsumed, and unauthored outside the selected slice.",
    );
    return [];
  }

  const claimById = exactSingleRowsById(
    sourceLocalSlice.sourceClaimCatalog,
    ({ claimId }) => claimId,
    "noelle-source-local.duplicate-source-claim",
    "noelleSourceLocal.currentReport.sourceLocalSlice.sourceClaimCatalog",
    issues,
  );
  const controlById = exactSingleRowsById(
    sourceLocalSlice.conditionControls,
    ({ claimId }) => claimId,
    "noelle-source-local.duplicate-condition-control",
    "noelleSourceLocal.currentReport.sourceLocalSlice.conditionControls",
    issues,
  );
  if (issues.length > 0) return [];
  if (claimById.size !== 3 || controlById.size !== 3) {
    addIssue(
      issues,
      "noelle-source-local.partial-or-capability-crossing-evidence",
      "noelleSourceLocal.currentReport.sourceLocalSlice",
      "The Noelle source-local slice must expose exactly three source claims and three condition controls.",
    );
    return [];
  }

  const selectedById = new Map(
    report.selectedOccurrences.map((selected) => [
      selected.occurrenceId,
      selected,
    ]),
  );
  const entries: CurrentConditionBindingCatalogEntry[] = [];
  for (const [catalogIndex, expected] of
    NOELLE_SOURCE_LOCAL_EXPECTED_SELECTED_OCCURRENCES.entries()) {
    const selected = selectedById.get(expected.occurrenceId);
    const claim = claimById.get(expected.occurrenceId);
    const control = controlById.get(expected.occurrenceId);
    const requestBinding = control?.requestBindings[0];
    if (
      selected == null ||
      selected.characterId !== "noelle" ||
      selected.sourceRecordId !== NOELLE_SOURCE_LOCAL_SOURCE_RECORD_ID ||
      selected.repositoryRecordId !==
        NOELLE_SOURCE_LOCAL_REPOSITORY_RECORD_ID ||
      selected.manualClaimPath !== expected.manualClaimPath ||
      selected.repositoryPath !== expected.repositoryPath ||
      selected.claimAxis !== "main-stat" ||
      selected.mainStatSlot !== expected.mainStatSlot ||
      stableJson(selected.conditions) !==
        stableJson(NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS) ||
      selected.conditionsSha256 !==
        NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 ||
      stableJson(selected.predicate) !==
        stableJson(NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE) ||
      selected.predicateSha256 !==
        NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 ||
      selected.sourcePredicateLeafSha256 !==
        NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 ||
      stableJson(selected.requestPredicate) !==
        stableJson(NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE) ||
      selected.requestPredicateSha256 !==
        NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE_SHA256 ||
      stableJson(selected.payload) !== stableJson(expected.payload) ||
      selected.payloadSha256 !== expected.payloadSha256 ||
      sha256Text(stableJson(selected)) !== expected.selectedObjectSha256 ||
      claim == null ||
      sha256Text(stableJson(claim)) !== expected.claimObjectSha256 ||
      claim.catalogIndex !== catalogIndex ||
      stableJson(claim.recommendation) !==
        stableJson(NOELLE_SOURCE_LOCAL_EXPECTED_RECOMMENDATION) ||
      control == null ||
      sha256Text(stableJson(control)) !== expected.controlObjectSha256 ||
      control.catalogIndex !== catalogIndex ||
      control.requestBindings.length !== 1 ||
      requestBinding == null ||
      requestBinding.sourcePredicatePath !== "predicate" ||
      requestBinding.sourcePredicateLeafSha256 !==
        NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 ||
      stableJson(requestBinding.requestPredicate) !==
        stableJson(NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE)
    ) {
      addIssue(
        issues,
        "noelle-source-local.conflicting-occurrence-evidence",
        `noelleSourceLocal.currentReport.selectedOccurrences.${expected.occurrenceId}`,
        "The selected Noelle occurrence drifted from its exact literal, payload, unresolved source predicate, numeric request predicate, recommendation metadata, or request-binding boundary.",
      );
      return [];
    }
    const entry = buildSourceLocalCatalogEntry(
      {
        diagnosticCode: "noelle-source-local.conflicting-occurrence-evidence",
        diagnosticPath: `noelleSourceLocal.currentReport.selectedOccurrences.${expected.occurrenceId}`,
        diagnosticMessage:
          "The selected occurrence, source claim, condition control, source predicate, payload, and exact source identity do not agree.",
        sliceId: report.sliceId,
        sourceId: "kqm",
        recordKind: "character_guide",
        subject: "noelle",
        selected,
        claim,
        control,
      },
      issues,
    );
    if (entry) entries.push(entry);
  }
  return entries;
}

function matchesExactNoelleRequestProjection(
  sourceLocalSlice: SourceLocalConditionSliceReport,
  expectedSelectedIds: readonly string[],
): boolean {
  const report = sourceLocalSlice.requestContextReport;
  const teamProjection = report?.teamProjections[0];
  const sourceCellPacket = sourceLocalSlice.sourceClaimCells[0];
  const exactScope = {
    teamRecordId: NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID,
    characterId: "noelle",
    accountSnapshotId: null,
  };
  if (
    report == null ||
    report.reportType !== "guide-request-context-applicability" ||
    report.projectionId !== `${NOELLE_SOURCE_LOCAL_SLICE_ID}:request-context` ||
    report.classification !== "request-account-context-refinement-overlay" ||
    report.publicationStatus !== "withheld-experimental-context" ||
    report.issues.length !== 0 ||
    report.contextProjectionExecuted !== true ||
    report.sourceCellsMutated !== false ||
    report.supportsSourceAuthorization !== false ||
    report.supportsGuideClaims !== false ||
    report.supportsAccountAdvice !== false ||
    report.playerFacingRecommendations !== false ||
    report.ranking !== false ||
    report.optimality !== false ||
    report.buildComposition !== false ||
    report.damage !== false ||
    report.formulas !== false ||
    report.rotations !== false ||
    report.ER !== false ||
    report.baselineEquipmentUsed !== false ||
    report.axesMultipliedIntoBuilds !== false ||
    report.generatorExecuted !== false ||
    report.optimizerExecuted !== false ||
    report.damageComputationExecuted !== false ||
    report.energyRecoveryInputsUsed !== false ||
    stableJson(report.policyBoundary) !==
      stableJson({
        sourceControlPreserved: true,
        requestContextMayResolveOnlyMappedUnresolvedContext: true,
        requestContextMaySatisfyExactSourceTeamFacts: false,
        omittedFacts: "unknown",
        missingWeaponInCompleteInventory: "false",
        missingWeaponInIncompleteInventory: "unknown",
      }) ||
    stableJson(report.context) !==
      stableJson({
        requestFactsByTeamRecordId: {
          [NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID]: {
            characterFactsById: { noelle: { constellation: 6 } },
          },
        },
      }) ||
    report.factProvenance.constellation !== "request" ||
    report.factProvenance.talentLevels !== "request" ||
    report.claimRules.length !== 3 ||
    !expectedSelectedIds.every((claimId) => {
      const matchingRules = report.claimRules.filter(
        (rule) => rule.claimId === claimId,
      );
      const rule = matchingRules[0];
      const binding = rule?.bindings[0];
      return (
        matchingRules.length === 1 &&
        rule?.sourceConditionsSha256 ===
          NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 &&
        rule.sourcePredicateSha256 ===
          NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 &&
        rule.bindings.length === 1 &&
        binding?.sourcePredicatePath === "predicate" &&
        binding.sourcePredicateLeafSha256 ===
          NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE_SHA256 &&
        stableJson(binding.requestPredicate) ===
          stableJson(NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE)
      );
    }) ||
    report.summary.matchedCellCount !== 3 ||
    report.summary.inapplicableCellCount !== 0 ||
    report.summary.unresolvedCellCount !== 0 ||
    report.summary.deferredEnergyCellCount !== 0 ||
    report.summary.assembledBuildCount !== 0 ||
    report.sourceControl.experimentId !== NOELLE_SOURCE_LOCAL_SLICE_ID ||
    report.sourceControl.comparisonStatus !== "comparable" ||
    report.sourceControl.reportType !==
      "source-conditioned-guide-packet-report" ||
    report.sourceControl.sourceClaimCount !== 3 ||
    report.sourceControl.claimCellCount !== 3 ||
    report.sourceControl.packetCount !== 1 ||
    report.teamProjections.length !== 1 ||
    teamProjection == null ||
    teamProjection.teamRecordId !== NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID ||
    stableJson(teamProjection.claimProjections.map(({ claimId }) => claimId)) !==
      stableJson(expectedSelectedIds) ||
    sourceLocalSlice.sourceClaimCells.length !== 1 ||
    sourceCellPacket == null ||
    sourceCellPacket.teamRecordId !== NOELLE_SOURCE_LOCAL_TEAM_RECORD_ID ||
    stableJson(sourceCellPacket.claimCells.map(({ claimId }) => claimId)) !==
      stableJson(expectedSelectedIds)
  ) {
    return false;
  }

  return (
    sourceCellPacket.claimCells.every(
      ({ resolution, sourceConditionsSha256, predicateRows }) =>
        resolution === "unresolved-context" &&
        sourceConditionsSha256 ===
          NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 &&
        stableJson(predicateRows) ===
          stableJson([
            {
              predicatePath: "predicate",
              predicateType: "unresolved-context",
              reason: NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE.reason,
              result: "unknown",
              structuredFact: "none-unresolved-context",
            },
          ]),
    ) &&
    teamProjection.claimProjections.every((projection) => {
      const binding = projection.requestContextBindings[0];
      const constellationRow = binding?.predicateRows[0];
      const burstRow = binding?.predicateRows[1];
      return (
        projection.resolution === "matched" &&
        projection.contextApplicability ===
          "applicable-under-supplied-context" &&
        projection.sourceControl.resolution === "unresolved-context" &&
        projection.sourceControl.sourceConditionsSha256 ===
          NOELLE_SOURCE_LOCAL_SELECTED_CONDITIONS_SHA256 &&
        stableJson(projection.sourceControl.predicateRows) ===
          stableJson([
            {
              predicatePath: "predicate",
              predicateType: "unresolved-context",
              reason: NOELLE_SOURCE_LOCAL_SOURCE_PREDICATE.reason,
              result: "unknown",
              structuredFact: "none-unresolved-context",
            },
          ]) &&
        projection.requestContextBindings.length === 1 &&
        binding?.sourcePredicatePath === "predicate" &&
        binding.sourceContextCategory === "investment-threshold" &&
        binding.result === "true" &&
        stableJson(binding.requestPredicate) ===
          stableJson(NOELLE_SOURCE_LOCAL_REQUEST_PREDICATE) &&
        binding.predicateRows.length === 2 &&
        constellationRow?.predicatePath ===
          "requestPredicate.predicates[0]" &&
        constellationRow.predicateType === "constellation-at-least" &&
        constellationRow.result === "true" &&
        constellationRow.factProvenance === "request" &&
        stableJson(constellationRow.factScope) === stableJson(exactScope) &&
        burstRow?.predicatePath === "requestPredicate.predicates[1]" &&
        burstRow.predicateType === "talent-level-at-least" &&
        burstRow.result === "unknown" &&
        burstRow.factProvenance === "request" &&
        stableJson(burstRow.factScope) === stableJson(exactScope)
      );
    })
  );
}

function hasExactNoelleSnapshotHash(
  generatedFrom: readonly { path: string; sha256: string }[],
): boolean {
  const matches = generatedFrom.filter(
    ({ path }) => path === NOELLE_SOURCE_LOCAL_SNAPSHOT_PATH,
  );
  return (
    matches.length === 1 &&
    matches[0]?.sha256 === NOELLE_SOURCE_LOCAL_SNAPSHOT_SHA256
  );
}

function expectedNoelleClaimAxis(
  manualClaimPath: string,
): "main-stat" | "substat" | "weapon-recommendation" | null {
  if (manualClaimPath.includes(".mainStats.")) return "main-stat";
  if (manualClaimPath.includes(".substats[")) return "substat";
  if (manualClaimPath.includes(".weaponRecommendations[")) {
    return "weapon-recommendation";
  }
  return null;
}

function expectedNoelleMainStatSlot(
  manualClaimPath: string,
): "sands" | "goblet" | "circlet" | undefined {
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    if (manualClaimPath.includes(`.mainStats.${slot}[`)) return slot;
  }
  return undefined;
}

function exactSingleRowsById<T>(
  rows: readonly T[],
  id: (row: T) => string,
  duplicateCode: string,
  path: string,
  issues: CurrentConditionBindingCatalogIssue[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const rowId = id(row);
    if (result.has(rowId)) {
      addIssue(
        issues,
        duplicateCode,
        `${path}.${rowId}`,
        `Expected one authenticated row for ${rowId}.`,
      );
    } else {
      result.set(rowId, row);
    }
  }
  return result;
}

interface SourceLocalSelectedOccurrenceForCatalog {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  claimAxis: string;
  conditions: string[];
  conditionsSha256: string;
  payload: SourceConditionedClaimPayload;
  payloadSha256: string;
  predicate: SourceConditionPredicateAst;
  predicateSha256: string;
  repositoryParity: "exact";
  sliceDisposition: "selected";
  bindingAuthoredBySlice: true;
  sliceBindingClassification: "typed-bound";
  energyClassificationAuthoredBySlice: true;
  sliceEnergyClassification: "not-energy-deferred";
}

function buildSourceLocalCatalogEntry(
  input: {
    diagnosticCode: string;
    diagnosticPath: string;
    diagnosticMessage: string;
    sliceId: string;
    sourceId: string;
    recordKind: "character_guide" | "team";
    subject: string;
    selected: SourceLocalSelectedOccurrenceForCatalog;
    claim:
      | SourceLocalConditionSliceReport["sourceClaimCatalog"][number]
      | undefined;
    control:
      | SourceLocalConditionSliceReport["conditionControls"][number]
      | undefined;
  },
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogEntry | null {
  const { selected, claim, control } = input;
  const conditionsSha256 = sha256Text(stableJson(selected.conditions));
  const predicateAstSha256 = sha256Text(stableJson(selected.predicate));
  const payloadSha256 = sha256Text(stableJson(selected.payload));
  const expectedOccurrenceId = buildCurrentConditionArrayOccurrenceId({
    sourceId: input.sourceId,
    recordKind: input.recordKind,
    sourceRecordId: selected.sourceRecordId,
    manualClaimPath: selected.manualClaimPath,
  });
  if (
    selected.occurrenceId !== expectedOccurrenceId ||
    selected.conditions.length === 0 ||
    selected.conditionsSha256 !== conditionsSha256 ||
    selected.predicateSha256 !== predicateAstSha256 ||
    selected.payloadSha256 !== payloadSha256 ||
    selected.repositoryParity !== "exact" ||
    selected.sliceDisposition !== "selected" ||
    !selected.bindingAuthoredBySlice ||
    selected.sliceBindingClassification !== "typed-bound" ||
    !selected.energyClassificationAuthoredBySlice ||
    selected.sliceEnergyClassification !== "not-energy-deferred" ||
    claim == null ||
    claim.claimId !== selected.occurrenceId ||
    claim.sourceId !== input.sourceId ||
    claim.sourceRecordId !== selected.sourceRecordId ||
    claim.repositoryRecordId !== selected.repositoryRecordId ||
    claim.characterId !== input.subject ||
    claim.sourceConditionsSha256 !== selected.conditionsSha256 ||
    stableJson(claim.sourceConditions) !== stableJson(selected.conditions) ||
    stableJson(claim.predicate) !== stableJson(selected.predicate) ||
    stableJson(claim.payload) !== stableJson(selected.payload) ||
    control == null ||
    control.claimId !== selected.occurrenceId ||
    control.catalogIndex !== claim.catalogIndex ||
    control.occurrenceControl.occurrenceId !== selected.occurrenceId ||
    control.occurrenceControl.sourceId !== input.sourceId ||
    control.occurrenceControl.sourceRecordId !== selected.sourceRecordId ||
    control.occurrenceControl.repositoryRecordId !==
      selected.repositoryRecordId ||
    control.occurrenceControl.manualClaimPath !== selected.manualClaimPath ||
    control.occurrenceControl.claimAxis !== selected.claimAxis ||
    control.occurrenceControl.sourceConditionsSha256 !==
      selected.conditionsSha256 ||
    control.occurrenceControl.sourcePredicateSha256 !==
      selected.predicateSha256 ||
    control.occurrenceControl.payloadSha256 !== selected.payloadSha256 ||
    control.occurrenceControl.repositoryParity !== "exact" ||
    control.occurrenceControl.sliceDisposition !== "selected" ||
    control.occurrenceControl.energyClassification !== "not-energy-deferred"
  ) {
    addIssue(
      issues,
      input.diagnosticCode,
      input.diagnosticPath,
      input.diagnosticMessage,
    );
    return null;
  }

  const selectedOccurrenceSha256 = sha256Text(stableJson(selected));
  return makeEntry({
    sourceId: input.sourceId,
    recordKind: input.recordKind,
    sourceRecordId: selected.sourceRecordId,
    manualClaimPath: selected.manualClaimPath,
    subject: input.subject,
    orderedConditions: selected.conditions,
    bindingClassification: "typed-bound",
    energyClassification: "not-energy-deferred",
    bindingEvidence: {
      kind: "source-local-typed-predicate-ast",
      sliceId: input.sliceId,
      selectedOccurrenceId: selected.occurrenceId,
      selectedOccurrenceSha256,
      predicateAst: structuredClone(selected.predicate),
      predicateAstSha256,
      payloadSha256,
      occurrenceControlSha256: sha256Text(stableJson(control)),
    },
    energyEvidence: {
      kind: "source-local-not-energy-deferred",
      structuralErEvidencePresent: false,
      energyRelatedWorkDeferred: false,
      sliceId: input.sliceId,
      selectedOccurrenceId: selected.occurrenceId,
      selectedOccurrenceSha256,
    },
  });
}

function makeEntry(input: {
  sourceId: string;
  recordKind: "character_guide" | "character_role" | "team";
  sourceRecordId: string;
  manualClaimPath: string;
  subject: string;
  orderedConditions: readonly string[];
  bindingClassification: CurrentConditionBindingClassification;
  energyClassification: CurrentConditionEnergyClassification;
  bindingEvidence: CurrentConditionBindingEvidence;
  energyEvidence: CurrentConditionEnergyEvidence | null;
}): CurrentConditionBindingCatalogEntry {
  if (input.subject.length === 0) {
    throw new Error("Condition binding subject must be a non-empty string.");
  }
  const orderedConditions = [...input.orderedConditions];
  const conditionsSha256 = sha256Text(stableJson(orderedConditions));
  const identity = {
    sourceId: input.sourceId,
    recordKind: input.recordKind,
    sourceRecordId: input.sourceRecordId,
    manualClaimPath: input.manualClaimPath,
    conditionsSha256,
  };
  return {
    ...identity,
    occurrenceId: buildCurrentConditionArrayOccurrenceId(identity),
    occurrenceKey: buildCurrentConditionArrayOccurrenceKey(identity),
    subject: input.subject,
    orderedConditions,
    bindingClassification: input.bindingClassification,
    energyClassification: input.energyClassification,
    typedBinding: input.bindingClassification === "typed-bound",
    bindingEvidence: input.bindingEvidence,
    energyEvidence: input.energyEvidence,
  };
}

function notEnergyDeferredEvidence(): CurrentConditionEnergyEvidence {
  return {
    kind: "not-energy-deferred",
    structuralErEvidencePresent: false,
    energyRelatedWorkDeferred: false,
  };
}

function deferredEnergyReasons(
  predicate: SourceConditionPredicateAst,
): string[] {
  if (predicate.type === "deferred-energy-prerequisite") {
    return [predicate.reason];
  }
  if (predicate.type !== "all") return [];
  return predicate.predicates.flatMap(deferredEnergyReasons);
}

function validateCombinedEntries(
  entries: readonly CurrentConditionBindingCatalogEntry[],
  issues: CurrentConditionBindingCatalogIssue[],
): void {
  const keyCounts = new Map<string, number>();
  const locatorHashes = new Map<string, Set<string>>();
  for (const entry of entries) {
    keyCounts.set(
      entry.occurrenceKey,
      (keyCounts.get(entry.occurrenceKey) ?? 0) + 1,
    );
    const expectedKey = buildCurrentConditionArrayOccurrenceKey(entry);
    if (entry.occurrenceKey !== expectedKey) {
      addIssue(
        issues,
        "catalog.occurrence-key-mismatch",
        entry.occurrenceKey,
        "The stored occurrence key differs from the canonical composite key.",
      );
    }
    const locatorKey = stableJson({
      sourceId: entry.sourceId,
      recordKind: entry.recordKind,
      sourceRecordId: entry.sourceRecordId,
      manualClaimPath: entry.manualClaimPath,
    });
    const hashes = locatorHashes.get(locatorKey) ?? new Set<string>();
    hashes.add(entry.conditionsSha256);
    locatorHashes.set(locatorKey, hashes);
  }
  for (const [key, count] of keyCounts) {
    if (count !== 1) {
      addIssue(
        issues,
        "catalog.duplicate-occurrence-key",
        key,
        `Expected one binding per exact occurrence key, found ${count}.`,
      );
    }
  }
  for (const [locatorKey, hashes] of locatorHashes) {
    if (hashes.size !== 1) {
      addIssue(
        issues,
        "catalog.conflicting-locator-hashes",
        sha256Text(locatorKey),
        "One source/schema locator maps to conflicting ordered condition arrays.",
      );
    }
  }
  if (entries.length !== 60) {
    addIssue(
      issues,
      "catalog.occurrence-count-drift",
      "entries",
      `Expected 60 authenticated current bindings, found ${entries.length}.`,
    );
  }
}

function summarize(
  entries: readonly CurrentConditionBindingCatalogEntry[],
): CurrentConditionBindingCatalogReport["summary"] {
  const ittoEntries = entries.filter(
    ({ bindingEvidence }) => bindingEvidence.kind === "itto-typed-predicate-ast",
  );
  const keqingEquipmentEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "keqing-equipment-typed-predicate-ids",
  );
  const vvEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "keqing-role-exact-text-acknowledgement",
  );
  const kleeEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === KLEE_SOURCE_LOCAL_SLICE_ID,
  );
  const dionaEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === DIONA_SOURCE_LOCAL_SLICE_ID,
  );
  const kokomiEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === KOKOMI_SOURCE_LOCAL_SLICE_ID,
  );
  const noelleEntries = entries.filter(
    ({ bindingEvidence }) =>
      bindingEvidence.kind === "source-local-typed-predicate-ast" &&
      bindingEvidence.sliceId === NOELLE_SOURCE_LOCAL_SLICE_ID,
  );
  return {
    occurrenceCount: entries.length,
    bindingClassificationCounts: countBy(
      entries,
      "bindingClassification",
      ["typed-bound", "exact-text-acknowledged", "unbound", "invalid"],
    ),
    energyClassificationCounts: countBy(entries, "energyClassification", [
      "energy-unclassified",
      "not-energy-deferred",
      "structural-er",
      "deferred-energy-prerequisite",
      "exact-authored-energy-related-deferral",
    ]),
    typedBindingCount: entries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    ittoOccurrenceCount: ittoEntries.length,
    ittoTypedBindingCount: ittoEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    ittoDeferredEnergyPrerequisiteCount: ittoEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "deferred-energy-prerequisite",
    ).length,
    keqingEquipmentOccurrenceCount: keqingEquipmentEntries.length,
    keqingEquipmentAtomicClaimCount: keqingEquipmentEntries.reduce(
      (count, { bindingEvidence }) =>
        count +
        (bindingEvidence.kind === "keqing-equipment-typed-predicate-ids"
          ? bindingEvidence.atomicClaimIds.length
          : 0),
      0,
    ),
    keqingVvAcknowledgedOccurrenceCount: vvEntries.length,
    keqingVvExactTextAcknowledgementCount: vvEntries.reduce(
      (count, { bindingEvidence }) =>
        count +
        (bindingEvidence.kind === "keqing-role-exact-text-acknowledgement"
          ? bindingEvidence.acknowledgementCount
          : 0),
      0,
    ),
    keqingVvUnacknowledgedSourceMemberIds: [
      ...KEQING_VV_UNACKNOWLEDGED_SOURCE_MEMBERS,
    ],
    kleeSourceLocalOccurrenceCount: kleeEntries.length,
    kleeSourceLocalTypedBindingCount: kleeEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    kleeSourceLocalNotEnergyDeferredCount: kleeEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
    dionaSourceLocalOccurrenceCount: dionaEntries.length,
    dionaSourceLocalTypedBindingCount: dionaEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    dionaSourceLocalNotEnergyDeferredCount: dionaEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
    kokomiSourceLocalOccurrenceCount: kokomiEntries.length,
    kokomiSourceLocalTypedBindingCount: kokomiEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    kokomiSourceLocalNotEnergyDeferredCount: kokomiEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
    noelleSourceLocalOccurrenceCount: noelleEntries.length,
    noelleSourceLocalTypedBindingCount: noelleEntries.filter(
      ({ typedBinding }) => typedBinding,
    ).length,
    noelleSourceLocalNotEnergyDeferredCount: noelleEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    ).length,
  };
}

function countBy<
  T extends CurrentConditionBindingCatalogEntry,
  K extends
    | "bindingClassification"
    | "energyClassification",
>(
  entries: readonly T[],
  property: K,
  values: readonly T[K][],
): Record<T[K] & string, number> {
  return Object.fromEntries(
    values.map((value) => [
      value,
      entries.filter((entry) => entry[property] === value).length,
    ]),
  ) as Record<T[K] & string, number>;
}

function baseReport(
  authenticationBoundary: CurrentConditionBindingCatalogReport["authenticationBoundary"],
): Omit<
  CurrentConditionBindingCatalogReport,
  "comparisonStatus" | "entries" | "summary" | "issues"
> {
  return {
    schemaVersion: 1,
    reportType: "authenticated-current-condition-binding-catalog",
    publicationStatus: "internal-validation-only",
    supportsGuideClaims: false,
    supportsTeamRecommendations: false,
    supportsEquipmentRecommendations: false,
    supportsStatRecommendations: false,
    supportsRankClaims: false,
    supportsEnergyRecoveryClaims: false,
    energyRecoveryComputationExecuted: false,
    authenticationBoundary,
  };
}

function failedReport(
  authenticationBoundary: CurrentConditionBindingCatalogReport["authenticationBoundary"],
  issues: CurrentConditionBindingCatalogIssue[],
): CurrentConditionBindingCatalogReport {
  return {
    ...baseReport(authenticationBoundary),
    comparisonStatus: "not-comparable",
    entries: [],
    summary: summarize([]),
    issues: issues
      .map((issue) => ({ ...issue }))
      .sort(
        (left, right) =>
          left.path.localeCompare(right.path) ||
          left.code.localeCompare(right.code),
      ),
  };
}

function addIssue(
  issues: CurrentConditionBindingCatalogIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}
