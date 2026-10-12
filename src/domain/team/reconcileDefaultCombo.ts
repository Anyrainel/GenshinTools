import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { ComboFormula } from "@/domain/combat/damage/types";

/** Refresh only confidently default-filled member counts after a C change.
 * Existing stores have no count provenance, so exact equality with the former
 * catalog defaults is the conservative migration-free identification rule.
 */
export function reconcileDefaultCombo(
  combo: ComboFormula,
  previous: TeamBuild,
  next: TeamBuild,
  changedCharacters: ReadonlySet<string>
): ComboFormula {
  let lines = combo.lines;
  for (const charId of changedCharacters) {
    const oldDefaults = Object.fromEntries(
      Object.entries(previous.catalog.getCombo(charId)).filter(
        ([, count]) => count > 0
      )
    );
    const authored = new Map<string, number>();
    let hasSplitFormula = false;
    for (const line of lines)
      if (line.charId === charId && line.count > 0) {
        if (authored.has(line.formulaId)) hasSplitFormula = true;
        authored.set(
          line.formulaId,
          (authored.get(line.formulaId) ?? 0) + line.count
        );
      }
    if (
      hasSplitFormula ||
      authored.size !== Object.keys(oldDefaults).length ||
      [...authored].some(([id, count]) => oldDefaults[id] !== count)
    )
      continue;
    const originalLines = lines.filter((line) => line.charId === charId);
    const replacement = Object.entries(next.catalog.getCombo(charId))
      .filter(([, count]) => count > 0)
      .map(([formulaId, count]) => {
        const existing = originalLines.find(
          (line) => line.formulaId === formulaId
        );
        return existing ? { ...existing, count } : { charId, formulaId, count };
      });
    const firstIndex = lines.findIndex((line) => line.charId === charId);
    const others = lines.filter((line) => line.charId !== charId);
    others.splice(
      firstIndex < 0 ? others.length : Math.min(firstIndex, others.length),
      0,
      ...replacement
    );
    lines = others;
  }
  return lines === combo.lines ? combo : { ...combo, lines };
}
