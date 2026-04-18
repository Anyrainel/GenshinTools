import type {
  ComboFormula,
  ComboLine,
  ComboTemplate,
  FormulaOverride,
  I18nLabel,
  ReactionType,
} from "../types";
import type { TeamBuild } from "./teamBuild";

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

// ─── Shared combo management helpers ─────────────────────────────────────────
// Used by DamageDetail and WeaponChoiceDetail to avoid duplicating combo logic.

type FormulaListEntry = {
  charId: string;
  formulaId: string;
  label: I18nLabel;
};

/** Collect all formulas (character + reaction) into a flat list. */
export function collectAllFormulas(
  validCharIds: string[],
  availableFormulas: Record<string, Record<string, I18nLabel>>,
  teamBuild: TeamBuild | null
): FormulaListEntry[] {
  const list: FormulaListEntry[] = [];
  for (const charId of validCharIds) {
    const charFormulas = availableFormulas[charId];
    if (charFormulas) {
      for (const [formulaId, label] of Object.entries(charFormulas)) {
        list.push({ charId, formulaId, label });
      }
    }
  }
  if (teamBuild) {
    const rxFormulas = teamBuild.getReactionFormulaIds();
    for (const [formulaId, label] of Object.entries(rxFormulas)) {
      const eligible =
        teamBuild.reactionProvider.getEligibleCharacters(formulaId);
      for (const charId of eligible) {
        list.push({ charId, formulaId, label });
      }
    }
  }
  return list;
}

/** Build a lookup map from combo line key → { lineIndex, line }. */
export function buildComboLineMap(
  lines: ComboLine[]
): Map<string, { lineIndex: number; line: ComboLine }> {
  const map = new Map<string, { lineIndex: number; line: ComboLine }>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rxn = line.reaction?.reaction ?? "none";
    map.set(`${line.charId}.${line.formulaId}.${rxn}`, {
      lineIndex: i,
      line,
    });
  }
  return map;
}

/** Resolve the active combo from stored combos or build a default from teamBuild. */
export function resolveActiveCombo(
  combos: ComboFormula[],
  selectedCombo: string | undefined,
  teamBuild: TeamBuild | null,
  characters: (string | null)[],
  includeRxComboLines = false
): ComboFormula {
  const selected = combos.find((c) => c.id === selectedCombo) ?? combos[0];
  if (selected) return selected;
  const lines: ComboLine[] = [];
  if (teamBuild) {
    for (const charId of characters) {
      if (!charId) continue;
      const comboData: Record<string, number> = teamBuild.getCombo(charId);
      for (const [formulaId, count] of Object.entries(comboData)) {
        if (count > 0) lines.push({ charId, formulaId, count });
      }
    }
    if (includeRxComboLines) {
      lines.push(...teamBuild.getReactionComboLines());
    }
  }
  return {
    id: `combo-${Date.now()}`,
    label: { en: "Rotation", zh: "循环" },
    lines,
  };
}

/** Return a new combo with a line's count updated, pruning when ≤ 0 or adding when new. */
export function withLineCount(
  combo: ComboFormula,
  lineMap: Map<string, { lineIndex: number; line: ComboLine }>,
  charId: string,
  formulaId: string,
  reaction: string,
  count: number
): ComboFormula {
  const key = `${charId}.${formulaId}.${reaction}`;
  const existing = lineMap.get(key);
  if (existing) {
    if (count <= 0) {
      return {
        ...combo,
        lines: combo.lines.filter((_, i) => i !== existing.lineIndex),
      };
    }
    return {
      ...combo,
      lines: combo.lines.map((l, i) =>
        i === existing.lineIndex ? { ...l, count } : l
      ),
    };
  }
  if (count > 0) {
    return {
      ...combo,
      lines: [
        ...combo.lines,
        {
          charId,
          formulaId,
          count,
          reaction:
            reaction === "none"
              ? undefined
              : { reaction: reaction as ReactionType },
        },
      ],
    };
  }
  return combo;
}

/** Return a new combo with a reaction override applied to a specific line. */
export function withReactionOverride(
  combo: ComboFormula,
  lineMap: Map<string, { lineIndex: number; line: ComboLine }>,
  charId: string,
  formulaId: string,
  reaction: string,
  override: FormulaOverride
): ComboFormula {
  const key = `${charId}.${formulaId}.${reaction}`;
  const existing = lineMap.get(key);
  if (!existing) return combo;
  return {
    ...combo,
    lines: combo.lines.map((l, i) =>
      i === existing.lineIndex ? { ...l, reaction: override } : l
    ),
  };
}

/** Build the team store patch for selecting a single formula + reaction. */
export function buildSingleFormulaSelection(
  charId: string,
  formulaId: string,
  reaction: string,
  currentFormula: { charId: string; formulaId: string } | undefined,
  currentReaction: FormulaOverride | undefined
): {
  selectedFormula: { charId: string; formulaId: string };
  singleReaction: FormulaOverride | undefined;
} {
  const sameFormula =
    currentFormula?.charId === charId &&
    currentFormula?.formulaId === formulaId;
  const prevReaction = sameFormula ? currentReaction : undefined;
  const newReaction: FormulaOverride | undefined =
    reaction === "none"
      ? undefined
      : { ...prevReaction, reaction: reaction as ReactionType };
  return {
    selectedFormula: { charId, formulaId },
    singleReaction: newReaction,
  };
}
