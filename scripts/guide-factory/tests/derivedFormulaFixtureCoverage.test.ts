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
        fixtureCount: 2,
        characterScenarioObservationCount: 8,
        uniqueCharacterCount: 6,
        derivedC0ObservationCount: 8,
        sourceConstellationSpecifiedObservationCount: 0,
        sourceConstellationUnspecifiedObservationCount: 8,
        positiveDefaultFormulaRowCount: 25,
        zeroDefaultFormulaRowCount: 11,
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
          sourceRotationTeamInvestment: "constellation-unspecified",
        });
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
      sourceRotationTeamInvestment: "constellation-unspecified",
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
      furina: 2,
      ineffa: 1,
      kaedehara_kazuha: 1,
      keqing: 1,
      neuvillette: 1,
      xilonen: 2,
    });
    expect(report.summary.sharedCharacterScenarioObservationCounts).toEqual({
      furina: 2,
      xilonen: 2,
    });
    expect(
      report.scenarios.map(({ scenarioId }) => scenarioId),
    ).toEqual([
      "furina-neuvillette-source-rotation-comparison-v2",
      "keqing-ineffa-source-rotation-comparison-v1",
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
  });

  it("records the complete no-execution and ER exclusion boundary", () => {
    expect(report.boundaries.exclusions).toEqual({
      formulaExecutionPerformed: false,
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
  const text = stableJson(value);
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
