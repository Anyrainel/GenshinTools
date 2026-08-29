import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type KnowledgeRecord,
} from "./schemas";

const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const ROSTER_REPORT_PATH =
  "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json";

export const DERIVED_FORMULA_FIXTURE_REPORT_PATHS = [
  "scripts/guide-factory/reports/furina-neuvillette-formula-plan-draft.json",
  "scripts/guide-factory/reports/keqing-ineffa-formula-plan-draft.json",
] as const;

const FURINA_MANUAL_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-furina-manual.json";
const KEQING_MANUAL_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-keqing-manual.json";

export const DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS = [
  FURINA_MANUAL_PATH,
  KEQING_MANUAL_PATH,
] as const;

const FURINA_FIXTURE_GENERATED_FROM = [
  REPOSITORY_PATH,
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/formulaPlanDraft.ts",
  "scripts/guide-factory/src/furinaNeuvilletteFormulaDraft.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameStatsLoader.ts",
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
  "src/lib/dmgcalc/index.ts",
] as const;

const KEQING_FIXTURE_GENERATED_FROM = [
  REPOSITORY_PATH,
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/formulaPlanDraft.ts",
  "scripts/guide-factory/src/formulaPlanReadiness.ts",
  "scripts/guide-factory/src/keqingIneffaFormulaDraft.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/sourceBackedEquipmentScenario.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  "src/data/charInfo.ts",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameStatsLoader.ts",
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
  "src/lib/dmgcalc/index.ts",
] as const;

export const DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS = [
  "scripts/guide-factory/src/derivedFormulaFixtureCoverage.ts",
  "scripts/guide-factory/src/inventory-derived-formula-fixture-coverage.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/paths.ts",
  "scripts/guide-factory/src/schemas.ts",
  SOURCE_REGISTRY_PATH,
  MANUAL_INDEX_PATH,
  ...DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS,
  ROSTER_REPORT_PATH,
  "src/data/resources.ts",
  ...DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
  ...FURINA_FIXTURE_GENERATED_FROM,
  ...KEQING_FIXTURE_GENERATED_FROM,
].filter((value, index, all) => all.indexOf(value) === index) as string[];

export const DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS = [
  REPOSITORY_PATH,
  SOURCE_REGISTRY_PATH,
  MANUAL_INDEX_PATH,
  FURINA_MANUAL_PATH,
  KEQING_MANUAL_PATH,
  ROSTER_REPORT_PATH,
  ...DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
] as const;

const EXPECTED_RELEASED_CHARACTER_COUNT = 125;
const EXPECTED_RELEASED_CHARACTER_IDS_SHA256 =
  "070e664f88275374348f80e340b2ac1515ed5abe4a0b24029d84baa843f2b87f";

interface FixtureSpec {
  reportPath: (typeof DERIVED_FORMULA_FIXTURE_REPORT_PATHS)[number];
  fixtureId: string;
  sourceTeamRecordId: string;
  sourceRotationRecordId: string;
  sourceRotationId: string;
  manualSnapshotPath: string;
  expectedGeneratedFromPaths: readonly string[];
  readiness:
    | {
        state: "not-assessed";
        sourceTokenCoverage: "not-recorded";
      }
    | {
        state: "assessed-blocked";
        sourceTokenCoverage: "recorded";
        blockerCount: 8;
      };
}

const FIXTURE_SPECS: readonly FixtureSpec[] = [
  {
    reportPath: DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
    fixtureId: "furina-neuvillette-source-rotation-comparison-v2",
    sourceTeamRecordId: "genshintools-presets:team:JQC4wxT0jJgK50gc0O",
    sourceRotationRecordId:
      "kqm:team:furina-neuvillette-kazuha-xilonen-example",
    sourceRotationId: "sample-rotation-xilonen",
    manualSnapshotPath: FURINA_MANUAL_PATH,
    expectedGeneratedFromPaths: FURINA_FIXTURE_GENERATED_FROM,
    readiness: {
      state: "not-assessed",
      sourceTokenCoverage: "not-recorded",
    },
  },
  {
    reportPath: DERIVED_FORMULA_FIXTURE_REPORT_PATHS[1],
    fixtureId: "keqing-ineffa-source-rotation-comparison-v1",
    sourceTeamRecordId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    sourceRotationRecordId:
      "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
    sourceRotationId: "sample-rotation",
    manualSnapshotPath: KEQING_MANUAL_PATH,
    expectedGeneratedFromPaths: KEQING_FIXTURE_GENERATED_FROM,
    readiness: {
      state: "assessed-blocked",
      sourceTokenCoverage: "recorded",
      blockerCount: 8,
    },
  },
] as const;

export interface DerivedFormulaFixtureReportInput {
  path: string;
  reportInput: unknown;
}

export interface DerivedFormulaFixtureManualInput {
  path: string;
  snapshotInput: unknown;
}

export interface DerivedFormulaFixtureSourceFile {
  path: string;
  text: string;
}

export interface BuildDerivedFormulaFixtureCoverageInput {
  fixtureReportInputs: readonly DerivedFormulaFixtureReportInput[];
  repositoryInput: unknown;
  sourceRegistryInput: unknown;
  manualIndexInput: unknown;
  manualSnapshotInputs: readonly DerivedFormulaFixtureManualInput[];
  sourceFiles: readonly DerivedFormulaFixtureSourceFile[];
  releasedCharacterIds: readonly string[];
  checkedInRosterReportInput: unknown;
  generatedFrom: readonly { path: string; sha256: string }[];
}

export interface DerivedFormulaFixtureMemberObservation {
  observationId: string;
  scenarioId: string;
  characterId: string;
  derivedConstellation: 0;
  localFixtureAssumptions: {
    charLevel: 90;
    constellation: 0;
    refinement: 1;
    talentLevels: {
      auto: 10;
      skill: 10;
      burst: 10;
    };
  };
  constellationBasis: "calculator-local-fixture-assumption";
  calculationTeamInvestment: "constellation-unspecified";
  sourceRotationTeamInvestment: "constellation-unspecified";
  formulaInventory: {
    positiveDefaultFormulaCount: number;
    zeroDefaultFormulaCount: number;
    formulaIdsSha256: string;
  };
}

export interface DerivedFormulaFixtureScenario {
  scenarioId: string;
  fixtureId: string;
  fixtureReport: {
    path: string;
    sha256: string;
    generatedFromSha256: string;
  };
  calculationTeamRecordId: string;
  sourceRotation: {
    recordId: string;
    rotationId: string;
  };
  provenance: {
    sourceId: "kqm";
    sourceRecordId: string;
    manualSnapshot: { path: string; sha256: string };
    sourceRotationExtractionReviewStatus: "unreviewed";
    actionTranslationReviewStatus: "unreviewed";
  };
  readiness:
    | {
        state: "not-assessed";
        readyForDamageReplay: null;
        blockerCount: null;
        sourceTokenCoverage: "not-recorded";
      }
    | {
        state: "assessed-blocked";
        readyForDamageReplay: false;
        blockerCount: 8;
        sourceTokenCoverage: "recorded";
      };
  sourceAuthoredFormulaPlan: false;
  supportsGuideClaims: false;
  supportsRecommendations: false;
  supportsRanking: false;
  supportsDamageClaims: false;
  supportsSourceValidation: false;
  validationDisposition: "withheld-from-guide-use";
  memberObservations: DerivedFormulaFixtureMemberObservation[];
}

export interface DerivedFormulaFixtureCoverageReport {
  schemaVersion: 1;
  reportType: "derived-formula-fixture-coverage";
  classification: "descriptive-derived-fixture-inventory";
  comparisonStatus: "comparable";
  generatedFrom: Array<{ path: string; sha256: string }>;
  validationDisposition: "withheld-from-guide-use";
  sourceAuthoredFormulaPlan: false;
  supportsGuideClaims: false;
  supportsRecommendations: false;
  supportsRanking: false;
  supportsDamageClaims: false;
  supportsSourceValidation: false;
  supportsEnergyRecoveryClaims: false;
  boundaries: {
    fixtureSet: {
      expectedFixtureCount: 2;
      fixtureReportPaths: string[];
      reportFileHashesAuthenticatedAgainstGeneratedFrom: true;
      embeddedGeneratedFromMustMatchCurrentFiles: true;
      completeExpectedInputSetRequired: true;
    };
    roster: {
      releasedCharacterCount: 125;
      releasedCharacterIdsSha256: string;
      checkedInRosterReferenceMatched: true;
      everyObservedCharacterIsReleased: true;
    };
    constellation: {
      observedDerivedConstellations: [0];
      unobservedDerivedConstellations: [1, 2, 3, 4, 5, 6];
      derivedC0Basis: "calculator-local-fixture-assumptions-only";
      calculationTeamInvestment: "constellation-unspecified";
      sourceRotationTeamInvestment: "constellation-unspecified";
      sourceConstellationUsedAsC0Evidence: false;
    };
    review: {
      sourceRotationsHumanReviewed: false;
      actionTranslationsHumanReviewed: false;
      furinaFixtureReadiness: "not-assessed";
      furinaFixtureSourceTokenCoverage: "not-recorded";
      keqingFixtureReadiness: "assessed-blocked";
      keqingFixtureBlockerCount: 8;
    };
    exclusions: {
      formulaExecutionPerformed: false;
      damageReplayPerformed: false;
      optimizerUsed: false;
      energyRecoveryInputsRead: false;
      energyRecoveryComputed: false;
    };
  };
  scenarios: DerivedFormulaFixtureScenario[];
  characters: Array<{
    characterId: string;
    scenarioObservationIds: string[];
    rows: Array<{
      constellation: number;
      state: "observed-exact-derived-assumption" | "not-observed";
      scenarioObservationIds: string[];
    }>;
  }>;
  summary: {
    fixtureCount: 2;
    characterScenarioObservationCount: 8;
    uniqueCharacterCount: 6;
    derivedC0ObservationCount: 8;
    sourceConstellationSpecifiedObservationCount: 0;
    sourceConstellationUnspecifiedObservationCount: 8;
    sharedCharacterScenarioObservationCounts: {
      furina: 2;
      xilonen: 2;
    };
    sourceValidatedObservationCount: 0;
    guideReadyObservationCount: 0;
    positiveDefaultFormulaRowCount: 25;
    zeroDefaultFormulaRowCount: 11;
  };
  coveragePayloadSha256: string;
  cautions: string[];
  prohibitedInterpretations: string[];
}

type KnowledgeTeam = Extract<KnowledgeRecord, { kind: "team" }>;

/** Inventory two checked-in local formula fixtures without executing them. */
export function buildDerivedFormulaFixtureCoverageReport(
  input: BuildDerivedFormulaFixtureCoverageInput,
): DerivedFormulaFixtureCoverageReport {
  const generatedFrom = validateGeneratedFrom(input.generatedFrom);
  const sourceFiles = authenticateSourceFiles(input.sourceFiles, generatedFrom);
  const fixtureInputs = validateFixtureInputSet(input.fixtureReportInputs);
  const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
  authenticateJsonInput(repository, REPOSITORY_PATH, sourceFiles);
  const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistryInput);
  authenticateJsonInput(sourceRegistry, SOURCE_REGISTRY_PATH, sourceFiles);
  if (
    repository.sourceRegistrySha256 !==
    requiredGeneratedHash(generatedFrom, SOURCE_REGISTRY_PATH)
  ) {
    throw new Error(
      "Derived fixture coverage found a stale repository source-registry hash.",
    );
  }
  const manualIndex = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
  authenticateJsonInput(manualIndex, MANUAL_INDEX_PATH, sourceFiles);
  const manualSnapshots = authenticateManualSnapshots(
    input.manualSnapshotInputs,
    manualIndex,
    sourceFiles,
  );
  authenticateRoster(
    input.releasedCharacterIds,
    input.checkedInRosterReportInput,
    sourceFiles,
  );
  const releasedIds = new Set(
    normalizeReleasedCharacterIds(input.releasedCharacterIds),
  );

  const scenarios = FIXTURE_SPECS.map((spec) =>
    buildScenario({
      spec,
      reportInput: fixtureInputs.get(spec.reportPath),
      repository,
      manualSnapshotInput: requiredMapValue(
        manualSnapshots,
        spec.manualSnapshotPath,
        "manual snapshot",
      ),
      releasedIds,
      generatedFrom,
      sourceFiles,
      sourceRegistry,
    }),
  ).sort((left, right) => compareText(left.scenarioId, right.scenarioId));
  validateScenarioObservationIds(scenarios);

  const observations = scenarios.flatMap(({ memberObservations }) =>
    memberObservations.map((observation) => ({ ...observation })),
  );
  const characters = [...new Set(observations.map(({ characterId }) => characterId))]
    .sort(compareText)
    .map((characterId) => {
      const scenarioObservationIds = observations
        .filter((observation) => observation.characterId === characterId)
        .map(({ observationId }) => observationId)
        .sort(compareText);
      return {
        characterId,
        scenarioObservationIds,
        rows: Array.from({ length: 7 }, (_, constellation) => ({
          constellation,
          state:
            constellation === 0
              ? ("observed-exact-derived-assumption" as const)
              : ("not-observed" as const),
          scenarioObservationIds:
            constellation === 0 ? [...scenarioObservationIds] : [],
        })),
      };
    });

  const sharedCounts = new Map(
    characters.map(({ characterId, scenarioObservationIds }) => [
      characterId,
      scenarioObservationIds.length,
    ]),
  );
  if (
    scenarios.length !== 2 ||
    observations.length !== 8 ||
    characters.length !== 6 ||
    sharedCounts.get("furina") !== 2 ||
    sharedCounts.get("xilonen") !== 2
  ) {
    throw new Error(
      "Derived formula fixture coverage no longer has the expected two-scenario, eight-observation, six-character boundary.",
    );
  }
  const positiveDefaultFormulaRowCount = observations.reduce(
    (total, observation) =>
      total + observation.formulaInventory.positiveDefaultFormulaCount,
    0,
  );
  const zeroDefaultFormulaRowCount = observations.reduce(
    (total, observation) =>
      total + observation.formulaInventory.zeroDefaultFormulaCount,
    0,
  );
  if (
    positiveDefaultFormulaRowCount !== 25 ||
    zeroDefaultFormulaRowCount !== 11
  ) {
    throw new Error(
      "Derived formula fixture coverage no longer has the expected 25 positive and 11 zero default formula rows.",
    );
  }

  const summary: DerivedFormulaFixtureCoverageReport["summary"] = {
    fixtureCount: 2,
    characterScenarioObservationCount: 8,
    uniqueCharacterCount: 6,
    derivedC0ObservationCount: 8,
    sourceConstellationSpecifiedObservationCount: 0,
    sourceConstellationUnspecifiedObservationCount: 8,
    sharedCharacterScenarioObservationCounts: { furina: 2, xilonen: 2 },
    sourceValidatedObservationCount: 0,
    guideReadyObservationCount: 0,
    positiveDefaultFormulaRowCount: 25,
    zeroDefaultFormulaRowCount: 11,
  };
  const coveragePayloadSha256 = sha256Text(
    stableJson({ scenarios, characters, summary }),
  );

  return {
    schemaVersion: 1,
    reportType: "derived-formula-fixture-coverage",
    classification: "descriptive-derived-fixture-inventory",
    comparisonStatus: "comparable",
    generatedFrom,
    validationDisposition: "withheld-from-guide-use",
    sourceAuthoredFormulaPlan: false,
    supportsGuideClaims: false,
    supportsRecommendations: false,
    supportsRanking: false,
    supportsDamageClaims: false,
    supportsSourceValidation: false,
    supportsEnergyRecoveryClaims: false,
    boundaries: {
      fixtureSet: {
        expectedFixtureCount: 2,
        fixtureReportPaths: [...DERIVED_FORMULA_FIXTURE_REPORT_PATHS],
        reportFileHashesAuthenticatedAgainstGeneratedFrom: true,
        embeddedGeneratedFromMustMatchCurrentFiles: true,
        completeExpectedInputSetRequired: true,
      },
      roster: {
        releasedCharacterCount: 125,
        releasedCharacterIdsSha256: EXPECTED_RELEASED_CHARACTER_IDS_SHA256,
        checkedInRosterReferenceMatched: true,
        everyObservedCharacterIsReleased: true,
      },
      constellation: {
        observedDerivedConstellations: [0],
        unobservedDerivedConstellations: [1, 2, 3, 4, 5, 6],
        derivedC0Basis: "calculator-local-fixture-assumptions-only",
        calculationTeamInvestment: "constellation-unspecified",
        sourceRotationTeamInvestment: "constellation-unspecified",
        sourceConstellationUsedAsC0Evidence: false,
      },
      review: {
        sourceRotationsHumanReviewed: false,
        actionTranslationsHumanReviewed: false,
        furinaFixtureReadiness: "not-assessed",
        furinaFixtureSourceTokenCoverage: "not-recorded",
        keqingFixtureReadiness: "assessed-blocked",
        keqingFixtureBlockerCount: 8,
      },
      exclusions: {
        formulaExecutionPerformed: false,
        damageReplayPerformed: false,
        optimizerUsed: false,
        energyRecoveryInputsRead: false,
        energyRecoveryComputed: false,
      },
    },
    scenarios,
    characters,
    summary,
    coveragePayloadSha256,
    cautions: [
      "C0 is observed only as an exact local calculator-fixture assumption; neither the calculation team nor the source-rotation team specifies constellation investment.",
      "The two scenario observations for Furina and Xilonen remain separate and are not votes, averages, or corroboration.",
      "The source rotations and agent-authored action translations are unreviewed.",
      "The older Furina fixture has no readiness assessment and does not record token-coverage classifications.",
      "The Keqing fixture is blocked by eight recorded readiness blockers.",
    ],
    prohibitedInterpretations: [
      "Do not treat fixture membership, local C0 assumptions, or formula availability as source validation.",
      "Do not use this report to recommend, rank, or compare teams, builds, formulas, rotations, or damage.",
      "Do not infer any C1-C6 coverage from a C0 local fixture assumption.",
      "Do not infer energy requirements, rotation feasibility, buff coverage, or optimization results.",
    ],
  };
}

function buildScenario(input: {
  spec: FixtureSpec;
  reportInput: unknown;
  repository: ReturnType<typeof KnowledgeRepositorySchema.parse>;
  manualSnapshotInput: ReturnType<typeof ManualObservationSnapshotSchema.parse>;
  releasedIds: ReadonlySet<string>;
  generatedFrom: readonly { path: string; sha256: string }[];
    sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>;
  sourceFiles: ReadonlyMap<string, string>;
}): DerivedFormulaFixtureScenario {
  const { spec, repository, releasedIds, generatedFrom } = input;
  const report = requiredRecord(input.reportInput, `${spec.reportPath} report`);
  authenticateJsonInput(report, spec.reportPath, input.sourceFiles);
  const reportHash = requiredGeneratedHash(generatedFrom, spec.reportPath);
  requireEqual(report.schemaVersion, 1, `${spec.fixtureId} schemaVersion`);
  requireEqual(report.fixtureId, spec.fixtureId, `${spec.reportPath} fixtureId`);
  requireEqual(
    report.classification,
    "calculator-default-draft",
    `${spec.fixtureId} classification`,
  );
  requireEqual(report.status, "needs-domain-review", `${spec.fixtureId} status`);
  requireFalse(report.supportsGuideClaims, `${spec.fixtureId} supportsGuideClaims`);
  requireFalse(report.promotionEligible, `${spec.fixtureId} promotionEligible`);
  assertNoClaimFlagDrift(report, spec.fixtureId);
  requireEqual(
    report.sourceTeamRecordId,
    spec.sourceTeamRecordId,
    `${spec.fixtureId} sourceTeamRecordId`,
  );
  const embeddedGeneratedFrom = parseGeneratedFrom(
    report.generatedFrom,
    `${spec.fixtureId}.generatedFrom`,
  );
  assertExactPathSet(
    embeddedGeneratedFrom.map(({ path }) => path),
    spec.expectedGeneratedFromPaths,
    `${spec.fixtureId}.generatedFrom`,
  );
  for (const entry of embeddedGeneratedFrom) {
    if (entry.sha256 !== requiredGeneratedHash(generatedFrom, entry.path)) {
      throw new Error(
        `Derived fixture ${spec.fixtureId} has stale generatedFrom hash for ${entry.path}.`,
      );
    }
  }

  const sourceTeam = requiredTeam(repository.records, spec.sourceTeamRecordId);
  const sourceRotationTeam = requiredTeam(
    repository.records,
    spec.sourceRotationRecordId,
  );
  requireNoSourceAuthoredDamagePlan(sourceTeam);
  requireNoSourceAuthoredDamagePlan(sourceRotationTeam);
  const sourceRotation = requiredRotation(
    sourceRotationTeam,
    spec.sourceRotationId,
  );
  const reportSourceRotation = requiredRecord(
    report.sourceRotation,
    `${spec.fixtureId}.sourceRotation`,
  );
  requireEqual(
    reportSourceRotation.recordId,
    spec.sourceRotationRecordId,
    `${spec.fixtureId} source rotation record`,
  );
  requireEqual(
    reportSourceRotation.rotationId,
    spec.sourceRotationId,
    `${spec.fixtureId} source rotation ID`,
  );
  requireEqual(
    reportSourceRotation.notation,
    sourceRotation.notation,
    `${spec.fixtureId} source rotation notation`,
  );
  requireStableEqual(
    reportSourceRotation.assumptions,
    sourceRotation.assumptions,
    `${spec.fixtureId} source rotation assumptions`,
  );
  requireStableEqual(
    reportSourceRotation.unresolvedSegments,
    sourceRotation.unresolvedSegments,
    `${spec.fixtureId} source rotation unresolved segments`,
  );

  const authoredTranslation = requiredRecord(
    report.authoredTranslation,
    `${spec.fixtureId}.authoredTranslation`,
  );
  requireEqual(
    authoredTranslation.reviewStatus,
    "unreviewed",
    `${spec.fixtureId} action translation reviewStatus`,
  );
  const assumptions = requiredRecord(
    report.assumptions,
    `${spec.fixtureId}.assumptions`,
  );
  requireEqual(
    assumptions.combatOptions,
    "calculator-defaults",
    `${spec.fixtureId} combat options`,
  );
  const assumptionCharacters = requiredRecordArray(
    assumptions.characters,
    `${spec.fixtureId}.assumptions.characters`,
  );
  const memberIds = assumptionCharacters.map((character, index) => {
    const characterId = requiredString(
      character.characterId,
      `${spec.fixtureId}.assumptions.characters[${index}].characterId`,
    );
    requireEqual(
      character.constellation,
      0,
      `${spec.fixtureId} ${characterId} derived constellation`,
    );
    requireEqual(
      character.charLevel,
      90,
      `${spec.fixtureId} ${characterId} local fixture character level`,
    );
    requireEqual(
      character.refinement,
      1,
      `${spec.fixtureId} ${characterId} local fixture weapon refinement`,
    );
    requireStableEqual(
      character.talentLevels,
      { auto: 10, skill: 10, burst: 10 },
      `${spec.fixtureId} ${characterId} local fixture talent levels`,
    );
    if (!releasedIds.has(characterId)) {
      throw new Error(
        `Derived fixture ${spec.fixtureId} contains non-released character ${characterId}.`,
      );
    }
    return characterId;
  });
  assertUnique(memberIds, `${spec.fixtureId} assumption character IDs`);
  if (memberIds.length !== 4) {
    throw new Error(`Derived fixture ${spec.fixtureId} must have four members.`);
  }
  assertSameStringSet(
    memberIds,
    sourceTeam.members.map(({ characterId }) => characterId),
    `${spec.fixtureId} source-team roster`,
  );
  assertSameStringSet(
    memberIds,
    sourceRotationTeam.members.map(({ characterId }) => characterId),
    `${spec.fixtureId} source-rotation roster`,
  );
  for (const member of sourceTeam.members) {
    requireConstellationUnspecified(member, spec.fixtureId, "source team");
  }
  for (const member of sourceRotationTeam.members) {
    requireConstellationUnspecified(
      member,
      spec.fixtureId,
      "source rotation team",
    );
  }
  assertFormulaReferencesAreMembers(report, memberIds, spec.fixtureId);

  const manual = authenticateManualRecord({
    spec,
    snapshot: input.manualSnapshotInput,
    sourceRotationTeam,
    sourceRotation,
    sourceRegistry: input.sourceRegistry,
  });
  const readiness = validateReadiness(spec, report, authoredTranslation);
  const positiveLines = requiredRecordArray(
    report.lines,
    `${spec.fixtureId}.lines`,
  );
  const zeroLines = requiredRecordArray(
    report.zeroCountAvailableFormulas,
    `${spec.fixtureId}.zeroCountAvailableFormulas`,
  );
  validateFormulaInventoryRows(positiveLines, zeroLines, spec.fixtureId);
  const memberObservations = [...memberIds]
    .sort(compareText)
    .map((characterId): DerivedFormulaFixtureMemberObservation => {
      const positiveFormulaIds = formulaIdsForCharacter(
        positiveLines,
        characterId,
        `${spec.fixtureId}.lines`,
      );
      const zeroFormulaIds = formulaIdsForCharacter(
        zeroLines,
        characterId,
        `${spec.fixtureId}.zeroCountAvailableFormulas`,
      );
      const allFormulaIds = [...positiveFormulaIds, ...zeroFormulaIds].sort(
        compareText,
      );
      assertUnique(allFormulaIds, `${spec.fixtureId} ${characterId} formula IDs`);
      return {
        observationId: `${spec.fixtureId}:${characterId}:C0`,
        scenarioId: spec.fixtureId,
        characterId,
        derivedConstellation: 0,
        localFixtureAssumptions: {
          charLevel: 90,
          constellation: 0,
          refinement: 1,
          talentLevels: { auto: 10, skill: 10, burst: 10 },
        },
        constellationBasis: "calculator-local-fixture-assumption",
        calculationTeamInvestment: "constellation-unspecified",
        sourceRotationTeamInvestment: "constellation-unspecified",
        formulaInventory: {
          positiveDefaultFormulaCount: positiveFormulaIds.length,
          zeroDefaultFormulaCount: zeroFormulaIds.length,
          formulaIdsSha256: sha256Text(stableJson(allFormulaIds)),
        },
      };
    });

  return {
    scenarioId: spec.fixtureId,
    fixtureId: spec.fixtureId,
    fixtureReport: {
      path: spec.reportPath,
      sha256: reportHash,
      generatedFromSha256: sha256Text(stableJson(embeddedGeneratedFrom)),
    },
    calculationTeamRecordId: spec.sourceTeamRecordId,
    sourceRotation: {
      recordId: spec.sourceRotationRecordId,
      rotationId: spec.sourceRotationId,
    },
    provenance: {
      sourceId: "kqm",
      sourceRecordId: manual.sourceRecordId,
      manualSnapshot: {
        path: spec.manualSnapshotPath,
        sha256: requiredGeneratedHash(generatedFrom, spec.manualSnapshotPath),
      },
      sourceRotationExtractionReviewStatus: "unreviewed",
      actionTranslationReviewStatus: "unreviewed",
    },
    readiness,
    sourceAuthoredFormulaPlan: false,
    supportsGuideClaims: false,
    supportsRecommendations: false,
    supportsRanking: false,
    supportsDamageClaims: false,
    supportsSourceValidation: false,
    validationDisposition: "withheld-from-guide-use",
    memberObservations,
  };
}

function validateReadiness(
  spec: FixtureSpec,
  report: Record<string, unknown>,
  authoredTranslation: Record<string, unknown>,
): DerivedFormulaFixtureScenario["readiness"] {
  const comparisons = requiredRecordArray(
    authoredTranslation.formulaComparisons,
    `${spec.fixtureId}.authoredTranslation.formulaComparisons`,
  );
  if (spec.readiness.state === "not-assessed") {
    if ("damageReplayReadiness" in report) {
      throw new Error(
        `Derived fixture ${spec.fixtureId} unexpectedly contains a readiness assessment.`,
      );
    }
    if (comparisons.some((comparison) => "sourceTokenCoverage" in comparison)) {
      throw new Error(
        `Derived fixture ${spec.fixtureId} unexpectedly records source token coverage.`,
      );
    }
    return {
      state: "not-assessed",
      readyForDamageReplay: null,
      blockerCount: null,
      sourceTokenCoverage: "not-recorded",
    };
  }

  const readiness = requiredRecord(
    report.damageReplayReadiness,
    `${spec.fixtureId}.damageReplayReadiness`,
  );
  requireFalse(
    readiness.supportsGuideClaims,
    `${spec.fixtureId} readiness supportsGuideClaims`,
  );
  requireFalse(
    readiness.readyForDamageReplay,
    `${spec.fixtureId} readyForDamageReplay`,
  );
  requireEqual(
    readiness.reviewStatus,
    "unreviewed",
    `${spec.fixtureId} readiness reviewStatus`,
  );
  const blockers = requiredArray(
    readiness.blockers,
    `${spec.fixtureId}.damageReplayReadiness.blockers`,
  );
  if (blockers.length !== spec.readiness.blockerCount) {
    throw new Error(
      `Derived fixture ${spec.fixtureId} expected ${spec.readiness.blockerCount} readiness blockers, found ${blockers.length}.`,
    );
  }
  const blockerCounts = countStringField(
    requiredRecordArray(
      blockers,
      `${spec.fixtureId}.damageReplayReadiness.blockers`,
    ),
    "code",
    `${spec.fixtureId} readiness blocker`,
  );
  const expectedBlockerCounts = {
    "partial-token-mapping": 1,
    "translation-unreviewed": 1,
    "unresolved-formula-mapping": 5,
    "unresolved-source-token": 1,
  };
  if (stableJson(blockerCounts) !== stableJson(expectedBlockerCounts)) {
    throw new Error(
      `Derived fixture ${spec.fixtureId} readiness blocker distribution drifted.`,
    );
  }
  validateReadinessCounts(spec.fixtureId, report, readiness, authoredTranslation);
  if (!comparisons.every((comparison) => "sourceTokenCoverage" in comparison)) {
    throw new Error(
      `Derived fixture ${spec.fixtureId} does not record token coverage for every formula comparison.`,
    );
  }
  return {
    state: "assessed-blocked",
    readyForDamageReplay: false,
    blockerCount: 8,
    sourceTokenCoverage: "recorded",
  };
}

function validateReadinessCounts(
  fixtureId: string,
  report: Record<string, unknown>,
  readiness: Record<string, unknown>,
  authoredTranslation: Record<string, unknown>,
): void {
  const positiveLines = requiredRecordArray(
    report.lines,
    `${fixtureId}.lines`,
  );
  const zeroLines = requiredRecordArray(
    report.zeroCountAvailableFormulas,
    `${fixtureId}.zeroCountAvailableFormulas`,
  );
  const positiveKeys = formulaCountKeys(positiveLines, false, `${fixtureId}.lines`);
  const zeroKeys = formulaCountKeys(
    zeroLines,
    true,
    `${fixtureId}.zeroCountAvailableFormulas`,
  );
  validateReadinessCoverageSection(
    requiredRecord(
      readiness.availableFormulaCoverage,
      `${fixtureId}.readiness.availableFormulaCoverage`,
    ),
    [...positiveKeys, ...zeroKeys],
    `${fixtureId} available formula coverage`,
  );
  validateReadinessCoverageSection(
    requiredRecord(
      readiness.positiveDefaultCoverage,
      `${fixtureId}.readiness.positiveDefaultCoverage`,
    ),
    positiveKeys,
    `${fixtureId} positive formula coverage`,
  );

  const comparisons = requiredRecordArray(
    authoredTranslation.formulaComparisons,
    `${fixtureId}.authoredTranslation.formulaComparisons`,
  );
  const unresolved = requiredRecordArray(
    authoredTranslation.unresolvedMappings,
    `${fixtureId}.authoredTranslation.unresolvedMappings`,
  );
  const sourceAbsent = requiredRecordArray(
    authoredTranslation.sourceAbsentMappings,
    `${fixtureId}.authoredTranslation.sourceAbsentMappings`,
  );
  const summary = requiredRecord(
    readiness.sourceMappingSummary,
    `${fixtureId}.readiness.sourceMappingSummary`,
  );
  const countClaimTypes = comparisons.map((comparison, index) => {
    const claim = requiredRecord(
      comparison.sourceCountClaim,
      `${fixtureId}.formulaComparisons[${index}].sourceCountClaim`,
    );
    return requiredString(
      claim.type,
      `${fixtureId}.formulaComparisons[${index}].sourceCountClaim.type`,
    );
  });
  const tokenCoverage = comparisons.map((comparison, index) =>
    requiredString(
      comparison.sourceTokenCoverage,
      `${fixtureId}.formulaComparisons[${index}].sourceTokenCoverage`,
    ),
  );
  const expected = {
    comparisons: comparisons.length,
    exactClaims: countClaimTypes.filter((value) => value === "exact").length,
    rangeClaims: countClaimTypes.filter((value) => value === "range").length,
    completeTokenMappings: tokenCoverage.filter((value) => value === "complete")
      .length,
    partialTokenMappings: tokenCoverage.filter((value) => value === "partial")
      .length,
    unresolvedMappings: unresolved.length,
    nonNullFormulaUnresolvedMappings: unresolved.filter(
      ({ calculatorFormulaId }) => calculatorFormulaId != null,
    ).length,
    nullFormulaUnresolvedMappings: unresolved.filter(
      ({ calculatorFormulaId }) => calculatorFormulaId == null,
    ).length,
    sourceAbsentMappings: sourceAbsent.length,
  };
  for (const [key, value] of Object.entries(expected)) {
    requireEqual(summary[key], value, `${fixtureId} sourceMappingSummary.${key}`);
  }
}

function validateReadinessCoverageSection(
  section: Record<string, unknown>,
  expectedFormulaCountKeys: readonly string[],
  label: string,
): void {
  const rows = requiredRecordArray(section.rows, `${label}.rows`);
  const actualKeys = formulaCountKeys(rows, false, `${label}.rows`);
  if (
    stableJson([...actualKeys].sort(compareText)) !==
    stableJson([...expectedFormulaCountKeys].sort(compareText))
  ) {
    throw new Error(`${label} rows do not reconstruct the fixture inventory.`);
  }
  const classifications = countStringField(
    rows,
    "classification",
    `${label} row classification`,
  );
  requireEqual(section.total, rows.length, `${label}.total`);
  for (const classification of [
    "mapped",
    "unresolved",
    "sourceAbsent",
    "unclassified",
  ] as const) {
    const rowKey = classification === "sourceAbsent" ? "source-absent" : classification;
    requireEqual(
      section[classification],
      classifications[rowKey] ?? 0,
      `${label}.${classification}`,
    );
  }
}

function formulaCountKeys(
  rows: readonly Record<string, unknown>[],
  defaultZero: boolean,
  label: string,
): string[] {
  const keys = rows.map((row, index) => {
    const characterId = requiredString(
      row.characterId,
      `${label}[${index}].characterId`,
    );
    const formulaId = requiredString(
      row.formulaId,
      `${label}[${index}].formulaId`,
    );
    const count = row.calculatorDefaultCount ?? row.count ?? (defaultZero ? 0 : null);
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
      throw new Error(`${label}[${index}] has an invalid formula count.`);
    }
    return `${characterId}\0${formulaId}\0${count}`;
  });
  assertUnique(keys, `${label} formula-count keys`);
  return keys;
}

function countStringField(
  rows: readonly Record<string, unknown>[],
  field: string,
  label: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [index, row] of rows.entries()) {
    const value = requiredString(row[field], `${label}[${index}]`);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function assertNoClaimFlagDrift(value: unknown, label: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoClaimFlagDrift(entry, `${label}[${index}]`),
    );
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  for (const [key, nested] of Object.entries(record)) {
    if (
      key === "promotionEligible" ||
      key === "supportsGuideClaims" ||
      key === "supportsRecommendations" ||
      key === "supportsRanking" ||
      key === "supportsDamageClaims" ||
      key === "supportsSourceValidation"
    ) {
      requireFalse(nested, `${label}.${key}`);
    }
    assertNoClaimFlagDrift(nested, `${label}.${key}`);
  }
}

function authenticateManualRecord(input: {
  spec: FixtureSpec;
  snapshot: ReturnType<typeof ManualObservationSnapshotSchema.parse>;
  sourceRotationTeam: KnowledgeTeam;
  sourceRotation: NonNullable<KnowledgeTeam["rotations"]>[number];
  sourceRegistry: ReturnType<typeof SourceRegistrySchema.parse>;
}) {
  const { spec, snapshot, sourceRotationTeam, sourceRotation } = input;
  const sourceRef = sourceRotationTeam.sourceRefs.find(
    ({ sourceId }) => sourceId === "kqm",
  );
  if (!sourceRef) {
    throw new Error(
      `Derived fixture ${spec.fixtureId} source rotation lacks KQM provenance.`,
    );
  }
  const kqmSources = input.sourceRegistry.sources.filter(({ id }) => id === "kqm");
  if (
    kqmSources.length !== 1 ||
    kqmSources[0]?.ingestionMode !== "manual-observation" ||
    kqmSources[0]?.recordFormat !== "manual-observation-v1"
  ) {
    throw new Error(
      "Derived fixture coverage requires exactly one compatible KQM manual source manifest.",
    );
  }
  requireEqual(snapshot.sourceId, "kqm", `${spec.fixtureId} manual sourceId`);
  const manualMatches = snapshot.records.filter(
    ({ sourceRecordId }) => sourceRecordId === sourceRef.sourceRecordId,
  );
  if (manualMatches.length !== 1 || manualMatches[0]?.kind !== "team") {
    throw new Error(
      `Derived fixture ${spec.fixtureId} requires exactly one matching manual team record.`,
    );
  }
  const manual = manualMatches[0];
  requireStableEqual(
    manual.locator,
    sourceRef.locator,
    `${spec.fixtureId} manual/repository source locator`,
  );
  requireEqual(
    manual.extraction.method,
    "agent-assisted",
    `${spec.fixtureId} source rotation extraction method`,
  );
  requireEqual(
    manual.extraction.reviewStatus,
    "unreviewed",
    `${spec.fixtureId} source rotation extraction reviewStatus`,
  );
  assertSameStringSet(
    manual.members.map(({ characterId }) => characterId),
    sourceRotationTeam.members.map(({ characterId }) => characterId),
    `${spec.fixtureId} manual roster`,
  );
  const manualRotations = manual.rotations ?? [];
  const manualRotation = manualRotations.filter(
    ({ id }) => id === spec.sourceRotationId,
  );
  if (manualRotation.length !== 1) {
    throw new Error(
      `Derived fixture ${spec.fixtureId} requires one matching manual source rotation.`,
    );
  }
  requireStableEqual(
    manualRotation[0],
    sourceRotation,
    `${spec.fixtureId} manual/repository source rotation`,
  );
  return manual;
}

function authenticateManualSnapshots(
  inputs: readonly DerivedFormulaFixtureManualInput[],
  index: ReturnType<typeof ManualSnapshotIndexSchema.parse>,
  sourceFiles: ReadonlyMap<string, string>,
) {
  const expectedPaths = FIXTURE_SPECS.map(({ manualSnapshotPath }) =>
    manualSnapshotPath,
  );
  assertExactPathSet(
    inputs.map(({ path }) => path),
    expectedPaths,
    "derived fixture manual snapshot inputs",
  );
  const result = new Map<
    string,
    ReturnType<typeof ManualObservationSnapshotSchema.parse>
  >();
  for (const input of inputs) {
    const indexMatches = index.snapshots.filter(
      ({ sourceId, path }) => sourceId === "kqm" && path === input.path,
    );
    if (indexMatches.length !== 1) {
      throw new Error(
        `Derived fixture manual snapshot ${input.path} is not uniquely indexed for KQM.`,
      );
    }
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshotInput);
    authenticateJsonInput(snapshot, input.path, sourceFiles);
    result.set(input.path, snapshot);
  }
  return result;
}

function authenticateRoster(
  releasedCharacterIds: readonly string[],
  rosterReportInput: unknown,
  sourceFiles: ReadonlyMap<string, string>,
): void {
  const ids = normalizeReleasedCharacterIds(releasedCharacterIds);
  if (
    ids.length !== EXPECTED_RELEASED_CHARACTER_COUNT ||
    sha256Text(stableJson(ids)) !== EXPECTED_RELEASED_CHARACTER_IDS_SHA256
  ) {
    throw new Error(
      "Derived formula fixture coverage released-character roster drifted.",
    );
  }
  const roster = requiredRecord(rosterReportInput, "checked-in roster report");
  authenticateJsonInput(roster, ROSTER_REPORT_PATH, sourceFiles);
  requireEqual(roster.comparisonStatus, "comparable", "roster comparisonStatus");
  const domain = requiredRecord(roster.domain, "roster.domain");
  const boundary = requiredRecord(
    domain.catalogBoundary,
    "roster.domain.catalogBoundary",
  );
  requireEqual(
    boundary.characterCount,
    EXPECTED_RELEASED_CHARACTER_COUNT,
    "roster characterCount",
  );
  requireEqual(
    boundary.characterIdsSha256,
    EXPECTED_RELEASED_CHARACTER_IDS_SHA256,
    "roster characterIdsSha256",
  );
}

function normalizeReleasedCharacterIds(ids: readonly string[]): string[] {
  const normalized = ids
    .filter((characterId) => !/^(?:manekin|manekina)_/.test(characterId))
    .map((characterId, index) =>
      requiredString(characterId, `releasedCharacterIds[${index}]`),
    )
    .sort(compareText);
  assertUnique(normalized, "released character IDs");
  return normalized;
}

function validateGeneratedFrom(
  input: readonly { path: string; sha256: string }[],
): Array<{ path: string; sha256: string }> {
  const generatedFrom = parseGeneratedFrom(input, "coverage.generatedFrom").sort(
    (left, right) => compareText(left.path, right.path),
  );
  assertExactPathSet(
    generatedFrom.map(({ path }) => path),
    DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS,
    "coverage.generatedFrom",
  );
  return generatedFrom;
}

function validateFixtureInputSet(
  inputs: readonly DerivedFormulaFixtureReportInput[],
): Map<string, unknown> {
  assertExactPathSet(
    inputs.map(({ path }) => path),
    DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
    "derived fixture report inputs",
  );
  return new Map(inputs.map(({ path, reportInput }) => [path, reportInput]));
}

function authenticateSourceFiles(
  inputs: readonly DerivedFormulaFixtureSourceFile[],
  generatedFrom: readonly { path: string; sha256: string }[],
): ReadonlyMap<string, string> {
  assertExactPathSet(
    inputs.map(({ path }) => path),
    DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS,
    "derived fixture JSON source files",
  );
  const result = new Map<string, string>();
  for (const input of inputs) {
    if (sha256Text(input.text) !== requiredGeneratedHash(generatedFrom, input.path)) {
      throw new Error(
        `Derived fixture source bytes do not match generatedFrom for ${input.path}.`,
      );
    }
    try {
      JSON.parse(input.text);
    } catch {
      throw new Error(`Derived fixture source file ${input.path} is not JSON.`);
    }
    result.set(input.path, input.text);
  }
  return result;
}

function parseGeneratedFrom(
  input: unknown,
  label: string,
): Array<{ path: string; sha256: string }> {
  return requiredRecordArray(input, label).map((entry, index) => ({
    path: requiredString(entry.path, `${label}[${index}].path`),
    sha256: requiredSha256(entry.sha256, `${label}[${index}].sha256`),
  }));
}

function authenticateJsonInput(
  input: unknown,
  relativePath: string,
  sourceFiles: ReadonlyMap<string, string>,
): void {
  const text = sourceFiles.get(relativePath);
  if (text == null) {
    throw new Error(`Derived fixture coverage is missing source bytes for ${relativePath}.`);
  }
  if (stableJson(input) !== stableJson(JSON.parse(text))) {
    throw new Error(
      `Derived fixture coverage input object does not match current bytes for ${relativePath}.`,
    );
  }
}

function requiredGeneratedHash(
  generatedFrom: readonly { path: string; sha256: string }[],
  relativePath: string,
): string {
  const matches = generatedFrom.filter(({ path }) => path === relativePath);
  if (matches.length !== 1) {
    throw new Error(
      `Derived fixture coverage expected one generatedFrom entry for ${relativePath}, found ${matches.length}.`,
    );
  }
  return matches[0]?.sha256 ?? "";
}

function requiredTeam(
  records: readonly KnowledgeRecord[],
  recordId: string,
): KnowledgeTeam {
  const matches = records.filter(({ id }) => id === recordId);
  if (matches.length !== 1 || matches[0]?.kind !== "team") {
    throw new Error(`Expected exactly one source team ${recordId}.`);
  }
  return matches[0];
}

function requiredRotation(team: KnowledgeTeam, rotationId: string) {
  const matches = (team.rotations ?? []).filter(({ id }) => id === rotationId);
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one source rotation ${team.id}:${rotationId}.`,
    );
  }
  return matches[0];
}

function requireNoSourceAuthoredDamagePlan(team: KnowledgeTeam): void {
  if (team.damagePlans.length !== 0) {
    throw new Error(
      `Source team ${team.id} now contains a source-authored formula plan; this derived-only adapter must be reviewed.`,
    );
  }
}

function requireConstellationUnspecified(
  member: KnowledgeTeam["members"][number],
  fixtureId: string,
  sourceKind: string,
): void {
  if (member.investment.status !== "unspecified") {
    throw new Error(
      `Derived fixture ${fixtureId} has a source-constellation conflict: ${sourceKind} member ${member.characterId} is no longer constellation-unspecified.`,
    );
  }
}

function assertFormulaReferencesAreMembers(
  report: Record<string, unknown>,
  memberIds: readonly string[],
  fixtureId: string,
): void {
  const memberSet = new Set(memberIds);
  const authored = requiredRecord(
    report.authoredTranslation,
    `${fixtureId}.authoredTranslation`,
  );
  const arrays: Array<[string, unknown]> = [
    ["lines", report.lines],
    ["zeroCountAvailableFormulas", report.zeroCountAvailableFormulas],
    ["authoredTranslation.actionCounts", authored.actionCounts],
    ["authoredTranslation.formulaComparisons", authored.formulaComparisons],
    ["authoredTranslation.unresolvedMappings", authored.unresolvedMappings],
  ];
  for (const key of ["mismatches", "discrepancies", "sourceAbsentMappings"]) {
    if (key in authored) arrays.push([`authoredTranslation.${key}`, authored[key]]);
  }
  const readiness = report.damageReplayReadiness;
  if (readiness != null) {
    const readinessRecord = requiredRecord(readiness, `${fixtureId}.readiness`);
    for (const sectionName of [
      "availableFormulaCoverage",
      "positiveDefaultCoverage",
    ]) {
      const section = requiredRecord(
        readinessRecord[sectionName],
        `${fixtureId}.readiness.${sectionName}`,
      );
      arrays.push([`${sectionName}.rows`, section.rows]);
    }
  }
  for (const [label, value] of arrays) {
    for (const [index, row] of requiredRecordArray(value, `${fixtureId}.${label}`).entries()) {
      const characterId = requiredString(
        row.characterId,
        `${fixtureId}.${label}[${index}].characterId`,
      );
      if (!memberSet.has(characterId)) {
        throw new Error(
          `Derived fixture ${fixtureId} ${label} references formula nonmember ${characterId}.`,
        );
      }
    }
  }
}

function formulaIdsForCharacter(
  lines: readonly Record<string, unknown>[],
  characterId: string,
  label: string,
): string[] {
  return lines
    .filter((line) => line.characterId === characterId)
    .map((line, index) =>
      requiredString(line.formulaId, `${label}[${index}].formulaId`),
    );
}

function validateFormulaInventoryRows(
  positiveLines: readonly Record<string, unknown>[],
  zeroLines: readonly Record<string, unknown>[],
  fixtureId: string,
): void {
  for (const [index, line] of positiveLines.entries()) {
    if (
      typeof line.count !== "number" ||
      !Number.isFinite(line.count) ||
      line.count <= 0
    ) {
      throw new Error(
        `Derived fixture ${fixtureId} positive formula row ${index} must have a finite positive count.`,
      );
    }
  }
  for (const [index, line] of zeroLines.entries()) {
    if ("count" in line) {
      throw new Error(
        `Derived fixture ${fixtureId} zero-default formula row ${index} must not carry a count field.`,
      );
    }
  }
}

function validateScenarioObservationIds(
  scenarios: readonly DerivedFormulaFixtureScenario[],
): void {
  assertUnique(
    scenarios.map(({ scenarioId }) => scenarioId),
    "derived fixture scenario IDs",
  );
  assertUnique(
    scenarios.map(({ fixtureId }) => fixtureId),
    "derived fixture IDs",
  );
  const observationIds: string[] = [];
  for (const scenario of scenarios) {
    assertUnique(
      scenario.memberObservations.map(({ characterId }) => characterId),
      `${scenario.scenarioId} member IDs`,
    );
    for (const observation of scenario.memberObservations) {
      if (observation.scenarioId !== scenario.scenarioId) {
        throw new Error(
          `Derived fixture ${scenario.scenarioId} has overlapping scenario/member identity ${observation.observationId}.`,
        );
      }
      observationIds.push(observation.observationId);
    }
  }
  assertUnique(observationIds, "derived fixture scenario/member observation IDs");
}

function assertExactPathSet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  assertUnique(actual, `${label} paths`);
  const left = [...actual].sort(compareText);
  const right = [...expected].sort(compareText);
  if (stableJson(left) !== stableJson(right)) {
    throw new Error(`${label} does not match the complete expected input set.`);
  }
}

function assertSameStringSet(
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  assertUnique(actual, `${label} actual values`);
  assertUnique(expected, `${label} expected values`);
  if (
    stableJson([...actual].sort(compareText)) !==
    stableJson([...expected].sort(compareText))
  ) {
    throw new Error(`${label} no longer matches.`);
  }
}

function assertUnique(values: readonly string[], label: string): void {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index,
  );
  if (duplicates.length > 0) {
    throw new Error(`${label} repeat ${[...new Set(duplicates)].join(", ")}.`);
  }
}

function requiredMapValue<K, V>(
  values: ReadonlyMap<K, V>,
  key: K,
  label: string,
): V {
  const value = values.get(key);
  if (value === undefined) {
    throw new Error(`Derived fixture coverage is missing ${label} ${String(key)}.`);
  }
  return value;
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requiredRecordArray(
  value: unknown,
  label: string,
): Record<string, unknown>[] {
  return requiredArray(value, label).map((entry, index) =>
    requiredRecord(entry, `${label}[${index}]`),
  );
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function requiredSha256(value: unknown, label: string): string {
  const parsed = requiredString(value, label);
  if (!/^[a-f0-9]{64}$/.test(parsed)) {
    throw new Error(`${label} must be a lowercase SHA-256 hash.`);
  }
  return parsed;
}

function requireFalse(value: unknown, label: string): void {
  requireEqual(value, false, label);
}

function requireEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} must be ${String(expected)}.`);
  }
}

function requireStableEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} no longer matches.`);
  }
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}
