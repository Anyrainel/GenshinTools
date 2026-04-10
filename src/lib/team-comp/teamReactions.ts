/**
 * Team-level reaction formula provider.
 *
 * Auto-generates transformative and lunar reaction formulas based on team
 * composition and enemy aura, avoiding duplicates where characters already
 * define the reaction in their own formulaMap.
 */

import { i18nAppData } from "@/data/i18n-app";
import type { Element } from "@/data/types";

import { LUNAR_REACTIONS, PHEC_ELEMENTS } from "./constants";
import { LunarFormula, TransformFormula } from "./damageFormulas";
import type {
  CharacterBase,
  FormulaPart,
  StatSheet,
  TeamMeta,
} from "./damageModels";
import type { FormulaEntry } from "./damageModels";
import type {
  CalcContext,
  DamageResult,
  ElementalOrPhysical,
  I18nLabel,
  ReactionType,
  TeamSlotConfig,
} from "./types";

// ─── Constants ───

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

/** Transformative reactions that TeamReactionProvider generates. */
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

// ─── Reaction Combo Descriptor ───

/** Constellation-gated additive delta for a reaction combo entry,
 *  tagged with the character whose constellation gates it. */
export type ReactionComboDelta = {
  charId: string;
  minC: number;
  delta: number;
};

/** One reaction formula's combo descriptor.
 *  `total` is the base trigger count (with Columbina ×4/3 baked in).
 *  `eligible` lists participating charIds in team-slot order.
 *  `onFieldCharId` receives the remainder after giving 1 to each other eligible.
 *  `bonus` lists constellation-gated additive deltas to the total. */
export type ReactionComboEntry = {
  id: string;
  total: number;
  eligible: string[];
  onFieldCharId: string;
  bonus: ReactionComboDelta[];
};

/** Resolve reaction combo entries into { formulaId → { charId → count } }.
 *  Adds active constellation bonuses to the total, then distributes:
 *  on-field char gets remainder, every other eligible char gets 1 (0 if total ≤ 0). */
export function resolveReactionComboEntries(
  entries: ReactionComboEntry[],
  constellations: Record<string, number>
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const entry of entries) {
    let total = entry.total;
    for (const b of entry.bonus) {
      if ((constellations[b.charId] ?? 0) >= b.minC) {
        total += b.delta;
      }
    }
    const perChar: Record<string, number> = {};
    if (total > 0) {
      for (const charId of entry.eligible) {
        perChar[charId] =
          charId === entry.onFieldCharId
            ? Math.max(0, total - (entry.eligible.length - 1))
            : 1;
      }
    } else {
      for (const charId of entry.eligible) perChar[charId] = 0;
    }
    result[entry.id] = perChar;
  }
  return result;
}

// ─── TeamReactionProvider ───

export class TeamReactionProvider {
  /** Formula entries keyed by reaction formula ID (rx-{reaction}). */
  private readonly formulas: Record<string, FormulaEntry> = {};

  /** Eligible trigger characters per formula ID. */
  private readonly eligibleChars: Record<string, string[]> = {};

  /** Config lookup for charLevel per charId. */
  private readonly charLevels: Record<string, number>;

  /**
   * Pre-computed rank weights for multi-contributor lunar formulas.
   * Keyed by formula ID (e.g. "rx-lunarCharged"), value maps charId → weight.
   * Computed from baseline stats (no artifacts) during TeamBuild construction.
   */
  private rankWeights: Record<string, Map<string, number>> = {};

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

    // Generate transformative reaction formulas
    for (const reaction of TRANSFORMATIVE_REACTIONS) {
      // lunarBloom has no separate formula — Dendro Cores deal the same bloom damage.
      // Generate rx-bloom when either bloom or lunarBloom is possible.
      if (
        !teamMeta.hasReaction(reaction) &&
        !(reaction === "bloom" && teamMeta.hasReaction("lunarBloom"))
      )
        continue;
      const element = REACTION_DAMAGE_ELEMENT[reaction];
      if (!element) continue;

      const id = `rx-${reaction}`;
      const label = REACTION_FORMULA_LABELS[reaction] ??
        i18nAppData.reactions[reaction] ?? { en: reaction, zh: reaction };
      const formula = new TransformFormula(0, {
        element,
        ability: "special",
        reaction,
      });
      this.formulas[id] = { label, parts: [{ formula }] };
      this.eligibleChars[id] = this.findEligibleChars(
        reaction,
        teamElementChars
      );
    }

    // Nilou Bountiful Core upgrade: when Nilou is on an all-Hydro/Dendro team,
    // upgrade rx-bloom label to "Bountiful Core" / "丰穰之核"
    if (this.formulas["rx-bloom"]) {
      const elements = configs.map((c) => teamMeta.elements[c.charId]);
      const allDendroHydro = elements.every(
        (e) => e === "Dendro" || e === "Hydro"
      );
      const hasNilou = configs.some((c) => c.charId === "nilou");
      if (hasNilou && allDendroHydro) {
        this.formulas["rx-bloom"].label = {
          en: "Bountiful Core",
          zh: "丰穰之核",
        };
      }
    }

    // Generate lunar reaction formulas
    for (const reaction of LUNAR_REACTIONS) {
      if (!teamMeta.hasReaction(reaction)) continue;
      const element = REACTION_DAMAGE_ELEMENT[reaction];
      if (!element) continue;

      const id = `rx-${reaction}`;
      const label = REACTION_FORMULA_LABELS[reaction] ??
        i18nAppData.reactions[reaction] ?? { en: reaction, zh: reaction };
      const formula = new LunarFormula(0, {
        element,
        ability: "special",
        reaction,
      });
      this.formulas[id] = { label, parts: [{ formula }] };

      this.eligibleChars[id] = this.findEligibleChars(
        reaction,
        teamElementChars
      );
    }

    // Swirl special case: one formula per swirled element on the team
    if (teamMeta.hasReaction("swirl")) {
      const anemoChars = teamElementChars.get("Anemo") ?? [];
      for (const swirlEl of PHEC_ELEMENTS) {
        if (!teamElementChars.has(swirlEl)) continue;
        const id = `rx-swirl-${swirlEl}`;
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
        this.formulas[id] = { label, parts: [{ formula }] };
        this.eligibleChars[id] = anemoChars;
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

  // ─── Public API ───

  /**
   * Set pre-computed rank weights for a multi-contributor formula.
   * Called by TeamBuild after construction using baseline stats (no artifacts).
   */
  setRankWeights(formulaId: string, weights: Map<string, number>): void {
    this.rankWeights[formulaId] = weights;
  }

  /**
   * Get pre-computed rank weights for a multi-contributor formula.
   * Returns undefined if not pre-computed (falls back to dynamic ranking).
   */
  getRankWeights(formulaId: string): Map<string, number> | undefined {
    return this.rankWeights[formulaId];
  }

  /** All available reaction formula IDs with i18n labels. */
  getFormulaIds(): Record<string, I18nLabel> {
    const result: Record<string, I18nLabel> = {};
    for (const [id, entry] of Object.entries(this.formulas)) {
      // Only include formulas that have at least one eligible trigger character
      if ((this.eligibleChars[id]?.length ?? 0) > 0) {
        result[id] = entry.label;
      }
    }
    return result;
  }

  /** Which characters can trigger/be on-field for a given formula. */
  getEligibleCharacters(formulaId: string): string[] {
    return this.eligibleChars[formulaId] ?? [];
  }

  /** Is this a multi-contributor lunar formula? */
  isMultiContributor(formulaId: string): boolean {
    const reaction = this.formulaIdToReaction(formulaId);
    return reaction != null && MULTI_CONTRIBUTOR_REACTIONS.has(reaction);
  }

  /** Get the FormulaEntry for a reaction formula ID. */
  getFormulaEntry(formulaId: string): FormulaEntry | undefined {
    return this.formulas[formulaId];
  }

  /** Guess the on-field character for a reaction combo line.
   *  Priority: best on-field damage dealer for the rotation. */
  guessOnFieldChar(formulaId: string): string | undefined {
    const eligible = this.eligibleChars[formulaId] ?? [];
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

    const hasLCh = "rx-lunarCharged" in this.formulas;
    const hasLCr = "rx-lunarCrystallize" in this.formulas;
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

      const eligible = this.eligibleChars[id] ?? [];
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

  /** Resolved per-character reaction combo counts at construction-time constellations. */
  getReactionComboCounts(): Record<string, Record<string, number>> {
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
   */
  private computeContributions(
    formulaId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): { charId: string; damage: number }[] {
    const entry = this.formulas[formulaId];
    if (!entry) return [];

    const formula = entry.parts[0].formula;
    const eligible = this.eligibleChars[formulaId] ?? [];
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

    const precomputedWeights = this.rankWeights[formulaId];

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

    const precomputedWeights = this.rankWeights[formulaId];
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

  /** Extract the reaction type from a formula ID. */
  private formulaIdToReaction(formulaId: string): ReactionType | undefined {
    if (!formulaId.startsWith("rx-")) return undefined;
    const rest = formulaId.slice(3);
    // rx-swirl-Pyro → "swirl"
    if (rest.startsWith("swirl-")) return "swirl";
    return rest as ReactionType;
  }
}
