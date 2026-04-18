/**
 * Team-level reaction formula provider.
 *
 * Auto-generates transformative and lunar reaction formulas based on team
 * composition and enemy aura, avoiding duplicates where characters already
 * define the reaction in their own formulaMap.
 */

import { i18nAppData } from "@/data/i18n-app";
import type { Element } from "@/data/types";

import { LUNAR_REACTIONS, PHEC_ELEMENTS } from "../constants";
import type {
  FormulaPart,
  ReactionComboDelta,
  ReactionComboEntry,
} from "../types";
import type { FormulaEntry } from "../types";
import type {
  CalcContext,
  DamageResult,
  ElementalOrPhysical,
  I18nLabel,
  ReactionType,
  TeamSlotConfig,
} from "../types";
import { LunarFormula, TransformFormula } from "./damageFormula";
import type { CharacterBase, IFormulaProvider } from "./implModel";
import type { StatSheet } from "./statSheet";
import type { TeamMeta } from "./teamMeta";

/** Damage element produced by each reaction. */
const REACTION_DAMAGE_ELEMENT: Partial<
  Record<ReactionType, ElementalOrPhysical>
> = {
  overloaded: "Pyro",
  electroCharged: "Electro",
  superconduct: "Cryo",
  bloom: "Dendro",
  hyperbloom: "Dendro",
  burgeon: "Dendro",
  burning: "Pyro",
  lunarCharged: "Electro",
  lunarCrystallize: "Geo",
};

/** Which character elements can trigger each reaction. */
const REACTION_TRIGGER_ELEMENTS: Partial<Record<ReactionType, Element[]>> = {
  overloaded: ["Pyro", "Electro"],
  electroCharged: ["Hydro", "Electro"],
  superconduct: ["Cryo", "Electro"],
  swirl: ["Anemo"],
  bloom: ["Hydro", "Dendro"],
  hyperbloom: ["Electro"],
  burgeon: ["Pyro"],
  burning: ["Pyro"],
  lunarCharged: ["Hydro", "Electro"],
  lunarCrystallize: ["Hydro", "Geo"],
};

/**
 * Custom formula labels for reactions named after the in-game objects they spawn,
 * rather than the generic reaction name.
 */
const REACTION_FORMULA_LABELS: Partial<Record<ReactionType, I18nLabel>> = {
  bloom: { en: "Dendro Core", zh: "草原核" },
  lunarCharged: { en: "Thundercloud", zh: "雷暴云" },
  lunarCrystallize: { en: "Moondrift", zh: "月笼" },
};

/** Transformative reactions that TeamReaction generates. */
const TRANSFORMATIVE_REACTIONS: ReactionType[] = [
  "overloaded",
  "electroCharged",
  "superconduct",
  "bloom",
  "hyperbloom",
  "burgeon",
  "burning",
];

/** Multi-contributor lunar reactions (per DmgResearch.md §3.5). */
export const MULTI_CONTRIBUTOR_REACTIONS: ReadonlySet<ReactionType> = new Set([
  "lunarCharged",
  "lunarCrystallize",
]);

/** Rank weights: [Rank1, Rank2, Rank3, Rank4]. */
export const LUNAR_RANK_WEIGHTS = [0.6, 0.3, 0.05, 0.05] as const;

/** Resolve reaction combo entries into per-triggerer { formulaId → count }.
 *  Adds active constellation bonuses to the total, distributes across eligible
 *  characters (on-field char gets remainder, others get 1), and emits one entry
 *  per triggerer with per-triggerer formula ID (e.g. rx-overloaded-amber). */
export function resolveReactionComboEntries(
  entries: ReactionComboEntry[],
  constellations: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const entry of entries) {
    let total = entry.total;
    for (const b of entry.bonus) {
      if ((constellations[b.charId] ?? 0) >= b.minC) {
        total += b.delta;
      }
    }
    for (const charId of entry.eligible) {
      const count =
        total > 0
          ? charId === entry.onFieldCharId
            ? Math.max(0, total - (entry.eligible.length - 1))
            : 1
          : 0;
      result[`${entry.id}-${charId}`] = count;
    }
  }
  return result;
}

export class TeamReaction implements IFormulaProvider {
  /** Per-triggerer formula entries keyed by `rx-{reaction}-{charId}`. */
  private readonly formulas: Record<string, FormulaEntry> = {};

  /** Eligible trigger characters per base reaction ID (e.g. "rx-overloaded"). */
  private readonly baseEligible: Record<string, string[]> = {};

  /** Map per-triggerer formula ID → base reaction ID. */
  private readonly baseIdFor: Record<string, string> = {};

  /** Labels per base reaction ID (for UI grid display). */
  private readonly baseLabels: Record<string, I18nLabel> = {};

  /** Config lookup for charLevel per charId. */
  private readonly charLevels: Record<string, number>;

  /**
   * Pre-computed rank weights for multi-contributor lunar formulas.
   * Keyed by base formula ID (e.g. "rx-lunarCharged"), value maps charId → weight.
   * Computed from baseline stats (no artifacts) during TeamBuild construction.
   */
  private rankWeights: Record<string, Map<string, number>> = {};

  /** Register per-triggerer formula entries for a base reaction. */
  private registerPerTriggerer(
    baseId: string,
    label: I18nLabel,
    parts: FormulaPart[],
    eligible: string[]
  ): void {
    this.baseEligible[baseId] = eligible;
    this.baseLabels[baseId] = label;
    for (const charId of eligible) {
      const id = `${baseId}-${charId}`;
      this.formulas[id] = {
        label,
        parts,
        owner: "team",
        statsCharId: charId,
      };
      this.baseIdFor[id] = baseId;
    }
  }

  constructor(
    private readonly teamMeta: TeamMeta,
    private readonly charBases: Record<string, CharacterBase>,
    private readonly configs: TeamSlotConfig[]
  ) {
    this.charLevels = {};
    for (const c of configs) {
      this.charLevels[c.charId] = c.charLevel;
    }
    this.hasColumbina = configs.some((c) => c.charId === "columbina");

    // Collect team element info
    const teamElementChars = new Map<Element, string[]>();
    for (const c of configs) {
      const el = teamMeta.elements[c.charId];
      if (!el) continue;
      if (!teamElementChars.has(el)) teamElementChars.set(el, []);
      teamElementChars.get(el)!.push(c.charId);
    }

    // Generate transformative reaction formulas (per-triggerer)
    for (const reaction of TRANSFORMATIVE_REACTIONS) {
      if (
        !teamMeta.hasReaction(reaction) &&
        !(reaction === "bloom" && teamMeta.hasReaction("lunarBloom"))
      )
        continue;
      const element = REACTION_DAMAGE_ELEMENT[reaction];
      if (!element) continue;

      const baseId = `rx-${reaction}`;
      let label = REACTION_FORMULA_LABELS[reaction] ??
        i18nAppData.reactions[reaction] ?? { en: reaction, zh: reaction };
      const formula = new TransformFormula(0, {
        element,
        ability: "special",
        reaction,
      });
      const eligible = this.findEligibleChars(reaction, teamElementChars);

      // Nilou Bountiful Core upgrade
      if (
        reaction === "bloom" &&
        configs.some((c) => c.charId === "nilou") &&
        configs.every((c) => {
          const e = teamMeta.elements[c.charId];
          return e === "Dendro" || e === "Hydro";
        })
      ) {
        label = { en: "Bountiful Core", zh: "丰穰之核" };
      }

      this.registerPerTriggerer(baseId, label, [{ formula }], eligible);
    }

    // Generate lunar reaction formulas (per-triggerer, multi-contributor)
    for (const reaction of LUNAR_REACTIONS) {
      if (!teamMeta.hasReaction(reaction)) continue;
      const element = REACTION_DAMAGE_ELEMENT[reaction];
      if (!element) continue;

      const baseId = `rx-${reaction}`;
      const label = REACTION_FORMULA_LABELS[reaction] ??
        i18nAppData.reactions[reaction] ?? { en: reaction, zh: reaction };
      const formula = new LunarFormula(0, {
        element,
        ability: "special",
        reaction,
      });
      const eligible = this.findEligibleChars(reaction, teamElementChars);

      this.registerPerTriggerer(baseId, label, [{ formula }], eligible);
    }

    // Swirl special case: one formula per swirled element, per-triggerer
    if (teamMeta.hasReaction("swirl")) {
      const anemoChars = teamElementChars.get("Anemo") ?? [];
      for (const swirlEl of PHEC_ELEMENTS) {
        if (!teamElementChars.has(swirlEl)) continue;
        const baseId = `rx-swirl-${swirlEl}`;
        const elLabel = i18nAppData.elements[swirlEl];
        const swirlBase = i18nAppData.reactions.swirl;
        const label: I18nLabel = {
          en: `${swirlBase.en} (${elLabel.en})`,
          zh: `${swirlBase.zh} (${elLabel.zh})`,
        };
        const formula = new TransformFormula(0, {
          element: swirlEl,
          ability: "special",
          reaction: "swirl",
        });

        this.registerPerTriggerer(baseId, label, [{ formula }], anemoChars);
      }
    }
  }

  /** Find eligible trigger characters in team-slot order. */
  private findEligibleChars(
    reaction: ReactionType,
    teamElementChars: Map<Element, string[]>
  ): string[] {
    const triggerElements = REACTION_TRIGGER_ELEMENTS[reaction];
    if (!triggerElements) return [];

    const eligible = new Set<string>();
    for (const el of triggerElements) {
      const chars = teamElementChars.get(el);
      if (chars) for (const c of chars) eligible.add(c);
    }
    // Return in team-slot order (configs order)
    return this.configs.map((c) => c.charId).filter((id) => eligible.has(id));
  }

  /**
   * Set pre-computed rank weights for a multi-contributor formula.
   * Called by TeamBuild after construction using baseline stats (no artifacts).
   * Keyed by base reaction ID (e.g. "rx-lunarCharged").
   */
  setRankWeights(baseFormulaId: string, weights: Map<string, number>): void {
    this.rankWeights[baseFormulaId] = weights;
  }

  /**
   * Get pre-computed rank weights for a formula (accepts per-triggerer or base ID).
   * Returns undefined if not pre-computed (falls back to dynamic ranking).
   */
  getRankWeights(formulaId: string): Map<string, number> | undefined {
    const base = this.baseIdFor[formulaId] ?? formulaId;
    return this.rankWeights[base];
  }

  /** IFormulaProvider — all per-triggerer reaction formula IDs with i18n labels. */
  get formulaIds(): Record<string, I18nLabel> {
    return this.getFormulaIds();
  }

  /** All per-triggerer reaction formula IDs with i18n labels. */
  getFormulaIds(): Record<string, I18nLabel> {
    const result: Record<string, I18nLabel> = {};
    for (const [id, entry] of Object.entries(this.formulas)) {
      result[id] = entry.label;
    }
    return result;
  }

  /** Eligible trigger characters for a base reaction. */
  getEligibleCharacters(formulaId: string): string[] {
    const base = this.baseIdFor[formulaId] ?? formulaId;
    return this.baseEligible[base] ?? [];
  }

  /** Is this a multi-contributor lunar formula? */
  isMultiContributor(formulaId: string): boolean {
    const base = this.baseIdFor[formulaId] ?? formulaId;
    const baseReaction = base.startsWith("rx-") ? base.slice(3) : undefined;
    return (
      baseReaction != null &&
      MULTI_CONTRIBUTOR_REACTIONS.has(baseReaction as ReactionType)
    );
  }

  /** Get the FormulaEntry for a per-triggerer reaction formula ID. */
  getFormulaEntry(formulaId: string): FormulaEntry | undefined {
    return this.formulas[formulaId];
  }

  /** Base reaction IDs that have formulas registered. */
  getBaseReactionIds(): string[] {
    return Object.keys(this.baseEligible);
  }

  /** Base reaction IDs with their i18n labels (for UI grid display). */
  getBaseFormulaLabels(): Record<string, I18nLabel> {
    return this.baseLabels;
  }

  /** Guess the on-field character for a base reaction.
   *  Priority: best on-field damage dealer for the rotation. */
  guessOnFieldChar(baseId: string): string | undefined {
    const eligible = this.baseEligible[baseId] ?? [];
    const priority = ["flins", "zibai", "ineffa", "linnea", "columbina"];
    for (const charId of priority) {
      if (eligible.includes(charId)) return charId;
    }
    // Fallback: first eligible char
    return eligible[0] ?? this.configs[0]?.charId;
  }

  /** Whether Columbina is on the team (P2: ×4/3 reaction triggers). */
  private readonly hasColumbina: boolean;

  /** Cached reaction combo descriptor (built once). */
  private cachedDescriptor: ReactionComboEntry[] | undefined;

  /** Reaction combo descriptor: base counts + character-gated deltas. */
  getReactionComboDescriptor(): ReactionComboEntry[] {
    if (this.cachedDescriptor) return this.cachedDescriptor;

    const hasLCh = "rx-lunarCharged" in this.baseEligible;
    const hasLCr = "rx-lunarCrystallize" in this.baseEligible;
    const hasLB = this.teamMeta.hasReaction("lunarBloom");

    const entries: ReactionComboEntry[] = [];
    const lunarCount = +hasLCh + +hasLCr + +hasLB;

    // Base counts from lunar reaction heuristics
    const baseCounts: Record<string, number> = {};
    if (lunarCount >= 3) {
      if (hasLCh) baseCounts["rx-lunarCharged"] = 0;
      if (hasLCr) baseCounts["rx-lunarCrystallize"] = 0;
    } else if (lunarCount === 1) {
      if (hasLCh) baseCounts["rx-lunarCharged"] = 9;
      if (hasLCr) baseCounts["rx-lunarCrystallize"] = 15;
    } else {
      if (hasLCh && hasLCr) {
        baseCounts["rx-lunarCharged"] = 9;
        baseCounts["rx-lunarCrystallize"] = 0;
      } else if (hasLCr && hasLB) {
        baseCounts["rx-lunarCrystallize"] = 3;
      } else if (hasLCh && hasLB) {
        baseCounts["rx-lunarCharged"] = 3;
      }
    }

    // Columbina P2: ×4/3 baked into all values so downstream never needs to know
    const col = this.hasColumbina
      ? (n: number) => Math.round((n * 4) / 3)
      : (n: number) => n;

    for (const [id, baseTotal] of Object.entries(baseCounts)) {
      const bonus: ReactionComboDelta[] = [];

      // Linnea C2: extra LCr from Moondrift on Overdrive/Million Ton
      if (id === "rx-lunarCrystallize" && this.charBases.linnea) {
        const linneaCombo = this.charBases.linnea.combo;
        const isTap = "linnea-overdrive" in linneaCombo;
        bonus.push({
          charId: "linnea",
          minC: 2,
          delta: col(isTap ? 12 : 3),
        });
      }

      const eligible = this.baseEligible[id] ?? [];
      const onFieldCharId = this.guessOnFieldChar(id) ?? eligible[0] ?? "";

      entries.push({
        id,
        total: col(baseTotal),
        eligible,
        onFieldCharId,
        bonus,
      });
    }

    this.cachedDescriptor = entries;
    return entries;
  }

  /** Resolved per-triggerer reaction combo counts at construction-time constellations. */
  getReactionComboCounts(): Record<string, number> {
    const constellations: Record<string, number> = {};
    for (const c of this.configs) {
      constellations[c.charId] = this.charBases[c.charId]?.constellation ?? 0;
    }
    return resolveReactionComboEntries(
      this.getReactionComboDescriptor(),
      constellations
    );
  }

  /**
   * Evaluate single-contributor reaction (transformative).
   * The trigger character's stats and level are used.
   */
  getDamageResult(
    formulaId: string,
    triggerCharId: string,
    triggerStats: StatSheet,
    ctx: CalcContext
  ): DamageResult {
    const entry = this.formulas[formulaId];
    if (!entry) return { parts: [], totalDamage: 0 };

    const formula = entry.parts[0].formula;
    const charLevel = this.charLevels[triggerCharId] ?? 90;
    const damage = formula.calc(triggerStats, charLevel, ctx);
    return { parts: [{ damage, hits: 1 }], totalDamage: damage };
  }

  /**
   * Compute per-character damage contributions for a multi-contributor formula.
   * Returns eligible characters' raw damage values (unsorted).
   * Accepts per-triggerer formula IDs (reads multiContributors from entry).
   */
  private computeContributions(
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): { charId: string; damage: number }[] {
    const entry = this.formulas[formulaId];
    if (!entry) return [];

    const formula = entry.parts[0].formula;
    const base = this.baseIdFor[formulaId] ?? formulaId;
    const eligible = this.baseEligible[base] ?? [];
    const contributions: { charId: string; damage: number }[] = [];
    for (const config of this.configs) {
      if (!eligible.includes(config.charId)) continue;
      const stats = teamStats[config.charId];
      if (!stats) continue;
      contributions.push({
        charId: config.charId,
        damage: formula.calc(stats, config.charLevel, ctx),
      });
    }
    return contributions;
  }

  /**
   * Evaluate multi-contributor lunar reaction.
   * All eligible characters contribute; sorted by damage descending, then weighted by rank.
   */
  getMultiContributorResult(
    formulaId: string,
    _onFieldCharId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): DamageResult {
    const contributions = this.computeContributions(formulaId, teamStats, ctx);
    if (contributions.length === 0) return { parts: [], totalDamage: 0 };

    const precomputedWeights = this.getRankWeights(formulaId);

    let totalDamage: number;
    if (precomputedWeights) {
      totalDamage = contributions.reduce(
        (sum, c) => sum + c.damage * (precomputedWeights.get(c.charId) ?? 0),
        0
      );
    } else {
      contributions.sort((a, b) => b.damage - a.damage);
      totalDamage = contributions.reduce(
        (sum, c, i) => sum + c.damage * (LUNAR_RANK_WEIGHTS[i] ?? 0),
        0
      );
    }

    return { parts: [{ damage: totalDamage, hits: 1 }], totalDamage };
  }

  /**
   * Display breakdown for multi-contributor lunar reaction.
   * Returns per-character ranked contributions with weights.
   */
  getMultiContributorDisplay(
    formulaId: string,
    _onFieldCharId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): {
    contributors: {
      charId: string;
      rank: number;
      weight: number;
      damage: number;
    }[];
    totalDamage: number;
  } {
    const contributions = this.computeContributions(formulaId, teamStats, ctx);
    if (contributions.length === 0) return { contributors: [], totalDamage: 0 };

    const precomputedWeights = this.getRankWeights(formulaId);
    if (precomputedWeights) {
      // Sort by weight descending (highest rank first)
      contributions.sort(
        (a, b) =>
          (precomputedWeights.get(b.charId) ?? 0) -
          (precomputedWeights.get(a.charId) ?? 0)
      );
    } else {
      contributions.sort((a, b) => b.damage - a.damage);
    }

    const ranked = contributions.map((c, i) => ({
      charId: c.charId,
      rank: i + 1,
      weight: precomputedWeights?.get(c.charId) ?? LUNAR_RANK_WEIGHTS[i] ?? 0,
      damage: c.damage,
    }));
    const totalDamage = ranked.reduce((sum, c) => sum + c.damage * c.weight, 0);

    return { contributors: ranked, totalDamage };
  }

  // ─── Internal helpers ───

  /** Get the base reaction ID from a per-triggerer formula ID.
   *  e.g. "rx-overloaded-amber" → "rx-overloaded" */
  getBaseId(formulaId: string): string | undefined {
    return this.baseIdFor[formulaId];
  }
}
