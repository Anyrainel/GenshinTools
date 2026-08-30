import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import {
  buildNoelleNormalPrefixFormulaProjectionFromWorkspace,
  loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace,
} from "../src/assemble-noelle-normal-prefix-formula-projection";
import { bootstrapGuideFactoryComputation } from "../src/computationReplay";
import {
  withScopedFormulaPartProjection,
  type FormulaPartProjectionSpec,
} from "../src/formulaPartProjection";
import { readJson, stableJson } from "../src/io";
import {
  authenticateNoelleNormalPrefixFormulaProjectionReport,
  buildNoelleNormalPrefixFormulaProjectionReport,
  FORMULA_PART_PROJECTION_CORE_RELATIVE_PATH,
  NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CLI_RELATIVE_PATH,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CORE_RELATIVE_PATH,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_REPORT_PATH,
  NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport,
  runNoelleNormalPrefixProjectionTechnicalHarness,
  type NoelleNormalPrefixFormulaProjectionInput,
  type NoelleNormalPrefixFormulaProjectionReport,
} from "../src/noelleNormalPrefixFormulaProjection";
import { REPOSITORY_ROOT } from "../src/paths";
import { XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS } from "../src/xiaoFfxxGroupedReplayRepresentationPreflight";

const VALID_SPEC = {
  formulaId: "noelle-na",
  ownerCharId: "noelle",
  expectedOriginalPartCount: 4,
  projectedParts: [
    { sourcePartIndex: 0, hits: 5, semanticLabel: "N1" },
    { sourcePartIndex: 1, hits: 5, semanticLabel: "N2" },
    { sourcePartIndex: 2, hits: 3, semanticLabel: "N3" },
  ],
} as const satisfies FormulaPartProjectionSpec;

let baseInput: NoelleNormalPrefixFormulaProjectionInput;
let report: NoelleNormalPrefixFormulaProjectionReport;

beforeAll(async () => {
  [baseInput, report] = await Promise.all([
    loadNoelleNormalPrefixFormulaProjectionInputFromWorkspace(),
    readJson(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_REPORT_PATH,
    ) as Promise<NoelleNormalPrefixFormulaProjectionReport>,
  ]);
});

describe("Noelle exact Normal-prefix formula projection", () => {
  it("rebuilds deterministically and fresh-authenticates the durable report", async () => {
    const rebuilt =
      await buildNoelleNormalPrefixFormulaProjectionReport(baseInput);
    expect(stableJson(rebuilt)).toBe(stableJson(report));
    await expect(
      requireAuthenticatedNoelleNormalPrefixFormulaProjectionReport(
        structuredClone(report),
        baseInput,
      ),
    ).resolves.toEqual(report);
  });

  it("authenticates the exact byte and generatedFrom path closure", () => {
    const expectedPaths = [
      ...NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
    ];
    expect(expectedPaths).toHaveLength(109);
    expect(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    ).toHaveLength(80);
    expect(baseInput.sourceFiles.map(({ path }) => path)).toEqual(expectedPaths);
    expect(baseInput.generatedFrom.map(({ path }) => path)).toEqual(
      expectedPaths,
    );
    expect(report.rawInputBoundary).toMatchObject({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      cp53ReportByteAndParsedObjectParity: true,
      exactCp53InputProjection: true,
      sourceFileCount: expectedPaths.length,
      generatedFromCount: expectedPaths.length,
      runtimeInputPathCount:
        NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS.length,
      binaryRuntimeInputCount: 2,
    });
    for (const source of baseInput.sourceFiles) {
      const generated = baseInput.generatedFrom.find(
        ({ path }) => path === source.path,
      );
      expect(generated?.sha256).toBe(
        sha256(Buffer.from(source.bytesBase64, "base64")),
      );
    }
  });

  it("reuses the already audited complete damage-runtime closure", () => {
    expect(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    ).toEqual(XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS);
    expect(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    ).toContain("src/lib/dmgcalc/core/formulaCompiler.ts");
    expect(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    ).toContain("src/lib/dmgcalc/core/teamBuild.ts");
    expect(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    ).toContain("src/lib/dmgcalc/impl/character4Mondstadt.ts");
  });

  it("independently derives the exact reachable first-party runtime closure", async () => {
    const allDeclaredPaths = new Set<string>(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_INPUT_PATHS,
    );
    const runtimePaths = new Set<string>(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS,
    );
    const implementationPaths = [
      FORMULA_PART_PROJECTION_CORE_RELATIVE_PATH,
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CORE_RELATIVE_PATH,
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CLI_RELATIVE_PATH,
    ];
    const importCache = new Map<string, string[]>();
    const importsFor = async (sourcePath: string): Promise<string[]> => {
      const cached = importCache.get(sourcePath);
      if (cached) return cached;
      if (!/\.tsx?$/.test(sourcePath)) return [];
      const sourceText = await readFile(
        path.join(REPOSITORY_ROOT, sourcePath),
        "utf8",
      );
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
      );
      const imports = runtimeStaticModuleSpecifiers(sourceFile).flatMap(
        (moduleSpecifier) => {
          const resolved = resolveFirstPartyModulePath(
            sourcePath,
            moduleSpecifier,
          );
          return resolved ? [resolved] : [];
        },
      );
      importCache.set(sourcePath, imports);
      return imports;
    };

    const missingRuntimeImports: string[] = [];
    for (const sourcePath of runtimePaths) {
      for (const resolved of await importsFor(sourcePath)) {
        if (!runtimePaths.has(resolved)) {
          missingRuntimeImports.push(`${sourcePath} -> ${resolved}`);
        }
      }
    }
    expect(missingRuntimeImports).toEqual([]);

    const missingImplementationImports: string[] = [];
    for (const sourcePath of implementationPaths) {
      for (const resolved of await importsFor(sourcePath)) {
        if (!allDeclaredPaths.has(resolved)) {
          missingImplementationImports.push(`${sourcePath} -> ${resolved}`);
        }
      }
    }
    expect(missingImplementationImports).toEqual([]);

    const runtimeRoots = new Set<string>([
      "scripts/guide-factory/src/computationReplay.ts",
    ]);
    for (const resolved of await importsFor(
      NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_CORE_RELATIVE_PATH,
    )) {
      if (runtimePaths.has(resolved)) runtimeRoots.add(resolved);
    }
    const reachable = new Set<string>();
    const queue = [...runtimeRoots];
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      if (!sourcePath || reachable.has(sourcePath)) continue;
      reachable.add(sourcePath);
      for (const resolved of await importsFor(sourcePath)) {
        if (runtimePaths.has(resolved) && !reachable.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
    expect([...reachable].sort()).toEqual([...runtimePaths].sort());

    expect(await importsFor("src/data/gameStatsLoader.ts")).toEqual(
      expect.arrayContaining([
        "src/data/game/character_stats.json",
        "src/data/game/character_beta_stats.json.gz",
        "src/data/game/weapon_stats.json",
        "src/data/game/weapon_beta_stats.json.gz",
      ]),
    );
  });

  it("fresh-authenticates CP53 without selecting either partial candidate", () => {
    expect(report.upstreamBoundary).toMatchObject({
      cp53ReportPath: NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
      freshlyAuthenticated: true,
      partialCandidateCount: 2,
      selectedCandidateCount: 0,
      completeBuildCount: 0,
      preservedExistingReplayAdapterGate: {
        admissionStatus: "rejected-exact-formula-representation-missing",
        numericReplayAdmitted: false,
        numericResult: null,
        offlineAdapterAdmissionIsSeparate: true,
      },
    });
    expect(
      report.upstreamBoundary.calculatorObservationCanonicalObjectSha256,
    ).toBe("1a2fcc12dfc8c1ca809c7df759bcedfd12e2888171e19599e86201ae83b671c8");
    expect(report.sourceFormulaCountTarget.requiredTotalHitVector).toEqual({
      n1: 5,
      n2: 5,
      n3: 3,
      n4: 0,
    });
    expect(report.sourceFormulaCountTarget).toMatchObject({
      sourceSupportsActionPrefixCounts: true,
      guideFactoryDerivedFormulaPartHitVector: true,
      sourceAuthoredCalculatorFormulaCounts: false,
      sourceSupportsTimingOrBuffCoverage: false,
    });
    expect(report.sourceFormulaCountTarget.noelleSegments).toEqual([
      expect.objectContaining({
        notation: "N3D",
        sourceTokenOccurrenceCount: 3,
        cancelToken: "D",
        cancelTokenPreserved: true,
        formulaCountInferred: false,
      }),
      expect.objectContaining({
        notation: "N2",
        sourceTokenOccurrenceCount: 2,
        cancelToken: null,
        cancelTokenPreserved: true,
        formulaCountInferred: false,
      }),
    ]);
  });

  it("represents the exact 5/5/3/0 vector with one retained formula ID", () => {
    expect(report.representationContract).toEqual({
      formulaId: "noelle-na",
      ownerCharId: "noelle",
      originalFormulaPartCount: 4,
      comboLineCount: 1,
      projectedParts: [
        { sourcePartIndex: 0, semanticLabel: "N1", hits: 5 },
        { sourcePartIndex: 1, semanticLabel: "N2", hits: 5 },
        { sourcePartIndex: 2, semanticLabel: "N3", hits: 3 },
      ],
      omittedSourcePartIndexes: [3],
      representedHitVector: { n1: 5, n2: 5, n3: 3, n4: 0 },
      exactTargetMatch: true,
      implementationStrategy: "scoped-local-catalog-entry-replacement",
      existingFormulaIdRetained: true,
      publishedApplicationRuntimeMutated: false,
      applicationSourceMutated: false,
      durableCatalogMutation: false,
      processLocalCalculatorRegistryBootstrapExecuted: true,
      processLocalCalculatorRegistryBootstrapRestored: false,
    });
    expect(report.technicalHarness.projection).toMatchObject({
      formulaId: "noelle-na",
      ownerCharId: "noelle",
      originalPartCount: 4,
      projectedPartCount: 3,
      projectedParts: VALID_SPEC.projectedParts,
      omittedSourcePartIndexes: [3],
      originalEntryOwner: "noelle",
      formulaRemainedDiscoverable: true,
    });
  });

  it("executes both calculator paths on an explicitly non-guide technical fixture", () => {
    const harness = report.technicalHarness;
    expect(harness.authorityPartitions).toEqual({
      sourceBackedInputs: ["rotation-action-prefix-counts"],
      runtimeBackedInputs: ["formula-id", "formula-part-order"],
      guideFactoryDerivedFields: [
        "target-hit-vector",
        "projected-formula-part-counts",
      ],
    });
    expect(harness.guideFactoryAssumptions).toEqual({
      teamShape: "single-character-isolation",
      betaDataEnabled: false,
      betaEnvironmentOverrideEnabled: false,
      config: {
        charId: "noelle",
        charLevel: 90,
        constellation: 0,
        weaponId: "white_iron_greatsword",
        refinement: 1,
        artifactSet: null,
        talentLevels: { auto: 1, skill: 1, burst: 1 },
      },
      combatOptions: {},
      enemyAura: null,
      extraBuffCount: 0,
      artifactSetAssignmentCount: 0,
      artifactStatEntryCount: 0,
      formulaBuffOverrideCount: 0,
      calcContext: {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      },
      buffCoverageModel: "existing-static-calculator-state-not-source-timing",
    });
    expect(harness.evaluatedFormula.projectedPartHits).toEqual([5, 5, 3]);
    expect(harness.evaluatedFormula.omittedPartIndexes).toEqual([3]);
    expect(
      harness.evaluatedFormula.originalDirectParts.map(({ hits }) => hits),
    ).toEqual([1, 1, 1, 1]);
    expect(harness.evaluatedFormula.directParts.map(({ hits }) => hits)).toEqual([
      5, 5, 3,
    ]);
    expect(harness.calculatorAgreement).toMatchObject({
      passed: true,
      directTotalDamage: 5267.58051313504,
      compiledTotalDamage: 5267.58051313504,
      directPartsSumMatchesDirectTotal: true,
      projectedDirectMatchesIndependentWeighting: true,
    });
    expect(harness.evaluatedFormula.independentlyWeightedOriginalTotal).toBe(
      harness.calculatorAgreement.directTotalDamage,
    );
    expect(harness.calculatorAgreement.absoluteDifference).toBeLessThanOrEqual(
      harness.calculatorAgreement.allowedDifference,
    );
    expect(harness.numericResultClassification).toBe(
      "technical-regression-only",
    );
    expect(harness.comparisonEligible).toBe(false);
    expect(harness.rankingEligible).toBe(false);
    expect(harness.recommendationEligible).toBe(false);
  });

  it("restores the projected catalog and leaves a fresh control catalog untouched", () => {
    expect(report.technicalHarness.runtimeIsolation).toEqual({
      freshTeamBuildCount: 2,
      projectedTeamBuildOnly: true,
      controlTeamBuildEntryIdentityUnchanged: true,
      originalEntryIdentityRestored: true,
      formulaIndexSizeRestored: true,
      formulaIndexOrderAndEntryIdentitiesRestored: true,
    });
  });

  it("restores every catalog entry and its order when the callback tampers and throws", async () => {
    await bootstrapGuideFactoryComputation();
    const teamBuild = buildTechnicalTeamBuild();
    const before = [...teamBuild.catalog.formulaIndex.entries()];
    const borrowedEntry = before[0]?.[1];
    expect(borrowedEntry).toBeDefined();

    await expect(
      withScopedFormulaPartProjection(
        teamBuild.catalog,
        VALID_SPEC,
        async () => {
          teamBuild.catalog.formulaIndex.delete("noelle-charge");
          teamBuild.catalog.formulaIndex.set(
            "callback-tamper",
            borrowedEntry!,
          );
          throw new Error("intentional callback failure");
        },
      ),
    ).rejects.toThrow("intentional callback failure");

    const after = [...teamBuild.catalog.formulaIndex.entries()];
    expect(after.map(([id]) => id)).toEqual(before.map(([id]) => id));
    expect(after.every(([, entry], index) => entry === before[index]?.[1])).toBe(
      true,
    );
  });

  it("rejects malformed projection specs before changing the catalog", async () => {
    await bootstrapGuideFactoryComputation();
    const mutations: FormulaPartProjectionSpec[] = [
      { ...VALID_SPEC, formulaId: "missing" },
      { ...VALID_SPEC, ownerCharId: "durin" },
      { ...VALID_SPEC, expectedOriginalPartCount: 3 },
      { ...VALID_SPEC, projectedParts: [] },
      {
        ...VALID_SPEC,
        projectedParts: [
          { sourcePartIndex: 1, hits: 1, semanticLabel: "N2" },
          { sourcePartIndex: 0, hits: 1, semanticLabel: "N1" },
        ],
      },
      {
        ...VALID_SPEC,
        projectedParts: [
          { sourcePartIndex: 0, hits: 0, semanticLabel: "N1" },
        ],
      },
      {
        ...VALID_SPEC,
        projectedParts: [
          { sourcePartIndex: 4, hits: 1, semanticLabel: "N5" },
        ],
      },
      {
        ...VALID_SPEC,
        projectedParts: [
          { sourcePartIndex: 0, hits: 1, semanticLabel: "" },
        ],
      },
    ];
    for (const spec of mutations) {
      const teamBuild = buildTechnicalTeamBuild();
      const before = [...teamBuild.catalog.formulaIndex.entries()];
      await expect(
        withScopedFormulaPartProjection(teamBuild.catalog, spec, () => null),
      ).rejects.toThrow();
      const after = [...teamBuild.catalog.formulaIndex.entries()];
      expect(after.map(([id]) => id)).toEqual(before.map(([id]) => id));
      expect(
        after.every(([, entry], index) => entry === before[index]?.[1]),
      ).toBe(true);
    }
  });

  it("is deterministic across repeated parallel fresh-instance harness runs", async () => {
    const observations = await Promise.all([
      runNoelleNormalPrefixProjectionTechnicalHarness(),
      runNoelleNormalPrefixProjectionTechnicalHarness(),
      runNoelleNormalPrefixProjectionTechnicalHarness(),
    ]);
    expect(stableJson(observations[1])).toBe(stableJson(observations[0]));
    expect(stableJson(observations[2])).toBe(stableJson(observations[0]));
  });

  it("rejects both public computation paths on the beta runtime branch", async () => {
    const previousOverride = process.env.__BETA_ENABLED_OVERRIDE__;
    try {
      process.env.__BETA_ENABLED_OVERRIDE__ = "true";
      await expect(
        buildNoelleNormalPrefixFormulaProjectionReport(fixture()),
      ).rejects.toThrow("requires the authenticated non-beta runtime branch");
      await expect(
        runNoelleNormalPrefixProjectionTechnicalHarness(),
      ).rejects.toThrow("requires the authenticated non-beta runtime branch");
    } finally {
      if (previousOverride === undefined) {
        delete process.env.__BETA_ENABLED_OVERRIDE__;
      } else {
        process.env.__BETA_ENABLED_OVERRIDE__ = previousOverride;
      }
    }
  });

  it("keeps every broader factory operation and claim outside CP54", () => {
    expect(report.operationSummary).toEqual({
      formulaProjectionRunCount: 1,
      freshTeamBuildCount: 2,
      directDamageEvaluationCount: 3,
      compiledDamageEvaluationCount: 1,
      technicalFixtureWeaponMaterializationCount: 2,
      technicalSingleCharacterComboEvaluationCount: 2,
      staticFormulaCountTechnicalComputationCount: 1,
      sourceRotationReplayCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
      candidateSelectionCount: 0,
      candidateEquipmentAssignmentCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      energyRecoveryComputationCount: 0,
    });
    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsPlayerDamageClaims: false,
      supportsSourceRotationReplay: false,
      supportsTeamTotalDamageComputation: false,
      supportsDpsClaims: false,
      supportsBuffTimingClaims: false,
      supportsEnergyRecoveryClaims: false,
      supportsIdealStatAllocation: false,
      technicalFixtureWeaponMaterializationExecuted: true,
      technicalSingleCharacterComboEvaluationExecuted: true,
      sourceRotationReplayExecuted: false,
      sourceTeamTotalDamageComputationExecuted: false,
      candidateSelectionExecuted: false,
      candidateEquipmentAssignmentExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
  });

  it("rejects raw source-byte and generated hash tampering", async () => {
    const byteTamper = fixture();
    byteTamper.sourceFiles[0].bytesBase64 = Buffer.from(
      `${Buffer.from(byteTamper.sourceFiles[0].bytesBase64, "base64").toString("utf8")}\n`,
      "utf8",
    ).toString("base64");
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(byteTamper),
    ).rejects.toThrow("source/hash authentication drifted");

    const hashTamper = fixture();
    hashTamper.generatedFrom[0].sha256 = "0".repeat(64);
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(hashTamper),
    ).rejects.toThrow("source/hash authentication drifted");
  });

  it("rejects duplicate or incomplete exact path closures", async () => {
    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(0, -1);
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(missing),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const duplicate = fixture();
    duplicate.sourceFiles = duplicate.sourceFiles.map((source, index) =>
      index === 1 ? { ...duplicate.sourceFiles[0] } : source,
    );
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(duplicate),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");
  });

  it("rejects a resealed but noncanonical CP53 report", async () => {
    const tampered = fixture();
    (
      tampered.cp53ReportInput.summary as { selectionCount: number }
    ).selectionCount = 1;
    replaceSourceBytes(
      tampered,
      NOELLE_NORMAL_PREFIX_CP53_REPORT_RELATIVE_PATH,
      Buffer.from(stableJson(tampered.cp53ReportInput), "utf8"),
    );
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(tampered),
    ).rejects.toThrow("CP53 authentication failed");
  });

  it("rejects a supplied CP53 input that diverges from authenticated bytes", async () => {
    const tampered = fixture();
    tampered.cp53Input.generatedFrom[0].sha256 = "f".repeat(64);
    await expect(
      buildNoelleNormalPrefixFormulaProjectionReport(tampered),
    ).rejects.toThrow("exact projection of the outer authenticated byte closure");
  });

  it("rejects serialized CP54 output tampering", async () => {
    const tampered = structuredClone(report);
    tampered.technicalHarness.calculatorAgreement.directTotalDamage += 1;
    const authentication =
      await authenticateNoelleNormalPrefixFormulaProjectionReport(
        tampered,
        baseInput,
      );
    expect(authentication).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });
});

function buildTechnicalTeamBuild(): TeamBuild {
  return new TeamBuild(
    [
      {
        charId: "noelle",
        charLevel: 90,
        constellation: 0,
        weaponId: "white_iron_greatsword",
        refinement: 1,
        artifactSet: null,
        talentLevels: { auto: 1, skill: 1, burst: 1 },
      },
    ],
    {},
    undefined,
    [],
    undefined,
    {
      enemyLevel: 100,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    },
  );
}

function fixture(): NoelleNormalPrefixFormulaProjectionInput {
  return structuredClone(baseInput);
}

function replaceSourceBytes(
  input: NoelleNormalPrefixFormulaProjectionInput,
  sourcePath: string,
  bytes: Buffer,
): void {
  const source = input.sourceFiles.find(({ path }) => path === sourcePath);
  const generated = input.generatedFrom.find(({ path }) => path === sourcePath);
  if (!source || !generated) throw new Error(`Missing test input ${sourcePath}.`);
  source.bytesBase64 = bytes.toString("base64");
  generated.sha256 = sha256(bytes);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function runtimeStaticModuleSpecifiers(sourceFile: ts.SourceFile): string[] {
  const moduleSpecifiers: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !isTypeOnlyImportDeclaration(node)
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      moduleSpecifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      moduleSpecifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return moduleSpecifiers;
}

function isTypeOnlyImportDeclaration(
  declaration: ts.ImportDeclaration,
): boolean {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  if (!clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) {
    return false;
  }
  return clause.namedBindings.elements.every(({ isTypeOnly }) => isTypeOnly);
}

function resolveFirstPartyModulePath(
  importerPath: string,
  moduleSpecifier: string,
): string | null {
  const bareModuleSpecifier = moduleSpecifier.split("?", 1)[0];
  let basePath: string;
  if (bareModuleSpecifier.startsWith("@/")) {
    basePath = `src/${bareModuleSpecifier.slice(2)}`;
  } else if (bareModuleSpecifier.startsWith(".")) {
    basePath = path.posix.normalize(
      path.posix.join(path.posix.dirname(importerPath), bareModuleSpecifier),
    );
  } else {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.json`,
    `${basePath}.json.gz`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
  const resolved = candidates.find((candidate) => {
    const absolutePath = path.join(REPOSITORY_ROOT, candidate);
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  });
  if (!resolved) {
    throw new Error(
      `Could not resolve first-party static import ${moduleSpecifier} from ${importerPath}.`,
    );
  }
  return resolved.replaceAll("\\", "/");
}
