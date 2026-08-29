import { describe, expect, it } from "vitest";
import {
  buildCurrentConditionArrayOccurrenceId,
  buildCurrentConditionArrayOccurrenceKey,
  buildCurrentConditionBindingCatalog,
  type BuildCurrentConditionBindingCatalogInput,
  requireComparableCurrentConditionBindingCatalog,
} from "../src/currentConditionBindingCatalog";
import {
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
} from "../src/ittoSourceConditionedGuidePacket";
import { readJson, sha256Text, stableJson } from "../src/io";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { KEQING_ROLE_PAIR_VV_CONDITION } from "../src/keqingSourceScopedRolePairSample";
import type { KeqingSourceScopedRolePairSampleReport } from "../src/keqingSourceScopedRolePairSample";
import {
  KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  type KleeSourceLocalConditionSliceReport,
} from "../src/kleeSourceLocalConditionSlice";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
} from "../src/paths";
import type { SourceConditionedGuidePacketReport } from "../src/sourceConditionedGuidePacket";

describe("authenticated current condition-binding catalog", () => {
  it("builds the deterministic 53-occurrence catalog with exact current coverage", async () => {
    const fixture = await loadFixture();
    const before = structuredClone(fixture);
    const report = buildCurrentConditionBindingCatalog(fixture);
    const repeated = buildCurrentConditionBindingCatalog(fixture);

    expect(repeated).toEqual(report);
    expect(fixture).toEqual(before);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.entries).toHaveLength(53);
    expect(report.entries.map(({ occurrenceKey }) => occurrenceKey)).toEqual(
      [...report.entries.map(({ occurrenceKey }) => occurrenceKey)].sort(),
    );
    expect(
      new Set(report.entries.map(({ occurrenceId }) => occurrenceId)).size,
    ).toBe(53);
    expect(
      new Set(report.entries.map(({ occurrenceKey }) => occurrenceKey)).size,
    ).toBe(53);
    expect(report.summary).toEqual({
      occurrenceCount: 53,
      bindingClassificationCounts: {
        "typed-bound": 50,
        "exact-text-acknowledged": 3,
        unbound: 0,
        invalid: 0,
      },
      energyClassificationCounts: {
        "energy-unclassified": 3,
        "not-energy-deferred": 47,
        "structural-er": 0,
        "deferred-energy-prerequisite": 3,
        "exact-authored-energy-related-deferral": 0,
      },
      typedBindingCount: 50,
      ittoOccurrenceCount: 15,
      ittoTypedBindingCount: 15,
      ittoDeferredEnergyPrerequisiteCount: 3,
      keqingEquipmentOccurrenceCount: 31,
      keqingEquipmentAtomicClaimCount: 42,
      keqingVvAcknowledgedOccurrenceCount: 3,
      keqingVvExactTextAcknowledgementCount: 3,
      keqingVvUnacknowledgedSourceMemberIds: ["sayu", "xianyun"],
      kleeSourceLocalOccurrenceCount: 4,
      kleeSourceLocalTypedBindingCount: 4,
      kleeSourceLocalNotEnergyDeferredCount: 4,
    });
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsEnergyRecoveryClaims: false,
      energyRecoveryComputationExecuted: false,
      authenticationBoundary: {
        ittoAuthenticated: true,
        keqingEquipmentDurableMatchesCurrent: true,
        keqingRolePairDurableMatchesCurrent: true,
        kleeSourceLocalDurableMatchesCurrent: true,
      },
    });
    for (const entry of report.entries) {
      expect(entry.conditionsSha256).toBe(
        sha256Text(stableJson(entry.orderedConditions)),
      );
      expect(entry.occurrenceId).toBe(
        buildCurrentConditionArrayOccurrenceId(entry),
      );
      expect(entry.occurrenceKey).toBe(
        buildCurrentConditionArrayOccurrenceKey(entry),
      );
    }
  });

  it("keeps typed binding and deferred energy as independent dimensions", async () => {
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(await loadFixture()),
    );
    const ittoEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "itto-typed-predicate-ast",
    );
    const deferred = ittoEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "deferred-energy-prerequisite",
    );
    const notDeferred = ittoEntries.filter(
      ({ energyClassification }) =>
        energyClassification === "not-energy-deferred",
    );

    expect(ittoEntries).toHaveLength(15);
    expect(ittoEntries.every(({ typedBinding }) => typedBinding)).toBe(true);
    expect(notDeferred).toHaveLength(12);
    expect(deferred).toHaveLength(3);
    expect(
      deferred.every(
        (entry) =>
          entry.bindingClassification === "typed-bound" &&
          entry.energyClassification === "deferred-energy-prerequisite" &&
          entry.typedBinding &&
          entry.bindingEvidence.kind === "itto-typed-predicate-ast" &&
          entry.bindingEvidence.predicateAst.type ===
            "deferred-energy-prerequisite" &&
          entry.energyEvidence?.kind === "deferred-energy-prerequisite" &&
          entry.energyEvidence.energyRelatedWorkDeferred &&
          entry.manualClaimPath.startsWith("recommendation.substats[") &&
          entry.recordKind === "character_guide",
      ),
    ).toBe(true);
    expect(
      notDeferred.every(
        ({ energyClassification, energyEvidence }) =>
          energyClassification === "not-energy-deferred" &&
          energyEvidence?.kind === "not-energy-deferred" &&
          !energyEvidence.energyRelatedWorkDeferred,
      ),
    ).toBe(true);
  });

  it("collapses 42 Keqing atomic claims onto 31 exact source-array occurrences", async () => {
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(await loadFixture()),
    );
    const equipmentEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "keqing-equipment-typed-predicate-ids",
    );
    const atomicClaimIds = equipmentEntries.flatMap(({ bindingEvidence }) =>
      bindingEvidence.kind === "keqing-equipment-typed-predicate-ids"
        ? bindingEvidence.atomicClaimIds
        : [],
    );

    expect(equipmentEntries).toHaveLength(31);
    expect(atomicClaimIds).toHaveLength(42);
    expect(new Set(atomicClaimIds).size).toBe(42);
    expect(
      equipmentEntries.every(
        (entry) =>
          entry.recordKind === "character_guide" &&
          entry.bindingClassification === "typed-bound" &&
          entry.energyClassification === "not-energy-deferred" &&
          entry.bindingEvidence.kind ===
            "keqing-equipment-typed-predicate-ids" &&
          entry.bindingEvidence.predicateIds.length ===
            entry.orderedConditions.length,
      ),
    ).toBe(true);

    const fiveStarGroup = equipmentEntries.find(
      ({ sourceRecordId, manualClaimPath }) =>
        sourceRecordId ===
          "keqing-lunar-charged-other-five-star-crit-options-luna-i" &&
        manualClaimPath ===
          "recommendation.weaponRecommendations[0].conditions",
    );
    expect(fiveStarGroup?.bindingEvidence).toMatchObject({
      kind: "keqing-equipment-typed-predicate-ids",
      predicateIds: ["roster-contains-keqing-and-declares-lunar-charged"],
    });
    if (
      fiveStarGroup?.bindingEvidence.kind !==
      "keqing-equipment-typed-predicate-ids"
    ) {
      throw new Error("Missing grouped Keqing five-star weapon evidence.");
    }
    expect(fiveStarGroup.bindingEvidence.atomicClaimIds).toHaveLength(5);
  });

  it("acknowledges VV only for the three exact published targets", async () => {
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(await loadFixture()),
    );
    const vvEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "keqing-role-exact-text-acknowledgement",
    );
    const acknowledgedCharacters = vvEntries
      .map(({ bindingEvidence }) =>
        bindingEvidence.kind === "keqing-role-exact-text-acknowledgement"
          ? bindingEvidence.characterId
          : "",
      )
      .sort();

    expect(acknowledgedCharacters).toEqual([
      "jean",
      "kaedehara_kazuha",
      "sucrose",
    ]);
    expect(acknowledgedCharacters).not.toContain("sayu");
    expect(acknowledgedCharacters).not.toContain("xianyun");
    expect(vvEntries.map(({ manualClaimPath }) => manualClaimPath).sort()).toEqual(
      [
        "members[0].conditions",
        "members[1].conditions",
        "members[2].conditions",
      ],
    );
    expect(
      vvEntries.every(
        (entry) =>
          entry.orderedConditions[0] === KEQING_ROLE_PAIR_VV_CONDITION &&
          entry.bindingClassification === "exact-text-acknowledged" &&
          entry.energyClassification === "energy-unclassified" &&
          entry.energyEvidence === null &&
          entry.bindingEvidence.kind ===
            "keqing-role-exact-text-acknowledgement" &&
          entry.subject === entry.bindingEvidence.characterId &&
          entry.bindingEvidence.acknowledgementCount === 1 &&
          entry.bindingEvidence.targetTeamIds.length === 1,
      ),
    ).toBe(true);
  });

  it("binds only the four authenticated Klee occurrences with occurrence-scoped non-ER evidence", async () => {
    const fixture = await loadFixture();
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(fixture),
    );
    const kleeEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "klee-source-local-typed-predicate-ast",
    );

    expect(kleeEntries).toHaveLength(4);
    expect(
      kleeEntries.map(({ manualClaimPath }) => manualClaimPath).sort(),
    ).toEqual([
      "recommendation.artifactRecommendations[2].conditions",
      "recommendation.mainStats.circlet[0].conditions",
      "recommendation.mainStats.goblet[0].conditions",
      "recommendation.mainStats.sands[0].conditions",
    ]);
    expect(
      kleeEntries.every(
        (entry) => {
          const selected =
            fixture.kleeSourceLocal.currentReport.selectedOccurrences.find(
              ({ occurrenceId }) => occurrenceId === entry.occurrenceId,
            );
          return (
            selected != null &&
            entry.subject === "klee" &&
            entry.bindingClassification === "typed-bound" &&
            entry.energyClassification === "not-energy-deferred" &&
            entry.bindingEvidence.kind ===
              "klee-source-local-typed-predicate-ast" &&
            entry.bindingEvidence.selectedOccurrenceId ===
              entry.occurrenceId &&
            entry.bindingEvidence.selectedOccurrenceSha256 ===
              sha256Text(stableJson(selected)) &&
            entry.bindingEvidence.predicateAstSha256 ===
              sha256Text(stableJson(entry.bindingEvidence.predicateAst)) &&
            entry.energyEvidence?.kind ===
              "klee-source-local-not-energy-deferred" &&
            entry.energyEvidence.selectedOccurrenceId === entry.occurrenceId &&
            entry.energyEvidence.selectedOccurrenceSha256 ===
              entry.bindingEvidence.selectedOccurrenceSha256 &&
            !entry.energyEvidence.energyRelatedWorkDeferred
          );
        },
      ),
    ).toBe(true);
  });

  it("fails closed on unauthenticated, stale, partial, duplicate, conflicting, or leaked evidence", async () => {
    const base = await loadFixture();

    const unauthenticated: BuildCurrentConditionBindingCatalogInput = {
      ...base,
      ittoAuthentication: {
        authenticated: false,
        reason: "serialized-report-mismatch",
        issues: [],
      },
    };
    expectFailure(unauthenticated, "authentication.itto-not-authenticated");

    const stale = structuredClone(base);
    const staleDurable = structuredClone(
      stale.keqingEquipment.durableReport,
    ) as KeqingLunarEquipmentEvidenceValidationReport;
    staleDurable.generatedFrom = [];
    stale.keqingEquipment.durableReport = staleDurable;
    expectFailure(stale, "authentication.keqing-equipment-stale");

    const partial = structuredClone(base);
    partial.keqingEquipment.currentReport.claims.pop();
    partial.keqingEquipment.durableReport = structuredClone(
      partial.keqingEquipment.currentReport,
    );
    expectFailure(partial, "keqing-equipment.partial-evidence");

    const duplicate = structuredClone(base);
    duplicate.keqingEquipment.currentReport.claims[
      duplicate.keqingEquipment.currentReport.claims.length - 1
    ] = structuredClone(duplicate.keqingEquipment.currentReport.claims[0]!);
    duplicate.keqingEquipment.durableReport = structuredClone(
      duplicate.keqingEquipment.currentReport,
    );
    expectFailure(duplicate, "keqing-equipment.duplicate-atomic-claim-id");

    const conflicting = structuredClone(base);
    const equalRefinementClaims =
      conflicting.keqingEquipment.currentReport.claims.filter(
        ({ sourceRecordId, sourceClaim }) =>
          sourceRecordId ===
            "keqing-lunar-charged-equal-refinement-four-star-ranking-luna-i" &&
          sourceClaim.kind === "weapon" &&
          sourceClaim.groupIndex === 0,
      );
    if (equalRefinementClaims.length !== 2) {
      throw new Error("Missing equal-refinement grouped evidence fixture.");
    }
    equalRefinementClaims[1]!.sourceConditions[0] =
      `${equalRefinementClaims[1]!.sourceConditions[0]} Drifted.`;
    conflicting.keqingEquipment.durableReport = structuredClone(
      conflicting.keqingEquipment.currentReport,
    );
    expectFailure(
      conflicting,
      "keqing-equipment.conflicting-condition-array-hash",
    );

    const leaked = structuredClone(base);
    const xilonenTarget = leaked.keqingRolePair.currentReport.rolePairSample.targets.find(
      ({ targetMemberCharacterIds }) =>
        targetMemberCharacterIds.includes("xilonen"),
    );
    const configuredXilonen =
      leaked.keqingRolePair.currentReport.configuredPublishedTargets.find(
        ({ memberCharacterIds }) => memberCharacterIds.includes("xilonen"),
      );
    const binding = xilonenTarget?.roleMemberBindings.find(
      ({ roleId }) => roleId === "resistance-shred",
    );
    if (!xilonenTarget || !configuredXilonen || !binding) {
      throw new Error("Missing Xilonen source-role fixture.");
    }
    binding.characterId = "sayu";
    binding.requiredConditions = [KEQING_ROLE_PAIR_VV_CONDITION];
    binding.acknowledgedConditions = [KEQING_ROLE_PAIR_VV_CONDITION];
    binding.conditionsMatch = true;
    configuredXilonen.acknowledgedConditionsByRoleRecordId[
      binding.roleRecordId
    ] = [KEQING_ROLE_PAIR_VV_CONDITION];
    leaked.keqingRolePair.durableReport = structuredClone(
      leaked.keqingRolePair.currentReport,
    );
    expectFailure(leaked, "keqing-role-pair.vv-acknowledgement-scope-drift");

    const staleKlee = structuredClone(base);
    const staleKleeDurable = structuredClone(
      staleKlee.kleeSourceLocal.durableReport,
    ) as KleeSourceLocalConditionSliceReport;
    staleKleeDurable.selectedOccurrences.pop();
    staleKlee.kleeSourceLocal.durableReport = staleKleeDurable;
    expectFailure(staleKlee, "authentication.klee-source-local-stale");

    const partialKlee = structuredClone(base);
    partialKlee.kleeSourceLocal.currentReport.selectedOccurrences.pop();
    partialKlee.kleeSourceLocal.durableReport = structuredClone(
      partialKlee.kleeSourceLocal.currentReport,
    );
    expectFailure(
      partialKlee,
      "klee-source-local.partial-or-capability-crossing-evidence",
    );

    const capabilityCrossingKlee = structuredClone(base);
    const nestedSlice = capabilityCrossingKlee.kleeSourceLocal.currentReport
      .sourceLocalSlice as { supportsGuideClaims: boolean } | null;
    if (!nestedSlice) throw new Error("Missing nested Klee slice fixture.");
    nestedSlice.supportsGuideClaims = true;
    capabilityCrossingKlee.kleeSourceLocal.durableReport = structuredClone(
      capabilityCrossingKlee.kleeSourceLocal.currentReport,
    );
    expectFailure(
      capabilityCrossingKlee,
      "klee-source-local.partial-or-capability-crossing-evidence",
    );
  });
});

async function loadFixture(): Promise<BuildCurrentConditionBindingCatalogInput> {
  const ittoReport = (await readJson(
    ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
  )) as SourceConditionedGuidePacketReport;
  const keqingEquipment = (await readJson(
    KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  )) as KeqingLunarEquipmentEvidenceValidationReport;
  const keqingRolePair = (await readJson(
    KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
  )) as KeqingSourceScopedRolePairSampleReport;
  const kleeSourceLocal = (await readJson(
    KLEE_SOURCE_LOCAL_CONDITION_SLICE_REPORT_PATH,
  )) as KleeSourceLocalConditionSliceReport;
  return {
    ittoAuthentication: {
      authenticated: true,
      canonicalReport: ittoReport,
    },
    keqingEquipment: {
      durableReport: structuredClone(keqingEquipment),
      currentReport: structuredClone(keqingEquipment),
    },
    keqingRolePair: {
      durableReport: structuredClone(keqingRolePair),
      currentReport: structuredClone(keqingRolePair),
    },
    kleeSourceLocal: {
      durableReport: structuredClone(kleeSourceLocal),
      currentReport: structuredClone(kleeSourceLocal),
    },
  };
}

function expectFailure(
  input: BuildCurrentConditionBindingCatalogInput,
  expectedCode: string,
): void {
  const report = buildCurrentConditionBindingCatalog(input);
  expect(report.comparisonStatus).toBe("not-comparable");
  expect(report.entries).toEqual([]);
  expect(report.issues.map(({ code }) => code)).toContain(expectedCode);
  expect(() => requireComparableCurrentConditionBindingCatalog(report)).toThrow(
    "Current condition-binding catalog is not comparable",
  );
}
