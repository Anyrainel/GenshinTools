import type { Element, Rarity, Tier } from "@/data/types";
import type { BuffReceiverType } from "@/lib/team-comp/types";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the full URL for an asset path
 * Prepends the Vite base URL for proper asset loading
 */
export function getAssetUrl(path: string): string {
  const BASE_URL = import.meta.env.BASE_URL || "/";

  // If path already starts with BASE_URL, return as-is
  if (path.startsWith(BASE_URL)) {
    return path;
  }

  // If path starts with /, prepend BASE_URL (removing trailing slash if needed)
  if (path.startsWith("/")) {
    const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
    return base + path;
  }

  // Otherwise, just prepend BASE_URL
  return BASE_URL + path;
}

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
} as const;

export function getElementColor(element: Element, type: "bg" | "text"): string {
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
  charId: "text-sky-300 bg-sky-500/15",
  team: "text-yellow-300 bg-yellow-500/15",
  teamOnField: "text-orange-300 bg-orange-500/15",
  teamOffField: "text-amber-300 bg-amber-500/15",
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
    P: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Q: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    N: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    T: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  } as Record<string, string>,
  text: {
    P: "text-amber-300",
    Q: "text-purple-300",
    N: "text-blue-300",
    T: "text-zinc-400",
  } as Record<string, string>,
} as const;

export function getTriageTierColor(
  tier: string,
  type: "badge" | "text"
): string {
  return TRIAGE_TIER_COLORS[type][tier] ?? TRIAGE_TIER_COLORS[type].T;
}

// ── Sentiment badge colors (good/bad indicators) ──

export const SENTIMENT_BADGE = {
  positive: "bg-green-500/20 text-green-300 border-green-500/30",
  negative: "bg-red-500/20 text-red-300 border-red-500/30",
} as const;

// ── Chip color schemes (FilterChip / CategoryChip) ──

export const CHIP_COLORS = {
  teal: {
    active: "bg-teal-500/15 border-teal-500/40 text-teal-300",
    inactive: "border-transparent text-teal-400/60 hover:text-teal-400/80",
    icon: "text-teal-400",
  },
  orange: {
    active: "bg-orange-500/15 border-orange-500/40 text-orange-300",
    inactive: "border-transparent text-orange-400/60 hover:text-orange-400/80",
    icon: "text-orange-400",
  },
  amber: {
    active: "bg-amber-500/15 border-amber-500/40 text-amber-400",
    inactive: "border-transparent text-amber-400/60 hover:text-amber-400/80",
    icon: "text-amber-400",
  },
  sky: {
    active: "bg-sky-500/15 border-sky-500/40 text-sky-300",
    inactive: "border-transparent text-sky-400/60 hover:text-sky-400/80",
    icon: "text-sky-400",
  },
  "rarity-5": {
    active: "bg-rarity-5/25 border-rarity-5/50 text-rarity-5",
    inactive: "border-transparent text-rarity-5/60 hover:text-rarity-5/80",
    icon: "text-rarity-5",
  },
  "rarity-4": {
    active: "bg-rarity-4/25 border-rarity-4/50 text-rarity-4",
    inactive: "border-transparent text-rarity-4/60 hover:text-rarity-4/80",
    icon: "text-rarity-4",
  },
  "rarity-3": {
    active: "bg-rarity-3/25 border-rarity-3/50 text-rarity-3",
    inactive: "border-transparent text-rarity-3/60 hover:text-rarity-3/80",
    icon: "text-rarity-3",
  },
} as const;

export type ChipColor = keyof typeof CHIP_COLORS;
