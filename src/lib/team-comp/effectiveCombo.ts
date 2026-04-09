/**
 * Projection helper that unifies single-formula mode and combo mode into a
 * single `ComboFormula` view for damage-calc consumers.
 *
 * Rationale: `team.singleReaction` / `team.selectedFormula` are UX draft state
 * for the single-tab formula picker. Every damage-calc consumer (optimizer,
 * generator, display result, analyzer templates, stat sheets, etc.) must see
 * the SAME `ComboFormula` regardless of which UI mode the user is in. Ad-hoc
 * synthesis in components has historically been a source of bugs (e.g. the
 * forceOnField on-field override silently dropped because a call site read
 * the raw `team.combos[selectedCombo]` instead of the synthesized combo).
 *
 * Usage rule: *writes* to single-tab state and *formula-picker reads* stay
 * direct (FormulaSelectorCard needs the split to remember draft state).
 * *damage-calc reads* must go through `getEffectiveCombo`.
 */
import type { Team } from "@/stores/useTeamStore";
import type { ComboFormula, ComboLine } from "./types";

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
