import { sha256Text, stableJson } from "./io";
import {
  ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  buildArtifactChoiceSearchCoverageReport,
  type ArtifactChoiceSearchCoverageReport,
} from "./artifactChoiceSearchCoverage";
import type { ManualSnapshotInput } from "./manualSnapshots";
import {
  compareEligibleCatalogWithCheckedInRosterReport,
  parseCheckedInRosterCatalogReference,
} from "./rosterCatalogReference";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type ArtifactChoice,
  type KnowledgeRecord,
  type KnowledgeRepository,
  type SourceRegistry,
} from "./schemas";
import { cloneTeamMemberInvestment } from "./teamMemberInvestment";
import type { ReleasedCharacterCatalogEntry } from "./teamRosterCandidateDomain";
import {
  buildWeaponChoiceSearchCoverageReport,
  WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  type WeaponChoiceSearchCoverageReport,
} from "./weaponChoiceSearchCoverage";

export const CHARACTER_GUIDE_INPUT_COVERAGE_AXES = [
  "exact-team",
  "template-explicit-member",
  "source-scoped-role-member",
  "weapon",
  "artifact",
  "main-stat",
  "substat",
  "formula",
] as const;

export const CHARACTER_GUIDE_INPUT_COVERAGE_STATES = [
  "has-explicit-constellation-match",
  "no-explicit-match-but-has-constellation-unspecified",
  "only-explicitly-out-of-range",
  "not-observed",
] as const;

const SOURCE_REGISTRY_RELATIVE_PATH =
  "scripts/guide-factory/sources/registry.json";
const MANUAL_INDEX_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";

export const CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS = [
  SOURCE_REGISTRY_RELATIVE_PATH,
  MANUAL_INDEX_RELATIVE_PATH,
  "scripts/guide-factory/data/source-snapshots/kqm-diona-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-klee-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-kokomi-manual.json",
  "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json",
] as const;

export const CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS = [
  "scripts/guide-factory/src/characterGuideInputCoverage.ts",
  "scripts/guide-factory/src/inventory-character-guide-input-coverage.ts",
  "scripts/guide-factory/src/catalogs.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/manualSnapshots.ts",
  "scripts/guide-factory/src/paths.ts",
  "scripts/guide-factory/src/rosterCatalogReference.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  "scripts/guide-factory/src/teamRosterCandidateDomain.ts",
  "scripts/guide-factory/data/knowledge/repository.json",
  ...CHARACTER_GUIDE_INPUT_COVERAGE_SOURCE_FILE_PATHS,
  "scripts/guide-factory/reports/artifact-choice-search-coverage.json",
  "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json",
  "scripts/guide-factory/reports/weapon-choice-search-coverage.json",
  "scripts/guide-factory/src/artifactChoiceSearchCoverage.ts",
  "scripts/guide-factory/src/weaponChoiceSearchCoverage.ts",
  "src/data/betaState.ts",
  "src/data/charInfo.ts",
  "src/data/constants.ts",
  "src/data/enums.ts",
  "src/data/game/character_beta_stats.json.gz",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameDataUtil.ts",
  "src/data/gameResources.ts",
  "src/data/gameStatsLoader.ts",
  "src/data/resources.ts",
  "src/data/resources_beta.ts",
  "src/data/types.ts",
  "src/data/utils.ts",
  "src/lib/team-comp/analyzer/weaponChoice.ts",
] as const;

const EXPECTED_RELEASED_CHARACTER_COUNT = 125;

export interface CharacterGuideInputCoverageSourceFile {
  path: string;
  text: string;
}

export type CharacterGuideInputCoverageAxis =
  (typeof CHARACTER_GUIDE_INPUT_COVERAGE_AXES)[number];
export type CharacterGuideInputCoverageState =
  (typeof CHARACTER_GUIDE_INPUT_COVERAGE_STATES)[number];

export type ConstellationApplicability =
  | {
      state: "explicit-range";
      minConstellation: number;
      maxConstellation: number;
      sourceMinBoundPresent: boolean;
      sourceMaxBoundPresent: boolean;
    }
  | {
      state: "constellation-unspecified";
    };

export interface CharacterObservationApplicability {
  characterId: string;
  applicability: ConstellationApplicability;
  basis:
    | "exact-team-member-investment"
    | "bounded-team-member-investment"
    | "guide-build-bound"
    | "guide-recommendation-bound"
    | "role-member-bound"
    | "source-has-no-constellation-bound";
}

export interface CharacterGuideInputObservation {
  observationId: string;
  axis: CharacterGuideInputCoverageAxis;
  repositoryRecordId: string;
  characterApplicabilities: CharacterObservationApplicability[];
  sourceConditions: string[];
  conditionResolution:
    | "not-applicable"
    | "preserved-unresolved-source-conditions";
  inputRepresentability:
    | "directly-represented"
    | "represented-with-unresolved-source-context"
    | "represented-as-coupled-artifact-plan";
  searchGrammarRepresentability:
    | {
        state: "not-applicable";
      }
    | {
        state: "linked-existing-search-coverage";
        policy: "weapon-choice-candidate-policy" | "artifact-choice-search-space";
        policyObservationIds: string[];
        outcomeClassifications: Array<{
          policyObservationId: string;
          classification: string;
        }>;
        policyOutcomePayloadSha256: string;
        suitabilityAssessed: false;
        rankingAssessed: false;
      };
  payload: Record<string, unknown>;
}

export interface CharacterGuideInputRecordContext {
  repositoryRecordId: string;
  repositoryRecordKind: Exclude<KnowledgeRecord["kind"], "energy_guidance">;
  repositoryRecordStatus: Exclude<KnowledgeRecord["status"], "rejected">;
  promotionEligibility:
    | "explicitly-eligible"
    | "explicitly-ineligible"
    | "unspecified";
  sourceProvenanceIds: string[];
}

export interface CharacterGuideInputSourceProvenance {
  provenanceId: string;
  sourceId: string;
  sourceRecordId: string;
  locators: KnowledgeRecord["sourceRefs"];
  manualExtraction:
    | {
        state: "not-manual-observation-source";
      }
    | {
        state: "matched-indexed-manual-record";
        snapshotFile: { path: string; sha256: string };
        method: "manual" | "agent-assisted";
        reviewStatus: "unreviewed" | "reviewed";
        reviewer?: string;
        reviewedAt?: string;
      };
}

export interface CharacterGuideInputCoverageCell {
  state: CharacterGuideInputCoverageState;
  counts: {
    explicitMatch: number;
    constellationUnspecified: number;
    explicitlyOutOfRange: number;
  };
  classificationBucketsSha256: string;
}

export interface CharacterGuideInputCoverageReport {
  schemaVersion: 1;
  reportType: "character-guide-input-coverage";
  generatedFrom: Array<{ path: string; sha256: string }>;
  classification: "descriptive-source-input-inventory";
  comparisonStatus: "comparable";
  supportsGuideClaims: false;
  supportsRecommendations: false;
  supportsRanking: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  boundaries: {
    releasedGuideDomain: {
      characterCount: number;
      expectedCharacterCount: 125;
      eligibleCatalogSha256: string;
      characterIdsSha256: string;
      checkedInRosterReportComparison: ReturnType<
        typeof compareEligibleCatalogWithCheckedInRosterReport
      >;
    };
    repository: {
      repositorySha256: string;
      nonRejectedRecordCount: number;
      rejectedRecordCount: number;
      rejectedRecordsContributedObservationCount: 0;
      sourceRegistryFileSha256: string;
      sourceRegistrySha256MatchesRepository: true;
    };
    constellation: {
      explicitBoundPolicy: "missing-min-becomes-0;missing-max-becomes-6";
      noBoundPolicy: "constellation-unspecified-never-universal";
      rowRange: "C0-through-C6";
    };
    formula: {
      source: "repository-authored-team-damagePlans-only";
      derivedFormulaFixturesContributedObservations: false;
      rotationsContributedObservations: false;
    };
    energyRecoveryExclusion: {
      energyGuidanceRecordsContributedObservations: false;
      structuredErTargetsContributedObservations: false;
      structuredErFloorPercentContributedObservations: false;
      structuredErWeaponConditionsContributedObservations: false;
      freeTextSourceConditionsMayMentionEnergyRequirements: true;
      thresholdsOrAdequacyComputed: false;
      ordinaryErStatTokenMayRemainAsStoredStatObservation: true;
    };
    ordering: {
      plainSourceArrayOrderUsedAsRank: false;
      explicitRankedGroupMetadataPreservedButNotEvaluated: true;
      numericStatWeightsPreservedButNotInterpretedAsRank: true;
      unrecognizedSourceMetadataMayBeOmitted: true;
    };
    representability: {
      scope: "existing-search-grammar-naming-policy-only";
      weaponCoverageReportSha256: string;
      weaponCoveragePayloadSha256: string;
      weaponCoverageObservationCount: number;
      weaponLinkedPolicyObservationCount: number;
      weaponOutcomeClassificationCounts: Record<string, number>;
      artifactCoverageReportSha256: string;
      artifactCoveragePayloadSha256: string;
      artifactCoverageObservationCount: number;
      artifactLinkedPolicyObservationCount: number;
      artifactOutcomeClassificationCounts: Record<string, number>;
      allEquipmentPolicyObservationsLinked: true;
      policyOutcomePayloadReconstructionRequiresPinnedCoverageReport: true;
      suitabilityAssessed: false;
      technicalGeneratorOrCalculatorRepresentabilityAssessed: false;
    };
  };
  axes: readonly CharacterGuideInputCoverageAxis[];
  sourceRegistry: SourceRegistry["sources"];
  sourceProvenance: CharacterGuideInputSourceProvenance[];
  recordContexts: CharacterGuideInputRecordContext[];
  observations: CharacterGuideInputObservation[];
  characters: Array<{
    characterId: string;
    elementId: string;
    playableIdentityId: string;
    nonRejectedCharacterGuideRecordIds: string[];
    hasNonRejectedCharacterGuideRecord: boolean;
    observationCount: number;
    observationIdsSha256: string;
    rows: Array<{
      constellation: number;
      axisStates: CharacterGuideInputCoverageState[];
      axisCounts: Array<
        [explicitMatch: number, constellationUnspecified: number, explicitlyOutOfRange: number]
      >;
      classificationBucketsSha256: string;
    }>;
  }>;
  summary: {
    characterCount: number;
    constellationRowCount: number;
    observationCount: number;
    sourceProvenanceCount: number;
    guideLessCharacterIds: string[];
    observationCountsByAxis: Record<CharacterGuideInputCoverageAxis, number>;
    rowStateCountsByAxis: Record<
      CharacterGuideInputCoverageAxis,
      Record<CharacterGuideInputCoverageState, number>
    >;
    repositoryAuthoredDamagePlanObservationCount: number;
    observationsWithUnresolvedSourceConditions: number;
    coupledArtifactPlanObservationCount: number;
    ordinaryErStatTokenObservationCount: number;
  };
  coveragePayloadSha256: string;
  cautions: string[];
  prohibitedInterpretations: string[];
}

export interface BuildCharacterGuideInputCoverageInput {
  repositoryInput: unknown;
  sourceRegistryInput: unknown;
  manualSnapshotInputs: readonly ManualSnapshotInput[];
  sourceFiles: readonly CharacterGuideInputCoverageSourceFile[];
  releasedCharacters: readonly ReleasedCharacterCatalogEntry[];
  checkedInRosterReportInput: unknown;
  weaponChoiceSearchCoverageReportInput: unknown;
  artifactChoiceSearchCoverageReportInput: unknown;
  generatedFrom: readonly { path: string; sha256: string }[];
}

type ObservationDraft = Omit<
  CharacterGuideInputObservation,
  "repositoryRecordId" | "searchGrammarRepresentability"
> & { record: Exclude<KnowledgeRecord, { status: "rejected" }> };

type ObservationContext = {
  observations: CharacterGuideInputObservation[];
  observationIds: Set<string>;
};

export function buildReleasedGuideDomainCatalog(
  stableCharacterIds: readonly string[],
  characterElements: ReadonlyMap<string, string>,
): ReleasedCharacterCatalogEntry[] {
  const seen = new Set<string>();
  const catalog = stableCharacterIds
    .map((characterId) => {
      if (seen.has(characterId)) {
        throw new Error(`Released guide-domain catalog repeats ${characterId}.`);
      }
      seen.add(characterId);
      const elementId = characterElements.get(characterId);
      if (!elementId) {
        throw new Error(
          `Stable character ${characterId} is missing an element in character_stats.json.`,
        );
      }
      return {
        characterId,
        elementId,
        playableIdentityId: characterId.startsWith("traveler_")
          ? "traveler"
          : characterId,
      };
    })
    .filter(({ characterId }) => !/^(?:manekin|manekina)_/.test(characterId))
    .sort((left, right) => compareText(left.characterId, right.characterId));
  return catalog;
}

/**
 * Inventory explicit, non-rejected guide inputs. This function classifies
 * stored source claims; it never executes conditions, formulas, ranking, or ER.
 */
export function buildCharacterGuideInputCoverageReport(
  input: BuildCharacterGuideInputCoverageInput,
): CharacterGuideInputCoverageReport {
  const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
  const generatedFrom = validateGeneratedFrom(input.generatedFrom);
  const authenticatedSources = authenticateSourceFiles(
    input.sourceFiles,
    generatedFrom,
    input.sourceRegistryInput,
    input.manualSnapshotInputs,
  );
  const sourceRegistry = authenticatedSources.sourceRegistry;
  const repositoryFileSha256 = requiredGeneratedHash(
    generatedFrom,
    "scripts/guide-factory/data/knowledge/repository.json",
  );
  if (sha256Text(stableJson(repository)) !== repositoryFileSha256) {
    throw new Error(
      "Knowledge repository object does not match current repository report bytes.",
    );
  }
  const rosterReportFileSha256 = requiredGeneratedHash(
    generatedFrom,
    "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json",
  );
  if (
    sha256Text(stableJson(input.checkedInRosterReportInput)) !==
    rosterReportFileSha256
  ) {
    throw new Error(
      "Checked-in roster report object does not match current report bytes.",
    );
  }
  const releasedCharacters = validateReleasedCatalog(
    input.releasedCharacters,
    input.checkedInRosterReportInput,
  );
  const sourceRegistryFileSha256 = requiredGeneratedHash(
    generatedFrom,
    SOURCE_REGISTRY_RELATIVE_PATH,
  );
  if (repository.sourceRegistrySha256 !== sourceRegistryFileSha256) {
    throw new Error(
      "Character-guide input coverage found a stale repository source-registry hash.",
    );
  }

  const provenance = buildSourceProvenance(
    repository,
    sourceRegistry,
    authenticatedSources.manualSnapshotInputs,
    generatedFrom,
  );
  const provenanceIdsByRecordId = new Map<string, string[]>();
  for (const record of repository.records.filter(
    (candidate) =>
      candidate.status !== "rejected" && candidate.kind !== "energy_guidance",
  )) {
    provenanceIdsByRecordId.set(
      record.id,
      provenance.byRecordId.get(record.id) ?? [],
    );
  }

  const context: ObservationContext = {
    observations: [],
    observationIds: new Set(),
  };
  const releasedIds = new Set(
    releasedCharacters.map(({ characterId }) => characterId),
  );
  const nonRejectedRecords = repository.records.filter(
    (record) => record.status !== "rejected",
  );
  for (const record of nonRejectedRecords) {
    observeRecord(context, record, releasedIds);
  }
  const searchCoverage = authenticateSearchCoverageReports(
    repository,
    input.weaponChoiceSearchCoverageReportInput,
    input.artifactChoiceSearchCoverageReportInput,
    generatedFrom,
  );
  const representabilityLinkage = attachSearchGrammarRepresentability(
    context.observations,
    searchCoverage.weapon,
    searchCoverage.artifact,
  );
  context.observations.sort((left, right) =>
    compareText(left.observationId, right.observationId),
  );
  const observedRecordIds = new Set(
    context.observations.map(({ repositoryRecordId }) => repositoryRecordId),
  );
  const recordContexts = nonRejectedRecords
    .filter(
      (record) =>
        record.kind !== "energy_guidance" && observedRecordIds.has(record.id),
    )
    .map((record) => ({
      repositoryRecordId: record.id,
      repositoryRecordKind: record.kind as Exclude<
        KnowledgeRecord["kind"],
        "energy_guidance"
      >,
      repositoryRecordStatus: record.status as Exclude<
        KnowledgeRecord["status"],
        "rejected"
      >,
      promotionEligibility:
        record.promotionEligible === true
          ? ("explicitly-eligible" as const)
          : record.promotionEligible === false
            ? ("explicitly-ineligible" as const)
            : ("unspecified" as const),
      sourceProvenanceIds: [...(provenanceIdsByRecordId.get(record.id) ?? [])],
    }))
    .sort((left, right) =>
      compareText(left.repositoryRecordId, right.repositoryRecordId),
    );

  const observationsByCharacter = indexObservationsByCharacter(
    context.observations,
  );
  const guideRecordIdsByCharacter = indexCharacterGuides(nonRejectedRecords);
  const characters = releasedCharacters.map((character) => {
    const observations = observationsByCharacter.get(character.characterId) ?? [];
    const guideRecordIds = guideRecordIdsByCharacter.get(character.characterId) ?? [];
    return {
      characterId: character.characterId,
      elementId: character.elementId,
      playableIdentityId:
        character.playableIdentityId ??
        (character.characterId.startsWith("traveler_")
          ? "traveler"
          : character.characterId),
      nonRejectedCharacterGuideRecordIds: [...guideRecordIds],
      hasNonRejectedCharacterGuideRecord: guideRecordIds.length > 0,
      observationCount: observations.length,
      observationIdsSha256: sha256Text(
        stableJson(observations.map(({ observationId }) => observationId)),
      ),
      rows: Array.from({ length: 7 }, (_, constellation) => {
        const cells = CHARACTER_GUIDE_INPUT_COVERAGE_AXES.map((axis) =>
          classifyCell(character.characterId, constellation, axis, observations),
        );
        return {
          constellation,
          axisStates: cells.map(({ state }) => state),
          axisCounts: cells.map(
            ({ counts }) =>
              [
                counts.explicitMatch,
                counts.constellationUnspecified,
                counts.explicitlyOutOfRange,
              ] as [number, number, number],
          ),
          classificationBucketsSha256: sha256Text(
            stableJson(
              cells.map(({ classificationBucketsSha256 }) =>
                classificationBucketsSha256,
              ),
            ),
          ),
        };
      }),
    };
  });

  const summary = summarize(
    characters,
    context.observations,
    provenance.entries.length,
  );
  const coveragePayload = {
    axes: CHARACTER_GUIDE_INPUT_COVERAGE_AXES,
    sourceRegistry: sourceRegistry.sources,
    sourceProvenance: provenance.entries,
    recordContexts,
    observations: context.observations,
    characters,
    summary,
  };
  const reference = parseCheckedInRosterCatalogReference(
    input.checkedInRosterReportInput,
  );
  const checkedInRosterReportComparison =
    compareEligibleCatalogWithCheckedInRosterReport(
      releasedCharacters,
      reference,
    );

  return {
    schemaVersion: 1,
    reportType: "character-guide-input-coverage",
    generatedFrom,
    classification: "descriptive-source-input-inventory",
    comparisonStatus: "comparable",
    supportsGuideClaims: false,
    supportsRecommendations: false,
    supportsRanking: false,
    supportsDamageClaims: false,
    supportsEnergyRecoveryClaims: false,
    boundaries: {
      releasedGuideDomain: {
        characterCount: releasedCharacters.length,
        expectedCharacterCount: EXPECTED_RELEASED_CHARACTER_COUNT,
        eligibleCatalogSha256: sha256Text(stableJson(releasedCharacters)),
        characterIdsSha256: sha256Text(
          stableJson(releasedCharacters.map(({ characterId }) => characterId)),
        ),
        checkedInRosterReportComparison,
      },
      repository: {
        repositorySha256: repositoryFileSha256,
        nonRejectedRecordCount: nonRejectedRecords.length,
        rejectedRecordCount:
          repository.records.length - nonRejectedRecords.length,
        rejectedRecordsContributedObservationCount: 0,
        sourceRegistryFileSha256,
        sourceRegistrySha256MatchesRepository: true,
      },
      constellation: {
        explicitBoundPolicy: "missing-min-becomes-0;missing-max-becomes-6",
        noBoundPolicy: "constellation-unspecified-never-universal",
        rowRange: "C0-through-C6",
      },
      formula: {
        source: "repository-authored-team-damagePlans-only",
        derivedFormulaFixturesContributedObservations: false,
        rotationsContributedObservations: false,
      },
      energyRecoveryExclusion: {
        energyGuidanceRecordsContributedObservations: false,
        structuredErTargetsContributedObservations: false,
        structuredErFloorPercentContributedObservations: false,
        structuredErWeaponConditionsContributedObservations: false,
        freeTextSourceConditionsMayMentionEnergyRequirements: true,
        thresholdsOrAdequacyComputed: false,
        ordinaryErStatTokenMayRemainAsStoredStatObservation: true,
      },
      ordering: {
        plainSourceArrayOrderUsedAsRank: false,
        explicitRankedGroupMetadataPreservedButNotEvaluated: true,
        numericStatWeightsPreservedButNotInterpretedAsRank: true,
        unrecognizedSourceMetadataMayBeOmitted: true,
      },
      representability: {
        scope: "existing-search-grammar-naming-policy-only",
        weaponCoverageReportSha256: searchCoverage.weaponFileSha256,
        weaponCoveragePayloadSha256: searchCoverage.weaponPayloadSha256,
        weaponCoverageObservationCount: searchCoverage.weapon.observations.length,
        weaponLinkedPolicyObservationCount:
          representabilityLinkage.weaponLinkedPolicyObservationCount,
        weaponOutcomeClassificationCounts:
          representabilityLinkage.weaponOutcomeClassificationCounts,
        artifactCoverageReportSha256: searchCoverage.artifactFileSha256,
        artifactCoveragePayloadSha256: searchCoverage.artifactPayloadSha256,
        artifactCoverageObservationCount:
          searchCoverage.artifact.observations.length,
        artifactLinkedPolicyObservationCount:
          representabilityLinkage.artifactLinkedPolicyObservationCount,
        artifactOutcomeClassificationCounts:
          representabilityLinkage.artifactOutcomeClassificationCounts,
        allEquipmentPolicyObservationsLinked: true,
        policyOutcomePayloadReconstructionRequiresPinnedCoverageReport: true,
        suitabilityAssessed: false,
        technicalGeneratorOrCalculatorRepresentabilityAssessed: false,
      },
    },
    axes: CHARACTER_GUIDE_INPUT_COVERAGE_AXES,
    sourceRegistry: structuredClone(sourceRegistry.sources),
    sourceProvenance: provenance.entries,
    recordContexts,
    observations: context.observations,
    characters,
    summary,
    coveragePayloadSha256: sha256Text(stableJson(coveragePayload)),
    cautions: [
      "Coverage means a non-rejected repository claim was observed; it does not mean the claim is correct, reviewed, applicable, or recommended.",
      "Constellation-unspecified claims remain unspecified at every row and are never converted into universal C0-C6 claims.",
      "Source conditions are preserved as unresolved text and are never executed by this inventory.",
      "Coupled artifact plans remain atomic whole-team observations; an assignment is not a standalone character artifact recommendation.",
      "Equipment linkage copies the classifications from existing search-grammar coverage reports; linkage does not imply that a choice is representable or compatible, so consumers must inspect the linked outcomes. It does not establish suitability, generation, calculator, rotation, or gameplay support.",
      "Structured ER targets, floors, weapon conditions, energy-guidance records, sequences, and rotations contribute no observations; preserved free-text source conditions may still mention energy requirements, and an ordinary er artifact-stat token remains source vocabulary only.",
      "Array positions and numeric stat weights do not create ranking in this inventory.",
    ],
    prohibitedInterpretations: [
      "guide",
      "recommendation",
      "ranking",
      "source-vote",
      "quality-score",
      "damage-comparison",
      "winner",
      "ideal-stat-allocation",
      "energy-requirement",
      "rotation",
    ],
  };
}

function authenticateSourceFiles(
  sourceFiles: readonly CharacterGuideInputCoverageSourceFile[],
  generatedFrom: readonly { path: string; sha256: string }[],
  sourceRegistryInput: unknown,
  manualSnapshotInputs: readonly ManualSnapshotInput[],
): {
  sourceRegistry: SourceRegistry;
  manualSnapshotInputs: ManualSnapshotInput[];
} {
  const filesByPath = new Map<string, CharacterGuideInputCoverageSourceFile>();
  for (const file of sourceFiles) {
    if (!file.path || typeof file.text !== "string") {
      throw new Error("Character-guide coverage has an invalid source-file input.");
    }
    if (filesByPath.has(file.path)) {
      throw new Error(
        `Character-guide coverage repeats source-file input ${file.path}.`,
      );
    }
    const expectedSha256 = requiredGeneratedHash(generatedFrom, file.path);
    if (sha256Text(file.text) !== expectedSha256) {
      throw new Error(
        `Source-file input ${file.path} does not match current input bytes.`,
      );
    }
    filesByPath.set(file.path, file);
  }

  const registryFile = filesByPath.get(SOURCE_REGISTRY_RELATIVE_PATH);
  const manualIndexFile = filesByPath.get(MANUAL_INDEX_RELATIVE_PATH);
  if (!registryFile || !manualIndexFile) {
    throw new Error(
      "Character-guide coverage requires authenticated source-registry and manual-index bytes.",
    );
  }
  const sourceRegistry = SourceRegistrySchema.parse(JSON.parse(registryFile.text));
  const suppliedSourceRegistry = SourceRegistrySchema.parse(sourceRegistryInput);
  if (stableJson(sourceRegistry) !== stableJson(suppliedSourceRegistry)) {
    throw new Error(
      "Source registry object does not match authenticated source-registry bytes.",
    );
  }
  const manualIndex = ManualSnapshotIndexSchema.parse(
    JSON.parse(manualIndexFile.text),
  );
  const expectedSourceFilePaths = [
    SOURCE_REGISTRY_RELATIVE_PATH,
    MANUAL_INDEX_RELATIVE_PATH,
    ...manualIndex.snapshots.map(({ path }) => path),
  ].sort(compareText);
  const actualSourceFilePaths = [...filesByPath.keys()].sort(compareText);
  if (stableJson(actualSourceFilePaths) !== stableJson(expectedSourceFilePaths)) {
    throw new Error(
      "Character-guide coverage source-file inputs do not match the authenticated manual index.",
    );
  }

  const manualInputsByPath = new Map<string, ManualSnapshotInput>();
  for (const manualInput of manualSnapshotInputs) {
    const snapshotPath = manualInput.snapshotFile.path;
    if (manualInputsByPath.has(snapshotPath)) {
      throw new Error(
        `Character-guide coverage repeats manual snapshot input ${snapshotPath}.`,
      );
    }
    manualInputsByPath.set(snapshotPath, manualInput);
  }
  if (manualInputsByPath.size !== manualIndex.snapshots.length) {
    throw new Error(
      "Character-guide coverage manual snapshot inputs do not match the authenticated manual index.",
    );
  }

  const authenticatedManualInputs = manualIndex.snapshots.map((indexEntry) => {
    const supplied = manualInputsByPath.get(indexEntry.path);
    const sourceFile = filesByPath.get(indexEntry.path);
    if (!supplied || !sourceFile) {
      throw new Error(
        `Character-guide coverage is missing indexed manual snapshot ${indexEntry.path}.`,
      );
    }
    if (
      supplied.expectedSourceId !== indexEntry.sourceId ||
      supplied.snapshotFile.path !== indexEntry.path
    ) {
      throw new Error(
        `Manual snapshot ${indexEntry.path} does not match its authenticated index entry.`,
      );
    }
    const expectedSha256 = requiredGeneratedHash(generatedFrom, indexEntry.path);
    if (supplied.snapshotFile.sha256 !== expectedSha256) {
      throw new Error(
        `Manual snapshot ${indexEntry.path} metadata does not match current input bytes.`,
      );
    }
    const authenticatedSnapshot = ManualObservationSnapshotSchema.parse(
      JSON.parse(sourceFile.text),
    );
    const suppliedSnapshot = ManualObservationSnapshotSchema.parse(
      supplied.snapshot,
    );
    if (stableJson(authenticatedSnapshot) !== stableJson(suppliedSnapshot)) {
      throw new Error(
        `Manual snapshot object ${indexEntry.path} does not match authenticated input bytes.`,
      );
    }
    return {
      expectedSourceId: indexEntry.sourceId,
      snapshot: authenticatedSnapshot,
      snapshotFile: {
        path: indexEntry.path,
        sha256: expectedSha256,
      },
    };
  });

  return {
    sourceRegistry,
    manualSnapshotInputs: authenticatedManualInputs,
  };
}

function validateGeneratedFrom(
  input: readonly { path: string; sha256: string }[],
): Array<{ path: string; sha256: string }> {
  const seen = new Set<string>();
  const files = input
    .map(({ path, sha256 }) => {
      if (!path || !/^[a-f0-9]{64}$/.test(sha256)) {
        throw new Error("Character-guide coverage has an invalid generatedFrom entry.");
      }
      if (seen.has(path)) {
        throw new Error(`Character-guide coverage repeats generatedFrom path ${path}.`);
      }
      seen.add(path);
      return { path, sha256 };
    })
    .sort((left, right) => compareText(left.path, right.path));
  for (const requiredPath of CHARACTER_GUIDE_INPUT_COVERAGE_INPUT_PATHS) {
    if (!seen.has(requiredPath)) {
      throw new Error(
        `Character-guide coverage is missing generatedFrom path ${requiredPath}.`,
      );
    }
  }
  return files;
}

function requiredGeneratedHash(
  generatedFrom: readonly { path: string; sha256: string }[],
  relativePath: string,
): string {
  const match = generatedFrom.find(({ path }) => path === relativePath);
  if (!match) {
    throw new Error(`Missing current hash for ${relativePath}.`);
  }
  return match.sha256;
}

function validateReleasedCatalog(
  input: readonly ReleasedCharacterCatalogEntry[],
  checkedInRosterReportInput: unknown,
): ReleasedCharacterCatalogEntry[] {
  const released = input
    .map(({ characterId, elementId, playableIdentityId }) => ({
      characterId,
      elementId,
      playableIdentityId:
        playableIdentityId ??
        (characterId.startsWith("traveler_") ? "traveler" : characterId),
    }))
    .sort((left, right) => compareText(left.characterId, right.characterId));
  const ids = new Set<string>();
  for (const entry of released) {
    if (!entry.characterId || !entry.elementId || !entry.playableIdentityId) {
      throw new Error("Released guide-domain catalog contains an incomplete entry.");
    }
    if (ids.has(entry.characterId)) {
      throw new Error(
        `Released guide-domain catalog repeats ${entry.characterId}.`,
      );
    }
    if (/^(?:manekin|manekina)_/.test(entry.characterId)) {
      throw new Error(
        `Released guide-domain catalog contains excluded form ${entry.characterId}.`,
      );
    }
    ids.add(entry.characterId);
  }
  if (released.length !== EXPECTED_RELEASED_CHARACTER_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_RELEASED_CHARACTER_COUNT} released guide-domain characters, found ${released.length}.`,
    );
  }
  const reference = parseCheckedInRosterCatalogReference(
    checkedInRosterReportInput,
  );
  const comparison = compareEligibleCatalogWithCheckedInRosterReport(
    released,
    reference,
  );
  if (!comparison.allChecksMatch) {
    throw new Error(
      "Released guide-domain characters do not authenticate against the checked-in roster report.",
    );
  }
  return released;
}

function buildSourceProvenance(
  repository: KnowledgeRepository,
  sourceRegistry: SourceRegistry,
  manualSnapshotInputs: readonly ManualSnapshotInput[],
  generatedFrom: readonly { path: string; sha256: string }[],
): {
  entries: CharacterGuideInputSourceProvenance[];
  byRecordId: Map<string, string[]>;
} {
  const manifests = new Map<string, SourceRegistry["sources"][number]>();
  for (const manifest of sourceRegistry.sources) {
    if (manifests.has(manifest.id)) {
      throw new Error(`Source registry repeats source ${manifest.id}.`);
    }
    manifests.set(manifest.id, manifest);
  }

  type ManualEntry = {
    snapshotFile: { path: string; sha256: string };
    record: ReturnType<typeof ManualObservationSnapshotSchema.parse>["records"][number];
  };
  const manualRecords = new Map<string, ManualEntry>();
  for (const input of manualSnapshotInputs) {
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshot);
    if (snapshot.sourceId !== input.expectedSourceId) {
      throw new Error(
        `Manual snapshot ${input.snapshotFile.path} source ID does not match its index entry.`,
      );
    }
    const currentHash = requiredGeneratedHash(
      generatedFrom,
      input.snapshotFile.path,
    );
    if (currentHash !== input.snapshotFile.sha256) {
      throw new Error(
        `Manual snapshot ${input.snapshotFile.path} does not match current input bytes.`,
      );
    }
    const repositoryRevision = repository.generatedFrom
      .find(({ sourceId }) => sourceId === snapshot.sourceId)
      ?.files.find(({ path }) => path === input.snapshotFile.path);
    if (!repositoryRevision || repositoryRevision.sha256 !== input.snapshotFile.sha256) {
      throw new Error(
        `Repository does not authenticate indexed manual snapshot ${input.snapshotFile.path}.`,
      );
    }
    for (const record of snapshot.records) {
      const key = sourceRecordKey(snapshot.sourceId, record.sourceRecordId);
      if (manualRecords.has(key)) {
        throw new Error(`Indexed manual snapshots repeat ${key}.`);
      }
      manualRecords.set(key, {
        snapshotFile: { ...input.snapshotFile },
        record,
      });
    }
  }

  const entriesById = new Map<string, CharacterGuideInputSourceProvenance>();
  const byRecordId = new Map<string, string[]>();
  for (const record of repository.records.filter(
    (candidate) =>
      candidate.status !== "rejected" && candidate.kind !== "energy_guidance",
  )) {
    const groupedRefs = new Map<string, KnowledgeRecord["sourceRefs"]>();
    for (const ref of record.sourceRefs) {
      const key = sourceRecordKey(ref.sourceId, ref.sourceRecordId);
      const refs = groupedRefs.get(key) ?? [];
      refs.push(ref);
      groupedRefs.set(key, refs);
    }
    const recordProvenanceIds: string[] = [];
    for (const [key, refs] of groupedRefs) {
      const first = refs[0];
      if (!first) throw new Error(`Record ${record.id} has an empty source group.`);
      const manifest = manifests.get(first.sourceId);
      if (!manifest) {
        throw new Error(
          `Record ${record.id} references unregistered source ${first.sourceId}.`,
        );
      }
      const provenanceId = key;
      const canonicalRefs = [...refs].sort((left, right) =>
        compareText(stableJson(left.locator), stableJson(right.locator)),
      );
      let manualExtraction: CharacterGuideInputSourceProvenance["manualExtraction"];
      if (manifest.ingestionMode === "manual-observation") {
        const manual = manualRecords.get(key);
        if (!manual) {
          throw new Error(
            `Record ${record.id} has no indexed manual source record ${key}.`,
          );
        }
        const authoredLocators = [
          manual.record.locator,
          ...manual.record.supportingLocators,
        ].map(stableJson);
        for (const ref of canonicalRefs) {
          if (!authoredLocators.includes(stableJson(ref.locator))) {
            throw new Error(
              `Record ${record.id} has a locator not found in indexed manual record ${key}.`,
            );
          }
        }
        const extraction = manual.record.extraction;
        manualExtraction = {
          state: "matched-indexed-manual-record",
          snapshotFile: { ...manual.snapshotFile },
          method: extraction.method,
          reviewStatus: extraction.reviewStatus,
          ...(extraction.reviewStatus === "reviewed"
            ? {
                reviewer: extraction.reviewer,
                reviewedAt: extraction.reviewedAt,
              }
            : {}),
        };
      } else {
        manualExtraction = { state: "not-manual-observation-source" };
      }
      const entry: CharacterGuideInputSourceProvenance = {
        provenanceId,
        sourceId: first.sourceId,
        sourceRecordId: first.sourceRecordId,
        locators: canonicalRefs,
        manualExtraction,
      };
      const existing = entriesById.get(provenanceId);
      if (existing && stableJson(existing) !== stableJson(entry)) {
        throw new Error(
          `Source provenance ${provenanceId} differs across repository records.`,
        );
      }
      entriesById.set(provenanceId, entry);
      recordProvenanceIds.push(provenanceId);
    }
    byRecordId.set(record.id, sortedUnique(recordProvenanceIds));
  }
  return {
    entries: [...entriesById.values()].sort((left, right) =>
      compareText(left.provenanceId, right.provenanceId),
    ),
    byRecordId,
  };
}

function observeRecord(
  context: ObservationContext,
  record: Exclude<KnowledgeRecord, { status: "rejected" }>,
  releasedIds: ReadonlySet<string>,
): void {
  if (record.status === "rejected" || record.kind === "energy_guidance") return;
  if (record.kind === "team") {
    observeTeam(context, record, releasedIds);
  } else if (record.kind === "team_template") {
    observeTemplate(context, record, releasedIds);
  } else if (record.kind === "character_role") {
    observeRole(context, record, releasedIds);
  } else if (record.kind === "character_guide") {
    observeCharacterGuide(context, record, releasedIds);
  }
}

function observeTeam(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "team" }>,
  releasedIds: ReadonlySet<string>,
): void {
  const teamCharacterIds = record.members.map(({ characterId }) => characterId);
  const teamCharacterApplicabilities = record.members
    .filter(({ characterId }) => releasedIds.has(characterId))
    .map(teamMemberApplicability);
  if (teamCharacterApplicabilities.length > 0) {
    addObservation(context, {
      observationId: `${record.id}:exact-team`,
      axis: "exact-team",
      record,
      characterApplicabilities: teamCharacterApplicabilities,
      sourceConditions: [],
      conditionResolution: "not-applicable",
      inputRepresentability: "directly-represented",
      payload: {
        sourceShape: "atomic-exact-team",
        teamCharacterIds,
        memberInvestmentStates: record.members.map(
          ({ characterId, investment }) => ({
            characterId,
            investment: cloneTeamMemberInvestment(investment),
          }),
        ),
        rosterMayNotBeDetached: true,
      },
    });
  }
  record.members.forEach((member, memberIndex) => {
    if (!releasedIds.has(member.characterId)) return;
    const characterApplicability = teamMemberApplicability(member);
    if (member.selectedWeapon) {
      addObservation(context, {
        observationId: `${record.id}:weapon:member:${memberIndex}:selected`,
        axis: "weapon",
        record,
        characterApplicabilities: [characterApplicability],
        sourceConditions: [],
        conditionResolution: "not-applicable",
        inputRepresentability: "directly-represented",
        payload: {
          sourceShape: "exact-team-selected-weapon",
          memberIndex,
          weaponIds: [member.selectedWeapon.weaponId],
          refinementStoredButNotEvaluated: member.selectedWeapon.refinement ?? null,
          rankingInterpretation: "none",
        },
      });
    }
    for (const [groupIndex, group] of (
      member.weaponRecommendations ?? []
    ).entries()) {
      addRecommendationObservation(context, {
        observationId: `${record.id}:weapon:member:${memberIndex}:group:${groupIndex}`,
        axis: "weapon",
        record,
        characterApplicabilities: [characterApplicability],
        conditions: group.conditions,
        payload: {
          sourceShape: "exact-team-weapon-recommendation-group",
          memberIndex,
          groupIndex,
          weaponIds: sortedUnique(group.weaponIds),
          grouping: group.grouping,
          classification: group.classification,
          sourceOrderingDeclaration: member.weaponOrdering ?? null,
          arrayOrderUsedAsRank: false,
        },
      });
    }
    if (member.selectedArtifact) {
      addObservation(context, {
        observationId: `${record.id}:artifact:member:${memberIndex}:selected`,
        axis: "artifact",
        record,
        characterApplicabilities: [characterApplicability],
        sourceConditions: [],
        conditionResolution: "not-applicable",
        inputRepresentability: "directly-represented",
        payload: {
          sourceShape: "exact-team-selected-artifact",
          memberIndex,
          artifacts: [canonicalArtifact(member.selectedArtifact)],
          rankingInterpretation: "none",
        },
      });
    }
    for (const [groupIndex, group] of (
      member.artifactRecommendations ?? []
    ).entries()) {
      addRecommendationObservation(context, {
        observationId: `${record.id}:artifact:member:${memberIndex}:group:${groupIndex}`,
        axis: "artifact",
        record,
        characterApplicabilities: [characterApplicability],
        conditions: group.conditions,
        payload: {
          sourceShape: "exact-team-artifact-recommendation-group",
          memberIndex,
          groupIndex,
          artifacts: canonicalArtifacts(group.artifacts),
          grouping: group.grouping,
          classification: group.classification,
          sourceOrderingDeclaration: member.artifactOrdering ?? null,
          arrayOrderUsedAsRank: false,
        },
      });
    }
    observeOrdinalMainStats(
      context,
      record,
      member.characterId,
      characterApplicability,
      member.mainStats,
      `member:${memberIndex}`,
      "exact-team-main-stat-group",
    );
    observeOrdinalSubstats(
      context,
      record,
      characterApplicability,
      member.substats,
      `member:${memberIndex}`,
      "exact-team-substat-group",
    );
  });

  for (const [planIndex, plan] of (record.artifactPlans ?? []).entries()) {
    const characterApplicabilities = plan.assignments
      .filter(({ characterId }) => releasedIds.has(characterId))
      .map(({ characterId }) => {
        const member = record.members.find(
          (candidate) => candidate.characterId === characterId,
        );
        return member
          ? teamMemberApplicability(member)
          : unspecifiedApplicability(characterId);
      });
    if (characterApplicabilities.length === 0) continue;
    addObservation(context, {
      observationId: `${record.id}:artifact:coupled-plan:${planIndex}:${plan.id}`,
      axis: "artifact",
      record,
      characterApplicabilities,
      sourceConditions: sortedUnique(plan.conditions),
      conditionResolution:
        plan.conditions.length > 0
          ? "preserved-unresolved-source-conditions"
          : "not-applicable",
      inputRepresentability: "represented-as-coupled-artifact-plan",
      payload: {
        sourceShape: "coupled-whole-team-artifact-plan",
        planId: plan.id,
        label: plan.label ?? null,
        classification: plan.classification,
        assignments: [...plan.assignments]
          .map(({ characterId, artifact }) => ({
            characterId,
            artifact: canonicalArtifact(artifact),
          }))
          .sort((left, right) => compareText(left.characterId, right.characterId)),
        assignmentsMayNotBeDetached: true,
      },
    });
  }

  for (const [planIndex, plan] of record.damagePlans.entries()) {
    plan.lines.forEach((line, lineIndex) => {
      if (!releasedIds.has(line.characterId)) return;
      const member = record.members.find(
        (candidate) => candidate.characterId === line.characterId,
      );
      addObservation(context, {
        observationId: `${record.id}:formula:plan:${planIndex}:line:${lineIndex}`,
        axis: "formula",
        record,
        characterApplicabilities: [
          member
            ? teamMemberApplicability(member)
            : unspecifiedApplicability(line.characterId),
        ],
        sourceConditions: [],
        conditionResolution: "not-applicable",
        inputRepresentability: "directly-represented",
        payload: {
          sourceShape: "repository-authored-team-damage-plan-line",
          damagePlanId: plan.id,
          damagePlanLabel: plan.label,
          durationSeconds: plan.durationSeconds ?? null,
          lineIndex,
          formulaId: line.formulaId,
          count: line.count,
          formulaExecuted: false,
        },
      });
    });
  }
}

function observeTemplate(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "team_template" }>,
  releasedIds: ReadonlySet<string>,
): void {
  record.slots.forEach((slot, slotIndex) => {
    const collections = [
      { name: "options", selectors: slot.options },
      { name: "highlightedOptions", selectors: slot.highlightedOptions ?? [] },
    ] as const;
    for (const collection of collections) {
      collection.selectors.forEach((selector, selectorIndex) => {
        if (selector.type !== "characters") return;
        for (const characterId of sortedUnique(selector.characterIds)) {
          if (!releasedIds.has(characterId)) continue;
          addObservation(context, {
            observationId:
              `${record.id}:template-explicit-member:slot:${slotIndex}:` +
              `${collection.name}:selector:${selectorIndex}:character:${characterId}`,
            axis: "template-explicit-member",
            record,
            characterApplicabilities: [unspecifiedApplicability(characterId)],
            sourceConditions: [],
            conditionResolution: "not-applicable",
            inputRepresentability: "directly-represented",
            payload: {
              sourceShape: "team-template-explicit-character-selector",
              slotId: slot.id,
              slotIndex,
              selectorCollection: collection.name,
              selectorIndex,
              selectorCharacterIds: sortedUnique(selector.characterIds),
              elementRoleAndAnySelectorsExpanded: false,
              highlightedSelectorNarrowsDomain: false,
            },
          });
        }
      });
    }
  });
}

function observeRole(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "character_role" }>,
  releasedIds: ReadonlySet<string>,
): void {
  record.members.forEach((member, memberIndex) => {
    if (!releasedIds.has(member.characterId)) return;
    const applicability = rangeApplicability(
      member.characterId,
      member.minConstellation,
      member.maxConstellation,
      "role-member-bound",
    );
    addRecommendationObservation(context, {
      observationId: `${record.id}:source-scoped-role-member:${memberIndex}:${member.characterId}`,
      axis: "source-scoped-role-member",
      record,
      characterApplicabilities: [applicability],
      conditions: member.conditions,
      payload: {
        sourceShape: "source-scoped-role-member",
        roleId: record.roleId,
        appliesTo: { ...record.appliesTo },
        memberIndex,
        exhaustiveness: record.exhaustiveness,
        sourceRankingClaim: record.rankingClaim,
        sourceRankingClaimExecuted: false,
      },
    });
  });
}

function observeCharacterGuide(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "character_guide" }>,
  releasedIds: ReadonlySet<string>,
): void {
  if (!releasedIds.has(record.characterId)) return;
  const unspecified = unspecifiedApplicability(record.characterId);
  if (record.weaponOrder && record.weaponOrder.length > 0) {
    addObservation(context, {
      observationId: `${record.id}:weapon:guide-weapon-order`,
      axis: "weapon",
      record,
      characterApplicabilities: [unspecified],
      sourceConditions: [],
      conditionResolution: "not-applicable",
      inputRepresentability: "directly-represented",
      payload: {
        sourceShape: "guide-weapon-order-array",
        weaponIds: sortedUnique(record.weaponOrder),
        sourceContainerName: "weaponOrder",
        arrayOrderUsedAsRank: false,
        coverageInterpretation: "membership-only",
      },
    });
  }

  record.builds.forEach((build, buildIndex) => {
    const applicability = rangeApplicability(
      record.characterId,
      build.minConstellation,
      undefined,
      "guide-build-bound",
    );
    addObservation(context, {
      observationId: `${record.id}:artifact:build:${build.sourceRecordId}`,
      axis: "artifact",
      record,
      characterApplicabilities: [applicability],
      sourceConditions: [],
      conditionResolution: "not-applicable",
      inputRepresentability: "directly-represented",
      payload: {
        sourceShape: "guide-build-artifact",
        buildIndex,
        sourceRecordId: build.sourceRecordId,
        visible: build.visible,
        name: build.name ?? null,
        styles: sortedUnique(build.styles ?? []),
        roles: sortedUnique(build.roles ?? []),
        artifacts: [canonicalArtifact(build.artifact)],
        sourceArrayOrderUsedAsRank: false,
      },
    });
    for (const slot of ["sands", "goblet", "circlet"] as const) {
      if (build[slot].length === 0) continue;
      addObservation(context, {
        observationId: `${record.id}:main-stat:build:${build.sourceRecordId}:${slot}`,
        axis: "main-stat",
        record,
        characterApplicabilities: [applicability],
        sourceConditions: [],
        conditionResolution: "not-applicable",
        inputRepresentability: "directly-represented",
        payload: {
          sourceShape: "guide-build-weighted-main-stat-array",
          buildIndex,
          sourceRecordId: build.sourceRecordId,
          slot,
          statIds: sortedUnique(build[slot].map(({ stat }) => stat)),
          weightedStats: build[slot]
            .map(({ stat, weight }) => ({ statId: stat, weight }))
            .sort(compareWeightedStat),
          numericWeightsInterpretedAsOrdinalRank: false,
          sourceArrayOrderUsedAsRank: false,
        },
      });
    }
    if (build.substats.length > 0) {
      addObservation(context, {
        observationId: `${record.id}:substat:build:${build.sourceRecordId}`,
        axis: "substat",
        record,
        characterApplicabilities: [applicability],
        sourceConditions: [],
        conditionResolution: "not-applicable",
        inputRepresentability: "directly-represented",
        payload: {
          sourceShape: "guide-build-weighted-substat-array",
          buildIndex,
          sourceRecordId: build.sourceRecordId,
          statIds: sortedUnique(build.substats.map(({ stat }) => stat)),
          weightedStats: build.substats
            .map(({ stat, weight }) => ({ statId: stat, weight }))
            .sort(compareWeightedStat),
          numericWeightsInterpretedAsOrdinalRank: false,
          sourceArrayOrderUsedAsRank: false,
        },
      });
    }
  });

  for (const [recommendationIndex, recommendation] of (
    record.recommendations ?? []
  ).entries()) {
    const applicability = rangeApplicability(
      record.characterId,
      recommendation.minConstellation,
      recommendation.maxConstellation,
      "guide-recommendation-bound",
    );
    for (const [groupIndex, group] of (
      recommendation.weaponRecommendations ?? []
    ).entries()) {
      addRecommendationObservation(context, {
        observationId: `${record.id}:weapon:recommendation:${recommendation.id}:group:${groupIndex}`,
        axis: "weapon",
        record,
        characterApplicabilities: [applicability],
        conditions: group.conditions,
        payload: {
          sourceShape: "character-guide-weapon-recommendation-group",
          recommendationIndex,
          recommendationId: recommendation.id,
          recommendationLabel: recommendation.label ?? null,
          recommendationScope: recommendation.scope,
          roles: sortedUnique(recommendation.roles),
          groupIndex,
          weaponIds: sortedUnique(group.weaponIds),
          grouping: group.grouping,
          classification: group.classification,
          sourceOrderingDeclaration: recommendation.weaponOrdering ?? null,
          arrayOrderUsedAsRank: false,
        },
      });
    }
    for (const [groupIndex, group] of (
      recommendation.artifactRecommendations ?? []
    ).entries()) {
      addRecommendationObservation(context, {
        observationId: `${record.id}:artifact:recommendation:${recommendation.id}:group:${groupIndex}`,
        axis: "artifact",
        record,
        characterApplicabilities: [applicability],
        conditions: group.conditions,
        payload: {
          sourceShape: "character-guide-artifact-recommendation-group",
          recommendationIndex,
          recommendationId: recommendation.id,
          recommendationLabel: recommendation.label ?? null,
          recommendationScope: recommendation.scope,
          roles: sortedUnique(recommendation.roles),
          groupIndex,
          artifacts: canonicalArtifacts(group.artifacts),
          grouping: group.grouping,
          classification: group.classification,
          sourceOrderingDeclaration: recommendation.artifactOrdering ?? null,
          arrayOrderUsedAsRank: false,
        },
      });
    }
    observeOrdinalMainStats(
      context,
      record,
      record.characterId,
      applicability,
      recommendation.mainStats,
      `recommendation:${recommendation.id}`,
      "character-guide-main-stat-group",
      {
        recommendationIndex,
        recommendationId: recommendation.id,
        recommendationLabel: recommendation.label ?? null,
        recommendationScope: recommendation.scope,
        roles: sortedUnique(recommendation.roles),
      },
    );
    observeOrdinalSubstats(
      context,
      record,
      applicability,
      recommendation.substats,
      `recommendation:${recommendation.id}`,
      "character-guide-substat-group",
      {
        recommendationIndex,
        recommendationId: recommendation.id,
        recommendationLabel: recommendation.label ?? null,
        recommendationScope: recommendation.scope,
        roles: sortedUnique(recommendation.roles),
      },
    );
  }
}

function observeOrdinalMainStats(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "team" | "character_guide" }>,
  _characterId: string,
  applicability: CharacterObservationApplicability,
  mainStats:
    | {
        sands: Array<{ statIds: string[]; conditions: string[]; priority?: number }>;
        goblet: Array<{ statIds: string[]; conditions: string[]; priority?: number }>;
        circlet: Array<{ statIds: string[]; conditions: string[]; priority?: number }>;
      }
    | undefined,
  idPrefix: string,
  sourceShape: string,
  commonPayload: Record<string, unknown> = {},
): void {
  if (!mainStats) return;
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    mainStats[slot].forEach((group, groupIndex) => {
      addRecommendationObservation(context, {
        observationId: `${record.id}:main-stat:${idPrefix}:${slot}:group:${groupIndex}`,
        axis: "main-stat",
        record,
        characterApplicabilities: [applicability],
        conditions: group.conditions,
        payload: {
          sourceShape,
          ...commonPayload,
          slot,
          groupIndex,
          statIds: sortedUnique(group.statIds),
          sourcePriorityStoredButNotUsedAsRank: group.priority ?? null,
          arrayOrderUsedAsRank: false,
        },
      });
    });
  }
}

function observeOrdinalSubstats(
  context: ObservationContext,
  record: Extract<KnowledgeRecord, { kind: "team" | "character_guide" }>,
  applicability: CharacterObservationApplicability,
  substats:
    | Array<{ statIds: string[]; conditions: string[]; priority?: number }>
    | undefined,
  idPrefix: string,
  sourceShape: string,
  commonPayload: Record<string, unknown> = {},
): void {
  for (const [groupIndex, group] of (substats ?? []).entries()) {
    addRecommendationObservation(context, {
      observationId: `${record.id}:substat:${idPrefix}:group:${groupIndex}`,
      axis: "substat",
      record,
      characterApplicabilities: [applicability],
      conditions: group.conditions,
      payload: {
        sourceShape,
        ...commonPayload,
        groupIndex,
        statIds: sortedUnique(group.statIds),
        sourcePriorityStoredButNotUsedAsRank: group.priority ?? null,
        arrayOrderUsedAsRank: false,
        sourceTargetRead: false,
      },
    });
  }
}

function addRecommendationObservation(
  context: ObservationContext,
  input: Omit<
    ObservationDraft,
    "sourceConditions" | "conditionResolution" | "inputRepresentability"
  > & { conditions: readonly string[] },
): void {
  const conditions = sortedUnique(input.conditions);
  addObservation(context, {
    ...input,
    sourceConditions: conditions,
    conditionResolution:
      conditions.length > 0
        ? "preserved-unresolved-source-conditions"
        : "not-applicable",
    inputRepresentability:
      conditions.length > 0
        ? "represented-with-unresolved-source-context"
        : "directly-represented",
  });
}

function addObservation(
  context: ObservationContext,
  draft: ObservationDraft,
): void {
  if (draft.record.status === "rejected") {
    throw new Error(
      `Rejected record ${draft.record.id} cannot contribute coverage.`,
    );
  }
  if (context.observationIds.has(draft.observationId)) {
    throw new Error(`Duplicate coverage observation ${draft.observationId}.`);
  }
  const characterIds = new Set<string>();
  for (const item of draft.characterApplicabilities) {
    if (characterIds.has(item.characterId)) {
      throw new Error(
        `Observation ${draft.observationId} repeats character ${item.characterId}.`,
      );
    }
    characterIds.add(item.characterId);
  }
  if (characterIds.size === 0) {
    throw new Error(`Observation ${draft.observationId} has no character.`);
  }
  context.observationIds.add(draft.observationId);
  context.observations.push({
    observationId: draft.observationId,
    axis: draft.axis,
    repositoryRecordId: draft.record.id,
    characterApplicabilities: [...draft.characterApplicabilities].sort(
      (left, right) => compareText(left.characterId, right.characterId),
    ),
    sourceConditions: sortedUnique(draft.sourceConditions),
    conditionResolution: draft.conditionResolution,
    inputRepresentability: draft.inputRepresentability,
    searchGrammarRepresentability: { state: "not-applicable" },
    payload: structuredClone(draft.payload),
  });
}

function teamMemberApplicability(
  member: Extract<KnowledgeRecord, { kind: "team" }>["members"][number],
): CharacterObservationApplicability {
  const { investment } = member;
  const exactConstellation =
    investment.status === "specified" || investment.status === "partial"
      ? investment.constellation
      : undefined;
  if (exactConstellation != null) {
    return {
      characterId: member.characterId,
      applicability: {
        state: "explicit-range",
        minConstellation: exactConstellation,
        maxConstellation: exactConstellation,
        sourceMinBoundPresent: true,
        sourceMaxBoundPresent: true,
      },
      basis: "exact-team-member-investment",
    };
  }
  if (
    investment.status === "partial" &&
    (investment.minConstellation != null ||
      investment.maxConstellation != null)
  ) {
    return rangeApplicability(
      member.characterId,
      investment.minConstellation,
      investment.maxConstellation,
      "bounded-team-member-investment",
    );
  }
  return unspecifiedApplicability(member.characterId);
}

function rangeApplicability(
  characterId: string,
  minConstellation: number | undefined,
  maxConstellation: number | undefined,
  basis:
    | "bounded-team-member-investment"
    | "guide-build-bound"
    | "guide-recommendation-bound"
    | "role-member-bound",
): CharacterObservationApplicability {
  if (minConstellation == null && maxConstellation == null) {
    return unspecifiedApplicability(characterId);
  }
  const min = minConstellation ?? 0;
  const max = maxConstellation ?? 6;
  if (max < min) {
    throw new Error(
      `Invalid constellation range C${min}-C${max} for ${characterId}.`,
    );
  }
  return {
    characterId,
    applicability: {
      state: "explicit-range",
      minConstellation: min,
      maxConstellation: max,
      sourceMinBoundPresent: minConstellation != null,
      sourceMaxBoundPresent: maxConstellation != null,
    },
    basis,
  };
}

function unspecifiedApplicability(
  characterId: string,
): CharacterObservationApplicability {
  return {
    characterId,
    applicability: { state: "constellation-unspecified" },
    basis: "source-has-no-constellation-bound",
  };
}

function canonicalArtifact(artifact: ArtifactChoice): ArtifactChoice {
  return artifact.type === "4pc"
    ? { type: "4pc", setId: artifact.setId }
    : {
        type: "2pc+2pc",
        halfSetIds: [...artifact.halfSetIds].sort(compareText) as [string, string],
      };
}

function canonicalArtifacts(artifacts: readonly ArtifactChoice[]): ArtifactChoice[] {
  const byKey = new Map<string, ArtifactChoice>();
  for (const artifact of artifacts) {
    const canonical = canonicalArtifact(artifact);
    byKey.set(stableJson(canonical), canonical);
  }
  return [...byKey.values()].sort((left, right) =>
    compareText(stableJson(left), stableJson(right)),
  );
}

function authenticateSearchCoverageReports(
  repository: KnowledgeRepository,
  weaponInput: unknown,
  artifactInput: unknown,
  generatedFrom: readonly { path: string; sha256: string }[],
): {
  weapon: WeaponChoiceSearchCoverageReport;
  artifact: ArtifactChoiceSearchCoverageReport;
  weaponFileSha256: string;
  weaponPayloadSha256: string;
  artifactFileSha256: string;
  artifactPayloadSha256: string;
} {
  const weapon = requireCoverageReport<WeaponChoiceSearchCoverageReport>(
    weaponInput,
    "weapon-choice-candidate-policy-coverage",
  );
  const artifact = requireCoverageReport<ArtifactChoiceSearchCoverageReport>(
    artifactInput,
    "artifact-choice-search-space-coverage",
  );
  const weaponPath =
    "scripts/guide-factory/reports/weapon-choice-search-coverage.json";
  const artifactPath =
    "scripts/guide-factory/reports/artifact-choice-search-coverage.json";
  const weaponFileSha256 = requiredGeneratedHash(generatedFrom, weaponPath);
  const artifactFileSha256 = requiredGeneratedHash(generatedFrom, artifactPath);
  const weaponPayloadSha256 = sha256Text(stableJson(weaponInput));
  const artifactPayloadSha256 = sha256Text(stableJson(artifactInput));
  if (weaponFileSha256 !== weaponPayloadSha256) {
    throw new Error("Weapon search-coverage report bytes do not match its input object.");
  }
  if (artifactFileSha256 !== artifactPayloadSha256) {
    throw new Error("Artifact search-coverage report bytes do not match its input object.");
  }
  assertCoverageGeneratedFromCurrent(
    weapon,
    generatedFrom,
    weaponPath,
    WEAPON_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  );
  assertCoverageGeneratedFromCurrent(
    artifact,
    generatedFrom,
    artifactPath,
    ARTIFACT_CHOICE_SEARCH_COVERAGE_INPUT_PATHS,
  );
  const expectedWeapon = buildWeaponChoiceSearchCoverageReport(
    repository,
    weapon.generatedFrom,
  );
  if (stableJson(expectedWeapon) !== stableJson(weapon)) {
    throw new Error(
      "Weapon search-coverage report does not match a fresh complete rebuild.",
    );
  }
  const expectedArtifact = buildArtifactChoiceSearchCoverageReport(
    repository,
    artifact.generatedFrom,
  );
  if (stableJson(expectedArtifact) !== stableJson(artifact)) {
    throw new Error(
      "Artifact search-coverage report does not match a fresh complete rebuild.",
    );
  }
  if (weapon.observations.some(({ recordStatus }) => recordStatus === "rejected")) {
    throw new Error("Weapon search coverage contains a rejected observation.");
  }
  if (artifact.observations.some(({ recordStatus }) => recordStatus === "rejected")) {
    throw new Error("Artifact search coverage contains a rejected observation.");
  }
  return {
    weapon,
    artifact,
    weaponFileSha256,
    weaponPayloadSha256,
    artifactFileSha256,
    artifactPayloadSha256,
  };
}

function requireCoverageReport<T extends { generatedFrom: Array<{ path: string; sha256: string }>; observations: unknown[] }>(
  input: unknown,
  classification: string,
): T {
  if (!isRecord(input) || input.classification !== classification) {
    throw new Error(`Expected ${classification} report input.`);
  }
  if (!Array.isArray(input.generatedFrom) || !Array.isArray(input.observations)) {
    throw new Error(`${classification} report is missing generatedFrom or observations.`);
  }
  return input as T;
}

function assertCoverageGeneratedFromCurrent(
  report: { generatedFrom: Array<{ path: string; sha256: string }> },
  current: readonly { path: string; sha256: string }[],
  reportPath: string,
  expectedInputPaths: readonly string[],
): void {
  const actualPaths = report.generatedFrom
    .map(({ path }) => path)
    .sort(compareText);
  const expectedPaths = [...expectedInputPaths].sort(compareText);
  if (stableJson(actualPaths) !== stableJson(expectedPaths)) {
    throw new Error(`${reportPath} has an incomplete generatedFrom boundary.`);
  }
  for (const file of report.generatedFrom) {
    const currentHash = requiredGeneratedHash(current, file.path);
    if (currentHash !== file.sha256) {
      throw new Error(
        `${reportPath} is stale against current ${file.path}.`,
      );
    }
  }
}

function attachSearchGrammarRepresentability(
  observations: CharacterGuideInputObservation[],
  weaponReport: WeaponChoiceSearchCoverageReport,
  artifactReport: ArtifactChoiceSearchCoverageReport,
): {
  weaponLinkedPolicyObservationCount: number;
  artifactLinkedPolicyObservationCount: number;
  weaponOutcomeClassificationCounts: Record<string, number>;
  artifactOutcomeClassificationCounts: Record<string, number>;
} {
  const linkedWeaponIds = new Set<string>();
  const linkedArtifactIds = new Set<string>();
  const weaponOutcomeClassificationCounts = new Map<string, number>();
  const artifactOutcomeClassificationCounts = new Map<string, number>();
  for (const observation of observations) {
    if (observation.axis === "weapon") {
      const matches = matchingWeaponPolicyObservations(
        observation,
        weaponReport.observations,
      );
      for (const match of matches) {
        if (linkedWeaponIds.has(match.observationId)) {
          throw new Error(
            `Weapon policy observation ${match.observationId} is linked more than once.`,
          );
        }
        linkedWeaponIds.add(match.observationId);
        incrementCount(
          weaponOutcomeClassificationCounts,
          weaponOutcomeClassification(match),
        );
      }
      const fullPolicyOutcomePayload = matches.map((match) => ({
        policyObservationId: match.observationId,
        weaponId: match.weaponId,
        requestedRefinement: match.requestedRefinement ?? null,
        weaponIdDomain: match.weaponIdDomain,
        refinementCoverage: match.refinementCoverage,
        nativeTypeCompatibility: match.nativeTypeCompatibility,
      }));
      observation.searchGrammarRepresentability = {
        state: "linked-existing-search-coverage",
        policy: "weapon-choice-candidate-policy",
        policyObservationIds: matches.map(({ observationId }) => observationId),
        outcomeClassifications: matches.map((match) => ({
          policyObservationId: match.observationId,
          classification: weaponOutcomeClassification(match),
        })),
        policyOutcomePayloadSha256: sha256Text(
          stableJson(fullPolicyOutcomePayload),
        ),
        suitabilityAssessed: false,
        rankingAssessed: false,
      };
    } else if (observation.axis === "artifact") {
      const matches = matchingArtifactPolicyObservations(
        observation,
        artifactReport.observations,
      );
      for (const match of matches) {
        if (linkedArtifactIds.has(match.observationId)) {
          throw new Error(
            `Artifact policy observation ${match.observationId} is linked more than once.`,
          );
        }
        linkedArtifactIds.add(match.observationId);
        incrementCount(
          artifactOutcomeClassificationCounts,
          artifactOutcomeClassification(match),
        );
      }
      const fullPolicyOutcomePayload = matches.map((match) => ({
        policyObservationId: match.observationId,
        artifact: match.artifact,
        outcome: match.outcome,
        failureReason: match.failureReason ?? null,
      }));
      observation.searchGrammarRepresentability = {
        state: "linked-existing-search-coverage",
        policy: "artifact-choice-search-space",
        policyObservationIds: matches.map(({ observationId }) => observationId),
        outcomeClassifications: matches.map((match) => ({
          policyObservationId: match.observationId,
          classification: artifactOutcomeClassification(match),
        })),
        policyOutcomePayloadSha256: sha256Text(
          stableJson(fullPolicyOutcomePayload),
        ),
        suitabilityAssessed: false,
        rankingAssessed: false,
      };
    }
  }
  if (linkedWeaponIds.size !== weaponReport.observations.length) {
    throw new Error(
      `Linked ${linkedWeaponIds.size}/${weaponReport.observations.length} weapon policy observations.`,
    );
  }
  if (linkedArtifactIds.size !== artifactReport.observations.length) {
    throw new Error(
      `Linked ${linkedArtifactIds.size}/${artifactReport.observations.length} artifact policy observations.`,
    );
  }
  return {
    weaponLinkedPolicyObservationCount: linkedWeaponIds.size,
    artifactLinkedPolicyObservationCount: linkedArtifactIds.size,
    weaponOutcomeClassificationCounts: sortedCountRecord(
      weaponOutcomeClassificationCounts,
    ),
    artifactOutcomeClassificationCounts: sortedCountRecord(
      artifactOutcomeClassificationCounts,
    ),
  };
}

function weaponOutcomeClassification(
  observation: WeaponChoiceSearchCoverageReport["observations"][number],
): string {
  return [
    `${observation.weaponIdDomain.outcome}${observation.weaponIdDomain.failureReason ? `:${observation.weaponIdDomain.failureReason}` : ""}`,
    `${observation.refinementCoverage.outcome}${observation.refinementCoverage.failureReason ? `:${observation.refinementCoverage.failureReason}` : ""}`,
    observation.nativeTypeCompatibility.outcome,
  ].join("|");
}

function artifactOutcomeClassification(
  observation: ArtifactChoiceSearchCoverageReport["observations"][number],
): string {
  return (
    observation.outcome +
    (observation.failureReason ? `:${observation.failureReason}` : "")
  );
}

function incrementCount(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedCountRecord(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) => compareText(left, right)),
  );
}

function matchingWeaponPolicyObservations(
  observation: CharacterGuideInputObservation,
  policyObservations: WeaponChoiceSearchCoverageReport["observations"],
): WeaponChoiceSearchCoverageReport["observations"] {
  const payload = observation.payload;
  const sourceShape = requiredPayloadString(payload, "sourceShape", observation);
  const characterIds = new Set(
    observation.characterApplicabilities.map(({ characterId }) => characterId),
  );
  const expectedWeaponIds = requiredPayloadStringArray(
    payload,
    "weaponIds",
    observation,
  );
  const matches = policyObservations.filter((candidate) => {
    if (
      candidate.recordId !== observation.repositoryRecordId ||
      !characterIds.has(candidate.characterId) ||
      !expectedWeaponIds.includes(candidate.weaponId)
    ) {
      return false;
    }
    if (sourceShape === "guide-weapon-order-array") {
      return candidate.sourceKind === "guide-weapon-order";
    }
    if (sourceShape === "character-guide-weapon-recommendation-group") {
      return (
        candidate.sourceKind === "character-guide-recommendation" &&
        candidate.recommendationId === payload.recommendationId &&
        candidate.recommendationGroupIndex === payload.groupIndex
      );
    }
    if (sourceShape === "exact-team-selected-weapon") {
      return (
        candidate.sourceKind === "team-selected-weapon" &&
        candidate.memberIndex === payload.memberIndex
      );
    }
    if (sourceShape === "exact-team-weapon-recommendation-group") {
      return (
        candidate.sourceKind === "team-member-recommendation" &&
        candidate.memberIndex === payload.memberIndex &&
        candidate.recommendationGroupIndex === payload.groupIndex
      );
    }
    return false;
  });
  assertExactChoiceLinkage(
    observation,
    expectedWeaponIds,
    matches.map(({ weaponId }) => weaponId),
  );
  return [...matches].sort((left, right) =>
    compareText(left.observationId, right.observationId),
  );
}

function matchingArtifactPolicyObservations(
  observation: CharacterGuideInputObservation,
  policyObservations: ArtifactChoiceSearchCoverageReport["observations"],
): ArtifactChoiceSearchCoverageReport["observations"] {
  const payload = observation.payload;
  const sourceShape = requiredPayloadString(payload, "sourceShape", observation);
  const characterIds = new Set(
    observation.characterApplicabilities.map(({ characterId }) => characterId),
  );
  const expectedArtifacts = requiredPayloadArtifacts(
    payload,
    sourceShape === "coupled-whole-team-artifact-plan"
      ? "assignments"
      : "artifacts",
    observation,
  );
  const expectedKeys = expectedArtifacts.map(({ characterId, artifact }) =>
    artifactPolicyChoiceKey(characterId, artifact),
  );
  const matches = policyObservations.filter((candidate) => {
    if (
      candidate.recordId !== observation.repositoryRecordId ||
      !characterIds.has(candidate.characterId)
    ) {
      return false;
    }
    if (sourceShape === "guide-build-artifact") {
      return (
        candidate.sourceKind === "guide-build" &&
        candidate.sourceRecordId === payload.sourceRecordId
      );
    }
    if (sourceShape === "character-guide-artifact-recommendation-group") {
      return (
        candidate.sourceKind === "character-guide-recommendation" &&
        candidate.sourceRecordId === payload.recommendationId &&
        candidate.recommendationGroupIndex === payload.groupIndex
      );
    }
    if (sourceShape === "exact-team-selected-artifact") {
      return (
        candidate.sourceKind === "team-selected-artifact" &&
        candidate.memberIndex === payload.memberIndex
      );
    }
    if (sourceShape === "exact-team-artifact-recommendation-group") {
      return (
        candidate.sourceKind === "team-member-recommendation" &&
        candidate.memberIndex === payload.memberIndex &&
        candidate.recommendationGroupIndex === payload.groupIndex
      );
    }
    if (sourceShape === "coupled-whole-team-artifact-plan") {
      return (
        candidate.sourceKind === "team-artifact-plan-assignment" &&
        candidate.planId === payload.planId
      );
    }
    return false;
  });
  assertExactChoiceLinkage(
    observation,
    expectedKeys,
    matches.map(({ characterId, artifact }) =>
      artifactPolicyChoiceKey(characterId, canonicalArtifact(artifact)),
    ),
  );
  return [...matches].sort((left, right) =>
    compareText(left.observationId, right.observationId),
  );
}

function requiredPayloadArtifacts(
  payload: Record<string, unknown>,
  field: "artifacts" | "assignments",
  observation: CharacterGuideInputObservation,
): Array<{ characterId: string; artifact: ArtifactChoice }> {
  const value = payload[field];
  if (!Array.isArray(value)) {
    throw new Error(`Observation ${observation.observationId} has no ${field}.`);
  }
  if (field === "artifacts") {
    const characterId = observation.characterApplicabilities[0]?.characterId;
    if (!characterId) {
      throw new Error(`Observation ${observation.observationId} has no character.`);
    }
    return value.map((artifact) => ({
      characterId,
      artifact: parseArtifactPayload(artifact, observation),
    }));
  }
  return value.map((assignment) => {
    if (!isRecord(assignment) || typeof assignment.characterId !== "string") {
      throw new Error(
        `Observation ${observation.observationId} has an invalid artifact assignment.`,
      );
    }
    return {
      characterId: assignment.characterId,
      artifact: parseArtifactPayload(assignment.artifact, observation),
    };
  });
}

function parseArtifactPayload(
  value: unknown,
  observation: CharacterGuideInputObservation,
): ArtifactChoice {
  if (!isRecord(value) || (value.type !== "4pc" && value.type !== "2pc+2pc")) {
    throw new Error(
      `Observation ${observation.observationId} has an invalid artifact payload.`,
    );
  }
  if (value.type === "4pc" && typeof value.setId === "string") {
    return { type: "4pc", setId: value.setId };
  }
  if (
    value.type === "2pc+2pc" &&
    Array.isArray(value.halfSetIds) &&
    value.halfSetIds.length === 2 &&
    value.halfSetIds.every((entry) => typeof entry === "string")
  ) {
    return canonicalArtifact({
      type: "2pc+2pc",
      halfSetIds: [value.halfSetIds[0] as string, value.halfSetIds[1] as string],
    });
  }
  throw new Error(
    `Observation ${observation.observationId} has an invalid artifact payload.`,
  );
}

function assertExactChoiceLinkage(
  observation: CharacterGuideInputObservation,
  expected: readonly string[],
  observed: readonly string[],
): void {
  const expectedCounts = valueCounts(expected);
  const observedCounts = valueCounts(observed);
  if (stableJson(expectedCounts) !== stableJson(observedCounts)) {
    throw new Error(
      `Observation ${observation.observationId} does not exactly match existing search coverage: expected ${JSON.stringify(expectedCounts)}, observed ${JSON.stringify(observedCounts)}.`,
    );
  }
}

function artifactPolicyChoiceKey(
  characterId: string,
  artifact: ArtifactChoice,
): string {
  return `${characterId}:${stableJson(canonicalArtifact(artifact)).trim()}`;
}

function valueCounts(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => compareText(left, right)),
  );
}

function requiredPayloadString(
  payload: Record<string, unknown>,
  field: string,
  observation: CharacterGuideInputObservation,
): string {
  const value = payload[field];
  if (typeof value !== "string") {
    throw new Error(`Observation ${observation.observationId} has no ${field}.`);
  }
  return value;
}

function requiredPayloadStringArray(
  payload: Record<string, unknown>,
  field: string,
  observation: CharacterGuideInputObservation,
): string[] {
  const value = payload[field];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Observation ${observation.observationId} has no ${field}.`);
  }
  return value;
}

function indexObservationsByCharacter(
  observations: readonly CharacterGuideInputObservation[],
): Map<string, CharacterGuideInputObservation[]> {
  const index = new Map<string, CharacterGuideInputObservation[]>();
  for (const observation of observations) {
    for (const { characterId } of observation.characterApplicabilities) {
      const current = index.get(characterId) ?? [];
      current.push(observation);
      index.set(characterId, current);
    }
  }
  return index;
}

function indexCharacterGuides(
  records: readonly KnowledgeRecord[],
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const record of records) {
    if (record.kind !== "character_guide" || record.status === "rejected") continue;
    const current = index.get(record.characterId) ?? [];
    current.push(record.id);
    current.sort(compareText);
    index.set(record.characterId, current);
  }
  return index;
}

function classifyCell(
  characterId: string,
  constellation: number,
  axis: CharacterGuideInputCoverageAxis,
  observations: readonly CharacterGuideInputObservation[],
): CharacterGuideInputCoverageCell {
  const explicitMatchObservationIds: string[] = [];
  const constellationUnspecifiedObservationIds: string[] = [];
  const explicitlyOutOfRangeObservationIds: string[] = [];
  for (const observation of observations) {
    if (observation.axis !== axis) continue;
    const item = observation.characterApplicabilities.find(
      (candidate) => candidate.characterId === characterId,
    );
    if (!item) continue;
    if (item.applicability.state === "constellation-unspecified") {
      constellationUnspecifiedObservationIds.push(observation.observationId);
    } else if (
      constellation >= item.applicability.minConstellation &&
      constellation <= item.applicability.maxConstellation
    ) {
      explicitMatchObservationIds.push(observation.observationId);
    } else {
      explicitlyOutOfRangeObservationIds.push(observation.observationId);
    }
  }
  const state: CharacterGuideInputCoverageState =
    explicitMatchObservationIds.length > 0
      ? "has-explicit-constellation-match"
      : constellationUnspecifiedObservationIds.length > 0
        ? "no-explicit-match-but-has-constellation-unspecified"
        : explicitlyOutOfRangeObservationIds.length > 0
          ? "only-explicitly-out-of-range"
          : "not-observed";
  return {
    state,
    counts: {
      explicitMatch: explicitMatchObservationIds.length,
      constellationUnspecified: constellationUnspecifiedObservationIds.length,
      explicitlyOutOfRange: explicitlyOutOfRangeObservationIds.length,
    },
    classificationBucketsSha256: sha256Text(
      stableJson({
        explicitMatchObservationIds: explicitMatchObservationIds.sort(compareText),
        constellationUnspecifiedObservationIds:
          constellationUnspecifiedObservationIds.sort(compareText),
        explicitlyOutOfRangeObservationIds:
          explicitlyOutOfRangeObservationIds.sort(compareText),
      }),
    ),
  };
}

function summarize(
  characters: CharacterGuideInputCoverageReport["characters"],
  observations: readonly CharacterGuideInputObservation[],
  sourceProvenanceCount: number,
): CharacterGuideInputCoverageReport["summary"] {
  const observationCountsByAxis = Object.fromEntries(
    CHARACTER_GUIDE_INPUT_COVERAGE_AXES.map((axis) => [
      axis,
      observations.filter((observation) => observation.axis === axis).length,
    ]),
  ) as Record<CharacterGuideInputCoverageAxis, number>;
  const rowStateCountsByAxis = Object.fromEntries(
    CHARACTER_GUIDE_INPUT_COVERAGE_AXES.map((axis, axisIndex) => [
      axis,
      Object.fromEntries(
        CHARACTER_GUIDE_INPUT_COVERAGE_STATES.map((state) => [
          state,
          characters.reduce(
            (total, character) =>
              total +
              character.rows.filter(
                (row) => row.axisStates[axisIndex] === state,
              )
                .length,
            0,
          ),
        ]),
      ),
    ]),
  ) as Record<
    CharacterGuideInputCoverageAxis,
    Record<CharacterGuideInputCoverageState, number>
  >;
  return {
    characterCount: characters.length,
    constellationRowCount: characters.reduce(
      (total, character) => total + character.rows.length,
      0,
    ),
    observationCount: observations.length,
    sourceProvenanceCount,
    guideLessCharacterIds: characters
      .filter(({ hasNonRejectedCharacterGuideRecord }) =>
        !hasNonRejectedCharacterGuideRecord,
      )
      .map(({ characterId }) => characterId),
    observationCountsByAxis,
    rowStateCountsByAxis,
    repositoryAuthoredDamagePlanObservationCount:
      observationCountsByAxis.formula,
    observationsWithUnresolvedSourceConditions: observations.filter(
      ({ conditionResolution }) =>
        conditionResolution === "preserved-unresolved-source-conditions",
    ).length,
    coupledArtifactPlanObservationCount: observations.filter(
      ({ inputRepresentability }) =>
        inputRepresentability === "represented-as-coupled-artifact-plan",
    ).length,
    ordinaryErStatTokenObservationCount: observations.filter(
      (observation) =>
        (observation.axis === "main-stat" || observation.axis === "substat") &&
        Array.isArray(observation.payload.statIds) &&
        observation.payload.statIds.includes("er"),
    ).length,
  };
}

function sourceRecordKey(sourceId: string, sourceRecordId: string): string {
  return `${sourceId}:${sourceRecordId}`;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareWeightedStat(
  left: { statId: string; weight: number },
  right: { statId: string; weight: number },
): number {
  return compareText(left.statId, right.statId) || left.weight - right.weight;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
