import type { BuffActivationMap, ComboLine } from "@/lib/dmgcalc/types";
import type { TeamSetupConfig } from "@/lib/team-comp/types";

type LegacyFormulaUnit = {
  formulaId: string;
  legacyCount: number;
  currentCount: number;
};

const LEGACY_FORMULA_UNITS: readonly LegacyFormulaUnit[] = [
  { formulaId: "yae_miko-skill", legacyCount: 15, currentCount: 1 },
  { formulaId: "cyno-c6-bolts", legacyCount: 6, currentCount: 1 },
];

function migratedCount(formulaId: string, count: number): number | undefined {
  return LEGACY_FORMULA_UNITS.find(
    (unit) => unit.formulaId === formulaId && unit.legacyCount === count
  )?.currentCount;
}

function copyOverride(
  target: Record<number, BuffActivationMap>,
  index: number,
  value: BuffActivationMap | undefined
): void {
  if (value !== undefined) target[index] = value;
}

function migrateComboLines(
  lines: ComboLine[],
  buffOverrides: Record<number, BuffActivationMap> | undefined
): {
  lines: ComboLine[];
  buffOverrides: Record<number, BuffActivationMap> | undefined;
  changed: boolean;
} {
  const nextLines: ComboLine[] = [];
  const nextBuffOverrides: Record<number, BuffActivationMap> = {};
  let changed = false;

  for (const [oldIndex, line] of lines.entries()) {
    const nextCount = migratedCount(line.formulaId, line.count);
    if (nextCount !== undefined) {
      // These formulas changed from one hit/tick per entry to a full-rotation
      // aggregate under the same persisted ID. Per-line part overrides from the
      // old unit cannot be mapped safely to the new aggregate.
      nextLines.push({ ...line, count: nextCount });
      changed = true;
      continue;
    }

    if (line.formulaId === "kinich-cannon" && line.count === 4) {
      // The old entry represented all four cannons. It was later split into an
      // enhanced first cannon and three ordinary cannons without changing the
      // persisted ID of the ordinary entry.
      nextLines.push({ ...line, formulaId: "kinich-cannon-first", count: 1 });
      copyOverride(
        nextBuffOverrides,
        nextLines.length - 1,
        buffOverrides?.[oldIndex]
      );
      nextLines.push({ ...line, count: 3 });
      copyOverride(
        nextBuffOverrides,
        nextLines.length - 1,
        buffOverrides?.[oldIndex]
      );
      changed = true;
      continue;
    }

    nextLines.push(line);
    copyOverride(
      nextBuffOverrides,
      nextLines.length - 1,
      buffOverrides?.[oldIndex]
    );
  }

  if (!changed) return { lines, buffOverrides, changed: false };
  return {
    lines: nextLines,
    buffOverrides:
      Object.keys(nextBuffOverrides).length > 0 ? nextBuffOverrides : undefined,
    changed: true,
  };
}

function replaceFormulaIdInOverrideKey(
  key: string,
  oldFormulaId: string,
  newFormulaId: string
): string | undefined {
  const separator = key.lastIndexOf("|");
  if (separator < 0) return undefined;
  const lineKey = key.slice(separator + 1);
  if (lineKey !== oldFormulaId && !lineKey.startsWith(`${oldFormulaId}:`)) {
    return undefined;
  }
  return `${key.slice(0, separator + 1)}${newFormulaId}${lineKey.slice(oldFormulaId.length)}`;
}

function migrateComboOverrides(
  overrides: Record<string, number> | undefined
): Record<string, number> | undefined {
  if (!overrides) return overrides;
  const next = { ...overrides };
  let changed = false;

  for (const [key, count] of Object.entries(overrides)) {
    for (const unit of LEGACY_FORMULA_UNITS) {
      if (
        count === unit.legacyCount &&
        replaceFormulaIdInOverrideKey(key, unit.formulaId, unit.formulaId)
      ) {
        next[key] = unit.currentCount;
        changed = true;
      }
    }

    const firstCannonKey = replaceFormulaIdInOverrideKey(
      key,
      "kinich-cannon",
      "kinich-cannon-first"
    );
    if (count === 4 && firstCannonKey) {
      next[key] = 3;
      if (next[firstCannonKey] === undefined) next[firstCannonKey] = 1;
      changed = true;
    }
  }

  return changed ? next : overrides;
}

/**
 * Migrate formula IDs whose persisted combo count changed semantic units.
 * Exact legacy defaults are matched so authored counts in newer data survive.
 */
export function migrateLegacyFormulaUnitConfigs(
  configs: Record<string, TeamSetupConfig>
): Record<string, TeamSetupConfig> {
  let configsChanged = false;
  const nextConfigs: Record<string, TeamSetupConfig> = {};

  for (const [teamId, config] of Object.entries(configs)) {
    const combo = config.damage?.combo;
    const migratedCombo = combo
      ? migrateComboLines(combo.lines, combo.buffOverrides)
      : undefined;
    const comboOverrides = migrateComboOverrides(
      config.investment?.comboOverrides
    );
    const investmentChanged =
      comboOverrides !== config.investment?.comboOverrides;

    if (!migratedCombo?.changed && !investmentChanged) {
      nextConfigs[teamId] = config;
      continue;
    }

    configsChanged = true;
    nextConfigs[teamId] = {
      ...config,
      ...(migratedCombo?.changed
        ? {
            damage: {
              ...config.damage,
              combo: {
                ...combo!,
                lines: migratedCombo.lines,
                buffOverrides: migratedCombo.buffOverrides,
              },
            },
          }
        : {}),
      ...(investmentChanged
        ? {
            investment: {
              ...config.investment,
              comboOverrides,
            },
          }
        : {}),
    };
  }

  return configsChanged ? nextConfigs : configs;
}
