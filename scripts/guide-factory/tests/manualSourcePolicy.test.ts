import { describe, expect, it } from "vitest";
import {
  assertManualSnapshotSourcesRegistered,
  loadManualSnapshotInputs,
  manualSourceRegistryProblem,
} from "../src/manualSnapshots";
import { readJson } from "../src/io";
import {
  KQM_MANUAL_SNAPSHOT_PATH,
  MANUAL_SNAPSHOT_INDEX_PATH,
  SOURCE_REGISTRY_PATH,
} from "../src/paths";
import {
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
} from "../src/schemas";
import { validateManualSnapshotCollection } from "../src/validation";

describe("manual source registry policy", () => {
  it("keeps the permission-required Crimson Witch source outside the manual index", async () => {
    const [registryInput, manualIndexInput] = await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(MANUAL_SNAPSHOT_INDEX_PATH),
    ]);
    const registry = SourceRegistrySchema.parse(registryInput);
    const manualIndex = ManualSnapshotIndexSchema.parse(manualIndexInput);
    const crimsonWitch = registry.sources.find(
      ({ id }) => id === "crimson-witch",
    );

    expect(crimsonWitch).toMatchObject({
      status: "blocked",
      ingestionMode: "permission-blocked",
      permission: "permission-required",
    });
    expect(
      manualIndex.snapshots.some(
        ({ sourceId }) => sourceId === "crimson-witch",
      ),
    ).toBe(false);
    expect(manualSourceRegistryProblem("crimson-witch", registry)).toEqual({
      kind: "not-permitted",
      sourceId: "crimson-witch",
      message:
        "Manual snapshot source crimson-witch must be active and must not require permission; " +
        "the registry declares status blocked and permission permission-required.",
    });

    await expect(
      loadManualSnapshotInputs(
        {
          schemaVersion: 1,
          snapshots: [
            {
              sourceId: "crimson-witch",
              path: "scripts/guide-factory/data/source-snapshots/crimson-witch-manual.json",
            },
          ],
        },
        registry,
      ),
    ).rejects.toThrow(
      "Manual snapshot source crimson-witch must be active and must not require permission",
    );
  });

  it.each([
    { status: "planned" as const, permission: "unknown" as const },
    { status: "active" as const, permission: "permission-required" as const },
  ])(
    "fails closed for registry status $status and permission $permission",
    ({ status, permission }) => {
      const registry = SourceRegistrySchema.parse({
        schemaVersion: 1,
        sources: [
          {
            id: "synthetic-source",
            name: "Synthetic source",
            homepage: null,
            kind: "editorial",
            status,
            ingestionMode: "manual-observation",
            permission,
            recordFormat: "manual-observation-v1",
            checkedAt: "2026-08-30",
            notes: [],
          },
        ],
      });

      expect(() =>
        assertManualSnapshotSourcesRegistered(["synthetic-source"], registry),
      ).toThrow(
        `the registry declares status ${status} and permission ${permission}`,
      );
    },
  );

  it("reports the permission gate through collection validation", async () => {
    const [registryInput, snapshotInput] = await Promise.all([
      readJson(SOURCE_REGISTRY_PATH),
      readJson(KQM_MANUAL_SNAPSHOT_PATH),
    ]);
    const registry = SourceRegistrySchema.parse(registryInput);
    const snapshot = ManualObservationSnapshotSchema.parse(snapshotInput);
    const blockedSnapshot = {
      ...snapshot,
      sourceId: "crimson-witch",
    };

    expect(
      validateManualSnapshotCollection([blockedSnapshot], registry),
    ).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "provenance.manual_source_ingestion_not_permitted",
        path: "manual-snapshots[0].sourceId",
        message:
          "Manual snapshot source crimson-witch must be active and must not require permission; " +
          "the registry declares status blocked and permission permission-required.",
      }),
    ]);
  });
});
