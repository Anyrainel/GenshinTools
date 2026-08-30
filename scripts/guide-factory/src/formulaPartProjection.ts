import type { TeamFormulaCatalog } from "@/lib/dmgcalc/core/teamFormulaCatalog";
import type { FormulaEntry } from "@/lib/dmgcalc/types";

export interface FormulaPartProjectionPart {
  sourcePartIndex: number;
  hits: number;
  semanticLabel: string;
}

export interface FormulaPartProjectionSpec {
  formulaId: string;
  ownerCharId: string;
  expectedOriginalPartCount: number;
  projectedParts: readonly FormulaPartProjectionPart[];
}

export interface FormulaPartProjectionObservation {
  formulaId: string;
  ownerCharId: string;
  originalPartCount: number;
  projectedPartCount: number;
  projectedParts: FormulaPartProjectionPart[];
  omittedSourcePartIndexes: number[];
  originalEntryOwner: string;
  formulaRemainedDiscoverable: true;
}

export interface ScopedFormulaPartProjectionResult<T> {
  value: T;
  observation: FormulaPartProjectionObservation;
  restoration: {
    originalEntryIdentityRestored: true;
    formulaIndexSizeRestored: true;
    formulaIndexOrderAndEntryIdentitiesRestored: true;
  };
}

/**
 * Temporarily replace one formula entry in one TeamBuild-owned catalog with an
 * exact subset/repetition projection of its existing parts.
 *
 * The formula ID is intentionally retained so both the interpreted and
 * compiled combo evaluators continue to admit the line through their existing
 * formula-availability checks. The original entry is restored in a `finally`
 * block, including when the operation rejects or throws.
 */
export async function withScopedFormulaPartProjection<T>(
  catalog: TeamFormulaCatalog,
  spec: FormulaPartProjectionSpec,
  operation: (
    projectedEntry: FormulaEntry,
    observation: FormulaPartProjectionObservation,
  ) => T | Promise<T>,
): Promise<ScopedFormulaPartProjectionResult<T>> {
  const originalEntry = catalog.formulaIndex.get(spec.formulaId);
  if (!originalEntry) {
    throw new Error(`Formula projection cannot find ${spec.formulaId}.`);
  }
  authenticateProjectionSpec(catalog, originalEntry, spec);

  const projectedEntry: FormulaEntry = {
    ...originalEntry,
    label: { ...originalEntry.label },
    parts: spec.projectedParts.map(({ sourcePartIndex, hits }) => ({
      ...originalEntry.parts[sourcePartIndex],
      hits,
    })),
  };
  const projectedIndexSet = new Set(
    spec.projectedParts.map(({ sourcePartIndex }) => sourcePartIndex),
  );
  const observation: FormulaPartProjectionObservation = {
    formulaId: spec.formulaId,
    ownerCharId: spec.ownerCharId,
    originalPartCount: originalEntry.parts.length,
    projectedPartCount: projectedEntry.parts.length,
    projectedParts: spec.projectedParts.map((part) => ({ ...part })),
    omittedSourcePartIndexes: originalEntry.parts
      .map((_, sourcePartIndex) => sourcePartIndex)
      .filter((sourcePartIndex) => !projectedIndexSet.has(sourcePartIndex)),
    originalEntryOwner: originalEntry.owner!,
    formulaRemainedDiscoverable: true,
  };
  const originalIndexEntries = [...catalog.formulaIndex.entries()];

  catalog.formulaIndex.set(spec.formulaId, projectedEntry);
  let value: T;
  try {
    if (catalog.formulaIndex.get(spec.formulaId) !== projectedEntry) {
      throw new Error(
        `Formula projection failed to install ${spec.formulaId} in the scoped catalog.`,
      );
    }
    const available = catalog.getFormulaIds();
    if (!available[spec.ownerCharId]?.[spec.formulaId]) {
      throw new Error(
        `Projected formula ${spec.ownerCharId}.${spec.formulaId} is no longer discoverable.`,
      );
    }
    value = await operation(projectedEntry, observation);
  } finally {
    catalog.formulaIndex.clear();
    for (const [formulaId, entry] of originalIndexEntries) {
      catalog.formulaIndex.set(formulaId, entry);
    }
  }

  if (catalog.formulaIndex.get(spec.formulaId) !== originalEntry) {
    throw new Error(
      `Formula projection failed to restore ${spec.formulaId} by object identity.`,
    );
  }
  if (catalog.formulaIndex.size !== originalIndexEntries.length) {
    throw new Error(
      `Formula projection changed the catalog size for ${spec.formulaId}.`,
    );
  }
  const restoredEntries = [...catalog.formulaIndex.entries()];
  if (
    restoredEntries.some(
      ([formulaId, entry], index) =>
        formulaId !== originalIndexEntries[index]?.[0] ||
        entry !== originalIndexEntries[index]?.[1],
    )
  ) {
    throw new Error(
      `Formula projection failed to restore catalog order and entry identities for ${spec.formulaId}.`,
    );
  }

  return {
    value,
    observation,
    restoration: {
      originalEntryIdentityRestored: true,
      formulaIndexSizeRestored: true,
      formulaIndexOrderAndEntryIdentitiesRestored: true,
    },
  };
}

function authenticateProjectionSpec(
  catalog: TeamFormulaCatalog,
  originalEntry: FormulaEntry,
  spec: FormulaPartProjectionSpec,
): void {
  if (!spec.formulaId || !spec.ownerCharId) {
    throw new Error("Formula projection requires formula and owner IDs.");
  }
  if (
    !Number.isInteger(spec.expectedOriginalPartCount) ||
    spec.expectedOriginalPartCount <= 0 ||
    originalEntry.parts.length !== spec.expectedOriginalPartCount
  ) {
    throw new Error(
      `Formula projection expected ${spec.expectedOriginalPartCount} source parts for ${spec.formulaId}, found ${originalEntry.parts.length}.`,
    );
  }
  if (originalEntry.owner !== spec.ownerCharId) {
    throw new Error(
      `Formula projection expected owner ${spec.ownerCharId} for ${spec.formulaId}, found ${originalEntry.owner ?? "missing"}.`,
    );
  }
  if (!catalog.getFormulaIds()[spec.ownerCharId]?.[spec.formulaId]) {
    throw new Error(
      `Formula projection expected ${spec.ownerCharId}.${spec.formulaId} to be discoverable before projection.`,
    );
  }
  if (spec.projectedParts.length === 0) {
    throw new Error("Formula projection must retain at least one source part.");
  }

  let previousSourcePartIndex = -1;
  const labels = new Set<string>();
  for (const part of spec.projectedParts) {
    if (
      !Number.isInteger(part.sourcePartIndex) ||
      part.sourcePartIndex < 0 ||
      part.sourcePartIndex >= originalEntry.parts.length
    ) {
      throw new Error(
        `Formula projection source part index ${part.sourcePartIndex} is out of range for ${spec.formulaId}.`,
      );
    }
    if (part.sourcePartIndex <= previousSourcePartIndex) {
      throw new Error(
        "Formula projection source part indexes must be unique and strictly increasing.",
      );
    }
    if (!Number.isInteger(part.hits) || part.hits <= 0) {
      throw new Error(
        `Formula projection hit count ${part.hits} must be a positive integer.`,
      );
    }
    if (!part.semanticLabel.trim() || labels.has(part.semanticLabel)) {
      throw new Error(
        "Formula projection semantic labels must be non-empty and unique.",
      );
    }
    previousSourcePartIndex = part.sourcePartIndex;
    labels.add(part.semanticLabel);
  }
}
