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
export const LUNAR_RANK_WEIGHTS = [1, 0.5, 1 / 12, 1 / 12] as const;

// ─── TeamReactionProvider ───

export class TeamReactionProvider {
  /** Formula entries keyed by reaction formula ID (rx-{reaction}). */
  private readonly formulas: Record<string, FormulaEntry> = {};

  /** Eligible trigger characters per formula ID. */
  private readonly eligibleChars: Record<string, string[]> = {};

  /** Config lookup for charLevel per charId. */
  private readonly charLevels: Record<string, number>;

  constructor(
    private readonly teamMeta: TeamMeta,
    private readonly charBases: Record<string, CharacterBase>,
    private readonly configs: TeamSlotConfig[]
  ) {
    this.charLevels = {};
    for (const c of configs) {
      this.charLevels[c.charId] = c.charLevel;
    }

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
      if (!teamMeta.hasReaction(reaction)) continue;
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

      if (MULTI_CONTRIBUTOR_REACTIONS.has(reaction)) {
        // All team members contribute — any can be "on-field"
        this.eligibleChars[id] = configs.map((c) => c.charId);
      } else {
        this.eligibleChars[id] = this.findEligibleChars(
          reaction,
          teamElementChars
        );
      }
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

  /** Find eligible trigger characters, filtering out those with their own reaction formula. */
  private findEligibleChars(
    reaction: ReactionType,
    teamElementChars: Map<Element, string[]>
  ): string[] {
    const triggerElements = REACTION_TRIGGER_ELEMENTS[reaction];
    if (!triggerElements) return [];

    const charIds: string[] = [];
    for (const el of triggerElements) {
      const chars = teamElementChars.get(el);
      if (chars) charIds.push(...chars);
    }
    // Deduplicate (in case of multi-element overlap)
    return [...new Set(charIds)];
  }

  // ─── Public API ───

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
   * Evaluate multi-contributor lunar reaction.
   * All 4 characters contribute; sorted by damage descending, then weighted by rank.
   */
  getMultiContributorResult(
    formulaId: string,
    _onFieldCharId: string,
    teamStats: Record<string, StatSheet>,
    ctx: CalcContext
  ): DamageResult {
    const entry = this.formulas[formulaId];
    if (!entry) return { parts: [], totalDamage: 0 };

    const formula = entry.parts[0].formula;

    // Compute each character's individual contribution
    const contributions: { charId: string; damage: number }[] = [];
    for (const config of this.configs) {
      const stats = teamStats[config.charId];
      if (!stats) continue;
      const damage = formula.calc(stats, config.charLevel, ctx);
      contributions.push({ charId: config.charId, damage });
    }

    // Sort descending, apply rank weights
    contributions.sort((a, b) => b.damage - a.damage);
    const totalDamage = contributions.reduce(
      (sum, c, i) => sum + c.damage * (LUNAR_RANK_WEIGHTS[i] ?? 0),
      0
    );

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
    const entry = this.formulas[formulaId];
    if (!entry) return { contributors: [], totalDamage: 0 };

    const formula = entry.parts[0].formula;

    const contributions: { charId: string; damage: number }[] = [];
    for (const config of this.configs) {
      const stats = teamStats[config.charId];
      if (!stats) continue;
      const damage = formula.calc(stats, config.charLevel, ctx);
      contributions.push({ charId: config.charId, damage });
    }

    contributions.sort((a, b) => b.damage - a.damage);
    const ranked = contributions.map((c, i) => ({
      charId: c.charId,
      rank: i + 1,
      weight: LUNAR_RANK_WEIGHTS[i] ?? 0,
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
