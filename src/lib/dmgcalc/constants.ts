import type {
  Element,
  LunarReactionType,
  ReactionType,
  StatKey,
  StellarReactionType,
} from "@/data/enums";
import type { CalcContext, ReactionRequirement } from "./types";

/**
 * Stats that flow into the damage formula but never feed back into sheet stats.
 * ScalingBuffs that output to these keys can safely read from post-sheet-dynamic
 * stats (two-pass evaluation) without creating cycles.
 */
export const FINAL_STAT_KEYS: ReadonlySet<StatKey> = new Set([
  "baseDmg",
  "baseDmg%",
  "dmg%",
  "reactionDmg%",
  "reactionBaseDmg%",
  "elevated%",
  "reactionCr",
  "reactionCd",
  "atkSpd%",
  "defReduction%",
  "defIgnore%",
  "resReduction%",
]);

export const LUNAR_REACTIONS: LunarReactionType[] = [
  "lunarCharged",
  "lunarBloom",
  "lunarCrystallize",
];

export const STELLAR_REACTIONS: StellarReactionType[] = ["stellarConduct"];

export const PHEC_ELEMENTS: Element[] = [
  "Pyro",
  "Hydro",
  "Electro",
  "Cryo",
] as const;

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
  stellarConduct: {
    requiredElements: [["Cryo"], ["Electro"]],
    requiresStellarConductEnabler: true,
  },
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
};

/**
 * Stellar-Conduct supersedes transformative Superconduct when Sandrone is in
 * the party (Sandrone P3: party Superconduct procs become Stellar-Conduct).
 * hasReaction("superconduct") returns false in that case; only one transformative
 * Cryo+Electro proc exists. Cryo+Electro team resonance (Physical RES shred) is
 * unchanged — it is not gated by this map.
 */
export const STELLAR_SUPERSEDES: Partial<
  Record<ReactionType, { stellar: StellarReactionType }>
> = {
  superconduct: { stellar: "stellarConduct" },
};

/** Cryo/Electro attach-count multiplier for StellarDirectFormula (skill direct SC hits). */
/**
 * Datamine Base Stellar-Conduct DMG coefficient by recorded hit count (index = hits).
 * Source: kuroo / meowtews via 6.7 live data; Honey Impact / Gachabase tutorials.
 * Index 0 = no buff; 1–10 = pre-launch cap; 11–12 = 6.7 launch stack extension.
 */
export const STELLAR_DIRECT_COEFF_BY_HITS: readonly number[] = [
  1.0, 1.45, 1.5, 1.54, 1.6, 1.64, 1.7, 1.75, 1.79, 1.85, 1.89, 1.95, 2.0,
];

/** UI slider range for Polestar Field attach hits (launch cap: 12 hits / 2.0×). */
export const STELLAR_ATTACH_HITS_MIN = 1;
export const STELLAR_ATTACH_HITS_MAX = 12;
/** Default attach hits (index 5 → 1.64×, near old 1.6 placeholder). */
export const STELLAR_ATTACH_HITS_DEFAULT = 5;
/** Launch datamine table supports up to 12 hits (coeff 2.0). */
export const STELLAR_ATTACH_HITS_TABLE_MAX =
  STELLAR_DIRECT_COEFF_BY_HITS.length - 1;

export const STELLAR_DIRECT_COEFF_MIN = STELLAR_DIRECT_COEFF_BY_HITS[1]!;
/** Max coeff at 12 recorded hits (datamine index 12). */
export const STELLAR_DIRECT_COEFF_MAX =
  STELLAR_DIRECT_COEFF_BY_HITS[STELLAR_ATTACH_HITS_TABLE_MAX]!;
export const STELLAR_DIRECT_COEFF_DEFAULT =
  STELLAR_DIRECT_COEFF_BY_HITS[STELLAR_ATTACH_HITS_DEFAULT]!;

/** Stats that can appear on artifacts, for idle stats extraction. */
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
];
export const DEFAULT_CALC_CONTEXT: CalcContext = {
  enemyLevel: 110,
  enemyRes: 0.1,
  rollMultiplier: 0.85,
  substatBudget: "8_6",
};
