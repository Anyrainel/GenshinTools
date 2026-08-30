import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { characters } from "@/data/resources";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildDerivedFormulaFixtureCoverageReport,
  DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS,
  DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS,
  DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS,
  DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
  type BuildDerivedFormulaFixtureCoverageInput,
  type DerivedFormulaFixtureCoverageReport,
} from "../src/derivedFormulaFixtureCoverage";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const durableReportPath = path.join(
  repositoryRoot,
  "scripts/guide-factory/reports/derived-formula-fixture-coverage.json",
);
const repositoryPath =
  "scripts/guide-factory/data/knowledge/repository.json";
const sourceRegistryPath = "scripts/guide-factory/sources/registry.json";
const manualIndexPath =
  "scripts/guide-factory/data/source-snapshots/manual-index.json";
const rosterReportPath =
  "scripts/guide-factory/reports/team-roster-candidate-domain-experiment.json";
const xiaoManualFixturePath =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json";
const xiaoPresetSnapshotPath =
  "scripts/guide-factory/data/source-snapshots/genshintools-presets.json";
const xiaoScopeCodePath =
  "scripts/guide-factory/src/xiaoFormulaCountParityScope.ts";

let fixture: BuildDerivedFormulaFixtureCoverageInput;
let report: DerivedFormulaFixtureCoverageReport;

beforeAll(async () => {
  fixture = await loadFixture();
  report = buildDerivedFormulaFixtureCoverageReport(fixture);
});

describe("derived formula fixture coverage", () => {
  it("matches the durable report and inventories the exact bounded fixture set", async () => {
    expect(await readJson(durableReportPath)).toEqual(report);
    expect(report).toMatchObject({
      reportType: "derived-formula-fixture-coverage",
      classification: "descriptive-derived-fixture-inventory",
      comparisonStatus: "comparable",
      validationDisposition: "withheld-from-guide-use",
      sourceAuthoredFormulaPlan: false,
      supportsGuideClaims: false,
      supportsRecommendations: false,
      supportsRanking: false,
      supportsDamageClaims: false,
      supportsSourceValidation: false,
      supportsEnergyRecoveryClaims: false,
      summary: {
        fixtureCount: 3,
        legacyFormulaPlanFixtureCount: 2,
        countParityOnlyFixtureCount: 1,
        characterScenarioObservationCount: 12,
        calculatorTeamOnlyObservationCount: 4,
        uniqueCharacterCount: 9,
        derivedC0ObservationCount: 12,
        sourceConstellationSpecifiedObservationCount: 0,
        sourceConstellationUnspecifiedObservationCount: 8,
        sourceTeamAbsentObservationCount: 4,
        positiveDefaultFormulaRowCount: 33,
        zeroDefaultFormulaRowCount: 18,
        countParityFormulaComparisonCount: 2,
        countParityMatchedCount: 1,
        countParityMismatchCount: 1,
        sourceValidatedObservationCount: 0,
        guideReadyObservationCount: 0,
      },
    });
    expect(report.boundaries.fixtureSet.fixtureReportPaths).toEqual(
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS,
    );
  });

  it("keeps exact derived C0 observations distinct from unspecified source investment", () => {
    for (const scenario of report.scenarios) {
      expect(scenario.memberObservations).toHaveLength(4);
      for (const observation of scenario.memberObservations) {
        expect(observation).toMatchObject({
          derivedConstellation: 0,
          localFixtureAssumptions: {
            charLevel: 90,
            constellation: 0,
            refinement: 1,
            talentLevels: { auto: 10, skill: 10, burst: 10 },
          },
          constellationBasis: "calculator-local-fixture-assumption",
          calculationTeamInvestment: "constellation-unspecified",
        });
        expect(observation.sourceRotationTeamInvestment).toBe(
          scenario.fixtureSemantics === "formula-count-parity-only"
            ? "not-applicable-source-fixture-has-no-team"
            : "constellation-unspecified",
        );
      }
    }
    for (const character of report.characters) {
      expect(character.rows).toHaveLength(7);
      expect(character.rows[0]).toMatchObject({
        constellation: 0,
        state: "observed-exact-derived-assumption",
      });
      expect(character.rows.slice(1)).toEqual(
        [1, 2, 3, 4, 5, 6].map((constellation) => ({
          constellation,
          state: "not-observed",
          scenarioObservationIds: [],
        })),
      );
    }
    expect(report.boundaries.constellation).toEqual({
      observedDerivedConstellations: [0],
      unobservedDerivedConstellations: [1, 2, 3, 4, 5, 6],
      derivedC0Basis: "calculator-local-fixture-assumptions-only",
      calculationTeamInvestment: "constellation-unspecified",
      sourceRotationTeamInvestment:
        "mixed-legacy-unspecified-and-count-parity-source-team-absent",
      legacySourceRotationTeamInvestment: "constellation-unspecified",
      countParitySourceTeamInvestment:
        "not-applicable-source-fixture-has-no-team",
      sourceConstellationUsedAsC0Evidence: false,
    });
  });

  it("preserves shared members as two scenario observations instead of aggregating votes", () => {
    const counts = Object.fromEntries(
      report.characters.map(({ characterId, scenarioObservationIds }) => [
        characterId,
        scenarioObservationIds.length,
      ]),
    );
    expect(counts).toEqual({
      faruzan: 1,
      furina: 3,
      ineffa: 1,
      kaedehara_kazuha: 1,
      keqing: 1,
      neuvillette: 1,
      xianyun: 1,
      xiao: 1,
      xilonen: 2,
    });
    expect(report.summary.sharedCharacterScenarioObservationCounts).toEqual({
      furina: 3,
      xilonen: 2,
    });
    expect(
      report.scenarios.map(({ scenarioId }) => scenarioId),
    ).toEqual([
      "furina-neuvillette-source-rotation-comparison-v2",
      "keqing-ineffa-source-rotation-comparison-v1",
      "kqm-xiao-eeq12hp-formula-count-parity-version-5-5",
    ]);
  });

  it("preserves unreviewed manual provenance and asymmetric readiness states", () => {
    const furina = scenario(
      "furina-neuvillette-source-rotation-comparison-v2",
    );
    const keqing = scenario("keqing-ineffa-source-rotation-comparison-v1");
    expect(furina.calculationTeamRecordId).toBe(
      "genshintools-presets:team:JQC4wxT0jJgK50gc0O",
    );
    expect(furina.sourceRotation.recordId).toBe(
      "kqm:team:furina-neuvillette-kazuha-xilonen-example",
    );
    expect(furina.provenance).toMatchObject({
      sourceId: "kqm",
      sourceRecordId: "furina-neuvillette-kazuha-xilonen-example",
      sourceRotationExtractionReviewStatus: "unreviewed",
      actionTranslationReviewStatus: "unreviewed",
    });
    expect(furina.readiness).toEqual({
      state: "not-assessed",
      readyForDamageReplay: null,
      blockerCount: null,
      sourceTokenCoverage: "not-recorded",
    });
    expect(keqing.provenance).toMatchObject({
      sourceId: "kqm",
      sourceRecordId:
        "keqing-ineffa-furina-xilonen-lunar-charged-example",
      sourceRotationExtractionReviewStatus: "unreviewed",
      actionTranslationReviewStatus: "unreviewed",
    });
    expect(keqing.readiness).toEqual({
      state: "assessed-blocked",
      readyForDamageReplay: false,
      blockerCount: 8,
      sourceTokenCoverage: "recorded",
    });
    expect(furina.fixtureSemantics).toBeUndefined();
    expect(keqing.fixtureSemantics).toBeUndefined();
    expect(furina.countParity).toBeUndefined();
    expect(keqing.countParity).toBeUndefined();
  });

  it("keeps Xiao as an unreviewed count-parity-only calculator-team witness", () => {
    const xiao = scenario(
      "kqm-xiao-eeq12hp-formula-count-parity-version-5-5",
    );
    expect(xiao).toMatchObject({
      fixtureSemantics: "formula-count-parity-only",
      calculationTeamRecordId:
        "genshintools-presets:team:CX03obKWOJgK51-fWO",
      sourceRotation: {
        recordId:
          "kqm:rotation-fixture:xiao-no-buff-eeq12hp-rotation-fixture-version-5-5",
        rotationId: "no-buff-eeq12hp",
      },
      provenance: {
        sourceId: "kqm",
        sourceRecordId:
          "xiao-no-buff-eeq12hp-rotation-fixture-version-5-5",
        sourceRotationExtractionReviewStatus: "unreviewed",
        actionTranslationReviewStatus: "unreviewed",
        semanticScope: {
          scopeId: "xiao-formula-count-parity-v1",
          status: "accepted",
          trust:
            "authenticated-current-input-rebuild-and-pinned-expectation",
        },
      },
      readiness: {
        state: "count-parity-only",
        readyForDamageReplay: null,
        blockerCount: null,
        sourceTokenCoverage:
          "complete-unreviewed-guide-factory-aliases",
      },
      supportsGuideClaims: false,
      supportsDamageClaims: false,
      supportsSourceValidation: false,
      countParity: {
        sourceTokenAliasesAuthoredByGuideFactory: true,
        sourceTokenAliasesHumanReviewed: false,
        formulaCountComparisonExecuted: true,
        formulaComparisonCount: 2,
        matchedCount: 1,
        mismatchCount: 1,
        mismatches: [
          {
            characterId: "xiao",
            formulaId: "xiao-plunge-high",
            sourceTranslatedCount: 12,
            calculatorDefaultCount: 11,
            relation: "source-translation-higher",
          },
        ],
      },
    });
    expect(xiao.provenance.manualSnapshot).toBeUndefined();
    expect(
      xiao.memberObservations.map(
        ({ characterId, formulaInventory }) => ({
          characterId,
          positive: formulaInventory.positiveDefaultFormulaCount,
          zero: formulaInventory.zeroDefaultFormulaCount,
        }),
      ),
    ).toEqual([
      { characterId: "faruzan", positive: 1, zero: 2 },
      { characterId: "furina", positive: 3, zero: 0 },
      { characterId: "xianyun", positive: 2, zero: 4 },
      { characterId: "xiao", positive: 2, zero: 1 },
    ]);
    expect(report.boundaries.review).toMatchObject({
      xiaoFixtureReadiness: "count-parity-only",
      xiaoSourceTokenAliasReviewStatus: "unreviewed",
      xiaoFormulaCountMismatchCount: 1,
    });
  });

  it("records the complete no-execution and ER exclusion boundary", () => {
    expect(report.boundaries.exclusions).toEqual({
      formulaExecutionPerformed: false,
      formulaCountComparisonPerformed: true,
      formulaDamageEvaluationPerformed: false,
      damageReplayPerformed: false,
      optimizerUsed: false,
      energyRecoveryInputsRead: false,
      energyRecoveryComputed: false,
    });
    const serialized = stableJson(report);
    expect(serialized).not.toContain('"erTargets"');
    expect(serialized).not.toContain('"erFloorPercent"');
    expect(serialized).not.toContain('"rotationDurationSeconds"');
  });

  it("reconstructs report, fixture-dependency, and formula-inventory hashes", () => {
    expect(
      sha256Text(
        stableJson({
          scenarios: report.scenarios,
          characters: report.characters,
          summary: report.summary,
        }),
      ),
    ).toBe(report.coveragePayloadSha256);

    for (const scenario of report.scenarios) {
      const source = fixture.sourceFiles.find(
        ({ path: relativePath }) => relativePath === scenario.fixtureReport.path,
      );
      expect(source).toBeDefined();
      expect(sha256Text(source?.text ?? "")).toBe(
        scenario.fixtureReport.sha256,
      );
      const fixtureInput = fixture.fixtureReportInputs.find(
        ({ path: relativePath }) => relativePath === scenario.fixtureReport.path,
      );
      const embedded = requiredRecord(fixtureInput?.reportInput).generatedFrom;
      expect(sha256Text(stableJson(embedded))).toBe(
        scenario.fixtureReport.generatedFromSha256,
      );
    }
  });

  it("is invariant to wrapper input order while retaining semantic scenario order", () => {
    const reordered = cloneFixture(fixture);
    reordered.fixtureReportInputs = [...reordered.fixtureReportInputs].reverse();
    reordered.manualSnapshotInputs = [...reordered.manualSnapshotInputs].reverse();
    reordered.sourceFiles = [...reordered.sourceFiles].reverse();
    reordered.releasedCharacterIds = [...reordered.releasedCharacterIds].reverse();
    reordered.generatedFrom = [...reordered.generatedFrom].reverse();
    expect(buildDerivedFormulaFixtureCoverageReport(reordered)).toEqual(report);
  });

  it("fails closed on incomplete, stale, or internally stale input authentication", () => {
    const incomplete = cloneFixture(fixture);
    incomplete.generatedFrom = incomplete.generatedFrom.slice(0, -1);
    expect(() => buildDerivedFormulaFixtureCoverageReport(incomplete)).toThrow(
      /complete expected input set/,
    );

    const staleBytes = cloneFixture(fixture);
    const reportHash = staleBytes.generatedFrom.find(
      ({ path: relativePath }) =>
        relativePath === DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
    );
    if (!reportHash) throw new Error("Missing report hash fixture.");
    reportHash.sha256 = "0".repeat(64);
    expect(() => buildDerivedFormulaFixtureCoverageReport(staleBytes)).toThrow(
      /source bytes do not match generatedFrom/,
    );

    const staleEmbedded = cloneFixture(fixture);
    mutateFixtureReport(
      staleEmbedded,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        const generatedFrom = requiredRecordArray(input.generatedFrom);
        const repository = generatedFrom.find(
          ({ path: relativePath }) => relativePath === repositoryPath,
        );
        if (!repository) throw new Error("Missing embedded repository hash.");
        repository.sha256 = "0".repeat(64);
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(staleEmbedded)).toThrow(
      /stale generatedFrom hash/,
    );
  });

  it("rebuilds Xiao semantic scope from authenticated raw inputs instead of trusting the saved copy", () => {
    const copiedScopeDrift = cloneFixture(fixture);
    mutateFixtureReport(
      copiedScopeDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        const semanticScope = requiredRecord(input.semanticScope);
        const selector = requiredRecord(semanticScope.selector);
        selector.manifestSha256 = "0".repeat(64);
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(copiedScopeDrift),
    ).toThrow(/semantic scope\/current raw-input rebuild no longer matches/);

    const rawBoundaryDrift = cloneFixture(fixture);
    mutateFixtureReport(
      rawBoundaryDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        const rawBoundary = requiredRecord(input.rawInputBoundary);
        rawBoundary.generatedCodeHashClosure = true;
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(rawBoundaryDrift),
    ).toThrow(/exact raw-input boundary no longer matches/);
  });

  it("fails closed when Xiao raw source, preset, or declared code inputs drift", () => {
    const rawFixtureDrift = cloneFixture(fixture);
    mutateJsonSource(rawFixtureDrift, xiaoManualFixturePath, (input) => {
      const records = requiredRecordArray(input.records);
      const fixtureRecord = records.find(
        ({ sourceRecordId }) =>
          sourceRecordId ===
          "xiao-no-buff-eeq12hp-rotation-fixture-version-5-5",
      );
      if (!fixtureRecord) throw new Error("Missing Xiao raw fixture record.");
      requiredRecordArray(fixtureRecord.formulaCounts)[1]!.count = 13;
    });
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(rawFixtureDrift),
    ).toThrow(/Xiao formula-count semantic scope authentication failed/);

    const rawPresetDrift = cloneFixture(fixture);
    mutateJsonSource(rawPresetDrift, xiaoPresetSnapshotPath, (input) => {
      const teams = requiredRecordArray(input.teams);
      const team = teams.find(
        ({ sourceRecordId }) => sourceRecordId === "CX03obKWOJgK51-fWO",
      );
      if (!team) throw new Error("Missing Xiao raw preset team.");
      requiredRecordArray(team.members)[0]!.selectedWeaponId = "staff_of_homa";
    });
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(rawPresetDrift),
    ).toThrow(/Xiao formula-count semantic scope authentication failed/);

    const declaredCodeDrift = cloneFixture(fixture);
    replaceTextSource(
      declaredCodeDrift,
      xiaoScopeCodePath,
      `${sourceText(declaredCodeDrift, xiaoScopeCodePath)}\n`,
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(declaredCodeDrift),
    ).toThrow(/stale generatedFrom hash/);
  });

  it("fails closed on roster drift, formula nonmembers, and duplicate members", () => {
    const rosterDrift = cloneFixture(fixture);
    rosterDrift.releasedCharacterIds = rosterDrift.releasedCharacterIds.slice(
      0,
      -1,
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(rosterDrift)).toThrow(
      /roster drifted/,
    );

    const formulaNonmember = cloneFixture(fixture);
    mutateFixtureReport(
      formulaNonmember,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        requiredRecordArray(input.lines)[0]!.characterId = "nahida";
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(formulaNonmember),
    ).toThrow(/formula nonmember nahida/);

    const duplicateMember = cloneFixture(fixture);
    mutateFixtureReport(
      duplicateMember,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        const assumptions = requiredRecord(input.assumptions);
        const members = requiredRecordArray(assumptions.characters);
        assumptions.characters = [...members, structuredClone(members[0]!)];
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(duplicateMember),
    ).toThrow(/assumption character IDs repeat/);
  });

  it("fails closed on local fixture-assumption and formula-inventory drift", () => {
    const assumptionDrift = cloneFixture(fixture);
    mutateFixtureReport(
      assumptionDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        const assumptions = requiredRecord(input.assumptions);
        requiredRecordArray(assumptions.characters)[0]!.charLevel = 80;
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(assumptionDrift)).toThrow(
      /local fixture character level must be 90/,
    );

    const positiveCountDrift = cloneFixture(fixture);
    mutateFixtureReport(
      positiveCountDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        requiredRecordArray(input.lines)[0]!.count = 0;
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(positiveCountDrift),
    ).toThrow(/must have a finite positive count/);

    const zeroCountDrift = cloneFixture(fixture);
    mutateFixtureReport(
      zeroCountDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[0],
      (input) => {
        requiredRecordArray(input.zeroCountAvailableFormulas)[0]!.count = 1;
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(zeroCountDrift),
    ).toThrow(/must not carry a count field/);
  });

  it("fails closed on source-constellation and no-claim flag drift", () => {
    const constellationConflict = cloneFixture(fixture);
    const repository = requiredRecord(constellationConflict.repositoryInput);
    const records = requiredRecordArray(repository.records);
    const baseline = records.find(
      ({ id }) => id === "genshintools-presets:team:JQC4wxT0jJgK50gc0O",
    );
    if (!baseline) throw new Error("Missing Furina baseline fixture.");
    requiredRecordArray(baseline.members)[0]!.investment = {
      status: "partial",
      constellation: 1,
    };
    replaceJsonSource(constellationConflict, repositoryPath, repository);
    const repositorySha = generatedHash(constellationConflict, repositoryPath);
    for (const reportPath of DERIVED_FORMULA_FIXTURE_REPORT_PATHS) {
      mutateFixtureReport(constellationConflict, reportPath, (input) => {
        const entry = requiredRecordArray(input.generatedFrom).find(
          ({ path: relativePath }) => relativePath === repositoryPath,
        );
        if (entry) entry.sha256 = repositorySha;
      });
    }
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(constellationConflict),
    ).toThrow(/source-constellation conflict/);

    const claimDrift = cloneFixture(fixture);
    mutateFixtureReport(
      claimDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[1],
      (input) => {
        requiredRecord(input.equipmentFixture).supportsGuideClaims = true;
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(claimDrift)).toThrow(
      /supportsGuideClaims must be false/,
    );
  });

  it("fails closed when review provenance or Keqing blocker composition drifts", () => {
    const methodDrift = cloneFixture(fixture);
    const manualInput = methodDrift.manualSnapshotInputs.find(
      ({ path: relativePath }) =>
        relativePath === DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS[0],
    );
    if (!manualInput) throw new Error("Missing Furina manual fixture.");
    const snapshot = requiredRecord(manualInput.snapshotInput);
    const manual = requiredRecordArray(snapshot.records).find(
      ({ sourceRecordId }) =>
        sourceRecordId === "furina-neuvillette-kazuha-xilonen-example",
    );
    if (!manual) throw new Error("Missing Furina manual team record.");
    requiredRecord(manual.extraction).method = "manual";
    replaceJsonSource(
      methodDrift,
      DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS[0],
      snapshot,
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(methodDrift)).toThrow(
      /extraction method must be agent-assisted/,
    );

    const blockerDrift = cloneFixture(fixture);
    mutateFixtureReport(
      blockerDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[1],
      (input) => {
        const readiness = requiredRecord(input.damageReplayReadiness);
        const blockers = requiredRecordArray(readiness.blockers);
        blockers[1]!.code = "translation-unreviewed";
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(blockerDrift)).toThrow(
      /blocker distribution drifted/,
    );
  });

  it("fails closed when Xiao aliases, mismatch evidence, or claim boundaries drift", () => {
    const aliasReviewDrift = cloneFixture(fixture);
    mutateFixtureReport(
      aliasReviewDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        input.sourceTokenAliasesHumanReviewed = true;
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(aliasReviewDrift),
    ).toThrow(/sourceTokenAliasesHumanReviewed must be false/);

    const mismatchDrift = cloneFixture(fixture);
    mutateFixtureReport(
      mismatchDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        requiredRecord(input.comparison).mismatches = [];
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(mismatchDrift)).toThrow(
      /observed mismatch no longer matches/,
    );

    const damageClaimDrift = cloneFixture(fixture);
    mutateFixtureReport(
      damageClaimDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        input.supportsDamageClaims = true;
      },
    );
    expect(() =>
      buildDerivedFormulaFixtureCoverageReport(damageClaimDrift),
    ).toThrow(/supportsDamageClaims must be false/);

    const energyInputDrift = cloneFixture(fixture);
    mutateFixtureReport(
      energyInputDrift,
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS[2],
      (input) => {
        input.energyRecoveryInputsUsed = true;
      },
    );
    expect(() => buildDerivedFormulaFixtureCoverageReport(energyInputDrift)).toThrow(
      /energyRecoveryInputsUsed must be false/,
    );
  });
});

function scenario(scenarioId: string) {
  const result = report.scenarios.find(
    (candidate) => candidate.scenarioId === scenarioId,
  );
  if (!result) throw new Error(`Missing scenario ${scenarioId}.`);
  return result;
}

async function loadFixture(): Promise<BuildDerivedFormulaFixtureCoverageInput> {
  const absolute = (relativePath: string) =>
    path.join(repositoryRoot, relativePath);
  const [
    fixtureReportInputs,
    repositoryInput,
    sourceRegistryInput,
    manualIndexInput,
    manualSnapshotInputs,
    checkedInRosterReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    Promise.all(
      DERIVED_FORMULA_FIXTURE_REPORT_PATHS.map(async (relativePath) => ({
        path: relativePath,
        reportInput: await readJson(absolute(relativePath)),
      })),
    ),
    readJson(absolute(repositoryPath)),
    readJson(absolute(sourceRegistryPath)),
    readJson(absolute(manualIndexPath)),
    Promise.all(
      DERIVED_FORMULA_FIXTURE_MANUAL_SNAPSHOT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          snapshotInput: await readJson(absolute(relativePath)),
        }),
      ),
    ),
    readJson(absolute(rosterReportPath)),
    Promise.all(
      DERIVED_FORMULA_FIXTURE_COVERAGE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(absolute(relativePath), "utf8"),
        }),
      ),
    ),
    Promise.all(
      DERIVED_FORMULA_FIXTURE_COVERAGE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(absolute(relativePath)),
        }),
      ),
    ),
  ]);
  return {
    fixtureReportInputs,
    repositoryInput,
    sourceRegistryInput,
    manualIndexInput,
    manualSnapshotInputs,
    sourceFiles,
    releasedCharacterIds: characters.map(({ id }) => id),
    checkedInRosterReportInput,
    generatedFrom,
  };
}

function cloneFixture(
  input: BuildDerivedFormulaFixtureCoverageInput,
): BuildDerivedFormulaFixtureCoverageInput {
  return structuredClone(input);
}

function mutateFixtureReport(
  input: BuildDerivedFormulaFixtureCoverageInput,
  reportPath: string,
  mutate: (report: Record<string, unknown>) => void,
): void {
  const reportInput = input.fixtureReportInputs.find(
    ({ path: relativePath }) => relativePath === reportPath,
  );
  if (!reportInput) throw new Error(`Missing fixture report ${reportPath}.`);
  const report = requiredRecord(reportInput.reportInput);
  mutate(report);
  replaceJsonSource(input, reportPath, report);
}

function replaceJsonSource(
  input: BuildDerivedFormulaFixtureCoverageInput,
  relativePath: string,
  value: unknown,
): void {
  replaceTextSource(input, relativePath, stableJson(value));
}

function mutateJsonSource(
  input: BuildDerivedFormulaFixtureCoverageInput,
  relativePath: string,
  mutate: (value: Record<string, unknown>) => void,
): void {
  const value = requiredRecord(JSON.parse(sourceText(input, relativePath)));
  mutate(value);
  replaceJsonSource(input, relativePath, value);
}

function sourceText(
  input: BuildDerivedFormulaFixtureCoverageInput,
  relativePath: string,
): string {
  const source = input.sourceFiles.find(({ path }) => path === relativePath);
  if (!source) throw new Error(`Missing source bytes for ${relativePath}.`);
  return source.text;
}

function replaceTextSource(
  input: BuildDerivedFormulaFixtureCoverageInput,
  relativePath: string,
  text: string,
): void {
  const source = input.sourceFiles.find(({ path }) => path === relativePath);
  const generated = input.generatedFrom.find(({ path }) => path === relativePath);
  if (!source || !generated) {
    throw new Error(`Missing source authentication for ${relativePath}.`);
  }
  source.text = text;
  generated.sha256 = sha256Text(text);
}

function generatedHash(
  input: BuildDerivedFormulaFixtureCoverageInput,
  relativePath: string,
): string {
  const result = input.generatedFrom.find(({ path }) => path === relativePath);
  if (!result) throw new Error(`Missing generated hash ${relativePath}.`);
  return result.sha256;
}

function requiredRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected fixture object.");
  }
  return value as Record<string, unknown>;
}

function requiredRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("Expected fixture array.");
  return value.map(requiredRecord);
}
