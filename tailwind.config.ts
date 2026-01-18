import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

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
      padding: "2rem",
      screens: {
        "2xl": "1800px",
      },
    },
    extend: {
      gridTemplateColumns: {
        "14": "repeat(14, minmax(0, 1fr))",
        "16": "repeat(16, minmax(0, 1fr))",
      },
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
        element: {
          pyro: "#b8483f",
          hydro: "#22728f",
          electro: "#8f70aa",
          cryo: "#7aa8b8",
          anemo: "#3d9b6a",
          geo: "#b58f35",
          dendro: "#669423",
          bg: "#f5f3e6",
        },
        tier: {
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
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        rarity: {
          "1": "#868586",
          "2": "#519072",
          "3": "#5392b8",
          "4": "#9c75b7",
          "5": "#b27330",
        },
      },
      backgroundImage: {
        "gradient-mystical": "var(--gradient-mystical)",
        "gradient-select": "var(--gradient-select)",
        "gradient-golden": "var(--gradient-golden)",
        "gradient-card": "var(--gradient-card)",
        "rarity-1": "linear-gradient(180deg, #6a6d74, #868586)",
        "rarity-2": "linear-gradient(180deg, #4b6c67, #519072)",
        "rarity-3": "linear-gradient(180deg, #567496, #5392b8)",
        "rarity-4": "linear-gradient(180deg, #5e5789, #9c75b7)",
        "rarity-5": "linear-gradient(180deg, #945c2c, #b27330)",
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
  plugins: [tailwindcssAnimate],
} satisfies Config;
