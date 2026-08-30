import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  type KnowledgeRecord,
  type KnowledgeRepository,
} from "./schemas";

export type KnowledgeRepositoryProjectionKind =
  | "character-guide-input"
  | "manual-condition-coverage";

/**
 * Canonical repository view for reports that deliberately ignore validation
 * fixtures. Manual source revisions are restricted to the snapshots that the
 * caller authenticates independently; non-manual source revisions remain
 * exact.
 */
export function projectKnowledgeRepository(
  repositoryInput: unknown,
  projectionKind: KnowledgeRepositoryProjectionKind,
  authenticatedManualSnapshotPaths: readonly string[],
): KnowledgeRepository {
  const repository = KnowledgeRepositorySchema.parse(repositoryInput);
  const manualPaths = new Set(authenticatedManualSnapshotPaths);
  if (manualPaths.size !== authenticatedManualSnapshotPaths.length) {
    throw new Error(
      `Repository ${projectionKind} projection repeats an authenticated manual snapshot path.`,
    );
  }

  const records = repository.records
    .filter((record) => recordIncluded(record, projectionKind))
    .map((record) => structuredClone(record))
    .sort(compareRecords);
  const generatedFrom = repository.generatedFrom
    .map(({ sourceId, files }) => ({
      sourceId,
      files: files
        .filter(
          ({ path }) =>
            !isManualObservationSnapshotPath(path) || manualPaths.has(path),
        )
        .map((file) => ({ ...file }))
        .sort((left, right) => compareText(left.path, right.path)),
    }))
    .filter(({ files }) => files.length > 0)
    .sort((left, right) => compareText(left.sourceId, right.sourceId));

  return KnowledgeRepositorySchema.parse({
    schemaVersion: 1,
    sourceRegistrySha256: repository.sourceRegistrySha256,
    generatedFrom,
    records,
  });
}

export function knowledgeRepositoryProjectionSha256(
  projection: KnowledgeRepository,
): string {
  return sha256Text(stableJson(KnowledgeRepositorySchema.parse(projection)));
}

function recordIncluded(
  record: KnowledgeRecord,
  projectionKind: KnowledgeRepositoryProjectionKind,
): boolean {
  if (record.kind === "rotation_fixture") return false;
  return (
    projectionKind !== "character-guide-input" ||
    record.kind !== "energy_guidance"
  );
}

function isManualObservationSnapshotPath(inputPath: string): boolean {
  return (
    inputPath.startsWith(
      "scripts/guide-factory/data/source-snapshots/",
    ) && inputPath.endsWith("-manual.json")
  );
}

function compareRecords(left: KnowledgeRecord, right: KnowledgeRecord): number {
  return compareText(left.id, right.id) ||
    compareText(stableJson(left), stableJson(right));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
