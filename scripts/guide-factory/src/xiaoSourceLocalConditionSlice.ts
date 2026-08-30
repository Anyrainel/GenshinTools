import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildManualConditionArrayCoverageCore,
  type ManualConditionArrayOccurrence,
} from "./manualConditionArrayCoverage";
import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  buildSourceLocalConditionSliceReport,
  type SourceLocalConditionClaimInput,
  type SourceLocalConditionRequestPredicateAst,
  type SourceLocalConditionSliceInput,
  type SourceLocalConditionSliceReport,
  type SourceLocalExactTeamInput,
} from "./sourceLocalConditionSlice";
import type {
  GeneratedFromEntry,
  SourceConditionedAtomicClaim,
  SourceConditionedClaimPayload,
  SourceConditionedGuidePacketIssue,
  SourceConditionPredicateAst,
} from "./sourceConditionedGuidePacket";
import type { ScopedSemanticDependencyAcceptedAudit } from "./scopedSemanticDependency";
import {
  requireXiaoSourceLocalConditionSliceScope,
  XIAO_RAW_RECORD_IDS,
  XIAO_REPOSITORY_RECORD_IDS,
} from "./xiaoSourceLocalConditionSliceScope";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const XIAO_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const XIAO_PAGE_URL = "https://keqingmains.com/xiao/";
const XIAO_SOURCE_VERSION = "Version 5.5";
const XIAO_SLICE_ID =
  "kqm-xiao-ffxx-roster-and-c6-source-local-condition-slice-version-5-5";
const FFXX_SOURCE_RECORD_ID =
  "xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const FFXX_TEAM_ID = `kqm:team:${FFXX_SOURCE_RECORD_ID}`;
const FFXX_ROSTER = ["xiao", "xianyun", "furina", "faruzan"] as const;

const XIANYYUN_ROSTER_PREDICATE = {
  type: "exact-team-roster-includes",
  characterId: "xianyun",
} as const satisfies SourceConditionPredicateAst;
const XIAO_C6_REASON =
  "Xiao's Constellation is not authored by the exact FFXX source-team roster and must be supplied independently by exact team-and-character request context.";
const XIAO_C6_SOURCE_PREDICATE = {
  type: "unresolved-context",
  category: "investment-threshold",
  reason: XIAO_C6_REASON,
} as const satisfies SourceConditionPredicateAst;
const XIAO_C6_REQUEST_PREDICATE = {
  type: "constellation-at-least",
  characterId: "xiao",
  threshold: 6,
} as const satisfies SourceLocalConditionRequestPredicateAst;

type ExactSourceItem = Record<string, unknown>;
type XiaoConditionOccurrence = ManualConditionArrayOccurrence & {
  repositoryJsonPath: string;
};
type SelectedOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
  payloadSha256: string;
  predicateSha256: string;
  exactSourceItem: ExactSourceItem;
  predicate: SourceConditionPredicateAst;
  requestPredicate?: SourceLocalConditionRequestPredicateAst;
  requestPredicateSha256?: string;
};
type OccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
};

const SELECTED_OCCURRENCES: readonly SelectedOccurrenceDefinition[] = [
  {
    occurrenceId:
      "kqm:character_guide:xiao-mh-artifact-branch-version-5-5:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "9825717baca82084a938c6975a810db3faa0650a305175385529638e6652f71b",
    payloadSha256:
      "3f1da28d319a9d68334c22cf1f7998b682159989bf09753aed8935ce3db85fdb",
    predicateSha256:
      "ab21f048d451a2d095ab8958d1fd36defabcea358cb758c1d8fb7d8d32163031",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
      grouping: "single",
      classification: "conditional",
      conditions: [
        "Xiao is played with Xianyun, especially in the Xiao–Xianyun–Furina–Faruzan team.",
      ],
    },
    predicate: XIANYYUN_ROSTER_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[3].conditions",
    conditionsSha256:
      "6783586e02e7954eb8073a1b0f12e79973d8e5a0dfad379fd03ddc0da4a79366",
    payloadSha256:
      "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
    predicateSha256:
      "ab21f048d451a2d095ab8958d1fd36defabcea358cb758c1d8fb7d8d32163031",
    exactSourceItem: {
      statIds: ["anemo%"],
      conditions: ["Xianyun is in Xiao's team."],
    },
    predicate: XIANYYUN_ROSTER_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[4].conditions",
    conditionsSha256:
      "dbe5b5b7131413bd206a6443233c74ccad6ed4cb6f07bf5fbaeb93677dccc30a",
    payloadSha256:
      "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
    predicateSha256:
      "86f2940f7c7e84766cda73b411849a509ed5994bf65f62a4b8b8205c1bdd36a3",
    exactSourceItem: {
      statIds: ["anemo%"],
      conditions: ["Xiao is C6."],
    },
    predicate: XIAO_C6_SOURCE_PREDICATE,
    requestPredicate: XIAO_C6_REQUEST_PREDICATE,
    requestPredicateSha256:
      "9b4c77774f501a23c58014d4256b4a22e7c29bd610d44f4a63cd2043ede8c2f7",
  },
] as const;

const HOLDOUT_OCCURRENCES = [
  [
    "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[2].conditions",
    "9c50b01e33419bc1f6d248bd3b379851e8d8fb296385c90b16f8f38484d697e3",
  ],
  [
    "kqm:character_guide:xiao-lno-artifact-branch-c0-c5-version-5-5:recommendation.artifactRecommendations[0].conditions",
    "5e93dabed99d4a85e2bd5dacf516774278bd4a6e203fb2b9a5af7fb6ab53208f",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.circlet[0].conditions",
    "59c5435ce1e2d05139f27284146e6b74dff31964e1b0521a1f8848fbd3914839",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[0].conditions",
    "8fc5c8d16bbbbba7ac2fddfc1b3e46220e72ab05fa4dca6984a03faee2a804fb",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[1].conditions",
    "7f7caeb5ba29d5ff0fae568e30d7bfcb168d7d5f282f7e9cc027742163ecd7f2",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.goblet[2].conditions",
    "89dcddd239580e1ddaf97646071ba1c9174374257731827bd24e5d002af3fa7a",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[0].conditions",
    "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
  ],
  [
    "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.substats[1].conditions",
    "668aeb631eaed5ff8f7a7a0e4547e7d428eb8b53aabaaa6b17ae1d450f9a9210",
  ],
  [
    "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[0].conditions",
    "16879fa705bd956a848540f84d81859875c8fa81e04352d6db6944d6d7d2b64a",
  ],
  [
    "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[2].conditions",
    "2998b780031d90467d0306277fbd0c018ea364de06555daa0ae24734c9ef7f89",
  ],
  [
    "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[3].conditions",
    "0d8cffcb6e1717e9de548049374e774cf7e7e3fca1c79e548527f5e3991d3752",
  ],
  [
    "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[4].conditions",
    "e8faf9836c2c32190a14d4197d712c7fef007b23e1ff77aad0e481ba2f0783d2",
  ],
  [
    "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[5].conditions",
    "14bf7e40f9fbf2fb76ba4905ce5f270be0fb363f3043956ed6593b60055463f5",
  ],
  [
    "kqm:character_guide:xiao-vha-artifact-branch-version-5-5:recommendation.artifactRecommendations[0].conditions",
    "db55b811f368a3d7aef11648ee0d2e717da70c76eaefef62284d5edcafd5d76d",
  ],
].map(([occurrenceId, conditionsSha256]) => ({
  occurrenceId,
  conditionsSha256,
})) as readonly OccurrenceDefinition[];

const EMPTY_OCCURRENCES = [
  "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[0].conditions",
  "kqm:character_guide:xiao-five-star-weapon-tiers-version-5-5:recommendation.weaponRecommendations[1].conditions",
  "kqm:character_guide:xiao-offensive-artifact-stats-version-5-5:recommendation.mainStats.sands[0].conditions",
  "kqm:character_guide:xiao-unranked-four-star-weapons-version-5-5:recommendation.weaponRecommendations[1].conditions",
].map((occurrenceId) => ({
  occurrenceId,
  conditionsSha256:
    "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570",
})) as readonly OccurrenceDefinition[];

const CAUTIONS = [
  "The three selected occurrences remain agent-assisted and unreviewed source observations.",
  "Matched or applicable means only that an exact roster or explicit request fact satisfies a pinned condition predicate; it is not a recommendation, rank, or performance claim.",
  "Xiao C6 is a synthetic exact-team request fact for this validation slice; the FFXX source team leaves Xiao's investment unspecified.",
  "The fourteen nonempty holdouts and four empty arrays remain unconsumed; shared text or hashes do not grant a binding.",
  "The source team's rotation entries and the separate Xiao rotation fixture are outside this condition slice.",
] as const;
const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this report as a Xiao guide or as an artifact, stat, weapon, build, or team recommendation.",
  "Do not rank or combine Marechaussee Hunter and the two Anemo DMG goblet occurrences into an assembled build.",
  "Do not infer predicates for the fourteen holdouts, Energy Recharge requirements, formula mappings, or rotation applicability.",
  "Do not infer Faruzan C6 or any other investment fact from source rotation prose.",
  "Do not use this report as a generator, optimizer, damage, DPS, ideal-roll, rotation, formula, or ER result.",
] as const;

export interface BuildXiaoSourceLocalConditionSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualSnapshotText: string;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface XiaoSourceLocalSelectedOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  claimAxis: ManualConditionArrayOccurrence["claimAxis"];
  mainStatSlot?: "sands" | "goblet" | "circlet";
  conditions: string[];
  conditionsSha256: string;
  payload: SourceConditionedClaimPayload;
  payloadSha256: string;
  predicate: SourceConditionPredicateAst;
  predicateSha256: string;
  requestPredicate: SourceLocalConditionRequestPredicateAst | null;
  requestPredicateSha256: string | null;
  repositoryParity: "exact";
  sliceDisposition: "selected";
  bindingAuthoredBySlice: true;
  sliceBindingClassification: "typed-bound";
  energyClassificationAuthoredBySlice: true;
  sliceEnergyClassification: "not-energy-deferred";
}

export interface XiaoSourceLocalHoldoutOccurrence {
  occurrenceId: string;
  sourceRecordId: string;
  repositoryRecordId: string;
  manualClaimPath: string;
  repositoryPath: string;
  claimAxis: ManualConditionArrayOccurrence["claimAxis"];
  mainStatSlot?: "sands" | "goblet" | "circlet";
  conditions: string[];
  conditionsSha256: string;
  repositoryParity: "exact";
  sliceDisposition: "holdout";
  consumedBySlice: false;
  bindingAuthoredBySlice: false;
  energyClassificationAuthoredBySlice: false;
}

export interface XiaoSourceLocalEmptyOccurrence
  extends Omit<XiaoSourceLocalHoldoutOccurrence, "conditions" | "sliceDisposition"> {
  conditions: [];
  sliceDisposition: "empty-unconditional";
}

export interface XiaoSourceLocalConditionSliceReport {
  schemaVersion: 1;
  reportType: "xiao-source-local-condition-slice";
  sliceId: typeof XIAO_SLICE_ID;
  classification: "authenticated-source-local-condition-binding-slice";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source-slice";
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsRotationClaims: false;
  supportsEnergyRecoveryClaims: false;
  conditionTruthEstablishedFromRecommendationMetadata: false;
  recommendationCompositionExecuted: false;
  candidateGenerationExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  artifactAssignmentExecuted: false;
  equipmentAssignmentExecuted: false;
  teamCompositionExecuted: false;
  buildCompositionExecuted: false;
  damageComputationExecuted: false;
  rotationComputationExecuted: false;
  energyRecoveryComputationExecuted: false;
  generatedFrom: GeneratedFromEntry[];
  semanticScopeAudit: ScopedSemanticDependencyAcceptedAudit | null;
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactGeneratedFromPathSet: boolean;
    snapshotByteAndParsedObjectClosure: boolean;
  };
  sourceBoundary: {
    status: "accepted" | "rejected";
    sourceId: "kqm";
    pageUrl: typeof XIAO_PAGE_URL;
    sourceVersion: typeof XIAO_SOURCE_VERSION;
    snapshotPath: typeof XIAO_SNAPSHOT_RELATIVE_PATH;
    rawRecordCount: number;
    rawRecordIds: string[];
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    selectedAndHoldoutsCloseAllNonemptyXiaoConditions: boolean;
    emptyOccurrenceClosureExact: boolean;
    repositoryParity: "exact" | "mismatch" | "not-evaluated";
    samePageLineage: boolean;
    crossRecordJoinOwnedByWrapper: true;
    sourceAuthoredCrossRecordJoin: false;
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    sourceRegistryStatus: "active";
    sourceRegistryIngestionMode: "manual-observation";
    sourceRegistryPermission: "unknown";
    promotionEligible: false;
  };
  evaluationBoundary: {
    exactTeamRecordId: typeof FFXX_TEAM_ID;
    sourceTeamInvestmentStatus: "unspecified";
    requestOverlayOwnsConstellationEvaluation: true;
    constellationDerivedTalentBehavior: false;
    sourceTeamRotationsEvaluated: false;
    sourceTeamRotationEntriesProjected: 0;
    separateRotationFixtureInScope: false;
  };
  selectedOccurrences: XiaoSourceLocalSelectedOccurrence[];
  holdoutOccurrences: XiaoSourceLocalHoldoutOccurrence[];
  emptyOccurrences: XiaoSourceLocalEmptyOccurrence[];
  sourceLocalSlice: SourceLocalConditionSliceReport | null;
  summary: {
    totalConditionArrayCount: number;
    nonemptyConditionArrayCount: number;
    emptyConditionArrayCount: number;
    selectedOccurrenceCount: number;
    selectedUniqueConditionArrayCount: number;
    holdoutOccurrenceCount: number;
    sourceTeamCount: number;
    sourceCellCount: number;
    sourceMatchedCount: number;
    sourceInapplicableCount: number;
    sourceUnresolvedCount: number;
    contextApplicableCount: number;
    sourceAlreadyMatchedCount: number;
    sourceDefinitelyInapplicableCount: number;
    effectiveMatchedCount: number;
    effectiveInapplicableCount: number;
    effectiveUnresolvedCount: number;
    selectedNotEnergyDeferredCount: number;
    holdoutConsumedCount: 0;
    emptyConsumedCount: 0;
    candidateCount: 0;
    equipmentAssignmentCount: 0;
    optimizationCount: 0;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type XiaoSourceLocalConditionSliceAuthentication =
  | { authenticated: true; canonicalReport: XiaoSourceLocalConditionSliceReport }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

export const XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS = [
  "scripts/guide-factory/src/xiaoSourceLocalConditionSlice.ts",
  "scripts/guide-factory/src/xiaoSourceLocalConditionSliceScope.ts",
  "scripts/guide-factory/src/assemble-xiao-source-local-condition-slice.ts",
  "scripts/guide-factory/src/scopedSemanticDependency.ts",
  "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
  "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
  "scripts/guide-factory/src/guideRequestContext.ts",
  "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/io.ts",
  XIAO_SNAPSHOT_RELATIVE_PATH,
] as const;

export const XIAO_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-source-local-condition-slice.json",
);

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsBuildRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsDamageClaims: false,
  supportsRotationClaims: false,
  supportsEnergyRecoveryClaims: false,
  conditionTruthEstablishedFromRecommendationMetadata: false,
  recommendationCompositionExecuted: false,
  candidateGenerationExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  artifactAssignmentExecuted: false,
  equipmentAssignmentExecuted: false,
  teamCompositionExecuted: false,
  buildCompositionExecuted: false,
  damageComputationExecuted: false,
  rotationComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

export function buildXiaoSourceLocalConditionSliceReport(
  input: BuildXiaoSourceLocalConditionSliceInput,
): XiaoSourceLocalConditionSliceReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  let semanticScopeAudit: ScopedSemanticDependencyAcceptedAudit | null = null;
  try {
    generatedFrom = authenticateGeneratedFrom(input.generatedFrom);
    const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(
      input.manualSnapshotInput,
    );
    const index = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
    const registry = SourceRegistrySchema.parse(input.sourceRegistryInput);
    authenticateSnapshotBytes(input.manualSnapshotText, snapshot, generatedFrom);
    const scoped = requireXiaoSourceLocalConditionSliceScope({
      repository,
      manualSnapshot: snapshot,
      manualIndex: index,
      sourceRegistry: registry,
    });
    semanticScopeAudit = scoped.audit;
    authenticateSourceDocument(snapshot, scoped);

    const coverageCore = buildManualConditionArrayCoverageCore({
      manualIndexInput: {
        schemaVersion: 1,
        snapshots: [
          { sourceId: "kqm", path: XIAO_SNAPSHOT_RELATIVE_PATH },
        ],
      },
      manualSnapshotInputs: [
        {
          path: XIAO_SNAPSHOT_RELATIVE_PATH,
          snapshotInput: snapshot,
        },
      ],
      repositoryInput: repository,
    });
    const allOccurrences = coverageCore.extraction.occurrences;
    const nonemptyOccurrences = allOccurrences.filter(
      ({ conditions }) => conditions.length > 0,
    );
    const emptyOccurrences = allOccurrences.filter(
      ({ conditions }) => conditions.length === 0,
    );
    if (
      coverageCore.repositoryParity.status !== "exact" ||
      allOccurrences.length !== 21 ||
      nonemptyOccurrences.length !== 17 ||
      emptyOccurrences.length !== 4 ||
      allOccurrences.some(({ subject }) => subject !== "xiao")
    ) {
      throw new Error(
        "The exact Xiao condition corpus is no longer 21 parity-exact arrays (17 nonempty and 4 empty).",
      );
    }
    const parityByOccurrenceId = new Map(
      coverageCore.repositoryParity.rows.map((row) => [row.occurrenceId, row]),
    );
    const allOccurrenceById = new Map(
      allOccurrences.map((occurrence) => {
        const parity = parityByOccurrenceId.get(occurrence.occurrenceId);
        if (parity?.status !== "exact" || parity.repositoryJsonPath == null) {
          throw new Error(
            `Missing exact repository parity path for ${occurrence.occurrenceId}.`,
          );
        }
        return [
          occurrence.occurrenceId,
          { ...occurrence, repositoryJsonPath: parity.repositoryJsonPath },
        ];
      }),
    );
    const nonemptyById = new Map(
      [...allOccurrenceById].filter(([, occurrence]) =>
        occurrence.conditions.length > 0,
      ),
    );
    const emptyById = new Map(
      [...allOccurrenceById].filter(([, occurrence]) =>
        occurrence.conditions.length === 0,
      ),
    );
    authenticatePartitions(nonemptyById, emptyById);

    const selectedOccurrences: XiaoSourceLocalSelectedOccurrence[] = [];
    const claims: SourceLocalConditionClaimInput[] = [];
    SELECTED_OCCURRENCES.forEach((definition, catalogIndex) => {
      const occurrence = requiredOccurrence(
        nonemptyById,
        definition.occurrenceId,
      );
      authenticateSelectedOccurrence(
        definition,
        occurrence,
        snapshot,
        repository,
      );
      const payload = payloadForOccurrence(repository, occurrence);
      const payloadSha256 = hashValue(payload);
      const predicateSha256 = hashValue(definition.predicate);
      const requestPredicate = definition.requestPredicate
        ? structuredClone(definition.requestPredicate)
        : null;
      const requestPredicateSha256 = requestPredicate
        ? hashValue(requestPredicate)
        : null;
      if (
        payloadSha256 !== definition.payloadSha256 ||
        predicateSha256 !== definition.predicateSha256 ||
        requestPredicateSha256 !== (definition.requestPredicateSha256 ?? null)
      ) {
        throw new Error(
          `Exact Xiao predicate or payload hash drifted for ${occurrence.occurrenceId}.`,
        );
      }
      selectedOccurrences.push({
        occurrenceId: occurrence.occurrenceId,
        sourceRecordId: occurrence.sourceRecordId,
        repositoryRecordId: occurrence.repositoryRecordId,
        manualClaimPath: occurrence.manualClaimPath,
        repositoryPath: occurrence.repositoryPath,
        claimAxis: occurrence.claimAxis,
        ...(occurrence.mainStatSlot
          ? { mainStatSlot: occurrence.mainStatSlot }
          : {}),
        conditions: [...occurrence.conditions],
        conditionsSha256: occurrence.conditionsSha256,
        payload,
        payloadSha256,
        predicate: structuredClone(definition.predicate),
        predicateSha256,
        requestPredicate,
        requestPredicateSha256,
        repositoryParity: "exact",
        sliceDisposition: "selected",
        bindingAuthoredBySlice: true,
        sliceBindingClassification: "typed-bound",
        energyClassificationAuthoredBySlice: true,
        sliceEnergyClassification: "not-energy-deferred",
      });
      const claim = buildAtomicClaim(
        repository,
        occurrence,
        definition.predicate,
        payload,
        catalogIndex,
      );
      claims.push({
        claim,
        occurrenceControl: {
          occurrenceId: occurrence.occurrenceId,
          snapshotPath: occurrence.snapshotPath,
          sourceId: occurrence.sourceId,
          sourceRecordId: occurrence.sourceRecordId,
          repositoryRecordId: occurrence.repositoryRecordId,
          manualPath: occurrence.manualPath,
          manualClaimPath: occurrence.manualClaimPath,
          repositoryJsonPath: occurrence.repositoryJsonPath,
          claimAxis: occurrence.claimAxis as
            | "weapon-recommendation"
            | "artifact-recommendation"
            | "main-stat"
            | "substat",
          ...(occurrence.mainStatSlot
            ? { mainStatSlot: occurrence.mainStatSlot }
            : {}),
          repositoryParity: "exact",
          sliceDisposition: "selected",
          energyClassification: "not-energy-deferred",
          sourceConditionsSha256: occurrence.conditionsSha256,
          sourcePredicateSha256: predicateSha256,
          payloadSha256,
        },
        requestBindings: requestPredicate
          ? [
              {
                sourcePredicatePath: "predicate",
                sourcePredicateLeafSha256: predicateSha256,
                requestPredicate,
              },
            ]
          : [],
      });
    });

    const holdoutOccurrences: XiaoSourceLocalHoldoutOccurrence[] =
      HOLDOUT_OCCURRENCES.map((definition) => {
      const occurrence = requiredOccurrence(
        nonemptyById,
        definition.occurrenceId,
      );
      authenticateUnconsumedOccurrence(definition, occurrence, false);
      return unconsumedOccurrence(
        occurrence,
        "holdout",
      ) as XiaoSourceLocalHoldoutOccurrence;
    });
    const authenticatedEmptyOccurrences = EMPTY_OCCURRENCES.map(
      (definition) => {
        const occurrence = requiredOccurrence(emptyById, definition.occurrenceId);
        authenticateUnconsumedOccurrence(definition, occurrence, true);
        return unconsumedOccurrence(
          occurrence,
          "empty-unconditional",
        ) as XiaoSourceLocalEmptyOccurrence;
      },
    );
    const exactTeams = buildExactTeam(repository, snapshot);
    const sourceLocalInput = buildSourceLocalInput(
      generatedFrom,
      claims,
      exactTeams,
    );
    const sourceLocalSlice =
      buildSourceLocalConditionSliceReport(sourceLocalInput);
    if (sourceLocalSlice.comparisonStatus !== "comparable") {
      throw new Error(
        `The canonical Xiao source-local slice is not comparable: ${sourceLocalSlice.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    authenticateExpectedSliceSemantics(sourceLocalSlice);
    return {
      schemaVersion: 1,
      reportType: "xiao-source-local-condition-slice",
      sliceId: XIAO_SLICE_ID,
      classification: "authenticated-source-local-condition-binding-slice",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-source-slice",
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      semanticScopeAudit,
      rawInputBoundary: {
        status: "accepted",
        exactGeneratedFromPathSet: true,
        snapshotByteAndParsedObjectClosure: true,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        pageUrl: XIAO_PAGE_URL,
        sourceVersion: XIAO_SOURCE_VERSION,
        snapshotPath: XIAO_SNAPSHOT_RELATIVE_PATH,
        rawRecordCount: snapshot.records.length,
        rawRecordIds: snapshot.records
          .map(({ sourceRecordId }) => sourceRecordId)
          .sort(compareText),
        totalConditionArrayCount: allOccurrences.length,
        nonemptyConditionArrayCount: nonemptyOccurrences.length,
        emptyConditionArrayCount: emptyOccurrences.length,
        selectedOccurrenceCount: selectedOccurrences.length,
        holdoutOccurrenceCount: holdoutOccurrences.length,
        selectedAndHoldoutsCloseAllNonemptyXiaoConditions: true,
        emptyOccurrenceClosureExact: true,
        repositoryParity: coverageCore.repositoryParity.status,
        samePageLineage: true,
        crossRecordJoinOwnedByWrapper: true,
        sourceAuthoredCrossRecordJoin: false,
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        sourceRegistryStatus: "active",
        sourceRegistryIngestionMode: "manual-observation",
        sourceRegistryPermission: "unknown",
        promotionEligible: false,
      },
      evaluationBoundary: {
        exactTeamRecordId: FFXX_TEAM_ID,
        sourceTeamInvestmentStatus: "unspecified",
        requestOverlayOwnsConstellationEvaluation: true,
        constellationDerivedTalentBehavior: false,
        sourceTeamRotationsEvaluated: false,
        sourceTeamRotationEntriesProjected: 0,
        separateRotationFixtureInScope: false,
      },
      selectedOccurrences,
      holdoutOccurrences,
      emptyOccurrences: authenticatedEmptyOccurrences,
      sourceLocalSlice,
      summary: summaryFromSlice(
        sourceLocalSlice,
        allOccurrences.length,
        nonemptyOccurrences.length,
        emptyOccurrences.length,
        holdoutOccurrences.length,
      ),
      issues: [],
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    };
  } catch (error) {
    return failedReport(
      generatedFrom,
      semanticScopeAudit,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function authenticateXiaoSourceLocalConditionSliceReport(
  serializedReport: XiaoSourceLocalConditionSliceReport,
  input: BuildXiaoSourceLocalConditionSliceInput,
): XiaoSourceLocalConditionSliceAuthentication {
  const canonicalReport = buildXiaoSourceLocalConditionSliceReport(input);
  if (canonicalReport.comparisonStatus !== "comparable") {
    return {
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
      issues: canonicalReport.issues.map((issue) => ({ ...issue })),
    };
  }
  if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
    return {
      authenticated: false,
      reason: "serialized-report-mismatch",
      issues: [
        {
          code: "xiao-source-local.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Xiao source-local report does not match a fresh canonical rebuild from current exact inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableXiaoSourceLocalConditionSliceReport(
  report: XiaoSourceLocalConditionSliceReport,
  input: BuildXiaoSourceLocalConditionSliceInput,
): void {
  const authentication = authenticateXiaoSourceLocalConditionSliceReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao source-local report (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function buildSourceLocalInput(
  generatedFrom: readonly GeneratedFromEntry[],
  claims: readonly SourceLocalConditionClaimInput[],
  exactTeams: readonly SourceLocalExactTeamInput[],
): SourceLocalConditionSliceInput {
  return {
    sliceId: XIAO_SLICE_ID,
    generatedFrom,
    sourceBoundary: {
      sourceId: "kqm",
      pageUrl: XIAO_PAGE_URL,
      sourceVersion: XIAO_SOURCE_VERSION,
      snapshotPath: XIAO_SNAPSHOT_RELATIVE_PATH,
      rawManualSourceRecordIds: [
        "xiao-mh-artifact-branch-version-5-5",
        "xiao-offensive-artifact-stats-version-5-5",
        FFXX_SOURCE_RECORD_ID,
      ],
      consolidatedGuideRecordIds: [
        "kqm:character-guide:xiao-mh-artifact-branch-version-5-5",
        "kqm:character-guide:xiao-offensive-artifact-stats-version-5-5",
      ],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      sourceHashes: generatedFrom
        .filter(({ path: entryPath }) =>
          entryPath === XIAO_SNAPSHOT_RELATIVE_PATH,
        )
        .map((entry) => ({ ...entry })),
    },
    claims,
    exactTeams,
    requestContext: {
      requestFactsByTeamRecordId: {
        [FFXX_TEAM_ID]: {
          characterFactsById: { xiao: { constellation: 6 } },
        },
      },
    },
    expectedCounts: {
      claimCount: 3,
      teamCount: 1,
      cellCount: 3,
      sourceResolution: { matched: 2, inapplicable: 0, unresolved: 1 },
      effectiveResolution: { matched: 3, inapplicable: 0, unresolved: 0 },
      contextApplicability: {
        sourceAlreadyMatched: 2,
        sourceDefinitelyInapplicable: 0,
        applicableUnderSuppliedContext: 1,
        notApplicableUnderSuppliedContext: 0,
        stillUnresolved: 0,
      },
    },
    cautions: CAUTIONS,
    prohibitedInterpretations: PROHIBITED_INTERPRETATIONS,
  };
}

function buildAtomicClaim(
  repository: KnowledgeRepository,
  occurrence: XiaoConditionOccurrence,
  predicate: SourceConditionPredicateAst,
  payload: SourceConditionedClaimPayload,
  catalogIndex: number,
): SourceConditionedAtomicClaim {
  const record = requiredRepositoryCharacterGuide(
    repository,
    occurrence.repositoryRecordId,
  );
  const recommendation = record.recommendations?.[0];
  if (!recommendation) {
    throw new Error(`Missing recommendation for ${record.id}.`);
  }
  const sourceItem = sourceItemForOccurrence(repository, occurrence, "repository");
  return {
    claimId: occurrence.occurrenceId,
    catalogIndex,
    repositoryRecordId: occurrence.repositoryRecordId,
    sourceId: occurrence.sourceId,
    sourceRecordId: occurrence.sourceRecordId,
    characterId: "xiao",
    recommendation: {
      recommendationId: recommendation.id,
      label: recommendation.label ?? null,
      scope: recommendation.scope,
      roles: [...recommendation.roles],
      ordering:
        occurrence.claimAxis === "artifact-recommendation"
          ? recommendation.artifactOrdering ?? null
          : null,
      classification:
        occurrence.claimAxis === "artifact-recommendation"
          ? readClassification(sourceItem)
          : null,
      grouping:
        occurrence.claimAxis === "artifact-recommendation"
          ? readGrouping(sourceItem)
          : null,
      sourceIndex: sourceItemIndex(occurrence.repositoryPath),
    },
    payload,
    sourceConditions: [...occurrence.conditions],
    sourceConditionsSha256: occurrence.conditionsSha256,
    predicate: structuredClone(predicate),
  };
}

function buildExactTeam(
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
): SourceLocalExactTeamInput[] {
  const manual = snapshot.records.find(
    (record) =>
      record.kind === "team" && record.sourceRecordId === FFXX_SOURCE_RECORD_ID,
  );
  const consolidated = repository.records.find(
    (record) => record.kind === "team" && record.id === FFXX_TEAM_ID,
  );
  if (!manual || manual.kind !== "team" || !consolidated || consolidated.kind !== "team") {
    throw new Error("Missing exact Xiao FFXX source team.");
  }
  if (
    manual.label !== "Xiao — Xianyun — Furina — Faruzan (FFXX)" ||
    consolidated.label !== manual.label ||
    manual.intent !== "prescriptive" ||
    consolidated.intent !== manual.intent ||
    manual.exhaustiveness !== "non-exhaustive" ||
    consolidated.exhaustiveness !== manual.exhaustiveness ||
    manual.rankingClaim !== "none" ||
    consolidated.rankingClaim !== manual.rankingClaim ||
    stableJson(manual.members.map(({ characterId }) => characterId)) !==
      stableJson(FFXX_ROSTER) ||
    stableJson(consolidated.members.map(({ characterId }) => characterId)) !==
      stableJson(FFXX_ROSTER) ||
    consolidated.members.some(
      ({ investment, selectedArtifact, selectedWeapon }) =>
        investment.status !== "unspecified" ||
        selectedArtifact != null ||
        selectedWeapon != null,
    ) ||
    consolidated.status !== "candidate" ||
    consolidated.promotionEligible !== false
  ) {
    throw new Error("Exact Xiao FFXX team lineage drifted.");
  }
  return [
    {
      packetIndex: 0,
      teamRecordId: FFXX_TEAM_ID,
      snapshotPath: XIAO_SNAPSHOT_RELATIVE_PATH,
      sourceId: "kqm",
      sourceRecordId: FFXX_SOURCE_RECORD_ID,
      label: manual.label ?? null,
      intent: "prescriptive",
      exhaustiveness: "non-exhaustive",
      rankingClaim: "none",
      memberCharacterIds: [...FFXX_ROSTER],
    },
  ];
}

function authenticateSourceDocument(
  snapshot: ManualObservationSnapshot,
  scoped: ReturnType<typeof requireXiaoSourceLocalConditionSliceScope>,
): void {
  const source = scoped.sourceRegistryEntry;
  const expectedIds = [...XIAO_RAW_RECORD_IDS].sort(compareText);
  const actualIds = snapshot.records
    .map(({ sourceRecordId }) => sourceRecordId)
    .sort(compareText);
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== XIAO_PAGE_URL ||
    snapshot.page.sourceVersion !== XIAO_SOURCE_VERSION ||
    snapshot.page.title !== "Xiao Guide: Adeptal Guide to Conquering Xiao" ||
    stableJson(actualIds) !== stableJson(expectedIds) ||
    scoped.rawRecords.length !== 7 ||
    scoped.repositoryRecords.length !== 7 ||
    scoped.manualIndexEntry.sourceId !== "kqm" ||
    scoped.manualIndexEntry.path !== XIAO_SNAPSHOT_RELATIVE_PATH ||
    source.id !== "kqm" ||
    source.status !== "active" ||
    source.ingestionMode !== "manual-observation" ||
    source.permission !== "unknown" ||
    source.recordFormat !== "manual-observation-v1" ||
    snapshot.records.some(
      ({ locator, extraction }) =>
        locatorUrl(locator) !== XIAO_PAGE_URL ||
        extraction.method !== "agent-assisted" ||
        extraction.reviewStatus !== "unreviewed",
    )
  ) {
    throw new Error("Xiao source-document, index, or registry boundary drifted.");
  }
  for (const record of scoped.repositoryRecords) {
    if (
      record.status !== "candidate" ||
      record.promotionEligible !== false ||
      record.sourceRefs.length !== 1 ||
      record.sourceRefs[0]?.sourceId !== "kqm" ||
      locatorUrl(record.sourceRefs[0].locator) !== XIAO_PAGE_URL
    ) {
      throw new Error(`Xiao consolidated source boundary drifted for ${record.id}.`);
    }
  }
}

function authenticateSelectedOccurrence(
  definition: SelectedOccurrenceDefinition,
  occurrence: XiaoConditionOccurrence,
  snapshot: ManualObservationSnapshot,
  repository: KnowledgeRepository,
): void {
  if (
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    hashValue(occurrence.conditions) !== definition.conditionsSha256 ||
    occurrence.sourceId !== "kqm" ||
    occurrence.subject !== "xiao" ||
    occurrence.conditions.length === 0 ||
    occurrence.structuralEnergyDimension !== "not-structural-er"
  ) {
    throw new Error(`Exact Xiao occurrence boundary drifted for ${occurrence.occurrenceId}.`);
  }
  const manualItem = sourceItemForOccurrence(snapshot, occurrence, "manual");
  const repositoryItem = sourceItemForOccurrence(
    repository,
    occurrence,
    "repository",
  );
  if (
    stableJson(manualItem) !== stableJson(definition.exactSourceItem) ||
    stableJson(repositoryItem) !== stableJson(definition.exactSourceItem)
  ) {
    throw new Error(`Exact Xiao source payload drifted for ${occurrence.occurrenceId}.`);
  }
  requiredRepositoryCharacterGuide(repository, occurrence.repositoryRecordId);
}

function authenticateUnconsumedOccurrence(
  definition: OccurrenceDefinition,
  occurrence: XiaoConditionOccurrence,
  empty: boolean,
): void {
  if (
    occurrence.occurrenceId !== definition.occurrenceId ||
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    hashValue(occurrence.conditions) !== definition.conditionsSha256 ||
    occurrence.sourceId !== "kqm" ||
    occurrence.subject !== "xiao" ||
    occurrence.structuralEnergyDimension !== "not-structural-er" ||
    (empty ? occurrence.conditions.length !== 0 : occurrence.conditions.length === 0)
  ) {
    throw new Error(
      `Exact Xiao ${empty ? "empty" : "holdout"} boundary drifted for ${definition.occurrenceId}.`,
    );
  }
}

function authenticatePartitions(
  nonemptyById: ReadonlyMap<string, XiaoConditionOccurrence>,
  emptyById: ReadonlyMap<string, XiaoConditionOccurrence>,
): void {
  const selectedIds = new Set(
    SELECTED_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
  );
  const holdoutIds = new Set(
    HOLDOUT_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
  );
  const emptyIds = new Set(EMPTY_OCCURRENCES.map(({ occurrenceId }) => occurrenceId));
  if (
    selectedIds.size !== 3 ||
    holdoutIds.size !== 14 ||
    emptyIds.size !== 4 ||
    [...selectedIds].some((id) => holdoutIds.has(id)) ||
    stableJson([...selectedIds, ...holdoutIds].sort(compareText)) !==
      stableJson([...nonemptyById.keys()].sort(compareText)) ||
    stableJson([...emptyIds].sort(compareText)) !==
      stableJson([...emptyById.keys()].sort(compareText))
  ) {
    throw new Error("Xiao selected, holdout, and empty partitions drifted.");
  }
}

function authenticateExpectedSliceSemantics(
  report: SourceLocalConditionSliceReport,
): void {
  const projections = report.requestContextReport?.teamProjections[0]?.claimProjections;
  const c6Projection = projections?.find(({ claimId }) =>
    claimId.endsWith("mainStats.goblet[4].conditions"),
  );
  const safe =
    report.summary.claimCount === 3 &&
    report.summary.teamCount === 1 &&
    report.summary.cellCount === 3 &&
    report.summary.sourceMatchedCount === 2 &&
    report.summary.sourceInapplicableCount === 0 &&
    report.summary.sourceUnresolvedCount === 1 &&
    report.summary.effectiveMatchedCount === 3 &&
    report.summary.effectiveInapplicableCount === 0 &&
    report.summary.effectiveUnresolvedCount === 0 &&
    report.summary.sourceAlreadyMatchedCount === 2 &&
    report.summary.applicableUnderSuppliedContextCount === 1 &&
    report.summary.deferredEnergyCount === 0 &&
    report.summary.assembledBuildCount === 0 &&
    c6Projection?.contextApplicability === "applicable-under-supplied-context" &&
    c6Projection.requestContextBindings.length === 1 &&
    c6Projection.requestContextBindings[0]?.result === "true" &&
    c6Projection.requestContextBindings[0]?.predicateRows[0]?.factScope.teamRecordId ===
      FFXX_TEAM_ID &&
    c6Projection.requestContextBindings[0]?.predicateRows[0]?.factScope.characterId ===
      "xiao" &&
    report.requestContextReport?.context.requestFactsByTeamRecordId?.[
      FFXX_TEAM_ID
    ]?.characterFactsById?.xiao?.constellation === 6 &&
    report.requestContextReport?.context.requestFactsByTeamRecordId?.[
      FFXX_TEAM_ID
    ]?.characterFactsById?.faruzan == null &&
    report.sourceClaimCells[0]?.claimCells.filter(
      ({ resolution }) => resolution === "matched",
    ).length === 2 &&
    !report.supportsGuideClaims &&
    !report.supportsTeamRecommendations &&
    !report.supportsBuildRecommendations &&
    !report.supportsStatRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsRotationClaims &&
    !report.supportsEnergyRecoveryClaims &&
    !report.recommendationCompositionExecuted &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryComputationExecuted;
  if (!safe) {
    throw new Error("Xiao source-local slice crossed its expected semantic boundary.");
  }
}

function authenticateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const expected = [...XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS].sort(
    compareText,
  );
  const actual = input.map(({ path: entryPath }) => entryPath).sort(compareText);
  if (
    new Set(actual).size !== actual.length ||
    stableJson(actual) !== stableJson(expected) ||
    input.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256))
  ) {
    throw new Error("Xiao generated-from path or hash boundary drifted.");
  }
  return input
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
}

function authenticateSnapshotBytes(
  text: string,
  snapshot: ManualObservationSnapshot,
  generatedFrom: readonly GeneratedFromEntry[],
): void {
  const revision = generatedFrom.find(
    ({ path: entryPath }) => entryPath === XIAO_SNAPSHOT_RELATIVE_PATH,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Xiao snapshot text is not valid JSON.");
  }
  if (
    !revision ||
    revision.sha256 !== sha256Text(text) ||
    stableJson(parsed) !== stableJson(snapshot)
  ) {
    throw new Error("Xiao snapshot bytes and parsed object do not close exactly.");
  }
}

function payloadForOccurrence(
  repository: KnowledgeRepository,
  occurrence: XiaoConditionOccurrence,
): SourceConditionedClaimPayload {
  const item = sourceItemForOccurrence(repository, occurrence, "repository");
  if (occurrence.claimAxis === "artifact-recommendation") {
    if (!Array.isArray(item.artifacts)) {
      throw new Error(`Missing artifact payload for ${occurrence.occurrenceId}.`);
    }
    return {
      type: "artifact-group",
      artifacts: structuredClone(item.artifacts) as ArtifactChoice[],
    };
  }
  if (occurrence.claimAxis === "main-stat" && occurrence.mainStatSlot) {
    return {
      type: "main-stat",
      slot: occurrence.mainStatSlot,
      statIds: readStringArray(item, "statIds"),
      priority: readNullableNumber(item, "priority"),
      target: readNullableString(item, "target"),
    };
  }
  throw new Error(`Unsupported selected Xiao claim axis ${occurrence.claimAxis}.`);
}

function sourceItemForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: XiaoConditionOccurrence,
  kind: "manual" | "repository",
): Record<string, unknown> {
  const conditionPath =
    kind === "manual" ? occurrence.manualPath : occurrence.repositoryJsonPath;
  const value = readJsonPath(root, conditionPath.replace(/\.conditions$/, ""));
  if (!isRecord(value)) {
    throw new Error(`Condition parent for ${occurrence.occurrenceId} is not an object.`);
  }
  return structuredClone(value);
}

function readJsonPath(root: unknown, jsonPath: string): unknown {
  const tokens = [...jsonPath.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(
    (match) => (match[2] == null ? match[1]! : Number(match[2])),
  );
  let value = root;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(value) || token >= value.length) {
        throw new Error(`Invalid array token [${token}] in ${jsonPath}.`);
      }
      value = value[token];
    } else {
      if (!isRecord(value) || !(token in value)) {
        throw new Error(`Invalid object token ${token} in ${jsonPath}.`);
      }
      value = value[token];
    }
  }
  return value;
}

function requiredOccurrence(
  byId: ReadonlyMap<string, XiaoConditionOccurrence>,
  occurrenceId: string,
): XiaoConditionOccurrence {
  const occurrence = byId.get(occurrenceId);
  if (!occurrence) throw new Error(`Missing exact Xiao occurrence ${occurrenceId}.`);
  return occurrence;
}

function requiredRepositoryCharacterGuide(
  repository: KnowledgeRepository,
  recordId: string,
): Extract<KnowledgeRecord, { kind: "character_guide" }> {
  const record = repository.records.find(({ id }) => id === recordId);
  if (
    !record ||
    record.kind !== "character_guide" ||
    record.characterId !== "xiao" ||
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    record.builds.length !== 0 ||
    record.recommendations?.length !== 1
  ) {
    throw new Error(`Missing exact Xiao character-guide record ${recordId}.`);
  }
  return record;
}

function unconsumedOccurrence(
  occurrence: XiaoConditionOccurrence,
  disposition: "holdout" | "empty-unconditional",
): XiaoSourceLocalHoldoutOccurrence | XiaoSourceLocalEmptyOccurrence {
  return {
    occurrenceId: occurrence.occurrenceId,
    sourceRecordId: occurrence.sourceRecordId,
    repositoryRecordId: occurrence.repositoryRecordId,
    manualClaimPath: occurrence.manualClaimPath,
    repositoryPath: occurrence.repositoryPath,
    claimAxis: occurrence.claimAxis,
    ...(occurrence.mainStatSlot
      ? { mainStatSlot: occurrence.mainStatSlot }
      : {}),
    conditions:
      disposition === "empty-unconditional"
        ? ([] as [])
        : [...occurrence.conditions],
    conditionsSha256: occurrence.conditionsSha256,
    repositoryParity: "exact",
    sliceDisposition: disposition,
    consumedBySlice: false,
    bindingAuthoredBySlice: false,
    energyClassificationAuthoredBySlice: false,
  } as XiaoSourceLocalHoldoutOccurrence | XiaoSourceLocalEmptyOccurrence;
}

function summaryFromSlice(
  slice: SourceLocalConditionSliceReport,
  total: number,
  nonempty: number,
  empty: number,
  holdout: number,
): XiaoSourceLocalConditionSliceReport["summary"] {
  return {
    totalConditionArrayCount: total,
    nonemptyConditionArrayCount: nonempty,
    emptyConditionArrayCount: empty,
    selectedOccurrenceCount: slice.summary.claimCount,
    selectedUniqueConditionArrayCount: new Set(
      slice.conditionControls.map(
        ({ occurrenceControl }) => occurrenceControl.sourceConditionsSha256,
      ),
    ).size,
    holdoutOccurrenceCount: holdout,
    sourceTeamCount: slice.summary.teamCount,
    sourceCellCount: slice.summary.cellCount,
    sourceMatchedCount: slice.summary.sourceMatchedCount,
    sourceInapplicableCount: slice.summary.sourceInapplicableCount,
    sourceUnresolvedCount: slice.summary.sourceUnresolvedCount,
    contextApplicableCount: slice.summary.applicableUnderSuppliedContextCount,
    sourceAlreadyMatchedCount: slice.summary.sourceAlreadyMatchedCount,
    sourceDefinitelyInapplicableCount:
      slice.summary.sourceDefinitelyInapplicableCount,
    effectiveMatchedCount: slice.summary.effectiveMatchedCount,
    effectiveInapplicableCount: slice.summary.effectiveInapplicableCount,
    effectiveUnresolvedCount: slice.summary.effectiveUnresolvedCount,
    selectedNotEnergyDeferredCount: slice.summary.claimCount,
    holdoutConsumedCount: 0,
    emptyConsumedCount: 0,
    candidateCount: 0,
    equipmentAssignmentCount: 0,
    optimizationCount: 0,
    assembledBuildCount: 0,
  };
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  semanticScopeAudit: ScopedSemanticDependencyAcceptedAudit | null,
  message: string,
): XiaoSourceLocalConditionSliceReport {
  return {
    schemaVersion: 1,
    reportType: "xiao-source-local-condition-slice",
    sliceId: XIAO_SLICE_ID,
    classification: "authenticated-source-local-condition-binding-slice",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-source-slice",
    ...CAPABILITY_BOUNDARY,
    generatedFrom: generatedFrom.map((entry) => ({ ...entry })),
    semanticScopeAudit,
    rawInputBoundary: {
      status: "rejected",
      exactGeneratedFromPathSet: false,
      snapshotByteAndParsedObjectClosure: false,
    },
    sourceBoundary: {
      status: "rejected",
      sourceId: "kqm",
      pageUrl: XIAO_PAGE_URL,
      sourceVersion: XIAO_SOURCE_VERSION,
      snapshotPath: XIAO_SNAPSHOT_RELATIVE_PATH,
      rawRecordCount: 0,
      rawRecordIds: [],
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      selectedAndHoldoutsCloseAllNonemptyXiaoConditions: false,
      emptyOccurrenceClosureExact: false,
      repositoryParity: "not-evaluated",
      samePageLineage: false,
      crossRecordJoinOwnedByWrapper: true,
      sourceAuthoredCrossRecordJoin: false,
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryIngestionMode: "manual-observation",
      sourceRegistryPermission: "unknown",
      promotionEligible: false,
    },
    evaluationBoundary: {
      exactTeamRecordId: FFXX_TEAM_ID,
      sourceTeamInvestmentStatus: "unspecified",
      requestOverlayOwnsConstellationEvaluation: true,
      constellationDerivedTalentBehavior: false,
      sourceTeamRotationsEvaluated: false,
      sourceTeamRotationEntriesProjected: 0,
      separateRotationFixtureInScope: false,
    },
    selectedOccurrences: [],
    holdoutOccurrences: [],
    emptyOccurrences: [],
    sourceLocalSlice: null,
    summary: {
      totalConditionArrayCount: 0,
      nonemptyConditionArrayCount: 0,
      emptyConditionArrayCount: 0,
      selectedOccurrenceCount: 0,
      selectedUniqueConditionArrayCount: 0,
      holdoutOccurrenceCount: 0,
      sourceTeamCount: 0,
      sourceCellCount: 0,
      sourceMatchedCount: 0,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 0,
      contextApplicableCount: 0,
      sourceAlreadyMatchedCount: 0,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 0,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 0,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
      candidateCount: 0,
      equipmentAssignmentCount: 0,
      optimizationCount: 0,
      assembledBuildCount: 0,
    },
    issues: [
      {
        code: "xiao-source-local.canonical-input",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function sourceItemIndex(repositoryPath: string): number {
  const last = [...repositoryPath.matchAll(/\[(\d+)\]/g)].at(-1)?.[1];
  if (last == null) throw new Error(`Missing source index in ${repositoryPath}.`);
  return Number(last);
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Expected string array ${key}.`);
  }
  return [...value];
}

function readNullableNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (value == null) return null;
  if (typeof value !== "number") throw new Error(`Expected numeric ${key}.`);
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value == null) return null;
  if (typeof value !== "string") throw new Error(`Expected string ${key}.`);
  return value;
}

function readClassification(
  record: Record<string, unknown>,
): "default" | "recommended" | "alternative" | "conditional" | "available-only" | null {
  const value = record.classification;
  return typeof value === "string"
    ? (value as "default" | "recommended" | "alternative" | "conditional" | "available-only")
    : null;
}

function readGrouping(
  record: Record<string, unknown>,
): "single" | "alternatives" | "tied" | null {
  const value = record.grouping;
  return typeof value === "string"
    ? (value as "single" | "alternatives" | "tied")
    : null;
}

function locatorUrl(locator: unknown): string | null {
  return isRecord(locator) && typeof locator.url === "string"
    ? locator.url
    : null;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
