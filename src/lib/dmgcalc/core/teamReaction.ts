/**
 * Team-level reaction formula provider.
 *
 * Auto-generates transformative and lunar reaction formulas based on team
 * composition and enemy aura, avoiding duplicates where characters already
 * define the reaction in their own formulaMap.
 */

import type { Element, ElementalOrPhysical, ReactionType } from "@/data/enums";
import { i18nAppData } from "@/data/i18n-app";
import {
  LUNAR_REACTIONS,
  PHEC_ELEMENTS,
  STELLAR_REACTIONS,
} from "../constants";
import type {
  CalcContext,
  FormulaEntry,
  FormulaPart,
  I18nLabel,
  ReactionComboEntry,
} from "../types";
import {
  LunarFormula,
  StellarFormula,
  TransformFormula,
} from "./damageFormula";
import type { IFormulaProvider } from "./implModel";
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
  stellarConduct: "Cryo",
  stellarSwirl: "Cryo",
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
  stellarConduct: ["Cryo", "Electro"],
  stellarSwirl: ["Anemo", "Cryo"],
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

/** Multi-contributor reactions whose damage aggregates team participants. */
export const MULTI_CONTRIBUTOR_REACTIONS: ReadonlySet<ReactionType> = new Set([
  "lunarCharged",
  "lunarCrystallize",
  "stellarSwirl",
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
      // Emit per-on-field-char ID so the formula lookup matches the per-triggerer entry
      result[`${entry.id}-${entry.onFieldCharId}`] = total;
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

  /** All contributors for reactions whose trigger subset is narrower. */
  private readonly baseContributors: Record<string, string[]> = {};

  /** Map per-triggerer formula ID → base reaction ID. */
  private readonly baseIdFor: Record<string, string> = {};

  /** Labels per base reaction ID (for UI grid display). */
  private readonly baseLabels: Record<string, I18nLabel> = {};

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
        owner: charId,
      };
      this.baseIdFor[id] = baseId;
    }
  }

  constructor(private readonly teamMeta: TeamMeta) {
    const charIds = teamMeta.characters;

    // Collect team element info
    const teamElementChars = new Map<Element, string[]>();
    for (const charId of charIds) {
      const el = teamMeta.elements[charId];
      if (!el) continue;
      if (!teamElementChars.has(el)) teamElementChars.set(el, []);
      teamElementChars.get(el)!.push(charId);
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
        charIds.includes("nilou") &&
        charIds.every((id) => {
          const e = teamMeta.elements[id];
          return e === "Dendro" || e === "Hydro";
        })
      ) {
        label = { en: "Bountiful Core", zh: "丰穰之核" };
      }

      this.registerPerTriggerer(baseId, label, [{ formula }], eligible);
    }

    // Generate stellar reaction formulas (per-triggerer)
    for (const reaction of STELLAR_REACTIONS) {
      if (!teamMeta.hasReaction(reaction)) continue;
      const element = REACTION_DAMAGE_ELEMENT[reaction];
      if (!element) continue;

      const baseId = `rx-${reaction}`;
      const label = i18nAppData.reactions[reaction] ?? {
        en: reaction,
        zh: reaction,
      };
      const parts =
        reaction === "stellarSwirl"
          ? [
              {
                formula: new StellarFormula(0.75, {
                  element: "Anemo",
                  ability: "special",
                  reaction,
                }),
              },
              {
                // Peak optimizer assumption: two or more SSw triggers upgrade
                // the Vortex to level 2 (3.0 coefficient; level 1 is 2.0).
                formula: new StellarFormula(3.0, {
                  element: "Cryo",
                  ability: "special",
                  reaction,
                }),
              },
            ]
          : [
              {
                formula: new StellarFormula(0, {
                  element,
                  ability: "special",
                  reaction,
                }),
              },
            ];
      const contributors = this.findEligibleChars(reaction, teamElementChars);
      const eligible =
        reaction === "stellarSwirl"
          ? (teamElementChars.get("Anemo") ?? [])
          : contributors;
      if (reaction === "stellarSwirl") {
        this.baseContributors[baseId] = contributors;
      }

      this.registerPerTriggerer(baseId, label, parts, eligible);
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
    // Return in team-slot order
    return this.teamMeta.characters.filter((id) => eligible.has(id));
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

      if (baseReaction === "stellarSwirl") {
        this.finalizeStellarSwirlEntries(
          baseId,
          eligible,
          sampleEntry,
          teamStats,
          charLevels,
          ctx
        );
        continue;
      }
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

      // Update per-triggerer entries with weighted multi-contributor parts.
      // Each per-triggerer entry represents "this reaction with charId on-field",
      // so parts[0] is always the on-field character.
      for (const onFieldId of eligible) {
        const perTrigId = `${baseId}-${onFieldId}`;
        const ordered = [
          onFieldId,
          ...eligible.filter((id) => id !== onFieldId),
        ];
        const perTrigParts: FormulaPart[] = [];
        for (const charId of ordered) {
          const w = weights.get(charId) ?? 0;
          if (w === 0) continue;
          const weightedFormula = new LunarFormula(
            baseFormula.talentMultiplier,
            baseFormula.tag,
            baseFormula.scalingKey as "atk" | "hp" | "def" | "em",
            baseFormula.extraTerm,
            w
          );
          perTrigParts.push({
            formula: weightedFormula,
            hits: 1,
            statsCharId: charId,
            offField: charId !== onFieldId || undefined,
          });
        }
        const label = this.baseLabels[baseId] ?? sampleEntry.label;
        this.formulas[perTrigId] = {
          label,
          parts: perTrigParts,
          owner: onFieldId,
          isMultiContributor: true,
        };
      }
    }
  }

  private finalizeStellarSwirlEntries(
    baseId: string,
    eligible: string[],
    sampleEntry: FormulaEntry,
    teamStats: Record<string, StatSheet>,
    charLevels: Record<string, number>,
    ctx: CalcContext
  ): void {
    const initial = sampleEntry.parts[0]?.formula;
    const vortex = sampleEntry.parts[1]?.formula;
    if (!initial || !vortex) return;

    const ranked = (formula: FormulaPart["formula"], ids: string[]) =>
      [...ids].sort(
        (a, b) =>
          formula.calc(teamStats[b]!, charLevels[b] ?? 90, ctx) -
          formula.calc(teamStats[a]!, charLevels[a] ?? 90, ctx)
      );
    const contributors = this.baseContributors[baseId] ?? eligible;
    const anemoIds = contributors.filter(
      (id) => this.teamMeta.elements[id] === "Anemo"
    );
    const cryoIds = contributors.filter(
      (id) => this.teamMeta.elements[id] === "Cryo"
    );

    const vortexWeights = new Map<string, number>();
    const cryoPrimary = ranked(vortex, cryoIds)[0];
    const anemoPrimary = ranked(vortex, anemoIds)[0];
    if (cryoPrimary) vortexWeights.set(cryoPrimary, 0.6);
    if (anemoPrimary) vortexWeights.set(anemoPrimary, 0.3);
    const vortexRest = ranked(
      vortex,
      contributors.filter((id) => id !== cryoPrimary && id !== anemoPrimary)
    );
    [0.05, 0.05].forEach((weight, index) => {
      const id = vortexRest[index];
      if (id) vortexWeights.set(id, weight);
    });
    // Keep the Vortex weights available through the existing catalog API.
    this.rankWeights[baseId] = vortexWeights;

    for (const onFieldId of eligible) {
      const initialWeights = new Map<string, number>([[onFieldId, 0.6]]);
      const initialRest = ranked(
        initial,
        contributors.filter((id) => id !== onFieldId)
      );
      [0.3, 0.05, 0.05].forEach((weight, index) => {
        const id = initialRest[index];
        if (id) initialWeights.set(id, weight);
      });
      const perTrigParts: FormulaPart[] = [];
      for (const [formula, weights] of [
        [initial, initialWeights],
        [vortex, vortexWeights],
      ] as const) {
        const ordered = [
          onFieldId,
          ...contributors.filter((id) => id !== onFieldId),
        ];
        for (const charId of ordered) {
          const weight = weights.get(charId) ?? 0;
          if (weight === 0) continue;
          perTrigParts.push({
            formula: new StellarFormula(
              formula.talentMultiplier,
              formula.tag,
              formula.scalingKey as "atk" | "hp" | "def" | "em",
              formula.extraTerm,
              weight
            ),
            hits: 1,
            statsCharId: charId,
            offField: charId !== onFieldId || undefined,
          });
        }
      }
      this.formulas[`${baseId}-${onFieldId}`] = {
        label: this.baseLabels[baseId] ?? sampleEntry.label,
        parts: perTrigParts,
        owner: onFieldId,
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

  /** Get the FormulaEntry for a reaction formula ID. */
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

  /** Guess the on-field character for a base reaction (internal use only). */
  private guessOnFieldChar(baseId: string): string | undefined {
    const eligible = this.baseEligible[baseId] ?? [];
    const priority = ["flins", "zibai", "ineffa", "linnea", "columbina"];
    for (const charId of priority) {
      if (eligible.includes(charId)) return charId;
    }
    return eligible[0] ?? this.teamMeta.characters[0];
  }

  // ─── Internal helpers ───

  /** Get the base reaction ID from a per-triggerer formula ID.
   *  e.g. "rx-overloaded-amber" → "rx-overloaded" */
  getBaseId(formulaId: string): string | undefined {
    return this.baseIdFor[formulaId];
  }
}
