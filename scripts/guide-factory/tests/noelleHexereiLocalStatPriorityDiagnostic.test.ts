import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { AVG_SUBSTAT_ROLL } from "@/lib/artifact/scoring/constants";
import * as ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

import {
  formatNoelleHexereiLocalStatPriorityDiagnosticSummary,
  loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace,
} from "../src/assemble-noelle-hexerei-local-stat-priority-diagnostic";
import { stableJson } from "../src/io";
import {
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
  NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS,
  type NoelleHexereiEquipmentResponseCell,
  type NoelleHexereiEquipmentResponseSurfaceReport,
} from "../src/noelleHexereiEquipmentResponseSurface";
import {
  authenticateNoelleHexereiLocalStatPriorityDiagnosticReport,
  buildNoelleHexereiLocalStatPriorityDiagnosticReport,
  NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CLI_RELATIVE_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CORE_RELATIVE_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
  NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
  NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
  type NoelleHexereiApplicableBuffTraceCatalogEntry,
  type NoelleHexereiArtifactSheetCatalogEntry,
  type NoelleHexereiDiagnosticProbeState,
  type NoelleHexereiLocalStatPriorityCell,
  type NoelleHexereiLocalStatPriorityDiagnosticInput,
  type NoelleHexereiLocalStatPriorityDiagnosticReport,
  type NoelleHexereiOrdinalOutcome,
} from "../src/noelleHexereiLocalStatPriorityDiagnostic";
import {
  evaluateNoelleHexereiTechnicalPoint,
  NOELLE_HEXEREI_POINT_AVERAGE_ROLLS,
  NOELLE_HEXEREI_POINT_CIRCLET_STATS,
  NOELLE_HEXEREI_POINT_HUSK_STACKS,
  NOELLE_HEXEREI_POINT_NICOLE_MODES,
  NOELLE_HEXEREI_POINT_PROBE_STATS,
  NOELLE_HEXEREI_POINT_REFINEMENTS,
  NOELLE_HEXEREI_POINT_WITNESSES,
  type NoelleHexereiTechnicalPointEvaluation,
  type NoelleHexereiTechnicalPointProbeStat,
  type NoelleHexereiTechnicalPointRequest,
} from "../src/noelleHexereiTechnicalPointEvaluator";
import { REPOSITORY_ROOT } from "../src/paths";

const LONG_TIMEOUT = 180_000;
const PROBE_STATES = [
  "baseline",
  ...NOELLE_HEXEREI_POINT_PROBE_STATS,
] as const satisfies readonly NoelleHexereiDiagnosticProbeState[];

type SourceRelation = {
  relationId: string;
  higherStat: NoelleHexereiTechnicalPointProbeStat;
  lowerStat: NoelleHexereiTechnicalPointProbeStat;
};

const SOURCE_RELATIONS = {
  "noelle-lower-investment-artifact-profile-v1": [
    { relationId: "p1-cr-over-p2-atk", higherStat: "cr", lowerStat: "atk%" },
    { relationId: "p1-cd-over-p2-atk", higherStat: "cd", lowerStat: "atk%" },
    {
      relationId: "p2-atk-over-p3-def",
      higherStat: "atk%",
      lowerStat: "def%",
    },
  ],
  "noelle-high-investment-artifact-profile-v1": [
    { relationId: "p1-cr-over-p2-def", higherStat: "cr", lowerStat: "def%" },
    { relationId: "p1-cd-over-p2-def", higherStat: "cd", lowerStat: "def%" },
    {
      relationId: "p2-def-over-p3-atk",
      higherStat: "def%",
      lowerStat: "atk%",
    },
  ],
} as const satisfies Record<string, readonly SourceRelation[]>;

let baseInput: NoelleHexereiLocalStatPriorityDiagnosticInput;
let durableReport: NoelleHexereiLocalStatPriorityDiagnosticReport;
let report: NoelleHexereiLocalStatPriorityDiagnosticReport;
let cp55Report: NoelleHexereiEquipmentResponseSurfaceReport;

beforeAll(async () => {
  [baseInput, durableReport, cp55Report] = await Promise.all([
    loadNoelleHexereiLocalStatPriorityDiagnosticInputFromWorkspace(),
    readJsonReport<NoelleHexereiLocalStatPriorityDiagnosticReport>(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
    ),
    readJsonReport<NoelleHexereiEquipmentResponseSurfaceReport>(
      NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH,
    ),
  ]);
  const authentication =
    await authenticateNoelleHexereiLocalStatPriorityDiagnosticReport(
      durableReport,
      baseInput,
    );
  if (!authentication.authenticated) {
    throw new Error(
      `Expected the durable CP56 report to authenticate: ${authentication.message}`,
    );
  }
  report = authentication.canonicalReport;
}, LONG_TIMEOUT);

describe("Noelle Hexerei local stat-priority diagnostic", () => {
  it("fresh-authenticates one deterministic durable report", async () => {
    expect(stableJson(report)).toBe(stableJson(durableReport));
    await expect(
      readFile(
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REPORT_PATH,
        "utf8",
      ),
    ).resolves.toBe(stableJson(report));
    expect(formatNoelleHexereiLocalStatPriorityDiagnosticSummary(report)).toBe(
      "Completed 480-cell Noelle local-stat diagnostic; 384 one-roll marginals, 480 Nicole/Husk sensitivity edges, 288 ordinal diagnostics, 72 context-robustness rows, 24 CP55 reproductions, selections/ER: 0/0.",
    );
  });

  it("authenticates the exact 116-path, 80-runtime, 14-JSON, two-binary closure", async () => {
    const expectedPaths = [
      ...new Set([
        ...NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS,
        NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
        NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CORE_RELATIVE_PATH,
        NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CLI_RELATIVE_PATH,
      ]),
    ].sort(compareText);
    expect(expectedPaths).toHaveLength(116);
    expect(NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS).toEqual(
      expectedPaths,
    );
    expect(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
    ).toHaveLength(80);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json")))
      .toHaveLength(14);
    expect(expectedPaths.filter((sourcePath) => sourcePath.endsWith(".json.gz")))
      .toHaveLength(2);
    expect(baseInput.sourceFiles.map(({ path: sourcePath }) => sourcePath)).toEqual(
      expectedPaths,
    );
    expect(baseInput.generatedFrom.map(({ path: sourcePath }) => sourcePath)).toEqual(
      expectedPaths,
    );
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactSourceFilePathSet: true,
      exactGeneratedFromPathSet: true,
      allGeneratedFromHashesAuthenticatedFromBytes: true,
      allSourceBytesMatchWorkspaceFiles: true,
      cp55ReportByteAndParsedObjectParity: true,
      exactCp55InputProjection: true,
      exactTechnicalRequest: true,
      sourceFileCount: 116,
      generatedFromCount: 116,
      runtimeInputPathCount: 80,
      jsonInputCount: 14,
      binaryRuntimeInputCount: 2,
    });
    expect(baseInput.technicalRequest).toEqual(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_REQUEST,
    );
    expect(baseInput.cp55ReportInput).toEqual(cp55Report);
    expect(baseInput.cp55Input.sourceFiles.map(({ path: sourcePath }) => sourcePath))
      .toEqual(NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS);
    expect(baseInput.cp55Input.generatedFrom.map(({ path: sourcePath }) => sourcePath))
      .toEqual(NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_INPUT_PATHS);

    await Promise.all(
      baseInput.sourceFiles.map(async (source) => {
        const bytes = Buffer.from(source.bytesBase64, "base64");
        const generated = baseInput.generatedFrom.find(
          ({ path: sourcePath }) => sourcePath === source.path,
        );
        expect(bytes.toString("base64")).toBe(source.bytesBase64);
        expect(generated?.sha256).toBe(sha256(bytes));
        await expect(
          readFile(path.join(REPOSITORY_ROOT, source.path)),
        ).resolves.toEqual(bytes);
      }),
    );
    expect(report.generatedFrom).toEqual(baseInput.generatedFrom);
    expect(report.upstreamBoundary).toMatchObject({
      cp55ReportPath: NOELLE_HEXEREI_CP55_REPORT_RELATIVE_PATH,
      cp55ReportFileSha256: sha256(
        await readFile(NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_REPORT_PATH),
      ),
      cp55CanonicalObjectSha256: hashValue(cp55Report),
      cp55FreshlyAuthenticated: true,
      cp55CellCount: 48,
      cp55SelectionCount: 0,
      cp55EnergyRecoveryComputationCount: 0,
      sourceAlignedDefaultBaselineReproductionCount: 24,
      everySourceAlignedDefaultBaselineExactlyReproduced: true,
    });
  }, LONG_TIMEOUT);

  it("independently derives the exact reachable first-party runtime closure", async () => {
    expect(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
    ).toEqual(NOELLE_HEXEREI_EQUIPMENT_RESPONSE_SURFACE_RUNTIME_INPUT_PATHS);
    expect(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS.some(
        (sourcePath) => sourcePath.includes("/ercalc/"),
      ),
    ).toBe(false);

    const declaredPaths = new Set<string>(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_INPUT_PATHS,
    );
    const runtimePaths = new Set<string>(
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_RUNTIME_INPUT_PATHS,
    );
    const implementationPaths = [
      NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CORE_RELATIVE_PATH,
      NOELLE_HEXEREI_LOCAL_STAT_PRIORITY_DIAGNOSTIC_CLI_RELATIVE_PATH,
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
      for (const importedPath of await importsFor(sourcePath)) {
        if (!runtimePaths.has(importedPath)) {
          missingRuntimeImports.push(`${sourcePath} -> ${importedPath}`);
        }
      }
    }
    expect(missingRuntimeImports).toEqual([]);

    const missingImplementationImports: string[] = [];
    for (const sourcePath of implementationPaths) {
      for (const importedPath of await importsFor(sourcePath)) {
        if (!declaredPaths.has(importedPath)) {
          missingImplementationImports.push(`${sourcePath} -> ${importedPath}`);
        }
      }
    }
    expect(missingImplementationImports).toEqual([]);

    const reachable = new Set<string>();
    const queue = (await importsFor(
      NOELLE_HEXEREI_TECHNICAL_POINT_EVALUATOR_RELATIVE_PATH,
    )).filter((sourcePath) => runtimePaths.has(sourcePath));
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      if (!sourcePath || reachable.has(sourcePath)) continue;
      reachable.add(sourcePath);
      for (const importedPath of await importsFor(sourcePath)) {
        if (runtimePaths.has(importedPath) && !reachable.has(importedPath)) {
          queue.push(importedPath);
        }
      }
    }
    expect([...reachable].sort(compareText)).toEqual(
      [...runtimePaths].sort(compareText),
    );
  });

  it("preserves only the two source ordinal targets and their adjacent relations", () => {
    expect(report.sourcePriorityTargets).toHaveLength(2);
    const byProfile = new Map(
      report.sourcePriorityTargets.map((target) => [target.profileId, target]),
    );
    expect(byProfile.get("noelle-lower-investment-artifact-profile-v1"))
      .toEqual({
        profileId: "noelle-lower-investment-artifact-profile-v1",
        sourcePriorityGroups: [["cr", "cd"], ["atk%"], ["def%"]],
        adjacentRelations:
          SOURCE_RELATIONS["noelle-lower-investment-artifact-profile-v1"],
        sourceScalarWeights: null,
        sourceSelectedAllocation: null,
      });
    expect(byProfile.get("noelle-high-investment-artifact-profile-v1"))
      .toEqual({
        profileId: "noelle-high-investment-artifact-profile-v1",
        sourcePriorityGroups: [["cr", "cd"], ["def%"], ["atk%"]],
        adjacentRelations:
          SOURCE_RELATIONS["noelle-high-investment-artifact-profile-v1"],
        sourceScalarWeights: null,
        sourceSelectedAllocation: null,
      });
    expect(
      report.sourcePriorityTargets
        .flatMap(({ adjacentRelations }) => adjacentRelations)
        .some(
          ({ higherStat, lowerStat }) =>
            (higherStat === "cr" && lowerStat === "cd") ||
            (higherStat === "cd" && lowerStat === "cr"),
        ),
    ).toBe(false);
    expect(report.requestBoundary).toMatchObject({
      sourceAuthored: false,
      sourceCandidateSelection: null,
      sourceStatSelection: null,
      sourceSupportOptionSelection: null,
      sourceHuskStackSelection: null,
      sourceRefinementSelection: null,
      sourceArtifactPlacementSelection: null,
      energyRecoveryDeferred: true,
    });
  });

  it("executes the exact ordered 96-baseline and 384-probe lattice", () => {
    const expectedCellIds = expectedOrderedCellIds();
    expect(expectedCellIds).toHaveLength(480);
    expect(new Set(expectedCellIds).size).toBe(480);
    expect(report.cells).toHaveLength(480);
    expect(report.cells.map(({ cellId }) => cellId)).toEqual(expectedCellIds);
    expect(report.cells.map(({ sequence }) => sequence)).toEqual(
      Array.from({ length: 480 }, (_, index) => index),
    );
    expect(new Set(report.cells.map(({ cellSha256 }) => cellSha256)).size).toBe(
      480,
    );
    expect(
      new Set(
        report.cells.map(
          ({ evaluation }) => evaluation.evaluationInputSha256,
        ),
      ).size,
    ).toBe(480);

    const baselines = report.cells.filter(({ probe }) => probe.stat == null);
    const probes = report.cells.filter(({ probe }) => probe.stat != null);
    expect(baselines).toHaveLength(96);
    expect(probes).toHaveLength(384);
    for (const cell of report.cells) {
      const witness = requireWitness(cell.witnessId);
      expect(cell.profileId).toBe(witness.profileId);
      expect(cell.sourceAlignedSands).toBe(witness.sourceAlignedSands);
      expect(cell.cellId).toBe(pointId(requestForCell(cell)));
      expect(cell.evaluation.witness).toEqual({
        profileId: witness.profileId,
        constellation: witness.constellation,
        enteredTalentLevels: witness.enteredTalentLevels,
        runtimeEffectiveTalentLevels: witness.runtimeEffectiveTalentLevels,
        sourcePredicateSatisfiedByEnteredFacts: true,
        runtimeTalentEvidence: {
          expectedLevelsDerivedFromAuthenticatedCharacterMetadata: true,
          autoFormulaMultipliersMatchExpectedLevel: true,
          burstConversionMatchesExpectedLevel: true,
          skillLevelNotUsedByObjective: true,
        },
      });
      expect(cell.evaluation.probe).toEqual({
        stat: cell.probe.stat,
        value: cell.probe.averageRollValue,
        valueOrigin: cell.probe.averageRollValueOrigin,
        independentOneRollNeighbor: cell.probe.independentOneRollNeighbor,
      });
      expect(cell.parentBaselineCellId).toBe(
        cell.probe.stat == null ? null : baselineIdForCell(cell),
      );
      expect(cell.directTotal).toBe(cell.evaluation.objective.directTotal);
      expect(cell.cellInputSha256).toBe(
        hashValue({
          request: requestForCell(cell),
          parentBaselineCellId: cell.parentBaselineCellId,
          evaluationInputSha256: cell.evaluation.evaluationInputSha256,
        }),
      );
      const { cellSha256, ...withoutHash } = cell;
      expect(cellSha256).toBe(hashValue(withoutHash));
    }
  });

  it("authenticates both compact catalogs and reconstructs every helper evaluation", () => {
    expect(report.artifactSheetCatalog).toHaveLength(20);
    expect(report.applicableBuffTraceCatalog).toHaveLength(96);
    expect(
      report.artifactSheetCatalog.reduce(
        (sum, { observedCellCount }) => sum + observedCellCount,
        0,
      ),
    ).toBe(480);
    expect(
      report.applicableBuffTraceCatalog.reduce(
        (sum, { observedCellCount }) => sum + observedCellCount,
        0,
      ),
    ).toBe(480);
    const expectedCellIds = [...report.cells.map(({ cellId }) => cellId)].sort(
      compareText,
    );
    expect(
      report.artifactSheetCatalog
        .flatMap(({ referencingCellIds }) => referencingCellIds)
        .sort(compareText),
    ).toEqual(expectedCellIds);
    expect(
      report.applicableBuffTraceCatalog
        .flatMap(({ referencingCellIds }) => referencingCellIds)
        .sort(compareText),
    ).toEqual(expectedCellIds);

    const sheets = catalogBySheetHash(report.artifactSheetCatalog);
    const traces = catalogByTraceHash(report.applicableBuffTraceCatalog);
    for (const entry of report.artifactSheetCatalog) {
      const { catalogEntrySha256, ...withoutHash } = entry;
      expect(catalogEntrySha256).toBe(hashValue(withoutHash));
      expect(entry.normalizedEntriesSha256).toBe(
        hashValue(entry.normalizedEntries),
      );
      expect(entry.observedCellCount).toBe(entry.referencingCellIds.length);
      expect(entry.referencingCellIds).toEqual(
        [...entry.referencingCellIds].sort(compareText),
      );
    }
    for (const entry of report.applicableBuffTraceCatalog) {
      const { catalogEntrySha256, ...withoutHash } = entry;
      expect(catalogEntrySha256).toBe(hashValue(withoutHash));
      expect(entry.applicableBuffTraceSha256).toBe(hashValue(entry.buffTrace));
      expect(entry.canonicalApplicableBuffTraceSha256).toBe(
        canonicalBuffTraceSha256(entry.buffTrace),
      );
      expect(entry.observedCellCount).toBe(entry.referencingCellIds.length);
      expect(entry.referencingCellIds).toEqual(
        [...entry.referencingCellIds].sort(compareText),
      );
    }

    for (const cell of report.cells) {
      const sheet = sheets.get(
        cell.evaluation.artifactSheet.normalizedEntriesSha256,
      );
      const trace = traces.get(
        cell.evaluation.runtimeTrace.applicableBuffTraceSha256,
      );
      expect(sheet?.referencingCellIds).toContain(cell.cellId);
      expect(trace?.referencingCellIds).toContain(cell.cellId);
      if (!sheet || !trace) throw new Error(`Missing catalog for ${cell.cellId}.`);
      const {
        canonicalApplicableBuffTraceSha256: _canonicalTrace,
        ...runtimeTraceWithoutCatalogMetadata
      } = cell.evaluation.runtimeTrace;
      const reconstructed: Omit<
        NoelleHexereiTechnicalPointEvaluation,
        "evaluationSha256"
      > = {
        evaluationId: cell.cellId,
        evaluationInputSha256: cell.evaluation.evaluationInputSha256,
        request: requestForCell(cell),
        witness: cell.evaluation.witness,
        probe: cell.evaluation.probe,
        artifactSheet: {
          ...cell.evaluation.artifactSheet,
          normalizedEntries: sheet.normalizedEntries,
        },
        runtimeTrace: {
          ...runtimeTraceWithoutCatalogMetadata,
          buffTrace: trace.buffTrace,
        },
        formulaProjection: cell.evaluation.formulaProjection,
        objective: cell.evaluation.objective,
      };
      expect(cell.evaluation.evaluationSha256).toBe(hashValue(reconstructed));
    }

    const identity = report.identityBoundary;
    expect(identity.artifactSheetCatalogSha256).toBe(
      hashValue(
        report.artifactSheetCatalog.map(
          ({ catalogEntrySha256 }) => catalogEntrySha256,
        ),
      ),
    );
    expect(identity.applicableBuffTraceCatalogSha256).toBe(
      hashValue(
        report.applicableBuffTraceCatalog.map(
          ({ catalogEntrySha256 }) => catalogEntrySha256,
        ),
      ),
    );
    expect(identity.everyCellCatalogReferenceResolvedExactlyOnce).toBe(true);
    expect(
      identity.everyEvaluationSha256ReconstructedFromCompactEvidenceAndCatalogs,
    ).toBe(true);
  });

  it("pins the technical objective, runtime buffs, and explicit Husk/Nicole semantics", () => {
    const traces = catalogByTraceHash(report.applicableBuffTraceCatalog);
    expect(report.runtimeOptionEvidence).toEqual({
      evidenceOrigin:
        "authenticated-evaluator-and-runtime-plus-observed-cell-traces",
      huskFourPieceConfiguredCellCount: 480,
      huskFourPieceConfiguredInEveryCell: true,
      huskZeroStackCellCount: 240,
      huskZeroMeansZeroCuriosityStacks: true,
      huskZeroCuriosityBuffAbsentInEveryZeroStackCell: true,
      huskTwoPieceHalfSetId: "def%-30",
      huskTwoPieceDefenseBonus: 0.3,
      huskTwoPieceRetainedAtZeroStacks: true,
      huskTwoPieceRuntimeDifferentialVerifiedInEveryCell: true,
      huskFourStackCellCount: 240,
      huskFourStackDefenseAndGeoBonusVerifiedInEveryFourStackCell: true,
      nicoleAllTheosisCellCount: 240,
      nicoleAllTheosisUpliftAppliedToNoelleInEveryAllTheosisCell: true,
      nicoleHexereiTheosisCellCount: 240,
      nicoleHexereiTheosisUpliftExcludedFromNoelleInEveryHexereiTheosisCell:
        true,
      nicoleTheosisUpliftRegisteredInEveryCell: true,
      nicoleHexereiTheosisRegisteredTargetRestrictedInEveryHexereiTheosisCell:
        true,
      nicoleBaseKenosisRetainedInEveryCell: true,
    });
    for (const cell of report.cells) {
      const evaluation = cell.evaluation;
      const runtime = evaluation.runtimeTrace;
      const trace = traces.get(runtime.applicableBuffTraceSha256);
      if (!trace) throw new Error(`Missing trace for ${cell.cellId}.`);
      expect(runtime.canonicalApplicableBuffTraceSha256).toBe(
        trace.canonicalApplicableBuffTraceSha256,
      );
      expect(runtime.applicableBuffCountForOnFieldNoelle).toBe(
        trace.buffTrace.length,
      );
      expect(runtime.computedBuffOverrideKeys).toEqual([]);
      expect(runtime.compilerErConstraintPresent).toBe(false);
      expect(runtime.gestBuffCount).toBe(3);
      expect(runtime.gestAttackSpeed).toBe(0.1);
      expect(runtime.gestDamageBonus).toBe(cell.refinement === 1 ? 0.3 : 0.62);
      expect(runtime.gestCritDamage).toBe(cell.refinement === 1 ? 0.3 : 0.62);
      expect(runtime.geoResonanceBuffCount).toBe(2);
      expect(runtime.geoResonanceDamageBonus).toBe(0.15);
      expect(runtime.geoResonanceResistanceReduction).toBe(0.2);
      expect(runtime.huskCuriosityBuffCount).toBe(cell.huskStacks === 4 ? 1 : 0);
      expect(runtime.huskDefenseBonus).toBe(cell.huskStacks === 4 ? 0.24 : 0);
      expect(runtime.huskGeoDamageBonus).toBe(cell.huskStacks === 4 ? 0.24 : 0);
      expect(runtime.huskFourPieceConfigured).toBe(true);
      expect(runtime.huskTwoPieceDefenseBonus).toBe(0.3);
      expect(runtime.huskTwoPieceControlTeamBuildMaterialized).toBe(true);
      expect(runtime.nicoleTheosisUpliftApplicableCountForNoelle).toBe(
        cell.nicoleMode === "all-theosis" ? 1 : 0,
      );
      expect(runtime.nicoleTheosisUpliftRegisteredCount).toBe(1);
      expect(runtime.nicoleTheosisUpliftRegisteredTarget).toEqual(
        cell.nicoleMode === "all-theosis"
          ? { receiver: "team" }
          : { receiver: "team", factions: ["Hexerei"] },
      );
      expect(runtime.nicoleBaseKenosisApplicableCountForNoelle).toBe(1);
      expect(runtime.teammateWeaponBuffCount).toBe(0);
      expect(runtime.exactRequiredBuffValuesVerified).toBe(true);
      expect(evaluation.formulaProjection).toEqual({
        projectedPartHits: [5, 5, 3],
        omittedPartIndexes: [3],
        originalEntryIdentityRestored: true,
        formulaIndexSizeRestored: true,
        formulaIndexOrderAndEntryIdentitiesRestored: true,
      });
      expect(evaluation.objective.directCompiledAgreement).toBe(true);
      expect(evaluation.objective.absoluteDifference).toBeLessThanOrEqual(
        evaluation.objective.allowedDifference,
      );
      expect(evaluation.objective.numericClassification).toBe(
        "technical-fixture-local-only",
      );
      expect(evaluation.objective.resolvedNoelleStats).not.toHaveProperty(
        "geoDamageBonus",
      );
      expect(
        evaluation.objective.resolvedNoelleStats.geoNormalDamageBonus,
      ).toBeGreaterThan(0);
    }
  });

  it("proves every probe is exactly one current average roll and derives 384 local marginals", () => {
    expect(NOELLE_HEXEREI_POINT_AVERAGE_ROLLS).toEqual({
      cr: AVG_SUBSTAT_ROLL.cr,
      cd: AVG_SUBSTAT_ROLL.cd,
      "atk%": AVG_SUBSTAT_ROLL["atk%"],
      "def%": AVG_SUBSTAT_ROLL["def%"],
    });
    expect(report.experimentalDomain.averageRollDeltas).toEqual(
      NOELLE_HEXEREI_POINT_AVERAGE_ROLLS,
    );
    const cellById = new Map(
      report.cells.map((cell) => [cell.cellId, cell] as const),
    );
    const sheets = catalogBySheetHash(report.artifactSheetCatalog);
    const marginalByProbe = new Map(
      report.localMarginals.map((marginal) => [marginal.probeCellId, marginal]),
    );
    expect(report.localMarginals).toHaveLength(384);
    expect(marginalByProbe.size).toBe(384);

    for (const cell of report.cells) {
      const sheet = sheets.get(
        cell.evaluation.artifactSheet.normalizedEntriesSha256,
      );
      if (!sheet) throw new Error(`Missing sheet for ${cell.cellId}.`);
      expect(cell.evaluation.artifactSheet.mainStats).toEqual([
        "hp",
        "atk",
        cell.sourceAlignedSands,
        "geo%",
        cell.circlet,
      ]);
      expect(
        sheet.normalizedEntries.some(
          ({ key, filterKey }) => key === "dmg%" && filterKey === "e:Geo",
        ),
      ).toBe(true);
      expect(sheet.normalizedEntries.some(({ key }) => key === "er")).toBe(
        false,
      );

      if (cell.probe.stat == null) {
        expect(cell.probe).toEqual({
          probeState: "baseline",
          stat: null,
          averageRollValue: 0,
          averageRollValueOrigin: "not-applicable-baseline",
          nonConflictingPlacementSlotDomain: [],
          placementSlotChosen: null,
          placementSelectionExecuted: false,
          independentOneRollNeighbor: false,
        });
        expect(cell.evaluation.artifactSheet.substatEntryCount).toBe(0);
        continue;
      }

      const baseline = cellById.get(cell.parentBaselineCellId ?? "");
      if (!baseline) throw new Error(`Missing parent for ${cell.cellId}.`);
      const baselineSheet = sheets.get(
        baseline.evaluation.artifactSheet.normalizedEntriesSha256,
      );
      if (!baselineSheet) throw new Error(`Missing parent sheet ${baseline.cellId}.`);
      expect(changedCellAxes(baseline, cell)).toEqual(["probeState"]);
      expect(cell.probe.averageRollValue).toBe(
        NOELLE_HEXEREI_POINT_AVERAGE_ROLLS[cell.probe.stat],
      );
      expect(cell.probe.nonConflictingPlacementSlotDomain).toEqual(
        expectedPlacementDomain(
          cell.probe.stat,
          cell.sourceAlignedSands,
          cell.circlet,
        ),
      );
      expect(cell.probe.placementSlotChosen).toBeNull();
      expect(cell.probe.placementSelectionExecuted).toBe(false);
      expect(cell.evaluation.artifactSheet.substatEntryCount).toBe(1);
      assertOneSheetEntryDelta(
        baselineSheet.normalizedEntries,
        sheet.normalizedEntries,
        cell.probe.stat,
        cell.probe.averageRollValue,
      );

      const marginal = marginalByProbe.get(cell.cellId);
      if (!marginal) throw new Error(`Missing marginal ${cell.cellId}.`);
      expect(marginal).toMatchObject({
        marginalId: `${cell.cellId}:minus:${baseline.cellId}`,
        baselineCellId: baseline.cellId,
        probeCellId: cell.cellId,
        probeStat: cell.probe.stat,
        averageRollValue: cell.probe.averageRollValue,
        absoluteDelta: normalizeNumber(cell.directTotal - baseline.directTotal),
        relativeDelta: normalizeNumber(
          (cell.directTotal - baseline.directTotal) / baseline.directTotal,
        ),
        localOneStepNeighborOnly: true,
        scalarWeight: null,
      });
      expect(marginal.absoluteDelta).toBeGreaterThan(0);
      const { marginalSha256, ...withoutHash } = marginal;
      expect(marginalSha256).toBe(hashValue(withoutHash));
    }
  });

  it("exactly reproduces all 24 source-aligned CP55 default baselines", () => {
    expect(report.cp55Reproductions).toHaveLength(24);
    const cells = new Map(
      report.cells.map((cell) => [cell.cellId, cell] as const),
    );
    const expectedCp55Ids: string[] = [];
    for (const witness of NOELLE_HEXEREI_POINT_WITNESSES) {
      for (const circlet of NOELLE_HEXEREI_POINT_CIRCLET_STATS) {
        for (const refinement of NOELLE_HEXEREI_POINT_REFINEMENTS) {
          const cp55Cell = requireCp55Cell(
            witness.witnessId,
            witness.sourceAlignedSands,
            circlet,
            refinement,
          );
          const cp56Id = pointId({
            witnessId: witness.witnessId,
            sourceAlignedSands: witness.sourceAlignedSands,
            circlet,
            refinement,
            nicoleMode: "all-theosis",
            huskStacks: 4,
            probeStat: null,
          });
          const cp56Cell = cells.get(cp56Id);
          if (!cp56Cell) throw new Error(`Missing CP56 control ${cp56Id}.`);
          const reproduction = report.cp55Reproductions.find(
            ({ cp55CellId }) => cp55CellId === cp55Cell.cellId,
          );
          if (!reproduction) throw new Error(`Missing reproduction ${cp55Cell.cellId}.`);
          expectedCp55Ids.push(cp55Cell.cellId);
          const cp55Projection = cp55ComparableProjection(cp55Cell);
          const cp56Projection = cp56ComparableProjection(cp56Cell);
          expect(stableJson(cp56Projection)).toBe(stableJson(cp55Projection));
          expect(reproduction).toMatchObject({
            reproductionId: `cp55:${cp55Cell.cellId}:reproduced-by:${cp56Id}`,
            cp55CellId: cp55Cell.cellId,
            cp56CellId: cp56Id,
            witnessId: witness.witnessId,
            circlet,
            refinement,
            nicoleMode: "all-theosis",
            huskStacks: 4,
            sourceAlignedSandsOnly: true,
            cp55ComparableProjectionSha256: hashValue(cp55Projection),
            cp56ComparableProjectionSha256: hashValue(cp56Projection),
            exactComparableProjectionMatch: true,
          });
          const { reproductionSha256, ...withoutHash } = reproduction;
          expect(reproductionSha256).toBe(hashValue(withoutHash));
        }
      }
    }
    expect(report.cp55Reproductions.map(({ cp55CellId }) => cp55CellId)).toEqual(
      expectedCp55Ids,
    );
  });

  it("builds exactly 480 Nicole/Husk edges with one changed axis", () => {
    expect(report.sensitivityEdges).toHaveLength(480);
    expect(
      report.sensitivityEdges.filter(({ changedAxis }) => changedAxis === "nicoleMode"),
    ).toHaveLength(240);
    expect(
      report.sensitivityEdges.filter(({ changedAxis }) => changedAxis === "huskStacks"),
    ).toHaveLength(240);
    for (const probeState of PROBE_STATES) {
      expect(
        report.sensitivityEdges.filter(
          ({ probeState: observed }) => observed === probeState,
        ),
      ).toHaveLength(96);
    }
    const cells = new Map(
      report.cells.map((cell) => [cell.cellId, cell] as const),
    );
    for (const edge of report.sensitivityEdges) {
      const left = cells.get(edge.leftCellId);
      const right = cells.get(edge.rightCellId);
      if (!left || !right) throw new Error(`Missing edge cells ${edge.edgeId}.`);
      expect(changedCellAxes(left, right)).toEqual([edge.changedAxis]);
      expect(edge.edgeId).toBe(
        `${edge.changedAxis}:${left.cellId}::${right.cellId}`,
      );
      expect(edge.probeState).toBe(left.probe.probeState);
      expect(edge.exactlyOneSensitivityAxisChanged).toBe(true);
      expect(edge.fixedAxisPayloadSha256).toBe(
        hashValue({
          witnessId: left.witnessId,
          sourceAlignedSands: left.sourceAlignedSands,
          circlet: left.circlet,
          refinement: left.refinement,
          nicoleMode: edge.changedAxis === "nicoleMode" ? null : left.nicoleMode,
          huskStacks: edge.changedAxis === "huskStacks" ? null : left.huskStacks,
          probeState: left.probe.probeState,
        }),
      );
      expect(edge.signedLeftMinusRightDelta).toBe(
        normalizeNumber(left.directTotal - right.directTotal),
      );
      expect(edge.sourceExpectedOrdering).toBeNull();
      expect(edge.choiceProduced).toBe(false);
      const { edgeSha256, ...withoutHash } = edge;
      expect(edgeSha256).toBe(hashValue(withoutHash));
    }
  });

  it("derives 288 adjacent source-order diagnostics and preserves all counterexamples", () => {
    expect(report.sourceOrderDiagnostics).toHaveLength(288);
    const marginalById = new Map(
      report.localMarginals.map((marginal) => [marginal.marginalId, marginal]),
    );
    for (const diagnostic of report.sourceOrderDiagnostics) {
      const higher = marginalById.get(diagnostic.higherPriorityMarginalId);
      const lower = marginalById.get(diagnostic.lowerPriorityMarginalId);
      if (!higher || !lower) {
        throw new Error(`Missing diagnostic marginals ${diagnostic.diagnosticId}.`);
      }
      const relation = SOURCE_RELATIONS[diagnostic.profileId].find(
        ({ relationId }) => relationId === diagnostic.sourceRelationId,
      );
      expect(relation).toEqual({
        relationId: diagnostic.sourceRelationId,
        higherStat: diagnostic.higherPriorityStat,
        lowerStat: diagnostic.lowerPriorityStat,
      });
      const signedDelta = higher.absoluteDelta - lower.absoluteDelta;
      const tolerance = comparisonTolerance(
        higher.absoluteDelta,
        lower.absoluteDelta,
      );
      expect(diagnostic.signedHigherMinusLowerDelta).toBe(
        normalizeNumber(signedDelta),
      );
      expect(diagnostic.allowedDifference).toBe(tolerance);
      expect(diagnostic.outcome).toBe(
        signedDelta > tolerance
          ? "source-order-aligned"
          : signedDelta < -tolerance
            ? "source-order-counterexample"
            : "within-tolerance-inconclusive",
      );
      expect(diagnostic.adjacentSourceGroupsOnly).toBe(true);
      expect(diagnostic.validationTargetOnly).toBe(true);
      expect(diagnostic.sourcePriorityValidated).toBe(false);
      const { diagnosticSha256, ...withoutHash } = diagnostic;
      expect(diagnosticSha256).toBe(hashValue(withoutHash));
    }
    expect(census(report.sourceOrderDiagnostics, ({ outcome }) => outcome)).toEqual({
      "source-order-aligned": 242,
      "source-order-counterexample": 46,
    });
    expect(
      census(
        report.sourceOrderDiagnostics,
        ({ profileId, sourceRelationId, outcome }) =>
          `${profileId}|${sourceRelationId}|${outcome}`,
      ),
    ).toEqual({
      "noelle-high-investment-artifact-profile-v1|p1-cd-over-p2-def|source-order-aligned":
        52,
      "noelle-high-investment-artifact-profile-v1|p1-cd-over-p2-def|source-order-counterexample":
        12,
      "noelle-high-investment-artifact-profile-v1|p1-cr-over-p2-def|source-order-aligned":
        62,
      "noelle-high-investment-artifact-profile-v1|p1-cr-over-p2-def|source-order-counterexample":
        2,
      "noelle-high-investment-artifact-profile-v1|p2-def-over-p3-atk|source-order-aligned":
        48,
      "noelle-high-investment-artifact-profile-v1|p2-def-over-p3-atk|source-order-counterexample":
        16,
      "noelle-lower-investment-artifact-profile-v1|p1-cd-over-p2-atk|source-order-aligned":
        32,
      "noelle-lower-investment-artifact-profile-v1|p1-cr-over-p2-atk|source-order-aligned":
        32,
      "noelle-lower-investment-artifact-profile-v1|p2-atk-over-p3-def|source-order-aligned":
        16,
      "noelle-lower-investment-artifact-profile-v1|p2-atk-over-p3-def|source-order-counterexample":
        16,
    });
  });

  it("groups the 288 outcomes into 72 exact four-context robustness rows", () => {
    expect(report.contextRobustnessRows).toHaveLength(72);
    const diagnostics = new Map(
      report.sourceOrderDiagnostics.map((row) => [row.diagnosticId, row] as const),
    );
    for (const row of report.contextRobustnessRows) {
      expect(row.sensitivityContextCount).toBe(4);
      expect(row.diagnosticIds).toHaveLength(4);
      const members = row.diagnosticIds.map((id) => diagnostics.get(id));
      expect(members.every(Boolean)).toBe(true);
      const concrete = members.filter(
        (member): member is NonNullable<typeof member> => member != null,
      );
      expect(
        new Set(
          concrete.map(
            ({ nicoleMode, huskStacks }) => `${nicoleMode}:${huskStacks}`,
          ),
        ).size,
      ).toBe(4);
      const outcomes = concrete.map(({ outcome }) => outcome);
      const aligned = outcomes.filter(
        (outcome) => outcome === "source-order-aligned",
      ).length;
      const counterexamples = outcomes.filter(
        (outcome) => outcome === "source-order-counterexample",
      ).length;
      const inconclusive = outcomes.length - aligned - counterexamples;
      expect(row.sourceOrderAlignedCount).toBe(aligned);
      expect(row.sourceOrderCounterexampleCount).toBe(counterexamples);
      expect(row.withinToleranceInconclusiveCount).toBe(inconclusive);
      expect(row.observedOutcomeSet).toEqual(
        [...new Set(outcomes)].sort(compareText),
      );
      expect(row.classification).toBe(
        aligned === 4
          ? "aligned-across-tested-sensitivity-grid"
          : counterexamples === 4
            ? "counterexample-across-tested-sensitivity-grid"
            : "context-dependent-or-inconclusive",
      );
      expect(row.branchAverageComputed).toBe(false);
      expect(row.scalarWeightComputed).toBe(false);
      expect(row.supportsUniversalPriorityClaim).toBe(false);
      const { robustnessSha256, ...withoutHash } = row;
      expect(robustnessSha256).toBe(hashValue(withoutHash));
    }
    expect(
      census(report.contextRobustnessRows, ({ classification }) => classification),
    ).toEqual({
      "aligned-across-tested-sensitivity-grid": 58,
      "context-dependent-or-inconclusive": 4,
      "counterexample-across-tested-sensitivity-grid": 10,
    });
  });

  it("recomputes every collection identity and keeps all broader operations deferred", () => {
    const identity = report.identityBoundary;
    expect(identity.cellsSha256).toBe(
      hashValue(report.cells.map(({ cellSha256 }) => cellSha256)),
    );
    expect(identity.localMarginalsSha256).toBe(
      hashValue(
        report.localMarginals.map(({ marginalSha256 }) => marginalSha256),
      ),
    );
    expect(identity.sensitivityEdgesSha256).toBe(
      hashValue(report.sensitivityEdges.map(({ edgeSha256 }) => edgeSha256)),
    );
    expect(identity.sourceOrderDiagnosticsSha256).toBe(
      hashValue(
        report.sourceOrderDiagnostics.map(
          ({ diagnosticSha256 }) => diagnosticSha256,
        ),
      ),
    );
    expect(identity.contextRobustnessRowsSha256).toBe(
      hashValue(
        report.contextRobustnessRows.map(
          ({ robustnessSha256 }) => robustnessSha256,
        ),
      ),
    );
    expect(identity.cp55ReproductionsSha256).toBe(
      hashValue(
        report.cp55Reproductions.map(
          ({ reproductionSha256 }) => reproductionSha256,
        ),
      ),
    );
    expect(identity.aggregateDiagnosticSha256).toBe(
      hashValue({
        artifactSheetCatalogSha256: identity.artifactSheetCatalogSha256,
        applicableBuffTraceCatalogSha256:
          identity.applicableBuffTraceCatalogSha256,
        cellsSha256: identity.cellsSha256,
        localMarginalsSha256: identity.localMarginalsSha256,
        sensitivityEdgesSha256: identity.sensitivityEdgesSha256,
        sourceOrderDiagnosticsSha256: identity.sourceOrderDiagnosticsSha256,
        contextRobustnessRowsSha256: identity.contextRobustnessRowsSha256,
        cp55ReproductionsSha256: identity.cp55ReproductionsSha256,
      }),
    );
    expect(report.operationSummary).toEqual({
      countingScope:
        "cp56-local-diagnostic-only-excludes-upstream-authentication-work",
      upstreamAuthenticationOperationsExcluded: true,
      freshlyRecomputedUpstreamCp55CellCount: 48,
      investmentWitnessCount: 6,
      sourceAlignedSandsStateCount: 1,
      circletStateCount: 2,
      refinementStateCount: 2,
      nicoleModeCount: 2,
      huskStackStateCount: 2,
      probeStatCount: 4,
      baselineCellCount: 96,
      probeCellCount: 384,
      freshCellCount: 480,
      freshTeamBuildCount: 960,
      objectiveTeamBuildCount: 480,
      huskTwoPieceControlTeamBuildCount: 480,
      formulaProjectionRunCount: 480,
      compilerBuildCount: 480,
      directDamageEvaluationCount: 480,
      compiledDamageEvaluationCount: 480,
      directCompiledAgreementCount: 480,
      localMarginalCount: 384,
      sensitivityEdgeCount: 480,
      nicoleSensitivityEdgeCount: 240,
      huskSensitivityEdgeCount: 240,
      sourceOrderDiagnosticCount: 288,
      contextRobustnessRowCount: 72,
      cp55ReproductionCount: 24,
      artifactSheetCatalogEntryCount: 20,
      artifactSheetCatalogReferenceCount: 480,
      applicableBuffTraceCatalogEntryCount: 96,
      applicableBuffTraceCatalogReferenceCount: 480,
      scalarWeightCount: 0,
      selectedStatCount: 0,
      selectedCircletCount: 0,
      selectedRefinementCount: 0,
      selectedSupportOptionCount: 0,
      selectedHuskStackCount: 0,
      selectedArtifactPlacementCount: 0,
      branchAverageCount: 0,
      optimizerRunCount: 0,
      autoTuneRunCount: 0,
      idealStatAllocationCount: 0,
      sourceRotationReplayCount: 0,
      sourceTeamTotalDamageComputationCount: 0,
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
      supportsWinnerClaims: false,
      supportsPlayerDamageClaims: false,
      supportsSourceRotationReplay: false,
      supportsTeamTotalDamageComputation: false,
      supportsDpsClaims: false,
      supportsBuffTimingClaims: false,
      supportsEnergyRecoveryClaims: false,
      supportsIdealStatAllocation: false,
      localStatPriorityDiagnosticExecuted: true,
      sourceCandidateSelectionExecuted: false,
      sourceStatSelectionExecuted: false,
      sourceSubstatPriorityValidated: false,
      optimizerExecuted: false,
      autoTuneExecuted: false,
      idealStatAllocationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.requestBoundary.request.energyRecoveryRequested).toBe(false);
    expect(report.experimentalDomain.probeStats).not.toContain("er");
    expect(
      report.cells.every(
        ({ evaluation }) =>
          !evaluation.runtimeTrace.compilerErConstraintPresent,
      ),
    ).toBe(true);
  });

  it("rejects beta, malformed axes, source bytes, hashes, paths, and request drift", async () => {
    const previousOverride = process.env.__BETA_ENABLED_OVERRIDE__;
    try {
      process.env.__BETA_ENABLED_OVERRIDE__ = "true";
      await expect(
        evaluateNoelleHexereiTechnicalPoint(validPointRequest()),
      ).rejects.toThrow("requires the authenticated non-beta runtime branch");
    } finally {
      if (previousOverride === undefined) {
        delete process.env.__BETA_ENABLED_OVERRIDE__;
      } else {
        process.env.__BETA_ENABLED_OVERRIDE__ = previousOverride;
      }
    }

    await expect(
      evaluateNoelleHexereiTechnicalPoint({
        ...validPointRequest(),
        nicoleMode: "invalid" as never,
      }),
    ).rejects.toThrow("unsupported axis value");
    await expect(
      evaluateNoelleHexereiTechnicalPoint({
        ...validPointRequest(),
        undeclaredIdentityAxis: "collision",
      } as NoelleHexereiTechnicalPointRequest),
    ).rejects.toThrow("unsupported axis value");
    await expect(
      evaluateNoelleHexereiTechnicalPoint({
        ...validPointRequest(),
        probeStat: undefined,
      } as unknown as NoelleHexereiTechnicalPointRequest),
    ).rejects.toThrow("unsupported axis value");
    await expect(
      evaluateNoelleHexereiTechnicalPoint({
        ...validPointRequest(),
        sourceAlignedSands: "def%",
      }),
    ).rejects.toThrow("source-aligned Sands drifted");

    const nonCanonical = fixture();
    nonCanonical.sourceFiles[0].bytesBase64 = "AA";
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(nonCanonical),
    ).rejects.toThrow("failed base64 round-trip");

    const byteTamper = fixture();
    byteTamper.sourceFiles[0].bytesBase64 = Buffer.from(
      `${Buffer.from(byteTamper.sourceFiles[0].bytesBase64, "base64").toString("utf8")}\n`,
      "utf8",
    ).toString("base64");
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(byteTamper),
    ).rejects.toThrow("do not match the workspace file");

    const hashTamper = fixture();
    hashTamper.generatedFrom[0].sha256 = "0".repeat(64);
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(hashTamper),
    ).rejects.toThrow("source/hash authentication drifted");

    const missing = fixture();
    missing.sourceFiles = missing.sourceFiles.slice(0, -1);
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(missing),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const duplicate = fixture();
    duplicate.generatedFrom = duplicate.generatedFrom.map((entry, index) =>
      index === 1 ? { ...duplicate.generatedFrom[0] } : entry,
    );
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(duplicate),
    ).rejects.toThrow("exact outer source/generatedFrom path closure drifted");

    const requestTamper = fixture();
    (
      requestTamper.technicalRequest.expectedCardinality as {
        cellCount: number;
      }
    ).cellCount = 481;
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(requestTamper),
    ).rejects.toThrow("technical request differs");

    const cp55InputTamper = fixture();
    cp55InputTamper.cp55Input.generatedFrom[0].sha256 = "f".repeat(64);
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(cp55InputTamper),
    ).rejects.toThrow("exact projection of the outer authenticated byte closure");

    const cp55SplitBrain = fixture();
    (
      cp55SplitBrain.cp55ReportInput.operationSummary as {
        optimizerRunCount: number;
      }
    ).optimizerRunCount = 1;
    await expect(
      buildNoelleHexereiLocalStatPriorityDiagnosticReport(cp55SplitBrain),
    ).rejects.toThrow(
      "CP55 durable report bytes disagree with the supplied parsed object",
    );
  }, LONG_TIMEOUT);

  it("rejects serialized report tampering after canonical inputs", async () => {
    const tampered = structuredClone(durableReport);
    tampered.cells[0].directTotal += 1;
    const authentication =
      await authenticateNoelleHexereiLocalStatPriorityDiagnosticReport(
        tampered,
        baseInput,
      );
    expect(authentication).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  }, LONG_TIMEOUT);
});

function expectedOrderedCellIds(): string[] {
  return NOELLE_HEXEREI_POINT_WITNESSES.flatMap((witness) =>
    NOELLE_HEXEREI_POINT_CIRCLET_STATS.flatMap((circlet) =>
      NOELLE_HEXEREI_POINT_REFINEMENTS.flatMap((refinement) =>
        NOELLE_HEXEREI_POINT_NICOLE_MODES.flatMap((nicoleMode) =>
          NOELLE_HEXEREI_POINT_HUSK_STACKS.flatMap((huskStacks) =>
            [null, ...NOELLE_HEXEREI_POINT_PROBE_STATS].map((probeStat) =>
              pointId({
                witnessId: witness.witnessId,
                sourceAlignedSands: witness.sourceAlignedSands,
                circlet,
                refinement,
                nicoleMode,
                huskStacks,
                probeStat,
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

function pointId(request: NoelleHexereiTechnicalPointRequest): string {
  return [
    request.witnessId,
    request.sourceAlignedSands,
    request.circlet,
    `r${request.refinement}`,
    request.nicoleMode,
    `husk${request.huskStacks}`,
    request.probeStat ?? "baseline",
  ].join(":");
}

function requestForCell(
  cell: NoelleHexereiLocalStatPriorityCell,
): NoelleHexereiTechnicalPointRequest {
  return {
    witnessId: cell.witnessId,
    sourceAlignedSands: cell.sourceAlignedSands,
    circlet: cell.circlet,
    refinement: cell.refinement,
    nicoleMode: cell.nicoleMode,
    huskStacks: cell.huskStacks,
    probeStat: cell.probe.stat,
  };
}

function baselineIdForCell(cell: NoelleHexereiLocalStatPriorityCell): string {
  return pointId({ ...requestForCell(cell), probeStat: null });
}

function validPointRequest(): NoelleHexereiTechnicalPointRequest {
  const witness = NOELLE_HEXEREI_POINT_WITNESSES[0];
  return {
    witnessId: witness.witnessId,
    sourceAlignedSands: witness.sourceAlignedSands,
    circlet: "cr",
    refinement: 1,
    nicoleMode: "all-theosis",
    huskStacks: 4,
    probeStat: null,
  };
}

function requireWitness(witnessId: string) {
  const witness = NOELLE_HEXEREI_POINT_WITNESSES.find(
    (candidate) => candidate.witnessId === witnessId,
  );
  if (!witness) throw new Error(`Missing witness ${witnessId}.`);
  return witness;
}

function catalogBySheetHash(
  entries: readonly NoelleHexereiArtifactSheetCatalogEntry[],
): Map<string, NoelleHexereiArtifactSheetCatalogEntry> {
  return new Map(entries.map((entry) => [entry.normalizedEntriesSha256, entry]));
}

function catalogByTraceHash(
  entries: readonly NoelleHexereiApplicableBuffTraceCatalogEntry[],
): Map<string, NoelleHexereiApplicableBuffTraceCatalogEntry> {
  return new Map(entries.map((entry) => [entry.applicableBuffTraceSha256, entry]));
}

function expectedPlacementDomain(
  probeStat: NoelleHexereiTechnicalPointProbeStat,
  sands: "atk%" | "def%",
  circlet: "cr" | "cd",
): string[] {
  const mains = {
    flower: "hp",
    plume: "atk",
    sands,
    goblet: "geo%",
    circlet,
  } as const;
  return Object.entries(mains)
    .filter(([, mainStat]) => mainStat !== probeStat)
    .map(([slot]) => slot);
}

function assertOneSheetEntryDelta(
  baseline: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"],
  probe: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"],
  probeStat: NoelleHexereiTechnicalPointProbeStat,
  expectedDelta: number,
): void {
  const baselineMap = sheetEntryMap(baseline);
  const probeMap = sheetEntryMap(probe);
  const keys = new Set([...baselineMap.keys(), ...probeMap.keys()]);
  const changes = [...keys].flatMap((key) => {
    const delta = (probeMap.get(key) ?? 0) - (baselineMap.get(key) ?? 0);
    return Math.abs(delta) > 1e-14 ? [{ key, delta }] : [];
  });
  expect(changes).toHaveLength(1);
  expect(changes[0]?.key).toBe(`${probeStat}\0`);
  expect(changes[0]?.delta).toBeCloseTo(expectedDelta, 14);
}

function sheetEntryMap(
  entries: NoelleHexereiTechnicalPointEvaluation["artifactSheet"]["normalizedEntries"],
): Map<string, number> {
  return new Map(
    entries.map(({ key, filterKey, value }) => [
      `${key}\0${filterKey}`,
      value,
    ]),
  );
}

function changedCellAxes(
  left: NoelleHexereiLocalStatPriorityCell,
  right: NoelleHexereiLocalStatPriorityCell,
): string[] {
  return [
    left.witnessId === right.witnessId ? null : "witnessId",
    left.profileId === right.profileId ? null : "profileId",
    left.sourceAlignedSands === right.sourceAlignedSands ? null : "sands",
    left.circlet === right.circlet ? null : "circlet",
    left.refinement === right.refinement ? null : "refinement",
    left.nicoleMode === right.nicoleMode ? null : "nicoleMode",
    left.huskStacks === right.huskStacks ? null : "huskStacks",
    left.probe.probeState === right.probe.probeState ? null : "probeState",
  ].filter((axis): axis is string => axis != null);
}

function requireCp55Cell(
  witnessId: string,
  sands: string,
  circlet: string,
  refinement: number,
): NoelleHexereiEquipmentResponseCell {
  const matches = cp55Report.surface.cells.filter(
    (cell) =>
      cell.witnessId === witnessId &&
      cell.sands === sands &&
      cell.circlet === circlet &&
      cell.refinement === refinement,
  );
  if (matches.length !== 1) {
    throw new Error(`Missing CP55 cell ${witnessId}/${sands}/${circlet}/R${refinement}.`);
  }
  return matches[0];
}

function cp55ComparableProjection(cell: NoelleHexereiEquipmentResponseCell) {
  const trace = cp55Report.surface.buffTraceCatalog.find(
    ({ traceSha256 }) =>
      traceSha256 === cell.runtimeTrace.applicableBuffTraceSha256,
  );
  if (!trace) throw new Error(`Missing CP55 trace ${cell.cellId}.`);
  return {
    witnessId: cell.witnessId,
    profileId: cell.profileId,
    constellation: cell.enteredConstellation,
    enteredTalentLevels: cell.enteredTalentLevels,
    runtimeEffectiveTalentLevels: cell.runtimeEffectiveTalentLevels,
    runtimeTalentEvidence: cell.runtimeTalentEvidence,
    sourcePredicateSatisfiedByEnteredFacts:
      cell.sourcePredicateSatisfiedByEnteredFacts,
    sourceAlignedSands: cell.sands,
    circlet: cell.circlet,
    refinement: cell.refinement,
    artifactSheetSha256: cell.artifactSheet.sheetSha256,
    runtimeTrace: {
      registeredBuffCount: cell.runtimeTrace.registeredBuffCount,
      registeredBuffLedgerSha256:
        cell.runtimeTrace.registeredBuffLedgerSha256,
      applicableBuffCountForOnFieldNoelle:
        cell.runtimeTrace.applicableBuffCountForOnFieldNoelle,
      canonicalApplicableBuffTraceSha256: canonicalBuffTraceSha256(trace.rows),
      computedBuffOverrideKeys: cell.runtimeTrace.computedBuffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount:
        cell.runtimeTrace
          .computedBuffOverrideCountDoesNotRepresentApplicableBuffCount,
      gestBuffCount: cell.runtimeTrace.gestBuffCount,
      gestDamageBonus: cell.runtimeTrace.gestDamageBonus,
      gestCritDamage: cell.runtimeTrace.gestCritDamage,
      gestAttackSpeed: cell.runtimeTrace.gestAttackSpeed,
      huskCuriosityBuffCount: cell.runtimeTrace.huskBuffCount,
      huskDefenseBonus: cell.runtimeTrace.huskDefenseBonus,
      huskGeoDamageBonus: cell.runtimeTrace.huskGeoDamageBonus,
      geoResonanceBuffCount: cell.runtimeTrace.geoResonanceBuffCount,
      geoResonanceDamageBonus: cell.runtimeTrace.geoResonanceDamageBonus,
      geoResonanceResistanceReduction:
        cell.runtimeTrace.geoResonanceResistanceReduction,
      teammateWeaponBuffCount: cell.runtimeTrace.teammateWeaponBuffCount,
      exactRequiredBuffValuesVerified:
        cell.runtimeTrace.exactRequiredBuffValuesVerified,
      compilerVariableCount: cell.runtimeTrace.compilerVariableCount,
      compilerNoelleCharacterIndex:
        cell.runtimeTrace.compilerNoelleCharacterIndex,
      compilerErConstraintPresent: cell.runtimeTrace.compilerErConstraintPresent,
    },
    formulaProjection: cell.formulaProjection,
    objective: cell.objective,
  };
}

function cp56ComparableProjection(cell: NoelleHexereiLocalStatPriorityCell) {
  const evaluation = cell.evaluation;
  return {
    witnessId: cell.witnessId,
    profileId: cell.profileId,
    constellation: evaluation.witness.constellation,
    enteredTalentLevels: evaluation.witness.enteredTalentLevels,
    runtimeEffectiveTalentLevels:
      evaluation.witness.runtimeEffectiveTalentLevels,
    runtimeTalentEvidence: evaluation.witness.runtimeTalentEvidence,
    sourcePredicateSatisfiedByEnteredFacts:
      evaluation.witness.sourcePredicateSatisfiedByEnteredFacts,
    sourceAlignedSands: cell.sourceAlignedSands,
    circlet: cell.circlet,
    refinement: cell.refinement,
    artifactSheetSha256: evaluation.artifactSheet.normalizedEntriesSha256,
    runtimeTrace: {
      registeredBuffCount: evaluation.runtimeTrace.registeredBuffCount,
      registeredBuffLedgerSha256:
        evaluation.runtimeTrace.registeredBuffLedgerSha256,
      applicableBuffCountForOnFieldNoelle:
        evaluation.runtimeTrace.applicableBuffCountForOnFieldNoelle,
      canonicalApplicableBuffTraceSha256:
        evaluation.runtimeTrace.canonicalApplicableBuffTraceSha256,
      computedBuffOverrideKeys:
        evaluation.runtimeTrace.computedBuffOverrideKeys,
      computedBuffOverrideCountDoesNotRepresentApplicableBuffCount:
        evaluation.runtimeTrace
          .computedBuffOverrideCountDoesNotRepresentApplicableBuffCount,
      gestBuffCount: evaluation.runtimeTrace.gestBuffCount,
      gestDamageBonus: evaluation.runtimeTrace.gestDamageBonus,
      gestCritDamage: evaluation.runtimeTrace.gestCritDamage,
      gestAttackSpeed: evaluation.runtimeTrace.gestAttackSpeed,
      huskCuriosityBuffCount:
        evaluation.runtimeTrace.huskCuriosityBuffCount,
      huskDefenseBonus: evaluation.runtimeTrace.huskDefenseBonus,
      huskGeoDamageBonus: evaluation.runtimeTrace.huskGeoDamageBonus,
      geoResonanceBuffCount:
        evaluation.runtimeTrace.geoResonanceBuffCount,
      geoResonanceDamageBonus:
        evaluation.runtimeTrace.geoResonanceDamageBonus,
      geoResonanceResistanceReduction:
        evaluation.runtimeTrace.geoResonanceResistanceReduction,
      teammateWeaponBuffCount:
        evaluation.runtimeTrace.teammateWeaponBuffCount,
      exactRequiredBuffValuesVerified:
        evaluation.runtimeTrace.exactRequiredBuffValuesVerified,
      compilerVariableCount: evaluation.runtimeTrace.compilerVariableCount,
      compilerNoelleCharacterIndex:
        evaluation.runtimeTrace.compilerNoelleCharacterIndex,
      compilerErConstraintPresent:
        evaluation.runtimeTrace.compilerErConstraintPresent,
    },
    formulaProjection: evaluation.formulaProjection,
    objective: evaluation.objective,
  };
}

function canonicalBuffTraceSha256(rows: readonly unknown[]): string {
  return hashValue(
    rows
      .map((row) => structuredClone(row))
      .sort((left, right) => compareText(stableJson(left), stableJson(right))),
  );
}

function comparisonTolerance(left: number, right: number): number {
  return Math.max(
    1e-9,
    1e-12 * Math.max(1, Math.abs(left), Math.abs(right)),
  );
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Non-finite test value ${value}.`);
  return Number(value.toPrecision(15));
}

function census<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): Record<string, number> {
  return Object.fromEntries(
    [...values.reduce((counts, value) => {
      const key = keyFor(value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort(([left], [right]) =>
      compareText(left, right),
    ),
  );
}

function fixture(): NoelleHexereiLocalStatPriorityDiagnosticInput {
  return structuredClone(baseInput);
}

function hashValue(value: unknown): string {
  return sha256(Buffer.from(stableJson(value), "utf8"));
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJsonReport<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
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
