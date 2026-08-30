import { sha256Text, stableJson } from "./io";
import {
  KnowledgeRepositorySchema,
  ManualObservationSnapshotSchema,
  ManualSnapshotIndexSchema,
  type KnowledgeRecord,
  type ManualObservationSnapshot,
} from "./schemas";

export type ManualConditionClaimAxis =
  | "weapon-recommendation"
  | "artifact-recommendation"
  | "main-stat"
  | "substat"
  | "er-target"
  | "artifact-plan"
  | "character-role-member";

export type ManualConditionStructuralEnergyDimension =
  | "structural-er"
  | "not-structural-er";

export type ManualConditionMainStatSlot = "sands" | "goblet" | "circlet";

export type ManualConditionExtractionMetadata =
  ManualObservationSnapshot["records"][number]["extraction"];

export interface ManualConditionSnapshotInput {
  path: string;
  snapshotInput: unknown;
}

export interface ManualConditionArrayOccurrence {
  occurrenceId: string;
  snapshotPath: string;
  sourceId: string;
  sourceRecordId: string;
  recordKind:
    | "character_guide"
    | "character_role"
    | "team"
    | "energy_guidance";
  subject: string;
  claimAxis: ManualConditionClaimAxis;
  mainStatSlot?: ManualConditionMainStatSlot;
  structuralEnergyDimension: ManualConditionStructuralEnergyDimension;
  extraction: ManualConditionExtractionMetadata;
  manualPath: string;
  manualClaimPath: string;
  repositoryRecordId: string;
  repositoryPath: string;
  conditions: string[];
  conditionsSha256: string;
}

export interface ManualConditionArrayStatistics {
  occurrenceCount: number;
  emptyCount: number;
  nonemptyCount: number;
  /** Unique exact ordered nonempty arrays; empty arrays are counted separately. */
  uniqueOrderedArrayCount: number;
  stringOccurrenceCount: number;
  uniqueStringCount: number;
}

export interface ManualConditionExtractionSummary
  extends ManualConditionArrayStatistics {
  snapshotCount: number;
  manualRecordCount: number;
  byClaimAxis: Record<ManualConditionClaimAxis, number>;
  structuralEr: ManualConditionArrayStatistics;
  notStructuralEnergy: ManualConditionArrayStatistics;
}

export interface ManualConditionSnapshotSummary {
  path: string;
  sourceId: string;
  recordCount: number;
  occurrenceCount: number;
}

export interface ManualConditionOccurrenceExtraction {
  snapshots: ManualConditionSnapshotSummary[];
  occurrences: ManualConditionArrayOccurrence[];
  summary: ManualConditionExtractionSummary;
}

export type ManualConditionRepositoryParityStatus =
  | "exact"
  | "missing-record"
  | "ambiguous-record"
  | "source-reference-mismatch"
  | "missing-path"
  | "invalid-condition-array"
  | "ordered-array-mismatch";

export interface ManualConditionRepositoryParityRow {
  occurrenceId: string;
  status: ManualConditionRepositoryParityStatus;
  repositoryRecordId: string;
  repositoryJsonPath: string | null;
  manualConditionsSha256: string;
  repositoryConditionsSha256: string | null;
  repositoryConditions: string[] | null;
  exactOrderedArrayMatch: boolean;
}

export interface ManualConditionRepositoryParity {
  status: "exact" | "mismatch";
  occurrenceCount: number;
  exactMatchCount: number;
  mismatchCount: number;
  statusCounts: Record<ManualConditionRepositoryParityStatus, number>;
  rows: ManualConditionRepositoryParityRow[];
}

export interface BuildManualConditionArrayCoverageCoreInput {
  manualIndexInput: unknown;
  manualSnapshotInputs: readonly ManualConditionSnapshotInput[];
  repositoryInput: unknown;
}

export interface ManualConditionArrayCoverageCore {
  extraction: ManualConditionOccurrenceExtraction;
  repositoryParity: ManualConditionRepositoryParity;
}

const CLAIM_AXES: readonly ManualConditionClaimAxis[] = [
  "weapon-recommendation",
  "artifact-recommendation",
  "main-stat",
  "substat",
  "er-target",
  "artifact-plan",
  "character-role-member",
];

/**
 * Extract every condition-bearing array represented by the manual-observation
 * schema. The condition strings are opaque source observations: their order and
 * duplicates are retained and participate in the array hash.
 */
export function extractManualConditionOccurrences(
  manualIndexInput: unknown,
  manualSnapshotInputs: readonly ManualConditionSnapshotInput[],
): ManualConditionOccurrenceExtraction {
  const index = ManualSnapshotIndexSchema.parse(manualIndexInput);
  const inputByPath = indexManualInputs(manualSnapshotInputs);
  const indexedPaths = new Set(index.snapshots.map(({ path }) => path));
  const extraPaths = [...inputByPath.keys()].filter(
    (inputPath) => !indexedPaths.has(inputPath),
  );
  if (extraPaths.length > 0) {
    throw new Error(
      `Manual condition extraction received unindexed snapshots: ${extraPaths
        .sort(compareText)
        .join(", ")}.`,
    );
  }

  const occurrences: ManualConditionArrayOccurrence[] = [];
  const snapshots: ManualConditionSnapshotSummary[] = [];
  let manualRecordCount = 0;

  for (const entry of index.snapshots) {
    const input = inputByPath.get(entry.path);
    if (input == null) {
      throw new Error(
        `Manual condition extraction is missing indexed snapshot ${entry.path}.`,
      );
    }
    // Run the raw shape/cycle preflight before schema parsing so its boundary
    // is independent of Zod's current strictness or unknown-key behavior.
    collectRawConditionProperties(input.snapshotInput, entry.path);
    const snapshot = ManualObservationSnapshotSchema.parse(input.snapshotInput);
    if (snapshot.sourceId !== entry.sourceId) {
      throw new Error(
        `Manual snapshot ${entry.path} declares source ID ${snapshot.sourceId}, but the index declares ${entry.sourceId}.`,
      );
    }

    const firstOccurrenceIndex = occurrences.length;
    snapshot.records.forEach((record, recordIndex) => {
      extractRecordOccurrences(
        occurrences,
        entry.path,
        snapshot.sourceId,
        record,
        recordIndex,
      );
    });
    verifyExactRawConditionPropertyCoverage(
      input.snapshotInput,
      entry.path,
      occurrences.slice(firstOccurrenceIndex),
    );
    manualRecordCount += snapshot.records.length;
    snapshots.push({
      path: entry.path,
      sourceId: snapshot.sourceId,
      recordCount: snapshot.records.length,
      occurrenceCount: occurrences.length - firstOccurrenceIndex,
    });
  }

  assertUniqueOccurrenceIds(occurrences);
  return {
    snapshots,
    occurrences,
    summary: summarizeOccurrences(
      occurrences,
      snapshots.length,
      manualRecordCount,
    ),
  };
}

/**
 * Independently close the raw `conditions` property boundary. This traverses
 * the original input rather than the parsed schema value so newly added or
 * unknown condition-bearing fields cannot be stripped and silently omitted.
 */
export function verifyExactRawConditionPropertyCoverage(
  snapshotInput: unknown,
  snapshotPath: string,
  emittedOccurrences: readonly ManualConditionArrayOccurrence[],
): void {
  const rawProperties = collectRawConditionProperties(
    snapshotInput,
    snapshotPath,
  );
  const rawByPath = indexExactConditionPaths(
    rawProperties,
    snapshotPath,
    "raw",
  );
  const emittedByPath = indexExactConditionPaths(
    emittedOccurrences.map(({ manualPath, conditions }) => ({
      path: manualPath,
      conditions,
    })),
    snapshotPath,
    "extractor",
  );

  const rawOnly = [...rawByPath.keys()]
    .filter((conditionPath) => !emittedByPath.has(conditionPath))
    .sort(compareText);
  const extractorOnly = [...emittedByPath.keys()]
    .filter((conditionPath) => !rawByPath.has(conditionPath))
    .sort(compareText);
  if (rawOnly.length > 0 || extractorOnly.length > 0) {
    throw new Error(
      `Raw/extractor conditions path coverage mismatch for ${snapshotPath}: ` +
        `raw-only [${rawOnly.join(", ")}], extractor-only [${extractorOnly.join(", ")}].`,
    );
  }

  for (const [conditionPath, rawConditions] of rawByPath) {
    const emittedConditions = emittedByPath.get(conditionPath);
    if (stableJson(rawConditions) !== stableJson(emittedConditions)) {
      throw new Error(
        `Raw/extractor ordered conditions payload mismatch for ${snapshotPath}:${conditionPath}.`,
      );
    }
  }
}

interface ExactConditionPathEntry {
  path: string;
  conditions: readonly string[];
}

function collectRawConditionProperties(
  input: unknown,
  snapshotPath: string,
): ExactConditionPathEntry[] {
  const entries: ExactConditionPathEntry[] = [];
  const active = new WeakSet<object>();

  function visit(value: unknown, currentPath: string): void {
    if (value == null || typeof value !== "object") return;
    if (active.has(value)) {
      throw new Error(`Raw snapshot ${snapshotPath} contains an object cycle.`);
    }
    active.add(value);
    if (Array.isArray(value)) {
      value.forEach((nested, index) => {
        visit(nested, `${currentPath}[${index}]`);
      });
      active.delete(value);
      return;
    }

    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const nestedPath = appendObjectPath(currentPath, key);
      if (key === "conditions") {
        if (
          !Array.isArray(nested) ||
          !nested.every((condition) => typeof condition === "string")
        ) {
          throw new Error(
            `Raw conditions property ${snapshotPath}:${nestedPath} must be a string array.`,
          );
        }
        entries.push({ path: nestedPath, conditions: [...nested] });
      }
      visit(nested, nestedPath);
    }
    active.delete(value);
  }

  visit(input, "");
  return entries;
}

function indexExactConditionPaths(
  entries: readonly ExactConditionPathEntry[],
  snapshotPath: string,
  boundary: "raw" | "extractor",
): Map<string, readonly string[]> {
  const byPath = new Map<string, readonly string[]>();
  for (const entry of entries) {
    if (byPath.has(entry.path)) {
      throw new Error(
        `Duplicate ${boundary} conditions path ${snapshotPath}:${entry.path}.`,
      );
    }
    byPath.set(entry.path, entry.conditions);
  }
  return byPath;
}

function appendObjectPath(parent: string, key: string): string {
  const segment = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? key
    : `[${JSON.stringify(key)}]`;
  if (parent.length === 0 || segment.startsWith("[")) return `${parent}${segment}`;
  return `${parent}.${segment}`;
}

/** Compare all extracted arrays with their exact translated locations. */
export function verifyManualConditionRepositoryParity(
  occurrences: readonly ManualConditionArrayOccurrence[],
  repositoryInput: unknown,
): ManualConditionRepositoryParity {
  const repository = KnowledgeRepositorySchema.parse(repositoryInput);
  const rows = occurrences.map((occurrence) => {
    const matches = repository.records
      .map((record, recordIndex) => ({ record, recordIndex }))
      .filter(({ record }) => record.id === occurrence.repositoryRecordId);
    if (matches.length === 0) {
      return parityFailure(occurrence, "missing-record");
    }
    if (matches.length > 1) {
      return parityFailure(occurrence, "ambiguous-record");
    }

    const match = matches[0];
    if (!match) return parityFailure(occurrence, "missing-record");
    if (
      !match.record.sourceRefs.some(
        ({ sourceId, sourceRecordId }) =>
          sourceId === occurrence.sourceId &&
          sourceRecordId === occurrence.sourceRecordId,
      )
    ) {
      return parityFailure(occurrence, "source-reference-mismatch");
    }

    const repositoryJsonPath = `records[${match.recordIndex}].${occurrence.repositoryPath}`;
    const resolved = readSchemaPath(match.record, occurrence.repositoryPath);
    if (!resolved.found) {
      return parityFailure(
        occurrence,
        "missing-path",
        repositoryJsonPath,
      );
    }
    if (!isStringArray(resolved.value)) {
      return parityFailure(
        occurrence,
        "invalid-condition-array",
        repositoryJsonPath,
      );
    }

    const repositoryConditions = [...resolved.value];
    const repositoryConditionsSha256 = conditionArraySha256(
      repositoryConditions,
    );
    const exactOrderedArrayMatch =
      stableJson(repositoryConditions) === stableJson(occurrence.conditions);
    return {
      occurrenceId: occurrence.occurrenceId,
      status: exactOrderedArrayMatch ? "exact" : "ordered-array-mismatch",
      repositoryRecordId: occurrence.repositoryRecordId,
      repositoryJsonPath,
      manualConditionsSha256: occurrence.conditionsSha256,
      repositoryConditionsSha256,
      repositoryConditions,
      exactOrderedArrayMatch,
    } satisfies ManualConditionRepositoryParityRow;
  });

  const statusCounts = Object.fromEntries(
    [
      "exact",
      "missing-record",
      "ambiguous-record",
      "source-reference-mismatch",
      "missing-path",
      "invalid-condition-array",
      "ordered-array-mismatch",
    ].map((status) => [
      status,
      rows.filter((row) => row.status === status).length,
    ]),
  ) as Record<ManualConditionRepositoryParityStatus, number>;
  const exactMatchCount = statusCounts.exact;

  return {
    status: exactMatchCount === rows.length ? "exact" : "mismatch",
    occurrenceCount: rows.length,
    exactMatchCount,
    mismatchCount: rows.length - exactMatchCount,
    statusCounts,
    rows,
  };
}

export function buildManualConditionArrayCoverageCore(
  input: BuildManualConditionArrayCoverageCoreInput,
): ManualConditionArrayCoverageCore {
  const extraction = extractManualConditionOccurrences(
    input.manualIndexInput,
    input.manualSnapshotInputs,
  );
  return {
    extraction,
    repositoryParity: verifyManualConditionRepositoryParity(
      extraction.occurrences,
      input.repositoryInput,
    ),
  };
}

function extractRecordOccurrences(
  output: ManualConditionArrayOccurrence[],
  snapshotPath: string,
  sourceId: string,
  record: ManualObservationSnapshot["records"][number],
  recordIndex: number,
): void {
  if (record.kind === "character_guide") {
    extractRecommendationOccurrences(
      output,
      snapshotPath,
      sourceId,
      record,
      recordIndex,
      record.characterId,
      "recommendation",
    );
    return;
  }

  if (record.kind === "team") {
    record.members.forEach((member, memberIndex) => {
      extractRecommendationOccurrences(
        output,
        snapshotPath,
        sourceId,
        record,
        recordIndex,
        member.characterId,
        `members[${memberIndex}]`,
        member,
      );
    });
    record.artifactPlans?.forEach((plan, planIndex) => {
      addOccurrence(output, {
        snapshotPath,
        sourceId,
        record,
        recordIndex,
        subject: "team-level",
        claimAxis: "artifact-plan",
        claimPath: `artifactPlans[${planIndex}].conditions`,
        conditions: plan.conditions,
      });
    });
    return;
  }

  if (record.kind === "character_role") {
    record.members.forEach((member, memberIndex) => {
      addOccurrence(output, {
        snapshotPath,
        sourceId,
        record,
        recordIndex,
        subject: member.characterId,
        claimAxis: "character-role-member",
        claimPath: `members[${memberIndex}].conditions`,
        conditions: member.conditions,
      });
    });
    return;
  }

  if (record.kind === "rotation_fixture") return;

  if (record.kind === "energy_guidance") {
    record.targets.forEach((target, targetIndex) => {
      addOccurrence(output, {
        snapshotPath,
        sourceId,
        record,
        recordIndex,
        subject: record.characterId,
        claimAxis: "er-target",
        claimPath: `targets[${targetIndex}].conditions`,
        conditions: target.conditions,
      });
    });
  }
}

type RecommendationClaims = {
  weaponRecommendations?: Array<{ conditions: string[] }>;
  artifactRecommendations?: Array<{ conditions: string[] }>;
  mainStats?: Record<
    ManualConditionMainStatSlot,
    Array<{ conditions: string[] }>
  >;
  substats?: Array<{ conditions: string[] }>;
  erTargets?: Array<{ conditions: string[] }>;
};

function extractRecommendationOccurrences(
  output: ManualConditionArrayOccurrence[],
  snapshotPath: string,
  sourceId: string,
  record: Extract<
    ManualObservationSnapshot["records"][number],
    { kind: "character_guide" | "team" }
  >,
  recordIndex: number,
  subject: string,
  pathPrefix: string,
  recommendationInput?: RecommendationClaims,
): void {
  const recommendation =
    recommendationInput ??
    (record.kind === "character_guide" ? record.recommendation : undefined);
  if (recommendation == null) {
    throw new Error(
      `Missing recommendation claims for ${sourceId}:${record.sourceRecordId}.`,
    );
  }

  recommendation.weaponRecommendations?.forEach((claim, claimIndex) => {
    addOccurrence(output, {
      snapshotPath,
      sourceId,
      record,
      recordIndex,
      subject,
      claimAxis: "weapon-recommendation",
      claimPath: `${pathPrefix}.weaponRecommendations[${claimIndex}].conditions`,
      conditions: claim.conditions,
    });
  });
  recommendation.artifactRecommendations?.forEach((claim, claimIndex) => {
    addOccurrence(output, {
      snapshotPath,
      sourceId,
      record,
      recordIndex,
      subject,
      claimAxis: "artifact-recommendation",
      claimPath: `${pathPrefix}.artifactRecommendations[${claimIndex}].conditions`,
      conditions: claim.conditions,
    });
  });
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    recommendation.mainStats?.[slot].forEach((claim, claimIndex) => {
      addOccurrence(output, {
        snapshotPath,
        sourceId,
        record,
        recordIndex,
        subject,
        claimAxis: "main-stat",
        mainStatSlot: slot,
        claimPath: `${pathPrefix}.mainStats.${slot}[${claimIndex}].conditions`,
        conditions: claim.conditions,
      });
    });
  }
  recommendation.substats?.forEach((claim, claimIndex) => {
    addOccurrence(output, {
      snapshotPath,
      sourceId,
      record,
      recordIndex,
      subject,
      claimAxis: "substat",
      claimPath: `${pathPrefix}.substats[${claimIndex}].conditions`,
      conditions: claim.conditions,
    });
  });
  recommendation.erTargets?.forEach((claim, claimIndex) => {
    addOccurrence(output, {
      snapshotPath,
      sourceId,
      record,
      recordIndex,
      subject,
      claimAxis: "er-target",
      claimPath: `${pathPrefix}.erTargets[${claimIndex}].conditions`,
      conditions: claim.conditions,
    });
  });
}

interface AddOccurrenceInput {
  snapshotPath: string;
  sourceId: string;
  record: Exclude<
    ManualObservationSnapshot["records"][number],
    { kind: "team_template" | "rotation_fixture" }
  >;
  recordIndex: number;
  subject: string;
  claimAxis: ManualConditionClaimAxis;
  mainStatSlot?: ManualConditionMainStatSlot;
  claimPath: string;
  conditions: readonly string[];
}

function addOccurrence(
  output: ManualConditionArrayOccurrence[],
  input: AddOccurrenceInput,
): void {
  const repositoryPath = translateRepositoryPath(
    input.record.kind,
    input.claimPath,
  );
  const conditions = [...input.conditions];
  output.push({
    occurrenceId: `${input.sourceId}:${input.record.kind}:${input.record.sourceRecordId}:${input.claimPath}`,
    snapshotPath: input.snapshotPath,
    sourceId: input.sourceId,
    sourceRecordId: input.record.sourceRecordId,
    recordKind: input.record.kind,
    subject: input.subject,
    claimAxis: input.claimAxis,
    ...(input.mainStatSlot == null
      ? {}
      : { mainStatSlot: input.mainStatSlot }),
    structuralEnergyDimension:
      input.claimAxis === "er-target" ? "structural-er" : "not-structural-er",
    extraction: { ...input.record.extraction },
    manualPath: `records[${input.recordIndex}].${input.claimPath}`,
    manualClaimPath: input.claimPath,
    repositoryRecordId: repositoryRecordId(input.sourceId, input.record),
    repositoryPath,
    conditions,
    conditionsSha256: conditionArraySha256(conditions),
  });
}

function summarizeOccurrences(
  occurrences: readonly ManualConditionArrayOccurrence[],
  snapshotCount: number,
  manualRecordCount: number,
): ManualConditionExtractionSummary {
  return {
    snapshotCount,
    manualRecordCount,
    ...arrayStatistics(occurrences),
    byClaimAxis: Object.fromEntries(
      CLAIM_AXES.map((claimAxis) => [
        claimAxis,
        occurrences.filter((occurrence) => occurrence.claimAxis === claimAxis)
          .length,
      ]),
    ) as Record<ManualConditionClaimAxis, number>,
    structuralEr: arrayStatistics(
      occurrences.filter(
        ({ structuralEnergyDimension }) =>
          structuralEnergyDimension === "structural-er",
      ),
    ),
    notStructuralEnergy: arrayStatistics(
      occurrences.filter(
        ({ structuralEnergyDimension }) =>
          structuralEnergyDimension === "not-structural-er",
      ),
    ),
  };
}

function arrayStatistics(
  occurrences: readonly ManualConditionArrayOccurrence[],
): ManualConditionArrayStatistics {
  const arrays = occurrences.map(({ conditions }) => conditions);
  const strings = arrays.flat();
  return {
    occurrenceCount: arrays.length,
    emptyCount: arrays.filter((conditions) => conditions.length === 0).length,
    nonemptyCount: arrays.filter((conditions) => conditions.length > 0).length,
    uniqueOrderedArrayCount: new Set(
      arrays.filter((conditions) => conditions.length > 0).map(stableJson),
    ).size,
    stringOccurrenceCount: strings.length,
    uniqueStringCount: new Set(strings).size,
  };
}

function conditionArraySha256(conditions: readonly string[]): string {
  return sha256Text(stableJson(conditions));
}

function repositoryRecordId(
  sourceId: string,
  record: Exclude<
    ManualObservationSnapshot["records"][number],
    { kind: "team_template" | "rotation_fixture" }
  >,
): string {
  const kind =
    record.kind === "character_guide"
      ? "character-guide"
      : record.kind === "character_role"
        ? "character-role"
        : record.kind === "energy_guidance"
          ? "energy-guidance"
          : "team";
  return `${sourceId}:${kind}:${record.sourceRecordId}`;
}

function translateRepositoryPath(
  kind: ManualConditionArrayOccurrence["recordKind"],
  manualClaimPath: string,
): string {
  if (kind !== "character_guide") return manualClaimPath;
  const prefix = "recommendation.";
  if (!manualClaimPath.startsWith(prefix)) {
    throw new Error(
      `Character-guide condition path does not start with ${prefix}: ${manualClaimPath}.`,
    );
  }
  return `recommendations[0].${manualClaimPath.slice(prefix.length)}`;
}

function indexManualInputs(
  inputs: readonly ManualConditionSnapshotInput[],
): Map<string, ManualConditionSnapshotInput> {
  const byPath = new Map<string, ManualConditionSnapshotInput>();
  for (const input of inputs) {
    if (byPath.has(input.path)) {
      throw new Error(
        `Manual condition extraction received duplicate snapshot path ${input.path}.`,
      );
    }
    byPath.set(input.path, input);
  }
  return byPath;
}

function assertUniqueOccurrenceIds(
  occurrences: readonly ManualConditionArrayOccurrence[],
): void {
  const seen = new Set<string>();
  for (const occurrence of occurrences) {
    if (seen.has(occurrence.occurrenceId)) {
      throw new Error(
        `Manual condition occurrence ID is duplicated: ${occurrence.occurrenceId}.`,
      );
    }
    seen.add(occurrence.occurrenceId);
  }
}

function readSchemaPath(
  value: KnowledgeRecord,
  schemaPath: string,
): { found: boolean; value?: unknown } {
  const tokens = schemaPath.match(/[^.[\]]+|\d+/g);
  if (tokens == null || tokens.length === 0) return { found: false };
  let current: unknown = value;
  for (const token of tokens) {
    if (Array.isArray(current) && /^\d+$/.test(token)) {
      const index = Number(token);
      if (!(index in current)) return { found: false };
      current = current[index];
      continue;
    }
    if (
      current == null ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Object.hasOwn(current, token)
    ) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[token];
  }
  return { found: true, value: current };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function parityFailure(
  occurrence: ManualConditionArrayOccurrence,
  status: Exclude<ManualConditionRepositoryParityStatus, "exact">,
  repositoryJsonPath: string | null = null,
): ManualConditionRepositoryParityRow {
  return {
    occurrenceId: occurrence.occurrenceId,
    status,
    repositoryRecordId: occurrence.repositoryRecordId,
    repositoryJsonPath,
    manualConditionsSha256: occurrence.conditionsSha256,
    repositoryConditionsSha256: null,
    repositoryConditions: null,
    exactOrderedArrayMatch: false,
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
