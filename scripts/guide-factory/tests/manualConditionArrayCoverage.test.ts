import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { sha256File, sha256Text, stableJson } from "../src/io";
import {
  buildManualConditionArrayCoverageReport,
  MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS,
  MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH,
  MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS,
  requireComparableManualConditionArrayCoverageReport,
  type BuildManualConditionArrayCoverageReportInput,
  type ManualConditionArrayCoverageReport,
} from "../src/manualConditionArrayCoverageReport";
import { loadManualSnapshotInputs } from "../src/manualSnapshots";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH,
} from "../src/paths";
import { readJson } from "../src/io";
import { KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS } from "../src/kleeSourceLocalConditionSlice";
import { DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS } from "../src/dionaSourceLocalSupportSlice";
import { KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS } from "../src/kokomiSourceLocalArtifactSlice";
import { NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS } from "../src/noelleSourceLocalHighInvestmentSlice";
import { NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS } from "../src/noelleSourceLocalLowerInvestmentSlice";

const KEQING_EQUIPMENT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/klee-source-local-condition-slice.json";
const DIONA_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/diona-source-local-support-slice.json";
const KOKOMI_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/kokomi-source-local-artifact-slice.json";
const NOELLE_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-high-investment-slice.json";
const NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/noelle-source-local-lower-investment-slice.json";

describe("manual condition-array coverage report", () => {
  let input: BuildManualConditionArrayCoverageReportInput;
  let report: ManualConditionArrayCoverageReport;

  beforeAll(async () => {
    input = await fixture();
    report = await buildManualConditionArrayCoverageReport(input);
  });

  it("authenticates exact source arrays, repository parity, and current bindings", () => {
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.rawInputBoundary).toMatchObject({
      status: "accepted",
      exactPathSet: true,
      rawJsonObjectClosure: true,
      sourceFileCount: 19,
    });
    expect(report.corpusBoundary).toMatchObject({
      snapshotCount: 8,
      manualRecordCount: 71,
      occurrenceCount: 163,
      repositoryParityStatus: "exact",
      repositoryExactMatchCount: 163,
      repositoryMismatchCount: 0,
      allCurrentRecordsAgentAssistedUnreviewed: true,
    });
    expect(report.bindingBoundary).toMatchObject({
      status: "authenticated",
      occurrenceCount: 63,
      ittoAuthenticated: true,
      keqingEquipmentDurableMatchesCurrent: true,
      keqingRolePairDurableMatchesCurrent: true,
      kleeSourceLocalDurableMatchesCurrent: true,
      dionaSourceLocalDurableMatchesCurrent: true,
      kokomiSourceLocalDurableMatchesCurrent: true,
      noelleSourceLocalDurableMatchesCurrent: true,
      noelleSourceLocalLowerInvestmentDurableMatchesCurrent: true,
      keqingEquipmentAtomicClaimCount: 42,
      kleeSourceLocalOccurrenceCount: 4,
      dionaSourceLocalOccurrenceCount: 3,
      kokomiSourceLocalOccurrenceCount: 1,
      noelleSourceLocalOccurrenceCount: 3,
      noelleSourceLocalLowerInvestmentOccurrenceCount: 3,
      exactTextAcknowledgementOccurrenceCount: 3,
      typedBindingMeansConditionTruth: false,
    });
    expect(() =>
      requireComparableManualConditionArrayCoverageReport(
        report,
        input.generatedFrom,
      ),
    ).not.toThrow();
    const generatedPaths = new Set(report.generatedFrom.map(({ path }) => path));
    expect(report.generatedFrom).toHaveLength(77);
    expect(generatedPaths.size).toBe(report.generatedFrom.length);
    expect(generatedPaths).toContain(KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH);
    expect(generatedPaths).toContain(DIONA_SOURCE_LOCAL_REPORT_RELATIVE_PATH);
    expect(generatedPaths).toContain(KOKOMI_SOURCE_LOCAL_REPORT_RELATIVE_PATH);
    expect(generatedPaths).toContain(NOELLE_SOURCE_LOCAL_REPORT_RELATIVE_PATH);
    expect(generatedPaths).toContain(
      NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_REPORT_RELATIVE_PATH,
    );
    expect(generatedPaths).toContain(
      "scripts/guide-factory/src/kleeSourceLocalConditionSlice.ts",
    );
    expect(generatedPaths).toContain(
      "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    );
    expect(KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    );
    expect(DIONA_SOURCE_LOCAL_SUPPORT_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    );
    expect(KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    );
    expect(NOELLE_SOURCE_LOCAL_HIGH_INVESTMENT_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    );
    expect(NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/src/manualConditionArrayCoverageReport.ts",
    );
  });

  it("rejects the reviewer's self-declared boundary mutation", () => {
    const mutated = structuredClone(report);
    mutated.summary.total.occurrenceCount = 999;
    mutated.occurrences = [];
    mutated.rawInputBoundary.exactPathSet = false;
    mutated.rawInputBoundary.rawJsonObjectClosure = false;

    expect(() =>
      requireComparableManualConditionArrayCoverageReport(
        mutated,
        input.generatedFrom,
      ),
    ).toThrow("Refusing to write");
  });

  it("rejects pinned rows and derived summary/status-set mutations", () => {
    const mutations: Array<{
      name: string;
      mutate: (candidate: ManualConditionArrayCoverageReport) => void;
    }> = [
      {
        name: "occurrence row",
        mutate: (candidate) => {
          const first = candidate.occurrences[0];
          if (first) first.subject = "tampered-subject";
        },
      },
      {
        name: "corpus parity count",
        mutate: (candidate) => {
          candidate.corpusBoundary.repositoryExactMatchCount = 141;
        },
      },
      {
        name: "ER-deferred total",
        mutate: (candidate) => {
          candidate.summary.displayStatusCounts["er-deferred"] = 5;
        },
      },
      {
        name: "non-structural unique binding-array total",
        mutate: (candidate) => {
          candidate.summary.nonStructuralUniqueBindingArrayCoverage.uniqueExactArrayCount =
            84;
        },
      },
      {
        name: "non-structural unique binding status sets",
        mutate: (candidate) => {
          candidate.nonStructuralUniqueBindingStatusSets.pop();
        },
      },
    ];

    for (const { name, mutate } of mutations) {
      const mutated = structuredClone(report);
      mutate(mutated);
      expect(
        () =>
          requireComparableManualConditionArrayCoverageReport(
            mutated,
            input.generatedFrom,
          ),
        name,
      ).toThrow("Refusing to write");
    }
  });

  it("rejects self-declared generatedFrom hashes without an independent current boundary", () => {
    const mutated = structuredClone(report);
    mutated.generatedFrom = mutated.generatedFrom.map((entry) => ({
      ...entry,
      sha256: "0".repeat(64),
    }));

    expect(() =>
      requireComparableManualConditionArrayCoverageReport(
        mutated,
        input.generatedFrom,
      ),
    ).toThrow("independently computed current path/hash boundary");
  });

  it("keeps occurrence, string, and unique-array denominators independent", () => {
    expect(report.summary.total).toEqual({
      occurrenceCount: 163,
      emptyCount: 20,
      nonemptyCount: 143,
      uniqueExactArrayCount: 105,
      stringOccurrenceCount: 177,
      uniqueStringCount: 114,
    });
    expect(report.summary.bindingCoverage).toEqual({
      occurrenceCount: 143,
      emptyCount: 0,
      nonemptyCount: 143,
      uniqueExactArrayCount: 105,
      stringOccurrenceCount: 177,
      uniqueStringCount: 114,
      typedBoundOccurrenceCount: 60,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 80,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 82,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 92,
      invalidStringOccurrenceCount: 0,
    });
    expect(report.summary.nonStructuralBindingCoverage).toEqual({
      occurrenceCount: 140,
      emptyCount: 0,
      nonemptyCount: 140,
      uniqueExactArrayCount: 102,
      stringOccurrenceCount: 174,
      uniqueStringCount: 111,
      typedBoundOccurrenceCount: 60,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 77,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 82,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 89,
      invalidStringOccurrenceCount: 0,
    });
    expect(report.summary.nonStructuralUniqueBindingArrayCoverage).toEqual({
      uniqueExactArrayCount: 102,
      typedOnlyCount: 34,
      unboundOnlyCount: 67,
      mixedAcknowledgedAndUnboundCount: 1,
      otherMixedCount: 0,
    });
    expect(report.summary.energyCoverage).toEqual({
      structuralEr: {
        occurrenceCount: 3,
        emptyCount: 0,
        nonemptyCount: 3,
        uniqueExactArrayCount: 3,
        stringOccurrenceCount: 3,
        uniqueStringCount: 3,
      },
      deferredEnergyPrerequisite: {
        occurrenceCount: 3,
        emptyCount: 0,
        nonemptyCount: 3,
        uniqueExactArrayCount: 1,
        stringOccurrenceCount: 3,
        uniqueStringCount: 1,
      },
      exactAuthoredEnergyRelatedDeferral: {
        occurrenceCount: 9,
        emptyCount: 0,
        nonemptyCount: 9,
        uniqueExactArrayCount: 8,
        stringOccurrenceCount: 12,
        uniqueStringCount: 11,
      },
      notEnergyDeferred: {
        occurrenceCount: 57,
        emptyCount: 0,
        nonemptyCount: 57,
        uniqueExactArrayCount: 33,
        stringOccurrenceCount: 79,
        uniqueStringCount: 34,
      },
      energyUnclassified: {
        occurrenceCount: 71,
        emptyCount: 0,
        nonemptyCount: 71,
        uniqueExactArrayCount: 60,
        stringOccurrenceCount: 80,
        uniqueStringCount: 67,
      },
      unconditional: {
        occurrenceCount: 20,
        emptyCount: 20,
        nonemptyCount: 0,
        uniqueExactArrayCount: 0,
        stringOccurrenceCount: 0,
        uniqueStringCount: 0,
      },
      deferredDisplay: {
        occurrenceCount: 15,
        emptyCount: 0,
        nonemptyCount: 15,
        uniqueExactArrayCount: 12,
        stringOccurrenceCount: 18,
        uniqueStringCount: 15,
      },
    });
    expect(report.summary.displayStatusCounts).toEqual({
      invalid: 0,
      unconditional: 20,
      "er-deferred": 15,
      "typed-bound": 57,
      "exact-text-acknowledged": 3,
      "known-but-unbound": 68,
    });
    expect(report.nonStructuralUniqueBindingStatusSets).toHaveLength(102);
    expect(
      report.nonStructuralUniqueBindingStatusSets.every(
        (statusSet) =>
          statusSet.bindingClassifications.length > 0 &&
          !("displayStatuses" in statusSet),
      ),
    ).toBe(true);
  });

  it("does not leak identical VV acknowledgements to unexercised role members", () => {
    const roleRows = report.occurrences.filter(
      ({ sourceRecordId }) =>
        sourceRecordId ===
        "keqing-lunar-charged-resistance-shred-options",
    );
    const bySubject = Object.fromEntries(
      roleRows.map((row) => [row.subject, row] as const),
    );
    expect(bySubject.jean).toMatchObject({
      bindingClassification: "exact-text-acknowledged",
      energyClassification: "energy-unclassified",
      energyEvidence: null,
      displayStatus: "exact-text-acknowledged",
      bindingEvidence: {
        kind: "keqing-role-exact-text-acknowledgement",
        characterId: "jean",
      },
    });
    expect(bySubject.kaedehara_kazuha).toMatchObject({
      bindingClassification: "exact-text-acknowledged",
      energyClassification: "energy-unclassified",
    });
    expect(bySubject.sucrose).toMatchObject({
      bindingClassification: "exact-text-acknowledged",
      energyClassification: "energy-unclassified",
    });
    expect(bySubject.sayu).toMatchObject({
      bindingClassification: "unbound",
      displayStatus: "known-but-unbound",
      bindingEvidence: null,
    });
    expect(bySubject.xianyun).toMatchObject({
      bindingClassification: "unbound",
      displayStatus: "known-but-unbound",
      bindingEvidence: null,
    });
    expect(
      new Set(
        roleRows
          .filter(({ conditions }) => conditions.length > 0)
          .map(({ conditionsSha256 }) => conditionsSha256),
      ).size,
    ).toBe(1);
  });

  it("defers exactly the nine authored energy-sensitive unbound occurrences", () => {
    const expected = [
      [
        "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[1].conditions",
        "0e9c01546ec5f030715c0e238dfbf3bba904f943d70c0b828c77f0ae25edfb29",
      ],
      [
        "kqm:character_guide:diona-support-weapons-luna-viii:recommendation.weaponRecommendations[4].conditions",
        "08103e8077a944df71baaea7bac53b4e74a63fec31bfa156f87118121efc2e8a",
      ],
      [
        "kqm:character_guide:furina-contextual-weapons-luna-ii:recommendation.weaponRecommendations[0].conditions",
        "83da57a99d93e84af4f2c62636d501692bb0f192f9796505959333c299e75cee",
      ],
      [
        "kqm:character_guide:furina-contextual-weapons-luna-ii:recommendation.weaponRecommendations[1].conditions",
        "51f0ba216a3e10e91034af96a8fcba7ef5c06784bbe993755a0703fbeff13f51",
      ],
      [
        "kqm:character_guide:furina-contextual-weapons-luna-ii:recommendation.weaponRecommendations[5].conditions",
        "94b8b0030747525a173402ece293a4e505c6001b6592d04072e4d3d8094e61af",
      ],
      [
        "kqm:character_guide:furina-contextual-weapons-luna-ii:recommendation.weaponRecommendations[6].conditions",
        "23063943ad6f10b916ebbce29fd412503e8ee4f9ae23b1f59e4195bc0ba6c8a3",
      ],
      [
        "kqm:character_guide:furina-post-er-substats-luna-ii:recommendation.substats[0].conditions",
        "e8a6a983626561caee737eb6a1a7959cebf3f1b7a06653f5e3ccc894fe40bda8",
      ],
      [
        "kqm:character_guide:furina-post-er-substats-luna-ii:recommendation.substats[1].conditions",
        "e8a6a983626561caee737eb6a1a7959cebf3f1b7a06653f5e3ccc894fe40bda8",
      ],
      [
        "kqm:character_guide:furina-pre-c2-artifact-main-stats-luna-ii:recommendation.mainStats.sands[0].conditions",
        "afd3f384f5642c3220f809485fc56efcc12d96000174da50b95bd180eea61a44",
      ],
    ].sort(([left], [right]) => left.localeCompare(right));
    const authored = report.occurrences.filter(
      ({ energyClassification }) =>
        energyClassification === "exact-authored-energy-related-deferral",
    );

    expect(
      authored.map(({ occurrenceId, conditionsSha256 }) => [
        occurrenceId,
        conditionsSha256,
      ]),
    ).toEqual(expected);
    expect(
      authored.every(
        (occurrence) =>
          occurrence.bindingClassification === "unbound" &&
          occurrence.displayStatus === "er-deferred" &&
          occurrence.bindingCoverageEligible &&
          occurrence.nonStructuralBindingCoverageEligible &&
          occurrence.energyEvidence?.kind ===
            "exact-authored-energy-related-deferral" &&
          occurrence.energyEvidence.energyRelatedWorkDeferred &&
          occurrence.energyEvidence.occurrenceKey ===
            `${occurrence.occurrenceId}:${occurrence.conditionsSha256}` &&
          occurrence.energyEvidence.category.length > 0 &&
          occurrence.energyEvidence.reason.length > 0,
      ),
    ).toBe(true);
  });

  it("keeps typed predicate mapping distinct from applicability truth and ER work", () => {
    const ittoDeferred = report.occurrences.filter(
      ({ subject, energyClassification }) =>
        subject === "arataki_itto" &&
        energyClassification === "deferred-energy-prerequisite",
    );
    expect(ittoDeferred).toHaveLength(3);
    expect(ittoDeferred).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bindingClassification: "typed-bound",
          displayStatus: "er-deferred",
          bindingCoverageEligible: true,
          nonStructuralBindingCoverageEligible: true,
          bindingEvidence: expect.objectContaining({
            kind: "itto-typed-predicate-ast",
          }),
        }),
      ]),
    );
    expect(
      report.occurrences.filter(
        ({ energyClassification }) =>
          energyClassification === "not-energy-deferred",
      ),
    ).toHaveLength(57);
    expect(
      report.occurrences
        .filter(
          ({ energyClassification }) =>
            energyClassification === "structural-er",
        )
        .every(
          ({ energyEvidence }) =>
            energyEvidence?.kind === "structural-er" &&
            energyEvidence.energyRelatedWorkDeferred,
        ),
    ).toBe(true);
    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsEnergyRecoveryClaims: false,
      conditionTruthEstablished: false,
      recommendationCompositionExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
  });

  it("promotes only the four freshly authenticated Klee occurrences", () => {
    const kleeRows = report.occurrences.filter(
      ({ bindingEvidence }) =>
        bindingEvidence?.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-klee-source-local-condition-slice-luna-iv",
    );

    expect(kleeRows).toHaveLength(4);
    expect(
      kleeRows.map(({ occurrenceId }) => occurrenceId).sort(),
    ).toEqual([
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.circlet[0].conditions",
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.goblet[0].conditions",
      "kqm:character_guide:klee-on-field-artifact-stats-luna-iv:recommendation.mainStats.sands[0].conditions",
      "kqm:character_guide:klee-on-field-contextual-artifact-sets-luna-iv:recommendation.artifactRecommendations[2].conditions",
    ]);
    expect(
      kleeRows.every(
        (row) =>
          row.bindingClassification === "typed-bound" &&
          row.energyClassification === "not-energy-deferred" &&
          row.displayStatus === "typed-bound" &&
          row.bindingEvidence?.kind ===
            "source-local-typed-predicate-ast" &&
          row.bindingEvidence.selectedOccurrenceId === row.occurrenceId &&
          row.energyEvidence?.kind ===
            "source-local-not-energy-deferred" &&
          row.energyEvidence.selectedOccurrenceId === row.occurrenceId &&
          row.energyEvidence.selectedOccurrenceSha256 ===
            row.bindingEvidence.selectedOccurrenceSha256,
      ),
    ).toBe(true);
    const holdoutRows = report.occurrences.filter(
      ({ subject, bindingClassification }) =>
        subject === "klee" && bindingClassification === "unbound",
    );
    const durableSource = input.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!durableSource) throw new Error("Missing Klee durable report fixture.");
    const durableHoldoutIds = (
      JSON.parse(durableSource.text) as {
        holdoutOccurrences: Array<{ occurrenceId: string }>;
      }
    ).holdoutOccurrences
      .map(({ occurrenceId }) => occurrenceId)
      .sort();
    expect(holdoutRows).toHaveLength(11);
    expect(holdoutRows.map(({ occurrenceId }) => occurrenceId).sort()).toEqual(
      durableHoldoutIds,
    );
    expect(
      holdoutRows.every(
        ({ energyClassification, bindingEvidence, energyEvidence }) =>
          energyClassification === "energy-unclassified" &&
          bindingEvidence == null &&
          energyEvidence == null,
      ),
    ).toBe(true);
  });

  it("promotes only the three freshly authenticated Diona support occurrences", () => {
    const dionaRows = report.occurrences.filter(
      ({ bindingEvidence }) =>
        bindingEvidence?.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-diona-source-local-support-slice-luna-viii",
    );
    expect(
      dionaRows.map(({ occurrenceId, recordKind, subject }) => ({
        occurrenceId,
        recordKind,
        subject,
      })),
    ).toEqual([
      {
        occurrenceId:
          "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[0].artifactRecommendations[0].conditions",
        recordKind: "team",
        subject: "diona",
      },
      {
        occurrenceId:
          "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[2].artifactRecommendations[0].conditions",
        recordKind: "team",
        subject: "citlali",
      },
      {
        occurrenceId:
          "kqm:team:c6-diona-mavuika-citlali-bennett-forward-melt:members[3].artifactRecommendations[0].conditions",
        recordKind: "team",
        subject: "bennett",
      },
    ]);
    expect(
      dionaRows.every(
        (row) =>
          row.bindingClassification === "typed-bound" &&
          row.energyClassification === "not-energy-deferred" &&
          row.displayStatus === "typed-bound" &&
          row.bindingEvidence?.kind ===
            "source-local-typed-predicate-ast" &&
          row.energyEvidence?.kind ===
            "source-local-not-energy-deferred" &&
          row.energyEvidence.sliceId === row.bindingEvidence.sliceId &&
          row.energyEvidence.selectedOccurrenceId === row.occurrenceId &&
          row.energyEvidence.selectedOccurrenceSha256 ===
            row.bindingEvidence.selectedOccurrenceSha256,
      ),
    ).toBe(true);

    const durableSource = input.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === DIONA_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!durableSource) throw new Error("Missing Diona durable report fixture.");
    const durableHoldoutIds = (
      JSON.parse(durableSource.text) as {
        holdoutOccurrences: Array<{ occurrenceId: string }>;
      }
    ).holdoutOccurrences
      .map(({ occurrenceId }) => occurrenceId)
      .sort();
    const holdoutRows = report.occurrences.filter(({ occurrenceId }) =>
      durableHoldoutIds.includes(occurrenceId),
    );
    expect(holdoutRows).toHaveLength(15);
    expect(holdoutRows.map(({ occurrenceId }) => occurrenceId).sort()).toEqual(
      durableHoldoutIds,
    );
    expect(
      holdoutRows.every(
        ({ bindingClassification, bindingEvidence }) =>
          bindingClassification === "unbound" && bindingEvidence == null,
      ),
    ).toBe(true);
    expect(
      holdoutRows.filter(
        ({ energyClassification }) =>
          energyClassification === "structural-er" ||
          energyClassification === "exact-authored-energy-related-deferral",
      ),
    ).toHaveLength(5);
  });

  it("promotes only the exact Kokomi row while leaving all four holdouts unclassified", () => {
    const kokomiRows = report.occurrences.filter(
      ({ bindingEvidence }) =>
        bindingEvidence?.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-kokomi-source-local-artifact-slice-luna-v",
    );
    expect(kokomiRows).toHaveLength(1);
    expect(kokomiRows[0]).toMatchObject({
      occurrenceId:
        "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[0].conditions",
      recordKind: "team",
      subject: "sangonomiya_kokomi",
      conditions: [
        "For Kokomi in this exact Lunar-Charged example team.",
      ],
      bindingClassification: "typed-bound",
      energyClassification: "not-energy-deferred",
      displayStatus: "typed-bound",
      bindingEvidence: {
        kind: "source-local-typed-predicate-ast",
        sliceId: "kqm-kokomi-source-local-artifact-slice-luna-v",
        predicateAstSha256:
          "2c60322cf3d1b6691dbde84bd5484364752c87bb18634bd9303fd6ec2e03dcda",
        payloadSha256:
          "bfd412bb94e8e50e9deec6813ef5329eb71c656fdd1af64fc8b5a2243543e1a0",
      },
      energyEvidence: {
        kind: "source-local-not-energy-deferred",
        structuralErEvidencePresent: false,
        energyRelatedWorkDeferred: false,
        sliceId: "kqm-kokomi-source-local-artifact-slice-luna-v",
      },
    });

    const expectedHoldoutIds = [
      "kqm:character_guide:kokomi-on-field-nod-krai-artifact-delegation-luna-v:recommendation.artifactRecommendations[0].conditions",
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:artifactPlans[0].conditions",
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[1].conditions",
      "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[2].artifactRecommendations[0].conditions",
    ].sort();
    const holdoutRows = report.occurrences.filter(({ occurrenceId }) =>
      expectedHoldoutIds.includes(occurrenceId),
    );
    expect(holdoutRows.map(({ occurrenceId }) => occurrenceId).sort()).toEqual(
      expectedHoldoutIds,
    );
    expect(
      holdoutRows.every(
        ({ bindingClassification, energyClassification, bindingEvidence, energyEvidence }) =>
          bindingClassification === "unbound" &&
          energyClassification === "energy-unclassified" &&
          bindingEvidence == null &&
          energyEvidence == null,
      ),
    ).toBe(true);
    expect(report.supportsEquipmentRecommendations).toBe(false);
    expect(report.supportsEnergyRecoveryClaims).toBe(false);
  });

  it("keeps the high- and lower-investment Noelle admissions separate and leaves all other rows outside", () => {
    const noelleRows = report.occurrences.filter(
      ({ snapshotPath }) =>
        snapshotPath ===
        "scripts/guide-factory/data/source-snapshots/kqm-noelle-manual.json",
    );
    const promoted = noelleRows.filter(
      ({ bindingEvidence }) =>
        bindingEvidence?.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-noelle-source-local-high-investment-slice-luna-viii",
    );
    expect(promoted).toHaveLength(3);
    expect(promoted.map(({ manualClaimPath }) => manualClaimPath).sort()).toEqual([
      "recommendation.mainStats.circlet[0].conditions",
      "recommendation.mainStats.goblet[0].conditions",
      "recommendation.mainStats.sands[0].conditions",
    ]);
    expect(
      promoted.every(
        (row) =>
          row.subject === "noelle" &&
          row.conditions[0] ===
            "Noelle is C6 or her Burst Talent is Level 10 or higher." &&
          row.bindingClassification === "typed-bound" &&
          row.energyClassification === "not-energy-deferred" &&
          row.displayStatus === "typed-bound" &&
          row.bindingEvidence?.kind ===
            "source-local-typed-predicate-ast" &&
          row.bindingEvidence.predicateAstSha256 ===
            "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a" &&
          row.energyEvidence?.kind ===
            "source-local-not-energy-deferred" &&
          !row.energyEvidence.energyRelatedWorkDeferred,
      ),
    ).toBe(true);

    const lowerPromoted = noelleRows.filter(
      ({ bindingEvidence }) =>
        bindingEvidence?.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-noelle-source-local-lower-investment-slice-luna-viii",
    );
    expect(lowerPromoted).toHaveLength(3);
    expect(
      lowerPromoted.map(({ manualClaimPath }) => manualClaimPath).sort(),
    ).toEqual([
      "recommendation.mainStats.circlet[0].conditions",
      "recommendation.mainStats.goblet[0].conditions",
      "recommendation.mainStats.sands[0].conditions",
    ]);
    expect(
      lowerPromoted.every(
        (row) =>
          row.subject === "noelle" &&
          row.sourceRecordId ===
            "noelle-c0-c5-talent-9-artifact-stats-luna-viii" &&
          row.conditions[0] ===
            "Noelle is C0–C5 and her Burst Talent is Level 9." &&
          row.bindingClassification === "typed-bound" &&
          row.energyClassification === "not-energy-deferred" &&
          row.displayStatus === "typed-bound" &&
          row.bindingEvidence?.kind ===
            "source-local-typed-predicate-ast" &&
          row.bindingEvidence.predicateAstSha256 ===
            "a700f51166e436253a9943351cc4255141d6ebaf083273fc0bacf8fda0b85a8a" &&
          row.energyEvidence?.kind ===
            "source-local-not-energy-deferred" &&
          !row.energyEvidence.energyRelatedWorkDeferred,
      ),
    ).toBe(true);

    const outside = noelleRows.filter(
      ({ occurrenceId }) =>
        !promoted.some(
          (promotedRow) => promotedRow.occurrenceId === occurrenceId,
        ) &&
        !lowerPromoted.some(
          (promotedRow) => promotedRow.occurrenceId === occurrenceId,
        ),
    );
    expect(outside).toHaveLength(10);
    expect(outside.filter(({ conditions }) => conditions.length > 0)).toHaveLength(
      9,
    );
    expect(outside.filter(({ conditions }) => conditions.length === 0)).toHaveLength(
      1,
    );
    expect(
      outside.every(
        ({ conditions, bindingClassification, energyClassification, bindingEvidence, energyEvidence }) =>
          bindingClassification === "unbound" &&
          bindingEvidence == null &&
          (conditions.length === 0
            ? energyClassification === "energy-unclassified" &&
              energyEvidence == null
            : energyClassification === "energy-unclassified" &&
              energyEvidence == null),
      ),
    ).toBe(true);
  });

  it("fails closed when a byte-authenticated durable wrapper is stale", async () => {
    const staleInput = structuredClone(input);
    const staleEquipment = structuredClone(
      staleInput.keqingEquipmentDurableReportInput as {
        claims: unknown[];
      },
    );
    staleEquipment.claims.pop();
    const staleText = stableJson(staleEquipment);
    const staleHash = sha256Text(staleText);
    staleInput.keqingEquipmentDurableReportInput = staleEquipment;
    staleInput.sourceFiles = staleInput.sourceFiles.map((sourceFile) =>
      sourceFile.path === KEQING_EQUIPMENT_REPORT_RELATIVE_PATH
        ? { ...sourceFile, text: staleText }
        : sourceFile,
    );
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === KEQING_EQUIPMENT_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: staleHash }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(() =>
      requireComparableManualConditionArrayCoverageReport(
        stale,
        staleInput.generatedFrom,
      ),
    ).toThrow("Refusing to write");
  });

  it("fails closed when the byte-authenticated Klee report is stale against a fresh rebuild", async () => {
    const staleInput = structuredClone(input);
    const source = staleInput.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!source) throw new Error("Missing Klee durable report fixture.");
    const staleKlee = JSON.parse(source.text) as {
      selectedOccurrences: unknown[];
    };
    staleKlee.selectedOccurrences.pop();
    const staleText = stableJson(staleKlee);
    source.text = staleText;
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: sha256Text(staleText) }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(stale.issues[0]?.message).toContain(
      "failed a fresh current rebuild",
    );
  });

  it("fails closed when the byte-authenticated Diona report is stale against a fresh rebuild", async () => {
    const staleInput = structuredClone(input);
    const source = staleInput.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === DIONA_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!source) throw new Error("Missing Diona durable report fixture.");
    const staleDiona = JSON.parse(source.text) as {
      selectedOccurrences: unknown[];
    };
    staleDiona.selectedOccurrences.pop();
    const staleText = stableJson(staleDiona);
    source.text = staleText;
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === DIONA_SOURCE_LOCAL_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: sha256Text(staleText) }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(stale.issues[0]?.message).toContain(
      "checked-in Diona source-local report failed a fresh current rebuild",
    );
  });

  it("fails closed when the byte-authenticated Kokomi report is stale against a fresh rebuild", async () => {
    const staleInput = structuredClone(input);
    const source = staleInput.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === KOKOMI_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!source) throw new Error("Missing Kokomi durable report fixture.");
    const staleKokomi = JSON.parse(source.text) as {
      selectedOccurrences: unknown[];
    };
    staleKokomi.selectedOccurrences.pop();
    const staleText = stableJson(staleKokomi);
    source.text = staleText;
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === KOKOMI_SOURCE_LOCAL_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: sha256Text(staleText) }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(stale.issues[0]?.message).toContain(
      "checked-in Kokomi source-local report failed a fresh current rebuild",
    );
  });

  it("fails closed when the byte-authenticated Noelle report is stale against its numeric projection", async () => {
    const staleInput = structuredClone(input);
    const source = staleInput.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === NOELLE_SOURCE_LOCAL_REPORT_RELATIVE_PATH,
    );
    if (!source) throw new Error("Missing Noelle durable report fixture.");
    const staleNoelle = JSON.parse(source.text) as {
      numericEvaluationBoundary: { requestPredicateSha256: string };
    };
    staleNoelle.numericEvaluationBoundary.requestPredicateSha256 = "0".repeat(64);
    const staleText = stableJson(staleNoelle);
    source.text = staleText;
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === NOELLE_SOURCE_LOCAL_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: sha256Text(staleText) }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(stale.issues[0]?.message).toContain(
      "checked-in Noelle source-local report failed a fresh current rebuild",
    );
  });

  it("fails closed when the byte-authenticated lower-investment Noelle report is stale", async () => {
    const staleInput = structuredClone(input);
    const source = staleInput.sourceFiles.find(
      ({ path: sourcePath }) =>
        sourcePath === NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_REPORT_RELATIVE_PATH,
    );
    if (!source) {
      throw new Error("Missing lower-investment Noelle durable report fixture.");
    }
    const staleNoelle = JSON.parse(source.text) as {
      selectedOccurrences: unknown[];
    };
    staleNoelle.selectedOccurrences.pop();
    const staleText = stableJson(staleNoelle);
    source.text = staleText;
    staleInput.generatedFrom = staleInput.generatedFrom.map((entry) =>
      entry.path === NOELLE_SOURCE_LOCAL_LOWER_INVESTMENT_REPORT_RELATIVE_PATH
        ? { ...entry, sha256: sha256Text(staleText) }
        : entry,
    );

    const stale = await buildManualConditionArrayCoverageReport(staleInput);
    expect(stale.comparisonStatus).toBe("not-comparable");
    expect(stale.occurrences).toEqual([]);
    expect(stale.bindingBoundary.status).toBe("rejected");
    expect(stale.issues[0]?.message).toContain(
      "checked-in lower-investment Noelle source-local report failed a fresh current rebuild",
    );
  });

  it("authenticates the checked-in durable report against a fresh rebuild", async () => {
    const durable = (await readJson(
      MANUAL_CONDITION_ARRAY_COVERAGE_REPORT_PATH,
    )) as ManualConditionArrayCoverageReport;
    expect(stableJson(durable)).toBe(stableJson(report));
  });
});

async function fixture(): Promise<BuildManualConditionArrayCoverageReportInput> {
  const [
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    checkedInRosterDomainReportInput,
    ittoDurableReportInput,
    keqingEquipmentDurableReportInput,
    keqingRolePairDurableReportInput,
    sourceFiles,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    readJson(TEAM_ROSTER_CANDIDATE_DOMAIN_EXPERIMENT_REPORT_PATH),
    readJson(
      path.join(
        REPOSITORY_ROOT,
        "scripts/guide-factory/reports/itto-source-conditioned-guide-packets.json",
      ),
    ),
    readJson(KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH),
    readJson(KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH),
    Promise.all(
      MANUAL_CONDITION_ARRAY_COVERAGE_SOURCE_FILE_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          text: await readFile(
            path.join(REPOSITORY_ROOT, relativePath),
            "utf8",
          ),
        }),
      ),
    ),
    Promise.all(
      MANUAL_CONDITION_ARRAY_COVERAGE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  const manualInputs = await loadManualSnapshotInputs(
    manualIndexInput,
    sourceRegistryInput,
  );
  return {
    repositoryInput,
    manualIndexInput,
    sourceRegistryInput,
    manualInputs,
    catalogs,
    checkedInRosterDomainReportInput,
    ittoDurableReportInput,
    keqingEquipmentDurableReportInput,
    keqingRolePairDurableReportInput,
    sourceFiles,
    generatedFrom,
  };
}
