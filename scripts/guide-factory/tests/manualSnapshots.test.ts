import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadManualSnapshotInputs,
  type ManualSnapshotRoots,
} from "../src/manualSnapshots";
import { readJson, writeJson } from "../src/io";
import { KQM_MANUAL_SNAPSHOT_PATH } from "../src/paths";
import type { SourceRegistry } from "../src/schemas";

const SNAPSHOT_DIRECTORY = "scripts/guide-factory/data/source-snapshots";
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((temporaryRoot) =>
      rm(temporaryRoot, { recursive: true, force: true }),
    ),
  );
});

describe("manual snapshot inventory", () => {
  it("loads indexed snapshots in canonical path order", async () => {
    const roots = await createRoots();
    const laterPath = await writeSnapshot(
      roots,
      "zeta-manual.json",
      "zeta-source",
    );
    const earlierPath = await writeSnapshot(
      roots,
      "nested/alpha-manual.json",
      "alpha-source",
    );

    const snapshots = await loadManualSnapshotInputs(
      manualIndex([
        { sourceId: "zeta-source", path: laterPath },
        { sourceId: "alpha-source", path: earlierPath },
      ]),
      sourceRegistry(["zeta-source", "alpha-source"]),
      roots,
    );

    expect(snapshots.map(({ snapshotFile }) => snapshotFile.path)).toEqual([
      earlierPath,
      laterPath,
    ]);
    expect(snapshots.map(({ expectedSourceId }) => expectedSourceId)).toEqual([
      "alpha-source",
      "zeta-source",
    ]);
    expect(
      snapshots.every(({ snapshotFile }) =>
        /^[a-f0-9]{64}$/.test(snapshotFile.sha256),
      ),
    ).toBe(true);
  });

  it.each([
    "C:/outside/absolute-manual.json",
    "/outside/absolute-manual.json",
    `${SNAPSHOT_DIRECTORY}\\backslash-manual.json`,
    `./${SNAPSHOT_DIRECTORY}/leading-dot-manual.json`,
    `${SNAPSHOT_DIRECTORY}/./inner-dot-manual.json`,
    `${SNAPSHOT_DIRECTORY}/../dotdot-manual.json`,
    "../outside/root-escape-manual.json",
    `${SNAPSHOT_DIRECTORY}/wrong-suffix.json`,
  ])("rejects non-canonical or unsafe path %s", async (unsafePath) => {
    const roots = await createRoots();

    await expect(
      loadManualSnapshotInputs(
        manualIndex([{ sourceId: "source", path: unsafePath }]),
        sourceRegistry(["source"]),
        roots,
      ),
    ).rejects.toThrow(/repository-relative|dot path|normalized|outside|\*-manual\.json/);
  });

  it("rejects indexed paths that collide without regard to case", async () => {
    const roots = await createRoots();
    const lowercasePath = `${SNAPSHOT_DIRECTORY}/sample-manual.json`;
    const uppercasePath = `${SNAPSHOT_DIRECTORY}/SAMPLE-manual.json`;

    await expect(
      loadManualSnapshotInputs(
        manualIndex([
          { sourceId: "source", path: lowercasePath },
          { sourceId: "source", path: uppercasePath },
        ]),
        sourceRegistry(["source"]),
        roots,
      ),
    ).rejects.toThrow(
      `Manual snapshot paths must be unique without regard to case: ${lowercasePath} and ${uppercasePath}.`,
    );
  });

  it("reports both missing indexed files and recursively discovered unindexed files", async () => {
    const roots = await createRoots();
    const orphanPath = await writeSnapshot(
      roots,
      "nested/orphan-manual.json",
      "orphan-source",
    );
    const missingPath = `${SNAPSHOT_DIRECTORY}/missing-manual.json`;

    await expect(
      loadManualSnapshotInputs(
        manualIndex([{ sourceId: "missing-source", path: missingPath }]),
        sourceRegistry(["missing-source"]),
        roots,
      ),
    ).rejects.toThrow(
      [
        "Manual snapshot inventory is inconsistent:",
        `Indexed files are missing: ${missingPath}.`,
        `Manual snapshot files are not indexed: ${orphanPath}.`,
      ].join("\n"),
    );
  });

  it("rejects an index source ID that differs from a valid snapshot", async () => {
    const roots = await createRoots();
    const snapshotPath = await writeSnapshot(
      roots,
      "mismatched-manual.json",
      "declared-source",
    );

    await expect(
      loadManualSnapshotInputs(
        manualIndex([{ sourceId: "indexed-source", path: snapshotPath }]),
        sourceRegistry(["indexed-source"]),
        roots,
      ),
    ).rejects.toThrow(
      `Manual snapshot ${snapshotPath} declares source ID declared-source, but the index declares indexed-source.`,
    );
  });

  it("rejects an indexed source missing from the source registry", async () => {
    const roots = await createRoots();
    const snapshotPath = await writeSnapshot(
      roots,
      "unknown-source-manual.json",
      "unregistered-source",
    );

    await expect(
      loadManualSnapshotInputs(
        manualIndex([
          { sourceId: "unregistered-source", path: snapshotPath },
        ]),
        sourceRegistry([]),
        roots,
      ),
    ).rejects.toThrow(
      "Manual snapshot source unregistered-source is absent from the source registry.",
    );
  });

  it.each([
    ["internal-adapter", "manual-observation-v1"],
    ["manual-observation", "structured-external-v1"],
  ] as const)(
    "rejects registry policy %s / %s for an indexed manual snapshot",
    async (ingestionMode, recordFormat) => {
      const roots = await createRoots();
      const snapshotPath = await writeSnapshot(
        roots,
        "wrong-policy-manual.json",
        "wrong-policy-source",
      );
      const registry = sourceRegistry(["wrong-policy-source"]);
      const manifest = registry.sources[0];
      if (!manifest) throw new Error("Missing registry fixture manifest");
      manifest.ingestionMode = ingestionMode;
      manifest.recordFormat = recordFormat;

      await expect(
        loadManualSnapshotInputs(
          manualIndex([
            { sourceId: "wrong-policy-source", path: snapshotPath },
          ]),
          registry,
          roots,
        ),
      ).rejects.toThrow(
        `the registry declares ${ingestionMode} and ${recordFormat}`,
      );
    },
  );

  it("rejects an indexed file reached through a linked directory outside source-snapshots", async ({
    skip,
  }) => {
    const roots = await createRoots();
    const externalDirectory = await createTemporaryDirectory();
    const externalFile = path.join(externalDirectory, "escaped-manual.json");
    await writeSnapshotFile(externalFile, "linked-source");
    const linkPath = path.join(roots.sourceSnapshotRoot, "linked");
    if (!(await tryCreateDirectoryLink(externalDirectory, linkPath))) skip();
    const indexedPath = `${SNAPSHOT_DIRECTORY}/linked/escaped-manual.json`;

    await expect(
      loadManualSnapshotInputs(
        manualIndex([{ sourceId: "linked-source", path: indexedPath }]),
        sourceRegistry(["linked-source"]),
        roots,
      ),
    ).rejects.toThrow(
      `Indexed files resolve outside the real source-snapshots directory: ${indexedPath}.`,
    );
  });

  it("rejects a source-snapshots root linked outside the repository", async ({
    skip,
  }) => {
    const roots = await createRoots();
    const externalDirectory = await createTemporaryDirectory();
    await writeSnapshotFile(
      path.join(externalDirectory, "escaped-root-manual.json"),
      "linked-root-source",
    );
    await rm(roots.sourceSnapshotRoot, { recursive: true });
    if (!(await tryCreateDirectoryLink(externalDirectory, roots.sourceSnapshotRoot))) {
      skip();
    }

    await expect(
      loadManualSnapshotInputs(
        manualIndex([
          {
            sourceId: "linked-root-source",
            path: `${SNAPSHOT_DIRECTORY}/escaped-root-manual.json`,
          },
        ]),
        sourceRegistry(["linked-root-source"]),
        roots,
      ),
    ).rejects.toThrow(
      "The source-snapshots root resolves outside the real repository root.",
    );
  });
});

function manualIndex(
  snapshots: Array<{ sourceId: string; path: string }>,
): unknown {
  return { schemaVersion: 1, snapshots };
}

async function createRoots(): Promise<ManualSnapshotRoots> {
  const repositoryRoot = await createTemporaryDirectory();
  const sourceSnapshotRoot = path.join(
    repositoryRoot,
    ...SNAPSHOT_DIRECTORY.split("/"),
  );
  await mkdir(sourceSnapshotRoot, { recursive: true });
  return { repositoryRoot, sourceSnapshotRoot };
}

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(tmpdir(), "guide-factory-manual-snapshots-"),
  );
  temporaryRoots.push(directory);
  return directory;
}

async function writeSnapshot(
  roots: ManualSnapshotRoots,
  relativeToSnapshotDirectory: string,
  sourceId: string,
): Promise<string> {
  const repositoryRelativePath = `${SNAPSHOT_DIRECTORY}/${relativeToSnapshotDirectory}`;
  const snapshot = structuredClone(
    (await readJson(KQM_MANUAL_SNAPSHOT_PATH)) as Record<string, unknown>,
  );
  snapshot.sourceId = sourceId;
  await writeJson(path.resolve(roots.repositoryRoot, repositoryRelativePath), snapshot);
  return repositoryRelativePath;
}

async function writeSnapshotFile(
  absolutePath: string,
  sourceId: string,
): Promise<void> {
  const snapshot = structuredClone(
    (await readJson(KQM_MANUAL_SNAPSHOT_PATH)) as Record<string, unknown>,
  );
  snapshot.sourceId = sourceId;
  await writeJson(absolutePath, snapshot);
}

async function tryCreateDirectoryLink(
  target: string,
  linkPath: string,
): Promise<boolean> {
  try {
    await symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["EACCES", "ENOSYS", "ENOTSUP", "EOPNOTSUPP", "EPERM"].includes(
        String((error as NodeJS.ErrnoException).code),
      )
    ) {
      return false;
    }
    throw error;
  }
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
