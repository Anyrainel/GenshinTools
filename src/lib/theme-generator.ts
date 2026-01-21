/**
 * Deterministic Theme Generation System
 *
 * Generates all CSS variables from 3 HSL seed values per theme.
 * This replaces the manual theme definitions in index.css.
 */

import type { ThemeId } from "@/contexts/ThemeContext";

// HSL color type
interface HSL {
  h: number;
  s: number;
  l: number;
}

// Theme seed definition - 3 colors define the entire palette
interface ThemeSeed {
  name: string;
  base: HSL; // Background floor, darkest layer
  glow1: HSL; // Primary accent, center glow (elemental color)
  glow2: HSL; // Secondary accent, arm glow
}

/**
 * Theme Seeds - Single source of truth for all theme colors.
 * Hues calibrated to official Genshin element colors.
 * Lightness varies by thematic intent (Snezhnaya=bright, Abyss=dark).
 */
export const THEME_SEEDS: Record<ThemeId, ThemeSeed> = {
  mondstadt: {
    name: "Mondstadt",
    base: { h: 155, s: 15, l: 10 },
    glow1: { h: 149, s: 40, l: 25 }, // Anemo green
    glow2: { h: 140, s: 34, l: 22 },
  },
  liyue: {
    name: "Liyue",
    base: { h: 40, s: 16, l: 9 },
    glow1: { h: 42, s: 40, l: 21 }, // Geo gold
    glow2: { h: 30, s: 34, l: 18 },
  },
  inazuma: {
    name: "Inazuma",
    base: { h: 275, s: 16, l: 8 },
    glow1: { h: 272, s: 38, l: 23 }, // Electro purple
    glow2: { h: 285, s: 34, l: 20 },
  },
  sumeru: {
    name: "Sumeru",
    base: { h: 85, s: 14, l: 9 },
    glow1: { h: 84, s: 40, l: 20 }, // Dendro green
    glow2: { h: 95, s: 34, l: 17 },
  },
  fontaine: {
    name: "Fontaine",
    base: { h: 198, s: 18, l: 8 },
    glow1: { h: 196, s: 44, l: 24 }, // Hydro blue
    glow2: { h: 210, s: 38, l: 21 },
  },
  natlan: {
    name: "Natlan",
    base: { h: 5, s: 20, l: 7 },
    glow1: { h: 4, s: 44, l: 19 }, // Pyro red
    glow2: { h: 350, s: 38, l: 16 },
  },
  snezhnaya: {
    name: "Snezhnaya",
    base: { h: 198, s: 12, l: 11 }, // Brightest base
    glow1: { h: 195, s: 34, l: 27 }, // Cryo ice blue
    glow2: { h: 210, s: 28, l: 24 },
  },
  nodkrai: {
    name: "Nod-Krai",
    base: { h: 230, s: 12, l: 9 },
    glow1: { h: 220, s: 32, l: 24 }, // Moonlight blue
    glow2: { h: 240, s: 28, l: 21 },
  },
  abyss: {
    name: "Abyss",
    base: { h: 270, s: 20, l: 4 }, // Near-black void
    glow1: { h: 280, s: 40, l: 15 }, // Corruption purple
    glow2: { h: 320, s: 34, l: 11 }, // Crimson hints
  },
};

// Helper: format HSL as CSS value (space-separated for var usage)
const hslVar = (h: number, s: number, l: number) =>
  `${h} ${Math.round(s)}% ${Math.round(l)}%`;

// Helper: format HSL as full hsl() function
const hsl = (h: number, s: number, l: number) =>
  `hsl(${h} ${Math.round(s)}% ${Math.round(l)}%)`;

// Helper: clamp value within range
const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

/**
 * Interpolate between two hues, taking the shorter path around the color wheel.
 * Handles the 360°/0° wrap-around for red hues correctly.
 */
function lerpHue(h1: number, h2: number, t: number): number {
  // Normalize hues to 0-360 range
  const hue1 = ((h1 % 360) + 360) % 360;
  const hue2 = ((h2 % 360) + 360) % 360;

  // Calculate the difference
  let diff = hue2 - hue1;

  // Take the shorter path around the wheel
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }

  // Interpolate and normalize result
  const result = hue1 + diff * t;
  return ((result % 360) + 360) % 360;
}

/**
 * Determine if a hue has high luminance (yellow/green/orange range).
 * These need darker foregrounds for contrast.
 */
const isHighLuminanceHue = (h: number): boolean => {
  // Yellow (30-90), Green (90-150), Orange (0-30)
  return h < 150 || h > 330;
};

/**
 * Generate the radial page background gradient (3-layer star formula).
 * Special handling: Abyss gets extra dark V-arm for asymmetric variance.
 */
function generatePageGradient(seed: ThemeSeed, isAbyss: boolean): string {
  const { base, glow1, glow2 } = seed;
  const vArmOffset = isAbyss ? -5 : 4; // Abyss V-arm near-invisible

  // NOTE: All layers MUST be gradient functions (not plain colors)
  // because this is used for background-image, which rejects bare colors.
  // The base layer uses a radial-gradient at 100% to act as solid fill.
  return `
    radial-gradient(
      ellipse 85% 75% at 50% 50%,
      ${hsl(glow1.h, glow1.s + 5, glow1.l + 7)} 0%,
      transparent 92%
    ),
    radial-gradient(
      ellipse 170% 60% at 50% 50%,
      ${hsl(glow2.h, glow2.s + 3, glow2.l + 5)} 0%,
      transparent 94%
    ),
    radial-gradient(
      ellipse 60% 165% at 50% 50%,
      ${hsl(glow2.h, glow2.s + 2, glow2.l + vArmOffset)} 0%,
      transparent 92%
    ),
    radial-gradient(
      circle at 50% 50%,
      ${hsl(base.h, base.s, base.l)} 0%,
      ${hsl(base.h, base.s, base.l)} 100%
    )`.trim();
}

/**
 * Derive 3 gradient colors from theme seeds.
 * Returns [light, mid, dark] for use in gradients.
 * Uses lerpHue for correct color wheel interpolation (handles red/magenta wrap).
 */
function deriveGradientColors(seed: ThemeSeed): [string, string, string] {
  const { base, glow1, glow2 } = seed;

  // Light: base shifted toward glow1 (30% blend), higher lightness
  const lightH = lerpHue(base.h, glow1.h, 0.3);
  const light = hsl(lightH, base.s + 12, base.l + 8);

  // Mid: blend of glow1 and glow2 (40% toward glow2)
  const midH = lerpHue(glow1.h, glow2.h, 0.4);
  const mid = hsl(midH, glow1.s + 5, clamp(glow1.l + 3, 10, 20));

  // Dark: glow2 with reduced lightness
  const dark = hsl(glow2.h, glow2.s, clamp(glow2.l - 3, 6, 14));

  return [light, mid, dark];
}

/**
 * Generate linear gradient for cards (135° direction = top-left to bottom-right).
 * Light at top-left, dark at bottom-right for natural lighting effect.
 */
function generateCardGradient(seed: ThemeSeed): string {
  const [light, mid, dark] = deriveGradientColors(seed);
  // Light → Mid → Dark (bright top-left corner)
  return `linear-gradient(135deg, ${light} 0%, ${mid} 50%, ${dark} 100%)`;
}

/**
 * Generate linear gradient for select triggers (135° direction).
 * Reversed colors: dark at top-left, light at bottom-right.
 * This reversal signals interactivity (opposite of passive cards).
 */
function generateSelectGradient(seed: ThemeSeed): string {
  const [light, mid, dark] = deriveGradientColors(seed);
  // Dark → Mid → Light (inverted for interactive affordance)
  return `linear-gradient(135deg, ${dark} 0%, ${mid} 50%, ${light} 100%)`;
}

/**
 * Generate all CSS variables for a theme.
 * Returns a Record of variable names (without --) to their values.
 */
export function generateThemeVars(themeId: ThemeId): Record<string, string> {
  const seed = THEME_SEEDS[themeId];
  const { base, glow1 } = seed;
  const isAbyss = themeId === "abyss";

  // Derive primary with higher saturation and lightness for vibrancy
  // Abyss gets darker primary to feel more void-like
  const primaryS = clamp(glow1.s + 20, 40, 75);
  const primaryL = isAbyss
    ? clamp(glow1.l + 20, 30, 42) // Darker for Abyss
    : clamp(glow1.l + 25, 45, 65);

  // Primary foreground: dark for high-lumen hues, light otherwise
  const primaryFg = isHighLuminanceHue(glow1.h)
    ? hslVar(base.h, 25, 8) // Dark foreground
    : hslVar(0, 0, 98); // Light foreground

  return {
    // Core backgrounds
    background: hslVar(base.h, base.s, base.l),
    foreground: hslVar(0, 0, 95),

    // Card/popover surfaces - slightly lifted
    card: hslVar(base.h, base.s + 5, base.l + 3),
    "card-foreground": hslVar(0, 0, 95),
    popover: hslVar(base.h, base.s + 5, base.l + 3),
    "popover-foreground": hslVar(0, 0, 95),

    // Primary - vivid elemental accent
    primary: hslVar(glow1.h, primaryS, primaryL),
    "primary-foreground": primaryFg,

    // Secondary - subtle lift from background
    secondary: hslVar(base.h, base.s + 8, base.l + 5),
    "secondary-foreground": hslVar(0, 0, 95),

    // Muted - minimal differentiation
    muted: hslVar(base.h, base.s, base.l + 2),
    "muted-foreground": hslVar(base.h, clamp(base.s - 10, 0, 20), base.l + 42),

    // Accent - interactive highlight
    accent: hslVar(
      glow1.h,
      clamp(glow1.s + 15, 35, 70),
      clamp(glow1.l + 20, 35, 55)
    ),
    "accent-foreground": hslVar(0, 0, 98),

    // Destructive - consistent across themes
    destructive: hslVar(0, 75, 60),
    "destructive-foreground": hslVar(210, 40, 98),

    // Borders and inputs
    border: hslVar(base.h, base.s + 2, base.l + 6),
    input: hslVar(base.h, base.s, base.l + 2),
    ring: hslVar(glow1.h, primaryS, primaryL),

    // Chart colors (static, suitable for data viz)
    "chart-1": hslVar(12, 76, 61),
    "chart-2": hslVar(173, 58, 39),
    "chart-3": hslVar(197, 37, 24),
    "chart-4": hslVar(43, 74, 66),
    "chart-5": hslVar(27, 87, 67),

    // Gradients
    "gradient-page": generatePageGradient(seed, isAbyss),
    "gradient-card": generateCardGradient(seed),
    "gradient-select": generateSelectGradient(seed),
  };
}

/**
 * Apply generated theme variables to the document.
 */
export function applyThemeVars(themeId: ThemeId): void {
  const vars = generateThemeVars(themeId);
  const root = document.documentElement;

  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(`--${name}`, value);
  }
}
