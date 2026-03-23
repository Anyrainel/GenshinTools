import type { Element } from "@/data/types";

import type { LunarReactionType, ReactionType } from "./types";

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
