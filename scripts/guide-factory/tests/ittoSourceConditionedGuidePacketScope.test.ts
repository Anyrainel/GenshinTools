import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGameCatalogs } from "../src/catalogs";
import {
  buildIttoSourceConditionedGuidePacketReport,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS,
} from "../src/ittoSourceConditionedGuidePacket";
import {
  deriveIttoSourceConditionedGuidePacketScopeCandidate,
  ITTO_GUIDE_RECORD_IDS,
  ITTO_RAW_RECORD_IDS,
  ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION,
  ITTO_TEAM_RECORD_IDS,
  requireIttoSourceConditionedGuidePacketScope,
  type IttoSourceConditionedGuidePacketScopeInput,
} from "../src/ittoSourceConditionedGuidePacketScope";
import { readJson, sha256File } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  REPOSITORY_ROOT,
  SOURCE_REGISTRY_PATH,
  SOURCE_SNAPSHOT_ROOT,
} from "../src/paths";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type KnowledgeRepository,
  type ManualObservationSnapshot,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "../src/schemas";

const SNAPSHOT_PATH =
  "scripts/guide-factory/data/source-snapshots/kqm-itto-manual.json";
const BROAD_CARRIER_PATHS = [
  "scripts/guide-factory/data/knowledge/repository.json",
  "scripts/guide-factory/data/source-snapshots/manual-index.json",
  "scripts/guide-factory/sources/registry.json",
] as const;

describe("Itto source-conditioned packet semantic scope", () => {
  it("authenticates seven raw and consolidated records, three preset coverage rows, and seven exact parities", async () => {
    const fixture = await loadFixture();
    const scoped = requireIttoSourceConditionedGuidePacketScope(fixture);

    expect(scoped.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(scoped.audit.dependencies.map(({ selectedEntries }) => selectedEntries.length)).toEqual([
      7,
      7,
      3,
      1,
      1,
    ]);
    expect(scoped.audit.parities).toHaveLength(7);
    expect(scoped.audit.parities.every(({ status }) => status === "exact")).toBe(
      true,
    );
    expect(scoped.rawRecords.map(({ sourceRecordId }) => sourceRecordId)).toEqual(
      ITTO_RAW_RECORD_IDS,
    );
    expect(scoped.repositoryRecords).toHaveLength(7);
    expect(
      scoped.presetRosterCoverage.map(({ matchingPresetTeams }) =>
        matchingPresetTeams.map(({ id }) => id),
      ),
    ).toEqual([
      [],
      [],
      ["genshintools-presets:team:8ru0gxT0jJgK50AfWD"],
    ]);
  });

  it("keeps the complete packet stable under unrelated Xiao records and broad-carrier metadata", async () => {
    const fixture = await loadFixture();
    const baseline = await buildReport(fixture);
    const changed = structuredClone(fixture);

    changed.repository.sourceRegistrySha256 = "f".repeat(64);
    const kqmGenerated = changed.repository.generatedFrom.find(
      ({ sourceId }) => sourceId === "kqm",
    );
    const xiaoFile = kqmGenerated?.files.find(({ path: filePath }) =>
      filePath.includes("kqm-xiao-manual.json"),
    );
    if (!xiaoFile) throw new Error("Missing Xiao repository carrier fixture.");
    xiaoFile.sha256 = "e".repeat(64);
    const xiaoRecord = changed.repository.records.find(({ id }) =>
      id.includes(":xiao-"),
    );
    if (!xiaoRecord) throw new Error("Missing Xiao repository record fixture.");
    xiaoRecord.unknowns.push("unrelated Xiao scope-test metadata");

    changed.manualIndex.snapshots.push({
      sourceId: "kqm",
      path: "scripts/guide-factory/data/source-snapshots/kqm-future-xiao-scope-test.json",
    });
    const unrelatedSource = structuredClone(changed.sourceRegistry.sources[0]);
    unrelatedSource.id = "unrelated-xiao-scope-test";
    changed.sourceRegistry.sources.push(unrelatedSource);

    expect(await buildReport(changed)).toEqual(baseline);
    for (const broadPath of BROAD_CARRIER_PATHS) {
      expect(ITTO_SOURCE_CONDITIONED_GUIDE_PACKET_INPUT_PATHS).not.toContain(
        broadPath,
      );
      expect(baseline.generatedFrom.map(({ path: inputPath }) => inputPath)).not.toContain(
        broadPath,
      );
      expect(baseline.sourceBoundary.sourceHashes.map(({ path: inputPath }) => inputPath)).not.toContain(
        broadPath,
      );
    }
  });

  it("rejects missing, duplicate, and parity-drifted selected records", async () => {
    const fixture = await loadFixture();
    const missing = structuredClone(fixture);
    missing.repository.records = missing.repository.records.filter(
      ({ id }) => id !== ITTO_GUIDE_RECORD_IDS[0],
    );
    expect(rejectionCodes(deriveIttoSourceConditionedGuidePacketScopeCandidate(missing))).toContain(
      "selection.required_key_missing",
    );

    const duplicated = structuredClone(fixture);
    const raw = duplicated.manualSnapshot.records.find(
      ({ sourceRecordId }) => sourceRecordId === ITTO_RAW_RECORD_IDS[0],
    );
    if (!raw) throw new Error("Missing selected raw Itto record fixture.");
    duplicated.manualSnapshot.records.push(structuredClone(raw));
    expect(rejectionCodes(deriveIttoSourceConditionedGuidePacketScopeCandidate(duplicated))).toContain(
      "selection.required_key_duplicated",
    );

    const parityDrift = structuredClone(fixture);
    const guide = parityDrift.repository.records.find(
      ({ id }) => id === ITTO_GUIDE_RECORD_IDS[0],
    );
    if (guide?.kind !== "character_guide" || !guide.recommendations?.[0]) {
      throw new Error("Missing selected consolidated Itto guide fixture.");
    }
    guide.recommendations[0].label = "drifted parity scope test";
    expect(rejectionCodes(deriveIttoSourceConditionedGuidePacketScopeCandidate(parityDrift))).toContain(
      "parity.normalized_payload_mismatch",
    );
  });

  it("rejects relevant preset coverage, Itto index, and KQM registry drift", async () => {
    const fixture = await loadFixture();
    const newRelevantPreset = structuredClone(fixture);
    const sourceTeam = newRelevantPreset.repository.records.find(
      ({ id }) => id === ITTO_TEAM_RECORD_IDS[0],
    );
    if (sourceTeam?.kind !== "team") {
      throw new Error("Missing selected Itto source team fixture.");
    }
    const syntheticPreset = structuredClone(sourceTeam);
    syntheticPreset.id = "genshintools-presets:team:itto-scope-drift";
    newRelevantPreset.repository.records.push(syntheticPreset);
    expect(() =>
      requireIttoSourceConditionedGuidePacketScope(newRelevantPreset),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const indexDrift = structuredClone(fixture);
    const indexEntry = indexDrift.manualIndex.snapshots.find(
      ({ path: filePath }) => filePath === SNAPSHOT_PATH,
    );
    if (!indexEntry) throw new Error("Missing Itto manual-index entry fixture.");
    indexEntry.sourceId = "gcsim";
    expect(() =>
      requireIttoSourceConditionedGuidePacketScope(indexDrift),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const registryDrift = structuredClone(fixture);
    const kqm = registryDrift.sourceRegistry.sources.find(
      ({ id }) => id === "kqm",
    );
    if (!kqm) throw new Error("Missing KQM source manifest fixture.");
    kqm.permission = "permission-required";
    expect(() =>
      requireIttoSourceConditionedGuidePacketScope(registryDrift),
    ).toThrow(/authentication\.scope_projection_mismatch/);
  });
});

interface Fixture extends IttoSourceConditionedGuidePacketScopeInput {
  repository: KnowledgeRepository;
  manualSnapshot: ManualObservationSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

async function loadFixture(): Promise<Fixture> {
  const [repository, manualSnapshot, manualIndex, sourceRegistry] =
    await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH).then((value) =>
        KnowledgeRepositorySchema.parse(value),
      ),
      readJson(path.join(SOURCE_SNAPSHOT_ROOT, "kqm-itto-manual.json")).then(
        (value) => ManualObservationSnapshotSchema.parse(value),
      ),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH).then((value) =>
        ManualSnapshotIndexSchema.parse(value),
      ),
      readJson(SOURCE_REGISTRY_PATH).then((value) =>
        SourceRegistrySchema.parse(value),
      ),
    ]);
  return { repository, manualSnapshot, manualIndex, sourceRegistry };
}

async function buildReport(fixture: Fixture) {
  const [catalogs, generatedFrom] = await Promise.all([
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
  return buildIttoSourceConditionedGuidePacketReport({
    repositoryInput: fixture.repository,
    manualSnapshotInput: fixture.manualSnapshot,
    manualIndexInput: fixture.manualIndex,
    sourceRegistryInput: fixture.sourceRegistry,
    catalogs,
    generatedFrom,
  });
}

function rejectionCodes(
  result: ReturnType<
    typeof deriveIttoSourceConditionedGuidePacketScopeCandidate
  >,
): string[] {
  return result.status === "rejected"
    ? result.issues.map(({ code }) => code)
    : [];
}
