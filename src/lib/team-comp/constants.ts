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
