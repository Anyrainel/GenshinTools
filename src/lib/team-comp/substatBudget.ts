/** Preset substat roll totals per artifact slot (5★ count, then 4★). */
export type SubstatBudgetPreset = "8_6" | "8_7" | "9_7";

export const SUBSTAT_BUDGET_DEFAULT_PRESET: SubstatBudgetPreset = "8_6";

const PRESET_ROLLS: Record<
  SubstatBudgetPreset,
  { rolls5: number; rolls4: number }
> = {
  "8_6": { rolls5: 8, rolls4: 6 },
  "8_7": { rolls5: 8, rolls4: 7 },
  "9_7": { rolls5: 9, rolls4: 7 },
};

/** Max rolls on a single subline for a given per-slot total (4 sub lines + upgrades model). */
function maxRollsPerStatFromTotal(rollsPerSlot: number): number {
  return rollsPerSlot - 3;
}

export function rollsPerSlotForPreset(
  preset: SubstatBudgetPreset,
  rarity: 4 | 5
): number {
  const p = PRESET_ROLLS[preset];
  return rarity === 5 ? p.rolls5 : p.rolls4;
}

export function maxRollsPerStatForPreset(
  preset: SubstatBudgetPreset,
  rarity: 4 | 5
): number {
  return maxRollsPerStatFromTotal(rollsPerSlotForPreset(preset, rarity));
}

export function resolveSubstatBudgetPreset(
  fromOptions: SubstatBudgetPreset | undefined,
  calcContext: { idealSubstatBudget?: SubstatBudgetPreset }
): SubstatBudgetPreset {
  return (
    fromOptions ??
    calcContext.idealSubstatBudget ??
    SUBSTAT_BUDGET_DEFAULT_PRESET
  );
}
