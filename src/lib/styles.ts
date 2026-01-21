/**
 * Centralized design tokens and style constants.
 *
 * This file contains reusable Tailwind class strings for:
 * - Game-specific visual tokens (rarity, element, tier colors)
 * - Layout patterns (page structure, panels, grids)
 *
 * Usage: import { STYLES } from "@/lib/styles"
 * Then use with cn(): className={cn(STYLES.layout.page, "additional-classes")}
 */

export const STYLES = {
  // ============================================================
  // GAME-SPECIFIC TOKENS
  // Used for displaying game data with appropriate visual styling
  // ============================================================

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

  // ============================================================
  // LAYOUT PATTERNS
  // Consistent structure for pages and major UI sections
  // ============================================================

  layout: {
    /**
     * Page container - wraps entire page content
     * Full viewport height, gradient background, flex column for header + content
     */
    page: "h-dvh bg-gradient-page text-foreground flex flex-col overflow-hidden",

    /**
     * Header border style - used for ToolHeader and secondary headers
     * Subtle bottom border with glass effect
     */
    headerBorder: "border-b border-border/50 bg-card/20 backdrop-blur-sm",

    /**
     * Main content area - sits below headers, takes remaining space
     * Use inside page container after header(s)
     */
    mainContent: "flex-1 overflow-hidden",

    /**
     * Content container - provides responsive max-width and padding
     * Centers content with appropriate margins for each screen size
     * Mobile: 0.5rem padding | Tablet: 1rem | Desktop: 2rem
     */
    container: "container mx-auto h-full",

    /**
     * Wide container - for content that needs more horizontal space
     * 95% width with max constraint, used for tier grids and large tables
     */
    wideContainer: "w-[95%] max-w-[1900px] mx-auto",
  },

  // ============================================================
  // PANEL LAYOUTS
  // For two-panel (sidebar + content) and single-panel views
  // ============================================================

  panel: {
    /**
     * Two-panel wrapper - flex container that stacks on mobile, side-by-side on desktop
     * Use lg: breakpoint for sidebar visibility
     */
    splitContainer: "flex flex-col lg:flex-row h-full gap-4 lg:gap-6",

    /**
     * Sidebar - hidden on mobile, fixed width on desktop
     * Typically contains filters, navigation, or secondary content
     */
    sidebar: "hidden lg:block lg:flex-shrink-0 h-full",

    /**
     * Main panel - takes remaining space, handles internal scrolling
     */
    mainPanel: "flex-1 min-w-0 flex flex-col h-full overflow-hidden",

    /**
     * Scrollable content area inside a panel
     */
    scrollArea: "flex-1 overflow-y-auto",
  },

  // ============================================================
  // GRID LAYOUTS
  // For responsive item grids (characters, weapons, artifacts, etc.)
  // ============================================================

  grid: {
    /**
     * Icon grid - for small items like character/weapon icons
     * 4 cols on mobile → 8+ on desktop
     */
    icons:
      "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2",

    /**
     * Card grid - for medium-sized cards
     * 2 cols on mobile → 4+ on desktop
     */
    cards:
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",

    /**
     * Large card grid - for cards that need more horizontal space
     * Auto-fit with minimum width, centers items
     */
    largeCards:
      "grid grid-cols-[repeat(auto-fit,minmax(400px,440px))] gap-4 justify-center",
  },

  // ============================================================
  // TEXT SIZE PATTERNS
  // For responsive typography
  // ============================================================

  text: {
    /**
     * Dense data - for tables/grids with many columns
     * 12px on mobile, 14px on tablet+
     */
    dense: "text-xs sm:text-sm",

    /**
     * Compact labels - for short labels in tight spaces
     * 11px on mobile, 12px on tablet+
     */
    compact: "text-[11px] sm:text-xs",
  },
} as const;

// Keep THEME as an alias for backwards compatibility during migration
export const THEME = STYLES;
