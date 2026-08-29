import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { requireComparableIttoRequestContextApplicabilityReport } from "../src/assemble-itto-request-context-applicability";
import {
  authenticateIttoRequestContextApplicabilityReport,
  buildIttoRequestContextApplicabilityReport,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS,
  ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH,
  ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
  ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
  readHashedJsonSnapshot,
  type BuildIttoRequestContextApplicabilityInput,
  type IttoRequestContextApplicabilityReport,
} from "../src/ittoRequestContextApplicability";
import {
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
} from "../src/ittoSourceConditionedGuidePacket";
import { readJson, sha256File, sha256Text, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";

const SANDS_CLAIM =
  "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:sands:0";
const DEF_GOBLET_CLAIM =
  "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:goblet:1";
const OFFENSIVE_TAIL_CLAIM =
  "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:substat:0";
const BOLIDE_CLAIM =
  "kqm:character-guide:itto-contextual-artifact-sets-version-5-6:artifact-group:2";
const LONG_NIGHT_CLAIM =
  "kqm:character-guide:itto-contextual-artifact-sets-version-5-6:artifact-group:3";
const REDHORN_CLAIM =
  "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:0";
const SERPENT_CLAIM =
  "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:1";
const WHITEBLIND_CLAIM =
  "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:2";

describe("Itto request/account context applicability", () => {
  it("projects three independent contexts over the authenticated 45-cell source control", async () => {
    const report = await buildIttoRequestContextApplicabilityReport(
      await fixture(),
    );

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.issues).toEqual([]);
    expect(report.sourceControlBoundary).toMatchObject({
      status: "authenticated-canonical-control",
      snapshotClosure: "accepted",
      semanticContract: "accepted",
      sourceCellsUsedAsImmutableControl: true,
    });
    expect(report.contextFixtureBoundary).toMatchObject({
      status: "validated",
      snapshotClosure: "accepted",
      fixtureId: "itto-diagnostic-request-contexts-v1",
      containsClaimBindings: false,
      containsRequestedResolutions: false,
      strictSchema: true,
    });
    expect(report.summary).toEqual({
      contextCount: 3,
      projectedTeamPacketCount: 9,
      sourceClaimCount: 15,
      claimCellCount: 135,
      matchedCellCount: 30,
      inapplicableCellCount: 18,
      withheldCellCount: 87,
      unresolvedCellCount: 60,
      deferredEnergyCellCount: 27,
      sourceAlreadyMatchedCellCount: 9,
      sourceDefinitelyInapplicableCellCount: 18,
      applicableUnderSuppliedContextCellCount: 21,
      notApplicableUnderSuppliedContextCellCount: 0,
      stillUnresolvedCellCount: 60,
      deferredEnergyUnchangedCellCount: 27,
      uniqueSourceUnresolvedCellCount: 27,
      contextAddressableSourceUnresolvedCellCount: 21,
      unaddressedSourceUnresolvedCellCount: 6,
      assembledBuildCount: 0,
    });
    expect(
      Object.fromEntries(
        report.projections.map(({ projectionId, summary }) => [
          projectionId,
          {
            matched: summary.matchedCellCount,
            inapplicable: summary.inapplicableCellCount,
            unresolved: summary.unresolvedCellCount,
            deferred: summary.deferredEnergyCellCount,
          },
        ]),
      ),
    ).toEqual({
      "on-field-personal-damage": {
        matched: 18,
        inapplicable: 6,
        unresolved: 12,
        deferred: 9,
      },
      "owned-serpent-passive-supported": {
        matched: 6,
        inapplicable: 6,
        unresolved: 24,
        deferred: 9,
      },
      "free-craftable-preferred": {
        matched: 6,
        inapplicable: 6,
        unresolved: 24,
        deferred: 9,
      },
    });
  });

  it("changes only mapped context applicability and preserves source-owned cells", async () => {
    const report = await buildIttoRequestContextApplicabilityReport(
      await fixture(),
    );
    const onField = projection(report, "on-field-personal-damage");
    const serpent = projection(report, "owned-serpent-passive-supported");
    const craftable = projection(report, "free-craftable-preferred");
    const onFieldTeam = onField.teamProjections[0];
    const serpentTeam = serpent.teamProjections[0];
    const craftableTeam = craftable.teamProjections[0];
    if (!onFieldTeam || !serpentTeam || !craftableTeam) {
      throw new Error("Expected all three source teams in every projection.");
    }

    expect(cell(onFieldTeam, SANDS_CLAIM)).toMatchObject({
      sourceControl: {
        resolution: "unresolved-context",
        sourceConditionsSha256:
          "423c45da9436f71273f4502eae3481c3e7cc4909c500d00a3728f0ac4a99eab7",
      },
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
      requestContextBindings: [
        {
          result: "true",
          predicateRows: [
            expect.objectContaining({
              factProvenance: "request",
              factScope: expect.objectContaining({
                teamRecordId: onFieldTeam.teamRecordId,
                characterId: "arataki_itto",
              }),
            }),
          ],
        },
      ],
    });
    expect(cell(onFieldTeam, DEF_GOBLET_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "unresolved-context",
      contextApplicability: "still-unresolved",
      requestContextBindings: [{ result: "true" }],
    });
    expect(cell(onFieldTeam, BOLIDE_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      requestContextBindings: [],
      resolution: "unresolved-context",
      contextApplicability: "still-unresolved",
    });
    expect(cell(onFieldTeam, LONG_NIGHT_CLAIM)).toMatchObject({
      sourceControl: { resolution: "inapplicable" },
      resolution: "inapplicable",
      contextApplicability: "source-definitely-inapplicable",
    });
    expect(cell(onFieldTeam, OFFENSIVE_TAIL_CLAIM)).toMatchObject({
      sourceControl: {
        resolution: "deferred-omitted-energy-prerequisite",
      },
      resolution: "deferred-omitted-energy-prerequisite",
      contextApplicability: "deferred-energy-unchanged",
    });
    expect(cell(onFieldTeam, REDHORN_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
    });
    expect(cell(serpentTeam, SERPENT_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
      requestContextBindings: [
        expect.objectContaining({
          predicateRows: [
            expect.objectContaining({
              factProvenance: "account",
              factScope: expect.objectContaining({
                accountSnapshotId: "synthetic-account-inventory-v1",
              }),
              result: "true",
            }),
          ],
        }),
        expect.objectContaining({
          predicateRows: [
            expect.objectContaining({
              factProvenance: "request-assumption",
              result: "true",
            }),
          ],
        }),
      ],
    });
    expect(cell(craftableTeam, WHITEBLIND_CLAIM)).toMatchObject({
      sourceControl: { resolution: "unresolved-context" },
      resolution: "matched",
      contextApplicability: "applicable-under-supplied-context",
    });
    expect(report).toMatchObject({
      supportsSourceAuthorization: false,
      supportsGuideClaims: false,
      supportsAccountAdvice: false,
      playerFacingRecommendations: false,
      ranking: false,
      buildComposition: false,
      damage: false,
      optimality: false,
      formulas: false,
      rotations: false,
      ER: false,
      generatorExecuted: false,
      optimizerExecuted: false,
      damageComputationExecuted: false,
      energyRecoveryInputsUsed: false,
      baselineEquipmentUsed: false,
      axesMultipliedIntoBuilds: false,
      contextProjectionExecuted: true,
      sourceCellsMutated: false,
    });
  });

  it("authenticates the durable output and rejects tampered output", async () => {
    const input = await fixture();
    const durable = (await readJson(
      ITTO_REQUEST_CONTEXT_APPLICABILITY_REPORT_PATH,
    )) as IttoRequestContextApplicabilityReport;
    expect(
      await authenticateIttoRequestContextApplicabilityReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.matchedCellCount += 1;
    expect(
      await authenticateIttoRequestContextApplicabilityReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });

  it("fails closed when the serialized source control, context fixture, or hash boundary is altered", async () => {
    const input = await fixture();
    const forgedSource = structuredClone(
      input.sourceReportSnapshot.input as Record<string, unknown>,
    );
    const sourceSummary = forgedSource.summary as Record<string, number>;
    sourceSummary.matchedCellCount += 1;
    const sourceReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      sourceReportSnapshot: {
        ...input.sourceReportSnapshot,
        input: forgedSource,
        canonicalObjectSha256: hashValue(forgedSource),
      },
    });
    expect(sourceReport.comparisonStatus).toBe("not-comparable");
    expect(sourceReport.sourceControlBoundary.status).toBe("unauthenticated");
    expect(sourceReport.sourceControlBoundary.snapshotClosure).toBe("rejected");
    expect(sourceReport.sourceControlBoundary.semanticContract).toBe("rejected");
    expect(sourceReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.snapshot-parsed-input-mismatch",
        }),
        expect.objectContaining({
          code: "request-context.upstream-control-authentication-failed",
        }),
      ]),
    );

    const forgedFixture = structuredClone(
      input.contextFixtureSnapshot.input as Record<string, unknown>,
    );
    const contexts = forgedFixture.contexts as Array<Record<string, unknown>>;
    contexts[0] = { ...contexts[0], requestedResolution: "matched" };
    const contextReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      contextFixtureSnapshot: {
        ...input.contextFixtureSnapshot,
        input: forgedFixture,
        canonicalObjectSha256: hashValue(forgedFixture),
      },
    });
    expect(contextReport.comparisonStatus).toBe("not-comparable");
    expect(contextReport.contextFixtureBoundary.status).toBe("invalid");
    expect(contextReport.contextFixtureBoundary.snapshotClosure).toBe("rejected");
    expect(contextReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.invalid-context-fixture",
        }),
      ]),
    );
    expect(() =>
      requireComparableIttoRequestContextApplicabilityReport(contextReport),
    ).toThrow("Refusing to write an unsafe or non-comparable");

    const missingHash = await buildIttoRequestContextApplicabilityReport({
      ...input,
      generatedFrom: input.generatedFrom.slice(1),
    });
    expect(missingHash.comparisonStatus).toBe("not-comparable");
    expect(missingHash.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.missing-or-duplicate-generated-from-path",
        }),
      ]),
    );
  });

  it("does not serialize schema-valid fixture facts that are detached from the authenticated raw bytes", async () => {
    const input = await fixture();
    const forgedFixture = structuredClone(
      input.contextFixtureSnapshot.input as {
        contexts: Array<{
          context: {
            accountFacts?: {
              snapshotId: string;
              weaponInventory?: { weaponIds: string[] };
            };
          };
        }>;
      },
    );
    const accountFacts = forgedFixture.contexts.find(
      ({ context }) => context.accountFacts,
    )?.context.accountFacts;
    if (!accountFacts) throw new Error("Expected the diagnostic account fixture.");
    accountFacts.snapshotId = "forged-schema-valid-account";
    accountFacts.weaponInventory?.weaponIds.push("whiteblind");

    const report = await buildIttoRequestContextApplicabilityReport({
      ...input,
      contextFixtureSnapshot: {
        ...input.contextFixtureSnapshot,
        input: forgedFixture,
        canonicalObjectSha256: hashValue(forgedFixture),
      },
    });

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.contextFixtureBoundary).toMatchObject({
      status: "invalid",
      snapshotClosure: "rejected",
    });
    expect(report.projections).toEqual([]);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.snapshot-parsed-input-mismatch",
          path: ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
        }),
        expect.objectContaining({
          code: "request-context.fixture-revision-mismatch",
          path: ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
        }),
      ]),
    );
    expect(stableJson(report)).not.toContain("forged-schema-valid-account");
  });

  it("rejects beta-only weapon IDs from account inventory fixtures", async () => {
    const input = await fixture();
    const betaWeaponId = [...input.catalogs.betaWeaponIds][0];
    if (!betaWeaponId) throw new Error("Expected at least one beta-only weapon.");
    const changedFixture = structuredClone(
      input.contextFixtureSnapshot.input as {
        contexts: Array<{
          context: {
            accountFacts?: {
              weaponInventory?: { weaponIds: string[] };
            };
          };
        }>;
      },
    );
    const inventory = changedFixture.contexts.find(
      ({ context }) => context.accountFacts?.weaponInventory,
    )?.context.accountFacts?.weaponInventory;
    if (!inventory) throw new Error("Expected the diagnostic weapon inventory.");
    inventory.weaponIds = [betaWeaponId];
    const rawText = JSON.stringify(changedFixture);
    const fileSha256 = sha256Text(rawText);

    const report = await buildIttoRequestContextApplicabilityReport({
      ...input,
      contextFixtureSnapshot: {
        ...input.contextFixtureSnapshot,
        fileSha256,
        canonicalObjectSha256: hashValue(changedFixture),
        rawText,
        input: changedFixture,
      },
      generatedFrom: input.generatedFrom.map((entry) =>
        entry.path === ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH
          ? { ...entry, sha256: fileSha256 }
          : entry,
      ),
    });

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.contextFixtureBoundary).toMatchObject({
      status: "invalid",
      snapshotClosure: "rejected",
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "request-context.unknown-fixture-weapon",
          message: expect.stringContaining(betaWeaponId),
        }),
      ]),
    );
  });

  it("rejects source and fixture snapshot hashes before describing either boundary as accepted", async () => {
    const input = await fixture();
    const badHash = "0".repeat(64);

    const sourceReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      sourceReportSnapshot: {
        ...input.sourceReportSnapshot,
        fileSha256: badHash,
      },
    });
    expect(sourceReport.sourceControlBoundary).toMatchObject({
      status: "unauthenticated",
      snapshotClosure: "rejected",
      semanticContract: "rejected",
    });
    expect(sourceReport.projections).toEqual([]);

    const contextReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      contextFixtureSnapshot: {
        ...input.contextFixtureSnapshot,
        fileSha256: badHash,
      },
    });
    expect(contextReport.contextFixtureBoundary).toMatchObject({
      status: "invalid",
      snapshotClosure: "rejected",
    });
    expect(contextReport.projections).toEqual([]);
  });

  it("rejects duplicate snapshot paths even when the first hash is genuine", async () => {
    const input = await fixture();
    const sourceEntry = input.generatedFrom.find(
      ({ path: inputPath }) =>
        inputPath === ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
    );
    const fixtureEntry = input.generatedFrom.find(
      ({ path: inputPath }) =>
        inputPath === ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
    );
    if (!sourceEntry || !fixtureEntry) {
      throw new Error("Expected both authenticated snapshot hash entries.");
    }

    const sourceReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      generatedFrom: [...input.generatedFrom, sourceEntry],
    });
    expect(sourceReport.comparisonStatus).toBe("not-comparable");
    expect(sourceReport.sourceControlBoundary).toMatchObject({
      status: "unauthenticated",
      snapshotClosure: "rejected",
      semanticContract: "rejected",
    });

    const contextReport = await buildIttoRequestContextApplicabilityReport({
      ...input,
      generatedFrom: [...input.generatedFrom, fixtureEntry],
    });
    expect(contextReport.comparisonStatus).toBe("not-comparable");
    expect(contextReport.contextFixtureBoundary).toMatchObject({
      status: "invalid",
      snapshotClosure: "rejected",
    });
  });

  it("keeps checkpoint 24 dependencies out of the checkpoint 23 control", () => {
    const checkpoint23Paths = new Set<string>(
      ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
    );
    expect(
      ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS.every(
        (inputPath) =>
          !inputPath.includes("RequestContext") || !checkpoint23Paths.has(inputPath),
      ),
    ).toBe(true);
    expect(checkpoint23Paths.has(ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH)).toBe(
      false,
    );
    expect(ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS).toEqual(
      expect.arrayContaining([
        "scripts/guide-factory/src/paths.ts",
        "src/data/game/weapon_stats.json",
      ]),
    );
    expect(checkpoint23Paths.has("scripts/guide-factory/src/paths.ts")).toBe(false);
    expect(checkpoint23Paths.has("src/data/game/weapon_stats.json")).toBe(false);
  });
});

async function fixture(): Promise<BuildIttoRequestContextApplicabilityInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    sourceReportSnapshot,
    contextFixtureSnapshot,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(path.join(SOURCE_SNAPSHOT_ROOT, "kqm-itto-manual.json")),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    readHashedJsonSnapshot(
      REPOSITORY_ROOT,
      ITTO_REQUEST_CONTEXT_SOURCE_REPORT_RELATIVE_PATH,
    ),
    readHashedJsonSnapshot(
      REPOSITORY_ROOT,
      ITTO_REQUEST_CONTEXT_FIXTURE_RELATIVE_PATH,
    ),
  ]);
  const snapshotHashes = new Map([
    [sourceReportSnapshot.path, sourceReportSnapshot.fileSha256],
    [contextFixtureSnapshot.path, contextFixtureSnapshot.fileSha256],
  ]);
  const generatedFrom = await Promise.all(
    ITTO_REQUEST_CONTEXT_APPLICABILITY_INPUT_PATHS.map(
      async (relativePath) => ({
        path: relativePath,
        sha256:
          snapshotHashes.get(relativePath) ??
          (await sha256File(path.join(REPOSITORY_ROOT, relativePath))),
      }),
    ),
  );
  return {
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    sourceReportSnapshot,
    contextFixtureSnapshot,
    generatedFrom,
  };
}

function projection(
  report: IttoRequestContextApplicabilityReport,
  projectionId: string,
) {
  const found = report.projections.find(
    (candidate) => candidate.projectionId === projectionId,
  );
  if (!found) throw new Error(`Missing context projection ${projectionId}.`);
  return found;
}

function cell(
  packet: IttoRequestContextApplicabilityReport["projections"][number]["teamProjections"][number],
  claimId: string,
) {
  const found = packet.claimProjections.find(
    (candidate) => candidate.claimId === claimId,
  );
  if (!found) throw new Error(`Missing request-context claim ${claimId}.`);
  return found;
}

function hashValue(value: unknown): string {
  return sha256Text(stableJson(value));
}
