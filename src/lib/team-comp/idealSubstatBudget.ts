/** Preset substat roll totals per artifact slot (5★ count, then 4★). */
export type IdealSubstatBudgetPreset = "8_6" | "8_7" | "9_7";

export const IDEAL_SUBSTAT_BUDGET_DEFAULT_PRESET: IdealSubstatBudgetPreset =
  "8_6";

const PRESET_ROLLS: Record<
  IdealSubstatBudgetPreset,
  { rolls5: number; rolls4: number }
> = {
  "8_6": { rolls5: 8, rolls4: 6 },
  "8_7": { rolls5: 8, rolls4: 7 },
  "9_7": { rolls5: 9, rolls4: 7 },
};

/** Max rolls on a single subline for a given per-slot total (4 sub lines + upgrades model). */
export function maxRollsPerStatFromTotal(rollsPerSlot: number): number {
  return rollsPerSlot - 3;
}

export function rollsPerSlotForPreset(
  preset: IdealSubstatBudgetPreset,
  rarity: 4 | 5
): number {
  const p = PRESET_ROLLS[preset];
  return rarity === 5 ? p.rolls5 : p.rolls4;
}

export function maxRollsPerStatForPreset(
  preset: IdealSubstatBudgetPreset,
  rarity: 4 | 5
): number {
  return maxRollsPerStatFromTotal(rollsPerSlotForPreset(preset, rarity));
}

export function resolveIdealSubstatBudgetPreset(
  fromOptions: IdealSubstatBudgetPreset | undefined,
  calcContext: { idealSubstatBudget?: IdealSubstatBudgetPreset }
): IdealSubstatBudgetPreset {
  return (
    fromOptions ??
    calcContext.idealSubstatBudget ??
    IDEAL_SUBSTAT_BUDGET_DEFAULT_PRESET
  );
}
