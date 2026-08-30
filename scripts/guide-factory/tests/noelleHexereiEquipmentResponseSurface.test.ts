import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buildNoelleHexereiEquipmentResponseSurfaceFromWorkspace,
  formatNoelleHexereiEquipmentResponseSurfaceSummary,
  loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-equipment-response-surface";
import { stableJson } from "../src/io";
import { NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS } from "../src/noelleNormalPrefixFormulaProjection";
import {
  authenticateNoelleHexereiEquipmentResponseSurfaceReport,
  buildNoelleHexereiEquipmentResponseSurfaceReport,
  NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
  requireAuthenticatedNoelleHexereiEquipmentResponseSurfaceReport,
  type NoelleHexereiEquipmentResponseCell,
  type NoelleHexereiEquipmentResponseSurfaceInput,
  type NoelleHexereiEquipmentResponseSurfaceReport,
} from "../src/noelleHexereiEquipmentResponseSurface";
import { REPOSITORY_ROOT } from "../src/paths";
import { XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS } from "../src/xiaoFfxxGroupedReplayRepresentationPreflight";

let baseInput: NoelleHexereiEquipmentResponseSurfaceInput;
let report: NoelleHexereiEquipmentResponseSurfaceReport;

const EXPECTED_WITNESSES = [
  {
    sequence: 0,
    witnessId: "c0-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 9 },
    sourceAlignedSands: "atk%",
  },
  {
    sequence: 1,
    witnessId: "c5-q9",
    profileId: "noelle-lower-investment-artifact-profile-v1",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    sourceAlignedSands: "atk%",
  },
  {
    sequence: 2,
    witnessId: "c0-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 0,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 1, burst: 10 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 3,
    witnessId: "c5-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 5,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 4,
    witnessId: "c6-q9",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 9 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 12 },
    sourceAlignedSands: "def%",
  },
  {
    sequence: 5,
    witnessId: "c6-q10",
    profileId: "noelle-high-investment-artifact-profile-v1",
    constellation: 6,
    enteredTalentLevels: { auto: 10, skill: 1, burst: 10 },
    runtimeEffectiveTalentLevels: { auto: 10, skill: 4, burst: 13 },
    sourceAlignedSands: "def%",
  },
] as const;

const SANDS = ["atk%", "def%"] as const;
const CIRCLETS = ["cr", "cd"] as const;
const REFINEMENTS = [1, 5] as const;

beforeAll(async () => {
  [baseInput, report] = await Promise.all([
    loadNoelleHexereiEquipmentResponseSurfaceInputFromWorkspace(),
    readJsonReport(),
  ]);
});

describe("Noelle Hexerei equipment response surface", () => {
  it("rebuilds deterministically and fresh-authenticates the durable report", async () => {
    const rebuilt =
      await buildNoelleHexereiEquipmentResponseSurfaceReport(baseInput);
    expect(stableJson(rebuilt)).toBe(stableJson(report));
    await expect(
      requireAuthenticatedNoelleHexereiEquipmentResponseSurfaceReport(
        structuredClone(report),
        baseInput,
      ),
    ).resolves.toEqual(report);
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceFromWorkspace(),
    ).resolves.toEqual(report);
    expect(formatNoelleHexereiEquipmentResponseSurfaceSummary(report)).toBe(
      "Completed 48-cell Noelle equipment response surface; 48 direct/compiled agreements, 2 source branches with cross-witness Sands sign variation, selections/ER: 0/0.",
    );
  });

  it("authenticates the exact 112-path byte closure and current request", async () => {
    const expectedPaths = [
      ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
    ];
    expect(expectedPaths).toHaveLength(112);
    expect(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
    ).toHaveLength(80);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json")))
      .toHaveLength(13);
    expect(baseInput.sourceFiles.map(({ path }) => path)).toEqual(expectedPaths);
    expect(baseInput.generatedFrom.map(({ path }) => path)).toEqual(
      expectedPaths,
    );
    expect(baseInput.technicalRequest).toEqual(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REQUEST,
    );
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp54ReportByteAndParsedObjectParity: true,
      exactCp54InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 112,
      generatedFromCount: 112,
      runtimeInputPathCount: 80,
      jsonInputCount: 13,
      binaryRuntimeInputCount: 2,
    });
    await Promise.all(
      baseInput.sourceFiles.map(async (source) => {
        const generated = baseInput.generatedFrom.find(
          ({ path }) => path === source.path,
        );
        const sourceBytes = Buffer.from(source.bytesBase64, "base64");
        expect(generated?.sha256).toBe(sha256(sourceBytes));
        await expect(
          readFile(path.join(REPOSITORY_ROOT, source.path)),
        ).resolves.toEqual(sourceBytes);
      }),
    );
  });

  it("derives the exact reachable first-party runtime closure", async () => {
    expect(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
    ).toEqual(NOELLE_NORMAL_PREFIX_FORMULA_PROJECTION_RUNTIME_INPUT_PATHS);
    expect(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
    ).toEqual(XIAO_FFXX_GROUPED_REPLAY_RUNTIME_INPUT_PATHS);
    const allDeclaredPaths = new Set<string>(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
    );
    const runtimePaths = new Set<string>(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
    );
    const implementationPaths = [
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CLI_RELATIVE_PATH,
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
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_CORE_RELATIVE_PATH,
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
  });

  it("fresh-authenticates CP54 and CP53 without upgrading their authority", () => {
    expect(report.upstreamBoundary).toMatchObject({
      cp54ReportPath: NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
      cp54FreshlyAuthenticated: true,
      cp53IndependentlyFreshlyAuthenticated: true,
      cp53CandidateCount: 2,
      cp53SelectedCandidateCount: 0,
      cp53CompleteBuildCount: 0,
      cp54StaticFormulaCountTechnicalComputationPreserved: true,
      sourceRotationReplayStillNotAuthorized: true,
    });
    expect(report.requestBoundary).toMatchObject({
      sourceAuthored: false,
      sourceCandidateSelection: null,
      investmentWitnessSelectionForSourceTeam: false,
      teammateEquipmentSourceAuthored: false,
      supportOptionsSourceAuthored: false,
      refinementSourceAuthored: false,
      enemyContextSourceAuthored: false,
      energyRecoveryDeferred: true,
    });
    expect(report.sourceCandidateAnchors).toHaveLength(2);
    expect(report.sourceCandidateAnchors.map(({ profileId }) => profileId)).toEqual([
      "noelle-lower-investment-artifact-profile-v1",
      "noelle-high-investment-artifact-profile-v1",
    ]);
    expect(
      report.sourceCandidateAnchors.map(
        ({ guardedMainStatAlternativesPreservedButNotEvaluated }) =>
          guardedMainStatAlternativesPreservedButNotEvaluated.length,
      ),
    ).toEqual([0, 2]);
    expect(
      report.sourceCandidateAnchors.every(
        ({ sourceWeaponOrdering, sourceWeaponRefinement }) =>
          sourceWeaponOrdering === "unranked" &&
          sourceWeaponRefinement === null,
      ),
    ).toBe(true);
  });

  it("keeps entered and runtime-effective talents separate at six threshold witnesses", () => {
    expect(report.requestBoundary.request.investmentWitnesses).toEqual(
      EXPECTED_WITNESSES,
    );
    for (const witness of EXPECTED_WITNESSES) {
      expect(
        profileIdFromEnteredFacts(
          witness.constellation,
          witness.enteredTalentLevels.burst,
        ),
      ).toBe(witness.profileId);
      const cells = report.surface.cells.filter(
        ({ witnessId }) => witnessId === witness.witnessId,
      );
      expect(cells).toHaveLength(8);
      for (const cell of cells) {
        expect(cell).toMatchObject({
          witnessId: witness.witnessId,
          profileId: witness.profileId,
          enteredConstellation: witness.constellation,
          enteredTalentLevels: witness.enteredTalentLevels,
          runtimeEffectiveTalentLevels:
            witness.runtimeEffectiveTalentLevels,
          runtimeTalentEvidence: {
            expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true,
            autoFormulaMultipliersMatchExpectedLevel: true,
            burstConversionMatchesExpectedLevel: true,
            skillLevelNotUsedByObjective: true,
          },
          sourcePredicateSatisfiedByEnteredFacts: true,
          sourcePredicateEvaluationAuthorship:
            "guide-factory-request-context-semantics",
        });
        expect(cell.sandsAuthority).toBe(
          cell.sands === witness.sourceAlignedSands
            ? "source-listed-for-authenticated-branch"
            : "guide-factory-counterfactual",
        );
      }
    }
    expect(
      profileIdFromEnteredFacts(
        5,
        EXPECTED_WITNESSES[1].runtimeEffectiveTalentLevels.burst,
      ),
    ).toBe("noelle-high-investment-artifact-profile-v1");
    expect(EXPECTED_WITNESSES[1].profileId).toBe(
      "noelle-lower-investment-artifact-profile-v1",
    );
  });

  it("executes the exact 6x2x2x2 Cartesian surface with fresh isolated cells", () => {
    const expectedCellIds = expectedOrderedCellIds();
    expect(report.surface.exactCartesianClosure).toEqual({
      witnessCount: 6,
      sandsCount: 2,
      circletCount: 2,
      refinementCount: 2,
      expectedCellCount: 48,
      observedCellCount: 48,
      uniqueCellInputCount: 48,
      complete: true,
    });
    expect(report.surface.cells).toHaveLength(48);
    expect(report.surface.cells.map(({ cellId }) => cellId)).toEqual(
      expectedCellIds,
    );
    expect(report.surface.cells.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: 48 }, (_, index) => index),
    );
    expect(new Set(expectedCellIds).size).toBe(48);
    expect(
      new Set(report.surface.cells.map(({ cellInputSha256 }) => cellInputSha256))
        .size,
    ).toBe(48);
    expect(
      report.surface.cells.filter(
        ({ sandsAuthority }) =>
          sandsAuthority === "source-listed-for-authenticated-branch",
      ),
    ).toHaveLength(24);
    expect(
      report.surface.cells.filter(
        ({ sandsAuthority }) =>
          sandsAuthority === "guide-factory-counterfactual",
      ),
    ).toHaveLength(24);
    for (const cell of report.surface.cells) {
      const expectedEntries = expectedArtifactSheetEntries(
        cell.sands,
        cell.circlet,
      );
      expect(cell.artifactSheet.mainStats).toEqual([
        "hp",
        "atk",
        cell.sands,
        "geo%",
        cell.circlet,
      ]);
      expect(cell.artifactSheet.mainStatValuesInternal).toEqual(
        Object.fromEntries(
          expectedEntries.map(({ key, value }) => [key, value]),
        ),
      );
      expect(
        expectedEntries.find(({ key }) => key === "dmg%")?.filterKey,
      ).toBe("e:Geo");
      expect(cell.artifactSheet.sheetSha256).toBe(
        sha256Stable(expectedEntries),
      );
    }
    expect(
      new Set(
        report.surface.cells.map(
          ({ artifactSheet }) => artifactSheet.sheetSha256,
        ),
      ).size,
    ).toBe(4);
    expect(
      report.surface.cells.every(
        ({ artifactSheet, formulaProjection }) =>
          artifactSheet.substatEntryCount === 0 &&
          !artifactSheet.legalCompleteArtifactBuild &&
          stableJson(formulaProjection.projectedPartHits) ===
            stableJson([5, 5, 3]) &&
          stableJson(formulaProjection.omittedPartIndexes) === stableJson([3]) &&
          formulaProjection.originalEntryIdentityRestored &&
          formulaProjection.formulaIndexSizeRestored &&
          formulaProjection.formulaIndexOrderAndEntryIdentitiesRestored,
      ),
    ).toBe(true);
  });

  it("records only fixture-local direct/compiled agreement", () => {
    expect(report.surface.directCompiledAgreement).toEqual({
      evaluatedCellCount: 48,
      agreementCount: 48,
      mismatchCount: 0,
      maximumAbsoluteDifference: 5.82076609134674e-11,
      allWithinTolerance: true,
    });
    for (const cell of report.surface.cells) {
      const gestMagnitude = cell.refinement === 1 ? 0.3 : 0.62;
      const expectedGeoNormalDamageBonus = normalizeNumberForTest(
        0.466 + 0.24 + 0.15 + gestMagnitude,
      );
      expect(cell.objective.directCompiledAgreement).toBe(true);
      expect(cell.objective.absoluteDifference).toBeLessThanOrEqual(
        cell.objective.allowedDifference,
      );
      expect(cell.objective.numericClassification).toBe(
        "technical-fixture-local-only",
      );
      expect(cell.runtimeTrace.compilerErConstraintPresent).toBe(false);
      expect(cell.runtimeTrace.computedBuffOverrideKeys).toEqual([]);
      expect(cell.objective.resolvedNoelleStats.geoNormalDamageBonus).toBe(
        expectedGeoNormalDamageBonus,
      );
      expect(cell.objective.resolvedNoelleStats).not.toHaveProperty(
        "geoDamageBonus",
      );
    }
    expect(
      [...new Set(report.surface.cells.map(
        ({ objective }) => objective.resolvedNoelleStats.geoNormalDamageBonus,
      ))].sort(),
    ).toEqual([1.156, 1.476]);
    expect(report.surface.cellsSha256).toBe(sha256Stable(report.surface.cells));
  });

  it("pins applicable runtime buffs instead of equating empty overrides with no buffs", () => {
    expect(report.surface.buffTraceCatalog).toHaveLength(24);
    expect(
      new Set(
        report.surface.buffTraceCatalog.map(({ traceSha256 }) => traceSha256),
      ).size,
    ).toBe(24);
    expect(
      report.surface.buffTraceCatalog.reduce(
        (sum, { observedCellCount }) => sum + observedCellCount,
        0,
      ),
    ).toBe(48);
    expect(
      [...new Set(report.surface.cells.map(
        ({ runtimeTrace }) => runtimeTrace.applicableBuffCountForOnFieldNoelle,
      ))].sort(),
    ).toEqual([13, 14, 15]);
    for (const trace of report.surface.buffTraceCatalog) {
      expect(trace.traceSha256).toBe(sha256Stable(trace.rows));
      const referencingCells = report.surface.cells.filter(
        ({ runtimeTrace }) =>
          runtimeTrace.applicableBuffTraceSha256 === trace.traceSha256,
      );
      expect(trace.observedCellCount).toBe(referencingCells.length);
      expect(referencingCells).toHaveLength(2);
      expect(referencingCells.map(({ circlet }) => circlet)).toEqual(CIRCLETS);
      expect(changedAxes(referencingCells[0]!, referencingCells[1]!)).toEqual([
        "circlet",
      ]);

      const gestRows = trace.rows.filter(
        ({ providerCharId, source }) =>
          providerCharId === "noelle" &&
          source.type === "weapon" &&
          source.id === "gest_of_the_mighty_wolf",
      );
      const geoRows = trace.rows.filter(
        ({ source }) =>
          source.type === "teamResonance" && source.id === "geo",
      );
      const huskRows = trace.rows.filter(
        ({ providerCharId, source }) =>
          providerCharId === "noelle" &&
          source.type === "artifactSet" &&
          source.id === "husk_of_opulent_dreams",
      );
      const teammateWeaponRows = trace.rows.filter(
        ({ providerCharId, source }) =>
          providerCharId !== "noelle" && source.type === "weapon",
      );
      expect(gestRows).toHaveLength(3);
      expect(geoRows).toHaveLength(2);
      expect(huskRows).toHaveLength(1);
      expect(teammateWeaponRows).toHaveLength(0);
      const gestMagnitude = referencingCells[0]!.refinement === 1 ? 0.3 : 0.62;
      expect(
        Object.fromEntries(
          gestRows.flatMap(({ staticEntries }) =>
            staticEntries.map(({ key, value }) => [key, value]),
          ),
        ),
      ).toEqual({
        "atkSpd%": 0.1,
        cd: gestMagnitude,
        "dmg%": gestMagnitude,
      });
      expect(
        Object.fromEntries(
          geoRows.flatMap(({ staticEntries }) =>
            staticEntries.map(({ key, value }) => [key, value]),
          ),
        ),
      ).toEqual({
        "dmg%": 0.15,
        "resReduction%": 0.2,
      });
      expect(
        Object.fromEntries(
          huskRows.flatMap(({ staticEntries }) =>
            staticEntries.map(({ key, value }) => [key, value]),
          ),
        ),
      ).toEqual({ "def%": 0.24, "geo%": 0.24 });
    }
    for (const cell of report.surface.cells) {
      const gestMagnitude = cell.refinement === 1 ? 0.3 : 0.62;
      expect(cell.runtimeTrace.gestBuffCount).toBe(3);
      expect(cell.runtimeTrace.gestHexereiCritDamageMaterialized).toBe(true);
      expect(cell.runtimeTrace.gestDamageBonus).toBe(gestMagnitude);
      expect(cell.runtimeTrace.gestCritDamage).toBe(gestMagnitude);
      expect(cell.runtimeTrace.gestAttackSpeed).toBe(0.1);
      expect(cell.runtimeTrace.huskBuffCount).toBe(1);
      expect(cell.runtimeTrace.huskDefenseBonus).toBe(0.24);
      expect(cell.runtimeTrace.huskGeoDamageBonus).toBe(0.24);
      expect(cell.runtimeTrace.geoResonanceBuffCount).toBe(2);
      expect(cell.runtimeTrace.geoResonanceDamageBonus).toBe(0.15);
      expect(cell.runtimeTrace.geoResonanceResistanceReduction).toBe(0.2);
      expect(cell.runtimeTrace.teammateWeaponBuffCount).toBe(0);
      expect(cell.runtimeTrace.exactRequiredBuffValuesVerified).toBe(true);
      expect(
        cell.runtimeTrace.computedBuffOverrideCountDoesNotRepresentApplicableBuffCount,
      ).toBe(true);
      expect(
        report.surface.buffTraceCatalog.some(
          ({ traceSha256 }) =>
            traceSha256 === cell.runtimeTrace.applicableBuffTraceSha256,
        ),
      ).toBe(true);
    }
    const allRows = report.surface.buffTraceCatalog.flatMap(({ rows }) => rows);
    expect(
      allRows.some(
        ({ providerCharId, source, resolvedDynamicEntries }) =>
          providerCharId === "noelle" &&
          source.id === "noelle" &&
          source.origin === "Q" &&
          resolvedDynamicEntries.some(({ key }) => key === "atk"),
      ),
    ).toBe(true);
    expect(
      allRows.some(
        ({ providerCharId, source, staticEntries }) =>
          providerCharId === "noelle" &&
          source.id === "gest_of_the_mighty_wolf" &&
          staticEntries.some(({ key }) => key === "cd"),
      ),
    ).toBe(true);
  });

  it("builds 72 same-fixture comparisons that change exactly one axis", () => {
    const expectedEdges = expectedComparisonEdges();
    expect(expectedEdges).toHaveLength(72);
    expect(report.surface.comparisonPairs).toHaveLength(expectedEdges.length);
    expect(
      report.surface.comparisonPairs.map(({ comparisonId }) => comparisonId),
    ).toEqual(expectedEdges.map(({ comparisonId }) => comparisonId));
    expect(
      new Set(
        report.surface.comparisonPairs.map(({ comparisonId }) => comparisonId),
      ).size,
    ).toBe(72);
    expect(
      Object.fromEntries(
        ["sands", "circlet", "refinement"].map((axis) => [
          axis,
          report.surface.comparisonPairs.filter(
            ({ changedAxis }) => changedAxis === axis,
          ).length,
        ]),
      ),
    ).toEqual({ sands: 24, circlet: 24, refinement: 24 });
    const cells = new Map(
      report.surface.cells.map((cell) => [cell.cellId, cell] as const),
    );
    for (const [index, comparison] of report.surface.comparisonPairs.entries()) {
      const expected = expectedEdges[index];
      expect(expected).toBeDefined();
      const left = cells.get(comparison.leftCellId);
      const right = cells.get(comparison.rightCellId);
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      expect(comparison).toMatchObject({
        comparisonId: expected.comparisonId,
        changedAxis: expected.changedAxis,
        leftCellId: expected.leftCellId,
        rightCellId: expected.rightCellId,
        leftAxisValue: expected.leftAxisValue,
        rightAxisValue: expected.rightAxisValue,
      });
      expect(comparison.exactlyOneDeclaredAxisChanged).toBe(true);
      expect(comparison.sourceExpectedOrdering).toBeNull();
      expect(comparison.selectionExecuted).toBe(false);
      expect(changedAxes(left!, right!)).toEqual([comparison.changedAxis]);
      expect(comparison.leftDirectTotal).toBe(left!.objective.directTotal);
      expect(comparison.rightDirectTotal).toBe(right!.objective.directTotal);
      expect(comparison.signedLeftMinusRightDelta).toBe(
        normalizeNumberForTest(
          left!.objective.directTotal - right!.objective.directTotal,
        ),
      );
      expect(comparison.fixedAxisPayloadSha256).toBe(
        sha256Stable(expected.fixedAxisPayload),
      );
    }
    expect(report.surface.comparisonsSha256).toBe(
      sha256Stable(report.surface.comparisonPairs),
    );
  });

  it("preserves the observed cross-witness Sands sign changes instead of averaging branches", () => {
    const cells = new Map(
      report.surface.cells.map((cell) => [cell.cellId, cell] as const),
    );
    const sandsPairs = report.surface.comparisonPairs.filter(
      ({ changedAxis }) => changedAxis === "sands",
    );
    const derivedWitnessSummaries = EXPECTED_WITNESSES.map((witness) => {
      const witnessPairs = sandsPairs.filter(
        ({ leftCellId }) => cells.get(leftCellId)?.witnessId === witness.witnessId,
      );
      expect(witnessPairs).toHaveLength(4);
      const signs = witnessPairs.map(({ leftCellId, rightCellId }) => {
        const left = cells.get(leftCellId);
        const right = cells.get(rightCellId);
        if (!left || !right) throw new Error("Missing Sands comparison cell.");
        const sourceAligned =
          left.sands === witness.sourceAlignedSands ? left : right;
        const counterfactual = sourceAligned === left ? right : left;
        return signForDelta(
          normalizeNumberForTest(
            sourceAligned.objective.directTotal -
              counterfactual.objective.directTotal,
          ),
        );
      });
      return {
        witnessId: witness.witnessId,
        profileId: witness.profileId,
        comparisonCount: 4,
        sourceAlignedSands: witness.sourceAlignedSands,
        counterfactualSands:
          witness.sourceAlignedSands === "atk%" ? "def%" : "atk%",
        positiveSourceAlignedMinusCounterfactualCount: signs.filter(
          (sign) => sign === "positive",
        ).length,
        negativeSourceAlignedMinusCounterfactualCount: signs.filter(
          (sign) => sign === "negative",
        ).length,
        numericalTieCount: signs.filter((sign) => sign === "tie").length,
        observedSignSet: [...new Set(signs)].sort(),
        supportsBranchWideSandsClaim: false,
        selectionExecuted: false,
      };
    });
    expect(report.surface.witnessSandsSummaries).toEqual(
      derivedWitnessSummaries,
    );
    expect(
      derivedWitnessSummaries.map(
        ({
          witnessId,
          positiveSourceAlignedMinusCounterfactualCount,
          negativeSourceAlignedMinusCounterfactualCount,
          numericalTieCount,
        }) => ({
          witnessId,
          positiveSourceAlignedMinusCounterfactualCount,
          negativeSourceAlignedMinusCounterfactualCount,
          numericalTieCount,
        }),
      ),
    ).toEqual([
      {
        witnessId: "c0-q9",
        positiveSourceAlignedMinusCounterfactualCount: 4,
        negativeSourceAlignedMinusCounterfactualCount: 0,
        numericalTieCount: 0,
      },
      {
        witnessId: "c5-q9",
        positiveSourceAlignedMinusCounterfactualCount: 0,
        negativeSourceAlignedMinusCounterfactualCount: 4,
        numericalTieCount: 0,
      },
      {
        witnessId: "c0-q10",
        positiveSourceAlignedMinusCounterfactualCount: 0,
        negativeSourceAlignedMinusCounterfactualCount: 4,
        numericalTieCount: 0,
      },
      ...["c5-q10", "c6-q9", "c6-q10"].map((witnessId) => ({
        witnessId,
        positiveSourceAlignedMinusCounterfactualCount: 4,
        negativeSourceAlignedMinusCounterfactualCount: 0,
        numericalTieCount: 0,
      })),
    ]);

    const profileIds = [
      "noelle-lower-investment-artifact-profile-v1",
      "noelle-high-investment-artifact-profile-v1",
    ] as const;
    const derivedBranchSummaries = profileIds.map((profileId) => {
      const rows = derivedWitnessSummaries.filter(
        (summary) => summary.profileId === profileId,
      );
      const observedSignSetAcrossWitnesses = [
        ...new Set(rows.flatMap(({ observedSignSet }) => observedSignSet)),
      ].sort();
      return {
        profileId,
        witnessIds: rows.map(({ witnessId }) => witnessId),
        observedSignSetAcrossWitnesses,
        crossWitnessSignVariationObserved:
          observedSignSetAcrossWitnesses.length > 1,
        supportsBranchWideSandsClaim: false,
        branchAverageComputed: false,
        selectionExecuted: false,
      };
    });
    expect(report.surface.branchSandsVariationSummaries).toEqual(
      derivedBranchSummaries,
    );
    expect(
      derivedBranchSummaries.map(
        ({ profileId, witnessIds, observedSignSetAcrossWitnesses }) => ({
          profileId,
          witnessIds,
          observedSignSetAcrossWitnesses,
        }),
      ),
    ).toEqual([
      {
        profileId: "noelle-lower-investment-artifact-profile-v1",
        witnessIds: ["c0-q9", "c5-q9"],
        observedSignSetAcrossWitnesses: ["negative", "positive"],
      },
      {
        profileId: "noelle-high-investment-artifact-profile-v1",
        witnessIds: ["c0-q10", "c5-q10", "c6-q9", "c6-q10"],
        observedSignSetAcrossWitnesses: ["negative", "positive"],
      },
    ]);
    expect(report.surface.summarySha256).toBe(
      sha256Stable({
        witnessSandsSummaries: report.surface.witnessSandsSummaries,
        branchSandsVariationSummaries:
          report.surface.branchSandsVariationSummaries,
        directCompiledAgreement: report.surface.directCompiledAgreement,
        exactCartesianClosure: report.surface.exactCartesianClosure,
      }),
    );
    expect(requireCell("c0-q9:atk%:cr:r1").objective.directTotal).toBe(
      129718.81601431,
    );
    expect(requireCell("c0-q9:def%:cr:r1").objective.directTotal).toBe(
      127393.762235814,
    );
    expect(requireCell("c5-q9:atk%:cr:r1").objective.directTotal).toBe(
      137099.090227822,
    );
    expect(requireCell("c5-q9:def%:cr:r1").objective.directTotal).toBe(
      137112.460289803,
    );
  });

  it("keeps every broader factory operation and ER outside CP55", () => {
    expect(report.operationSummary).toEqual({
      investmentWitnessCount: 6,
      sandsStateCount: 2,
      circletStateCount: 2,
      refinementStateCount: 2,
      responseCellCount: 48,
      singleAxisComparisonCount: 72,
      formulaProjectionRunCount: 48,
      freshTeamBuildCount: 48,
      compilerBuildCount: 48,
      directDamageEvaluationCount: 48,
      compiledDamageEvaluationCount: 48,
      technicalNoelleFormulaObjectiveCount: 48,
      guideFactoryTechnicalEquipmentMaterializationCount: 48,
      sourceCandidateSelectionCount: 0,
      sourceCandidateEquipmentAssignmentCount: 0,
      sourceSubstatPriorityEvaluationCount: 0,
      sourceRotationReplayCount: 0,
      sourceSupporterFormulaEvaluationCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
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
      sourceCandidateSelectionExecuted: false,
      sourceCandidateEquipmentAssignmentExecuted: false,
      sourceSubstatPriorityEvaluationExecuted: false,
      sourceRotationReplayExecuted: false,
      sourceTeamTotalDamageComputationExecuted: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.requestBoundary.request.energyRecovery).toEqual({
      status: "deferred",
      keyIncludedInMainStats: false,
      thresholdIncluded: false,
      computationRequested: false,
    });
  });

  it("rejects the beta runtime branch", async () => {
    const previousOverride = process.env.__BETA_ENABLED_OVERRIDE__;
    try {
      process.env.__BETA_ENABLED_OVERRIDE__ = "true";
      await expect(
        buildNoelleHexereiEquipmentResponseSurfaceReport(fixture()),
      ).rejects.toThrow("requires the authenticated non-beta runtime branch");
    } finally {
      if (previousOverride === undefined) {
        delete process.env.__BETA_ENABLED_OVERRIDE__;
      } else {
        process.env.__BETA_ENABLED_OVERRIDE__ = previousOverride;
      }
    }
  });

  it("rejects source bytes, hashes, duplicate paths, and incomplete closures", async () => {
    const nonCanonicalBase64 = fixture();
    nonCanonicalBase64.sourceFiles[0].bytesBase64 = "AA";
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(nonCanonicalBase64),
    ).rejects.toThrow("failed base64 round-trip");

    const byteTamper = fixture();
    byteTamper.sourceFiles[0].bytesBase64 = Buffer.from(
      `${Buffer.from(byteTamper.sourceFiles[0].bytesBase64, "base64").toString("utf8")}\n`,
      "utf8",
    ).toString("base64");
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(byteTamper),
    ).rejects.toThrow("supplied source bytes do not match the workspace file");

    const hashTamper = fixture();
    hashTamper.generatedFrom[0].sha256 = "0".repeat(64);
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(hashTamper),
    ).rejects.toThrow("source/hash authentication drifted");

    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(0, -1);
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(missing),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const duplicate = fixture();
    duplicate.sourceFiles = duplicate.sourceFiles.map((source, index) =>
      index === 1 ? { ...duplicate.sourceFiles[0] } : source,
    );
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(duplicate),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const missingGeneratedFrom = fixture();
    missingGeneratedFrom.generatedFrom = missingGeneratedFrom.generatedFrom.slice(
      0,
      -1,
    );
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(missingGeneratedFrom),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const duplicateGeneratedFrom = fixture();
    duplicateGeneratedFrom.generatedFrom =
      duplicateGeneratedFrom.generatedFrom.map((generated, index) =>
        index === 1 ? { ...duplicateGeneratedFrom.generatedFrom[0] } : generated,
      );
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(duplicateGeneratedFrom),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");
  });

  it("rejects request, upstream-input, resealed CP54, and serialized-output tampering", async () => {
    const requestTamper = fixture();
    (
      requestTamper.technicalRequest.calcContext as { enemyLevel: number }
    ).enemyLevel = 101;
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(requestTamper),
    ).rejects.toThrow("technical request differs");

    const inputTamper = fixture();
    inputTamper.cp54Input.generatedFrom[0].sha256 = "f".repeat(64);
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(inputTamper),
    ).rejects.toThrow("exact projection of the outer authenticated byte closure");

    const cp54SplitBrain = fixture();
    (
      cp54SplitBrain.cp54ReportInput.operationSummary as {
        optimizerRunCount: number;
      }
    ).optimizerRunCount = 1;
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(cp54SplitBrain),
    ).rejects.toThrow(
      "CP54 durable report bytes disagree with the supplied parsed object",
    );

    const cp54Tamper = fixture();
    (
      cp54Tamper.cp54ReportInput.operationSummary as {
        optimizerRunCount: number;
      }
    ).optimizerRunCount = 1;
    replaceSourceBytes(
      cp54Tamper,
      NOELLE_HEXEREI_CP54_REPORT_RELATIVE_PATH,
      Buffer.from(stableJson(cp54Tamper.cp54ReportInput), "utf8"),
    );
    await expect(
      buildNoelleHexereiEquipmentResponseSurfaceReport(cp54Tamper),
    ).rejects.toThrow("supplied source bytes do not match the workspace file");

    const outputTamper = structuredClone(report);
    outputTamper.surface.cells[0].objective.directTotal += 1;
    const authentication =
      await authenticateNoelleHexereiEquipmentResponseSurfaceReport(
        outputTamper,
        baseInput,
      );
    expect(authentication).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });
});

function profileIdFromEnteredFacts(
  constellation: number,
  burstTalentLevel: number,
):
  | "noelle-lower-investment-artifact-profile-v1"
  | "noelle-high-investment-artifact-profile-v1"
  | null {
  const lower = constellation <= 5 && burstTalentLevel === 9;
  const high = constellation >= 6 || burstTalentLevel >= 10;
  if (lower === high) return null;
  return lower
    ? "noelle-lower-investment-artifact-profile-v1"
    : "noelle-high-investment-artifact-profile-v1";
}

function expectedOrderedCellIds(): string[] {
  return EXPECTED_WITNESSES.flatMap(({ witnessId }) =>
    SANDS.flatMap((sands) =>
      CIRCLETS.flatMap((circlet) =>
        REFINEMENTS.map((refinement) =>
          responseCellId(witnessId, sands, circlet, refinement),
        ),
      ),
    ),
  );
}

function expectedArtifactSheetEntries(
  sands: (typeof SANDS)[number],
  circlet: (typeof CIRCLETS)[number],
): Array<{ key: string; filterKey: string; value: number }> {
  return [
    { key: "hp", filterKey: "", value: 4780 },
    { key: "atk", filterKey: "", value: 311 },
    {
      key: sands,
      filterKey: "",
      value: sands === "atk%" ? 0.466 : 0.583,
    },
    { key: "dmg%", filterKey: "e:Geo", value: 0.466 },
    {
      key: circlet,
      filterKey: "",
      value: circlet === "cr" ? 0.311 : 0.622,
    },
  ].sort((left, right) =>
    `${left.key}\0${left.filterKey}`.localeCompare(
      `${right.key}\0${right.filterKey}`,
      "en",
    ),
  );
}

function expectedComparisonEdges(): Array<{
  comparisonId: string;
  changedAxis: "sands" | "circlet" | "refinement";
  leftCellId: string;
  rightCellId: string;
  leftAxisValue: string | number;
  rightAxisValue: string | number;
  fixedAxisPayload: {
    witnessId: string;
    sands: string | null;
    circlet: string | null;
    refinement: number | null;
  };
}> {
  const edges: ReturnType<typeof expectedComparisonEdges> = [];
  for (const { witnessId } of EXPECTED_WITNESSES) {
    for (const circlet of CIRCLETS) {
      for (const refinement of REFINEMENTS) {
        edges.push(
          expectedComparisonEdge(
            "sands",
            responseCellId(witnessId, "atk%", circlet, refinement),
            responseCellId(witnessId, "def%", circlet, refinement),
            "atk%",
            "def%",
            { witnessId, sands: null, circlet, refinement },
          ),
        );
      }
    }
    for (const sands of SANDS) {
      for (const refinement of REFINEMENTS) {
        edges.push(
          expectedComparisonEdge(
            "circlet",
            responseCellId(witnessId, sands, "cr", refinement),
            responseCellId(witnessId, sands, "cd", refinement),
            "cr",
            "cd",
            { witnessId, sands, circlet: null, refinement },
          ),
        );
      }
    }
    for (const sands of SANDS) {
      for (const circlet of CIRCLETS) {
        edges.push(
          expectedComparisonEdge(
            "refinement",
            responseCellId(witnessId, sands, circlet, 1),
            responseCellId(witnessId, sands, circlet, 5),
            1,
            5,
            { witnessId, sands, circlet, refinement: null },
          ),
        );
      }
    }
  }
  return edges;
}

function expectedComparisonEdge(
  changedAxis: "sands" | "circlet" | "refinement",
  leftCellId: string,
  rightCellId: string,
  leftAxisValue: string | number,
  rightAxisValue: string | number,
  fixedAxisPayload: {
    witnessId: string;
    sands: string | null;
    circlet: string | null;
    refinement: number | null;
  },
): ReturnType<typeof expectedComparisonEdges>[number] {
  return {
    comparisonId: `${changedAxis}:${leftCellId}::${rightCellId}`,
    changedAxis,
    leftCellId,
    rightCellId,
    leftAxisValue,
    rightAxisValue,
    fixedAxisPayload,
  };
}

function responseCellId(
  witnessId: string,
  sands: (typeof SANDS)[number],
  circlet: (typeof CIRCLETS)[number],
  refinement: (typeof REFINEMENTS)[number],
): string {
  return [witnessId, sands, circlet, `r${refinement}`].join(":");
}

function normalizeNumberForTest(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Non-finite test value ${value}.`);
  return Number(value.toPrecision(15));
}

function signForDelta(delta: number): "negative" | "positive" | "tie" {
  const tolerance = Math.max(
    1e-9,
    1e-12 * Math.max(1, Math.abs(delta)),
  );
  return delta > tolerance
    ? "positive"
    : delta < -tolerance
      ? "negative"
      : "tie";
}

function sha256Stable(value: unknown): string {
  return sha256(Buffer.from(stableJson(value), "utf8"));
}

function requireCell(cellId: string): NoelleHexereiEquipmentResponseCell {
  const cell = report.surface.cells.find((candidate) => candidate.cellId === cellId);
  if (!cell) throw new Error(`Missing test cell ${cellId}.`);
  return cell;
}

function changedAxes(
  left: NoelleHexereiEquipmentResponseCell,
  right: NoelleHexereiEquipmentResponseCell,
): string[] {
  return [
    left.witnessId === right.witnessId ? null : "witness",
    left.sands === right.sands ? null : "sands",
    left.circlet === right.circlet ? null : "circlet",
    left.refinement === right.refinement ? null : "refinement",
  ].filter((axis): axis is string => axis !== null);
}

function fixture(): NoelleHexereiEquipmentResponseSurfaceInput {
  return structuredClone(baseInput);
}

function replaceSourceBytes(
  input: NoelleHexereiEquipmentResponseSurfaceInput,
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

async function readJsonReport(): Promise<NoelleHexereiEquipmentResponseSurfaceReport> {
  const text = await readFile(
    NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
    "utf8",
  );
  return JSON.parse(text) as NoelleHexereiEquipmentResponseSurfaceReport;
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
