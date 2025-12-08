import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Element colors for Genshin Impact (HSL based)
        element: {
          anemo: "hsl(var(--anemo))",
          geo: "hsl(var(--geo))",
          electro: "hsl(var(--electro))",
          dendro: "hsl(var(--dendro))",
          hydro: "hsl(var(--hydro))",
          pyro: "hsl(var(--pyro))",
          cryo: "hsl(var(--cryo))",
        },
        // Element colors (Hex based) - from TierList
        genshin: {
          'pyro': '#e35a4f',
          'hydro': '#2a8fbd',
          'electro': '#b38ed5',
          'cryo': '#98d2e6',
          'anemo': '#4cc285',
          'geo': '#e3b342',
          'dendro': '#7fb92c',
          'bg': '#f5f3e6',
        },
        // Tier colors
        tier: {
          's': '#b92f3a',
          'a': '#dd8559',
          'b': '#e6b44d',
          'c': '#43ad8b',
          'd': '#4a85cd',
          'pool': '#757575',
        },
        // Rarity colors
        rarity: {
          '4': '#9b6b9e',
          '5': '#c89b3c',
        }
      },
      backgroundImage: {
        "gradient-mystical": "var(--gradient-mystical)",
        "gradient-mystical-reverse": "var(--gradient-mystical-reverse)",
        "gradient-golden": "var(--gradient-golden)",
        "gradient-artifact": "var(--gradient-artifact)",
      },
      // boxShadow: {
      //   "mystical": "var(--shadow-mystical)",
      //   "golden": "var(--shadow-golden)",
      //   "card": "var(--shadow-card)",
      // },
      transitionTimingFunction: {
        "smooth": "var(--transition-smooth)",
        "bounce": "var(--transition-bounce)",
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
  plugins: [tailwindcssAnimate],
} satisfies Config;
