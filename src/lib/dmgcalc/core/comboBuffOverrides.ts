/**
 * Combo-level buff activation helpers.
 *
 * Handles combo-wide default activation distribution, user override extraction
 * from the flat store format, and per-formula aggregation for drill-down UIs.
 */

import { distributeComboHits } from "@/lib/dmgcalc/core/stackRank";
import type {
  CalcContext,
  ComboFormula,
  ComboLine,
  DisplayResult,
} from "../types";
import type { BuffActivationMap } from "../types";
import type { StatSheet } from "./statSheet";
import type { TeamBuild } from "./teamBuild";

/**
 * Compute combo-mode DisplayResult for a rotation.
 * Filters to active lines and returns null when inputs are missing.
 * The returned DisplayResult includes per-formula display parts, lineDamages, etc.
 */
export function calcComboResults(
  build: TeamBuild | null,
  combo: ComboFormula,
  sheets: Record<string, StatSheet>,
  context: CalcContext,
  buffOverrides?: Record<number, BuffActivationMap>
): DisplayResult | null {
  if (!build) return null;
  const activeLines = combo.lines.filter((l) => l.count > 0);
  if (activeLines.length === 0) return null;
  const activeCombo = { ...combo, lines: activeLines };
  return build.getComboDisplayResult(
    activeCombo,
    sheets,
    context,
    buffOverrides
  );
}

/**
 * Build per-line BuffActivationMap for a combo rotation.
 *
 * Computes combo-wide default activation (sharing the maxStack budget across
 * ALL lines), then merges user overrides on top. This ensures stack-limited
 * buffs are correctly distributed across the entire rotation rather than each
 * formula receiving the full budget independently.
 *
 * @param activeLines - The active combo lines (count > 0, formula exists)
 * @param build - The TeamBuild for stat resolution
 * @param sheets - Artifact stat sheets per character
 * @param ctx - Calc context
 * @param comboOverrides - User overrides from the buff override store (optional)
 */
export function buildBuffOverrides(
  activeLines: ComboLine[],
  build: TeamBuild,
  sheets: Record<string, StatSheet>,
  ctx: CalcContext,
  comboOverrides?: Record<string, BuffActivationMap>
): Record<number, BuffActivationMap> | undefined {
  // ── Distribute user overrides across lines ──
  const perLineUserOverrides = new Map<number, BuffActivationMap>();

  if (comboOverrides) {
    // Group active lines by formula key, preserving line index
    const formulaLineIndices = new Map<string, number[]>();
    for (let i = 0; i < activeLines.length; i++) {
      const line = activeLines[i];
      const fKey = `${line.charId}.${line.formulaId}`;
      const arr = formulaLineIndices.get(fKey) ?? [];
      arr.push(i);
      formulaLineIndices.set(fKey, arr);
    }

    for (const [formulaKey, comboActivation] of Object.entries(
      comboOverrides
    )) {
      const lineIndices = formulaLineIndices.get(formulaKey);
      if (!lineIndices || lineIndices.length === 0) continue;

      const lineCounts = lineIndices.map((i) => activeLines[i].count);
      const [charId, formulaId] = formulaKey.split(".");
      const entry = build.catalog.formulaIndex.get(formulaId);
      if (!entry) continue;

      for (const [buffKey, partMap] of Object.entries(comboActivation)) {
        for (const [partIdxStr, totalActivated] of Object.entries(partMap)) {
          const partIdx = Number(partIdxStr);
          const partHits = entry.parts[partIdx]?.hits ?? 1;
          const distributed = distributeComboHits(
            totalActivated,
            partHits,
            lineCounts
          );
          for (let j = 0; j < lineIndices.length; j++) {
            const lineIdx = lineIndices[j];
            const lineCount = lineCounts[j];
            if (lineCount === 0) continue;
            const perCast = distributed[j] / lineCount;
            let lineMap = perLineUserOverrides.get(lineIdx);
            if (!lineMap) {
              lineMap = {};
              perLineUserOverrides.set(lineIdx, lineMap);
            }
            if (!lineMap[buffKey]) lineMap[buffKey] = {};
            lineMap[buffKey][partIdx] = perCast;
          }
        }
      }
    }
  }

  // Delegate to TeamBuild which handles stat resolution, combo-wide default
  // activation, and merging with user overrides.
  return build.computeComboPartialBuffSpecs(
    activeLines,
    sheets,
    ctx,
    undefined,
    perLineUserOverrides.size > 0 ? perLineUserOverrides : undefined
  );
}

/**
 * Extract per-formula user overrides from the flat combo override store
 * for a given combo ID.
 *
 * Store keys have format "combo:{comboId}:{charId}.{formulaId}".
 * Returns a map of formulaKey → BuffActivationMap, suitable for passing
 * to buildBuffOverrides as `comboOverrides`.
 */
export function extractComboOverrides(
  storeOverrides: Record<string, BuffActivationMap>,
  comboId: string
): Record<string, BuffActivationMap> | undefined {
  const prefix = `combo:${comboId}:`;
  const result: Record<string, BuffActivationMap> = {};
  for (const key of Object.keys(storeOverrides)) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = storeOverrides[key];
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Aggregate per-line per-cast combo defaults into a single per-formula
 * combo-total BuffActivationMap.
 *
 * For each combo line matching `charId`/`formulaId`, sums:
 *   comboTotal[bKey][partIdx] += perCast * line.count
 *
 * The result is suitable for the drill-down dialog's default activation
 * (where slider values represent the total across the entire combo).
 */
export function aggregateComboFormulaDefaults(
  activeLines: ComboLine[],
  perLine: BuffActivationMap[],
  charId: string,
  formulaId: string
): BuffActivationMap {
  const result: BuffActivationMap = {};

  for (let i = 0; i < activeLines.length; i++) {
    const line = activeLines[i];
    if (line.charId !== charId || line.formulaId !== formulaId) continue;

    const lineMap = perLine[i];
    if (!lineMap) continue;

    for (const [bKey, partMap] of Object.entries(lineMap)) {
      if (!result[bKey]) result[bKey] = {};
      for (const [pidxStr, perCast] of Object.entries(partMap)) {
        const pidx = Number(pidxStr);
        result[bKey][pidx] = (result[bKey][pidx] ?? 0) + perCast * line.count;
      }
    }
  }

  return result;
}
