import type { Element, Rarity, ReactionType, Tier } from "@/data/enums";
import type { BuffReceiverType } from "@/lib/dmgcalc/types";

// ============================================================
// DYNAMIC COLOR HELPERS
// ============================================================
const RARITY_COLORS = {
  bg: {
    1: "bg-rarity-1",
    2: "bg-rarity-2",
    3: "bg-rarity-3",
    4: "bg-rarity-4",
    5: "bg-rarity-5",
  },
  text: {
    1: "text-rarity-1",
    2: "text-rarity-2",
    3: "text-rarity-3",
    4: "text-rarity-4",
    5: "text-rarity-5",
  },
  border: {
    1: "border-rarity-1",
    2: "border-rarity-2",
    3: "border-rarity-3",
    4: "border-rarity-4",
    5: "border-rarity-5",
  },
} as const;

export function getRarityColor(
  rarity: Rarity,
  type: "bg" | "text" | "border"
): string {
  return RARITY_COLORS[type][rarity as 1 | 2 | 3 | 4 | 5] || "";
}
const ELEMENT_COLORS = {
  bg: {
    Pyro: "bg-element-pyro/60",
    Hydro: "bg-element-hydro/60",
    Electro: "bg-element-electro/60",
    Cryo: "bg-element-cryo/60",
    Anemo: "bg-element-anemo/60",
    Geo: "bg-element-geo/60",
    Dendro: "bg-element-dendro/60",
  },
  text: {
    Pyro: "text-element-pyro",
    Hydro: "text-element-hydro",
    Electro: "text-element-electro",
    Cryo: "text-element-cryo",
    Anemo: "text-element-anemo",
    Geo: "text-element-geo",
    Dendro: "text-element-dendro",
  },
  border: {
    Pyro: "border-element-pyro/40",
    Hydro: "border-element-hydro/40",
    Electro: "border-element-electro/40",
    Cryo: "border-element-cryo/40",
    Anemo: "border-element-anemo/40",
    Geo: "border-element-geo/40",
    Dendro: "border-element-dendro/40",
  },
  bgSubtle: {
    Pyro: "bg-element-pyro/20",
    Hydro: "bg-element-hydro/20",
    Electro: "bg-element-electro/20",
    Cryo: "bg-element-cryo/20",
    Anemo: "bg-element-anemo/20",
    Geo: "bg-element-geo/20",
    Dendro: "bg-element-dendro/20",
  },
} as const;

export function getElementColor(
  element: Element,
  type: "bg" | "text" | "border" | "bgSubtle"
): string {
  return ELEMENT_COLORS[type][element] || "";
}
const TIER_COLORS = {
  bg: {
    s: "bg-tier-bg-s/40",
    a: "bg-tier-bg-a/40",
    b: "bg-tier-bg-b/40",
    c: "bg-tier-bg-c/40",
    d: "bg-tier-bg-d/40",
    pool: "bg-tier-bg-pool/40",
  },
  header: {
    s: "bg-tier-s/70",
    a: "bg-tier-a/70",
    b: "bg-tier-b/70",
    c: "bg-tier-c/70",
    d: "bg-tier-d/70",
    pool: "bg-tier-pool/70",
  },
} as const;

export function getTierColor(
  tier: Tier,
  type: "bg" | "header" // header corresponds to the old 'color' key (stronger opacity)
): string {
  const key = tier.toLowerCase() as keyof typeof TIER_COLORS.bg;
  return TIER_COLORS[type][key] || TIER_COLORS[type].pool;
}
// ── Element hex (for canvas/chart rendering) ──

export const ELEMENT_HEX: Record<string, string> = {
  Pyro: "#b8483f",
  Hydro: "#22728f",
  Electro: "#8f70aa",
  Cryo: "#7aa8b8",
  Anemo: "#3d9b6a",
  Geo: "#b58f35",
  Dendro: "#669423",
};
// ── Stat value colors (positive / negative / cap) ──

export const VALUE_COLORS = {
  positive: "text-green-500 dark:text-green-400",
  negative: "text-red-500 dark:text-red-400",
  cap: "text-orange-500 dark:text-orange-400",
} as const;
export function getValueColor(value: number): string {
  return value > 0 ? VALUE_COLORS.positive : VALUE_COLORS.negative;
}
// ── Buff receiver badge colors ──
const RECEIVER_BADGE_COLORS: Record<string, string> = {
  charId: "text-sky-300 bg-sky-500/25",
  team: "text-yellow-300 bg-yellow-500/15",
  teamOnField: "text-orange-300 bg-orange-500/25",
  teamOffField: "text-amber-300 bg-amber-500/25",
  other: "text-rose-300 bg-rose-500/15",
  otherOnField: "text-pink-300 bg-pink-500/15",
  otherOffField: "text-fuchsia-300 bg-fuchsia-500/15",
  self: "text-zinc-400 bg-zinc-500/15",
  selfOnField: "text-slate-400 bg-slate-500/15",
  selfOffField: "text-stone-400 bg-stone-500/15",
};

export function getReceiverColor(
  receiver: BuffReceiverType,
  hasCharId?: boolean
): string {
  if (hasCharId) return RECEIVER_BADGE_COLORS.charId;
  return RECEIVER_BADGE_COLORS[receiver] ?? "text-muted-foreground bg-black/10";
}
// ── Triage tier colors ──

export const TRIAGE_TIER_COLORS = {
  badge: {
    prime: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    solid: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    filler: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    fodder: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  } as Record<string, string>,
  text: {
    prime: "text-amber-300",
    solid: "text-purple-300",
    filler: "text-blue-300",
    fodder: "text-zinc-400",
  } as Record<string, string>,
} as const;

export function getTriageTierColor(
  tier: string,
  type: "badge" | "text"
): string {
  return TRIAGE_TIER_COLORS[type][tier] ?? TRIAGE_TIER_COLORS[type].fodder;
}
// ── Sentiment badge colors (good/bad indicators) ──

export const SENTIMENT_BADGE = {
  positive: "bg-green-500/10 text-green-400 border-green-500/20",
  negative: "bg-red-500/10 text-red-400 border-red-500/20",
} as const;
// ── Chip color schemes (FilterChip / CategoryChip) ──

export const CHIP_COLORS = {
  teal: {
    active: "bg-teal-500/25 border-teal-500/40 text-teal-300",
    inactive:
      "bg-teal-500/10 border-teal-500/25 text-teal-400/60 hover:text-teal-400/80",
    icon: "text-teal-400",
  },
  orange: {
    active: "bg-orange-500/25 border-orange-500/40 text-orange-300",
    inactive:
      "bg-orange-500/10 border-orange-500/25 text-orange-400/60 hover:text-orange-400/80",
    icon: "text-orange-400",
  },
  amber: {
    active: "bg-amber-500/25 border-amber-500/40 text-amber-400",
    inactive:
      "bg-amber-500/10 border-amber-500/25 text-amber-400/60 hover:text-amber-400/80",
    icon: "text-amber-400",
  },
  sky: {
    active: "bg-sky-500/25 border-sky-500/40 text-sky-300",
    inactive:
      "bg-sky-500/10 border-sky-500/25 text-sky-400/60 hover:text-sky-400/80",
    icon: "text-sky-400",
  },
  lime: {
    active: "bg-lime-500/25 border-lime-500/40 text-lime-300",
    inactive:
      "bg-lime-500/10 border-lime-500/25 text-lime-400/60 hover:text-lime-400/80",
    icon: "text-lime-400",
  },
  "rarity-5": {
    active: "bg-rarity-5/25 border-rarity-5/50 text-rarity-5",
    inactive:
      "bg-rarity-5/10 border-rarity-5/30 text-rarity-5/60 hover:text-rarity-5/80",
    icon: "text-rarity-5",
  },
  "rarity-4": {
    active: "bg-rarity-4/25 border-rarity-4/50 text-rarity-4",
    inactive:
      "bg-rarity-4/10 border-rarity-4/30 text-rarity-4/60 hover:text-rarity-4/80",
    icon: "text-rarity-4",
  },
  "rarity-3": {
    active: "bg-rarity-3/25 border-rarity-3/50 text-rarity-3",
    inactive:
      "bg-rarity-3/10 border-rarity-3/30 text-rarity-3/60 hover:text-rarity-3/80",
    icon: "text-rarity-3",
  },
} as const;

export type ChipColor =
  keyof typeof CHIP_COLORS; /** Unique weapon secondary stats from weapon_stats (L90), sorted. */
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
