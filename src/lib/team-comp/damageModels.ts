import { charInfo } from "@/data/charInfo";
import { charactersById } from "@/data/constants";
import type {
  ArtifactData,
  Element,
  Faction,
  Rarity,
  Region,
  WeaponType,
} from "@/data/types";
import {
  getMainStatValueAtLevel,
  toInternal,
} from "@/lib/account-data/scoring/utils";
import {
  getCharacterStatsSync,
  getTalentParam,
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/lib/gameStatsLoader";

import {
  ELEMENT_ELIGIBLE_REACTIONS,
  LUNAR_SUPERSEDES,
  REACTION_AURA_TRIGGER,
  REACTION_ELEMENT_REQUIREMENTS,
} from "./constants";
import type { DamageFormula } from "./damageFormulas";
import { createReactionVariant } from "./damageFormulas";
import type {
  BuffSource,
  BuffTarget,
  CalcContext,
  ComboDescriptor,
  ComboEntry,
  DamageResult,
  DamageTag,
  DamageTagFilter,
  ElementalOrPhysical,
  I18nLabel,
  PartialBuffInfo,
  ReactionOverride,
  ReactionType,
  StatEntry,
  StatKey,
  TalentLevels,
} from "./types";
import { exclusionKey, resolveComboDescriptor } from "./types";

/** A single formula with an optional hit count (defaults to 1). */
export type FormulaPart = {
  formula: DamageFormula;
  hits?: number;
  /** Per-part buff applied only when computing this part (selfOnField scope).
   *  Accepts any StatBuff subclass (StatBuff, ScalingBuff, CrossScalingBuff). */
  bespokeBuff?: StatBuff;
  /** If true, damage is dealt while the character is off-field.
   *  On-field buffs (onField, selfOnField) will NOT apply. */
  offField?: boolean;
};

/** Declarative entry in a character's formulaMap. */
export type FormulaEntry = {
  label: I18nLabel;
  parts: FormulaPart[];
  /** Minimum constellation required (0-6). Omit or 0 = always available. */
  minC?: number;
  /** Additional availability condition (evaluated at construction time).
   *  `false` = formula is disabled (shown in UI but greyed out, excluded from combo).
   *  Omit or `true` = available (subject to minC check).
   *  The full condition is: `constellation >= (minC ?? 0) && when !== false`. */
  when?: boolean;
};
import { filterMatchesTag, resolvePartReaction } from "./types";

// Re-export buff and formula classes for convenient single-module imports
export { StatBuff, ScalingBuff } from "./damageBuffs";
export {
  DamageFormula,
  DirectFormula,
  createReactionVariant,
} from "./damageFormulas";

import type { StatBuff } from "./damageBuffs";

/** Stats that use the base × (1 + %) + flat formula */
const SCALED_STAT_BASES = {
  atk: "baseAtk",
  hp: "baseHp",
  def: "baseDef",
} as const;
const SCALED_PERCENT_KEYS = new Set<string>(
  Object.keys(SCALED_STAT_BASES).map((k) => `${k}%`)
);

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
const ELEMENT_TO_DMG_KEY: Record<string, StatKey> = {
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
function normalizeEntry(
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

const EMPTY_FILTER_KEY = "";

/** Serialize a DamageTagFilter into a deterministic string key.
 *  Array fields are sorted to ensure equal filters produce the same key. */
function serializeFilter(filter: DamageTagFilter): string {
  const parts: string[] = [];
  if (filter.abilities)
    parts.push(`a:${[...filter.abilities].sort().join(",")}`);
  if (filter.elements) parts.push(`e:${[...filter.elements].sort().join(",")}`);
  if (filter.reactions)
    parts.push(`r:${[...filter.reactions].sort().join(",")}`);
  return parts.length === 0 ? EMPTY_FILTER_KEY : parts.join("|");
}

const filterCache = new Map<string, DamageTagFilter>();

function deserializeFilter(key: string): DamageTagFilter {
  const cached = filterCache.get(key);
  if (cached) return cached;

  const filter: DamageTagFilter = {};
  for (const part of key.split("|")) {
    const [dim, vals] = part.split(":") as [string, string];
    if (dim === "a")
      filter.abilities = vals.split(",") as DamageTagFilter["abilities"];
    if (dim === "e")
      filter.elements = vals.split(",") as DamageTagFilter["elements"];
    if (dim === "r")
      filter.reactions = vals.split(",") as DamageTagFilter["reactions"];
  }
  filterCache.set(key, filter);
  return filter;
}

/** Extract a DamageTagFilter from a BuffTarget. */
function extractFilter(target: BuffTarget): DamageTagFilter {
  return target.filter ?? {};
}

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

  constructor(entries: StatEntry[], filterKey = EMPTY_FILTER_KEY) {
    this.data = new Map();
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
      bucket.set(fk, (bucket.get(fk) ?? 0) + storeValue);
    }
  }

  /** Construct from a tagged two-level map (internal use). */
  private static fromData(data: Map<StatKey, Map<string, number>>): StatSheet {
    const sheet = new StatSheet([]);
    for (const [key, bucket] of data) {
      sheet.data.set(key, new Map(bucket));
    }
    return sheet;
  }

  /** Create a StatSheet from entries scoped to a DamageTagFilter. */
  static fromEntries(
    entries: StatEntry[],
    filter?: DamageTagFilter
  ): StatSheet {
    return new StatSheet(
      entries,
      filter ? serializeFilter(filter) : EMPTY_FILTER_KEY
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
      if (tag) {
        const pctBucket = this.data.get(`${key}%` as StatKey);
        if (pctBucket) {
          for (const [fk, fv] of pctBucket) {
            if (
              fk !== EMPTY_FILTER_KEY &&
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

    // Always include universal
    let value = bucket.get(EMPTY_FILTER_KEY) ?? 0;

    if (tag) {
      for (const [fk, fv] of bucket) {
        if (fk === EMPTY_FILTER_KEY) continue;
        if (filterMatchesTag(deserializeFilter(fk), tag)) {
          value += fv;
        }
      }
    }
    return value;
  }

  private getUniversal(key: StatKey): number {
    return this.data.get(key)?.get(EMPTY_FILTER_KEY) ?? 0;
  }

  /** Create a new StatSheet by merging this with another (additive, both levels). */
  merge(other: StatSheet): StatSheet {
    const merged = new Map<StatKey, Map<string, number>>();
    // Copy this
    for (const [key, bucket] of this.data) {
      merged.set(key, new Map(bucket));
    }
    // Add other
    for (const [key, bucket] of other.data) {
      let target = merged.get(key);
      if (!target) {
        target = new Map();
        merged.set(key, target);
      }
      for (const [fk, fv] of bucket) {
        target.set(fk, (target.get(fk) ?? 0) + fv);
      }
    }
    return StatSheet.fromData(merged);
  }

  /** Create a new StatSheet by applying buffs' static entries (with tag extraction). */
  apply(buffs: StatBuff[]): StatSheet {
    const merged = new Map<StatKey, Map<string, number>>();
    for (const [key, bucket] of this.data) {
      merged.set(key, new Map(bucket));
    }
    for (const buff of buffs) {
      const filter = extractFilter(buff.target);
      for (const { key, value } of buff.staticBuffs) {
        const {
          key: storeKey,
          value: storeValue,
          filterKey: fk,
        } = normalizeEntry(key, value, filter);
        let target = merged.get(storeKey);
        if (!target) {
          target = new Map();
          merged.set(storeKey, target);
        }
        target.set(fk, (target.get(fk) ?? 0) + storeValue);
      }
    }
    return StatSheet.fromData(merged);
  }

  /** Yield all (statKey, filterKey, value) triples. filterKey="" for universal. */
  *dump(): Iterable<{ key: StatKey; filterKey: string; value: number }> {
    for (const [key, bucket] of this.data) {
      for (const [fk, fv] of bucket) {
        if (fv !== 0) yield { key, filterKey: fk, value: fv };
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

    // Non-scaled stats: pass through
    for (const [key, bucket] of this.data) {
      if (
        scaledFlat.has(key) ||
        scaledBase.has(key) ||
        SCALED_PERCENT_KEYS.has(key)
      )
        continue;
      for (const [fk, fv] of bucket) {
        if (fv !== 0) yield { key, filterKey: fk, value: fv };
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
          if (fk !== EMPTY_FILTER_KEY) filterKeys.add(fk);
      if (flatBucket)
        for (const fk of flatBucket.keys())
          if (fk !== EMPTY_FILTER_KEY) filterKeys.add(fk);

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
      bucket.set(filterKey, (bucket.get(filterKey) ?? 0) + value);
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
    const cloned = new Map<StatKey, Map<string, number>>();
    for (const [k, bucket] of this.data) {
      cloned.set(k, new Map(bucket));
    }
    let bucket = cloned.get(key);
    if (!bucket) {
      bucket = new Map();
      cloned.set(key, bucket);
    }
    bucket.set(EMPTY_FILTER_KEY, (bucket.get(EMPTY_FILTER_KEY) ?? 0) + delta);
    return StatSheet.fromData(cloned);
  }
}

// ═══════════════════════════════════════════════════════════════
// IStatProvider / IDamageProvider
// ═══════════════════════════════════════════════════════════════

/** Any entity that contributes stats and buffs to a build */
abstract class IStatProvider {
  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];
  abstract get src(): BuffSource;
}

/** An entity that can produce damage formulas */
abstract class IDamageProvider {
  /** Public label map — derived from the internal formulaMap */
  abstract get formulaIds(): Record<string, I18nLabel>;
  abstract getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfStats?: StatSheet,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>
  ): DamageResult;
}

// ═══════════════════════════════════════════════════════════════
// TeamMeta
// ═══════════════════════════════════════════════════════════════

/**
 * Immutable team metadata: elements, regions, rarities, factions.
 * Constructed once per team configuration. Provides query helpers
 * for conditional buff evaluation.
 */
export class TeamMeta {
  readonly characters: string[];
  readonly constellations: Record<string, number>;
  /** From character_stats.json when loaded; undefined if character not in stats. */
  readonly elements: Record<string, Element | undefined>;
  readonly regions: Record<string, Region | undefined>;
  /** Rarity from stats when present, else from CharacterResource. */
  readonly rarities: Record<string, Rarity>;
  readonly factions: Record<string, Faction>;
  readonly weaponTypes: Record<string, WeaponType | undefined>;
  readonly energies: Record<string, number>;
  readonly isHealer: Record<string, boolean>;
  readonly isShielder: Record<string, boolean>;
  /** 4pc artifact set IDs equipped by each character (charId → setId) */
  readonly artifactSets: Record<string, string>;
  /** Persistent element aura on the enemy, injected into reaction checks. */
  readonly enemyAura?: Element;

  constructor(
    characterIds: string[],
    constellations: Record<string, number> = {},
    artifactSets: Record<string, string> = {},
    enemyAura?: Element
  ) {
    this.characters = characterIds;
    this.constellations = constellations;
    this.elements = {};
    this.regions = {};
    this.rarities = {};
    this.factions = {};
    this.weaponTypes = {};
    this.energies = {};
    this.isHealer = {};
    this.isShielder = {};
    this.artifactSets = artifactSets;
    this.enemyAura = enemyAura;

    const charStatsData = getCharacterStatsSync();
    for (const id of characterIds) {
      const resource = charactersById[id];
      if (!resource) throw new Error(`Unknown character ID: ${id}`);
      const stats = charStatsData?.[id];
      this.elements[id] = stats?.element;
      this.regions[id] = stats?.region;
      this.rarities[id] = (stats?.rarity ?? resource.rarity) as Rarity;
      this.weaponTypes[id] = stats?.weaponType;

      const info = charInfo[id];
      const cons = constellations[id] ?? 0;
      this.factions[id] = info?.faction ?? "None";
      this.energies[id] = info?.energy ?? 0;
      this.isHealer[id] = info?.healerC !== undefined && cons >= info.healerC;
      this.isShielder[id] =
        info?.shielderC !== undefined && cons >= info.shielderC;
    }
  }

  hasHealer(): boolean {
    return Object.values(this.isHealer).some(Boolean);
  }

  hasShielder(): boolean {
    return Object.values(this.isShielder).some(Boolean);
  }

  countByElement(element: Element): number {
    return Object.values(this.elements).filter(
      (e): e is Element => e === element
    ).length;
  }

  countByRegion(region: Region): number {
    return Object.values(this.regions).filter((r): r is Region => r === region)
      .length;
  }

  countByFaction(faction: Faction): number {
    return Object.values(this.factions).filter((f) => f === faction).length;
  }

  hasReaction(reaction: ReactionType, charId?: string): boolean {
    const req = REACTION_ELEMENT_REQUIREMENTS[reaction];
    if (!req) return false;

    const charEl = charId ? this.elements[charId] : undefined;
    if (charId && !charEl) return false;

    const teamElements = Object.values(this.elements).filter(
      (e): e is Element => e != null
    );

    // For reactions with aura/trigger semantics, when enemy aura is set it
    // fixes the aura side — the character must supply the trigger element.
    const auraTrigger = REACTION_AURA_TRIGGER[reaction];
    if (auraTrigger && this.enemyAura) {
      // Find pairings where the enemy aura matches the aura side
      const matchingPairs = auraTrigger.filter(
        (p) => p.aura === this.enemyAura
      );
      if (matchingPairs.length === 0) return false;

      if (charEl) {
        // Character's element must be the trigger
        return matchingPairs.some((p) => p.trigger === charEl);
      }
      // No charId — check if any team member can be the trigger
      return matchingPairs.some((p) => teamElements.includes(p.trigger));
    }

    // Fallback: check basic element requirements for the team
    if (this.enemyAura && !teamElements.includes(this.enemyAura)) {
      teamElements.push(this.enemyAura);
    }
    let charParticipates = !charId;
    const hasElements = req.requiredElements.every((group) => {
      if (charEl && group.includes(charEl)) {
        charParticipates = true;
        return true;
      }
      return group.some((el) => teamElements.includes(el));
    });

    if (!hasElements || !charParticipates) return false;

    // Check a 5-star Moonsign faction member participates in lunar reactions
    if (req.requiresMoonsign5StarParticipant) {
      const validMoonsign5 = this.characters.some((id) => {
        const isMoonsign5 =
          this.factions[id] === "Moonsign" && this.rarities[id] === 5;
        if (!isMoonsign5) return false;
        const charEl = this.elements[id];
        return (
          charEl != null &&
          req.requiredElements.some((group) => group.includes(charEl))
        );
      });
      if (!validMoonsign5) return false;
    }

    if (req.requiresGeoOrClaymore) {
      const hasGeoOrClaymore = this.characters.some(
        (id) =>
          this.elements[id] === "Geo" || this.weaponTypes[id] === "Claymore"
      );
      if (!hasGeoOrClaymore) return false;
    }

    // Lunar reactions supersede base reactions when possible.
    // e.g. lunarCharged replaces electroCharged on teams with a Moonsign 5★.
    const supersede = LUNAR_SUPERSEDES[reaction];
    if (supersede && this.hasReaction(supersede.lunar)) {
      // Full supersede unless team has elements that still trigger the base
      if (!supersede.survivalElements) return false;
      return supersede.survivalElements.some((el) => teamElements.includes(el));
    }

    return true;
  }

  /**
   * Compute passive talent level bonuses from teammates.
   * - Tartaglia P3 "Master of Weaponry": +1 Normal Attack (A) for all party members (unconditional)
   * - Skirk P3 "Mutual Weapons Mentorship": +1 Skill (E) for all party members
   *   (only when all characters are Hydro or Cryo, with at least 1 of each)
   */
  talentPassiveBonuses(): { A: number; E: number; Q: number } {
    const bonus = { A: 0, E: 0, Q: 0 };
    if (this.characters.includes("tartaglia")) {
      bonus.A += 1;
    }
    if (this.characters.includes("skirk")) {
      const elements = Object.values(this.elements).filter(
        (e): e is Element => e != null
      );
      const allHydroOrCryo = elements.every(
        (e) => e === "Hydro" || e === "Cryo"
      );
      const hasHydro = elements.some((e) => e === "Hydro");
      const hasCryo = elements.some((e) => e === "Cryo");
      if (allHydroOrCryo && hasHydro && hasCryo) {
        bonus.E += 1;
      }
    }
    return bonus;
  }
}

// ═══════════════════════════════════════════════════════════════
// Combat Options (Schema-Driven)
// ═══════════════════════════════════════════════════════════════

/** A single selectable value in an OptionDef. */
export type OptionEntry = {
  value: string;
  label: I18nLabel;
  /** If provided, this choice is disabled when the predicate returns false. */
  when?: (teamMeta: TeamMeta) => boolean;
};

/**
 * Declarative option schema for a provider (character, weapon, or artifact set).
 * Defines a single select control with labeled choices.
 * UI renders as a toggle (2 choices) or dropdown (3+).
 */
export type OptionDef = {
  label: I18nLabel;
  choices: readonly OptionEntry[];
};

/**
 * Infer the typed option value union from an `as const` OptionDef.
 * Usage: `type DurinOption = InferOption<typeof durinOption>; // "dps" | "support"`
 */
export type InferOption<D extends OptionDef> = D["choices"][number]["value"];

/**
 * User-selected combat options, keyed by provider ID (charId or weaponId).
 * Each value is the selected option string for that provider.
 * Providers with no entry get `""` → falls back to first enabled choice via `resolveOption()`.
 */
export type OptionMap = Record<string, string>;

// ═══════════════════════════════════════════════════════════════
// Stat Auto-Resolution Helpers
// ═══════════════════════════════════════════════════════════════

// parseStatValue, parseWeaponSecondary, resolveCharacterStats, resolveWeaponStats
// are imported from @/lib/gameStatsLoader

// ═══════════════════════════════════════════════════════════════
// Extension Base Classes + Decorator Registries
// ═══════════════════════════════════════════════════════════════

/**
 * Base class for character extensions.
 * Stats are auto-resolved from character_stats.json including baselines.
 */
export abstract class CharacterBase implements IStatProvider, IDamageProvider {
  /** Auto-resolved: base stats + baselines (5% CR, 50% CD, 100% ER) */
  readonly stats: StatEntry[];

  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  /** Effective talent levels after C3/C5 bonuses. */
  private readonly _effectiveLevels: { A: number; E: number; Q: number };

  constructor(
    readonly charId: string,
    readonly charLevel: number,
    readonly constellation: number,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {},
    talentLevels?: TalentLevels
  ) {
    this.stats = resolveCharacterStats(charId, charLevel);
    this.option = combatOpts[charId] ?? "";

    const base = talentLevels ?? { auto: 10, skill: 10, burst: 10 };
    const info = charInfo[charId];
    const c3Bonus = this.constellation >= 3 && info ? 3 : 0;
    const c5Bonus = this.constellation >= 5 && info ? 3 : 0;
    const passive = teamMeta.talentPassiveBonuses();
    this._effectiveLevels = {
      A:
        base.auto +
        (info?.c3Talent === "A" ? c3Bonus : 0) +
        (info?.c5Talent === "A" ? c5Bonus : 0) +
        passive.A,
      E:
        base.skill +
        (info?.c3Talent === "E" ? c3Bonus : 0) +
        (info?.c5Talent === "E" ? c5Bonus : 0) +
        passive.E,
      Q:
        base.burst +
        (info?.c3Talent === "Q" ? c3Bonus : 0) +
        (info?.c5Talent === "Q" ? c5Bonus : 0) +
        passive.Q,
    };
  }

  /** Get talent param at the character's effective talent level. 1-based paramIndex. */
  protected param(skill: "A" | "E" | "Q", paramIndex: number): number {
    const level = this._effectiveLevels[skill];
    return getTalentParam(this.charId, skill, level - 1, paramIndex - 1);
  }

  /** Get the effective talent level for an ability (after C3/C5 bonuses). */
  protected talentLevel(ability: "auto" | "skill" | "burst"): number {
    const map = { auto: "A", skill: "E", burst: "Q" } as const;
    return this._effectiveLevels[map[ability]];
  }

  get src(): BuffSource {
    return { type: "character", id: this.charId };
  }

  abstract readonly buffs: StatBuff[];

  /** Subclasses declare all formulas here — labels + formula instances in one place. */
  protected abstract readonly formulaMap: Record<string, FormulaEntry>;

  /** Declarative rotation descriptor — ordered array of ComboEntry.
   *  Subclasses override this instead of defaultCombo.
   *  Default: empty (no combo defined). */
  protected get comboDescriptor(): ComboDescriptor {
    return [];
  }

  /** Public read-only access to the raw combo descriptor.
   *  Used by the analyzer combo tab to compute defaults per constellation. */
  get rawComboDescriptor(): ComboDescriptor {
    return this.comboDescriptor;
  }

  /** Resolved combo counts — delegates to comboDescriptor.
   *  Subclasses should NOT override this; override comboDescriptor instead. */
  protected get defaultCombo(): Record<string, number> {
    return resolveComboDescriptor(this.comboDescriptor, this.constellation);
  }

  /** Check if a formula entry is enabled (minC + when satisfied). */
  private isFormulaEnabled(entry: FormulaEntry): boolean {
    return (entry.minC ?? 0) <= this.constellation && entry.when !== false;
  }

  /** Public accessor — filters defaultCombo to only enabled formulas. */
  get combo(): Record<string, number> {
    const raw = this.defaultCombo;
    const map = this.formulaMap;
    const result: Record<string, number> = {};
    for (const [id, count] of Object.entries(raw)) {
      const entry = map[id];
      if (entry && this.isFormulaEnabled(entry)) result[id] = count;
    }
    return result;
  }

  /** Structured combo info — descriptor entries filtered to enabled formulas. */
  get comboInfo(): ComboEntry[] {
    const map = this.formulaMap;
    return this.comboDescriptor.filter(
      (e) => map[e.id] && this.isFormulaEnabled(map[e.id])
    );
  }

  /** Derived from formulaMap — exposes enabled formula IDs and labels for combo evaluation. */
  get formulaIds(): Record<string, I18nLabel> {
    const result: Record<string, I18nLabel> = {};
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      if (!this.isFormulaEnabled(entry)) continue;
      result[id] = entry.label;
    }
    return result;
  }

  /** All formula IDs with minC and enabled info, regardless of constellation.
   *  Used by UI to render locked/unavailable formulas. */
  get allFormulaIds(): Record<
    string,
    { label: I18nLabel; minC: number; enabled: boolean }
  > {
    const result: Record<
      string,
      { label: I18nLabel; minC: number; enabled: boolean }
    > = {};
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      result[id] = {
        label: entry.label,
        minC: entry.minC ?? 0,
        enabled: this.isFormulaEnabled(entry),
      };
    }
    return result;
  }

  /** Public accessor for a single formula entry (used by display path). */
  getFormulaEntry(formulaId: string): FormulaEntry | undefined {
    return this.formulaMap[formulaId];
  }

  /** Check if any formula in this character's formulaMap produces the given reaction. */
  hasReactionFormula(reaction: ReactionType): boolean {
    for (const entry of Object.values(this.formulaMap)) {
      if (entry.parts.some((p) => p.formula.tag.reaction === reaction)) {
        return true;
      }
    }
    return false;
  }

  /** Returns all bespoke buffs across all formula parts, for display in BuffLedger. */
  getBespokeBuffs(): {
    formulaId: string;
    label: I18nLabel;
    buff: StatBuff;
  }[] {
    const result: { formulaId: string; label: I18nLabel; buff: StatBuff }[] =
      [];
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      for (const part of entry.parts) {
        if (part.bespokeBuff) {
          result.push({
            formulaId: id,
            label: entry.label,
            buff: part.bespokeBuff,
          });
        }
      }
    }
    return result;
  }

  /** Iterates the formulaMap entry's parts, calls .calc() on each, and aggregates. */
  getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
    ctx: CalcContext,
    reactionOverride?: ReactionOverride,
    offFieldSelfStats?: StatSheet,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    offFieldVariants?: Map<string, StatSheet>
  ): DamageResult {
    const entry = this.formulaMap[formulaId];
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const parts: { damage: number; hits: number }[] = [];
    for (let idx = 0; idx < entry.parts.length; idx++) {
      const {
        formula,
        hits: totalHits,
        bespokeBuff,
        offField,
      } = entry.parts[idx];
      const h = totalHits ?? 1;
      const effectiveOffField = offField && !reactionOverride?.forceOnField;

      // Use off-field stats when the part deals damage while the character is off-field
      const baseSelfStats =
        effectiveOffField && offFieldSelfStats ? offFieldSelfStats : selfStats;

      // Apply per-part stat overlay if present
      let bespokeOverlay: StatSheet | undefined;
      let stats: StatSheet;
      if (bespokeBuff) {
        bespokeOverlay = StatSheet.fromEntries(
          [
            ...bespokeBuff.staticBuffs,
            ...bespokeBuff.dynamicBuffs(baseSelfStats, teamStats),
          ],
          bespokeBuff.target.filter
        );
        stats = baseSelfStats.merge(bespokeOverlay);
      } else {
        stats = baseSelfStats;
      }

      // Pick the correct variants map for on/off-field
      const partVariants =
        effectiveOffField && offFieldVariants
          ? offFieldVariants
          : statsVariants;

      const hasReaction =
        reactionOverride?.reaction && reactionOverride.reaction !== "none";

      // Skip reaction override if the formula already has a built-in reaction
      // (e.g., LunarDirectFormula with lunarBloom should not be converted to CatalyzeFormula)
      if (!hasReaction || formula.tag.reaction !== "none") {
        parts.push(
          this._calcPartBlended(
            formula,
            stats,
            ctx,
            h,
            idx,
            h,
            partialBuffs,
            partVariants,
            bespokeOverlay
          )
        );
        continue;
      }

      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          formula.tag.element as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      const targetReaction = resolvePartReaction(
        reactionOverride,
        idx,
        partEligible
      );

      // Determine how many hits react (partHits override, default = all)
      const reactingHits =
        targetReaction !== "none"
          ? Math.min(reactionOverride.partHits?.[idx] ?? h, h)
          : 0;
      const nonReactingHits = h - reactingHits;

      if (reactingHits > 0) {
        const effectiveFormula =
          targetReaction !== formula.tag.reaction
            ? createReactionVariant(formula, targetReaction)
            : formula;
        parts.push(
          this._calcPartBlended(
            effectiveFormula,
            stats,
            ctx,
            reactingHits,
            idx,
            h,
            partialBuffs,
            partVariants,
            bespokeOverlay
          )
        );
      }
      if (nonReactingHits > 0) {
        parts.push(
          this._calcPartBlended(
            formula,
            stats,
            ctx,
            nonReactingHits,
            idx,
            h,
            partialBuffs,
            partVariants,
            bespokeOverlay
          )
        );
      }
    }
    const totalDamage = parts.reduce(
      (sum, { damage, hits }) => sum + damage * hits,
      0
    );
    return { parts, totalDamage };
  }

  /**
   * Compute blended damage for a sub-part (possibly a reaction split).
   * If partialBuffs affect this part, uses interval-based blending.
   * The activation is scaled proportionally when hits < originalPartHits
   * (i.e., this is a reacting/non-reacting sub-part).
   *
   * @param statsVariants Pre-built stat sheets for each exclusion combination
   *   (without bespoke buffs). When a variant is used, bespokeOverlay is
   *   merged on top to restore bespoke buff contributions.
   */
  private _calcPartBlended(
    formula: DamageFormula,
    stats: StatSheet,
    ctx: CalcContext,
    hits: number,
    partIdx: number,
    originalPartHits: number,
    partialBuffs?: PartialBuffInfo[],
    statsVariants?: Map<string, StatSheet>,
    bespokeOverlay?: StatSheet
  ): { damage: number; hits: number } {
    if (!partialBuffs || partialBuffs.length === 0) {
      return { damage: formula.calc(stats, this.charLevel, ctx), hits };
    }

    // Scale activation proportionally for sub-parts (reacting/non-reacting split)
    const scale = hits / originalPartHits;
    const affecting = partialBuffs.filter((pb) => {
      const activated =
        (pb.partActivation[partIdx] ?? originalPartHits) * scale;
      return activated < hits;
    });

    if (affecting.length === 0) {
      return { damage: formula.calc(stats, this.charLevel, ctx), hits };
    }

    // Build interval cutpoints
    const cutpointSet = new Set<number>([0, hits]);
    for (const pb of affecting) {
      const activated =
        (pb.partActivation[partIdx] ?? originalPartHits) * scale;
      if (activated > 0 && activated < hits) cutpointSet.add(activated);
    }
    const cutpoints = [...cutpointSet].sort((a, b) => a - b);

    let total = 0;
    for (let i = 0; i < cutpoints.length - 1; i++) {
      const start = cutpoints[i];
      const end = cutpoints[i + 1];
      const width = end - start;
      if (width <= 0) continue;

      // Determine which buffs are inactive in this interval
      const excludeSet = new Set<string>();
      for (const pb of affecting) {
        const activated =
          (pb.partActivation[partIdx] ?? originalPartHits) * scale;
        if (activated < end) {
          excludeSet.add(pb.buffKey);
        }
      }

      // Look up pre-built variant; apply bespoke overlay if needed
      let intervalStats: StatSheet;
      if (excludeSet.size > 0 && statsVariants) {
        const eKey = exclusionKey(excludeSet);
        const variant = statsVariants.get(eKey) ?? stats;
        intervalStats =
          variant !== stats && bespokeOverlay
            ? variant.merge(bespokeOverlay)
            : variant;
      } else {
        intervalStats = stats;
      }

      total += width * formula.calc(intervalStats, this.charLevel, ctx);
    }
    return { damage: total / hits, hits };
  }
}

/**
 * Base class for weapon extensions.
 * Stats are auto-resolved from resources.ts (baseAtk + secondary stat).
 */
export abstract class WeaponBase implements IStatProvider {
  /** Auto-resolved: baseAtk + secondary stat from resources.ts */
  readonly stats: StatEntry[];

  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly weaponId: string,
    readonly refinement: number,
    readonly charId: string,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this.stats = resolveWeaponStats(weaponId);
    this.option = combatOpts[weaponId] ?? "";
  }

  abstract readonly buffs: StatBuff[];

  get src(): BuffSource {
    return { type: "weapon", id: this.weaponId };
  }
}

/** Base class for 4-piece artifact set extensions (4pc bonus only) */
export abstract class ArtifactSetBase implements IStatProvider {
  /** Raw option string from OptionMap. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly artifactSetId: string,
    readonly charId: string,
    readonly teamMeta: TeamMeta,
    combatOpts: OptionMap = {}
  ) {
    this.option = combatOpts[artifactSetId] ?? "";
  }

  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];

  /**
   * The ArtifactHalfSet ID that provides this set's 2pc bonus, or null if none.
   * When non-null, CharBuild will automatically include the matching half-set.
   */
  readonly halfSetId: string | null = null;

  get src(): BuffSource {
    return { type: "artifactSet", id: this.artifactSetId };
  }
}

/** Base class for 2-piece artifact set extensions */
export abstract class ArtifactHalfSetBase implements IStatProvider {
  constructor(
    readonly artifactHalfSetId: string,
    readonly charId: string,
    readonly teamMeta: TeamMeta
  ) {}

  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];

  get src(): BuffSource {
    return { type: "artifactHalfSet", id: this.artifactHalfSetId };
  }
}

// ─── Registries ───

type CharacterCtor = new (
  charId: string,
  charLevel: number,
  constellation: number,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap,
  talentLevels?: TalentLevels
) => CharacterBase;

type WeaponCtor = new (
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap
) => WeaponBase;

type ArtifactSetCtor = new (
  artifactSetId: string,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts?: OptionMap
) => ArtifactSetBase;

type ArtifactHalfSetCtor = new (
  artifactHalfSetId: string,
  charId: string,
  teamMeta: TeamMeta
) => ArtifactHalfSetBase;

const characterRegistry = new Map<string, CharacterCtor>();
const weaponRegistry = new Map<string, WeaponCtor>();
const artifactSetRegistry = new Map<string, ArtifactSetCtor>();
const artifactHalfSetRegistry = new Map<string, ArtifactHalfSetCtor>();
const optionRegistry = new Map<string, OptionDef>();

// ─── Decorator Factories ───

/** @RegisterCharacter("hu_tao") or @RegisterCharacter("durin", durinOption) */
export function RegisterCharacter(charId: string, optionDef?: OptionDef) {
  return (target: CharacterCtor, _context: ClassDecoratorContext) => {
    characterRegistry.set(charId, target);
    if (optionDef) optionRegistry.set(charId, optionDef);
  };
}

/** @RegisterWeapon("staff_of_homa") or @RegisterWeapon("the_widsith", widsithOption) */
export function RegisterWeapon(weaponId: string, optionDef?: OptionDef) {
  return (target: WeaponCtor, _context: ClassDecoratorContext) => {
    weaponRegistry.set(weaponId, target);
    if (optionDef) optionRegistry.set(weaponId, optionDef);
  };
}

/** @RegisterArtifactSet("crimson_witch_of_flames") or @RegisterArtifactSet("berserker", berserkerOption) */
export function RegisterArtifactSet(setId: string, optionDef?: OptionDef) {
  return (target: ArtifactSetCtor, _context: ClassDecoratorContext) => {
    artifactSetRegistry.set(setId, target);
    if (optionDef) optionRegistry.set(setId, optionDef);
  };
}

/** @RegisterArtifactHalfSet("1") — registers a 2pc ArtifactHalfSetBase (keyed by halfSetId) */
export function RegisterArtifactHalfSet(halfSetId: string) {
  return (target: ArtifactHalfSetCtor, _context: ClassDecoratorContext) => {
    artifactHalfSetRegistry.set(halfSetId, target);
  };
}

// ─── Factory Functions ───

export function createCharacter(
  charId: string,
  charLevel: number,
  constellation: number,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {},
  talentLevels?: TalentLevels
): CharacterBase {
  const Ctor = characterRegistry.get(charId);
  if (!Ctor) throw new Error(`No character registered for: ${charId}`);
  return new Ctor(
    charId,
    charLevel,
    constellation,
    teamMeta,
    combatOpts,
    talentLevels
  );
}

export function createWeapon(
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {}
): WeaponBase {
  const Ctor = weaponRegistry.get(weaponId);
  if (!Ctor) throw new Error(`No weapon registered for: ${weaponId}`);
  return new Ctor(weaponId, refinement, charId, teamMeta, combatOpts);
}

export function createArtifactSet(
  setId: string,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts: OptionMap = {}
): ArtifactSetBase {
  const Ctor = artifactSetRegistry.get(setId);
  if (!Ctor) throw new Error(`No artifact set registered for: ${setId}`);
  return new Ctor(setId, charId, teamMeta, combatOpts);
}

export function createArtifactHalfSet(
  halfSetId: string,
  charId: string,
  teamMeta: TeamMeta
): ArtifactHalfSetBase {
  const Ctor = artifactHalfSetRegistry.get(halfSetId);
  if (!Ctor)
    throw new Error(`No artifact half-set registered for: ${halfSetId}`);
  return new Ctor(halfSetId, charId, teamMeta);
}

// ─── Option Schema Helpers ───

/** Query the declared option schema for an entity (character, weapon, or artifact set). Returns null if no options. */
export function getEntityOption(entityId: string): OptionDef | null {
  return optionRegistry.get(entityId) ?? null;
}

/**
 * Check whether a choice is enabled given the team context.
 * Choices without a `when` predicate are always enabled.
 */
export function isChoiceEnabled(
  choice: OptionEntry,
  teamMeta?: TeamMeta
): boolean {
  if (!choice.when || !teamMeta) return true;
  return choice.when(teamMeta);
}

/**
 * Return the value of the first enabled choice for a given OptionDef.
 * Every OptionDef must have at least one ungated choice, so this always
 * returns a valid value.
 */
export function getDefaultOptionValue(
  def: OptionDef,
  teamMeta?: TeamMeta
): string {
  const first = def.choices.find((c) => isChoiceEnabled(c, teamMeta));
  return first ? first.value : def.choices[0].value;
}

/**
 * Resolve a raw option string against a typed schema, returning the
 * narrowed value. Falls back to first enabled choice if raw value is
 * invalid or disabled.
 *
 * Usage inside a subclass:
 * ```
 * private readonly o = resolveOption(durinOption, this.option);
 * //                    ^ InferOption<typeof durinOption> = "dps" | "support"
 * ```
 */
export function resolveOption<const D extends OptionDef>(
  def: D,
  raw: string,
  teamMeta?: TeamMeta
): InferOption<D> {
  const validChoice = raw !== "" && def.choices.find((c) => c.value === raw);
  if (validChoice && isChoiceEnabled(validChoice, teamMeta)) {
    return raw as InferOption<D>;
  }
  return getDefaultOptionValue(def, teamMeta) as InferOption<D>;
}
