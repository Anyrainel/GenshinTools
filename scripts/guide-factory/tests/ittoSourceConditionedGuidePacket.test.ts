import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import { requireComparableIttoSourceConditionedGuidePacketReport } from "../src/assemble-itto-source-conditioned-guide-packets";
import {
  authenticateIttoSourceConditionedGuidePacketReport,
  buildIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
  type BuildIttoSourceConditionedGuidePacketInput,
} from "../src/ittoSourceConditionedGuidePacket";
import { readJson, sha256File, stableJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import type { SourceConditionedGuidePacketReport } from "../src/sourceConditionedGuidePacket";

const MARECHAUSSEE_CLAIM =
  "kqm:character-guide:itto-contextual-artifact-sets-version-5-6:artifact-group:1";
const LONG_NIGHT_CLAIM =
  "kqm:character-guide:itto-contextual-artifact-sets-version-5-6:artifact-group:3";
const FRUITFUL_HOOK_CLAIM =
  "kqm:character-guide:itto-contextual-weapons-version-5-6:weapon-group:3";
const DEF_GOBLET_CLAIM =
  "kqm:character-guide:itto-on-field-artifact-stats-version-5-6:main-stat:goblet:1";
const PRESET_TEAM_ID = "genshintools-presets:team:8ru0gxT0jJgK50AfWD";

describe("Itto source-conditioned guide packets", () => {
  it("projects fifteen atomic source claims across three exact teams without assembling builds", async () => {
    const report = await buildIttoSourceConditionedGuidePacketReport(
      await fixture(),
    );

    expect(report.comparisonStatus).toBe("comparable");
    expect(report.publicationStatus).toBe("withheld-unreviewed-source");
    expect(report.issues).toEqual([]);
    expect(report.summary).toEqual({
      packetCount: 3,
      sourceClaimCount: 15,
      claimCellCount: 45,
      matchedCellCount: 3,
      inapplicableCellCount: 6,
      withheldCellCount: 36,
      unresolvedCellCount: 27,
      deferredEnergyCellCount: 9,
      templateAcceptedPacketCount: 2,
      templateRejectedPacketCount: 1,
      presetRosterPresentPacketCount: 1,
      presetRosterUncoveredPacketCount: 2,
      investmentGuaranteedPacketCount: 0,
      investmentUnresolvedPacketCount: 1,
      investmentConflictPacketCount: 0,
      assembledBuildCount: 0,
    });
    expect(report.sourceClaimCatalog).toHaveLength(15);
    expect(report.teamPackets).toHaveLength(3);
    expect(report.teamPackets.every(({ claimCells }) => claimCells.length === 15)).toBe(
      true,
    );
    expect(report).toMatchObject({
      supportsGuideClaims: false,
      playerFacingRecommendations: false,
      ranking: false,
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
    });
  });

  it("keeps condition text atomic, grouped stats intact, and all non-roster contexts withheld", async () => {
    const report = await buildIttoSourceConditionedGuidePacketReport(
      await fixture(),
    );
    const conditions = report.sourceClaimCatalog.flatMap(
      ({ sourceConditions }) => sourceConditions,
    );
    expect(conditions).toHaveLength(16);
    expect(new Set(conditions)).toHaveLength(11);

    const circlet = report.sourceClaimCatalog.find(
      ({ claimId }) => claimId.endsWith(":main-stat:circlet:0"),
    );
    expect(circlet?.payload).toEqual({
      type: "main-stat",
      slot: "circlet",
      statIds: ["cr", "cd"],
      priority: null,
      target: null,
    });
    const goblets = report.sourceClaimCatalog.filter(
      ({ payload }) =>
        payload.type === "main-stat" && payload.slot === "goblet",
    );
    expect(goblets).toHaveLength(2);
    expect(
      goblets.every(
        ({ payload }) =>
          payload.type === "main-stat" && payload.priority === null,
      ),
    ).toBe(true);

    for (const packet of report.teamPackets) {
      expect(cell(packet, MARECHAUSSEE_CLAIM).resolution).toBe("matched");
      expect(cell(packet, LONG_NIGHT_CLAIM).resolution).toBe("inapplicable");
      expect(cell(packet, FRUITFUL_HOOK_CLAIM).resolution).toBe(
        "inapplicable",
      );
      expect(cell(packet, DEF_GOBLET_CLAIM).resolution).toBe(
        "unresolved-context",
      );
      expect(packet.partitions.deferredEnergyClaimIds).toHaveLength(3);
      expect(packet.partitions.unresolvedClaimIds).toHaveLength(9);
      expect(packet.partitions.inapplicableClaimIds).toHaveLength(2);
      expect(packet.partitions.matchedClaimIds).toEqual([MARECHAUSSEE_CLAIM]);
    }
  });

  it("uses the real structural/runtime Crystallize gate without claiming gameplay proof", async () => {
    const report = await buildIttoSourceConditionedGuidePacketReport(
      await fixture(),
    );
    const [yelan, xingqiu, gorou] = report.teamPackets;
    for (const packet of [yelan, xingqiu]) {
      expect(packet?.templateStructuralResult).toEqual(
        expect.objectContaining({
          representation:
            "structural-runtime-representation-not-gameplay-proof",
          declaredReactions: ["crystallize"],
          reactionGate: "TeamMeta.hasReaction",
          actualOutcome: "accepted",
          structuralMembership: true,
          acceptedMembership: true,
          structuralAssignmentMultiplicity: 2,
          reactionById: { crystallize: true },
          runtimeGateExecutedForStructuralCandidates: true,
          supportsGameplayProof: false,
        }),
      );
    }
    expect(gorou?.templateStructuralResult).toEqual(
      expect.objectContaining({
        actualOutcome: "structural-rejected",
        structuralMembership: false,
        acceptedMembership: false,
        structuralAssignmentMultiplicity: 0,
        reactionById: null,
        runtimeGateExecutedForStructuralCandidates: false,
        supportsGameplayProof: false,
      }),
    );
  });

  it("reports roster-only preset coverage and does not universalize unspecified investment", async () => {
    const report = await buildIttoSourceConditionedGuidePacketReport(
      await fixture(),
    );
    expect(report.teamPackets[0]?.presetOverlap).toMatchObject({
      rosterStatus: "uncovered",
      investmentStatus: "not-evaluated-roster-uncovered",
    });
    expect(report.teamPackets[1]?.presetOverlap).toMatchObject({
      rosterStatus: "uncovered",
      investmentStatus: "not-evaluated-roster-uncovered",
    });
    const overlap = report.teamPackets[2]?.presetOverlap;
    expect(overlap).toMatchObject({
      rosterStatus: "present",
      presetTeamId: PRESET_TEAM_ID,
      investmentStatus: "unresolved",
    });
    if (!overlap || overlap.rosterStatus !== "present") {
      throw new Error("Expected exact Gorou preset overlap.");
    }
    expect(overlap.memberInvestmentComparisons).toEqual([
      expect.objectContaining({
        characterId: "arataki_itto",
        comparison: expect.objectContaining({
          outcome: "not-constrained-by-source",
          sourceScope: { type: "unspecified" },
          baselineScope: { type: "unspecified" },
          talentLevelsEvaluated: false,
        }),
      }),
      expect.objectContaining({
        characterId: "xilonen",
        comparison: expect.objectContaining({
          outcome: "unresolved-baseline-unspecified",
          sourceScope: { type: "range", minConstellation: 2 },
          baselineScope: { type: "unspecified" },
          talentLevelsEvaluated: false,
        }),
      }),
      expect.objectContaining({
        characterId: "gorou",
        comparison: expect.objectContaining({
          outcome: "not-constrained-by-source",
        }),
      }),
      expect.objectContaining({
        characterId: "furina",
        comparison: expect.objectContaining({
          outcome: "not-constrained-by-source",
        }),
      }),
    ]);
    expect(report.teamPackets[2]?.members[1]).toMatchObject({
      characterId: "xilonen",
      rawSourceInvestment: { minConstellation: 2 },
      investment: { status: "partial", minConstellation: 2 },
    });
  });

  it("matches and authenticates the durable canonical report", async () => {
    const input = await fixture();
    const canonical = await buildIttoSourceConditionedGuidePacketReport(input);
    const durable = (await readJson(
      ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_REPORT_PATH,
    )) as SourceConditionedGuidePacketReport;

    expect(stableJson(durable)).toBe(stableJson(canonical));
    expect(
      await authenticateIttoSourceConditionedGuidePacketReport(durable, input),
    ).toMatchObject({ authenticated: true });

    const changed = structuredClone(durable);
    changed.summary.matchedCellCount += 1;
    expect(
      await authenticateIttoSourceConditionedGuidePacketReport(changed, input),
    ).toMatchObject({
      authenticated: false,
      reason: "serialized-report-mismatch",
    });
  });

  it("fails closed when caller-supplied source JSON diverges from its pinned bytes", async () => {
    const input = await fixture();
    const snapshot = structuredClone(
      input.manualSnapshotInput as Record<string, unknown>,
    );
    const records = snapshot.records as Array<Record<string, unknown>>;
    records[0] = {
      ...records[0],
      unknowns: ["forged source change"],
    };
    const report = await buildIttoSourceConditionedGuidePacketReport({
      ...input,
      manualSnapshotInput: snapshot,
    });

    expect(report.comparisonStatus).toBe("not-comparable");
    expect(report.sourceClaimCatalog).toEqual([]);
    expect(report.teamPackets).toEqual([]);
    expect(report.sourceBoundary).toMatchObject({
      sourceRegistryStatus: "unauthenticated",
      sourceRegistryPermission: "unauthenticated",
      repositoryRecordStatus: "unauthenticated",
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "itto.canonical_input_preparation_failed",
        }),
      ]),
    );
    expect(() =>
      requireComparableIttoSourceConditionedGuidePacketReport(report),
    ).toThrow("Refusing to write a non-comparable Itto source-conditioned packet");
    expect(
      await authenticateIttoSourceConditionedGuidePacketReport(report, {
        ...input,
        manualSnapshotInput: snapshot,
      }),
    ).toMatchObject({
      authenticated: false,
      reason: "canonical-inputs-not-comparable",
    });
  });
});

async function fixture(): Promise<BuildIttoSourceConditionedGuidePacketInput> {
  const [
    repositoryInput,
    manualSnapshotInput,
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    generatedFrom,
  ] = await Promise.all([
    readJson(KNOWLEDGE_REPOSITORY_PATH),
    readJson(path.join(SOURCE_SNAPSHOT_ROOT, "kqm-itto-manual.json")),
    readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    readJson(SOURCE_REGISTRY_PATH),
    loadGameCatalogs(),
    Promise.all(
      ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS.map(
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
    manualIndexInput,
    sourceRegistryInput,
    catalogs,
    generatedFrom,
  };
}

function cell(
  packet: SourceConditionedGuidePacketReport["teamPackets"][number],
  claimId: string,
) {
  const found = packet.claimCells.find((candidate) => candidate.claimId === claimId);
  if (!found) throw new Error(`Missing claim cell ${claimId}.`);
  return found;
}
