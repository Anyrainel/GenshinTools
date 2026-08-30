import path from "node:path";
import { describe, expect, it } from "vitest";
import { readJson } from "../src/io";
import {
  KNOWLEDGE_REPOSITORY_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
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
import {
  deriveXiaoSourceLocalConditionSliceScopeCandidate,
  requireXiaoSourceLocalConditionSliceScope,
  XIAO_RAW_RECORD_IDS,
  XIAO_REPOSITORY_RECORD_IDS,
  XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION,
  type XiaoSourceLocalConditionSliceScopeInput,
} from "../src/xiaoSourceLocalConditionSliceScope";

const SNAPSHOT_PATH = path.join(
  SOURCE_SNAPSHOT_ROOT,
  "kqm-xiao-manual.json",
);

describe("Xiao source-local condition semantic scope", () => {
  it("authenticates seven raw records, seven consolidated records, and exact parity", async () => {
    const scoped = requireXiaoSourceLocalConditionSliceScope(await fixture());

    expect(scoped.audit).toMatchObject({
      status: "accepted",
      trust: "authenticated-current-input-rebuild-and-pinned-expectation",
      scopeId: XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION.scopeId,
      selector: {
        manifestSha256:
          XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION.manifestSha256,
      },
      scopeProjectionSha256:
        XIAO_SOURCE_LOCAL_CONDITION_SLICE_SCOPE_EXPECTATION.scopeProjectionSha256,
    });
    expect(
      scoped.audit.dependencies.map(({ selectedEntries }) =>
        selectedEntries.length,
      ),
    ).toEqual([7, 7, 1, 1]);
    expect(scoped.audit.parities).toHaveLength(7);
    expect(scoped.audit.parities.every(({ status }) => status === "exact")).toBe(
      true,
    );
    expect(scoped.rawRecords.map(({ sourceRecordId }) => sourceRecordId)).toEqual(
      XIAO_RAW_RECORD_IDS,
    );
    expect(scoped.repositoryRecords.map(({ id }) => id)).toEqual(
      XIAO_REPOSITORY_RECORD_IDS,
    );
  });

  it("ignores unrelated broad-carrier and separate rotation-fixture drift", async () => {
    const baseline = requireXiaoSourceLocalConditionSliceScope(await fixture());
    const changed = await fixture();

    changed.repository.sourceRegistrySha256 = "f".repeat(64);
    const unrelated = changed.repository.records.find(
      ({ id }) => !XIAO_REPOSITORY_RECORD_IDS.includes(id),
    );
    if (!unrelated) throw new Error("Missing unrelated repository record.");
    unrelated.unknowns.push("unrelated Xiao scope test metadata");
    const fixtureRecord = changed.repository.records.find(
      ({ kind, id }) => kind === "rotation_fixture" && id.includes(":xiao-"),
    );
    if (!fixtureRecord || fixtureRecord.kind !== "rotation_fixture") {
      throw new Error("Missing separate Xiao rotation fixture.");
    }
    fixtureRecord.formulaCounts[1]!.count += 1;
    changed.manualIndex.snapshots.push({
      sourceId: "kqm",
      path: "scripts/guide-factory/data/source-snapshots/unrelated-xiao.json",
    });
    const unrelatedSource = structuredClone(changed.sourceRegistry.sources[0]!);
    unrelatedSource.id = "unrelated-xiao-scope-test";
    changed.sourceRegistry.sources.push(unrelatedSource);

    const observed = requireXiaoSourceLocalConditionSliceScope(changed);
    expect(observed.audit).toEqual(baseline.audit);
    expect(observed.rawRecords).toEqual(baseline.rawRecords);
    expect(observed.repositoryRecords).toEqual(baseline.repositoryRecords);
  });

  it("rejects missing, duplicated, parity-drifted, and roster-drifted selected records", async () => {
    const missing = await fixture();
    missing.repository.records = missing.repository.records.filter(
      ({ id }) => id !== XIAO_REPOSITORY_RECORD_IDS[0],
    );
    expect(rejectionCodes(deriveXiaoSourceLocalConditionSliceScopeCandidate(missing))).toContain(
      "selection.required_key_missing",
    );

    const duplicated = await fixture();
    const raw = duplicated.manualSnapshot.records.find(
      ({ sourceRecordId }) => sourceRecordId === XIAO_RAW_RECORD_IDS[0],
    );
    if (!raw) throw new Error("Missing selected Xiao raw record.");
    duplicated.manualSnapshot.records.push(structuredClone(raw));
    expect(
      rejectionCodes(
        deriveXiaoSourceLocalConditionSliceScopeCandidate(duplicated),
      ),
    ).toContain("selection.required_key_duplicated");

    const parityDrift = await fixture();
    const guide = parityDrift.repository.records.find(
      ({ id }) => id === XIAO_REPOSITORY_RECORD_IDS[0],
    );
    if (guide?.kind !== "character_guide" || !guide.recommendations?.[0]) {
      throw new Error("Missing selected Xiao guide.");
    }
    guide.recommendations[0].label = "drifted Xiao scope test";
    expect(
      rejectionCodes(
        deriveXiaoSourceLocalConditionSliceScopeCandidate(parityDrift),
      ),
    ).toContain("parity.normalized_payload_mismatch");

    const rosterDrift = await fixture();
    const rawTeam = rosterDrift.manualSnapshot.records.find(
      ({ sourceRecordId }) =>
        sourceRecordId === XIAO_RAW_RECORD_IDS.at(-1),
    );
    const repositoryTeam = rosterDrift.repository.records.find(
      ({ id }) => id === XIAO_REPOSITORY_RECORD_IDS.at(-1),
    );
    if (
      rawTeam?.kind !== "team" ||
      !repositoryTeam ||
      repositoryTeam.kind !== "team"
    ) {
      throw new Error("Missing selected Xiao team.");
    }
    rawTeam.members[3]!.characterId = "bennett";
    repositoryTeam.members[3]!.characterId = "bennett";
    expect(() =>
      requireXiaoSourceLocalConditionSliceScope(rosterDrift),
    ).toThrow(/authentication\.scope_projection_mismatch/);
  });

  it("rejects the relevant Xiao index or KQM registry authority row drifting", async () => {
    const indexDrift = await fixture();
    const indexEntry = indexDrift.manualIndex.snapshots.find(
      ({ path: snapshotPath }) =>
        snapshotPath.endsWith("kqm-xiao-manual.json"),
    );
    if (!indexEntry) throw new Error("Missing Xiao manual-index entry.");
    indexEntry.sourceId = "gcsim";
    expect(() =>
      requireXiaoSourceLocalConditionSliceScope(indexDrift),
    ).toThrow(/authentication\.scope_projection_mismatch/);

    const registryDrift = await fixture();
    const kqm = registryDrift.sourceRegistry.sources.find(
      ({ id }) => id === "kqm",
    );
    if (!kqm) throw new Error("Missing KQM source manifest.");
    kqm.permission = "permission-required";
    expect(() =>
      requireXiaoSourceLocalConditionSliceScope(registryDrift),
    ).toThrow(/authentication\.scope_projection_mismatch/);
  });
});

interface Fixture extends XiaoSourceLocalConditionSliceScopeInput {
  repository: KnowledgeRepository;
  manualSnapshot: ManualObservationSnapshot;
  manualIndex: ManualSnapshotIndex;
  sourceRegistry: SourceRegistry;
}

async function fixture(): Promise<Fixture> {
  const [repository, manualSnapshot, manualIndex, sourceRegistry] =
    await Promise.all([
      readJson(KNOWLEDGE_REPOSITORY_PATH).then((value) =>
        KnowledgeRepositorySchema.parse(value),
      ),
      readJson(SNAPSHOT_PATH).then((value) =>
        ManualObservationSnapshotSchema.parse(value),
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

function rejectionCodes(
  result: ReturnType<typeof deriveXiaoSourceLocalConditionSliceScopeCandidate>,
): string[] {
  return result.status === "rejected"
    ? result.issues.map(({ code }) => code)
    : [];
}
