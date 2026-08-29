import { describe, expect, it } from "vitest";
import { buildDionaComparisonReport } from "../src/comparison";
import { buildDionaErCalibrationReport } from "../src/dionaErCalibration";
import { readJson } from "../src/io";
import {
  KQM_MANUAL_SNAPSHOT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
} from "../src/schemas";

describe("KQM Diona pilot", () => {
  it("compares assertions without manufacturing consensus or an order", async () => {
    const [repositoryInput, snapshotInput] = await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH),
      readJson(KQM_MANUAL_SNAPSHOT_PATH),
    ]);
    const repository = KnowledgeRepositorySchema.parse(repositoryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(snapshotInput);
    const report = buildDionaComparisonReport(repository, snapshot, []);

    expect(report.assertions).toHaveLength(9);
    expect(report.prohibitedAggregates).toEqual([
      "winner",
      "confidence",
      "vote-count",
      "merged-order",
    ]);
    expect(report.assertions.every(({ promotionEligible }) => !promotionEligible)).toBe(
      true
    );

    expect(assertion(report, "diona-weapons")).toMatchObject({
      relation: "overlap",
      orderingRelation: "not-comparable",
      shared: ["sacrificial_bow"],
      sourceOnly: [
        "elegy_for_the_end",
        "favonius_warbow",
        "recurve_bow",
        "silvershower_heartstrings",
      ],
    });
    expect(assertion(report, "diona-goblet")).toMatchObject({
      relation: "same",
      shared: ["hp%"],
    });
    expect(assertion(report, "diona-substats")).toMatchObject({
      relation: "overlap",
      orderingRelation: "different",
      shared: ["er", "hp%"],
      sourceOnly: ["cr", "hp"],
    });
    expect(assertion(report, "diona-er-guidance").relation).toBe(
      "source-only"
    );
    expect(assertion(report, "diona-forward-melt-team").relation).toBe(
      "source-only"
    );

    const partiallyReviewed = structuredClone(snapshot);
    const weaponRecord = partiallyReviewed.records.find(
      (record) =>
        record.kind === "character_guide" &&
        record.recommendation.scope === "weapons"
    );
    if (!weaponRecord) throw new Error("Missing Diona weapon source record");
    weaponRecord.extraction = {
      method: "agent-assisted",
      reviewStatus: "reviewed",
      reviewer: "guide-factory regression fixture",
      reviewedAt: "2026-08-29",
    };
    const mixedReport = buildDionaComparisonReport(
      repository,
      partiallyReviewed,
      []
    );
    expect(
      assertion(mixedReport, "diona-weapons")
        .sourceExtractionReviewStatus
    ).toBe("reviewed");
    expect(
      assertion(mixedReport, "diona-artifact-sets")
        .sourceExtractionReviewStatus
    ).toBe("unreviewed");
  });

  it("keeps numerical ER results separate from unresolved source assumptions", async () => {
    const repository = KnowledgeRepositorySchema.parse(
      await readJson(KNOWLEDGE_REPOSITORY_PATH)
    );
    const report = buildDionaErCalibrationReport(repository, []);

    expect(report.status).toBe("assumption-incomplete");
    expect(report.source).toMatchObject({
      pageBandPercent: [190, 200],
      supportingDisplayedPercent: 192,
      supportingCalculationPercent: 192.1826030394418,
      supportingSheetCell: "N38",
      durationSeconds: 20,
    });
    expect(report.engineScenario).toMatchObject({
      ordinalDurationSeconds: 11.5,
      unmodeledSourceDurationSeconds: 8.5,
    });
    expect(report.normalizationDecisions.enemyDrops).toBe(0);
    expect(report.normalizationDecisions.favoniusProcs).toEqual([
      { actionIndex: 3, count: 1 },
    ]);
    expect(
      report.normalizationDecisions.sourceAssumptionsNotImplemented
    ).toEqual(["safe particle RNG", "default enemy particles"]);

    const expected = report.outputs.find(
      ({ particleMode }) => particleMode === "expected"
    );
    const max = report.outputs.find(({ particleMode }) => particleMode === "max");
    expect(expected?.diona.erPercent).toBeCloseTo(207.33652312599747, 10);
    expect(max?.diona.erPercent).toBeCloseTo(186.78160919540272, 10);
    expect(expected?.diona.withinPageBand).toBe(false);
    expect(max?.diona.withinPageBand).toBe(false);
    expect(expected?.diona.matchesSupportingCalculation).toBe(false);
    expect(max?.diona.matchesSupportingCalculation).toBe(false);
    expect(report.unresolved).toContain(
      "mathematical meaning of safe particle RNG"
    );
  });
});

function assertion(
  report: ReturnType<typeof buildDionaComparisonReport>,
  id: string
) {
  const value = report.assertions.find((candidate) => candidate.id === id);
  expect(value, `Missing comparison assertion ${id}`).toBeDefined();
  if (!value) throw new Error(`Missing comparison assertion ${id}`);
  return value;
}
