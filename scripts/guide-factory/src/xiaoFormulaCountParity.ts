import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareSourceTranslatedFormulaPlan,
  draftCalculatorDefaultFormulaPlan,
  type FormulaPlanCountComparison,
  type FormulaPlanDraftOutput,
  type SourceTranslatedFormulaPlanLine,
} from "./formulaPlanDraft";
import { sha256Text, stableJson } from "./io";
import {
  GenshinToolsPresetSnapshotSchema,
  KnowledgeRepositorySchema,
  type ManualObservationSnapshot,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "./schemas";
import type { ScopedSemanticDependencyAcceptedAudit } from "./scopedSemanticDependency";
import {
  requireXiaoFormulaCountParityScope,
  XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
  XIAO_FORMULA_COUNT_PARITY_SCOPE_EXPECTATION,
  XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID,
  XIAO_FORMULA_COUNT_SOURCE_RECORD_ID,
} from "./xiaoFormulaCountParityScope";

const FACTORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const FIXTURE_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";
const PRESET_SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const MANUAL_INDEX_PATH =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const SOURCE_REGISTRY_PATH = "scripts/guide-factory/sources/registry.json";
const XIAO_PAGE_URL = "https://keqingmains.com/xiao/";
const WITNESS_ID = "kqm-xiao-eeq12hp-formula-count-parity-version-5-5";
const XIAO_FIXTURE_DOCUMENT_METADATA = {
  schemaVersion: 1,
  sourceId: "kqm",
  capturedAt: "2026-08-30",
  page: {
    title: "Xiao Guide: Adeptal Guide to Conquering Xiao",
    url: XIAO_PAGE_URL,
    publisher: "KeqingMains",
    sourceVersion: "Version 5.5",
    attributionNote:
      "KQM asks readers to link the original guide when using it as a content reference; this snapshot stores one narrow source-authored comparison fixture and its source locator.",
  },
} as const;

const CONTAINER_PATHS = [
  REPOSITORY_PATH,
  FIXTURE_SNAPSHOT_PATH,
  PRESET_SNAPSHOT_PATH,
  MANUAL_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
] as const;

export const XIAO_FORMULA_COUNT_PARITY_CODE_PATHS = [
  "scripts/guide-factory/src/assemble-xiao-formula-count-parity.ts",
  "scripts/guide-factory/src/computationReplay.ts",
  "scripts/guide-factory/src/formulaPlanDraft.ts",
  "scripts/guide-factory/src/io.ts",
  "scripts/guide-factory/src/schemas.ts",
  "scripts/guide-factory/src/scopedSemanticDependency.ts",
  "scripts/guide-factory/src/teamMemberInvestment.ts",
  "scripts/guide-factory/src/xiaoFormulaCountParity.ts",
  "scripts/guide-factory/src/xiaoFormulaCountParityScope.ts",
  "src/data/game/character_stats.json",
  "src/data/game/weapon_stats.json",
  "src/data/gameStatsLoader.ts",
  "src/data/resources.ts",
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
  "src/lib/dmgcalc/impl/character4Sumeru.ts",
  "src/lib/dmgcalc/impl/character5Fontaine.ts",
  "src/lib/dmgcalc/impl/character5Liyue.ts",
  "src/lib/dmgcalc/impl/weapon4Bow.ts",
  "src/lib/dmgcalc/impl/weapon5Catalyst.ts",
  "src/lib/dmgcalc/impl/weapon5Polearm.ts",
  "src/lib/dmgcalc/impl/weapon5Sword.ts",
  "src/lib/dmgcalc/index.ts",
] as const;

export const XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS = [
  ...CONTAINER_PATHS,
  ...XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
].sort(compareText);

export const XIAO_FORMULA_COUNT_PARITY_REPORT_PATH = path.join(
  FACTORY_ROOT,
  "reports",
  "xiao-formula-count-parity.json",
);

const C0_R1_LEVEL_90_10_10_10 = {
  charLevel: 90,
  constellation: 0,
  refinement: 1,
  talentLevels: { auto: 10, skill: 10, burst: 10 },
} as const;

const TOKEN_ALIASES = [
  {
    sourceToken: "E",
    sourceLabel: "Elemental Skill",
    formulaId: "xiao-skill",
    mappingBasis:
      "Guide Factory maps the source token E, labeled Elemental Skill in the captured fixture, to the existing calculator formula id xiao-skill for this count-only witness.",
  },
  {
    sourceToken: "HP",
    sourceLabel: "High Plunge",
    formulaId: "xiao-plunge-high",
    mappingBasis:
      "Guide Factory maps the source token HP, labeled High Plunge in the captured fixture, to the existing calculator formula id xiao-plunge-high for this count-only witness.",
  },
] as const;

const CAPABILITY_BOUNDARY = {
  supportsSourceAuthorization: false,
  supportsSourceValidation: false,
  supportsGuideClaims: false,
  supportsTeamRecommendations: false,
  supportsBuildRecommendations: false,
  supportsEquipmentRecommendations: false,
  supportsStatRecommendations: false,
  supportsRankClaims: false,
  supportsRotationClaims: false,
  supportsDamageClaims: false,
  supportsEnergyRecoveryClaims: false,
  playerFacingRecommendations: false,
  sourceFormulaIdsAuthored: false,
  sourceTokenAliasesAuthoredByGuideFactory: true,
  sourceTokenAliasesHumanReviewed: false,
  calculatorDefaultDraftExecuted: true,
  formulaAvailabilityValidated: true,
  formulaCountComparisonExecuted: true,
  formulaDamageEvaluationExecuted: false,
  damageComputationExecuted: false,
  optimizerExecuted: false,
  generatorExecuted: false,
  recommendationCompositionExecuted: false,
  rotationOptimizationExecuted: false,
  energyRecoveryInputsUsed: false,
  energyRecoveryComputationExecuted: false,
  assembledBuildCount: 0,
  generatedTeamCount: 0,
} as const;

const CAUTIONS = [
  "The two token aliases are Guide Factory-authored and unreviewed; count parity does not prove that source and calculator formula semantics are identical.",
  "The source fixture is an agent-assisted, unreviewed observation and deliberately omits the chart's damage values and several combat assumptions.",
  "The calculator side is its current comboDescriptor default under a local C0/R1/level-90/10-10-10 fixture, not source-reviewed rotation truth.",
  "The 12-versus-11 High Plunge discrepancy is a validation target for later adjudication, not evidence that either side is correct.",
  "The baseline FFXX team supplies only runnable equipment; its roster, equipment, and local investment assumptions are not attributed to the Xiao source fixture.",
] as const;

const PROHIBITED_INTERPRETATIONS = [
  "Do not interpret this report as a Xiao guide, optimal rotation, damage comparison, weapon ranking, artifact recommendation, stat recommendation, or team recommendation.",
  "Do not change the published calculator default or the captured source count solely because this witness finds a mismatch.",
  "Do not infer buff timing, field time, hit feasibility, enemy assumptions, damage per rotation, DPS, ideal rolls, or Energy Recharge requirements.",
  "Do not infer that the source authored calculator formula ids or the C0 baseline-team investment assumptions.",
] as const;

export interface XiaoFormulaCountParitySourceFile {
  path: string;
  text: string;
}

export interface BuildXiaoFormulaCountParityInput {
  repositoryInput: unknown;
  manualFixtureSnapshotInput: unknown;
  genshinToolsSnapshotInput: unknown;
  manualIndexInput: unknown;
  sourceRegistryInput: unknown;
  sourceFiles: readonly XiaoFormulaCountParitySourceFile[];
  generatedFrom: readonly { path: string; sha256: string }[];
}

export interface XiaoFormulaCountParityReport {
  schemaVersion: 1;
  reportType: "xiao-formula-count-parity-witness";
  witnessId: typeof WITNESS_ID;
  classification: "authenticated-unreviewed-formula-count-parity-witness";
  comparisonStatus: "comparable";
  publicationStatus: "withheld-unreviewed-alias-and-calculator-default";
  generatedFrom: Array<{ path: string; sha256: string }>;
  semanticScope: ScopedSemanticDependencyAcceptedAudit;
  rawInputBoundary: {
    status: "accepted";
    exactSourceFilePathClosure: true;
    parsedContainerByteClosure: true;
    snapshotDocumentMetadataAuthenticated: true;
    declaredGeneratedFromHashClosure: true;
    transitiveRuntimeCodeHashClosure: false;
    broadContainerHashesEmbeddedInGeneratedFrom: false;
    wholeContainerSchemaValidationExecuted: true;
    unrelatedSchemaValidContainerRecordsAffectSemanticProjection: false;
    unrelatedContainerRecordsMayAffectValidation: true;
    sourceFileCount: number;
    generatedCodeFileCount: number;
  };
  sourceBoundary: {
    sourceId: "kqm";
    sourceRecordId: typeof XIAO_FORMULA_COUNT_SOURCE_RECORD_ID;
    repositoryRecordId: typeof XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID;
    pageUrl: typeof XIAO_PAGE_URL;
    sourceVersion: "Version 5.5";
    extractionMethod: "agent-assisted";
    reviewStatus: "unreviewed";
    repositoryStatus: "candidate";
    promotionEligible: false;
    sourceFormulaIdsAuthored: false;
    rotation: {
      id: "no-buff-eeq12hp";
      label: string;
      notation: "EEQ12HP";
      unresolvedSegments: string[];
      assumptions: string[];
    };
    formulaCounts: Array<{
      sourceToken: string;
      label: string;
      count: number;
    }>;
  };
  baselineComputationBoundary: {
    sourceId: "genshintools-presets";
    teamRecordId: typeof XIAO_FORMULA_COUNT_BASELINE_TEAM_ID;
    roster: ["xiao", "xianyun", "furina", "faruzan"];
    equipmentPurpose: "calculator-runnability-not-source-fixture-evidence";
    teamInvestmentStatus: "unspecified";
    localInvestmentAssumption: typeof C0_R1_LEVEL_90_10_10_10;
    sourceFixtureSuppliedTeam: false;
    sourceFixtureSuppliedEquipment: false;
    sourceFixtureSuppliedConstellation: false;
  };
  aliasBoundary: {
    ownership: "guide-factory";
    reviewStatus: "unreviewed";
    exactSourceTokenCoverage: true;
    sourceAuthoredCalculatorFormulaIds: false;
    aliases: Array<{
      sourceToken: string;
      sourceLabel: string;
      formulaId: string;
      mappingBasis: string;
    }>;
  };
  calculatorDefaultDraft: FormulaPlanDraftOutput;
  translatedFormulaCounts: SourceTranslatedFormulaPlanLine[];
  comparison: {
    formulaComparisons: FormulaPlanCountComparison[];
    mismatches: FormulaPlanCountComparison[];
  };
  summary: {
    sourceFormulaCountRowCount: 2;
    translatedFormulaCountRowCount: 2;
    matchedCount: 1;
    mismatchCount: 1;
    sourceTranslationHigherCount: 1;
    calculatorDefaultHigherCount: 0;
    damageFormulaEvaluationCount: 0;
    damageComputationCount: 0;
    energyRecoveryComputationCount: 0;
  };
  issues: [];
  cautions: string[];
  prohibitedInterpretations: string[];
  supportsSourceAuthorization: false;
  supportsSourceValidation: false;
  supportsGuideClaims: false;
  supportsTeamRecommendations: false;
  supportsBuildRecommendations: false;
  supportsEquipmentRecommendations: false;
  supportsStatRecommendations: false;
  supportsRankClaims: false;
  supportsRotationClaims: false;
  supportsDamageClaims: false;
  supportsEnergyRecoveryClaims: false;
  playerFacingRecommendations: false;
  sourceFormulaIdsAuthored: false;
  sourceTokenAliasesAuthoredByGuideFactory: true;
  sourceTokenAliasesHumanReviewed: false;
  calculatorDefaultDraftExecuted: true;
  formulaAvailabilityValidated: true;
  formulaCountComparisonExecuted: true;
  formulaDamageEvaluationExecuted: false;
  damageComputationExecuted: false;
  optimizerExecuted: false;
  generatorExecuted: false;
  recommendationCompositionExecuted: false;
  rotationOptimizationExecuted: false;
  energyRecoveryInputsUsed: false;
  energyRecoveryComputationExecuted: false;
  assembledBuildCount: 0;
  generatedTeamCount: 0;
}

export type XiaoFormulaCountParityAuthentication =
  | { authenticated: true; canonicalReport: XiaoFormulaCountParityReport }
  | {
      authenticated: false;
      reason: "canonical-inputs-not-comparable" | "serialized-report-mismatch";
      issues: Array<{ code: string; path: string; message: string }>;
    };

export async function buildXiaoFormulaCountParityReport(
  input: BuildXiaoFormulaCountParityInput,
): Promise<XiaoFormulaCountParityReport> {
  const authenticatedFiles = authenticateRawInputs(input);
  const repository = KnowledgeRepositorySchema.parse(input.repositoryInput);
  const manualFixtureSnapshot = ManualObservationSnapshotSchema.parse(
    input.manualFixtureSnapshotInput,
  );
  const genshinToolsSnapshot = GenshinToolsPresetSnapshotSchema.parse(
    input.genshinToolsSnapshotInput,
  );
  const manualIndex = ManualSnapshotIndexSchema.parse(input.manualIndexInput);
  const sourceRegistry = SourceRegistrySchema.parse(input.sourceRegistryInput);
  authenticateParsedContainer(
    repository,
    authenticatedFiles.get(REPOSITORY_PATH),
    REPOSITORY_PATH,
  );
  authenticateParsedContainer(
    manualFixtureSnapshot,
    authenticatedFiles.get(FIXTURE_SNAPSHOT_PATH),
    FIXTURE_SNAPSHOT_PATH,
  );
  authenticateParsedContainer(
    genshinToolsSnapshot,
    authenticatedFiles.get(PRESET_SNAPSHOT_PATH),
    PRESET_SNAPSHOT_PATH,
  );
  authenticateParsedContainer(
    manualIndex,
    authenticatedFiles.get(MANUAL_INDEX_PATH),
    MANUAL_INDEX_PATH,
  );
  authenticateParsedContainer(
    sourceRegistry,
    authenticatedFiles.get(SOURCE_REGISTRY_PATH),
    SOURCE_REGISTRY_PATH,
  );
  authenticateFixtureDocumentMetadata(manualFixtureSnapshot);

  const scope = requireXiaoFormulaCountParityScope({
    repository,
    manualFixtureSnapshot,
    genshinToolsSnapshot,
    manualIndex,
    sourceRegistry,
  });
  authenticateSourceAndBaseline(scope);

  const assumptions = Object.fromEntries(
    scope.baselineTeam.members.map(({ characterId }) => [
      characterId,
      structuredClone(C0_R1_LEVEL_90_10_10_10),
    ]),
  );
  const calculatorDefaultDraft = await draftCalculatorDefaultFormulaPlan({
    team: scope.baselineTeam,
    assumptions,
  });
  const translatedFormulaCounts = TOKEN_ALIASES.map((alias) => {
    const sourceCount = scope.rawFixture.formulaCounts.find(
      ({ sourceToken }) => sourceToken === alias.sourceToken,
    );
    if (!sourceCount || sourceCount.label !== alias.sourceLabel) {
      throw new Error(
        `Xiao source token ${alias.sourceToken} no longer has the pinned label.`,
      );
    }
    return {
      characterId: "xiao",
      formulaId: alias.formulaId,
      count: sourceCount.count,
      mappingBasis: alias.mappingBasis,
    };
  });
  const comparison = compareSourceTranslatedFormulaPlan(
    calculatorDefaultDraft,
    translatedFormulaCounts,
  );
  authenticateExpectedComparison(comparison);

  return {
    schemaVersion: 1,
    reportType: "xiao-formula-count-parity-witness",
    witnessId: WITNESS_ID,
    classification: "authenticated-unreviewed-formula-count-parity-witness",
    comparisonStatus: "comparable",
    publicationStatus: "withheld-unreviewed-alias-and-calculator-default",
    ...CAPABILITY_BOUNDARY,
    generatedFrom: canonicalGeneratedFrom(input.generatedFrom),
    semanticScope: structuredClone(scope.audit),
    rawInputBoundary: {
      status: "accepted",
      exactSourceFilePathClosure: true,
      parsedContainerByteClosure: true,
      snapshotDocumentMetadataAuthenticated: true,
      declaredGeneratedFromHashClosure: true,
      transitiveRuntimeCodeHashClosure: false,
      broadContainerHashesEmbeddedInGeneratedFrom: false,
      wholeContainerSchemaValidationExecuted: true,
      unrelatedSchemaValidContainerRecordsAffectSemanticProjection: false,
      unrelatedContainerRecordsMayAffectValidation: true,
      sourceFileCount: XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS.length,
      generatedCodeFileCount: XIAO_FORMULA_COUNT_PARITY_CODE_PATHS.length,
    },
    sourceBoundary: {
      sourceId: "kqm",
      sourceRecordId: XIAO_FORMULA_COUNT_SOURCE_RECORD_ID,
      repositoryRecordId: XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID,
      pageUrl: XIAO_PAGE_URL,
      sourceVersion: "Version 5.5",
      extractionMethod: "agent-assisted",
      reviewStatus: "unreviewed",
      repositoryStatus: "candidate",
      promotionEligible: false,
      sourceFormulaIdsAuthored: false,
      rotation: structuredClone(scope.rawFixture.rotation) as XiaoFormulaCountParityReport["sourceBoundary"]["rotation"],
      formulaCounts: scope.rawFixture.formulaCounts.map(
        ({ sourceToken, label, count }) => ({ sourceToken, label, count }),
      ),
    },
    baselineComputationBoundary: {
      sourceId: "genshintools-presets",
      teamRecordId: XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
      roster: ["xiao", "xianyun", "furina", "faruzan"],
      equipmentPurpose: "calculator-runnability-not-source-fixture-evidence",
      teamInvestmentStatus: "unspecified",
      localInvestmentAssumption: structuredClone(C0_R1_LEVEL_90_10_10_10),
      sourceFixtureSuppliedTeam: false,
      sourceFixtureSuppliedEquipment: false,
      sourceFixtureSuppliedConstellation: false,
    },
    aliasBoundary: {
      ownership: "guide-factory",
      reviewStatus: "unreviewed",
      exactSourceTokenCoverage: true,
      sourceAuthoredCalculatorFormulaIds: false,
      aliases: TOKEN_ALIASES.map((alias) => ({ ...alias })),
    },
    calculatorDefaultDraft,
    translatedFormulaCounts,
    comparison,
    summary: {
      sourceFormulaCountRowCount: 2,
      translatedFormulaCountRowCount: 2,
      matchedCount: 1,
      mismatchCount: 1,
      sourceTranslationHigherCount: 1,
      calculatorDefaultHigherCount: 0,
      damageFormulaEvaluationCount: 0,
      damageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    },
    issues: [],
    cautions: [...CAUTIONS],
    prohibitedInterpretations: [...PROHIBITED_INTERPRETATIONS],
  };
}

export async function authenticateXiaoFormulaCountParityReport(
  serializedReport: XiaoFormulaCountParityReport,
  input: BuildXiaoFormulaCountParityInput,
): Promise<XiaoFormulaCountParityAuthentication> {
  try {
    const canonicalReport = await buildXiaoFormulaCountParityReport(input);
    if (stableJson(serializedReport) !== stableJson(canonicalReport)) {
      return {
        authenticated: false,
        reason: "serialized-report-mismatch",
        issues: [
          {
            code: "xiao-formula-count.serialized-report-mismatch",
            path: "serializedReport",
            message:
              "Serialized Xiao formula-count witness does not match a fresh canonical rebuild from current scoped inputs and calculator defaults.",
          },
        ],
      };
    }
    return { authenticated: true, canonicalReport };
  } catch (error) {
    return {
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
      issues: [
        {
          code: "xiao-formula-count.canonical-inputs-not-comparable",
          path: "input",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

export async function requireComparableXiaoFormulaCountParityReport(
  report: XiaoFormulaCountParityReport,
  input: BuildXiaoFormulaCountParityInput,
): Promise<void> {
  const authentication = await authenticateXiaoFormulaCountParityReport(
    report,
    input,
  );
  if (authentication.authenticated) return;
  throw new Error(
    `Refusing an unauthenticated Xiao formula-count witness (${authentication.reason}): ${authentication.issues
      .map(({ code, message }) => `${code}: ${message}`)
      .join("; ")}`,
  );
}

function authenticateRawInputs(
  input: BuildXiaoFormulaCountParityInput,
): Map<string, string> {
  const expectedSourcePaths = XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS;
  const actualSourcePaths = input.sourceFiles.map(({ path: entryPath }) =>
    normalizePath(entryPath),
  );
  if (
    stableJson(actualSourcePaths) !== stableJson(expectedSourcePaths) ||
    new Set(actualSourcePaths).size !== actualSourcePaths.length
  ) {
    throw new Error("Xiao formula-count source-file exact path closure drifted.");
  }
  const expectedGeneratedPaths = [...XIAO_FORMULA_COUNT_PARITY_CODE_PATHS].sort(
    compareText,
  );
  const generatedFrom = canonicalGeneratedFrom(input.generatedFrom);
  if (
    stableJson(generatedFrom.map(({ path: entryPath }) => entryPath)) !==
    stableJson(expectedGeneratedPaths)
  ) {
    throw new Error("Xiao formula-count generatedFrom path closure drifted.");
  }

  const generatedHashByPath = new Map(
    generatedFrom.map(({ path: entryPath, sha256 }) => [entryPath, sha256]),
  );
  const sourceTextByPath = new Map<string, string>();
  for (const [index, sourceFile] of input.sourceFiles.entries()) {
    const entryPath = actualSourcePaths[index]!;
    if (typeof sourceFile.text !== "string") {
      throw new Error(`Xiao formula-count source file ${entryPath} has no text.`);
    }
    sourceTextByPath.set(entryPath, sourceFile.text);
    const expectedHash = generatedHashByPath.get(entryPath);
    if (expectedHash && sha256Text(sourceFile.text) !== expectedHash) {
      throw new Error(
        `Xiao formula-count generated code hash drifted for ${entryPath}.`,
      );
    }
  }
  return sourceTextByPath;
}

function authenticateParsedContainer(
  parsedInput: unknown,
  sourceText: string | undefined,
  sourcePath: string,
): void {
  if (sourceText == null) {
    throw new Error(`Missing Xiao formula-count source bytes for ${sourcePath}.`);
  }
  let parsedBytes: unknown;
  try {
    parsedBytes = JSON.parse(sourceText);
  } catch {
    throw new Error(`Xiao formula-count source file ${sourcePath} is not JSON.`);
  }
  if (stableJson(parsedBytes) !== stableJson(parsedInput)) {
    throw new Error(
      `Xiao formula-count parsed input disagrees with source-file bytes for ${sourcePath}.`,
    );
  }
}

function authenticateFixtureDocumentMetadata(
  snapshot: ManualObservationSnapshot,
): void {
  const actual = {
    schemaVersion: snapshot.schemaVersion,
    sourceId: snapshot.sourceId,
    capturedAt: snapshot.capturedAt,
    page: snapshot.page,
  };
  if (stableJson(actual) !== stableJson(XIAO_FIXTURE_DOCUMENT_METADATA)) {
    throw new Error(
      "Xiao formula-count fixture document metadata drifted from its pinned source identity.",
    );
  }
}

function authenticateSourceAndBaseline(
  scope: ReturnType<typeof requireXiaoFormulaCountParityScope>,
): void {
  const kqm = scope.sourceRegistryEntries.find(({ id }) => id === "kqm");
  const presets = scope.sourceRegistryEntries.find(
    ({ id }) => id === "genshintools-presets",
  );
  const fixture = scope.rawFixture;
  const repositoryFixture = scope.repositoryFixture;
  const team = scope.baselineTeam;
  const expectedRoster = ["xiao", "xianyun", "furina", "faruzan"];
  const expectedEquipment = [
    ["primordial_jade_wingedspear", "4pc", "vermillion_hereafter"],
    ["cranes_echoing_call", "4pc", "viridescent_venerer"],
    ["splendor_of_tranquil_waters", "4pc", "golden_troupe"],
    ["favonius_warbow", "4pc", "viridescent_venerer"],
  ];
  if (
    XIAO_FORMULA_COUNT_PARITY_SCOPE_EXPECTATION.scopeId !==
      scope.audit.scopeId ||
    kqm?.status !== "active" ||
    kqm.ingestionMode !== "manual-observation" ||
    kqm.permission !== "unknown" ||
    presets?.status !== "active" ||
    presets.ingestionMode !== "internal-adapter" ||
    presets.permission !== "internal" ||
    fixture.sourceRecordId !== XIAO_FORMULA_COUNT_SOURCE_RECORD_ID ||
    fixture.characterId !== "xiao" ||
    fixture.extraction.method !== "agent-assisted" ||
    fixture.extraction.reviewStatus !== "unreviewed" ||
    fixture.rotation.id !== "no-buff-eeq12hp" ||
    fixture.rotation.notation !== "EEQ12HP" ||
    fixture.rotation.unresolvedSegments.length !== 0 ||
    stableJson(fixture.formulaCounts) !==
      stableJson([
        { sourceToken: "E", label: "Elemental Skill", count: 2 },
        { sourceToken: "HP", label: "High Plunge", count: 12 },
      ]) ||
    repositoryFixture.id !== XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID ||
    repositoryFixture.status !== "candidate" ||
    repositoryFixture.promotionEligible !== false ||
    team.id !== XIAO_FORMULA_COUNT_BASELINE_TEAM_ID ||
    team.status !== "baseline" ||
    stableJson(team.members.map(({ characterId }) => characterId)) !==
      stableJson(expectedRoster) ||
    team.members.some(({ investment }) => investment.status !== "unspecified") ||
    stableJson(
      team.members.map(({ selectedWeapon, selectedArtifact }) => [
        selectedWeapon?.weaponId ?? null,
        selectedArtifact?.type ?? null,
        selectedArtifact?.type === "4pc" ? selectedArtifact.setId : null,
      ]),
    ) !== stableJson(expectedEquipment)
  ) {
    throw new Error(
      "Xiao formula-count source fixture, registry, or runnable baseline boundary drifted.",
    );
  }
}

function authenticateExpectedComparison(comparison: {
  formulaComparisons: FormulaPlanCountComparison[];
  mismatches: FormulaPlanCountComparison[];
}): void {
  const compact = comparison.formulaComparisons.map(
    ({ formulaId, sourceTranslatedCount, calculatorDefaultCount, relation }) => ({
      formulaId,
      sourceTranslatedCount,
      calculatorDefaultCount,
      relation,
    }),
  );
  if (
    stableJson(compact) !==
      stableJson([
        {
          formulaId: "xiao-plunge-high",
          sourceTranslatedCount: 12,
          calculatorDefaultCount: 11,
          relation: "source-translation-higher",
        },
        {
          formulaId: "xiao-skill",
          sourceTranslatedCount: 2,
          calculatorDefaultCount: 2,
          relation: "matches",
        },
      ]) ||
    comparison.mismatches.length !== 1 ||
    comparison.mismatches[0]?.formulaId !== "xiao-plunge-high"
  ) {
    throw new Error(
      "Xiao formula-count parity no longer has the reviewed 2=2 and 12>11 witness shape.",
    );
  }
}

function canonicalGeneratedFrom(
  entries: readonly { path: string; sha256: string }[],
): Array<{ path: string; sha256: string }> {
  const canonical = entries
    .map(({ path: entryPath, sha256 }) => ({
      path: normalizePath(entryPath),
      sha256,
    }))
    .sort((left, right) => compareText(left.path, right.path));
  if (
    new Set(canonical.map(({ path: entryPath }) => entryPath)).size !==
      canonical.length ||
    canonical.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256))
  ) {
    throw new Error("Xiao formula-count generatedFrom entries are invalid.");
  }
  return canonical;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
