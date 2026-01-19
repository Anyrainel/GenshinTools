export const THEME = {
  // Game-specific primitives (used across pages for game data display)
  rarity: {
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
  },
  element: {
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
  },
  tier: {
    bg: {
      S: "bg-tier-bg-s/40",
      A: "bg-tier-bg-a/40",
      B: "bg-tier-bg-b/40",
      C: "bg-tier-bg-c/40",
      D: "bg-tier-bg-d/40",
      Pool: "bg-tier-bg-pool/40",
    },
    color: {
      S: "bg-tier-s/70",
      A: "bg-tier-a/70",
      B: "bg-tier-b/70",
      C: "bg-tier-c/70",
      D: "bg-tier-d/70",
      Pool: "bg-tier-pool/70",
    },
  },

  // Page-level layout tokens (used across all pages)
  layout: {
    pageContainer:
      "h-dvh bg-gradient-mystical text-foreground flex flex-col overflow-hidden",
    headerBorder: "border-b border-border/50 bg-card/20 backdrop-blur-sm",
  },
} as const;
