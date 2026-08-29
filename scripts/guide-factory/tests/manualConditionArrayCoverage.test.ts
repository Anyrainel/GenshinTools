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

const KEQING_EQUIPMENT_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/keqing-lunar-equipment-evidence-validation.json";
const KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH =
  "scripts/guide-factory/reports/klee-source-local-condition-slice.json";

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
      sourceFileCount: 15,
    });
    expect(report.corpusBoundary).toMatchObject({
      snapshotCount: 7,
      manualRecordCount: 64,
      occurrenceCount: 142,
      repositoryParityStatus: "exact",
      repositoryExactMatchCount: 142,
      repositoryMismatchCount: 0,
      allCurrentRecordsAgentAssistedUnreviewed: true,
    });
    expect(report.bindingBoundary).toMatchObject({
      status: "authenticated",
      occurrenceCount: 53,
      ittoAuthenticated: true,
      keqingEquipmentDurableMatchesCurrent: true,
      keqingRolePairDurableMatchesCurrent: true,
      kleeSourceLocalDurableMatchesCurrent: true,
      keqingEquipmentAtomicClaimCount: 42,
      kleeSourceLocalOccurrenceCount: 4,
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
    expect(generatedPaths.size).toBe(report.generatedFrom.length);
    expect(generatedPaths).toContain(KLEE_SOURCE_LOCAL_REPORT_RELATIVE_PATH);
    expect(generatedPaths).toContain(
      "scripts/guide-factory/src/kleeSourceLocalConditionSlice.ts",
    );
    expect(generatedPaths).toContain(
      "scripts/guide-factory/src/sourceLocalConditionSlice.ts",
    );
    expect(KLEE_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
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
      occurrenceCount: 142,
      emptyCount: 16,
      nonemptyCount: 126,
      uniqueExactArrayCount: 89,
      stringOccurrenceCount: 159,
      uniqueStringCount: 97,
    });
    expect(report.summary.bindingCoverage).toEqual({
      occurrenceCount: 126,
      emptyCount: 0,
      nonemptyCount: 126,
      uniqueExactArrayCount: 89,
      stringOccurrenceCount: 159,
      uniqueStringCount: 97,
      typedBoundOccurrenceCount: 50,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 73,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 72,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 84,
      invalidStringOccurrenceCount: 0,
    });
    expect(report.summary.nonStructuralBindingCoverage).toEqual({
      occurrenceCount: 123,
      emptyCount: 0,
      nonemptyCount: 123,
      uniqueExactArrayCount: 86,
      stringOccurrenceCount: 156,
      uniqueStringCount: 94,
      typedBoundOccurrenceCount: 50,
      exactTextAcknowledgedOccurrenceCount: 3,
      unboundOccurrenceCount: 70,
      invalidOccurrenceCount: 0,
      typedBoundStringOccurrenceCount: 72,
      exactTextAcknowledgedStringOccurrenceCount: 3,
      unboundStringOccurrenceCount: 81,
      invalidStringOccurrenceCount: 0,
    });
    expect(report.summary.nonStructuralUniqueBindingArrayCoverage).toEqual({
      uniqueExactArrayCount: 86,
      typedOnlyCount: 28,
      unboundOnlyCount: 57,
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
        occurrenceCount: 47,
        emptyCount: 0,
        nonemptyCount: 47,
        uniqueExactArrayCount: 27,
        stringOccurrenceCount: 69,
        uniqueStringCount: 28,
      },
      energyUnclassified: {
        occurrenceCount: 64,
        emptyCount: 0,
        nonemptyCount: 64,
        uniqueExactArrayCount: 50,
        stringOccurrenceCount: 72,
        uniqueStringCount: 55,
      },
      unconditional: {
        occurrenceCount: 16,
        emptyCount: 16,
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
    expect(report.nonStructuralUniqueBindingStatusSets).toHaveLength(86);
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
    ).toHaveLength(47);
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
        bindingEvidence?.kind === "klee-source-local-typed-predicate-ast",
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
            "klee-source-local-typed-predicate-ast" &&
          row.bindingEvidence.selectedOccurrenceId === row.occurrenceId &&
          row.energyEvidence?.kind ===
            "klee-source-local-not-energy-deferred" &&
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
