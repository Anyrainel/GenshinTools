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
  ElementalOrPhysical,
  I18nLabel,
  ReactionType,
  TeamSlotConfig,
} from "../types";
import { LunarFormula, TransformFormula } from "./damageFormula";
import type { CharacterBase, IFormulaProvider } from "./implModel";
import { computeLunarRankWeights } from "./stackRank";
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

/** Resolve reaction combo entries into { formulaId → count }.
 *  Adds active constellation bonuses to the total.
 *  Multi-contributor reactions produce one entry with the base ID (e.g. rx-lunarCharged: totalCount).
 *  Single-contributor reactions produce per-triggerer entries (e.g. rx-overloaded-amber). */
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
    const baseReaction = entry.id.startsWith("rx-")
      ? entry.id.slice(3)
      : undefined;
    const isMulti =
      baseReaction != null &&
      MULTI_CONTRIBUTOR_REACTIONS.has(baseReaction as ReactionType);
    if (isMulti) {
      result[entry.id] = total;
    } else {
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
        parts: parts.map((p) => ({ ...p, statsCharId: charId })),
        owner: "team",
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
   * Get pre-computed rank weights for a formula (accepts per-triggerer or base ID).
   * Returns undefined if not pre-computed (falls back to dynamic ranking).
   */
  getRankWeights(formulaId: string): Map<string, number> | undefined {
    const base = this.baseIdFor[formulaId] ?? formulaId;
    return this.rankWeights[base];
  }

  /**
   * Compute rank weights and create N-part multi-contributor entries.
   * Called by TeamBuild after construction using baseline stats.
   * For each multi-contributor base reaction, creates a single FormulaEntry
   * with N parts (one per eligible character), each with a weighted LunarFormula.
   */
  finalizeMultiContributorEntries(
    teamStats: Record<string, StatSheet>,
    charLevels: Record<string, number>,
    ctx: CalcContext
  ): void {
    for (const baseId of Object.keys(this.baseEligible)) {
      const eligible = this.baseEligible[baseId];
      if (!eligible || eligible.length === 0) continue;

      // Check if this is a multi-contributor reaction
      const baseReaction = baseId.startsWith("rx-")
        ? baseId.slice(3)
        : undefined;
      if (
        !baseReaction ||
        !MULTI_CONTRIBUTOR_REACTIONS.has(baseReaction as ReactionType)
      )
        continue;

      // Get the base formula from any per-triggerer entry
      const sampleEntry = this.formulas[`${baseId}-${eligible[0]}`];
      if (!sampleEntry) continue;
      const baseFormula = sampleEntry.parts[0].formula;

      // Compute rank weights
      const weights = computeLunarRankWeights(
        baseFormula,
        eligible,
        teamStats,
        charLevels,
        ctx
      );
      this.rankWeights[baseId] = weights;

      // Create N-part entry with weighted LunarFormulas.
      // The on-field character's part is on-field; all others are off-field.
      const onFieldCharId = this.guessOnFieldChar(baseId) ?? eligible[0];
      // Build parts with on-field character first so parts[0].statsCharId
      // is always the on-field character (used by combo line charId resolution).
      const orderedEligible = [
        onFieldCharId,
        ...eligible.filter((id) => id !== onFieldCharId),
      ];
      const parts: FormulaPart[] = [];
      for (const charId of orderedEligible) {
        const w = weights.get(charId) ?? 0;
        if (w === 0) continue;
        const weightedFormula = new LunarFormula(
          baseFormula.talentMultiplier,
          baseFormula.tag,
          baseFormula.scalingKey as "atk" | "hp" | "def" | "em",
          baseFormula.extraTerm,
          w
        );
        const offField = charId !== onFieldCharId;
        parts.push({
          formula: weightedFormula,
          hits: 1,
          statsCharId: charId,
          offField: offField || undefined,
        });
      }

      const label = this.baseLabels[baseId] ?? sampleEntry.label;
      this.formulas[baseId] = {
        label,
        parts,
        owner: "team",
        isMultiContributor: true,
      };
    }
  }

  /** IFormulaProvider — all per-triggerer reaction formula IDs with i18n labels. */
  get formulaIds(): Record<string, I18nLabel> {
    return this.getFormulaIds();
  }

  /** All reaction formula IDs with i18n labels (per-triggerer + multi-contributor base). */
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

  // ─── Internal helpers ───

  /** Get the base reaction ID from a per-triggerer formula ID.
   *  e.g. "rx-overloaded-amber" → "rx-overloaded" */
  getBaseId(formulaId: string): string | undefined {
    return this.baseIdFor[formulaId];
  }
}
