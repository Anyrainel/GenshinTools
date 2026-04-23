/**
 * ExprStats: An Expr-returning analog of StatSheet.
 *
 * Wraps a baseline StatSheet (all pre-artifact stats) and a variable mapping
 * to return Expr nodes instead of numbers. Used by formula buildExpr() methods.
 *
 * For stats where the character has variable artifact contributions, returns
 * E.add(E.const(baseline), E.var(idx)). For fixed stats, returns E.const(value).
 */

import type { StatKey } from "@/data/enums";
import type { DamageTag, DamageTagFilter, FieldState } from "../types";
import { filterMatchesTag } from "../utils";
import { E, type Expr, simplify } from "./expr";
import {
  ELEMENTAL_DMG_KEY_TO_ELEMENT,
  MULTIPLICATIVE_KEYS,
  SCALED_PERCENT_KEYS,
  SCALED_STAT_BASES,
  appendFieldState,
  serializeFilter,
} from "./statSheet";
import { StatSheet } from "./statSheet";

// ─── Variable Mapping ───

/**
 * Maps (charIndex, statKey, filterKey) → Float64Array index.
 * The layout is: character 0's stats, then character 1's, etc.
 */
export class VarMapping {
  private readonly map = new Map<string, number>();
  private _totalVars = 0;

  /** Register a variable and return its index. If already registered, returns existing. */
  register(charIdx: number, statKey: StatKey, filterKey: string): number {
    const key = `${charIdx}:${statKey}:${filterKey}`;
    const existing = this.map.get(key);
    if (existing !== undefined) return existing;
    const idx = this._totalVars++;
    this.map.set(key, idx);
    return idx;
  }

  /** Get the variable index, or undefined if not registered. */
  getVarIdx(
    charIdx: number,
    statKey: StatKey,
    filterKey: string
  ): number | undefined {
    return this.map.get(`${charIdx}:${statKey}:${filterKey}`);
  }

  get totalVars(): number {
    return this._totalVars;
  }

  /** Iterate all registered variables. */
  *entries(): Iterable<{
    charIdx: number;
    statKey: StatKey;
    filterKey: string;
    varIdx: number;
  }> {
    for (const [key, varIdx] of this.map) {
      const [charIdxStr, statKey, filterKey] = key.split(":") as [
        string,
        StatKey,
        string,
      ];
      yield { charIdx: Number(charIdxStr), statKey, filterKey, varIdx };
    }
  }
}

/**
 * Expr-returning stat sheet analog. Mirrors StatSheet.get() and getRaw()
 * but returns Expr nodes, mixing constants and variables as appropriate.
 */
export class ExprStatSheet {
  constructor(
    /** Baseline StatSheet (everything except variable artifact contributions). */
    private readonly baseline: StatSheet,
    /** Variable mapping for this character's artifact stats. */
    private readonly charIdx: number,
    private readonly varMapping: VarMapping,
    /**
     * Set of (statKey:filterKey) pairs that have variable contributions.
     * Only these will produce E.var nodes; everything else is E.const.
     */
    private readonly variableKeys: Set<string>,
    /**
     * Expr-valued overrides from dynamic buffs (ScalingBuff/CrossScalingBuff).
     * These are added alongside baseline + variable contributions in get()/getRaw().
     */
    private readonly exprOverrides: {
      key: StatKey;
      filterKey: string;
      expr: Expr;
    }[] = []
  ) {}

  /** Like StatSheet.get() but returns Expr. */
  get(key: StatKey, tag: DamageTag | null): Expr {
    if (SCALED_PERCENT_KEYS.has(key)) {
      throw new Error(
        `ExprStats.get('${key}') not allowed — use getRaw('${key}')`
      );
    }

    // Scaled stats (ATK, HP, DEF): base × (1 + %) + flat
    const baseKey = (SCALED_STAT_BASES as Record<string, StatKey>)[key];
    if (baseKey) {
      const base = this.getUniversalExpr(baseKey);
      let pct = this.getUniversalExpr(`${key}%` as StatKey);
      let flat = this.getUniversalExpr(key);
      // Include tag-matching filtered contributions (e.g. Skirk C2: +70% ATK% for normal/charge)
      if (tag) {
        const pctKey = `${key}%` as StatKey;
        const taggedPctConst = this.getTaggedConstValue(pctKey, tag);
        const taggedPctVar = this.getTaggedVarExpr(pctKey, tag);
        const pctParts: Expr[] = [pct];
        if (taggedPctConst !== 0) pctParts.push(E.const(taggedPctConst));
        if (taggedPctVar) pctParts.push(taggedPctVar);
        for (const ov of this.exprOverrides) {
          if (ov.key !== pctKey || ov.filterKey === "") continue;
          const filter = StatSheet.parseFilterKey(ov.filterKey);
          if (filterMatchesTag(filter, tag)) pctParts.push(ov.expr);
        }
        if (pctParts.length > 1) pct = simplify(E.add(...pctParts));

        const taggedFlatConst = this.getTaggedConstValue(key, tag);
        const taggedFlatVar = this.getTaggedVarExpr(key, tag);
        const flatParts: Expr[] = [flat];
        if (taggedFlatConst !== 0) flatParts.push(E.const(taggedFlatConst));
        if (taggedFlatVar) flatParts.push(taggedFlatVar);
        for (const ov of this.exprOverrides) {
          if (ov.key !== key || ov.filterKey === "") continue;
          const filter = StatSheet.parseFilterKey(ov.filterKey);
          if (filterMatchesTag(filter, tag)) flatParts.push(ov.expr);
        }
        if (flatParts.length > 1) flat = simplify(E.add(...flatParts));
      }
      return simplify(E.add(E.mul(base, E.add(E.const(1), pct)), flat));
    }

    // Non-scaled stats: universal + matching tagged entries
    const universal = this.getUniversalExpr(key);

    if (!tag) return universal;

    if (MULTIPLICATIVE_KEYS.has(key)) {
      // Multiplicative semantics: each filterKey's contributions form a
      // factor (1+p), and the total is ∏(1+p)−1. Mirrors StatSheet.get().
      const factors: Expr[] = [E.add(E.const(1), universal)];
      // Group tagged baseline + variable + exprOverride contributions per filterKey
      const perFk = new Map<string, Expr[]>();
      for (const entry of this.baseline.dump()) {
        if (entry.key !== key || entry.filterKey === "") continue;
        const filter = StatSheet.parseFilterKey(entry.filterKey);
        if (!filterMatchesTag(filter, tag)) continue;
        const vKey = `${key}:${entry.filterKey}`;
        const arr = perFk.get(entry.filterKey) ?? [];
        if (this.variableKeys.has(vKey)) {
          const idx = this.varMapping.register(
            this.charIdx,
            key,
            entry.filterKey
          );
          arr.push(
            entry.value === 0
              ? E.var(idx, `${key}[${entry.filterKey}]`)
              : E.add(
                  E.const(entry.value),
                  E.var(idx, `${key}[${entry.filterKey}]`)
                )
          );
        } else {
          if (entry.value !== 0) arr.push(E.const(entry.value));
        }
        perFk.set(entry.filterKey, arr);
      }
      // Variable keys not in baseline
      for (const vKeyStr of this.variableKeys) {
        if (!vKeyStr.startsWith(`${key}:`)) continue;
        const fk = vKeyStr.slice(key.length + 1);
        if (fk === "") continue;
        if (perFk.has(fk)) continue;
        const filter = StatSheet.parseFilterKey(fk);
        if (!filterMatchesTag(filter, tag)) continue;
        const idx = this.varMapping.register(this.charIdx, key, fk);
        perFk.set(fk, [E.var(idx, `${key}[${fk}]`)]);
      }
      for (const ov of this.exprOverrides) {
        if (ov.key !== key || ov.filterKey === "") continue;
        const filter = StatSheet.parseFilterKey(ov.filterKey);
        if (!filterMatchesTag(filter, tag)) continue;
        const arr = perFk.get(ov.filterKey) ?? [];
        arr.push(ov.expr);
        perFk.set(ov.filterKey, arr);
      }
      for (const arr of perFk.values()) {
        if (arr.length === 0) continue;
        const sum = arr.length === 1 ? arr[0] : E.add(...arr);
        factors.push(E.add(E.const(1), sum));
      }
      if (factors.length === 1) return simplify(E.add(factors[0], E.const(-1)));
      return simplify(E.add(E.mul(...factors), E.const(-1)));
    }

    // Add tagged contributions from baseline
    const taggedConst = this.getTaggedConstValue(key, tag);

    // Add variable tagged contributions
    const varExpr = this.getTaggedVarExpr(key, tag);

    const parts: Expr[] = [universal];
    if (taggedConst !== 0) parts.push(E.const(taggedConst));
    if (varExpr) parts.push(varExpr);

    // Add filtered expr overrides that match the tag
    for (const ov of this.exprOverrides) {
      if (ov.key !== key || ov.filterKey === "") continue;
      const filter = StatSheet.parseFilterKey(ov.filterKey);
      if (filterMatchesTag(filter, tag)) {
        parts.push(ov.expr);
      }
    }

    if (parts.length === 1) return parts[0];
    return simplify(E.add(...parts));
  }

  /** Like StatSheet.getRaw() — universal only, no scaling. */
  getRaw(key: StatKey): Expr {
    return this.getUniversalExpr(key);
  }

  /** Get the universal (unfiltered) value as Expr. */
  private getUniversalExpr(key: StatKey): Expr {
    const baseVal = this.baseline.getRaw(key);
    const vKey = `${key}:`;

    const parts: Expr[] = [];
    if (baseVal !== 0) parts.push(E.const(baseVal));

    if (this.variableKeys.has(vKey)) {
      const idx = this.varMapping.register(this.charIdx, key, "");
      parts.push(E.var(idx, `${key}`));
    }

    // Add universal expr overrides (from dynamic buffs with no filter)
    for (const ov of this.exprOverrides) {
      if (ov.key === key && ov.filterKey === "") {
        parts.push(ov.expr);
      }
    }

    if (parts.length === 0) return E.const(0);
    if (parts.length === 1) return parts[0];
    return E.add(...parts);
  }

  /**
   * Sum of tagged entries from baseline that match the given tag.
   * These are always constants (pre-artifact buffs with filters).
   */
  private getTaggedConstValue(key: StatKey, tag: DamageTag): number {
    let sum = 0;
    for (const entry of this.baseline.dump()) {
      if (entry.key !== key || entry.filterKey === "") continue;
      const filter = StatSheet.parseFilterKey(entry.filterKey);
      if (filterMatchesTag(filter, tag)) {
        // Only add if this filterKey is NOT in variableKeys
        // (if it is, it's handled by getTaggedVarExpr)
        const vKey = `${key}:${entry.filterKey}`;
        if (!this.variableKeys.has(vKey)) {
          sum += entry.value;
        }
      }
    }
    return sum;
  }

  /** Get variable contributions for tagged entries matching the given tag. */
  private getTaggedVarExpr(key: StatKey, tag: DamageTag): Expr | null {
    const parts: Expr[] = [];
    for (const entry of this.baseline.dump()) {
      if (entry.key !== key || entry.filterKey === "") continue;
      const vKey = `${key}:${entry.filterKey}`;
      if (!this.variableKeys.has(vKey)) continue;
      const filter = StatSheet.parseFilterKey(entry.filterKey);
      if (filterMatchesTag(filter, tag)) {
        const idx = this.varMapping.register(
          this.charIdx,
          key,
          entry.filterKey
        );
        if (entry.value === 0) {
          parts.push(E.var(idx, `${key}[${entry.filterKey}]`));
        } else {
          parts.push(
            E.add(
              E.const(entry.value),
              E.var(idx, `${key}[${entry.filterKey}]`)
            )
          );
        }
      }
    }
    // Also check for variable keys that might not exist in baseline yet
    for (const vKeyStr of this.variableKeys) {
      if (!vKeyStr.startsWith(`${key}:`)) continue;
      const fk = vKeyStr.slice(key.length + 1);
      if (fk === "") continue; // universal handled separately
      // Skip if already found in baseline dump
      let found = false;
      for (const entry of this.baseline.dump()) {
        if (entry.key === key && entry.filterKey === fk) {
          found = true;
          break;
        }
      }
      if (found) continue;
      const filter = StatSheet.parseFilterKey(fk);
      if (filterMatchesTag(filter, tag)) {
        const idx = this.varMapping.register(this.charIdx, key, fk);
        parts.push(E.var(idx, `${key}[${fk}]`));
      }
    }
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return E.add(...parts);
  }

  /**
   * Create an ExprStats with additional constant stat entries merged in.
   * Used for bespoke buffs that add constant stats during formula compilation.
   */
  withMergedConst(
    entries: { key: StatKey; value: number }[],
    filter?: DamageTagFilter,
    fieldState?: FieldState
  ): ExprStatSheet {
    const extra = StatSheet.fromEntries(entries, filter, fieldState);
    return new ExprStatSheet(
      this.baseline.merge(extra),
      this.charIdx,
      this.varMapping,
      this.variableKeys,
      this.exprOverrides
    );
  }

  /**
   * Create an ExprStats with additional Expr-valued stat entries.
   * Used for dynamic buffs whose value depends on variable artifact stats.
   * The Expr is added alongside baseline + variable contributions in get()/getRaw().
   */
  withMergedExpr(
    entries: { key: StatKey; expr: Expr }[],
    filter?: DamageTagFilter,
    fieldState?: FieldState
  ): ExprStatSheet {
    const newOverrides = [...this.exprOverrides];
    for (const e of entries) {
      // Normalize elemental DMG keys (pyro%, hydro%, etc.) → dmg% with element filter
      const element = ELEMENTAL_DMG_KEY_TO_ELEMENT[e.key];
      if (element) {
        const mergedFilter: DamageTagFilter = {
          ...filter,
          elements: [element],
        };
        let fk = serializeFilter(mergedFilter);
        if (fieldState) fk = appendFieldState(fk, fieldState);
        newOverrides.push({
          key: "dmg%" as StatKey,
          filterKey: fk,
          expr: e.expr,
        });
      } else {
        let filterKey = filter ? serializeFilter(filter) : "";
        if (fieldState) filterKey = appendFieldState(filterKey, fieldState);
        newOverrides.push({ key: e.key, filterKey, expr: e.expr });
      }
    }
    return new ExprStatSheet(
      this.baseline,
      this.charIdx,
      this.varMapping,
      this.variableKeys,
      newOverrides
    );
  }

  /**
   * Create a field-state view of this ExprStats.
   * The baseline StatSheet is pinned to the field state (filtering tagged entries),
   * and exprOverrides with non-matching field tags are excluded.
   */
  withFieldState(fs: FieldState): ExprStatSheet {
    // Filter exprOverrides to only those visible in the given field state
    const filteredOverrides = this.exprOverrides.filter((ov) => {
      if (ov.filterKey === "") return true; // universal
      // Check if the filterKey contains a field-state tag
      const parts = ov.filterKey.split("|");
      for (const p of parts) {
        if (p === "f:on" && fs !== "on") return false;
        if (p === "f:off" && fs !== "off") return false;
      }
      return true;
    });

    return new ExprStatSheet(
      this.baseline.withFieldState(fs),
      this.charIdx,
      this.varMapping,
      this.variableKeys,
      filteredOverrides
    );
  }
}

/**
 * Create ExprStats for a character given their baseline StatSheet and
 * the set of stat keys that can vary from artifacts.
 *
 * @param baseline - Pre-artifact StatSheet (base + weapon + set bonuses + static buffs)
 * @param charIdx - Index in the team (0-3)
 * @param varMapping - Shared VarMapping across all characters
 * @param artifactStatKeys - Set of stat keys that vary from artifacts (universal filter only for now)
 */
export function createExprStats(
  baseline: StatSheet,
  charIdx: number,
  varMapping: VarMapping,
  artifactStatKeys: Set<StatKey>
): ExprStatSheet {
  const variableKeys = new Set<string>();
  for (const key of artifactStatKeys) {
    // Elemental DMG keys (pyro%, hydro%, etc.) are normalized to dmg% with element filter
    const element = ELEMENTAL_DMG_KEY_TO_ELEMENT[key];
    if (element) {
      const filterKey = serializeFilter({ elements: [element] });
      variableKeys.add(`dmg%:${filterKey}`);
    } else {
      variableKeys.add(`${key}:`); // universal filter
    }
  }
  return new ExprStatSheet(baseline, charIdx, varMapping, variableKeys);
}
