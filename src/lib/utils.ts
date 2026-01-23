import type { Element, Rarity, Tier } from "@/data/types";
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
