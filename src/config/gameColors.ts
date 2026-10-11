import type { Element, ReactionType } from "@/data/enums";

export const ELEMENT_HEX: Readonly<Record<Element, string>> = {
  Pyro: "#b8483f",
  Hydro: "#22728f",
  Electro: "#8f70aa",
  Cryo: "#7aa8b8",
  Anemo: "#3d9b6a",
  Geo: "#b58f35",
  Dendro: "#669423",
};

export const TIER_TOKENS = {
  s: "#b92f3a",
  a: "#dd8559",
  b: "#e6b44d",
  c: "#43ad8b",
  d: "#4a85cd",
  pool: "#757575",
  "bg-s": "#2e0c0f",
  "bg-a": "#372116",
  "bg-b": "#3a2d13",
  "bg-c": "#112b23",
  "bg-d": "#132133",
  "bg-pool": "#1d1d1d",
} as const;

export const RARITY_TOKENS = {
  "1": "#868586",
  "2": "#519072",
  "3": "#5392b8",
  "4": "#9c75b7",
  "5": "#b27330",
} as const;

export const RARITY_GRADIENTS = {
  "rarity-gradient-1": "linear-gradient(180deg, #6a6d74, #868586)",
  "rarity-gradient-2": "linear-gradient(180deg, #4b6c67, #519072)",
  "rarity-gradient-3": "linear-gradient(180deg, #567496, #5392b8)",
  "rarity-gradient-4": "linear-gradient(180deg, #5e5789, #9c75b7)",
  "rarity-gradient-5": "linear-gradient(180deg, #945c2c, #b27330)",
} as const;

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
  stellarConduct: "#9AD4FF", // Cryo-Electro stellar (bright icy blue)
  stellarSwirl: "#8FFFD4", // Cryo-Anemo stellar (bright icy teal)
};

export const ELEMENT_BACKGROUND = "#f5f3e6";

export const NEUTRAL_GAME_COLOR = "#888";

/** Item chrome is distinct from rarity and theme surfaces. */
export const ITEM_TOKENS = {
  badge: { DEFAULT: "#4a3b2a", foreground: "#eccf83" },
  level: { DEFAULT: "#f5f0e6", foreground: "#3d3d3d" },
  mixed: "#3a2d13",
} as const;
