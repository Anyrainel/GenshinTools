import type {
  ComboFormula,
  ComboTemplate,
  FormulaOverride,
  ReactionType,
} from "../types";

/**
 * Resolve a ComboDescriptor into a flat { formulaId → count } map,
 * applying constellation-dependent bonuses.
 */

export function resolveComboDescriptor(
  descriptor: ComboTemplate,
  constellation: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of descriptor) {
    let count = entry.count;
    if (entry.bonus) {
      for (const b of entry.bonus) {
        if (constellation >= b.minC) count += b.delta;
      }
    }
    result[entry.id] = count;
  }
  return result;
}
/** Wrap a single formula into a 1-line ComboFormula. */

export function singleFormulaCombo(
  charId: string,
  formulaId: string,
  reaction?: FormulaOverride
): ComboFormula {
  return {
    id: "__single__",
    label: { zh: "", en: "" },
    lines: [{ charId, formulaId, count: 1, reaction }],
  };
}
/** Resolve the effective reaction for a formula part given overrides.
 *  Default behavior: ALL parts inherit the gate reaction (if element-eligible).
 *  Parts can be explicitly turned off via partReactions[idx] = "none".
 */

export function resolvePartReaction(
  override: FormulaOverride | undefined,
  partIndex: number,
  eligibleReactions: ReactionType[] | undefined
): ReactionType {
  // No override → no reaction
  if (!override?.reaction || override.reaction === "none") return "none";

  // Per-part override takes priority (used to disable specific parts)
  if (override.rxnParts?.[partIndex] != null)
    return override.rxnParts[partIndex];

  // Default: all parts inherit the gate if element-eligible
  if (eligibleReactions?.includes(override.reaction)) return override.reaction;

  // Element can't use this reaction at all
  return "none";
}
