import { beforeAll, describe, expect, it } from "vitest";
import { consolidateKnowledge } from "../src/consolidation";
import { readJson } from "../src/io";
import {
  GENSHINTOOLS_SNAPSHOT_PATH,
  KQM_MANUAL_SNAPSHOT_PATH,
  LEGACY_SNAPSHOT_PATH,
} from "../src/paths";
import {
  ManualObservationSnapshotSchema,
  type ManualObservationSnapshot,
  type SourceRegistry,
} from "../src/schemas";
import { validateManualSnapshotCollection } from "../src/validation";

const SOURCE_REGISTRY_SHA256 = "0".repeat(64);
const FIRST_SNAPSHOT_SHA256 = "1".repeat(64);
const SECOND_SNAPSHOT_SHA256 = "2".repeat(64);

let genshinToolsSnapshot: unknown;
let legacySnapshot: unknown;
let dionaSnapshot: ManualObservationSnapshot;

beforeAll(async () => {
  [genshinToolsSnapshot, legacySnapshot, dionaSnapshot] = await Promise.all([
    readJson(GENSHINTOOLS_SNAPSHOT_PATH),
    readJson(LEGACY_SNAPSHOT_PATH),
    readJson(KQM_MANUAL_SNAPSHOT_PATH).then((input) =>
      ManualObservationSnapshotSchema.parse(input),
    ),
  ]);
});

describe("manual snapshot consolidation", () => {
  it("merges same-source snapshot files into one sorted generatedFrom entry", () => {
    const sourceId = "synthetic-editorial";
    const earlierPath =
      "scripts/guide-factory/data/source-snapshots/a-manual.json";
    const laterPath =
      "scripts/guide-factory/data/source-snapshots/z-manual.json";
    const earlierSnapshot = snapshotWithOneRecord(
      sourceId,
      "record-from-a",
      0,
    );
    const laterSnapshot = snapshotWithOneRecord(
      sourceId,
      "record-from-z",
      1,
    );

    const repository = consolidateKnowledge({
      sourceRegistry: sourceRegistry([sourceId]),
      sourceRegistrySha256: SOURCE_REGISTRY_SHA256,
      genshinTools: genshinToolsSnapshot,
      legacy: legacySnapshot,
      manualSnapshots: [
        {
          expectedSourceId: sourceId,
          snapshot: laterSnapshot,
          snapshotFile: {
            path: laterPath,
            sha256: SECOND_SNAPSHOT_SHA256,
          },
        },
        {
          expectedSourceId: sourceId,
          snapshot: earlierSnapshot,
          snapshotFile: {
            path: earlierPath,
            sha256: FIRST_SNAPSHOT_SHA256,
          },
        },
      ],
    });

    expect(
      repository.generatedFrom.filter((revision) =>
        revision.sourceId === sourceId,
      ),
    ).toEqual([
      {
        sourceId,
        files: [
          { path: earlierPath, sha256: FIRST_SNAPSHOT_SHA256 },
          { path: laterPath, sha256: SECOND_SNAPSHOT_SHA256 },
        ],
      },
    ]);
  });

  it("diagnoses a duplicate source record ID across files from one source", () => {
    const sourceId = "synthetic-editorial";
    const duplicateId = "duplicate-across-files";
    const firstSnapshot = snapshotWithOneRecord(sourceId, duplicateId, 0);
    const secondSnapshot = snapshotWithOneRecord(sourceId, duplicateId, 1);

    expect(
      validateManualSnapshotCollection(
        [firstSnapshot, secondSnapshot],
        sourceRegistry([sourceId]),
      ),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "source_record.duplicate_cross_snapshot_id",
        path: "manual-snapshots[1].records[0].sourceRecordId",
        message:
          "Source record synthetic-editorial:duplicate-across-files duplicates manual-snapshots[0].records[0].sourceRecordId.",
      }),
    ]);

    expect(() =>
      consolidateKnowledge({
        sourceRegistry: sourceRegistry([sourceId]),
        sourceRegistrySha256: SOURCE_REGISTRY_SHA256,
        genshinTools: genshinToolsSnapshot,
        legacy: legacySnapshot,
        manualSnapshots: [
          {
            expectedSourceId: sourceId,
            snapshot: firstSnapshot,
            snapshotFile: {
              path: "scripts/guide-factory/data/source-snapshots/a-manual.json",
              sha256: FIRST_SNAPSHOT_SHA256,
            },
          },
          {
            expectedSourceId: sourceId,
            snapshot: secondSnapshot,
            snapshotFile: {
              path: "scripts/guide-factory/data/source-snapshots/b-manual.json",
              sha256: SECOND_SNAPSHOT_SHA256,
            },
          },
        ],
      }),
    ).toThrow(
      "Duplicate manual source record ID synthetic-editorial:duplicate-across-files",
    );
  });

  it("allows the same source record ID when the source IDs differ", () => {
    const sharedRecordId = "publisher-local-id";
    const firstSnapshot = snapshotWithOneRecord(
      "synthetic-editorial-a",
      sharedRecordId,
      0,
    );
    const secondSnapshot = snapshotWithOneRecord(
      "synthetic-editorial-b",
      sharedRecordId,
      0,
    );

    expect(
      validateManualSnapshotCollection(
        [firstSnapshot, secondSnapshot],
        sourceRegistry([firstSnapshot.sourceId, secondSnapshot.sourceId]),
      ),
    ).toEqual([]);
  });

  it("rejects unregistered or non-manual sources in validation and consolidation", () => {
    const sourceId = "synthetic-editorial";
    const snapshot = snapshotWithOneRecord(sourceId, "registry-policy", 0);
    const missingRegistry = sourceRegistry([]);
    const incompatibleRegistry = sourceRegistry([sourceId]);
    const manifest = incompatibleRegistry.sources[0];
    if (!manifest) throw new Error("Missing registry fixture manifest");
    manifest.ingestionMode = "internal-adapter";

    expect(
      validateManualSnapshotCollection([snapshot], missingRegistry),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "provenance.manual_source_missing",
        path: "manual-snapshots[0].sourceId",
      }),
    ]);
    expect(
      validateManualSnapshotCollection([snapshot], incompatibleRegistry),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "provenance.manual_source_format_mismatch",
        path: "manual-snapshots[0].sourceId",
      }),
    ]);

    expect(() =>
      consolidateKnowledge({
        sourceRegistry: incompatibleRegistry,
        sourceRegistrySha256: SOURCE_REGISTRY_SHA256,
        genshinTools: genshinToolsSnapshot,
        legacy: legacySnapshot,
        manualSnapshots: [
          {
            expectedSourceId: sourceId,
            snapshot,
            snapshotFile: {
              path: "scripts/guide-factory/data/source-snapshots/policy-manual.json",
              sha256: FIRST_SNAPSHOT_SHA256,
            },
          },
        ],
      }),
    ).toThrow(
      "Manual snapshot source synthetic-editorial must use ingestion mode manual-observation and record format manual-observation-v1",
    );
  });
});

function snapshotWithOneRecord(
  sourceId: string,
  sourceRecordId: string,
  recordIndex: number,
): ManualObservationSnapshot {
  const snapshot = structuredClone(dionaSnapshot);
  const record = snapshot.records[recordIndex];
  if (!record) {
    throw new Error(`Missing Diona fixture record ${recordIndex}.`);
  }
  record.sourceRecordId = sourceRecordId;
  snapshot.sourceId = sourceId;
  snapshot.records = [record];
  return ManualObservationSnapshotSchema.parse(snapshot);
}

function sourceRegistry(sourceIds: readonly string[]): SourceRegistry {
  return {
    schemaVersion: 1,
    sources: sourceIds.map((sourceId) => ({
      id: sourceId,
      name: sourceId,
      homepage: null,
      kind: "editorial",
      status: "active",
      ingestionMode: "manual-observation",
      permission: "unknown",
      recordFormat: "manual-observation-v1",
      checkedAt: "2026-08-29",
      notes: [],
    })),
  };
}
