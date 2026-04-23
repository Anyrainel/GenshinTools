import { charInfo } from "@/data/charInfo";
import type { ReactionType } from "@/data/enums";
import {
  getTalentParam,
  resolveCharacterStats,
  resolveWeaponStats,
} from "@/data/gameStatsLoader";
import type { StatEntry } from "@/data/types";
import type {
  ComboTemplate,
  ComboTemplateEntry,
  FormulaEntry,
  I18nLabel,
  OptionMap,
  TalentLevels,
} from "../types";
import { resolveComboDescriptor } from "./combo";
import type { StatBuff } from "./statBuff";
import type { TeamMeta } from "./teamMeta";

/** Any entity that contributes stats and buffs to a build */
export abstract class IStatProvider {
  abstract readonly stats: StatEntry[];
  abstract readonly buffs: StatBuff[];
}

/** An entity that owns damage formulas and exposes them for calc/display/compiler paths */
export abstract class IFormulaProvider {
  /** Public label map — derived from the internal formulaMap */
  abstract get formulaIds(): Record<string, I18nLabel>;
  /** Look up a formula entry by ID (used by all three damage paths) */
  abstract getFormulaEntry(formulaId: string): FormulaEntry | undefined;
}

/**
 * Base class for character extensions.
 * Stats are auto-resolved from character_stats.json including baselines.
 */
export abstract class CharacterBase implements IStatProvider, IFormulaProvider {
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
    const passive = teamMeta.talentPassiveBonuses(charId);
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

  abstract readonly buffs: StatBuff[];

  /** Subclasses declare all formulas here — labels + formula instances in one place. */
  protected abstract readonly formulaMap: Record<string, FormulaEntry>;

  /** Declarative rotation descriptor — ordered array of ComboEntry.
   *  Subclasses override this instead of defaultCombo.
   *  Default: empty (no combo defined). */
  protected get comboDescriptor(): ComboTemplate {
    return [];
  }

  /** Public read-only access to the raw combo descriptor.
   *  Used by the analyzer combo tab to compute defaults per constellation. */
  get rawComboDescriptor(): ComboTemplate {
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
  get comboInfo(): ComboTemplateEntry[] {
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

  /** Public accessor for a single formula entry (used by display path).
   *  Lazily enriches the entry with `owner = this.charId` on first access. */
  getFormulaEntry(formulaId: string): FormulaEntry | undefined {
    const entry = this.formulaMap[formulaId];
    if (entry && !entry.owner) {
      (entry as FormulaEntry).owner = this.charId;
    }
    return entry;
  }

  /** All formula entries in this character's formulaMap (for formulaIndex construction). */
  get allFormulaEntries(): Record<string, FormulaEntry> {
    return this.formulaMap;
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
        if (part.bespokeBuffs) {
          for (const buff of part.bespokeBuffs) {
            result.push({
              formulaId: id,
              label: entry.label,
              buff,
            });
          }
        }
      }
    }
    return result;
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
}
