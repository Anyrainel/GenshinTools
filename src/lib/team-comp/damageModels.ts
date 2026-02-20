import { charStats } from "@/data/charStats";
import { charactersById, weaponsById } from "@/data/constants";
import type {
  ArtifactData,
  BaseStat,
  Element,
  Faction,
  MainStat,
  Rarity,
  Region,
  WeaponType,
} from "@/data/types";
import { getFixedMainStatValue } from "@/lib/account-data/artifactScore";

import { REACTION_ELEMENT_REQUIREMENTS, SCALED_STAT_BASES } from "./constants";
import type { DamageFormula } from "./damageFormulas";
import type {
  BuffSource,
  BuffTarget,
  CalcContext,
  CombatOpts,
  DamageResult,
  DamageTag,
  DamageTagFilter,
  I18nLabel,
  InferOption,
  OptionDef,
  ReactionType,
  StatEntry,
  StatKey,
} from "./types";

/** A single formula with an optional hit count (defaults to 1). */
export type FormulaPart = { formula: DamageFormula; hits?: number };

/** Declarative entry in a character's formulaMap. */
export type FormulaEntry = {
  label: I18nLabel;
  parts: FormulaPart[];
};
import { filterMatchesTag } from "./types";

// Re-export buff and formula classes for convenient single-module imports
export {
  StatBuff,
  StaticSkillBuff,
  ScalingBuff,
  ScalingSkillBuff,
} from "./damageBuffs";
export {
  DamageFormula,
  DirectFormula,
  AmplifyFormula,
  CatalyzeFormula,
  TransformFormula,
  LunarFormula,
} from "./damageFormulas";

// Import StatBuff for use in this file's abstract declarations
import type { StatBuff } from "./damageBuffs";

/** The % keys of scaled stats (atk%, hp%, def%) — intermediate values only. */
const SCALED_PERCENT_KEYS = new Set<string>(
  Object.keys(SCALED_STAT_BASES).map((k) => `${k}%`)
);

// ─── DamageTagFilter serialization ───

const EMPTY_FILTER_KEY = "";

/** Serialize a DamageTagFilter into a deterministic string key. */
function serializeFilter(filter: DamageTagFilter): string {
  const parts: string[] = [];
  if (filter.abilities) parts.push(`a:${filter.abilities.join(",")}`);
  if (filter.elements) parts.push(`e:${filter.elements.join(",")}`);
  if (filter.reactions) parts.push(`r:${filter.reactions.join(",")}`);
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
 * Validate that a stat key is not paired with a nonsensical filter dimension.
 * Catches common authoring mistakes that would silently produce wrong numbers.
 */
function validateStatFilter(
  key: StatKey,
  filter: DamageTagFilter,
  source: BuffSource
): void {
  const label = `[${source.type}:${source.id}${source.origin ? `/${source.origin}` : ""}]`;

  if (key === "dmg%" && filter.elements) {
    throw new Error(
      `${label} dmg% must not have an element filter — use the element-specific key (e.g. "pyro%") instead. Got elements: [${filter.elements}]`
    );
  }

  if (
    (key === "defReduction%" || key === "defIgnore%") &&
    (filter.elements || filter.reactions)
  ) {
    throw new Error(
      `${label} ${key} is not expected to have element or reaction filters. Ask for review for this case.`
    );
  }

  if (key === "resReduction%" && filter.abilities) {
    throw new Error(
      `${label} resReduction% is not expected to have an ability filter. Ask for review for this case.`
    );
  }
}

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
    for (const { key, value } of entries) {
      let bucket = this.data.get(key);
      if (!bucket) {
        bucket = new Map();
        this.data.set(key, bucket);
      }
      bucket.set(filterKey, (bucket.get(filterKey) ?? 0) + value);
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

  static fromRaw(stats: Partial<Record<StatKey, number>>): StatSheet {
    const entries: StatEntry[] = Object.entries(stats).map(([key, value]) => ({
      key: key as StatKey,
      value: value ?? 0,
    }));
    return new StatSheet(entries);
  }

  /** Convert an array of ArtifactData (e.g., from GOOD format) into a StatSheet */
  static fromArtifacts(
    artifacts: Iterable<ArtifactData | undefined>
  ): StatSheet {
    const entries: StatEntry[] = [];
    for (const art of artifacts) {
      if (!art || !art.mainStatKey) continue;

      const mainStatVal = getFixedMainStatValue(art.mainStatKey, art.rarity);
      entries.push({ key: art.mainStatKey as StatKey, value: mainStatVal });

      if (art.substats) {
        for (const [subKey, subVal] of Object.entries(art.substats)) {
          if (subVal) {
            entries.push({ key: subKey as StatKey, value: subVal });
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
   * Without tag: returns ONLY the universal (unfiltered) value.
   *   Used for inherently-scoped keys (e.g., `pyro%`) and base stats.
   *
   * With tag: returns universal + all matching filtered entries.
   *   Used for universal keys that can be conditionally scoped
   *   (e.g., `cr`, `cd`, `dmg%`, `reactionDmg%`, `baseDmg`, etc.).
   *
   * For ATK/HP/DEF: base × (1 + sum(%)) + sum(flat).
   * **Throws** for atk%/hp%/def% — use getRaw().
   */
  get(key: StatKey, tag?: DamageTag): number {
    if (SCALED_PERCENT_KEYS.has(key)) {
      throw new Error(
        `StatSheet.get('${key}') is not allowed — it's an intermediate value. ` +
          `Use getRaw('${key}') to read the raw % accumulation, ` +
          `or get('${key.replace("%", "")}') for the computed total.`
      );
    }

    // Scaled stats (ATK, HP, DEF): always universal, no tag
    const baseKey = SCALED_STAT_BASES[key as keyof typeof SCALED_STAT_BASES];
    if (baseKey) {
      const base = this.getUniversal(baseKey);
      const pct = this.getUniversal(`${key}%` as StatKey);
      const flat = this.getUniversal(key);
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
      const fk = serializeFilter(filter);
      for (const { key, value } of buff.staticBuffs) {
        validateStatFilter(key, filter, buff.source);
        let target = merged.get(key);
        if (!target) {
          target = new Map();
          merged.set(key, target);
        }
        target.set(fk, (target.get(fk) ?? 0) + value);
      }
    }
    return StatSheet.fromData(merged);
  }

  /**
   * Apply dynamic buff contributions to produce a new StatSheet.
   * Evaluates each buff's dynamicBuffs() with the given stats context.
   */
  applyDynamic(
    buffs: StatBuff[],
    selfStats: StatSheet,
    teamStats: StatSheet[]
  ): StatSheet {
    const merged = new Map<StatKey, Map<string, number>>();
    for (const [key, bucket] of this.data) {
      merged.set(key, new Map(bucket));
    }
    for (const buff of buffs) {
      const filter = extractFilter(buff.target);
      const fk = serializeFilter(filter);
      for (const { key, value } of buff.dynamicBuffs(selfStats, teamStats)) {
        validateStatFilter(key, filter, buff.source);
        let target = merged.get(key);
        if (!target) {
          target = new Map();
          merged.set(key, target);
        }
        target.set(fk, (target.get(fk) ?? 0) + value);
      }
    }
    return StatSheet.fromData(merged);
  }
}

// ═══════════════════════════════════════════════════════════════
// IStatProvider / IDamageProvider
// ═══════════════════════════════════════════════════════════════

/** Any entity that contributes stats and buffs to a build */
export abstract class IStatProvider {
  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];
  abstract get src(): BuffSource;
}

/** An entity that can produce damage formulas */
export abstract class IDamageProvider {
  /** Public label map — derived from the internal formulaMap */
  abstract get formulaIds(): Record<string, I18nLabel>;
  abstract getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    teamStats: StatSheet[],
    ctx: CalcContext
  ): DamageResult;
}

// ═══════════════════════════════════════════════════════════════
// TeamMeta
// ═══════════════════════════════════════════════════════════════

import { charInfo } from "@/data/charInfo";

/**
 * Immutable team metadata: elements, regions, rarities, factions.
 * Constructed once per team configuration. Provides query helpers
 * for conditional buff evaluation.
 */
export class TeamMeta {
  readonly characters: string[];
  readonly constellations: Record<string, number>;
  readonly elements: Record<string, Element>;
  readonly regions: Record<string, Region>;
  readonly rarities: Record<string, Rarity>;
  readonly factions: Record<string, Faction>;
  readonly weaponTypes: Record<string, WeaponType>;
  readonly energies: Record<string, number>;
  readonly isHealer: Record<string, boolean>;
  readonly isShielder: Record<string, boolean>;
  /** 4pc artifact set IDs equipped by each character (charId → setId) */
  readonly artifactSets: Record<string, string>;

  constructor(
    characterIds: string[],
    constellations: Record<string, number> = {},
    artifactSets: Record<string, string> = {}
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

    for (const id of characterIds) {
      const resource = charactersById[id];
      if (!resource) throw new Error(`Unknown character ID: ${id}`);
      this.elements[id] = resource.element;
      this.regions[id] = resource.region;
      this.rarities[id] = resource.rarity;
      this.weaponTypes[id] = resource.weaponType;

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
    return Object.values(this.elements).filter((e) => e === element).length;
  }

  countByRegion(region: Region): number {
    return Object.values(this.regions).filter((r) => r === region).length;
  }

  countByFaction(faction: Faction): number {
    return Object.values(this.factions).filter((f) => f === faction).length;
  }

  hasReaction(reaction: ReactionType, charId?: string): boolean {
    const req = REACTION_ELEMENT_REQUIREMENTS[reaction];
    if (!req) return false;

    const charEl = charId ? this.elements[charId] : undefined;
    if (charId && !charEl) return false;

    // Check basic element requirements for the team and char participant
    const teamElements = Object.values(this.elements);
    // Initialize to true if charId is undefined
    let charParticipates = !charId;
    const hasElements = req.requiredElements.every((group) => {
      if (charEl && group.includes(charEl)) {
        charParticipates = true;
        return true;
      }
      return group.some((el) => teamElements.includes(el));
    });

    if (!hasElements || !charParticipates) return false;

    // Check a Nod-Krai 5-star participates in lunar reactions
    if (req.requiresNodKrai5StarParticipant) {
      const validNK5 = this.characters.some((id) => {
        const isNK5 =
          this.regions[id] === "Nod-Krai" && this.rarities[id] === 5;
        if (!isNK5) return false;

        const charEl = this.elements[id];
        return (
          charEl && req.requiredElements.some((group) => group.includes(charEl))
        );
      });
      if (!validNK5) return false;
    }

    if (req.requiresGeoOrClaymore) {
      const hasGeoOrClaymore = this.characters.some(
        (id) =>
          this.elements[id] === "Geo" || this.weaponTypes[id] === "Claymore"
      );
      if (!hasGeoOrClaymore) return false;
    }

    return true;
  }
}

// ═══════════════════════════════════════════════════════════════
// Stat Auto-Resolution Helpers
// ═══════════════════════════════════════════════════════════════

/** Parse a charStats string value: strip '%' and divide by 100 for percentages */
function parseStatValue(raw: string): number {
  if (raw.endsWith("%")) {
    return Number.parseFloat(raw.slice(0, -1)) / 100;
  }
  return Number.parseFloat(raw);
}

/**
 * Build StatEntry[] from charStats.ts for a given character.
 * Uses Lv90 data when charLevel ≤ 90, Lv100 data otherwise.
 * Includes stat baselines (5% CR, 50% CD, 100% ER).
 */
function resolveCharacterStats(charId: string, charLevel: number): StatEntry[] {
  const data = charStats[charId];
  if (!data) throw new Error(`No charStats entry for: ${charId}`);

  const tier = charLevel <= 90 ? data.Lv90 : data.Lv100;
  const entries: StatEntry[] = [];

  for (const [key, raw] of Object.entries(tier)) {
    if (raw === undefined) continue;
    const value = parseStatValue(raw);
    if (value !== 0) {
      entries.push({ key: key as BaseStat, value });
    }
  }
  // Stat baselines — included here so artifact-only StatSheets stay clean
  entries.push({ key: "cr", value: 0.05 });
  entries.push({ key: "cd", value: 0.5 });
  entries.push({ key: "er", value: 1.0 });

  return entries;
}

/** Parse weapon secondary stat value string */
function parseWeaponSecondary(stat: MainStat, rawValue: string): number {
  if (rawValue.endsWith("%")) {
    return Number.parseFloat(rawValue.slice(0, -1)) / 100;
  }
  // Flat stats like EM — the stat type tells us it's flat (no %)
  return Number.parseFloat(rawValue);
}

/** Build StatEntry[] from resources.ts for a given weapon */
function resolveWeaponStats(weaponId: string): StatEntry[] {
  const weapon = weaponsById[weaponId];
  if (!weapon) throw new Error(`No weapon resource for: ${weaponId}`);

  const entries: StatEntry[] = [{ key: "baseAtk", value: weapon.baseAtk }];

  if (weapon.secondaryStat && weapon.secondaryStatValue) {
    entries.push({
      key: weapon.secondaryStat,
      value: parseWeaponSecondary(
        weapon.secondaryStat,
        weapon.secondaryStatValue
      ),
    });
  }

  return entries;
}

// ═══════════════════════════════════════════════════════════════
// Extension Base Classes + Decorator Registries
// ═══════════════════════════════════════════════════════════════

/**
 * Base class for character extensions.
 * Stats are auto-resolved from charStats.ts including baselines.
 */
export abstract class CharacterBase implements IStatProvider, IDamageProvider {
  /** Auto-resolved: base stats + baselines (5% CR, 50% CD, 100% ER) */
  readonly stats: StatEntry[];

  /** Raw option string from CombatOpts. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly charId: string,
    readonly charLevel: number,
    readonly constellation: number,
    readonly teamMeta: TeamMeta,
    combatOpts: CombatOpts = {}
  ) {
    this.stats = resolveCharacterStats(charId, charLevel);
    this.option = combatOpts[charId] ?? "";
  }

  get src(): BuffSource {
    return { type: "character", id: this.charId };
  }

  abstract readonly buffs: StatBuff[];

  /** Subclasses declare all formulas here — labels + formula instances in one place. */
  protected abstract readonly formulaMap: Record<string, FormulaEntry>;

  /** Derived from formulaMap — public API for consumers. */
  get formulaIds(): Record<string, I18nLabel> {
    const result: Record<string, I18nLabel> = {};
    for (const [id, entry] of Object.entries(this.formulaMap)) {
      result[id] = entry.label;
    }
    return result;
  }

  /** Iterates the formulaMap entry's parts, calls .calc() on each, and aggregates. */
  getDamageResult(
    formulaId: string,
    selfStats: StatSheet,
    _teamStats: StatSheet[],
    ctx: CalcContext
  ): DamageResult {
    const entry = this.formulaMap[formulaId];
    if (!entry) throw new Error(`Unknown formula: ${formulaId}`);
    const parts = entry.parts.map(({ formula, hits }) => ({
      part: formula.calc(selfStats, this.charLevel, ctx),
      hits: hits ?? 1,
    }));
    const totalDamage = parts.reduce(
      (sum, { part, hits }) => sum + part.damage * hits,
      0
    );
    return { parts, totalDamage };
  }
}

/**
 * Base class for weapon extensions.
 * Stats are auto-resolved from resources.ts (baseAtk + secondary stat).
 */
export abstract class WeaponBase implements IStatProvider {
  /** Auto-resolved: baseAtk + secondary stat from resources.ts */
  readonly stats: StatEntry[];

  /** Raw option string from CombatOpts. Subclasses narrow via resolveOption(). */
  protected readonly option: string;

  constructor(
    readonly weaponId: string,
    readonly refinement: number,
    readonly charId: string,
    readonly teamMeta: TeamMeta,
    combatOpts: CombatOpts = {}
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
  constructor(
    readonly artifactSetId: string,
    readonly charId: string,
    readonly teamMeta: TeamMeta
  ) {}

  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];

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
  combatOpts?: CombatOpts
) => CharacterBase;

type WeaponCtor = new (
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts?: CombatOpts
) => WeaponBase;

type ArtifactSetCtor = new (
  artifactSetId: string,
  charId: string,
  teamMeta: TeamMeta
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

/** @RegisterArtifactSet("crimson_witch_of_flames") — registers a 4pc ArtifactSetBase */
export function RegisterArtifactSet(setId: string) {
  return (target: ArtifactSetCtor, _context: ClassDecoratorContext) => {
    artifactSetRegistry.set(setId, target);
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
  combatOpts: CombatOpts = {}
): CharacterBase {
  const Ctor = characterRegistry.get(charId);
  if (!Ctor) throw new Error(`No character registered for: ${charId}`);
  return new Ctor(charId, charLevel, constellation, teamMeta, combatOpts);
}

export function createWeapon(
  weaponId: string,
  refinement: number,
  charId: string,
  teamMeta: TeamMeta,
  combatOpts: CombatOpts = {}
): WeaponBase {
  const Ctor = weaponRegistry.get(weaponId);
  if (!Ctor) throw new Error(`No weapon registered for: ${weaponId}`);
  return new Ctor(weaponId, refinement, charId, teamMeta, combatOpts);
}

export function createArtifactSet(
  setId: string,
  charId: string,
  teamMeta: TeamMeta
): ArtifactSetBase {
  const Ctor = artifactSetRegistry.get(setId);
  if (!Ctor) throw new Error(`No artifact set registered for: ${setId}`);
  return new Ctor(setId, charId, teamMeta);
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

/** Query the declared option schema for an entity (character or weapon). Returns null if no options. */
export function getEntityOption(entityId: string): OptionDef | null {
  return optionRegistry.get(entityId) ?? null;
}

/**
 * Resolve a raw option string against a typed schema, returning the
 * narrowed value. Falls back to schema default if raw value is invalid.
 *
 * Usage inside a subclass:
 * ```
 * private readonly o = resolveOption(durinOption, this.option);
 * //                    ^ InferOption<typeof durinOption> = "dps" | "support"
 * ```
 */
export function resolveOption<const D extends OptionDef>(
  def: D,
  raw: string
): InferOption<D> {
  const valid = raw !== "" && def.choices.some((c) => c.value === raw);
  return (valid ? raw : def.default) as InferOption<D>;
}
