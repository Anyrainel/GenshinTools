import type { ArtifactData } from "@/data/types";
import { getMainStatValueAtLevel } from "@/lib/account-data/artifactScore";
import { toInternal } from "@/lib/account-data/scoring/utils";
import {
  type BuffTarget,
  type DamageTag,
  type DamageTagFilter,
  type ElementalOrPhysical,
  type FieldState,
  type StatEntry,
  type StatKey,
  filterMatchesTag,
} from "../types";
import type { StatBuff } from "./statBuff";

// ─── Stat × Filter invariant assertions ───
/**
 * Immutable stat aggregation with tagged storage.
 *
 * Internally: `Map<StatKey, Map<serializedFilter, number>>`.
 * The empty-filter entry represents universal contributions.
 * Tagged entries are scoped via DamageTagFilter.
 *
 * **Usage:**
 * - `get('atk')` → computed total ATK (base × (1 + %) + flat). Always universal.
 * - `get('cr', tag)` → universal CR + all matching tagged CR entries.
 * - `get('atk%')` → **THROWS** — use `getRaw('atk%')`.
 * - `getRaw(key)` → raw universal-only value, no formula.
 */

export class StatSheet {
  private readonly data: Map<StatKey, Map<string, number>>;
  /**
   * Pinned field state for views. When set, `get()` only sees entries whose
   * field-state tag matches (or has no field-state tag = universal).
   * null = no field-state filtering (raw unified sheet or legacy single-field sheet).
   */
  private readonly _fieldState: FieldState | null;

  constructor(entries: StatEntry[], filterKey = EMPTY_FILTER_KEY) {
    this.data = new Map();
    this._fieldState = null;
    const baseFilter = deserializeFilter(filterKey);
    for (const { key, value } of entries) {
      const {
        key: storeKey,
        value: storeValue,
        filterKey: fk,
      } = normalizeEntry(key, value, baseFilter);
      let bucket = this.data.get(storeKey);
      if (!bucket) {
        bucket = new Map();
        this.data.set(storeKey, bucket);
      }
      accumulate(bucket, fk, storeValue, storeKey);
    }
  }

  /** Construct from a tagged two-level map (internal use). */
  private static fromData(
    data: Map<StatKey, Map<string, number>>,
    fieldState?: FieldState | null
  ): StatSheet {
    const sheet = new StatSheet([]);
    (sheet as unknown as { _fieldState: FieldState | null })._fieldState =
      fieldState ?? null;
    for (const [key, bucket] of data) {
      sheet.data.set(key, new Map(bucket));
    }
    return sheet;
  }

  /**
   * Create a lightweight view of this sheet pinned to a specific field state.
   * The view shares the same underlying data — no copy is made.
   *
   * Entries with matching `f:on`/`f:off` tags and entries with no field tag
   * (universal) are visible through the view. Entries with the opposite
   * field tag are excluded.
   */
  withFieldState(fs: FieldState): StatSheet {
    const view = new StatSheet([]);
    // Share the data map directly (no copy) — the view is read-only
    (view as unknown as { data: Map<StatKey, Map<string, number>> }).data =
      this.data;
    (view as unknown as { _fieldState: FieldState | null })._fieldState = fs;
    return view;
  }

  /** The pinned field state of this sheet, or null if not field-filtered. */
  get fieldState(): FieldState | null {
    return this._fieldState;
  }

  /** Create a StatSheet from entries scoped to a DamageTagFilter. */
  static fromEntries(
    entries: StatEntry[],
    filter?: DamageTagFilter,
    fieldState?: FieldState
  ): StatSheet {
    return new StatSheet(
      entries,
      filter
        ? serializeFilter(filter, fieldState)
        : fieldState
          ? `f:${fieldState}`
          : EMPTY_FILTER_KEY
    );
  }

  static fromRaw(stats: Partial<Record<StatKey, number>>): StatSheet {
    const entries: StatEntry[] = Object.entries(stats).map(([key, value]) => ({
      key: key as StatKey,
      value: value ?? 0,
    }));
    return new StatSheet(entries);
  }

  /** Convert an array of ArtifactData (e.g., from GOOD format) into a StatSheet */
  static fromArtifacts(
    artifacts: Iterable<ArtifactData | undefined | null>
  ): StatSheet {
    const entries: StatEntry[] = [];

    for (const art of artifacts) {
      if (!art || !art.mainStatKey) continue;

      const mainStatVal = toInternal(
        art.mainStatKey,
        getMainStatValueAtLevel(art.mainStatKey, art.rarity, art.level)
      );

      entries.push({ key: art.mainStatKey as StatKey, value: mainStatVal });

      if (art.substats) {
        for (const [subKey, subVal] of Object.entries(art.substats)) {
          if (subVal) {
            entries.push({
              key: subKey as StatKey,
              value: toInternal(subKey, subVal),
            });
          }
        }
      }
    }
    return new StatSheet(entries);
  }

  /**
   * Check if a filter key is visible through the current field-state view.
   * Universal entries (no `f:` tag) are always visible.
   * Field-tagged entries are visible only when their tag matches `_fieldState`.
   */
  private isFilterKeyVisible(fk: string): boolean {
    if (this._fieldState === null) return true;
    const { fieldState } = extractFieldStateFromKey(fk);
    if (fieldState === null) return true; // universal
    return fieldState === this._fieldState;
  }

  /**
   * Return a deep copy of the internal data, filtered by the current
   * field-state view. Mutation helpers (merge, apply, withDelta) must
   * use this instead of copying `this.data` directly so that f:on/f:off
   * entries that don't match the view are excluded from the result.
   */
  private cloneVisibleData(): Map<StatKey, Map<string, number>> {
    const cloned = new Map<StatKey, Map<string, number>>();
    for (const [key, bucket] of this.data) {
      const filtered = new Map<string, number>();
      for (const [fk, fv] of bucket) {
        if (this.isFilterKeyVisible(fk)) filtered.set(fk, fv);
      }
      if (filtered.size > 0) cloned.set(key, filtered);
    }
    return cloned;
  }

  /** Raw universal-only value for a key (no base×%+flat, no tagged entries). */
  getRaw(key: StatKey): number {
    return this.data.get(key)?.get(EMPTY_FILTER_KEY) ?? 0;
  }

  /**
   * Computed stat value.
   *
   * @param tag  Required. Pass `null` for universal-only (off-field supports,
   *   constraint checks like ER/CR). Pass the formula's `DamageTag` to include
   *   ability/element-filtered contributions (e.g. Skirk C2: +70% ATK for NA/CA).
   *
   * - `null`: returns ONLY the universal (unfiltered) value.
   * - tag:  returns universal + all matching filtered entries.
   *
   * For ATK/HP/DEF: base × (1 + sum(%)) + sum(flat), where sums include
   * tag-matching filtered entries when a tag is provided.
   *
   * **Throws** for atk%/hp%/def% — use getRaw().
   */
  get(key: StatKey, tag: DamageTag | null): number {
    if (SCALED_PERCENT_KEYS.has(key)) {
      throw new Error(
        `StatSheet.get('${key}') is not allowed — it's an intermediate value. ` +
          `Use getRaw('${key}') to read the raw % accumulation, ` +
          `or get('${key.replace("%", "")}') for the computed total.`
      );
    }

    // Scaled stats (ATK, HP, DEF): base × (1 + %) + flat
    const baseKey = SCALED_STAT_BASES[key as keyof typeof SCALED_STAT_BASES];
    if (baseKey) {
      const base = this.getUniversal(baseKey);
      let pct = this.getUniversal(`${key}%` as StatKey);
      let flat = this.getUniversal(key);
      // Include tag-matching filtered contributions (e.g. Skirk C2: +70% ATK% for normal/charge)
      // Skip field-state-only entries (f:on/f:off with no damage filter) — these are
      // already included by getUniversal() above. Only entries with actual damage-dimension
      // filters (ability, element, reaction) need to be added here.
      if (tag) {
        const pctBucket = this.data.get(`${key}%` as StatKey);
        if (pctBucket) {
          for (const [fk, fv] of pctBucket) {
            if (
              fk !== EMPTY_FILTER_KEY &&
              !isFieldStateOnlyKey(fk) &&
              this.isFilterKeyVisible(fk) &&
              filterMatchesTag(deserializeFilter(fk), tag)
            ) {
              pct += fv;
            }
          }
        }
        const flatBucket = this.data.get(key);
        if (flatBucket) {
          for (const [fk, fv] of flatBucket) {
            if (
              fk !== EMPTY_FILTER_KEY &&
              !isFieldStateOnlyKey(fk) &&
              this.isFilterKeyVisible(fk) &&
              filterMatchesTag(deserializeFilter(fk), tag)
            ) {
              flat += fv;
            }
          }
        }
      }
      return base * (1 + pct) + flat;
    }

    const bucket = this.data.get(key);
    if (!bucket) return 0;

    // Universal value: includes EMPTY_FILTER_KEY + field-state-only entries
    // (when _fieldState is set). This mirrors getUniversal() behavior —
    // field-state-only entries are semantically universal within a field-state view.
    let value = this.getUniversal(key);

    if (tag) {
      if (MULTIPLICATIVE_KEYS.has(key)) {
        // Multiplicative: combine across filterKeys as (1+a)(1+b)−1
        // Skip field-state-only entries (already in universal value above).
        let product = 1 + value;
        for (const [fk, fv] of bucket) {
          if (fk === EMPTY_FILTER_KEY) continue;
          if (isFieldStateOnlyKey(fk)) continue;
          if (
            this.isFilterKeyVisible(fk) &&
            filterMatchesTag(deserializeFilter(fk), tag)
          ) {
            product *= 1 + fv;
          }
        }
        return product - 1;
      }
      // Additive: skip field-state-only entries (already in universal value).
      for (const [fk, fv] of bucket) {
        if (fk === EMPTY_FILTER_KEY) continue;
        if (isFieldStateOnlyKey(fk)) continue;
        if (
          this.isFilterKeyVisible(fk) &&
          filterMatchesTag(deserializeFilter(fk), tag)
        ) {
          value += fv;
        }
      }
    }
    return value;
  }

  /**
   * Get the universal value for a stat key, respecting field-state filtering.
   * When _fieldState is set, sums the universal entry + any field-matching
   * entries that have no ability/element/reaction filter (only `f:on`/`f:off`).
   *
   * Used by the scaled-stat formula (ATK/HP/DEF) as the base/pct/flat inputs.
   */
  getUniversal(key: StatKey): number {
    const bucket = this.data.get(key);
    if (!bucket) return 0;
    let value = bucket.get(EMPTY_FILTER_KEY) ?? 0;
    if (this._fieldState !== null) {
      // Also include entries that are field-state-only (e.g. "f:on" with no other filter)
      for (const [fk, fv] of bucket) {
        if (fk === EMPTY_FILTER_KEY) continue;
        const { damageFilterKey, fieldState } = extractFieldStateFromKey(fk);
        if (
          damageFilterKey === EMPTY_FILTER_KEY &&
          fieldState === this._fieldState
        ) {
          value += fv;
        }
      }
    }
    return value;
  }

  /** Create a new StatSheet by merging this with another. */
  merge(other: StatSheet): StatSheet {
    const merged = this.cloneVisibleData();
    // Add other (respecting its field-state filter if it's a view)
    const otherData = other.cloneVisibleData();
    for (const [key, bucket] of otherData) {
      let target = merged.get(key);
      if (!target) {
        target = new Map();
        merged.set(key, target);
      }
      for (const [fk, fv] of bucket) {
        accumulate(target, fk, fv, key);
      }
    }
    return StatSheet.fromData(merged);
  }

  /**
   * Create a new StatSheet by merging raw stat entries with an optional field-state tag.
   * Used for applying dynamic buff results that are already evaluated to (key, value, filter).
   */
  mergeEntries(
    entries: { key: StatKey; value: number; filter?: DamageTagFilter }[],
    fieldState?: FieldState
  ): StatSheet {
    const merged = this.cloneVisibleData();
    for (const { key, value, filter } of entries) {
      const {
        key: storeKey,
        value: storeValue,
        filterKey: fk,
      } = normalizeEntry(key, value, filter ?? {});
      const taggedFk = fieldState ? appendFieldState(fk, fieldState) : fk;
      let target = merged.get(storeKey);
      if (!target) {
        target = new Map();
        merged.set(storeKey, target);
      }
      accumulate(target, taggedFk, storeValue, storeKey);
    }
    return StatSheet.fromData(merged);
  }

  /**
   * Create a new StatSheet by applying buffs' static entries (with tag extraction).
   *
   * When `fieldState` is provided, all entries are additionally tagged with
   * `f:on` or `f:off`, making them visible only through a matching field-state view.
   */
  apply(buffs: StatBuff[], fieldState?: FieldState): StatSheet {
    const merged = this.cloneVisibleData();
    for (const buff of buffs) {
      const filter = extractFilter(buff.target);
      for (const { key, value } of buff.staticBuffs) {
        const {
          key: storeKey,
          value: storeValue,
          filterKey: fk,
        } = normalizeEntry(key, value, filter);
        const taggedFk = fieldState ? appendFieldState(fk, fieldState) : fk;
        let target = merged.get(storeKey);
        if (!target) {
          target = new Map();
          merged.set(storeKey, target);
        }
        accumulate(target, taggedFk, storeValue, storeKey);
      }
    }
    return StatSheet.fromData(merged);
  }

  /**
   * Yield all (statKey, filterKey, value) triples. filterKey="" for universal.
   * When this sheet is a field-state view, only visible entries are yielded.
   */
  *dump(): Iterable<{ key: StatKey; filterKey: string; value: number }> {
    for (const [key, bucket] of this.data) {
      for (const [fk, fv] of bucket) {
        if (fv !== 0 && this.isFilterKeyVisible(fk))
          yield { key, filterKey: fk, value: fv };
      }
    }
  }

  /**
   * Like `dump()` but with scaled stats (ATK/HP/DEF) resolved to computed totals.
   *
   * - Intermediate keys (baseAtk, atk%, …) are **not** yielded.
   * - Universal entry: `base × (1 + universal%) + universalFlat`.
   * - Per-filter entries: `base × (1 + universal% + filter%) + universalFlat + filterFlat`
   *   — i.e. the total you'd see when that filter's condition is active.
   * - Non-scaled stats are yielded unchanged (same as `dump()`).
   */
  *dumpResolved(): Iterable<{
    key: StatKey;
    filterKey: string;
    value: number;
  }> {
    const scaledFlat = new Set<string>(Object.keys(SCALED_STAT_BASES));
    const scaledBase = new Set<string>(Object.values(SCALED_STAT_BASES));

    // Non-scaled stats: pass through (respecting field-state view)
    for (const [key, bucket] of this.data) {
      if (
        scaledFlat.has(key) ||
        scaledBase.has(key) ||
        SCALED_PERCENT_KEYS.has(key)
      )
        continue;
      for (const [fk, fv] of bucket) {
        if (fv !== 0 && this.isFilterKeyVisible(fk))
          yield { key, filterKey: fk, value: fv };
      }
    }

    // Scaled stats: compute totals per filter context
    for (const [stat, baseKey] of Object.entries(SCALED_STAT_BASES)) {
      const base = this.getUniversal(baseKey as StatKey);
      const uniPct = this.getUniversal(`${stat}%` as StatKey);
      const uniFlat = this.getUniversal(stat as StatKey);

      // Universal total
      const uniTotal = Math.round(base * (1 + uniPct) + uniFlat);
      if (uniTotal !== 0) {
        yield {
          key: stat as StatKey,
          filterKey: EMPTY_FILTER_KEY,
          value: uniTotal,
        };
      }

      // Per-filter totals (universal + that filter's contribution)
      const pctBucket = this.data.get(`${stat}%` as StatKey);
      const flatBucket = this.data.get(stat as StatKey);
      const filterKeys = new Set<string>();
      if (pctBucket)
        for (const fk of pctBucket.keys())
          if (fk !== EMPTY_FILTER_KEY && this.isFilterKeyVisible(fk))
            filterKeys.add(fk);
      if (flatBucket)
        for (const fk of flatBucket.keys())
          if (fk !== EMPTY_FILTER_KEY && this.isFilterKeyVisible(fk))
            filterKeys.add(fk);

      for (const fk of filterKeys) {
        const fPct = pctBucket?.get(fk) ?? 0;
        const fFlat = flatBucket?.get(fk) ?? 0;
        const total = Math.round(base * (1 + uniPct + fPct) + uniFlat + fFlat);
        if (total !== 0) {
          yield { key: stat as StatKey, filterKey: fk, value: total };
        }
      }
    }
  }

  /** Serialize to a structured-clonable array (for Web Worker transfer). */
  toSerializable(): { key: StatKey; filterKey: string; value: number }[] {
    return [...this.dump()];
  }

  /** Reconstruct from serialized dump (inverse of toSerializable). */
  static fromDump(
    entries: { key: StatKey; filterKey: string; value: number }[]
  ): StatSheet {
    const data = new Map<StatKey, Map<string, number>>();
    for (const { key, filterKey, value } of entries) {
      let bucket = data.get(key);
      if (!bucket) {
        bucket = new Map();
        data.set(key, bucket);
      }
      accumulate(bucket, filterKey, value, key);
    }
    return StatSheet.fromData(data);
  }

  /** Parse a serialized filter key back into a DamageTagFilter. */
  static parseFilterKey(fk: string): DamageTagFilter {
    return deserializeFilter(fk);
  }

  /**
   * Return all non-zero computed stat values as a flat record.
   * Scaled stats (ATK/HP/DEF) are returned as computed totals.
   * Intermediate % keys (atk%, hp%, def%) are excluded.
   */
  getAll(tag: DamageTag | null = null): Partial<Record<StatKey, number>> {
    const result: Partial<Record<StatKey, number>> = {};
    const evalKeys = new Set(this.data.keys());
    evalKeys.add("atk" as StatKey);
    evalKeys.add("hp" as StatKey);
    evalKeys.add("def" as StatKey);

    for (const key of evalKeys) {
      if (SCALED_PERCENT_KEYS.has(key)) continue;
      if (key === "baseAtk" || key === "baseHp" || key === "baseDef") continue;

      let value = this.get(key, tag);
      if (value !== 0) {
        if (key === "atk" || key === "hp" || key === "def" || key === "em") {
          value = Math.round(value);
        }
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Return stat values for the idle / character-panel display.
   *
   * Like `getAll(null)` but denormalizes `dmg%` entries that carry an
   * element-only filter back to per-element keys (pyro%, hydro%, …).
   * Generic (unfiltered) `dmg%` is omitted — the game panel doesn't show it.
   */
  getIdleRecord(): Partial<Record<StatKey, number>> {
    const result: Partial<Record<StatKey, number>> = {};
    const evalKeys = new Set(this.data.keys());
    evalKeys.add("atk" as StatKey);
    evalKeys.add("hp" as StatKey);
    evalKeys.add("def" as StatKey);

    for (const key of evalKeys) {
      if (SCALED_PERCENT_KEYS.has(key)) continue;

      if (key === "dmg%") {
        // Denormalize: element-only filtered entries → per-element keys
        const bucket = this.data.get("dmg%");
        if (bucket) {
          for (const [fk, fv] of bucket) {
            if (fk === EMPTY_FILTER_KEY || fv === 0) continue;
            const filter = deserializeFilter(fk);
            // Only entries with element-only filters (no ability/reaction)
            if (filter.abilities || filter.reactions) continue;
            if (!filter.elements || filter.elements.length === 0) continue;
            // Split multi-element filters into individual per-element keys
            for (const el of filter.elements) {
              const elKey = ELEMENT_TO_DMG_KEY[el];
              if (elKey) {
                result[elKey] = (result[elKey] ?? 0) + fv;
              }
            }
          }
        }
        continue;
      }

      // Standard universal-only read
      let value = this.get(key, null);
      if (value !== 0) {
        if (
          key === "atk" ||
          key === "hp" ||
          key === "def" ||
          key === "em" ||
          key === "baseAtk" ||
          key === "baseHp" ||
          key === "baseDef"
        ) {
          value = Math.round(value);
        }
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Return a new StatSheet with one universal stat bumped by `delta`.
   * Immutable — does not modify the original.
   */
  withDelta(key: StatKey, delta: number): StatSheet {
    const cloned = this.cloneVisibleData();
    let bucket = cloned.get(key);
    if (!bucket) {
      bucket = new Map();
      cloned.set(key, bucket);
    }
    accumulate(bucket, EMPTY_FILTER_KEY, delta, key);
    return StatSheet.fromData(cloned);
  }
}
/** Stats that use the base × (1 + %) + flat formula */

export const SCALED_STAT_BASES = {
  atk: "baseAtk",
  hp: "baseHp",
  def: "baseDef",
} as const;
export const SCALED_PERCENT_KEYS = new Set<string>(
  Object.keys(SCALED_STAT_BASES).map((k) => `${k}%`)
);
/**
 * Stat keys that aggregate multiplicatively: each contribution `v` represents
 * a `(1+v)×` multiplier, and the combined result is `∏(1+vᵢ) − 1`.
 *
 * Within a single filterKey the values are accumulated as `(1+a)(1+b)−1`.
 * Across filterKeys in `get()`, each filterKey's accumulated value is
 * multiplied together the same way.
 */

export const MULTIPLICATIVE_KEYS = new Set<StatKey>(["baseDmg%"]);
/** Accumulate a value into a bucket entry, respecting multiplicative keys. */

export function accumulate(
  bucket: Map<string, number>,
  fk: string,
  value: number,
  key: StatKey
): void {
  if (MULTIPLICATIVE_KEYS.has(key)) {
    const prev = bucket.get(fk) ?? 0;
    bucket.set(fk, (1 + prev) * (1 + value) - 1);
  } else {
    bucket.set(fk, (bucket.get(fk) ?? 0) + value);
  }
}
/** Per-element/Physical DMG keys normalized to dmg% + element filter. */
const ELEMENTAL_DMG_KEY_TO_ELEMENT: Partial<
  Record<StatKey, ElementalOrPhysical>
> = {
  "pyro%": "Pyro",
  "hydro%": "Hydro",
  "electro%": "Electro",
  "cryo%": "Cryo",
  "dendro%": "Dendro",
  "anemo%": "Anemo",
  "geo%": "Geo",
  "phys%": "Physical",
};
/** Reverse mapping: element name → per-element stat key. */

export const ELEMENT_TO_DMG_KEY: Record<string, StatKey> = {
  Pyro: "pyro%",
  Hydro: "hydro%",
  Electro: "electro%",
  Cryo: "cryo%",
  Dendro: "dendro%",
  Anemo: "anemo%",
  Geo: "geo%",
  Physical: "phys%",
};
/**
 * Convert an incoming stat entry to canonical form: per-element keys (pyro%, phys%, etc.)
 * become dmg% with the corresponding element filter so the sheet stores one representation.
 */

export function normalizeEntry(
  key: StatKey,
  value: number,
  existingFilter: DamageTagFilter
): { key: StatKey; value: number; filterKey: string } {
  const element = ELEMENTAL_DMG_KEY_TO_ELEMENT[key];
  if (element === undefined) {
    return { key, value, filterKey: serializeFilter(existingFilter) };
  }
  const merged: DamageTagFilter = {
    ...existingFilter,
    elements: [element],
  };
  return { key: "dmg%", value, filterKey: serializeFilter(merged) };
}
// ─── DamageTagFilter serialization ───

export const EMPTY_FILTER_KEY = "";
/** Serialize a DamageTagFilter into a deterministic string key.
 *  Array fields are sorted to ensure equal filters produce the same key.
 *  Field-state is appended as `f:on` or `f:off` when present. */

export function serializeFilter(
  filter: DamageTagFilter,
  fieldState?: FieldState
): string {
  const parts: string[] = [];
  if (filter.abilities)
    parts.push(`a:${[...filter.abilities].sort().join(",")}`);
  if (filter.elements) parts.push(`e:${[...filter.elements].sort().join(",")}`);
  if (filter.reactions)
    parts.push(`r:${[...filter.reactions].sort().join(",")}`);
  if (fieldState) parts.push(`f:${fieldState}`);
  return parts.length === 0 ? EMPTY_FILTER_KEY : parts.join("|");
}
/** Append a field-state tag to an existing filter key. */

export function appendFieldState(filterKey: string, fs: FieldState): string {
  return filterKey === EMPTY_FILTER_KEY ? `f:${fs}` : `${filterKey}|f:${fs}`;
}
/** Check if a filter key is field-state-only (f:on or f:off with no damage dimensions). */

export function isFieldStateOnlyKey(filterKey: string): boolean {
  return filterKey === "f:on" || filterKey === "f:off";
}
/** Extract the field-state from a filter key (if present). */

export function extractFieldStateFromKey(filterKey: string): {
  damageFilterKey: string;
  fieldState: FieldState | null;
} {
  if (filterKey === EMPTY_FILTER_KEY)
    return { damageFilterKey: EMPTY_FILTER_KEY, fieldState: null };
  const parts = filterKey.split("|");
  let fieldState: FieldState | null = null;
  const damageParts: string[] = [];
  for (const p of parts) {
    if (p === "f:on") fieldState = "on";
    else if (p === "f:off") fieldState = "off";
    else damageParts.push(p);
  }
  return {
    damageFilterKey:
      damageParts.length === 0 ? EMPTY_FILTER_KEY : damageParts.join("|"),
    fieldState,
  };
}
const filterCache = new Map<string, DamageTagFilter>();

export function deserializeFilter(key: string): DamageTagFilter {
  // Strip field-state component before parsing damage filter
  const { damageFilterKey } = extractFieldStateFromKey(key);
  const effectiveKey = damageFilterKey;

  const cached = filterCache.get(effectiveKey);
  if (cached) return cached;

  const filter: DamageTagFilter = {};
  if (effectiveKey !== EMPTY_FILTER_KEY) {
    for (const part of effectiveKey.split("|")) {
      const [dim, vals] = part.split(":") as [string, string];
      if (dim === "a")
        filter.abilities = vals.split(",") as DamageTagFilter["abilities"];
      if (dim === "e")
        filter.elements = vals.split(",") as DamageTagFilter["elements"];
      if (dim === "r")
        filter.reactions = vals.split(",") as DamageTagFilter["reactions"];
    }
  }
  filterCache.set(effectiveKey, filter);
  return filter;
}
/** Extract a DamageTagFilter from a BuffTarget. */

export function extractFilter(target: BuffTarget): DamageTagFilter {
  return target.filter ?? {};
}
// ─── Bespoke Buff Helpers ───
/** Build a merged overlay from an array of bespoke buffs. */

export function buildBespokeOverlay(
  bespokeBuffs: StatBuff[],
  baseStats: StatSheet,
  teamStats: StatSheet[]
): StatSheet {
  let overlay = StatSheet.fromEntries([]);
  for (const bb of bespokeBuffs) {
    overlay = overlay.merge(
      StatSheet.fromEntries(
        [...bb.staticBuffs, ...bb.dynamicBuffs(baseStats, teamStats)],
        bb.target.filter
      )
    );
  }
  return overlay;
}
/** Extract maxStacks from bespoke buff array (first buff that has it). */

export function bespokeMaxStacks(
  bespokeBuffs: StatBuff[] | undefined
): number | undefined {
  if (!bespokeBuffs) return undefined;
  for (const bb of bespokeBuffs) {
    if (bb.source.maxStacks != null) return bb.source.maxStacks;
  }
  return undefined;
}
