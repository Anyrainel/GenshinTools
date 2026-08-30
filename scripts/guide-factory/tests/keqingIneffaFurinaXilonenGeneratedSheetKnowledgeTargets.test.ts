import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import {
  buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets,
  computeKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsContentSha256,
  GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY,
  KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SEMANTIC_INPUT_PATHS,
  requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets,
  type BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
  type KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
  type KqmStatClaimKnowledgeTarget,
  type PresetBuildKnowledgeTarget,
} from "../src/keqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets";
import type { KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport } from "../src/keqingIneffaFurinaXilonenEquipmentCandidateLattice";
import type { KeqingLunarEquipmentEvidenceValidationReport } from "../src/keqingLunarEquipmentEvidenceValidation";
import { REPOSITORY_ROOT } from "../src/paths";
import type {
  GenshinToolsPresetSnapshot,
  KnowledgeRepository,
} from "../src/schemas";

describe("Keqing/Ineffa/Furina/Xilonen generated-sheet knowledge targets", () => {
  it("projects the exact five baseline builds and twelve authenticated KQM stat claims without comparison", async () => {
    const input = await fixture();
    const before = structuredClone(input);
    const report =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(input);
    const repeated =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(input);

    expect(input).toEqual(before);
    expect(report).toEqual(repeated);
    expect(report.validationStatus).toBe("authenticated-projection-only");
    expect(report.issues).toEqual([]);
    expect(report.targetProjectionExecuted).toBe(true);
    expect(report.summary).toEqual({
      targetCount: 17,
      presetBuildTargetCount: 5,
      kqmClaimTargetCount: 12,
      exactTeamResolvedTargetCount: 9,
      conditionWithheldTargetCount: 3,
      baselineContextUnknownTargetCount: 5,
      presetNonErSubstatBandCount: 9,
      omittedPresetEnergyEntryCount: 5,
      excludedFurinaPostErClaimCount: 2,
    });
    expect(report.generatedFrom).toEqual([]);
    expect(report.semanticScope).toMatchObject({
      authentication: "accepted",
      acceptedAudit: {
        dependencies: expect.any(Array),
        paritySummary: { parityCount: 26, exactParityCount: 26 },
      },
    });
    expect(report.sourceBoundary).toMatchObject({
      selectedRepositoryRecordCount: 7,
      selectedPresetGuideCount: 4,
      selectedPresetSnapshotEnvelopeCount: 1,
      selectedLiveBuildCount: 5,
      selectedLiveCharacterBuildArrayCount: 4,
      selectedEvidenceClaimCount: 12,
      selectedEvidenceSourceBoundaryRecordCount: 2,
      selectedEvidenceCapabilityCount: 1,
      selectedCp36ActiveArtifactCount: 5,
      exactParityCount: 26,
      exactPresetAssociationCount: 5,
      exactKqmClaimAssociationCount: 12,
      exactAuthorityAndAssociationClosure: true,
    });
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
        report,
      ),
    ).not.toThrow();
  });

  it("retains raw alternatives and non-ER source bands without creating weights or ranks", async () => {
    const report = await canonicalReport();
    const presetTargets = report.targets.filter(
      (target): target is PresetBuildKnowledgeTarget =>
        target.kind === "preset-build",
    );
    expect(
      presetTargets.map(
        ({ characterId, buildId, activeArtifactOccurrenceId }) => ({
          characterId,
          buildId,
          activeArtifactOccurrenceId,
        }),
      ),
    ).toEqual([
      {
        characterId: "keqing",
        buildId: "1WswsAu",
        activeArtifactOccurrenceId:
          "kqm:character-guide:keqing-lunar-charged-top-contributor-artifact-options-luna-i:artifact:0:0",
      },
      {
        characterId: "ineffa",
        buildId: "FeFiQU8",
        activeArtifactOccurrenceId:
          "genshintools-presets:character-guide:ineffa:build:FeFiQU8",
      },
      {
        characterId: "furina",
        buildId: "BQAI0BO",
        activeArtifactOccurrenceId:
          "genshintools-presets:character-guide:furina:build:BQAI0BO",
      },
      {
        characterId: "furina",
        buildId: "BQA4H1m",
        activeArtifactOccurrenceId:
          "genshintools-presets:character-guide:furina:build:BQA4H1m",
      },
      {
        characterId: "xilonen",
        buildId: "Dbt0Wkm",
        activeArtifactOccurrenceId:
          "genshintools-presets:character-guide:xilonen:build:Dbt0Wkm",
      },
    ]);

    const keqing = requiredPresetTarget(presetTargets, "1WswsAu");
    expect(keqing.mainStats.circlet).toEqual([
      { sourceEntryIndex: 0, statIds: ["cd"], rawSourceValue: 100 },
      { sourceEntryIndex: 1, statIds: ["cr"], rawSourceValue: 100 },
    ]);
    expect(keqing.substatBands).toEqual([
      {
        sourceBandIndex: 0,
        sourceEntryIndexes: [0, 1],
        statIds: ["cd", "cr"],
        rawSourceValue: 100,
      },
      {
        sourceBandIndex: 1,
        sourceEntryIndexes: [2, 3],
        statIds: ["atk%", "em"],
        rawSourceValue: 75,
      },
    ]);

    const furinaGolden = requiredPresetTarget(presetTargets, "BQAI0BO");
    expect(furinaGolden.mainStats.sands).toEqual([
      { sourceEntryIndex: 1, statIds: ["hp%"], rawSourceValue: 100 },
    ]);
    expect(furinaGolden.mainStats.goblet).toEqual([
      { sourceEntryIndex: 0, statIds: ["hp%"], rawSourceValue: 100 },
      { sourceEntryIndex: 1, statIds: ["hydro%"], rawSourceValue: 100 },
    ]);
    expect(furinaGolden.deferredEnergyEntries).toEqual([
      {
        field: "sands",
        sourceEntryIndex: 0,
        statId: "er",
        rawSourceValue: 100,
        omission: "energy-recovery-deferred",
      },
      {
        field: "substats",
        sourceEntryIndex: 3,
        statId: "er",
        rawSourceValue: 50,
        omission: "energy-recovery-deferred",
      },
    ]);
    const furinaTenacity = requiredPresetTarget(presetTargets, "BQA4H1m");
    expect(furinaTenacity.mainStats.sands).toEqual([]);
    expect(
      presetTargets.every(
        ({
          sourceAuthority,
          sourceNumericValuesInterpretedAsScalarWeights,
          sourceOrderInterpretedAsRank,
        }) =>
          sourceAuthority.kind === "internal-baseline-adapter" &&
          sourceAuthority.repositoryStatus === "baseline" &&
          sourceAuthority.adapterRecordFormat ===
            "genshintools-presets-v1" &&
          !sourceNumericValuesInterpretedAsScalarWeights &&
          !sourceOrderInterpretedAsRank,
      ),
    ).toBe(true);
    const serialized = JSON.stringify(presetTargets);
    expect(serialized).toContain('"rawSourceValue"');
    expect(serialized).not.toContain('"scalarWeight"');
    expect(serialized).not.toContain('"rank"');
  });

  it("keeps exact KQM condition resolution and source-authored priority groups distinct", async () => {
    const report = await canonicalReport();
    const kqmTargets = report.targets.filter(
      (target): target is KqmStatClaimKnowledgeTarget =>
        target.kind === "kqm-stat-claim",
    );
    const defaultCritBand = requiredKqmTarget(
      kqmTargets,
      "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i:substat:0",
    );
    expect(defaultCritBand).toMatchObject({
      applicability: "exact-team-resolved",
      claim: {
        kind: "substat",
        slot: null,
        sourceEntryIndex: 0,
        statIds: ["cr", "cd"],
        sourceAuthoredPriority: 1,
      },
      conditionResolution: {
        teamRecordId:
          "kqm:team:keqing-ineffa-furina-xilonen-lunar-charged-example",
        evidenceResolution: "matched-by-exact-team-facts",
        authority: "authenticated-wrapper-exact-team-facts-only",
      },
      sourceReviewState: {
        kind: "external-agent-assisted-unreviewed-extraction",
        extractionMethod: "agent-assisted",
        reviewStatus: "unreviewed",
        repositoryStatus: "candidate",
        promotionEligible: false,
      },
      sourcePriorityConvertedToScalarWeight: false,
      sourcePriorityConvertedToRank: false,
      gameplayApplicabilityClaimed: false,
    });

    const highBuffGoblet = requiredKqmTarget(
      kqmTargets,
      "kqm:character-guide:keqing-lunar-charged-high-buff-goblet-stats-luna-i:main-stat:goblet:0",
    );
    expect(highBuffGoblet).toMatchObject({
      applicability: "condition-withheld",
      claim: {
        kind: "main-stat",
        slot: "goblet",
        sourceEntryIndex: 0,
        statIds: ["electro%", "atk%"],
        sourceAuthoredPriority: null,
      },
      conditionResolution: {
        evidenceResolution: "withheld-unresolved-source-condition",
      },
    });
    expect(
      highBuffGoblet.conditionResolution.acknowledgements.map(
        ({ resolution }) => resolution,
      ),
    ).toEqual([
      "matched-by-exact-team-facts",
      "withheld-unresolved-source-condition",
    ]);
  });

  it("defines comparison vocabulary but executes no comparison or recommendation capability", async () => {
    const report = await canonicalReport();
    expect(report.comparisonBoundary).toEqual({
      vocabulary: [...GENERATED_SHEET_KNOWLEDGE_TARGET_COMPARISON_VOCABULARY],
      comparisonExecuted: false,
      comparisons: [],
    });
    expect(report).toMatchObject({
      guideProduced: false,
      recommendationProduced: false,
      rankProduced: false,
      damageComputationExecuted: false,
      gameplayEvaluationExecuted: false,
      optimalityClaimed: false,
      energyRecoveryInputsConsumedForDeferralProvenance: true,
      energyRecoveryCapability: false,
      supportsGuideClaims: false,
      supportsRecommendationClaims: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsGameplayClaims: false,
      supportsOptimalityClaims: false,
      supportsEnergyRecoveryClaims: false,
    });
    expect(report.projectionBoundary).toEqual({
      artifactRatingDbConsumed: false,
      presetBuildsLabelledBaselineTeamApplicabilityUnknown: true,
      kqmConditionsResolvedFromExactTeamFactsOnly: true,
      furinaPostErInterpretationExcluded: true,
      rawSourceValuesRetained: true,
      rawEnergyEntriesRetainedForProvenance: true,
      energyRecoveryValuesUsedForComparisonOrInterpretation: false,
      energyRecoveryRequirementComputed: false,
      sourceNumericValuesConvertedToScalarWeights: false,
      sourcePrioritiesOrBandsConvertedToRanks: false,
    });
  });

  it("omits every ER stat target and explicitly withholds the two Furina post-ER KQM rows", async () => {
    const report = await canonicalReport();
    const comparisonTargetStatIds = report.targets.flatMap((target) =>
      target.kind === "kqm-stat-claim"
        ? target.claim.statIds
        : [
            ...target.mainStats.sands.flatMap(({ statIds }) => statIds),
            ...target.mainStats.goblet.flatMap(({ statIds }) => statIds),
            ...target.mainStats.circlet.flatMap(({ statIds }) => statIds),
            ...target.substatBands.flatMap(({ statIds }) => statIds),
          ],
    );
    expect(comparisonTargetStatIds).not.toContain("er");
    expect(
      report.targets
        .filter(
          (target): target is PresetBuildKnowledgeTarget =>
            target.kind === "preset-build",
        )
        .flatMap(({ deferredEnergyEntries }) => deferredEnergyEntries)
        .every(
          ({ statId, rawSourceValue }) =>
            statId === "er" && Number.isFinite(rawSourceValue),
        ),
    ).toBe(true);
    expect(report.exclusions.furinaPostErSubstats).toEqual({
      repositoryRecordId:
        "kqm:character-guide:furina-post-er-substats-luna-ii",
      repositoryRecordSha256:
        "72a25c40890d8ef061f8f72ea9f290eca1fdcc2652b1f1451cfba1a227d41803",
      sourceRecordId: "furina-post-er-substats-luna-ii",
      recommendationId: "post-er-substat-priority",
      excludedSourceEntryIndexes: [0, 1],
      excludedConditionSha256:
        "e8a6a983626561caee737eb6a1a7959cebf3f1b7a06653f5e3ccc894fe40bda8",
      reason: "rotation-specific-energy-requirement-deferred",
    });
    expect(
      report.targets.some(({ source }) =>
        source.repositoryRecordId.includes("furina-post-er-substats"),
      ),
    ).toBe(false);
    expect(
      new Set(report.targets.map(({ source }) => source.sourceId)),
    ).toEqual(new Set(["genshintools-presets", "kqm"]));
  });

  it("is stable under unrelated carrier metadata, records, live weapons, and CP36 report drift", async () => {
    const canonicalInput = await fixture();
    const expected =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
        canonicalInput,
      );
    const input = structuredClone(canonicalInput);

    input.repository.schemaVersion = 2 as 1;
    const unrelatedRepositoryRecord = input.repository.records.find(
      ({ id }) =>
        id !== "genshintools-presets:character-guide:keqing" &&
        !id.includes("lunar-charged-default-artifact-stats") &&
        !id.includes("lunar-charged-high-buff-goblet-stats") &&
        !id.includes("furina-post-er-substats"),
    );
    unrelatedRepositoryRecord?.unknowns.push("unrelated CP39 carrier drift");
    (
      input.genshinToolsSnapshot as unknown as Record<string, unknown>
    ).unrelatedCarrierMetadata = "ignored";

    const live = input.liveBuildPreset as {
      builds: Record<string, unknown>;
      characterBuilds: Record<string, unknown>;
      characterWeapons?: Record<string, unknown>;
    };
    live.builds.__cp39_unselected = {
      id: "__cp39_unselected",
      composition: "intentionally-unprojectable-unrelated-record",
    };
    live.characterBuilds.__cp39_unselected = ["__cp39_unselected"];
    live.characterWeapons = { unrelated: ["not-selected"] };

    const unrelatedClaim = input.evidenceReport.claims.find(
      ({ sourceClaim }) =>
        sourceClaim.kind === "weapon" || sourceClaim.kind === "artifact",
    );
    unrelatedClaim?.sourceConditions.push("unrelated CP39 evidence claim drift");
    input.evidenceReport.generatedFrom.push({
      path: "unrelated-carrier",
      sha256: "f".repeat(64),
    });
    input.equipmentLatticeReport.summary.candidateNodeCount = 35;
    const unrelatedOccurrence =
      input.equipmentLatticeReport.inventoryBoundary.occurrences.find(
        ({ occurrenceId }) =>
          occurrenceId.endsWith(":artifact:0:1"),
      );
    if (unrelatedOccurrence) unrelatedOccurrence.equipmentId = "4pc:unselected";

    expect(
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(input),
    ).toEqual(expected);
  });

  it.each([
    [
      "repository duplicate",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        const record = input.repository.records.find(
          ({ id }) => id === "genshintools-presets:character-guide:keqing",
        );
        if (record) input.repository.records.push(structuredClone(record));
      },
      "semantic_scope.selection.required_key_duplicated",
    ],
    [
      "repository authority",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        const record = input.repository.records.find(
          ({ id }) =>
            id ===
            "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        );
        if (record) record.sourceRefs[0]!.sourceId = "genshintools-presets";
      },
      "semantic_scope.authentication.scope_projection_mismatch",
    ],
    [
      "preset guide duplicate",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        const guide = input.genshinToolsSnapshot.characterGuides.find(
          ({ characterId }) => characterId === "furina",
        );
        if (guide) {
          input.genshinToolsSnapshot.characterGuides.push(
            structuredClone(guide),
          );
        }
      },
      "semantic_scope.selection.required_key_duplicated",
    ],
    [
      "live build payload",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        const live = input.liveBuildPreset as {
          builds: Record<string, { sandsWeights: Array<{ stat: string }> }>;
        };
        live.builds.FeFiQU8!.sandsWeights[0]!.stat = "hp%";
      },
      "semantic_scope.parity.normalized_payload_mismatch",
    ],
    [
      "evidence claim duplicate",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        input.evidenceReport.claims.push(
          structuredClone(input.evidenceReport.claims[0]!),
        );
      },
      "semantic_scope.selection.required_key_duplicated",
    ],
    [
      "evidence source review state",
      (
        input: BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput,
      ) => {
        const boundary = input.evidenceReport.sourceBoundary.records.find(
          ({ repositoryRecordId }) =>
            repositoryRecordId ===
            "kqm:character-guide:keqing-lunar-charged-default-artifact-stats-luna-i",
        );
        if (boundary) boundary.reviewStatus = "reviewed";
      },
      "semantic_scope.authentication.scope_projection_mismatch",
    ],
  ])("fails closed on a %s mutation", async (_label, mutate, issueCode) => {
    const input = await fixture();
    mutate(input);
    const report =
      buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(input);
    expect(report.validationStatus).toBe("not-authenticated");
    expect(report.targetProjectionExecuted).toBe(false);
    expect(report.targets).toEqual([]);
    expect(report.summary.targetCount).toBe(0);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: issueCode }),
    );
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
        report,
      ),
    ).toThrow(/Refusing unauthenticated or mutated/);
  });

  it.each([
    [
      "source authority",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        report.targets[0]!.source.sourceId = "kqm";
      },
    ],
    [
      "build association",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        const target = report.targets[0] as PresetBuildKnowledgeTarget;
        target.activeArtifactOccurrenceId = "mutated";
      },
    ],
    [
      "ER capability",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        report.energyRecoveryCapability = true as false;
      },
    ],
    [
      "ER deferral provenance",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        report.energyRecoveryInputsConsumedForDeferralProvenance = false as true;
      },
    ],
    [
      "KQM source review state",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        const target = report.targets.find(
          (candidate): candidate is KqmStatClaimKnowledgeTarget =>
            candidate.kind === "kqm-stat-claim",
        );
        if (target) target.sourceReviewState.reviewStatus = "reviewed" as "unreviewed";
      },
    ],
    [
      "comparison result",
      (
        report: KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport,
      ) => {
        (report.comparisonBoundary.comparisons as unknown[]).push({
          status: "listed-condition-resolved",
        });
      },
    ],
  ])("the authenticated guard rejects a resealed %s mutation", async (_label, mutate) => {
    const report = structuredClone(await canonicalReport());
    mutate(report);
    report.contentSha256 =
      computeKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsContentSha256(
        report,
      );
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
        report,
      ),
    ).toThrow(/Refusing unauthenticated or mutated/);
  });

  it("the authenticated guard rejects an invalid content digest", async () => {
    const report = structuredClone(await canonicalReport());
    report.contentSha256 = "0".repeat(64);
    expect(() =>
      requireAuthenticatedKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
        report,
      ),
    ).toThrow(/Refusing unauthenticated or mutated/);
  });
});

async function canonicalReport(): Promise<KeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsReport> {
  return buildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargets(
    await fixture(),
  );
}

async function fixture(): Promise<BuildKeqingIneffaFurinaXilonenGeneratedSheetKnowledgeTargetsInput> {
  const values = await Promise.all(
    KEQING_INEFFA_FURINA_XILONEN_GENERATED_SHEET_KNOWLEDGE_TARGET_SEMANTIC_INPUT_PATHS.map(
      (relativePath) => readJson(path.join(REPOSITORY_ROOT, relativePath)),
    ),
  );
  return {
    equipmentLatticeReport:
      values[0] as KeqingIneffaFurinaXilonenEquipmentCandidateLatticeReport,
    repository: values[1] as KnowledgeRepository,
    genshinToolsSnapshot: values[2] as GenshinToolsPresetSnapshot,
    liveBuildPreset: values[3],
    evidenceReport:
      values[4] as KeqingLunarEquipmentEvidenceValidationReport,
  };
}

function requiredPresetTarget(
  targets: PresetBuildKnowledgeTarget[],
  buildId: string,
): PresetBuildKnowledgeTarget {
  const matches = targets.filter((target) => target.buildId === buildId);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

function requiredKqmTarget(
  targets: KqmStatClaimKnowledgeTarget[],
  claimId: string,
): KqmStatClaimKnowledgeTarget {
  const matches = targets.filter(({ source }) => source.claimId === claimId);
  expect(matches).toHaveLength(1);
  return matches[0]!;
}
