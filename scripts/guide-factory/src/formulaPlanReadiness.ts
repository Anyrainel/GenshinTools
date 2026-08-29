import type {
  FormulaCountClaimComparison,
  FormulaPlanDraftOutput,
  SourceFormulaCountClaim,
} from "./formulaPlanDraft";

export interface UnresolvedFormulaMapping {
  characterId: string;
  sourceToken: string;
  calculatorFormulaId: string | null;
  reason: string;
}

export interface SourceAbsentFormulaMapping {
  characterId: string;
  formulaId: string;
  reason: string;
}

export type FormulaPlanReviewStatus = "unreviewed" | "reviewed";

export interface FormulaPlanReadinessBlocker {
  code:
    | "translation-unreviewed"
    | "range-count-claim"
    | "partial-token-mapping"
    | "unresolved-formula-mapping"
    | "unresolved-source-token"
    | "unclassified-formula";
  characterId?: string;
  formulaId?: string;
  sourceToken?: string;
  message: string;
}

export type FormulaInventoryCoverageRow = {
  characterId: string;
  formulaId: string;
  calculatorDefaultCount: number;
} & (
  | {
      classification: "mapped";
      sourceCountClaim: SourceFormulaCountClaim;
      sourceTokenCoverage: "complete" | "partial";
    }
  | {
      classification: "unresolved";
      sourceToken: string;
      reason: string;
    }
  | {
      classification: "source-absent";
      reason: string;
    }
  | { classification: "unclassified" }
);

export type PositiveDefaultCoverageRow = FormulaInventoryCoverageRow;

export interface FormulaPlanReadinessAssessment {
  schemaVersion: 1;
  classification: "formula-plan-readiness-assessment";
  supportsGuideClaims: false;
  sourceTeamRecordId: string;
  reviewStatus: FormulaPlanReviewStatus;
  readyForDamageReplay: boolean;
  availableFormulaCoverage: {
    total: number;
    mapped: number;
    unresolved: number;
    sourceAbsent: number;
    unclassified: number;
    rows: FormulaInventoryCoverageRow[];
  };
  positiveDefaultCoverage: {
    total: number;
    mapped: number;
    unresolved: number;
    sourceAbsent: number;
    unclassified: number;
    rows: PositiveDefaultCoverageRow[];
  };
  sourceMappingSummary: {
    comparisons: number;
    exactClaims: number;
    rangeClaims: number;
    completeTokenMappings: number;
    partialTokenMappings: number;
    unresolvedMappings: number;
    nonNullFormulaUnresolvedMappings: number;
    nullFormulaUnresolvedMappings: number;
    sourceAbsentMappings: number;
  };
  blockers: FormulaPlanReadinessBlocker[];
}

/**
 * Determine whether a source-authored formula translation is sufficiently
 * reviewed and scalar to drive a first damage replay.
 *
 * A reviewed exact source count may intentionally disagree with a calculator
 * default. Readiness is blocked by ambiguity or missing classification, not by
 * that discrepancy alone.
 */
export function assessFormulaPlanReadiness(
  draft: FormulaPlanDraftOutput,
  comparisons: readonly FormulaCountClaimComparison[],
  unresolvedMappings: readonly UnresolvedFormulaMapping[],
  sourceAbsentMappings: readonly SourceAbsentFormulaMapping[],
  reviewStatus: FormulaPlanReviewStatus,
): FormulaPlanReadinessAssessment {
  if (reviewStatus !== "unreviewed" && reviewStatus !== "reviewed") {
    throw new Error(`Invalid formula-plan review status ${String(reviewStatus)}.`);
  }

  const inventory = buildFormulaInventory(draft);
  const comparisonsByKey = indexComparisons(draft, comparisons, inventory);
  const unresolvedByKey = indexUnresolvedMappings(
    draft,
    unresolvedMappings,
    inventory,
  );
  const sourceAbsentByKey = indexSourceAbsentMappings(
    draft,
    sourceAbsentMappings,
    inventory,
  );
  for (const key of comparisonsByKey.keys()) {
    if (unresolvedByKey.has(key)) {
      const { characterId, formulaId } = parseKey(key);
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: ${characterId}.${formulaId} is both mapped and unresolved.`,
      );
    }
    if (sourceAbsentByKey.has(key)) {
      const { characterId, formulaId } = parseKey(key);
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: ${characterId}.${formulaId} is both mapped and source-absent.`,
      );
    }
  }
  for (const key of unresolvedByKey.keys()) {
    if (!sourceAbsentByKey.has(key)) continue;
    const { characterId, formulaId } = parseKey(key);
    throw new Error(
      `Formula-plan readiness ${draft.sourceTeamRecordId}: ${characterId}.${formulaId} is both unresolved and source-absent.`,
    );
  }

  const rows = [
    ...draft.lines,
    ...draft.zeroCountAvailableFormulas.map((line) => ({ ...line, count: 0 })),
  ]
    .map((line): FormulaInventoryCoverageRow => {
      const key = formulaKey(line.characterId, line.formulaId);
      const comparison = comparisonsByKey.get(key);
      if (comparison) {
        return {
          characterId: line.characterId,
          formulaId: line.formulaId,
          calculatorDefaultCount: line.count,
          classification: "mapped",
          sourceCountClaim: cloneCountClaim(comparison.sourceCountClaim),
          sourceTokenCoverage: comparison.sourceTokenCoverage,
        };
      }
      const unresolved = unresolvedByKey.get(key);
      if (unresolved) {
        return {
          characterId: line.characterId,
          formulaId: line.formulaId,
          calculatorDefaultCount: line.count,
          classification: "unresolved",
          sourceToken: unresolved.sourceToken,
          reason: unresolved.reason,
        };
      }
      const sourceAbsent = sourceAbsentByKey.get(key);
      if (sourceAbsent) {
        return {
          characterId: line.characterId,
          formulaId: line.formulaId,
          calculatorDefaultCount: line.count,
          classification: "source-absent",
          reason: sourceAbsent.reason,
        };
      }
      return {
        characterId: line.characterId,
        formulaId: line.formulaId,
        calculatorDefaultCount: line.count,
        classification: "unclassified",
      };
    })
    .sort(compareCoverageRows);

  const positiveRows: PositiveDefaultCoverageRow[] = rows.filter(
    (row) => row.calculatorDefaultCount > 0,
  );

  const blockers = buildBlockers(
    comparisons,
    unresolvedMappings,
    reviewStatus,
    rows,
  ).sort(compareBlockers);
  const mapped = positiveRows.filter(
    ({ classification }) => classification === "mapped",
  ).length;
  const unresolved = positiveRows.filter(
    ({ classification }) => classification === "unresolved",
  ).length;
  const sourceAbsent = positiveRows.filter(
    ({ classification }) => classification === "source-absent",
  ).length;
  const unclassified = positiveRows.filter(
    ({ classification }) => classification === "unclassified",
  ).length;

  return {
    schemaVersion: 1,
    classification: "formula-plan-readiness-assessment",
    supportsGuideClaims: false,
    sourceTeamRecordId: draft.sourceTeamRecordId,
    reviewStatus,
    readyForDamageReplay: blockers.length === 0,
    availableFormulaCoverage: {
      total: rows.length,
      mapped: rows.filter(({ classification }) => classification === "mapped")
        .length,
      unresolved: rows.filter(
        ({ classification }) => classification === "unresolved",
      ).length,
      sourceAbsent: rows.filter(
        ({ classification }) => classification === "source-absent",
      ).length,
      unclassified: rows.filter(
        ({ classification }) => classification === "unclassified",
      ).length,
      rows,
    },
    positiveDefaultCoverage: {
      total: positiveRows.length,
      mapped,
      unresolved,
      sourceAbsent,
      unclassified,
      rows: positiveRows,
    },
    sourceMappingSummary: {
      comparisons: comparisons.length,
      exactClaims: comparisons.filter(
        ({ sourceCountClaim }) => sourceCountClaim.type === "exact",
      ).length,
      rangeClaims: comparisons.filter(
        ({ sourceCountClaim }) => sourceCountClaim.type === "range",
      ).length,
      completeTokenMappings: comparisons.filter(
        ({ sourceTokenCoverage }) => sourceTokenCoverage === "complete",
      ).length,
      partialTokenMappings: comparisons.filter(
        ({ sourceTokenCoverage }) => sourceTokenCoverage === "partial",
      ).length,
      unresolvedMappings: unresolvedMappings.length,
      nonNullFormulaUnresolvedMappings: unresolvedMappings.filter(
        ({ calculatorFormulaId }) => calculatorFormulaId != null,
      ).length,
      nullFormulaUnresolvedMappings: unresolvedMappings.filter(
        ({ calculatorFormulaId }) => calculatorFormulaId == null,
      ).length,
      sourceAbsentMappings: sourceAbsentMappings.length,
    },
    blockers,
  };
}

function buildFormulaInventory(
  draft: FormulaPlanDraftOutput,
): Map<string, number> {
  const inventory = new Map<string, number>();
  for (const line of draft.lines) {
    if (!Number.isFinite(line.count) || line.count <= 0) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: positive default ${line.characterId}.${line.formulaId} must have a positive finite count.`,
      );
    }
    addInventoryFormula(
      draft.sourceTeamRecordId,
      inventory,
      line.characterId,
      line.formulaId,
      line.count,
    );
  }
  for (const line of draft.zeroCountAvailableFormulas) {
    addInventoryFormula(
      draft.sourceTeamRecordId,
      inventory,
      line.characterId,
      line.formulaId,
      0,
    );
  }
  return inventory;
}

function addInventoryFormula(
  teamId: string,
  inventory: Map<string, number>,
  characterId: string,
  formulaId: string,
  count: number,
): void {
  const key = formulaKey(characterId, formulaId);
  if (inventory.has(key)) {
    throw new Error(
      `Formula-plan readiness ${teamId}: draft formula inventory repeats ${characterId}.${formulaId}.`,
    );
  }
  inventory.set(key, count);
}

function indexComparisons(
  draft: FormulaPlanDraftOutput,
  comparisons: readonly FormulaCountClaimComparison[],
  inventory: ReadonlyMap<string, number>,
): Map<string, FormulaCountClaimComparison> {
  const indexed = new Map<string, FormulaCountClaimComparison>();
  for (const comparison of comparisons) {
    const key = formulaKey(comparison.characterId, comparison.formulaId);
    if (indexed.has(key)) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: duplicate comparison for ${comparison.characterId}.${comparison.formulaId}.`,
      );
    }
    const inventoryCount = inventory.get(key);
    if (inventoryCount == null) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: comparison references unknown draft formula ${comparison.characterId}.${comparison.formulaId}.`,
      );
    }
    if (comparison.calculatorDefaultCount !== inventoryCount) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: comparison default for ${comparison.characterId}.${comparison.formulaId} is ${comparison.calculatorDefaultCount}, but the draft inventory contains ${inventoryCount}.`,
      );
    }
    indexed.set(key, comparison);
  }
  return indexed;
}

function indexUnresolvedMappings(
  draft: FormulaPlanDraftOutput,
  unresolvedMappings: readonly UnresolvedFormulaMapping[],
  inventory: ReadonlyMap<string, number>,
): Map<string, UnresolvedFormulaMapping> {
  const indexed = new Map<string, UnresolvedFormulaMapping>();
  for (const unresolved of unresolvedMappings) {
    if (unresolved.calculatorFormulaId == null) continue;
    const key = formulaKey(
      unresolved.characterId,
      unresolved.calculatorFormulaId,
    );
    if (indexed.has(key)) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: duplicate unresolved formula ${unresolved.characterId}.${unresolved.calculatorFormulaId}.`,
      );
    }
    if (!inventory.has(key)) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: unresolved mapping references unknown draft formula ${unresolved.characterId}.${unresolved.calculatorFormulaId}.`,
      );
    }
    indexed.set(key, unresolved);
  }
  return indexed;
}

function indexSourceAbsentMappings(
  draft: FormulaPlanDraftOutput,
  sourceAbsentMappings: readonly SourceAbsentFormulaMapping[],
  inventory: ReadonlyMap<string, number>,
): Map<string, SourceAbsentFormulaMapping> {
  const indexed = new Map<string, SourceAbsentFormulaMapping>();
  for (const sourceAbsent of sourceAbsentMappings) {
    if (!sourceAbsent.reason.trim()) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: source-absent formula ${sourceAbsent.characterId}.${sourceAbsent.formulaId} requires a reason.`,
      );
    }
    const key = formulaKey(sourceAbsent.characterId, sourceAbsent.formulaId);
    if (indexed.has(key)) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: duplicate source-absent formula ${sourceAbsent.characterId}.${sourceAbsent.formulaId}.`,
      );
    }
    const inventoryCount = inventory.get(key);
    if (inventoryCount == null) {
      throw new Error(
        `Formula-plan readiness ${draft.sourceTeamRecordId}: source-absent mapping references unknown draft formula ${sourceAbsent.characterId}.${sourceAbsent.formulaId}.`,
      );
    }
    indexed.set(key, sourceAbsent);
  }
  return indexed;
}

function buildBlockers(
  comparisons: readonly FormulaCountClaimComparison[],
  unresolvedMappings: readonly UnresolvedFormulaMapping[],
  reviewStatus: FormulaPlanReviewStatus,
  rows: readonly FormulaInventoryCoverageRow[],
): FormulaPlanReadinessBlocker[] {
  const blockers: FormulaPlanReadinessBlocker[] = [];
  if (reviewStatus === "unreviewed") {
    blockers.push({
      code: "translation-unreviewed",
      message: "The source-to-formula translation has not been reviewed.",
    });
  }
  for (const comparison of comparisons) {
    if (comparison.sourceCountClaim.type === "range") {
      blockers.push({
        code: "range-count-claim",
        characterId: comparison.characterId,
        formulaId: comparison.formulaId,
        message:
          `Source count for ${comparison.characterId}.${comparison.formulaId} is a range; ` +
          "the current damage replay requires one reviewed scalar count.",
      });
    }
    if (comparison.sourceTokenCoverage === "partial") {
      blockers.push({
        code: "partial-token-mapping",
        characterId: comparison.characterId,
        formulaId: comparison.formulaId,
        message: `Source token mapping for ${comparison.characterId}.${comparison.formulaId} is partial.`,
      });
    }
  }
  for (const unresolved of unresolvedMappings) {
    blockers.push({
      code:
        unresolved.calculatorFormulaId == null
          ? "unresolved-source-token"
          : "unresolved-formula-mapping",
      characterId: unresolved.characterId,
      ...(unresolved.calculatorFormulaId == null
        ? {}
        : { formulaId: unresolved.calculatorFormulaId }),
      sourceToken: unresolved.sourceToken,
      message:
        unresolved.calculatorFormulaId == null
          ? `Source token ${unresolved.characterId}:${unresolved.sourceToken} has no resolved calculator formula: ${unresolved.reason}`
          : `Mapping for ${unresolved.characterId}.${unresolved.calculatorFormulaId} remains unresolved: ${unresolved.reason}`,
    });
  }
  for (const row of rows) {
    if (row.classification !== "unclassified") continue;
    blockers.push({
      code: "unclassified-formula",
      characterId: row.characterId,
      formulaId: row.formulaId,
      message:
        `Calculator formula ${row.characterId}.${row.formulaId} (default ${row.calculatorDefaultCount}) has no ` +
        "source mapping, explicit unresolved mapping, or explicit source-absence classification.",
    });
  }
  return blockers;
}

function cloneCountClaim(claim: SourceFormulaCountClaim): SourceFormulaCountClaim {
  return claim.type === "exact"
    ? { type: "exact", value: claim.value }
    : { type: "range", minimum: claim.minimum, maximum: claim.maximum };
}

function compareCoverageRows(
  left: FormulaInventoryCoverageRow,
  right: FormulaInventoryCoverageRow,
): number {
  return (
    compareText(left.characterId, right.characterId) ||
    compareText(left.formulaId, right.formulaId)
  );
}

function compareBlockers(
  left: FormulaPlanReadinessBlocker,
  right: FormulaPlanReadinessBlocker,
): number {
  return (
    blockerOrder(left.code) - blockerOrder(right.code) ||
    compareText(left.characterId ?? "", right.characterId ?? "") ||
    compareText(left.formulaId ?? "", right.formulaId ?? "") ||
    compareText(left.sourceToken ?? "", right.sourceToken ?? "") ||
    compareText(left.message, right.message)
  );
}

function blockerOrder(code: FormulaPlanReadinessBlocker["code"]): number {
  return [
    "translation-unreviewed",
    "range-count-claim",
    "partial-token-mapping",
    "unresolved-formula-mapping",
    "unresolved-source-token",
    "unclassified-formula",
  ].indexOf(code);
}

function formulaKey(characterId: string, formulaId: string): string {
  return `${characterId}\0${formulaId}`;
}

function parseKey(key: string): { characterId: string; formulaId: string } {
  const separator = key.indexOf("\0");
  return {
    characterId: key.slice(0, separator),
    formulaId: key.slice(separator + 1),
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
