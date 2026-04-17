import type { Team } from "@/stores/useTeamStore";
import {
  type BuffSource,
  type ComboFormula,
  type ComboLine,
  FINAL_STAT_KEYS,
  type StatKey,
} from "./types";

/** Build a deterministic cache key from a set of excluded buff keys. */
export function exclusionKey(excludeKeys: Set<string>): string {
  return [...excludeKeys].sort().join("|");
}

/** Canonical key for a BuffSource, used in BuffActivationMap and override store. */
export function buffSourceKey(source: BuffSource): string {
  const base = `${source.type}:${source.id}:${source.origin ?? ""}`;
  return source.internalKey ? `${base}:${source.internalKey}` : base;
}

export function isFinalStatKey(key: StatKey): boolean {
  return FINAL_STAT_KEYS.has(key);
}

const EMPTY_LABEL = { en: "", zh: "" } as const;

/**
 * Returns the `ComboFormula` that damage-calc consumers should use.
 *
 * - Single mode: synthesizes a 1-line combo from `team.selectedFormula` +
 *   `team.singleReaction`. If no formula is selected, returns an empty combo.
 * - Combo mode: returns `team.combos[team.selectedCombo]` with `count <= 0`
 *   lines filtered out.
 */
export function getEffectiveCombo(
  team: Pick<
    Team,
    | "formulaMode"
    | "selectedFormula"
    | "singleReaction"
    | "combos"
    | "selectedCombo"
  >
): ComboFormula {
  const mode = team.formulaMode ?? "single";

  if (mode === "single") {
    const sel = team.selectedFormula;
    if (!sel) {
      return { id: "__single_empty__", label: EMPTY_LABEL, lines: [] };
    }
    const line: ComboLine = {
      charId: sel.charId,
      formulaId: sel.formulaId,
      count: 1,
      reaction: team.singleReaction,
    };
    return { id: "__single__", label: EMPTY_LABEL, lines: [line] };
  }

  // combo mode
  const selected =
    (team.combos ?? []).find((c) => c.id === team.selectedCombo) ??
    team.combos?.[0];
  if (!selected) {
    return { id: "__combo_empty__", label: EMPTY_LABEL, lines: [] };
  }
  return {
    ...selected,
    lines: selected.lines.filter((l) => l.count > 0),
  };
}
