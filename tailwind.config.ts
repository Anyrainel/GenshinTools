import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";
import {
  ELEMENT_BACKGROUND,
  ELEMENT_HEX,
  ITEM_TOKENS,
  RARITY_GRADIENTS,
  RARITY_TOKENS,
  TIER_TOKENS,
} from "./src/config/gameColors";

const wideContainerPlugin = plugin(({ addComponents }) => {
  addComponents({
    ".wide-container": {
      width: "100%",
      marginLeft: "auto",
      marginRight: "auto",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      "@media (min-width: 768px)": {
        paddingLeft: "1rem",
        paddingRight: "1rem",
      },
      "@media (min-width: 1024px)": {
        maxWidth: "980px",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      },
      "@media (min-width: 1280px)": {
        maxWidth: "1160px",
      },
      "@media (min-width: 1536px)": {
        maxWidth: "1350px",
      },
      "@media (min-width: 2048px)": {
        maxWidth: "1680px",
      },
    },
  });
});

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "0.5rem",
        md: "1.5rem",
        lg: "2rem",
        "2xl": "3rem",
      },
      screens: {
        sm: "100%",
        md: "100%",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      screens: {
        "3xl": "2048px",
      },
      width: {
        sidebar: "17.5rem", // 280px
        "sidebar-narrow": "15rem", // 240px
      },
      minWidth: {
        card: "22rem", // 352px
      },
      gridTemplateColumns: {
        "14": "repeat(14, minmax(0, 1fr))",
        "16": "repeat(16, minmax(0, 1fr))",
      },
      colors: {
        item: ITEM_TOKENS,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        element: {
          pyro: ELEMENT_HEX.Pyro,
          hydro: ELEMENT_HEX.Hydro,
          electro: ELEMENT_HEX.Electro,
          cryo: ELEMENT_HEX.Cryo,
          anemo: ELEMENT_HEX.Anemo,
          geo: ELEMENT_HEX.Geo,
          dendro: ELEMENT_HEX.Dendro,
          bg: ELEMENT_BACKGROUND,
        },
        tier: TIER_TOKENS,
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        rarity: RARITY_TOKENS,
      },
      backgroundImage: {
        ...RARITY_GRADIENTS,
        "gradient-page": "var(--gradient-page)",
        "gradient-card": "var(--gradient-card)",
        "gradient-select": "var(--gradient-select)",
      },
      transitionTimingFunction: {
        smooth: "var(--transition-smooth)",
        bounce: "var(--transition-bounce)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate, wideContainerPlugin],
} satisfies Config;
