import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { formatXiaoFormulaCountParitySummary } from "../src/assemble-xiao-formula-count-parity";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import {
  authenticateXiaoFormulaCountParityReport,
  buildXiaoFormulaCountParityReport,
  requireComparableXiaoFormulaCountParityReport,
  XIAO_FORMULA_COUNT_PARITY_CODE_PATHS,
  XIAO_FORMULA_COUNT_PARITY_REPORT_PATH,
  XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS,
  type BuildXiaoFormulaCountParityInput,
  type XiaoFormulaCountParityReport,
} from "../src/xiaoFormulaCountParity";
import {
  XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
  XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID,
} from "../src/xiaoFormulaCountParityScope";

const FIXTURE_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-rotation-fixture-manual.json",
);
const REPOSITORY_RELATIVE_PATH =
  "scripts/guide-factory/data/knowledge/repository.json";
const FIXTURE_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";

let baseInput: BuildXiaoFormulaCountParityInput;

beforeAll(async () => {
  baseInput = await loadFixture();
});

describe("Xiao formula-count parity witness", () => {
  it("authenticates the count-only 2=2 and 12>11 comparison", async () => {
    const report = await buildXiaoFormulaCountParityReport(fixture());

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.sourceBoundary.formulaCounts).toEqual([
      { sourceToken: "E", label: "Elemental Skill", count: 2 },
      { sourceToken: "HP", label: "High Plunge", count: 12 },
    ]);
    expect(report.translatedFormulaCounts).toMatchObject([
      { characterId: "xiao", formulaId: "xiao-skill", count: 2 },
      { characterId: "xiao", formulaId: "xiao-plunge-high", count: 12 },
    ]);
    expect(report.comparison.formulaComparisons).toEqual([
      expect.objectContaining({
        formulaId: "xiao-plunge-high",
        sourceTranslatedCount: 12,
        calculatorDefaultCount: 11,
        relation: "source-translation-higher",
      }),
      expect.objectContaining({
        formulaId: "xiao-skill",
        sourceTranslatedCount: 2,
        calculatorDefaultCount: 2,
        relation: "matches",
      }),
    ]);
    expect(report.comparison.mismatches).toEqual([
      expect.objectContaining({ formulaId: "xiao-plunge-high" }),
    ]);
    expect(report.summary).toEqual({
      sourceFormulaCountRowCount: 2,
      translatedFormulaCountRowCount: 2,
      matchedCount: 1,
      mismatchCount: 1,
      sourceTranslationHigherCount: 1,
      calculatorDefaultHigherCount: 0,
      damageFormulaEvaluationCount: 0,
      damageComputationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(formatXiaoFormulaCountParitySummary(report)).toContain(
      "High Plunge source 12 versus calculator default 11",
    );
  });

  it("keeps the aliases, computation fixture, and source authority separate", async () => {
    const report = await buildXiaoFormulaCountParityReport(fixture());

    expect(report.semanticScope).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: "xiao-formula-count-parity-v1",
    });
    expect(report.rawInputBoundary).toEqual({
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
    });
    expect(report.aliasBoundary).toMatchObject({
      ownership: "guide-factory",
      reviewStatus: "unreviewed",
      exactSourceTokenCoverage: true,
      sourceAuthoredCalculatorFormulaIds: false,
    });
    expect(report.baselineComputationBoundary).toEqual({
      sourceId: "genshintools-presets",
      teamRecordId: XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
      roster: ["xiao", "xianyun", "furina", "faruzan"],
      equipmentPurpose: "calculator-runnability-not-source-fixture-evidence",
      teamInvestmentStatus: "unspecified",
      localInvestmentAssumption: {
        charLevel: 90,
        constellation: 0,
        refinement: 1,
        talentLevels: { auto: 10, skill: 10, burst: 10 },
      },
      sourceFixtureSuppliedTeam: false,
      sourceFixtureSuppliedEquipment: false,
      sourceFixtureSuppliedConstellation: false,
    });
    expect(report.calculatorDefaultDraft.sourceTeamRecordId).toBe(
      XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
    );
    expect(
      report.calculatorDefaultDraft.lines.find(
        ({ characterId, formulaId }) =>
          characterId === "xiao" && formulaId === "xiao-plunge-high",
      ),
    ).toEqual({
      characterId: "xiao",
      formulaId: "xiao-plunge-high",
      count: 11,
    });
  });

  it("exposes only count-parity execution and no guide, damage, ranking, or ER capability", async () => {
    const report = await buildXiaoFormulaCountParityReport(fixture());

    expect(report).toMatchObject({
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
    });
  });

  it("authenticates the durable report and rejects nested alias or comparison tampering", async () => {
    const input = fixture();
    const canonical = await buildXiaoFormulaCountParityReport(input);
    const durable = (await readJson(
      XIAO_FORMULA_COUNT_PARITY_REPORT_PATH,
    )) as XiaoFormulaCountParityReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      await authenticateXiaoFormulaCountParityReport(durable, input),
    ).toMatchObject({ authenticated: true });
    await expect(
      requireComparableXiaoFormulaCountParityReport(durable, input),
    ).resolves.toBeUndefined();

    const aliasForgery = structuredClone(durable);
    aliasForgery.aliasBoundary.aliases[1]!.formulaId = "xiao-skill";
    expect(
      await authenticateXiaoFormulaCountParityReport(aliasForgery, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });

    const comparisonForgery = structuredClone(durable);
    comparisonForgery.comparison.formulaComparisons[0]!.calculatorDefaultCount =
      12;
    await expect(
      requireComparableXiaoFormulaCountParityReport(
        comparisonForgery,
        input,
      ),
    ).rejects.toThrow("serialized-report-mismatch");
  });

  it("isolates unrelated repository carrier drift but rejects selected semantic drift", async () => {
    const baseline = await buildXiaoFormulaCountParityReport(fixture());
    const unrelated = fixture();
    const unrelatedRepository = structuredClone(
      unrelated.repositoryInput as Record<string, any>,
    );
    const unrelatedRecord = unrelatedRepository.records.find(
      ({ id }: { id: string }) =>
        id !== XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID &&
        id !== XIAO_FORMULA_COUNT_BASELINE_TEAM_ID,
    );
    if (!unrelatedRecord) throw new Error("Missing unrelated repository record.");
    unrelatedRecord.unknowns = [
      ...(unrelatedRecord.unknowns ?? []),
      "unrelated scope-test carrier drift",
    ];
    replaceJsonContainer(
      unrelated,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      unrelatedRepository,
    );
    expect(
      stableJson(await buildXiaoFormulaCountParityReport(unrelated)),
    ).toBe(stableJson(baseline));

    const relevant = fixture();
    const relevantRepository = structuredClone(
      relevant.repositoryInput as Record<string, any>,
    );
    const fixtureRecord = relevantRepository.records.find(
      ({ id }: { id: string }) =>
        id === XIAO_FORMULA_COUNT_REPOSITORY_RECORD_ID,
    );
    if (!fixtureRecord) throw new Error("Missing selected Xiao fixture record.");
    fixtureRecord.formulaCounts[1].count = 13;
    replaceJsonContainer(
      relevant,
      REPOSITORY_RELATIVE_PATH,
      "repositoryInput",
      relevantRepository,
    );
    await expect(buildXiaoFormulaCountParityReport(relevant)).rejects.toThrow(
      "semantic scope authentication failed",
    );
  });

  it("rejects raw/repository parity drift and parsed-input byte disagreement", async () => {
    const parityDrift = fixture();
    const fixtureSnapshot = structuredClone(
      parityDrift.manualFixtureSnapshotInput as Record<string, any>,
    );
    fixtureSnapshot.records[0].formulaCounts[1].count = 13;
    replaceJsonContainer(
      parityDrift,
      FIXTURE_RELATIVE_PATH,
      "manualFixtureSnapshotInput",
      fixtureSnapshot,
    );
    await expect(
      buildXiaoFormulaCountParityReport(parityDrift),
    ).rejects.toThrow("semantic scope authentication failed");

    const byteDisagreement = fixture();
    const parsedOnly = structuredClone(
      byteDisagreement.manualFixtureSnapshotInput as Record<string, any>,
    );
    parsedOnly.records[0].rotation.label = "Parsed-only mutation";
    byteDisagreement.manualFixtureSnapshotInput = parsedOnly;
    await expect(
      buildXiaoFormulaCountParityReport(byteDisagreement),
    ).rejects.toThrow("parsed input disagrees with source-file bytes");
  });

  it("rejects source-document metadata drift even when parsed bytes agree", async () => {
    const pageDrift = fixture();
    const fixtureSnapshot = structuredClone(
      pageDrift.manualFixtureSnapshotInput as Record<string, any>,
    );
    fixtureSnapshot.page.url = "https://example.invalid/xiao";
    fixtureSnapshot.page.sourceVersion = "Version forged";
    replaceJsonContainer(
      pageDrift,
      FIXTURE_RELATIVE_PATH,
      "manualFixtureSnapshotInput",
      fixtureSnapshot,
    );
    await expect(buildXiaoFormulaCountParityReport(pageDrift)).rejects.toThrow(
      "fixture document metadata drifted",
    );
  });

  it("rejects source-file and generated-code path/hash closure drift", async () => {
    const missingSource = fixture();
    missingSource.sourceFiles = missingSource.sourceFiles.slice(1);
    await expect(buildXiaoFormulaCountParityReport(missingSource)).rejects.toThrow(
      "source-file exact path closure drifted",
    );

    const missingGenerated = fixture();
    missingGenerated.generatedFrom = missingGenerated.generatedFrom.slice(1);
    await expect(
      buildXiaoFormulaCountParityReport(missingGenerated),
    ).rejects.toThrow("generatedFrom path closure drifted");

    const forgedHash = fixture();
    forgedHash.generatedFrom = forgedHash.generatedFrom.map((entry, index) =>
      index === 0 ? { ...entry, sha256: "0".repeat(64) } : entry,
    );
    await expect(buildXiaoFormulaCountParityReport(forgedHash)).rejects.toThrow(
      "generated code hash drifted",
    );
  });
});

async function loadFixture(): Promise<BuildXiaoFormulaCountParityInput> {
  const [
    repositoryInput,
    manualFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(FIXTURE_PATH),
    readJson(GENSHINTOOLS_SNAPSHOT_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      XIAO_FORMULA_COUNT_PARITY_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(path.join(REPOSITORY_ROOT, relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      XIAO_FORMULA_COUNT_PARITY_CODE_PATHS.map(async (relativePath) => ({
        path: relativePath,
        sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
      })),
    ),
  ]);
  return {
    repositoryInput,
    manualFixtureSnapshotInput,
    genshinToolsSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    sourceFiles,
    generatedFrom,
  };
}

function fixture(): BuildXiaoFormulaCountParityInput {
  return structuredClone(baseInput);
}

function replaceJsonContainer(
  input: BuildXiaoFormulaCountParityInput,
  relativePath: string,
  inputKey:
    | "repositoryInput"
    | "manualFixtureSnapshotInput"
    | "genshinToolsSnapshotInput"
    | "manualIndexInput"
    | "sourceRegistryInput",
  value: unknown,
): void {
  input[inputKey] = value;
  input.sourceFiles = input.sourceFiles.map((entry) =>
    entry.path === relativePath
      ? { ...entry, text: `${JSON.stringify(value, null, 2)}\n` }
      : entry,
  );
}
