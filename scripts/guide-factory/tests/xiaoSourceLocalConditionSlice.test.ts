import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatXiaoSourceLocalConditionSliceSummary } from "../src/assemble-xiao-source-local-condition-slice";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import {
  authenticateXiaoSourceLocalConditionSliceReport,
  buildXiaoSourceLocalConditionSliceReport,
  requireComparableXiaoSourceLocalConditionSliceReport,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS,
  type BuildXiaoSourceLocalConditionSliceInput,
} from "../src/xiaoSourceLocalConditionSlice";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);
const SNAPSHOT_RELATIVE_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-xiao-manual.json";
const TEAM_ID =
  "kqm:team:xiao-xianyun-furina-faruzan-ffxx-version-5-5";
const MH_CONDITION_HASH =
  "9825717baca82084a938c6975a810db3faa0650a305175385529638e6652f71b";
const XIANYUN_CONDITION_HASH =
  "6783586e02e7954eb8073a1b0f12e79973d8e5a0dfad379fd03ddc0da4a79366";
const C6_CONDITION_HASH =
  "dbe5b5b7131413bd206a6443233c74ccad6ed4cb6f07bf5fbaeb93677dccc30a";

describe("Xiao source-local condition slice", () => {
  it("authenticates the exact 3+14+4 Xiao condition corpus", async () => {
    const input = await fixture();
    const report = buildXiaoSourceLocalConditionSliceReport(input);

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.semanticScopeAudit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
    });
    expect(report.rawInputBoundary).toEqual({
      status: "accepted",
      exactGeneratedFromPathSet: true,
      snapshotByteAndParsedObjectClosure: true,
    });
    expect(report.sourceBoundary).toMatchObject({
      status: "accepted",
      rawRecordCount: 7,
      totalConditionArrayCount: 21,
      nonemptyConditionArrayCount: 17,
      emptyConditionArrayCount: 4,
      selectedOccurrenceCount: 3,
      holdoutOccurrenceCount: 14,
      selectedAndHoldoutsCloseAllNonemptyXiaoConditions: true,
      emptyOccurrenceClosureExact: true,
      repositoryParity: "exact",
    });
    expect(report.summary).toEqual({
      totalConditionArrayCount: 21,
      nonemptyConditionArrayCount: 17,
      emptyConditionArrayCount: 4,
      selectedOccurrenceCount: 3,
      selectedUniqueConditionArrayCount: 3,
      holdoutOccurrenceCount: 14,
      sourceTeamCount: 1,
      sourceCellCount: 3,
      sourceMatchedCount: 2,
      sourceInapplicableCount: 0,
      sourceUnresolvedCount: 1,
      contextApplicableCount: 1,
      sourceAlreadyMatchedCount: 2,
      sourceDefinitelyInapplicableCount: 0,
      effectiveMatchedCount: 3,
      effectiveInapplicableCount: 0,
      effectiveUnresolvedCount: 0,
      selectedNotEnergyDeferredCount: 3,
      holdoutConsumedCount: 0,
      emptyConsumedCount: 0,
      candidateCount: 0,
      equipmentAssignmentCount: 0,
      optimizationCount: 0,
      assembledBuildCount: 0,
    });
    expect(() =>
      requireComparableXiaoSourceLocalConditionSliceReport(report, input),
    ).not.toThrow();
    expect(formatXiaoSourceLocalConditionSliceSummary(report)).toContain(
      "14 nonempty occurrences and 4 empty arrays remain unconsumed",
    );
  });

  it("pins two roster facts and one exact-team C6 request overlay without merging claims", async () => {
    const report = buildXiaoSourceLocalConditionSliceReport(await fixture());
    const slice = report.sourceLocalSlice;
    if (!slice?.requestContextReport) throw new Error("Missing Xiao context report.");

    expect(report.selectedOccurrences.map(({ conditionsSha256 }) => conditionsSha256)).toEqual([
      MH_CONDITION_HASH,
      XIANYUN_CONDITION_HASH,
      C6_CONDITION_HASH,
    ]);
    expect(report.selectedOccurrences.map(({ payloadSha256 }) => payloadSha256)).toEqual([
      "3f1da28d319a9d68334c22cf1f7998b682159989bf09753aed8935ce3db85fdb",
      "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
      "091c19dded0fd5a8cbf9ccb686bf826261cb7859276580f7f81c8ef26d709ef1",
    ]);
    expect(report.selectedOccurrences.map(({ predicate }) => predicate)).toEqual([
      { type: "exact-team-roster-includes", characterId: "xianyun" },
      { type: "exact-team-roster-includes", characterId: "xianyun" },
      expect.objectContaining({
        type: "unresolved-context",
        category: "investment-threshold",
      }),
    ]);
    const sourceCells = slice.sourceClaimCells[0]?.claimCells ?? [];
    expect(sourceCells.map(({ resolution }) => resolution)).toEqual([
      "matched",
      "matched",
      "unresolved-context",
    ]);
    const projections = slice.requestContextReport.teamProjections[0]?.claimProjections ?? [];
    expect(projections.map(({ contextApplicability }) => contextApplicability)).toEqual([
      "source-already-matched",
      "source-already-matched",
      "applicable-under-supplied-context",
    ]);
    expect(projections[0]?.requestContextBindings).toEqual([]);
    expect(projections[1]?.requestContextBindings).toEqual([]);
    expect(projections[2]?.requestContextBindings).toEqual([
      expect.objectContaining({
        sourcePredicatePath: "predicate",
        result: "true",
        requestPredicate: {
          type: "constellation-at-least",
          characterId: "xiao",
          threshold: 6,
        },
      }),
    ]);
    expect(projections[2]?.requestContextBindings[0]?.predicateRows[0]).toMatchObject({
      result: "true",
      factScope: {
        teamRecordId: TEAM_ID,
        characterId: "xiao",
        accountSnapshotId: null,
      },
    });
    expect(
      slice.requestContextReport.context.requestFactsByTeamRecordId?.[TEAM_ID]
        ?.characterFactsById,
    ).toEqual({ xiao: { constellation: 6 } });
  });

  it("closes every occurrence while leaving holdouts, empty arrays, rotations, and the fixture unconsumed", async () => {
    const report = buildXiaoSourceLocalConditionSliceReport(await fixture());
    const selectedIds = report.selectedOccurrences.map(({ occurrenceId }) =>
      occurrenceId,
    );
    const holdoutIds = report.holdoutOccurrences.map(({ occurrenceId }) =>
      occurrenceId,
    );
    const emptyIds = report.emptyOccurrences.map(({ occurrenceId }) =>
      occurrenceId,
    );
    expect(new Set([...selectedIds, ...holdoutIds]).size).toBe(17);
    expect(new Set(emptyIds).size).toBe(4);
    expect(
      report.holdoutOccurrences.every(
        ({ consumedBySlice, bindingAuthoredBySlice, energyClassificationAuthoredBySlice }) =>
          !consumedBySlice &&
          !bindingAuthoredBySlice &&
          !energyClassificationAuthoredBySlice,
      ),
    ).toBe(true);
    expect(
      report.emptyOccurrences.every(
        ({ conditions, consumedBySlice }) =>
          conditions.length === 0 && !consumedBySlice,
      ),
    ).toBe(true);

    const serialized = stableJson(report);
    expect(serialized).not.toContain("Faruzan Q > Furina EQ");
    expect(serialized).not.toContain("Faruzan EQ > Furina EQ");
    expect(serialized).not.toContain("EEQ12HP");
    expect(serialized).not.toContain("rotation-fixture");
    expect(report.evaluationBoundary).toEqual({
      exactTeamRecordId: TEAM_ID,
      sourceTeamInvestmentStatus: "unspecified",
      requestOverlayOwnsConstellationEvaluation: true,
      constellationDerivedTalentBehavior: false,
      sourceTeamRotationsEvaluated: false,
      sourceTeamRotationEntriesProjected: 0,
      separateRotationFixtureInScope: false,
    });
  });

  it("exposes no recommendation, composition, formula, damage, rotation, or ER capability", async () => {
    const report = buildXiaoSourceLocalConditionSliceReport(await fixture());
    expect(report).toMatchObject({
      arbitraryEnglishParsingAllowed: false,
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsEquipmentRecommendations: false,
      supportsStatRecommendations: false,
      supportsRankClaims: false,
      supportsDamageClaims: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      conditionTruthEstablishedFromRecommendationMetadata: false,
      recommendationCompositionExecuted: false,
      candidateGenerationExecuted: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      artifactAssignmentExecuted: false,
      equipmentAssignmentExecuted: false,
      teamCompositionExecuted: false,
      buildCompositionExecuted: false,
      damageComputationExecuted: false,
      rotationComputationExecuted: false,
      energyRecoveryComputationExecuted: false,
    });
    expect(report.sourceLocalSlice).toMatchObject({
      supportsGuideClaims: false,
      supportsTeamRecommendations: false,
      supportsBuildRecommendations: false,
      supportsRotationClaims: false,
      supportsEnergyRecoveryClaims: false,
      buildComposition: false,
      formulas: false,
      rotations: false,
      ER: false,
      assembledBuildCount: 0,
    });
  });

  it("stays stable under unrelated broad-carrier and fixture-only repository drift", async () => {
    const input = await fixture();
    const baseline = buildXiaoSourceLocalConditionSliceReport(input);
    const repository = structuredClone(
      input.repositoryInput as Record<string, unknown>,
    );
    repository.sourceRegistrySha256 = "f".repeat(64);
    const records = repository.records as Array<Record<string, unknown>>;
    const unrelated = records.find(
      ({ id }) => typeof id === "string" && !id.includes(":xiao-"),
    );
    if (!unrelated) throw new Error("Missing unrelated repository record.");
    const unknowns = unrelated.unknowns as string[];
    unknowns.push("unrelated carrier drift");
    const rotationFixture = records.find(
      ({ kind, id }) => kind === "rotation_fixture" && String(id).includes(":xiao-"),
    );
    if (!rotationFixture) throw new Error("Missing Xiao rotation fixture.");
    const formulaCounts = rotationFixture.formulaCounts as Array<
      Record<string, unknown>
    >;
    formulaCounts[1]!.count = 13;
    input.repositoryInput = repository;

    const manualIndex = structuredClone(
      input.manualIndexInput as Record<string, unknown>,
    );
    (manualIndex.snapshots as unknown[]).push({
      sourceId: "kqm",
      path: "scripts/guide-factory/data/source-snapshots/unrelated.json",
    });
    input.manualIndexInput = manualIndex;
    const sourceRegistry = structuredClone(
      input.sourceRegistryInput as Record<string, unknown>,
    );
    const sources = sourceRegistry.sources as Array<Record<string, unknown>>;
    const unrelatedSource = structuredClone(sources[0]!);
    unrelatedSource.id = "unrelated-source";
    sources.push(unrelatedSource);
    input.sourceRegistryInput = sourceRegistry;

    expect(buildXiaoSourceLocalConditionSliceReport(input)).toEqual(baseline);
    expect(XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/data/knowledge/repository.json",
    );
    expect(XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/data/source-snapshots/manual-index.json",
    );
    expect(XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/sources/registry.json",
    );
    expect(XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS).not.toContain(
      "scripts/guide-factory/data/source-snapshots/kqm-xiao-rotation-fixture-manual.json",
    );
  });

  it("fails closed on selected condition, exact roster, or KQM authority drift", async () => {
    const conditionInput = await fixture();
    const conditionSnapshot = structuredClone(
      conditionInput.manualSnapshotInput as Record<string, unknown>,
    );
    const conditionRepository = structuredClone(
      conditionInput.repositoryInput as Record<string, unknown>,
    );
    const rawGuide = (conditionSnapshot.records as Array<Record<string, unknown>>).find(
      ({ sourceRecordId }) =>
        sourceRecordId === "xiao-offensive-artifact-stats-version-5-5",
    );
    const consolidatedGuide = (
      conditionRepository.records as Array<Record<string, unknown>>
    ).find(
      ({ id }) =>
        id === "kqm:character-guide:xiao-offensive-artifact-stats-version-5-5",
    );
    if (!rawGuide || !consolidatedGuide) throw new Error("Missing Xiao guide.");
    const rawGoblets = (
      (rawGuide.recommendation as Record<string, unknown>).mainStats as Record<
        string,
        Array<Record<string, unknown>>
      >
    ).goblet!;
    const consolidatedGoblets = (
      ((consolidatedGuide.recommendations as Array<Record<string, unknown>>)[0]!
        .mainStats as Record<string, Array<Record<string, unknown>>>)
    ).goblet!;
    rawGoblets[3]!.conditions = ["Forged Xiao condition."];
    consolidatedGoblets[3]!.conditions = ["Forged Xiao condition."];
    conditionInput.repositoryInput = conditionRepository;
    replaceSnapshot(conditionInput, conditionSnapshot);
    expect(
      buildXiaoSourceLocalConditionSliceReport(conditionInput).comparisonStatus,
    ).toBe("not-comparable");

    const rosterInput = await fixture();
    const rosterSnapshot = structuredClone(
      rosterInput.manualSnapshotInput as Record<string, unknown>,
    );
    const rosterRepository = structuredClone(
      rosterInput.repositoryInput as Record<string, unknown>,
    );
    const rawTeam = (rosterSnapshot.records as Array<Record<string, unknown>>).find(
      ({ sourceRecordId }) =>
        sourceRecordId === "xiao-xianyun-furina-faruzan-ffxx-version-5-5",
    );
    const repositoryTeam = (
      rosterRepository.records as Array<Record<string, unknown>>
    ).find(({ id }) => id === TEAM_ID);
    if (!rawTeam || !repositoryTeam) throw new Error("Missing FFXX team.");
    (rawTeam.members as Array<Record<string, unknown>>)[3]!.characterId = "bennett";
    (repositoryTeam.members as Array<Record<string, unknown>>)[3]!.characterId =
      "bennett";
    rosterInput.repositoryInput = rosterRepository;
    replaceSnapshot(rosterInput, rosterSnapshot);
    expect(
      buildXiaoSourceLocalConditionSliceReport(rosterInput).comparisonStatus,
    ).toBe("not-comparable");

    const registryInput = await fixture();
    const registry = structuredClone(
      registryInput.sourceRegistryInput as Record<string, unknown>,
    );
    const kqm = (registry.sources as Array<Record<string, unknown>>).find(
      ({ id }) => id === "kqm",
    );
    if (!kqm) throw new Error("Missing KQM registry row.");
    kqm.permission = "permission-required";
    registryInput.sourceRegistryInput = registry;
    expect(
      buildXiaoSourceLocalConditionSliceReport(registryInput).comparisonStatus,
    ).toBe("not-comparable");
  });

  it("authenticates only an exact canonical rebuild", async () => {
    const input = await fixture();
    const canonical = buildXiaoSourceLocalConditionSliceReport(input);
    expect(
      authenticateXiaoSourceLocalConditionSliceReport(canonical, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(canonical);
    changed.summary.contextApplicableCount += 1;
    expect(
      authenticateXiaoSourceLocalConditionSliceReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
    expect(() =>
      requireComparableXiaoSourceLocalConditionSliceReport(changed, input),
    ).toThrow("serialized-report-mismatch");
  });
});

async function fixture(): Promise<BuildXiaoSourceLocalConditionSliceInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualSnapshotText,
    manualIndexInput,
    sourceRegistryInput,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(SNAPSHOT_PATH),
    readFile(SNAPSHOT_PATH, "utf8"),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    Promise.all(
      XIAO_SOURCE_LOCAL_CONDITION_SLICE_INPUT_PATHS.map(
        async (relativePath) => ({
          path: relativePath,
          sha256: await sha256File(path.join(REPOSITORY_ROOT, relativePath)),
        }),
      ),
    ),
  ]);
  return {
    repositoryInput,
    manualSnapshotInput,
    manualSnapshotText,
    manualIndexInput,
    sourceRegistryInput,
    generatedFrom,
  };
}

function replaceSnapshot(
  input: BuildXiaoSourceLocalConditionSliceInput,
  snapshot: Record<string, unknown>,
): void {
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;
  input.manualSnapshotInput = snapshot;
  input.manualSnapshotText = text;
  const revision = input.generatedFrom.find(
    ({ path: entryPath }) => entryPath === SNAPSHOT_RELATIVE_PATH,
  );
  if (!revision) throw new Error("Missing Xiao snapshot revision.");
  revision.sha256 = sha256Text(text);
}
