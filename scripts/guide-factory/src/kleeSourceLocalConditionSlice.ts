import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildManualConditionArrayCoverageCore,
  type ManualConditionArrayOccurrence,
} from "./manualConditionArrayCoverage";
import { sha256Text, stableJson } from "./io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "./paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type KnowledgeRepository,
  type KnowledgeRecord,
  type ManualObservationSnapshot,
} from "./schemas";
import {
  authenticateSourceLocalConditionSliceReport,
  buildSourceLocalConditionSliceReport,
  type SourceLocalConditionClaimInput,
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

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const KLEE_SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json";
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const KLEE_PAGE_URL = "https://keqingmains.com/q/klee-quickguide/";
const KLEE_SOURCE_VERSION = "Luna IV";
const KLEE_SLICE_ID = "kqm-klee-source-local-condition-slice-luna-iv";
const KLEE_ROLE_REASON =
  "Klee's intended on-field DPS role must be supplied explicitly per exact source team; recommendation roles are source metadata, not runtime role evidence.";

const ROLE_PREDICATE = {
  type: "unresolved-context",
  category: "gameplay-role",
  reason: KLEE_ROLE_REASON,
} as const satisfies SourceConditionPredicateAst;

const FURINA_ROSTER_PREDICATE = {
  type: "exact-team-roster-includes",
  characterId: "furina",
} as const satisfies SourceConditionPredicateAst;

const TEAM_DEFINITIONS = [
  {
    repositoryRecordId:
      "kqm:team:klee-chevreuse-durin-fischl-overload-example-luna-iv",
    sourceRecordId:
      "klee-chevreuse-durin-fischl-overload-example-luna-iv",
    memberCharacterIds: ["klee", "chevreuse", "durin", "fischl"],
  },
  {
    repositoryRecordId:
      "kqm:team:klee-furina-albedo-xilonen-example-luna-iv",
    sourceRecordId: "klee-furina-albedo-xilonen-example-luna-iv",
    memberCharacterIds: ["klee", "furina", "albedo", "xilonen"],
  },
] as const;

type ExactSourceItem = Record<string, unknown>;

type KleeConditionOccurrence = ManualConditionArrayOccurrence & {
  repositoryJsonPath: string;
};

type SelectedOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
  exactSourceItem: ExactSourceItem;
  predicate: SourceConditionPredicateAst;
};

type HoldoutOccurrenceDefinition = {
  occurrenceId: string;
  conditionsSha256: string;
  exactSourceItem: ExactSourceItem;
  contractGap:
    | "investment-rotation-or-prevalence"
    | "candidate-domain-or-ranking"
    | "buff-coverage-or-offensive-tail"
    | "team-archetype-or-roster-disjunction";
};

const SELECTED_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.circlet[0].conditions",
    conditionsSha256:
      "96d033ed6175b014f87697f126ede158cd83aa84a9ccd85981eb5b0c1001d900",
    exactSourceItem: {
      statIds: ["cr", "cd"],
      conditions: ["Klee is used as an on-field DPS."],
    },
    predicate: ROLE_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[0].conditions",
    conditionsSha256:
      "96d033ed6175b014f87697f126ede158cd83aa84a9ccd85981eb5b0c1001d900",
    exactSourceItem: {
      statIds: ["pyro%"],
      conditions: ["Klee is used as an on-field DPS."],
    },
    predicate: ROLE_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.sands[0].conditions",
    conditionsSha256:
      "96d033ed6175b014f87697f126ede158cd83aa84a9ccd85981eb5b0c1001d900",
    exactSourceItem: {
      statIds: ["atk%"],
      conditions: ["Klee is used as an on-field DPS."],
    },
    predicate: ROLE_PREDICATE,
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions",
    conditionsSha256:
      "feb2ecd578fdfa80c453e6507a69e41c32422d5d0fdd7ef7e965573235595092",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "marechaussee_hunter" }],
      grouping: "single",
      classification: "conditional",
      conditions: ["Klee is used in a Furina team."],
    },
    predicate: FURINA_ROSTER_PREDICATE,
  },
] as const satisfies readonly SelectedOccurrenceDefinition[];

const HOLDOUT_OCCURRENCES = [
  {
    occurrenceId:
      "kqm:character_guide:klee-c2-off-field-support-equipment-luna-iv:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "6fbeeacb83a84974fcc8d3931037a0d38cd00175beb1d70edab310426a10a350",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "instructor" }],
      grouping: "single",
      classification: "recommended",
      conditions: [
        "Klee is used as a support; the source calls Instructor the most commonly used support set.",
      ],
    },
    contractGap: "investment-rotation-or-prevalence",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-c2-off-field-support-equipment-luna-iv:recommendation.weaponRecommendations[0].conditions",
    conditionsSha256:
      "ad84daf0b6e7b2b6cdd94d843298af373ea8af48552e5194a1f95caaca7e745a",
    exactSourceItem: {
      weaponIds: [
        "thrilling_tales_of_dragon_slayers",
        "wandering_evenstar",
      ],
      grouping: "alternatives",
      classification: "recommended",
      conditions: [
        "Klee is used as an off-field C2+ support.",
        "Choose between these weapons according to the rotation and the team's damage distribution.",
      ],
    },
    contractGap: "investment-rotation-or-prevalence",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-generalist-best-five-star-weapon-luna-iv:recommendation.weaponRecommendations[0].conditions",
    conditionsSha256:
      "8b70fd75699b1e6490f59295fbaac05af7ee890b424bfc1623b67335b3789b79",
    exactSourceItem: {
      weaponIds: ["reliquary_of_truth"],
      grouping: "single",
      classification: "default",
      conditions: [
        "This claim is scoped to generalist 5-star weapons for on-field Klee.",
      ],
    },
    contractGap: "candidate-domain-or-ranking",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-generalist-best-four-star-weapon-luna-iv:recommendation.weaponRecommendations[0].conditions",
    conditionsSha256:
      "c6b06ad6d3136ec51c8a88a86c2c4adf74171d0592fb03ac7e669f4dce25abad",
    exactSourceItem: {
      weaponIds: ["the_widsith"],
      grouping: "single",
      classification: "default",
      conditions: [
        "This claim is scoped to generalist 4-star weapons for on-field Klee.",
      ],
    },
    contractGap: "candidate-domain-or-ranking",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[1].conditions",
    conditionsSha256:
      "79bd4186286b1611bad9e9e6278a8d7c048a4da8653b28e3ebd7d64201b4b6c2",
    exactSourceItem: {
      statIds: ["atk%"],
      conditions: [
        "Klee is used as an on-field DPS.",
        "The team provides significant DMG Bonus but few ATK buffs, such as some Furina teams.",
      ],
    },
    contractGap: "buff-coverage-or-offensive-tail",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.substats[0].conditions",
    conditionsSha256:
      "608af5e4794b642320e41bc39df5f79c02f87e1d39b6bc13d80b2b7c645c4996",
    exactSourceItem: {
      statIds: ["cr", "cd"],
      priority: 1,
      conditions: [
        "Klee is used as an on-field DPS; this priority covers offensive stats only.",
      ],
    },
    contractGap: "buff-coverage-or-offensive-tail",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.substats[1].conditions",
    conditionsSha256:
      "608af5e4794b642320e41bc39df5f79c02f87e1d39b6bc13d80b2b7c645c4996",
    exactSourceItem: {
      statIds: ["atk%"],
      priority: 2,
      conditions: [
        "Klee is used as an on-field DPS; this priority covers offensive stats only.",
      ],
    },
    contractGap: "buff-coverage-or-offensive-tail",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[0].conditions",
    conditionsSha256:
      "e1ea700dc4e7bedd6a34d07b1656667e0ecf1ef4eb3eb150cef8879ce5d9b476",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "a_day_carved_from_rising_winds" }],
      grouping: "single",
      classification: "default",
      conditions: [
        "Klee is used as an on-field DPS; the source calls this her best set in almost any team.",
      ],
    },
    contractGap: "candidate-domain-or-ranking",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[1].conditions",
    conditionsSha256:
      "94e0561e33f004fa18eb9b801e3783ea3bba23ebe6af1e5aa76c3bb1465387b2",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "crimson_witch_of_flames" }],
      grouping: "single",
      classification: "conditional",
      conditions: ["Klee is used in a reaction team."],
    },
    contractGap: "team-archetype-or-roster-disjunction",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[3].conditions",
    conditionsSha256:
      "ba97f0df5445c0552fcaec812f0266efab9625b7946f5e97a4cbbe16bea2b298",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "night_of_the_skys_unveiling" }],
      grouping: "single",
      classification: "conditional",
      conditions: ["Klee's team includes Ineffa or Columbina, or both."],
    },
    contractGap: "team-archetype-or-roster-disjunction",
  },
  {
    occurrenceId:
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[4].conditions",
    conditionsSha256:
      "bc7da3b44dceff3328af3b0562e34562ffbafee0368111cc40425a836eb1f8df",
    exactSourceItem: {
      artifacts: [{ type: "4pc", setId: "unfinished_reverie" }],
      grouping: "single",
      classification: "conditional",
      conditions: ["Klee is used in a Burning team."],
    },
    contractGap: "team-archetype-or-roster-disjunction",
  },
] as const satisfies readonly HoldoutOccurrenceDefinition[];

const EXPECTED_RAW_RECORD_IDS = [
  "klee-c2-off-field-support-equipment-luna-iv",
  "klee-chevreuse-durin-fischl-overload-example-luna-iv",
  "klee-furina-albedo-xilonen-example-luna-iv",
  "klee-generalist-best-five-star-weapon-luna-iv",
  "klee-generalist-best-four-star-weapon-luna-iv",
  "klee-on-field-artifact-stats-luna-iv",
  "klee-on-field-contextual-artifact-sets-luna-iv",
] as const;

const CAUTIONS = [
  "The four selected occurrences remain agent-assisted and unreviewed source observations.",
  "Applicable-under-supplied-context means only that an explicit request fact satisfies one pinned applicability predicate; it is not a computed recommendation or rank.",
  "The three on-field role facts are supplied independently for each exact team and are not inferred from recommendation role metadata.",
  "The eleven Klee holdouts receive no binding or energy classification from this slice; shared words do not grant a partial binding.",
  "Not-energy-deferred is occurrence-scoped for this applicability slice and does not provide an ER requirement or prove ER adequacy.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this slice as a Klee guide, an artifact recommendation, a main-stat recommendation, or a team recommendation.",
  "Do not rank Marechaussee Hunter or the three main stats from these applicability cells.",
  "Do not infer a typed predicate for any of the eleven holdouts or any other source occurrence.",
  "Do not treat recommendation roles as runtime facts or allow a request fact to satisfy an exact-roster predicate.",
  "Do not use this report as a build, generator, optimizer, formula, rotation, damage, DPS, ideal-roll, or ER result.",
] as const;

export interface KleeSourceLocalConditionSliceSourceFile {
  path: string;
  text: string;
}

export interface BuildKleeSourceLocalConditionSliceInput {
  repositoryInput: unknown;
  manualSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  sourceFiles: readonly KleeSourceLocalConditionSliceSourceFile[];
  generatedFrom: readonly GeneratedFromEntry[];
}

export interface KleeSourceLocalHoldoutOccurrence {
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
  repositoryParity: "exact";
  sliceDisposition: "holdout";
  bindingAuthoredBySlice: false;
  energyClassificationAuthoredBySlice: false;
  contractGap: HoldoutOccurrenceDefinition["contractGap"];
}

export interface KleeSourceLocalSelectedOccurrence {
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
  repositoryParity: "exact";
  sliceDisposition: "selected";
  bindingAuthoredBySlice: true;
  sliceBindingClassification: "typed-bound";
  energyClassificationAuthoredBySlice: true;
  sliceEnergyClassification: "not-energy-deferred";
}

export interface KleeSourceLocalConditionSliceReport {
  schemaVersion: 1;
  reportType: "klee-source-local-condition-slice";
  sliceId: typeof KLEE_SLICE_ID;
  classification: "authenticated-source-local-condition-binding-slice";
  comparisonStatus: "comparable" | "not-comparable";
  publicationStatus: "withheld-unreviewed-source-slice";
  arbitraryEnglishParsingAllowed: false;
  supportsSourceAuthorization: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  conditionTruthEstablishedFromRecommendationMetadata: false;
  recommendationCompositionExecuted: false;
  generatorExecuted: false;
  optimizerExecuted: false;
  damageComputationExecuted: false;
  energyRecoveryComputationExecuted: false;
  generatedFrom: GeneratedFromEntry[];
  rawInputBoundary: {
    status: "accepted" | "rejected";
    exactPathSet: boolean;
    byteAndParsedObjectClosure: boolean;
    sourceFileCount: number;
    canonicalObjectSha256ByPath: Record<string, string>;
  };
  sourceBoundary: {
    status: "accepted" | "rejected";
    sourceId: "kqm";
    pageUrl: typeof KLEE_PAGE_URL;
    sourceVersion: typeof KLEE_SOURCE_VERSION;
    snapshotPath: typeof KLEE_SNAPSHOT_RELATIVE_PATH;
    rawRecordCount: number;
    rawRecordIds: string[];
    selectedOccurrenceCount: number;
    holdoutOccurrenceCount: number;
    selectedAndHoldoutsCloseAllKleeConditions: boolean;
    repositoryParity: "exact" | "mismatch" | "not-evaluated";
    samePageLineage: boolean;
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    sourceRegistryStatus: "active";
    sourceRegistryIngestionMode: "manual-observation";
    sourceRegistryPermission: "unknown";
    promotionEligible: false;
  };
  selectedOccurrences: KleeSourceLocalSelectedOccurrence[];
  holdoutOccurrences: KleeSourceLocalHoldoutOccurrence[];
  sourceLocalSlice: SourceLocalConditionSliceReport | null;
  summary: {
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
    holdoutWithoutAuthoredEnergyClassificationCount: number;
    assembledBuildCount: 0;
  };
  issues: SourceConditionedGuidePacketIssue[];
  cautions: string[];
  prohibitedInterpretations: string[];
}

export type KleeSourceLocalConditionSliceAuthentication =
  | {
      authenticated: true;
      canonicalReport: KleeSourceLocalConditionSliceReport;
    }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: SourceConditionedGuidePacketIssue[];
    };

export const KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS = [
  REPOSITORY_RELATIVE_PATH,
  MANUAL_INDEX_RELATIVE_PATH,
  SOURCE_REGISTRY_RELATIVE_PATH,
  KLEE_SNAPSHOT_RELATIVE_PATH,
] as const;

export const KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS = [
  ...new Set([
    "scripts/guide-factory/src/kleeSourceLocalConditionSlice.ts",
    "scripts/guide-factory/src/assemble-klee-source-local-condition-slice.ts",
    "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    "scripts/guide-factory/src/sourceConditionedGuidePacket.ts",
    "scripts/guide-factory/src/guideRequestContext.ts",
    "scripts/guide-factory/src/manualConditionArrayCoverage.ts",
    "scripts/guide-factory/src/schemas.ts",
    "scripts/guide-factory/src/io.ts",
    "scripts/guide-factory/src/paths.ts",
    ...KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  ]),
].sort(compareText);

export const KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "klee-source-local-condition-slice.json",
);

const CAPABILITY_BOUNDARY = {
  arbitraryEnglishParsingAllowed: false,
  supportsSourceAuthorization: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsDamageClaims: false,
  supportsEnergyRecoveryClaims: false,
  conditionTruthEstablishedFromRecommendationMetadata: false,
  recommendationCompositionExecuted: false,
  generatorExecuted: false,
  optimizerExecuted: false,
  damageComputationExecuted: false,
  energyRecoveryComputationExecuted: false,
} as const;

export function buildKleeSourceLocalConditionSliceReport(
  input: BuildKleeSourceLocalConditionSliceInput,
): KleeSourceLocalConditionSliceReport {
  let generatedFrom: GeneratedFromEntry[] = [];
  try {
    generatedFrom = authenticateGeneratedFrom(input.generatedFrom);
    const canonicalObjectSha256ByPath = authenticateRawInputs(
      input,
      generatedFrom,
    );
    const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(
      input.manualSnapshotInput,
    );
    const index = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
    const registry = SourceRegistrySchema.parse(input.sourceRegistryInput);
    const sourceRegistrySha256 = generatedFrom.find(
      ({ path: entryPath }) => entryPath === SOURCE_REGISTRY_RELATIVE_PATH,
    )?.sha256;
    authenticateSourceDocument(
      snapshot,
      index,
      registry,
      repository,
      sourceRegistrySha256,
    );

    const coverageCore = buildManualConditionArrayCoverageCore({
      manualIndexInput: {
        schemaVersion: 1,
        snapshots: [
          { sourceId: "kqm", path: KLEE_SNAPSHOT_RELATIVE_PATH },
        ],
      },
      manualSnapshotInputs: [
        {
          path: KLEE_SNAPSHOT_RELATIVE_PATH,
          snapshotInput: input.manualSnapshotInput,
        },
      ],
      repositoryInput: repository,
    });
    if (
      coverageCore.repositoryParity.status !== "exact" ||
      coverageCore.extraction.occurrences.length !== 15 ||
      coverageCore.extraction.occurrences.some(
        ({ conditions, subject }) => conditions.length === 0 || subject !== "klee",
      )
    ) {
      throw new Error(
        "The exact Klee condition corpus is no longer fifteen nonempty, parity-exact Klee occurrences.",
      );
    }

    const parityByOccurrenceId = new Map(
      coverageCore.repositoryParity.rows.map((row) => [row.occurrenceId, row]),
    );
    const occurrenceById = new Map(
      coverageCore.extraction.occurrences.map((occurrence) => {
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
    const selectedIds = new Set(
      SELECTED_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
    );
    const holdoutIds = new Set(
      HOLDOUT_OCCURRENCES.map(({ occurrenceId }) => occurrenceId),
    );
    authenticateExactOccurrencePartition(
      occurrenceById,
      selectedIds,
      holdoutIds,
    );

    const selectedOccurrences: KleeSourceLocalSelectedOccurrence[] = [];
    const claims: SourceLocalConditionClaimInput[] = [];
    SELECTED_OCCURRENCES.forEach((definition, catalogIndex) => {
      const occurrence = requiredOccurrence(occurrenceById, definition.occurrenceId);
      authenticateDefinitionAndPayload(
        definition,
        occurrence,
        snapshot,
        repository,
      );
      const payload = payloadForOccurrence(repository, occurrence, "repository");
      const predicateSha256 = hashValue(definition.predicate);
      const payloadSha256 = hashValue(payload);
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
        requestBindings:
          definition.predicate.type === "unresolved-context"
            ? [
                {
                  sourcePredicatePath: "predicate",
                  sourcePredicateLeafSha256: predicateSha256,
                  requestPredicate: {
                    type: "intended-role-is",
                    characterId: "klee",
                    roleId: "on-field-dps",
                  },
                },
              ]
            : [],
      });
    });

    const holdoutOccurrences = HOLDOUT_OCCURRENCES.map((definition) => {
      const occurrence = requiredOccurrence(occurrenceById, definition.occurrenceId);
      authenticateDefinitionAndPayload(
        definition,
        occurrence,
        snapshot,
        repository,
      );
      const payload = payloadForOccurrence(repository, occurrence, "repository");
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
        conditions: [...occurrence.conditions],
        conditionsSha256: occurrence.conditionsSha256,
        payload,
        payloadSha256: hashValue(payload),
        repositoryParity: "exact" as const,
        sliceDisposition: "holdout" as const,
        bindingAuthoredBySlice: false as const,
        energyClassificationAuthoredBySlice: false as const,
        contractGap: definition.contractGap,
      };
    });

    const exactTeams = buildExactTeams(repository, snapshot);
    const sourceLocalInput = buildSourceLocalInput(
      generatedFrom,
      claims,
      exactTeams,
      canonicalSourceHashes(generatedFrom),
    );
    const sourceLocalSlice = buildSourceLocalConditionSliceReport(
      sourceLocalInput,
    );
    if (sourceLocalSlice.comparisonStatus !== "comparable") {
      throw new Error(
        `The canonical Klee source-local slice is not comparable: ${sourceLocalSlice.issues
          .map(({ code }) => code)
          .join(", ")}.`,
      );
    }
    authenticateExpectedSliceSemantics(sourceLocalSlice);

    return {
      schemaVersion: 1,
      reportType: "klee-source-local-condition-slice",
      sliceId: KLEE_SLICE_ID,
      classification: "authenticated-source-local-condition-binding-slice",
      comparisonStatus: "comparable",
      publicationStatus: "withheld-unreviewed-source-slice",
      ...CAPABILITY_BOUNDARY,
      generatedFrom,
      rawInputBoundary: {
        status: "accepted",
        exactPathSet: true,
        byteAndParsedObjectClosure: true,
        sourceFileCount: KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS.length,
        canonicalObjectSha256ByPath,
      },
      sourceBoundary: {
        status: "accepted",
        sourceId: "kqm",
        pageUrl: KLEE_PAGE_URL,
        sourceVersion: KLEE_SOURCE_VERSION,
        snapshotPath: KLEE_SNAPSHOT_RELATIVE_PATH,
        rawRecordCount: snapshot.records.length,
        rawRecordIds: snapshot.records
          .map(({ sourceRecordId }) => sourceRecordId)
          .sort(compareText),
        selectedOccurrenceCount: selectedOccurrences.length,
        holdoutOccurrenceCount: holdoutOccurrences.length,
        selectedAndHoldoutsCloseAllKleeConditions: true,
        repositoryParity: coverageCore.repositoryParity.status,
        samePageLineage: true,
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        sourceRegistryStatus: "active",
        sourceRegistryIngestionMode: "manual-observation",
        sourceRegistryPermission: "unknown",
        promotionEligible: false,
      },
      selectedOccurrences,
      holdoutOccurrences,
      sourceLocalSlice,
      summary: summaryFromSlice(sourceLocalSlice, holdoutOccurrences.length),
      issues: [],
      cautions: [...CAUTIONS],
      prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
    };
  } catch (error) {
    return failedReport(
      generatedFrom,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function authenticateKleeSourceLocalConditionSliceReport(
  serializedReport: KleeSourceLocalConditionSliceReport,
  input: BuildKleeSourceLocalConditionSliceInput,
): KleeSourceLocalConditionSliceAuthentication {
  const canonicalReport = buildKleeSourceLocalConditionSliceReport(input);
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
          code: "klee-source-local.serialized-report-mismatch",
          path: "serializedReport",
          message:
            "Serialized Klee source-local report does not match a fresh canonical rebuild from current exact inputs.",
        },
      ],
    };
  }
  return { authenticated: true, canonicalReport };
}

export function requireComparableKleeSourceLocalConditionSliceReport(
  report: KleeSourceLocalConditionSliceReport,
  input: BuildKleeSourceLocalConditionSliceInput,
): void {
  const authentication = authenticateKleeSourceLocalConditionSliceReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Klee source-local report (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function buildSourceLocalInput(
  generatedFrom: readonly GeneratedFromEntry[],
  claims: readonly SourceLocalConditionClaimInput[],
  exactTeams: readonly SourceLocalExactTeamInput[],
  sourceHashes: readonly GeneratedFromEntry[],
): SourceLocalConditionSliceInput {
  return {
    sliceId: KLEE_SLICE_ID,
    generatedFrom,
    sourceBoundary: {
      sourceId: "kqm",
      pageUrl: KLEE_PAGE_URL,
      sourceVersion: KLEE_SOURCE_VERSION,
      snapshotPath: KLEE_SNAPSHOT_RELATIVE_PATH,
      rawManualSourceRecordIds: [
        "klee-on-field-artifact-stats-luna-iv",
        "klee-on-field-contextual-artifact-sets-luna-iv",
        ...TEAM_DEFINITIONS.map(({ sourceRecordId }) => sourceRecordId),
      ],
      consolidatedGuideRecordIds: [
        "kqm:character-guide:klee-on-field-artifact-stats-luna-iv",
        "kqm:character-guide:klee-on-field-contextual-artifact-sets-luna-iv",
      ],
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryPermission: "unknown",
      repositoryRecordStatus: "candidate",
      sourceHashes,
    },
    claims,
    exactTeams,
    requestContext: {
      requestFactsByTeamRecordId: Object.fromEntries(
        TEAM_DEFINITIONS.map(({ repositoryRecordId }) => [
          repositoryRecordId,
          {
            characterFactsById: {
              klee: { intendedRole: "on-field-dps" },
            },
          },
        ]),
      ),
    },
    expectedCounts: {
      claimCount: 4,
      teamCount: 2,
      cellCount: 8,
      sourceResolution: { matched: 1, inapplicable: 1, unresolved: 6 },
      effectiveResolution: { matched: 7, inapplicable: 1, unresolved: 0 },
      contextApplicability: {
        sourceAlreadyMatched: 1,
        sourceDefinitelyInapplicable: 1,
        applicableUnderSuppliedContext: 6,
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
  occurrence: KleeConditionOccurrence,
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
  const sourceIndex = sourceItemIndex(occurrence.repositoryPath);
  const sourceItem = sourceItemForOccurrence(repository, occurrence, "repository");
  return {
    claimId: occurrence.occurrenceId,
    catalogIndex,
    repositoryRecordId: occurrence.repositoryRecordId,
    sourceId: occurrence.sourceId,
    sourceRecordId: occurrence.sourceRecordId,
    characterId: "klee",
    recommendation: {
      recommendationId: recommendation.id,
      label: recommendation.label ?? null,
      scope: recommendation.scope,
      roles: [...recommendation.roles],
      ordering:
        occurrence.claimAxis === "weapon-recommendation"
          ? recommendation.weaponOrdering ?? null
          : occurrence.claimAxis === "artifact-recommendation"
            ? recommendation.artifactOrdering ?? null
            : null,
      classification:
        occurrence.claimAxis === "weapon-recommendation" ||
        occurrence.claimAxis === "artifact-recommendation"
          ? readRecommendationClassification(sourceItem)
          : null,
      grouping:
        occurrence.claimAxis === "weapon-recommendation" ||
        occurrence.claimAxis === "artifact-recommendation"
          ? (readNullableString(sourceItem, "grouping") as
              | "single"
              | "alternatives"
              | "tied"
              | null)
          : null,
      sourceIndex,
    },
    payload,
    sourceConditions: [...occurrence.conditions],
    sourceConditionsSha256: occurrence.conditionsSha256,
    predicate: structuredClone(predicate),
  };
}

function buildExactTeams(
  repository: KnowledgeRepository,
  snapshot: ManualObservationSnapshot,
): SourceLocalExactTeamInput[] {
  return TEAM_DEFINITIONS.map((definition, packetIndex) => {
    const repositoryRecord = requiredRepositoryTeam(
      repository,
      definition.repositoryRecordId,
    );
    const manualRecord = snapshot.records.find(
      (record) =>
        record.kind === "team" &&
        record.sourceRecordId === definition.sourceRecordId,
    );
    if (!manualRecord || manualRecord.kind !== "team") {
      throw new Error(`Missing exact manual team ${definition.sourceRecordId}.`);
    }
    const repositoryRoster = repositoryRecord.members.map(
      ({ characterId }) => characterId,
    );
    const manualRoster = manualRecord.members.map(({ characterId }) => characterId);
    const manualTeamSemantics = {
      label: manualRecord.label ?? null,
      intent: manualRecord.intent,
      exhaustiveness: manualRecord.exhaustiveness,
      rankingClaim: manualRecord.rankingClaim,
    };
    const repositoryTeamSemantics = {
      label: repositoryRecord.label ?? null,
      intent: repositoryRecord.intent ?? null,
      exhaustiveness: repositoryRecord.exhaustiveness ?? null,
      rankingClaim: repositoryRecord.rankingClaim ?? null,
    };
    const expectedSourceRefs = [
      manualRecord.locator,
      ...manualRecord.supportingLocators,
    ].map((locator) => ({
      sourceId: "kqm" as const,
      sourceRecordId: definition.sourceRecordId,
      locator,
    }));
    if (
      stableJson(repositoryRoster) !== stableJson(definition.memberCharacterIds) ||
      stableJson(manualRoster) !== stableJson(definition.memberCharacterIds) ||
      stableJson(repositoryTeamSemantics) !== stableJson(manualTeamSemantics) ||
      stableJson(repositoryRecord.sourceRefs) !== stableJson(expectedSourceRefs) ||
      locatorUrl(manualRecord.locator) !== KLEE_PAGE_URL ||
      repositoryRecord.status !== "candidate" ||
      repositoryRecord.promotionEligible !== false ||
      repositoryRecord.members.some(
        ({ selectedArtifact, selectedWeapon }) =>
          selectedArtifact !== null || selectedWeapon !== null,
      )
    ) {
      throw new Error(`Exact team lineage drifted for ${definition.repositoryRecordId}.`);
    }
    return {
      packetIndex,
      teamRecordId: repositoryRecord.id,
      snapshotPath: KLEE_SNAPSHOT_RELATIVE_PATH,
      sourceId: "kqm",
      sourceRecordId: definition.sourceRecordId,
      label: repositoryRecord.label ?? null,
      intent: repositoryRecord.intent ?? "example",
      exhaustiveness: repositoryRecord.exhaustiveness ?? "unspecified",
      rankingClaim: repositoryRecord.rankingClaim ?? "none",
      memberCharacterIds: [...definition.memberCharacterIds],
    };
  });
}

function authenticateSourceDocument(
  snapshot: ManualObservationSnapshot,
  index: ReturnType<typeof ManualSnapshotIndexSchema.parse>,
  registry: ReturnType<typeof SourceRegistrySchema.parse>,
  repository: KnowledgeRepository,
  sourceRegistrySha256: string | undefined,
): void {
  const expectedIds = [...EXPECTED_RAW_RECORD_IDS].sort(compareText);
  const actualIds = snapshot.records
    .map(({ sourceRecordId }) => sourceRecordId)
    .sort(compareText);
  const indexMatches = index.snapshots.filter(
    ({ sourceId, path: snapshotPath }) =>
      sourceId === "kqm" && snapshotPath === KLEE_SNAPSHOT_RELATIVE_PATH,
  );
  const matchingSources = registry.sources.filter(({ id }) => id === "kqm");
  const source = matchingSources[0];
  if (
    snapshot.sourceId !== "kqm" ||
    snapshot.page.url !== KLEE_PAGE_URL ||
    snapshot.page.sourceVersion !== KLEE_SOURCE_VERSION ||
    snapshot.page.title !== "Klee Quick Guide" ||
    stableJson(actualIds) !== stableJson(expectedIds) ||
    snapshot.records.some(
      ({ locator, extraction }) =>
        locatorUrl(locator) !== KLEE_PAGE_URL ||
        extraction.method !== "agent-assisted" ||
        extraction.reviewStatus !== "unreviewed",
    ) ||
    indexMatches.length !== 1 ||
    matchingSources.length !== 1 ||
    !source ||
    source.status !== "active" ||
    source.ingestionMode !== "manual-observation" ||
    source.permission !== "unknown" ||
    source.recordFormat !== "manual-observation-v1" ||
    sourceRegistrySha256 == null ||
    repository.sourceRegistrySha256 !== sourceRegistrySha256
  ) {
    throw new Error("Klee source-document, index, or registry boundary drifted.");
  }
}

function authenticateDefinitionAndPayload(
  definition: SelectedOccurrenceDefinition | HoldoutOccurrenceDefinition,
  occurrence: KleeConditionOccurrence,
  snapshot: ManualObservationSnapshot,
  repository: KnowledgeRepository,
): void {
  const occurrencePrefix = `kqm:character_guide:${occurrence.sourceRecordId}:`;
  const expectedManualClaimPath = definition.occurrenceId.startsWith(
    occurrencePrefix,
  )
    ? definition.occurrenceId.slice(occurrencePrefix.length)
    : "";
  const expectedRepositoryPath = `recommendations[0].${expectedManualClaimPath.replace(
    /^recommendation\./,
    "",
  )}`;
  if (
    occurrence.conditionsSha256 !== definition.conditionsSha256 ||
    occurrence.manualClaimPath !== expectedManualClaimPath ||
    occurrence.repositoryPath !== expectedRepositoryPath ||
    occurrence.sourceId !== "kqm" ||
    occurrence.subject !== "klee" ||
    occurrence.structuralEnergyDimension !== "not-structural-er"
  ) {
    throw new Error(`Exact occurrence boundary drifted for ${occurrence.occurrenceId}.`);
  }
  const manualItem = sourceItemForOccurrence(snapshot, occurrence, "manual");
  const repositoryItem = sourceItemForOccurrence(
    repository,
    occurrence,
    "repository",
  );
  const manualRecord = snapshot.records.find(
    (record) =>
      record.kind === "character_guide" &&
      record.sourceRecordId === occurrence.sourceRecordId,
  );
  const repositoryRecord = repository.records.find(
    (record) =>
      record.id === occurrence.repositoryRecordId &&
      record.kind === "character_guide" &&
      record.characterId === "klee",
  );
  if (
    stableJson(manualItem) !== stableJson(definition.exactSourceItem) ||
    stableJson(repositoryItem) !== stableJson(definition.exactSourceItem)
  ) {
    throw new Error(`Exact source payload drifted for ${occurrence.occurrenceId}.`);
  }
  if (
    !manualRecord ||
    manualRecord.kind !== "character_guide" ||
    !repositoryRecord ||
    repositoryRecord.kind !== "character_guide" ||
    repositoryRecord.status !== "candidate" ||
    repositoryRecord.promotionEligible !== false ||
    stableJson(repositoryRecord.sourceRefs) !==
      stableJson(
        [manualRecord.locator, ...manualRecord.supportingLocators].map(
          (locator) => ({
            sourceId: "kqm",
            sourceRecordId: occurrence.sourceRecordId,
            locator,
          }),
        ),
      ) ||
    repositoryRecord.recommendations?.length !== 1 ||
    stableJson(repositoryRecord.recommendations[0]) !==
      stableJson(manualRecord.recommendation)
  ) {
    throw new Error(
      `Exact parent recommendation lineage drifted for ${occurrence.occurrenceId}.`,
    );
  }
}

function authenticateExactOccurrencePartition(
  occurrenceById: ReadonlyMap<string, KleeConditionOccurrence>,
  selectedIds: ReadonlySet<string>,
  holdoutIds: ReadonlySet<string>,
): void {
  if (selectedIds.size !== 4 || holdoutIds.size !== 11) {
    throw new Error("Klee selected/holdout occurrence counts drifted.");
  }
  if ([...selectedIds].some((occurrenceId) => holdoutIds.has(occurrenceId))) {
    throw new Error("Klee selected and holdout occurrence sets overlap.");
  }
  const union = [...selectedIds, ...holdoutIds].sort(compareText);
  const current = [...occurrenceById.keys()].sort(compareText);
  if (stableJson(union) !== stableJson(current)) {
    throw new Error(
      "Klee selected and holdout occurrence sets do not close the exact current condition corpus.",
    );
  }
}

function authenticateExpectedSliceSemantics(
  report: SourceLocalConditionSliceReport,
): void {
  const safe =
    report.summary.claimCount === 4 &&
    report.summary.teamCount === 2 &&
    report.summary.cellCount === 8 &&
    report.summary.sourceMatchedCount === 1 &&
    report.summary.sourceInapplicableCount === 1 &&
    report.summary.sourceUnresolvedCount === 6 &&
    report.summary.effectiveMatchedCount === 7 &&
    report.summary.effectiveInapplicableCount === 1 &&
    report.summary.effectiveUnresolvedCount === 0 &&
    report.summary.applicableUnderSuppliedContextCount === 6 &&
    report.summary.sourceAlreadyMatchedCount === 1 &&
    report.summary.sourceDefinitelyInapplicableCount === 1 &&
    report.summary.deferredEnergyCount === 0 &&
    report.summary.assembledBuildCount === 0 &&
    !report.supportsGuideClaims &&
    !report.supportsTeamRecommendations &&
    !report.supportsBuildRecommendations &&
    !report.supportsStatRecommendations &&
    !report.supportsRankClaims &&
    !report.supportsDamageClaims &&
    !report.supportsEnergyRecoveryClaims &&
    !report.recommendationCompositionExecuted &&
    !report.generatorExecuted &&
    !report.optimizerExecuted &&
    !report.damageComputationExecuted &&
    !report.energyRecoveryComputationExecuted;
  if (!safe) {
    throw new Error("Klee source-local slice crossed its expected semantic boundary.");
  }
}

function authenticateGeneratedFrom(
  input: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const expectedPaths = [...KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS];
  const canonical = [...input]
    .map((entry) => ({ ...entry }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    stableJson(canonical.map(({ path: entryPath }) => entryPath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Klee source-local generatedFrom path closure drifted.");
  }
  if (
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256)) ||
    new Set(canonical.map(({ path: entryPath }) => entryPath)).size !==
      canonical.length
  ) {
    throw new Error("Klee source-local generatedFrom hashes or paths are invalid.");
  }
  return canonical;
}

function authenticateRawInputs(
  input: BuildKleeSourceLocalConditionSliceInput,
  generatedFrom: readonly GeneratedFromEntry[],
): Record<string, string> {
  const files = [...input.sourceFiles].sort((left, right) =>
    compareText(left.path, right.path),
  );
  const expectedPaths = [
    ...KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  ].sort(compareText);
  if (
    stableJson(files.map(({ path: filePath }) => filePath)) !==
    stableJson(expectedPaths)
  ) {
    throw new Error("Klee raw source-file path closure drifted.");
  }
  const valuesByPath = new Map<string, unknown>([
    [REPOSITORY_RELATIVE_PATH, input.repositoryInput],
    [KLEE_SNAPSHOT_RELATIVE_PATH, input.manualSnapshotInput],
    [MANUAL_INDEX_RELATIVE_PATH, input.manualIndexInput],
    [SOURCE_REGISTRY_RELATIVE_PATH, input.sourceRegistryInput],
  ]);
  return Object.fromEntries(
    files.map((file) => {
      const generatedMatches = generatedFrom.filter(
        ({ path: entryPath }) => entryPath === file.path,
      );
      if (
        generatedMatches.length !== 1 ||
        generatedMatches[0]?.sha256 !== sha256Text(file.text)
      ) {
        throw new Error(`Raw byte hash mismatch for ${file.path}.`);
      }
      const parsed = JSON.parse(file.text) as unknown;
      if (stableJson(parsed) !== stableJson(valuesByPath.get(file.path))) {
        throw new Error(`Parsed input does not match raw bytes for ${file.path}.`);
      }
      return [file.path, hashValue(parsed)];
    }),
  );
}

function canonicalSourceHashes(
  generatedFrom: readonly GeneratedFromEntry[],
): GeneratedFromEntry[] {
  const sourcePaths = new Set<string>(
    KLEE_SOURCE_LOCAL_CONDITION_SLICE_SOURCE_FILE_PATHS,
  );
  return generatedFrom
    .filter(({ path: entryPath }) => sourcePaths.has(entryPath))
    .map((entry) => ({ ...entry }));
}

function payloadForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: KleeConditionOccurrence,
  kind: "manual" | "repository",
): SourceConditionedClaimPayload {
  const item = sourceItemForOccurrence(root, occurrence, kind);
  if (occurrence.claimAxis === "weapon-recommendation") {
    return { type: "weapon-group", weaponIds: readStringArray(item, "weaponIds") };
  }
  if (occurrence.claimAxis === "artifact-recommendation") {
    const artifacts = item.artifacts;
    if (!Array.isArray(artifacts)) {
      throw new Error(`Missing artifact payload for ${occurrence.occurrenceId}.`);
    }
    return {
      type: "artifact-group",
      artifacts: structuredClone(artifacts) as ArtifactChoice[],
    };
  }
  if (occurrence.claimAxis === "main-stat") {
    if (!occurrence.mainStatSlot) {
      throw new Error(`Missing main-stat slot for ${occurrence.occurrenceId}.`);
    }
    return {
      type: "main-stat",
      slot: occurrence.mainStatSlot,
      statIds: readStringArray(item, "statIds"),
      priority: readNullableNumber(item, "priority"),
      target: readNullableString(item, "target"),
    };
  }
  if (occurrence.claimAxis === "substat") {
    return {
      type: "substat",
      statIds: readStringArray(item, "statIds"),
      priority: readNullableNumber(item, "priority"),
      target: readNullableString(item, "target"),
    };
  }
  throw new Error(
    `Unsupported Klee source-local claim axis ${occurrence.claimAxis}.`,
  );
}

function sourceItemForOccurrence(
  root: KnowledgeRepository | ManualObservationSnapshot,
  occurrence: KleeConditionOccurrence,
  kind: "manual" | "repository",
): Record<string, unknown> {
  const conditionPath =
    kind === "manual" ? occurrence.manualPath : occurrence.repositoryJsonPath;
  const itemPath = conditionPath.replace(/\.conditions$/, "");
  const value = readJsonPath(root, itemPath);
  if (!isRecord(value)) {
    throw new Error(`Condition parent ${itemPath} is not an object.`);
  }
  return structuredClone(value);
}

function readJsonPath(root: unknown, jsonPath: string): unknown {
  const tokens = [...jsonPath.matchAll(/([^.\[\]]+)|\[(\d+)\]/g)].map(
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
  byId: ReadonlyMap<string, KleeConditionOccurrence>,
  occurrenceId: string,
): KleeConditionOccurrence {
  const occurrence = byId.get(occurrenceId);
  if (!occurrence) throw new Error(`Missing exact occurrence ${occurrenceId}.`);
  return occurrence;
}

function requiredRepositoryCharacterGuide(
  repository: KnowledgeRepository,
  recordId: string,
): Extract<KnowledgeRecord, { kind: "character_guide" }> {
  const record = repository.records.find(({ id }) => id === recordId);
  if (!record || record.kind !== "character_guide" || record.characterId !== "klee") {
    throw new Error(`Missing exact Klee character-guide record ${recordId}.`);
  }
  if (
    record.status !== "candidate" ||
    record.promotionEligible !== false ||
    record.sourceRefs.length !== 1 ||
    record.sourceRefs[0]?.sourceId !== "kqm" ||
    locatorUrl(record.sourceRefs[0].locator) !== KLEE_PAGE_URL
  ) {
    throw new Error(`Klee guide source boundary drifted for ${recordId}.`);
  }
  return record;
}

function requiredRepositoryTeam(
  repository: KnowledgeRepository,
  recordId: string,
): Extract<KnowledgeRecord, { kind: "team" }> {
  const record = repository.records.find(({ id }) => id === recordId);
  if (!record || record.kind !== "team") {
    throw new Error(`Missing exact Klee team record ${recordId}.`);
  }
  return record;
}

function sourceItemIndex(repositoryPath: string): number {
  const matches = [...repositoryPath.matchAll(/\[(\d+)\]/g)];
  const last = matches.at(-1)?.[1];
  if (last == null) throw new Error(`Missing source index in ${repositoryPath}.`);
  return Number(last);
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
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

function readRecommendationClassification(
  record: Record<string, unknown>,
):
  | "default"
  | "recommended"
  | "alternative"
  | "conditional"
  | "available-only"
  | null {
  const value = readNullableString(record, "classification");
  if (
    value == null ||
    value === "default" ||
    value === "recommended" ||
    value === "alternative" ||
    value === "conditional" ||
    value === "available-only"
  ) {
    return value;
  }
  throw new Error(`Unsupported recommendation classification ${value}.`);
}

function locatorUrl(locator: unknown): string | null {
  return isRecord(locator) && typeof locator.url === "string"
    ? locator.url
    : null;
}

function summaryFromSlice(
  sourceLocalSlice: SourceLocalConditionSliceReport,
  holdoutCount: number,
): KleeSourceLocalConditionSliceReport["summary"] {
  return {
    selectedOccurrenceCount: sourceLocalSlice.summary.claimCount,
    selectedUniqueConditionArrayCount: new Set(
      sourceLocalSlice.conditionControls.map(
        ({ occurrenceControl }) => occurrenceControl.sourceConditionsSha256,
      ),
    ).size,
    holdoutOccurrenceCount: holdoutCount,
    sourceTeamCount: sourceLocalSlice.summary.teamCount,
    sourceCellCount: sourceLocalSlice.summary.cellCount,
    sourceMatchedCount: sourceLocalSlice.summary.sourceMatchedCount,
    sourceInapplicableCount: sourceLocalSlice.summary.sourceInapplicableCount,
    sourceUnresolvedCount: sourceLocalSlice.summary.sourceUnresolvedCount,
    contextApplicableCount:
      sourceLocalSlice.summary.applicableUnderSuppliedContextCount,
    sourceAlreadyMatchedCount:
      sourceLocalSlice.summary.sourceAlreadyMatchedCount,
    sourceDefinitelyInapplicableCount:
      sourceLocalSlice.summary.sourceDefinitelyInapplicableCount,
    effectiveMatchedCount: sourceLocalSlice.summary.effectiveMatchedCount,
    effectiveInapplicableCount:
      sourceLocalSlice.summary.effectiveInapplicableCount,
    effectiveUnresolvedCount: sourceLocalSlice.summary.effectiveUnresolvedCount,
    selectedNotEnergyDeferredCount: sourceLocalSlice.summary.claimCount,
    holdoutWithoutAuthoredEnergyClassificationCount: holdoutCount,
    assembledBuildCount: 0,
  };
}

function failedReport(
  generatedFrom: readonly GeneratedFromEntry[],
  message: string,
): KleeSourceLocalConditionSliceReport {
  return {
    schemaVersion: 1,
    reportType: "klee-source-local-condition-slice",
    sliceId: KLEE_SLICE_ID,
    classification: "authenticated-source-local-condition-binding-slice",
    comparisonStatus: "not-comparable",
    publicationStatus: "withheld-unreviewed-source-slice",
    ...CAPABILITY_BOUNDARY,
    generatedFrom: [...generatedFrom]
      .map((entry) => ({ ...entry }))
      .sort((left, right) => compareText(left.path, right.path)),
    rawInputBoundary: {
      status: "rejected",
      exactPathSet: false,
      byteAndParsedObjectClosure: false,
      sourceFileCount: 0,
      canonicalObjectSha256ByPath: {},
    },
    sourceBoundary: {
      status: "rejected",
      sourceId: "kqm",
      pageUrl: KLEE_PAGE_URL,
      sourceVersion: KLEE_SOURCE_VERSION,
      snapshotPath: KLEE_SNAPSHOT_RELATIVE_PATH,
      rawRecordCount: 0,
      rawRecordIds: [],
      selectedOccurrenceCount: 0,
      holdoutOccurrenceCount: 0,
      selectedAndHoldoutsCloseAllKleeConditions: false,
      repositoryParity: "not-evaluated",
      samePageLineage: false,
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      sourceRegistryStatus: "active",
      sourceRegistryIngestionMode: "manual-observation",
      sourceRegistryPermission: "unknown",
      promotionEligible: false,
    },
    selectedOccurrences: [],
    holdoutOccurrences: [],
    sourceLocalSlice: null,
    summary: {
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
      holdoutWithoutAuthoredEnergyClassificationCount: 0,
      assembledBuildCount: 0,
    },
    issues: [
      {
        code: "klee-source-local.canonical-input-preparation-failed",
        path: "input",
        message,
      },
    ],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

// Keep the absolute paths imported above exercised and guarded by TypeScript;
// the CLI owns I/O while this module publishes repository-relative identities.
void KNOWLEDGE_REPOSITORY_PATH;
void MANUAL_SNAPSHOT_INDEX_PATH;
void SOURCE_REGISTRY_PATH;
