import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { readJson, sha256File } from "./io";
import { REPOSITORY_ROOT, SOURCE_SNAPSHOT_ROOT } from "./paths";
import {
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  SourceRegistrySchema,
  type ManualSnapshotIndex,
  type SourceRegistry,
} from "./schemas";

export interface ManualSnapshotInput {
  expectedSourceId: string;
  snapshot: unknown;
  snapshotFile: { path: string; sha256: string };
}

export interface ManualSnapshotRoots {
  repositoryRoot: string;
  sourceSnapshotRoot: string;
}

export interface ManualSourceRegistryProblem {
  kind: "missing" | "duplicate" | "not-permitted" | "incompatible";
  sourceId: string;
  message: string;
}

const DEFAULT_ROOTS: ManualSnapshotRoots = {
  repositoryRoot: REPOSITORY_ROOT,
  sourceSnapshotRoot: SOURCE_SNAPSHOT_ROOT,
};

export async function loadManualSnapshotInputs(
  indexInput: unknown,
  sourceRegistryInput: unknown,
  roots: ManualSnapshotRoots = DEFAULT_ROOTS,
): Promise<ManualSnapshotInput[]> {
  const index = ManualSnapshotIndexSchema.parse(indexInput);
  const sourceRegistry = SourceRegistrySchema.parse(sourceRegistryInput);
  assertManualSnapshotSourcesRegistered(
    index.snapshots.map(({ sourceId }) => sourceId),
    sourceRegistry,
  );
  const resolved = resolveIndexEntries(index, roots);
  const realRoots = await resolveRealRoots(roots);
  await assertInventoryIsComplete(resolved, roots, realRoots);

  return Promise.all(
    resolved.map(async ({ sourceId, path: relativePath, absolutePath }) => {
      const snapshot = await readJson(absolutePath);
      const parsed = ManualObservationSnapshotSchema.safeParse(snapshot);
      if (parsed.success && parsed.data.sourceId !== sourceId) {
        throw new Error(
          `Manual snapshot ${relativePath} declares source ID ${parsed.data.sourceId}, but the index declares ${sourceId}.`,
        );
      }

      return {
        expectedSourceId: sourceId,
        snapshot,
        snapshotFile: {
          path: relativePath,
          sha256: await sha256File(absolutePath),
        },
      };
    }),
  );
}

export function manualSourceRegistryProblem(
  sourceId: string,
  sourceRegistry: SourceRegistry,
): ManualSourceRegistryProblem | null {
  const matches = sourceRegistry.sources.filter((source) => source.id === sourceId);
  if (matches.length === 0) {
    return {
      kind: "missing",
      sourceId,
      message: `Manual snapshot source ${sourceId} is absent from the source registry.`,
    };
  }
  if (matches.length > 1) {
    return {
      kind: "duplicate",
      sourceId,
      message: `Manual snapshot source ${sourceId} has ${matches.length} source registry entries; exactly one is required.`,
    };
  }

  const manifest = matches[0];
  if (
    manifest.status !== "active" ||
    manifest.permission === "permission-required"
  ) {
    return {
      kind: "not-permitted",
      sourceId,
      message:
        `Manual snapshot source ${sourceId} must be active and must not require permission; ` +
        `the registry declares status ${manifest.status} and permission ${manifest.permission}.`,
    };
  }
  if (
    manifest.ingestionMode !== "manual-observation" ||
    manifest.recordFormat !== "manual-observation-v1"
  ) {
    return {
      kind: "incompatible",
      sourceId,
      message:
        `Manual snapshot source ${sourceId} must use ingestion mode manual-observation ` +
        `and record format manual-observation-v1; the registry declares ` +
        `${manifest.ingestionMode} and ${manifest.recordFormat}.`,
    };
  }
  return null;
}

export function assertManualSnapshotSourcesRegistered(
  sourceIds: readonly string[],
  sourceRegistry: SourceRegistry,
): void {
  const problems = [...new Set(sourceIds)]
    .sort(compareText)
    .flatMap((sourceId) => {
      const problem = manualSourceRegistryProblem(sourceId, sourceRegistry);
      return problem == null ? [] : [problem];
    });
  if (problems.length > 0) {
    throw new Error(
      `Manual snapshot sources are inconsistent with the source registry:\n${problems
        .map(({ message }) => message)
        .join("\n")}`,
    );
  }
}

export function requiredManualSnapshotInputContaining(
  inputs: readonly ManualSnapshotInput[],
  sourceId: string,
  sourceRecordId: string,
): ManualSnapshotInput {
  const matches = inputs.filter((input) => {
    const parsed = ManualObservationSnapshotSchema.safeParse(input.snapshot);
    return (
      parsed.success &&
      parsed.data.sourceId === sourceId &&
      parsed.data.records.some(
        (record) => record.sourceRecordId === sourceRecordId,
      )
    );
  });
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one ${sourceId} manual snapshot containing ${sourceRecordId}, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function resolveIndexEntries(
  index: ManualSnapshotIndex,
  roots: ManualSnapshotRoots,
): Array<
  ManualSnapshotIndex["snapshots"][number] & { absolutePath: string }
> {
  const seenPaths = new Map<string, string>();
  const resolved = index.snapshots.map((entry, indexPosition) => {
    const absolutePath = resolveSnapshotPath(entry, indexPosition, roots);
    const duplicateKey = pathKey(entry.path);
    const previousPath = seenPaths.get(duplicateKey);
    if (previousPath != null) {
      throw new Error(
        `Manual snapshot paths must be unique without regard to case: ${previousPath} and ${entry.path}.`,
      );
    }
    seenPaths.set(duplicateKey, entry.path);
    return { ...entry, absolutePath };
  });

  return resolved.sort((left, right) => compareText(left.path, right.path));
}

function resolveSnapshotPath(
  entry: ManualSnapshotIndex["snapshots"][number],
  indexPosition: number,
  roots: ManualSnapshotRoots,
): string {
  const segments = entry.path.split("/");
  if (
    path.posix.isAbsolute(entry.path) ||
    path.win32.isAbsolute(entry.path) ||
    entry.path.includes("\\")
  ) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} must use a forward-slash repository-relative path.`,
    );
  }
  if (segments.includes(".") || segments.includes("..")) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} must not contain dot path segments.`,
    );
  }
  if (path.posix.normalize(entry.path) !== entry.path) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} is not a normalized repository-relative path.`,
    );
  }

  const absolutePath = path.resolve(roots.repositoryRoot, entry.path);
  const relativeToRoot = toForwardSlashes(
    path.relative(roots.repositoryRoot, absolutePath),
  );
  if (relativeToRoot !== entry.path) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} is not a normalized repository-relative path.`,
    );
  }

  const relativeToSnapshots = path.relative(
    roots.sourceSnapshotRoot,
    absolutePath,
  );
  if (isOutside(relativeToSnapshots)) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} resolves outside the source-snapshots directory.`,
    );
  }
  if (!entry.path.endsWith("-manual.json")) {
    throw new Error(
      `Manual snapshot index entry ${indexPosition} must name a *-manual.json file.`,
    );
  }
  return absolutePath;
}

async function assertInventoryIsComplete(
  indexed: Array<
    ManualSnapshotIndex["snapshots"][number] & { absolutePath: string }
  >,
  roots: ManualSnapshotRoots,
  realRoots: ManualSnapshotRoots,
): Promise<void> {
  const discoveredPaths = await discoverManualSnapshotPaths(
    roots.sourceSnapshotRoot,
    roots.repositoryRoot,
  );
  const discoveredByKey = new Map<string, string>();
  for (const discoveredPath of discoveredPaths) {
    const key = pathKey(discoveredPath);
    const previousPath = discoveredByKey.get(key);
    if (previousPath != null) {
      throw new Error(
        `Manual snapshot files must be unique without regard to case: ${previousPath} and ${discoveredPath}.`,
      );
    }
    discoveredByKey.set(key, discoveredPath);
  }

  const indexedKeys = new Set(indexed.map((entry) => pathKey(entry.path)));
  const missing: string[] = [];
  const notFiles: string[] = [];
  const escapedFiles: string[] = [];
  for (const entry of indexed) {
    try {
      const metadata = await lstat(entry.absolutePath);
      if (!metadata.isFile()) {
        notFiles.push(entry.path);
        continue;
      }
      const realFilePath = await realpath(entry.absolutePath);
      if (isOutside(path.relative(realRoots.sourceSnapshotRoot, realFilePath))) {
        escapedFiles.push(entry.path);
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        missing.push(entry.path);
        continue;
      }
      throw error;
    }
  }
  const unindexed = discoveredPaths.filter(
    (discoveredPath) => !indexedKeys.has(pathKey(discoveredPath)),
  );

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`Indexed files are missing: ${missing.join(", ")}.`);
  }
  if (notFiles.length > 0) {
    problems.push(`Indexed paths are not files: ${notFiles.join(", ")}.`);
  }
  if (escapedFiles.length > 0) {
    problems.push(
      `Indexed files resolve outside the real source-snapshots directory: ${escapedFiles.join(", ")}.`,
    );
  }
  if (unindexed.length > 0) {
    problems.push(`Manual snapshot files are not indexed: ${unindexed.join(", ")}.`);
  }
  if (problems.length > 0) {
    throw new Error(
      `Manual snapshot inventory is inconsistent:\n${problems.join("\n")}`,
    );
  }
}

async function resolveRealRoots(
  roots: ManualSnapshotRoots,
): Promise<ManualSnapshotRoots> {
  const [repositoryRoot, sourceSnapshotRoot] = await Promise.all([
    realpath(roots.repositoryRoot),
    realpath(roots.sourceSnapshotRoot),
  ]);
  if (isOutside(path.relative(repositoryRoot, sourceSnapshotRoot))) {
    throw new Error(
      "The source-snapshots root resolves outside the real repository root.",
    );
  }
  return { repositoryRoot, sourceSnapshotRoot };
}

async function discoverManualSnapshotPaths(
  directory: string,
  repositoryRoot: string,
): Promise<string[]> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort(
    (left, right) => compareText(left.name, right.name),
  );
  const discovered: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      discovered.push(
        ...(await discoverManualSnapshotPaths(absolutePath, repositoryRoot)),
      );
    } else if (entry.isFile() && entry.name.endsWith("-manual.json")) {
      discovered.push(
        toForwardSlashes(path.relative(repositoryRoot, absolutePath)),
      );
    }
  }
  return discovered.sort(compareText);
}

function isOutside(relativePath: string): boolean {
  return (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function pathKey(value: string): string {
  return value.toLowerCase();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toForwardSlashes(value: string): string {
  return value.replaceAll("\\", "/");
}
