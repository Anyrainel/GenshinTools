import { describe, expect, it } from "vitest";
import {
  buildCurrentConditionArrayOccurrenceId,
  buildCurrentConditionArrayOccurrenceKey,
  buildCurrentConditionBindingCatalog,
  type BuildCurrentConditionBindingCatalogInput,
  requireComparableCurrentConditionBindingCatalog,
} from "../src/currentConditionBindingCatalog";
import {
  DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
  type DionaSourceLocalSupportSliceReport,
} from "../src/dionaSourceLocalSupportSlice";
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
  KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
  type KokomiSourceLocalArtifactSliceReport,
} from "../src/kokomiSourceLocalArtifactSlice";
import {
  KEQING_LUNAR_EQUIPMENT_EVIDENCE_VALIDATION_REPORT_PATH,
  KEQING_SOURCE_SCOPED_ROLE_PAIR_SAMPLE_REPORT_PATH,
} from "../src/paths";
import type { SourceConditionedGuidePacketReport } from "../src/sourceConditionedGuidePacket";

describe("authenticated current condition-binding catalog", () => {
  it("builds the deterministic 57-occurrence catalog with exact current coverage", async () => {
    const fixture = await loadFixture();
    const before = structuredClone(fixture);
    const report = buildCurrentConditionBindingCatalog(fixture);
    const repeated = buildCurrentConditionBindingCatalog(fixture);

    expect(repeated).toEqual(report);
    expect(fixture).toEqual(before);
    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.entries).toHaveLength(57);
    expect(report.entries.map(({ occurrenceKey }) => occurrenceKey)).toEqual(
      [...report.entries.map(({ occurrenceKey }) => occurrenceKey)].sort(),
    );
    expect(
      new Set(report.entries.map(({ occurrenceId }) => occurrenceId)).size,
    ).toBe(57);
    expect(
      new Set(report.entries.map(({ occurrenceKey }) => occurrenceKey)).size,
    ).toBe(57);
    expect(report.summary).toEqual({
      occurrenceCount: 57,
      bindingClassificationCounts: {
        "typed-bound": 54,
        "exact-text-acknowledged": 3,
        unbound: 0,
        invalid: 0,
      },
      energyClassificationCounts: {
        "energy-unclassified": 3,
        "not-energy-deferred": 51,
        "structural-er": 0,
        "deferred-energy-prerequisite": 3,
        "exact-authored-energy-related-deferral": 0,
      },
      typedBindingCount: 54,
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
      dionaSourceLocalOccurrenceCount: 3,
      dionaSourceLocalTypedBindingCount: 3,
      dionaSourceLocalNotEnergyDeferredCount: 3,
      kokomiSourceLocalOccurrenceCount: 1,
      kokomiSourceLocalTypedBindingCount: 1,
      kokomiSourceLocalNotEnergyDeferredCount: 1,
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
        dionaSourceLocalDurableMatchesCurrent: true,
        kokomiSourceLocalDurableMatchesCurrent: true,
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
        bindingEvidence.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-klee-source-local-condition-slice-luna-iv",
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
              "source-local-typed-predicate-ast" &&
            entry.bindingEvidence.selectedOccurrenceId ===
              entry.occurrenceId &&
            entry.bindingEvidence.selectedOccurrenceSha256 ===
              sha256Text(stableJson(selected)) &&
            entry.bindingEvidence.predicateAstSha256 ===
              sha256Text(stableJson(entry.bindingEvidence.predicateAst)) &&
            entry.energyEvidence?.kind ===
              "source-local-not-energy-deferred" &&
            entry.energyEvidence.selectedOccurrenceId === entry.occurrenceId &&
            entry.energyEvidence.selectedOccurrenceSha256 ===
              entry.bindingEvidence.selectedOccurrenceSha256 &&
            !entry.energyEvidence.energyRelatedWorkDeferred
          );
        },
      ),
    ).toBe(true);
  });

  it("binds only the three authenticated Diona team-member support occurrences", async () => {
    const fixture = await loadFixture();
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(fixture),
    );
    const dionaEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-diona-source-local-support-slice-luna-viii",
    );

    expect(dionaEntries).toHaveLength(3);
    expect(
      dionaEntries.map(({ occurrenceId, recordKind, subject }) => ({
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
      dionaEntries.every((entry) => {
        const selected =
          fixture.dionaSourceLocal.currentReport.selectedOccurrences.find(
            ({ occurrenceId }) => occurrenceId === entry.occurrenceId,
          );
        return (
          selected != null &&
          entry.bindingClassification === "typed-bound" &&
          entry.energyClassification === "not-energy-deferred" &&
          entry.bindingEvidence.kind ===
            "source-local-typed-predicate-ast" &&
          entry.bindingEvidence.selectedOccurrenceId === entry.occurrenceId &&
          entry.bindingEvidence.selectedOccurrenceSha256 ===
            sha256Text(stableJson(selected)) &&
          entry.bindingEvidence.predicateAstSha256 ===
            sha256Text(stableJson(entry.bindingEvidence.predicateAst)) &&
          entry.energyEvidence?.kind ===
            "source-local-not-energy-deferred" &&
          entry.energyEvidence.sliceId === entry.bindingEvidence.sliceId &&
          entry.energyEvidence.selectedOccurrenceId === entry.occurrenceId &&
          entry.energyEvidence.selectedOccurrenceSha256 ===
            entry.bindingEvidence.selectedOccurrenceSha256 &&
          !entry.energyEvidence.energyRelatedWorkDeferred
        );
      }),
    ).toBe(true);
  });

  it("binds only the exact Kokomi team artifact condition without assigning equipment", async () => {
    const fixture = await loadFixture();
    const report = requireComparableCurrentConditionBindingCatalog(
      buildCurrentConditionBindingCatalog(fixture),
    );
    const kokomiEntries = report.entries.filter(
      ({ bindingEvidence }) =>
        bindingEvidence.kind === "source-local-typed-predicate-ast" &&
        bindingEvidence.sliceId ===
          "kqm-kokomi-source-local-artifact-slice-luna-v",
    );

    expect(kokomiEntries).toHaveLength(1);
    const entry = kokomiEntries[0]!;
    const selected =
      fixture.kokomiSourceLocal.currentReport.selectedOccurrences[0]!;
    expect(entry).toMatchObject({
      occurrenceId:
        "kqm:team:kokomi-ineffa-columbina-sucrose-lunar-charged-example:members[0].artifactRecommendations[0].conditions",
      recordKind: "team",
      sourceRecordId:
        "kokomi-ineffa-columbina-sucrose-lunar-charged-example",
      manualClaimPath:
        "members[0].artifactRecommendations[0].conditions",
      subject: "sangonomiya_kokomi",
      orderedConditions: [
        "For Kokomi in this exact Lunar-Charged example team.",
      ],
      bindingClassification: "typed-bound",
      energyClassification: "not-energy-deferred",
      bindingEvidence: {
        kind: "source-local-typed-predicate-ast",
        sliceId: "kqm-kokomi-source-local-artifact-slice-luna-v",
        selectedOccurrenceId: selected.occurrenceId,
        selectedOccurrenceSha256: sha256Text(stableJson(selected)),
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
        selectedOccurrenceId: selected.occurrenceId,
        selectedOccurrenceSha256: sha256Text(stableJson(selected)),
      },
    });
    expect(
      entry.bindingEvidence.kind === "source-local-typed-predicate-ast" &&
        entry.bindingEvidence.predicateAst,
    ).toEqual({
      type: "all",
      predicates: [
        {
          type: "exact-team-roster-includes",
          characterId: "sangonomiya_kokomi",
        },
        { type: "exact-team-roster-includes", characterId: "ineffa" },
        { type: "exact-team-roster-includes", characterId: "columbina" },
        { type: "exact-team-roster-includes", characterId: "sucrose" },
      ],
    });
    expect(entry.bindingEvidence).not.toHaveProperty("payload");
    expect(report.supportsEquipmentRecommendations).toBe(false);
    expect(report.supportsTeamRecommendations).toBe(false);
    expect(report.supportsEnergyRecoveryClaims).toBe(false);
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

    const collidingKleeSlice = structuredClone(base);
    const nestedCollidingKlee = collidingKleeSlice.kleeSourceLocal.currentReport
      .sourceLocalSlice;
    if (!nestedCollidingKlee) {
      throw new Error("Missing nested Klee slice collision fixture.");
    }
    nestedCollidingKlee.sliceId =
      "kqm-diona-source-local-support-slice-luna-viii";
    collidingKleeSlice.kleeSourceLocal.durableReport = structuredClone(
      collidingKleeSlice.kleeSourceLocal.currentReport,
    );
    expectFailure(
      collidingKleeSlice,
      "klee-source-local.partial-or-capability-crossing-evidence",
    );

    const staleDiona = structuredClone(base);
    const staleDionaDurable = structuredClone(
      staleDiona.dionaSourceLocal.durableReport,
    ) as DionaSourceLocalSupportSliceReport;
    staleDionaDurable.selectedOccurrences.pop();
    staleDiona.dionaSourceLocal.durableReport = staleDionaDurable;
    expectFailure(staleDiona, "authentication.diona-source-local-stale");

    const partialDiona = structuredClone(base);
    partialDiona.dionaSourceLocal.currentReport.selectedOccurrences.pop();
    partialDiona.dionaSourceLocal.durableReport = structuredClone(
      partialDiona.dionaSourceLocal.currentReport,
    );
    expectFailure(
      partialDiona,
      "diona-source-local.partial-or-capability-crossing-evidence",
    );

    const capabilityCrossingDiona = structuredClone(base);
    capabilityCrossingDiona.dionaSourceLocal.currentReport.teamCompositionExecuted =
      true as false;
    capabilityCrossingDiona.dionaSourceLocal.durableReport = structuredClone(
      capabilityCrossingDiona.dionaSourceLocal.currentReport,
    );
    expectFailure(
      capabilityCrossingDiona,
      "diona-source-local.partial-or-capability-crossing-evidence",
    );

    const collidingDionaSlice = structuredClone(base);
    const nestedCollidingDiona = collidingDionaSlice.dionaSourceLocal
      .currentReport.sourceLocalSlice;
    if (!nestedCollidingDiona) {
      throw new Error("Missing nested Diona slice collision fixture.");
    }
    nestedCollidingDiona.sliceId =
      "kqm-klee-source-local-condition-slice-luna-iv";
    collidingDionaSlice.dionaSourceLocal.durableReport = structuredClone(
      collidingDionaSlice.dionaSourceLocal.currentReport,
    );
    expectFailure(
      collidingDionaSlice,
      "diona-source-local.partial-or-capability-crossing-evidence",
    );

    const leakedDionaHoldout = structuredClone(base);
    const dionaHoldout =
      leakedDionaHoldout.dionaSourceLocal.currentReport.holdoutOccurrences[0];
    if (!dionaHoldout) throw new Error("Missing Diona holdout fixture.");
    dionaHoldout.consumedBySlice = true as false;
    leakedDionaHoldout.dionaSourceLocal.durableReport = structuredClone(
      leakedDionaHoldout.dionaSourceLocal.currentReport,
    );
    expectFailure(
      leakedDionaHoldout,
      "diona-source-local.selected-holdout-partition-drift",
    );

    const memberDrift = structuredClone(base);
    const selectedDiona =
      memberDrift.dionaSourceLocal.currentReport.selectedOccurrences[0];
    if (!selectedDiona) throw new Error("Missing selected Diona fixture.");
    selectedDiona.memberIndex = 2;
    memberDrift.dionaSourceLocal.durableReport = structuredClone(
      memberDrift.dionaSourceLocal.currentReport,
    );
    expectFailure(
      memberDrift,
      "diona-source-local.conflicting-occurrence-evidence",
    );

    const duplicateDionaControl = structuredClone(base);
    const dionaSlice = duplicateDionaControl.dionaSourceLocal.currentReport
      .sourceLocalSlice;
    if (!dionaSlice) throw new Error("Missing nested Diona slice fixture.");
    dionaSlice.conditionControls[2] = structuredClone(
      dionaSlice.conditionControls[0]!,
    );
    duplicateDionaControl.dionaSourceLocal.durableReport = structuredClone(
      duplicateDionaControl.dionaSourceLocal.currentReport,
    );
    expectFailure(
      duplicateDionaControl,
      "diona-source-local.duplicate-condition-control",
    );

    const conflictingDionaClaim = structuredClone(base);
    const conflictingDionaSlice = conflictingDionaClaim.dionaSourceLocal
      .currentReport.sourceLocalSlice;
    if (!conflictingDionaSlice) {
      throw new Error("Missing nested Diona claim fixture.");
    }
    conflictingDionaSlice.sourceClaimCatalog[0]!.characterId = "bennett";
    conflictingDionaClaim.dionaSourceLocal.durableReport = structuredClone(
      conflictingDionaClaim.dionaSourceLocal.currentReport,
    );
    expectFailure(
      conflictingDionaClaim,
      "diona-source-local.conflicting-occurrence-evidence",
    );

    const staleKokomi = structuredClone(base);
    const staleKokomiDurable = structuredClone(
      staleKokomi.kokomiSourceLocal.durableReport,
    ) as KokomiSourceLocalArtifactSliceReport;
    staleKokomiDurable.selectedOccurrences.pop();
    staleKokomi.kokomiSourceLocal.durableReport = staleKokomiDurable;
    expectFailure(staleKokomi, "authentication.kokomi-source-local-stale");

    const partialKokomi = structuredClone(base);
    partialKokomi.kokomiSourceLocal.currentReport.selectedOccurrences.pop();
    partialKokomi.kokomiSourceLocal.durableReport = structuredClone(
      partialKokomi.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      partialKokomi,
      "kokomi-source-local.partial-or-capability-crossing-evidence",
    );

    const capabilityCrossingKokomi = structuredClone(base);
    capabilityCrossingKokomi.kokomiSourceLocal.currentReport.artifactAssignmentExecuted =
      true as false;
    capabilityCrossingKokomi.kokomiSourceLocal.durableReport = structuredClone(
      capabilityCrossingKokomi.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      capabilityCrossingKokomi,
      "kokomi-source-local.partial-or-capability-crossing-evidence",
    );

    const collidingKokomiSlice = structuredClone(base);
    const nestedCollidingKokomi = collidingKokomiSlice.kokomiSourceLocal
      .currentReport.sourceLocalSlice;
    if (!nestedCollidingKokomi) {
      throw new Error("Missing nested Kokomi slice collision fixture.");
    }
    nestedCollidingKokomi.sliceId =
      "kqm-diona-source-local-support-slice-luna-viii";
    collidingKokomiSlice.kokomiSourceLocal.durableReport = structuredClone(
      collidingKokomiSlice.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      collidingKokomiSlice,
      "kokomi-source-local.partial-or-capability-crossing-evidence",
    );

    const leakedKokomiHoldout = structuredClone(base);
    const kokomiHoldout =
      leakedKokomiHoldout.kokomiSourceLocal.currentReport.holdoutOccurrences[0];
    if (!kokomiHoldout) throw new Error("Missing Kokomi holdout fixture.");
    kokomiHoldout.consumedBySlice = true as false;
    leakedKokomiHoldout.kokomiSourceLocal.durableReport = structuredClone(
      leakedKokomiHoldout.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      leakedKokomiHoldout,
      "kokomi-source-local.selected-holdout-partition-drift",
    );

    const authoredKokomiHoldout = structuredClone(base);
    authoredKokomiHoldout.kokomiSourceLocal.currentReport.holdoutOccurrences[0]!.energyClassificationAuthoredBySlice =
      true as false;
    authoredKokomiHoldout.kokomiSourceLocal.durableReport = structuredClone(
      authoredKokomiHoldout.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      authoredKokomiHoldout,
      "kokomi-source-local.selected-holdout-partition-drift",
    );

    const overlappingKokomiHoldout = structuredClone(base);
    overlappingKokomiHoldout.kokomiSourceLocal.currentReport.holdoutOccurrences[1]!.occurrenceId =
      overlappingKokomiHoldout.kokomiSourceLocal.currentReport
        .holdoutOccurrences[0]!.occurrenceId;
    overlappingKokomiHoldout.kokomiSourceLocal.durableReport = structuredClone(
      overlappingKokomiHoldout.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      overlappingKokomiHoldout,
      "kokomi-source-local.selected-holdout-partition-drift",
    );

    const kokomiMemberDrift = structuredClone(base);
    kokomiMemberDrift.kokomiSourceLocal.currentReport.selectedOccurrences[0]!.memberIndex =
      2 as 0;
    kokomiMemberDrift.kokomiSourceLocal.durableReport = structuredClone(
      kokomiMemberDrift.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      kokomiMemberDrift,
      "kokomi-source-local.conflicting-occurrence-evidence",
    );

    const duplicateKokomiClaim = structuredClone(base);
    const duplicateClaimSlice = duplicateKokomiClaim.kokomiSourceLocal
      .currentReport.sourceLocalSlice;
    if (!duplicateClaimSlice) {
      throw new Error("Missing nested Kokomi source-claim fixture.");
    }
    duplicateClaimSlice.sourceClaimCatalog.push(
      structuredClone(duplicateClaimSlice.sourceClaimCatalog[0]!),
    );
    duplicateKokomiClaim.kokomiSourceLocal.durableReport = structuredClone(
      duplicateKokomiClaim.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      duplicateKokomiClaim,
      "kokomi-source-local.duplicate-source-claim",
    );

    const duplicateKokomiControl = structuredClone(base);
    const duplicateControlSlice = duplicateKokomiControl.kokomiSourceLocal
      .currentReport.sourceLocalSlice;
    if (!duplicateControlSlice) {
      throw new Error("Missing nested Kokomi condition-control fixture.");
    }
    duplicateControlSlice.conditionControls.push(
      structuredClone(duplicateControlSlice.conditionControls[0]!),
    );
    duplicateKokomiControl.kokomiSourceLocal.durableReport = structuredClone(
      duplicateKokomiControl.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      duplicateKokomiControl,
      "kokomi-source-local.duplicate-condition-control",
    );

    const boundKokomiRequest = structuredClone(base);
    const kokomiControl = boundKokomiRequest.kokomiSourceLocal.currentReport
      .sourceLocalSlice?.conditionControls[0];
    const dionaRequestBinding = boundKokomiRequest.dionaSourceLocal.currentReport
      .sourceLocalSlice?.conditionControls[0]?.requestBindings[0];
    if (!kokomiControl || !dionaRequestBinding) {
      throw new Error("Missing request-binding fixtures.");
    }
    kokomiControl.requestBindings.push(structuredClone(dionaRequestBinding));
    boundKokomiRequest.kokomiSourceLocal.durableReport = structuredClone(
      boundKokomiRequest.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      boundKokomiRequest,
      "kokomi-source-local.conflicting-occurrence-evidence",
    );

    const conflictingKokomiClaim = structuredClone(base);
    const conflictingClaim = conflictingKokomiClaim.kokomiSourceLocal
      .currentReport.sourceLocalSlice?.sourceClaimCatalog[0];
    if (!conflictingClaim) {
      throw new Error("Missing conflicting Kokomi claim fixture.");
    }
    conflictingClaim.characterId = "sucrose";
    conflictingKokomiClaim.kokomiSourceLocal.durableReport = structuredClone(
      conflictingKokomiClaim.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      conflictingKokomiClaim,
      "kokomi-source-local.conflicting-occurrence-evidence",
    );

    const forgedKokomiPredicate = structuredClone(base);
    const forgedSelected =
      forgedKokomiPredicate.kokomiSourceLocal.currentReport
        .selectedOccurrences[0]!;
    const forgedSlice = forgedKokomiPredicate.kokomiSourceLocal.currentReport
      .sourceLocalSlice;
    if (!forgedSlice) throw new Error("Missing forged Kokomi slice fixture.");
    const forgedPredicate = {
      type: "exact-team-roster-includes" as const,
      characterId: "sangonomiya_kokomi",
    };
    const forgedPredicateSha256 = sha256Text(stableJson(forgedPredicate));
    forgedSelected.predicate = structuredClone(forgedPredicate);
    forgedSelected.predicateSha256 = forgedPredicateSha256;
    forgedSlice.sourceClaimCatalog[0]!.predicate =
      structuredClone(forgedPredicate);
    forgedSlice.conditionControls[0]!.occurrenceControl.sourcePredicateSha256 =
      forgedPredicateSha256;
    forgedKokomiPredicate.kokomiSourceLocal.durableReport = structuredClone(
      forgedKokomiPredicate.kokomiSourceLocal.currentReport,
    );
    expectFailure(
      forgedKokomiPredicate,
      "kokomi-source-local.conflicting-occurrence-evidence",
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
  const dionaSourceLocal = (await readJson(
    DIONA_SOURCE_LOCAL_SUPPORT_SLICE_REPORT_PATH,
  )) as DionaSourceLocalSupportSliceReport;
  const kokomiSourceLocal = (await readJson(
    KOKOMI_SOURCE_LOCAL_ARTIFACT_SLICE_REPORT_PATH,
  )) as KokomiSourceLocalArtifactSliceReport;
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
    dionaSourceLocal: {
      durableReport: structuredClone(dionaSourceLocal),
      currentReport: structuredClone(dionaSourceLocal),
    },
    kokomiSourceLocal: {
      durableReport: structuredClone(kokomiSourceLocal),
      currentReport: structuredClone(kokomiSourceLocal),
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
