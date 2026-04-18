import type { Element } from "@/data/types";

import type { LunarReactionType, ReactionType, StatKey } from "./types";

// ─── Reaction Groups ───

export const LUNAR_REACTIONS: LunarReactionType[] = [
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
];

// ─── Scaled Stats ───

// ─── Level Multipliers (for transformative/additive reactions) ───

// ─── Reaction → Team Element Requirements ───

export const PHEC_ELEMENTS: Element[] = [
  "Pyro",
  "Hydro",
  "Electro",
  "Cryo",
] as const;

type ReactionRequirement = {
  /** Each inner array is an OR group of elements that must each have ≥1 member */
  readonly requiredElements: Element[][];
  /** Additional constraint: at least one participant must be a 5★ Moonsign faction member */
  readonly requiresMoonsign5StarParticipant?: boolean;
  /** Additional constraint: at least one team member (doesn't have to be the participants) must be a Geo or Claymore */
  readonly requiresGeoOrClaymore?: boolean;
};

export const REACTION_ELEMENT_REQUIREMENTS: Record<
  ReactionType,
  ReactionRequirement
> = {
  none: { requiredElements: [] },
  melt: { requiredElements: [["Pyro"], ["Cryo"]] },
  vaporize: { requiredElements: [["Pyro"], ["Hydro"]] },
  overloaded: { requiredElements: [["Pyro"], ["Electro"]] },
  electroCharged: { requiredElements: [["Hydro"], ["Electro"]] },
  superconduct: { requiredElements: [["Cryo"], ["Electro"]] },
  swirl: {
    requiredElements: [["Anemo"], PHEC_ELEMENTS],
  },
  bloom: { requiredElements: [["Hydro"], ["Dendro"]] },
  hyperbloom: { requiredElements: [["Hydro"], ["Dendro"], ["Electro"]] },
  burgeon: { requiredElements: [["Hydro"], ["Dendro"], ["Pyro"]] },
  burning: { requiredElements: [["Pyro"], ["Dendro"]] },
  quicken: { requiredElements: [["Dendro"], ["Electro"]] },
  spread: { requiredElements: [["Dendro"], ["Electro"]] },
  aggravate: { requiredElements: [["Dendro"], ["Electro"]] },
  frozen: { requiredElements: [["Cryo"], ["Hydro"]] },
  shatter: {
    requiredElements: [["Cryo"], ["Electro"]],
    requiresGeoOrClaymore: true,
  },
  lunarCharged: {
    requiredElements: [["Hydro"], ["Electro"]],
    requiresMoonsign5StarParticipant: true,
  },
  lunarBloom: {
    requiredElements: [["Hydro"], ["Dendro"]],
    requiresMoonsign5StarParticipant: true,
  },
  crystallize: {
    requiredElements: [["Geo"], PHEC_ELEMENTS],
  },
  lunarCrystallize: {
    requiredElements: [["Hydro"], ["Geo"]],
    requiresMoonsign5StarParticipant: true,
  },
};

/**
 * Reactions that have aura/trigger semantics: the enemy must have a specific
 * aura element for the character's trigger element to produce the reaction.
 * When enemyAura is set, it fixes the aura side.
 */
export const REACTION_AURA_TRIGGER: Partial<
  Record<ReactionType, { aura: Element; trigger: Element }[]>
> = {
  melt: [
    { aura: "Cryo", trigger: "Pyro" },
    { aura: "Pyro", trigger: "Cryo" },
  ],
  vaporize: [
    { aura: "Pyro", trigger: "Hydro" },
    { aura: "Hydro", trigger: "Pyro" },
  ],
  spread: [{ aura: "Electro", trigger: "Dendro" }],
  aggravate: [{ aura: "Dendro", trigger: "Electro" }],
};

/** Eligible amplifying/catalyze reactions per element for the reaction selector UI. */
export const ELEMENT_ELIGIBLE_REACTIONS: Record<
  Element | "Physical",
  ReactionType[]
> = {
  Pyro: ["none", "vaporize", "melt"],
  Hydro: ["none", "vaporize"],
  Cryo: ["none", "melt"],
  Electro: ["none", "aggravate"],
  Dendro: ["none", "spread"],
  Anemo: ["none"],
  Geo: ["none"],
  Physical: ["none"],
};

/**
 * Characters whose formulas contain parts with elements different from their
 * innate element (e.g. Chasca/Varka convert attacks to teammate elements).
 * For these characters, reaction eligibility is derived from formula parts
 * instead of the character's own element.
 */
export const MULTI_ELEMENT_CHARS = new Set(["chasca", "varka"]);

/**
 * Derive the available reaction types for a specific formula, given
 * team composition and element eligibility.
 *
 * Returns e.g. `["none", "melt"]` for a Pyro formula on a team with Cryo.
 * Returns `["none"]` for Anemo/Geo/Physical or when team can't trigger reactions.
 *
 * Used by FormulaSelectorCard (combo/single mode) and AnalyzerComboTab.
 */
export function getFormulaReactions(
  charId: string,
  formulaEntry: { parts: { formula: { tag: { element: string } } }[] } | null,
  charElement: string | undefined,
  hasReaction: (reaction: ReactionType, charId?: string) => boolean
): ReactionType[] {
  if (!charElement) return ["none"];

  const isMultiElement = MULTI_ELEMENT_CHARS.has(charId);

  if (isMultiElement && formulaEntry) {
    const rxSet = new Set<ReactionType>(["none"]);
    for (const part of formulaEntry.parts) {
      const partEl = part.formula.tag.element;
      const partEligible =
        ELEMENT_ELIGIBLE_REACTIONS[
          partEl as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
        ];
      if (partEligible) for (const rx of partEligible) rxSet.add(rx);
    }
    return Array.from(rxSet).filter((rx) => rx === "none" || hasReaction(rx));
  }

  const eligible: ReactionType[] = ELEMENT_ELIGIBLE_REACTIONS[
    charElement as keyof typeof ELEMENT_ELIGIBLE_REACTIONS
  ] ?? ["none"];

  return eligible.filter((rx) => rx === "none" || hasReaction(rx, charId));
}

/** Characters who always have 0 energy during their damage window (e.g., energy consumed on burst cast). */
export const ZERO_ENERGY_CHARS = new Set(["skirk", "mavuika"]);

/**
 * When a lunar reaction is possible, it supersedes the base reaction.
 * electroCharged/bloom: full supersede (identical element requirements).
 * crystallize: partial — only the Hydro+Geo combination becomes lunar;
 *   other PHEC+Geo combinations still produce regular crystallize.
 */
export const LUNAR_SUPERSEDES: Partial<
  Record<
    ReactionType,
    {
      lunar: LunarReactionType;
      /** Base reaction survives if team has any of these elements
       *  (they can still trigger the non-lunar base with Geo). */
      survivalElements?: Element[];
    }
  >
> = {
  electroCharged: { lunar: "lunarCharged" },
  bloom: { lunar: "lunarBloom" },
  crystallize: {
    lunar: "lunarCrystallize",
    survivalElements: ["Pyro", "Electro", "Cryo"],
  },
}; // ─── All possible artifact stat keys ───
/** Stats that can appear on artifacts (main + sub). */
export const ARTIFACT_STAT_KEYS: StatKey[] = [
  "hp",
  "hp%",
  "atk",
  "atk%",
  "def",
  "def%",
  "em",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "electro%",
  "cryo%",
  "dendro%",
  "anemo%",
  "geo%",
  "phys%",
]; // Reaction tag color palette
export const REACTION_COLORS: Partial<Record<ReactionType, string>> = {
  melt: "#E57373", // Pyro + Cryo (coral red)
  vaporize: "#81D4FA", // Pyro + Hydro (steam blue)
  spread: "#A8E063", // Dendro green
  aggravate: "#BB86FC", // Electro purple
  overloaded: "#FF6347", // Pyro-Electro explosion (tomato red-orange)
  electroCharged: "#9370DB", // Electro-Hydro (purple-blue)
  superconduct: "#B8C4FF", // Cryo-Electro (icy blue-purple)
  swirl: "#64FFDA", // Anemo teal
  frozen: "#B8C4FF", // Cryo-Hydro (icy blue-purple)
  bloom: "#7CB342", // Dendro core green
  hyperbloom: "#7C4DFF", // Electro purple (hitting core)
  burgeon: "#FF7043", // Pyro orange-red (hitting core)
  burning: "#FF9800", // Pyro flame orange
  lunarCharged: "#B8A5E3", // Lighter electro-charged purple
  lunarBloom: "#A5D86E", // Lighter bloom green
  lunarCrystallize: "#FFE082", // Lighter Geo golden
};
export const CUSTOM_STAT_OPTIONS: StatKey[] = [
  "atk",
  "hp",
  "def",
  "em",
  "atk%",
  "hp%",
  "def%",
  "er",
  "cr",
  "cd",
  "pyro%",
  "hydro%",
  "anemo%",
  "electro%",
  "dendro%",
  "cryo%",
  "geo%",
  "phys%",
  "dmg%",
  "reactionDmg%",
  "baseDmg%",
  "baseDmg",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
];
