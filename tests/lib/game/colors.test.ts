import { beforeAll, describe, expect, it } from "vitest";
import {
  getElementColor,
  getRarityColor,
  getTierColor,
} from "@/components/shared/colors";
import { getElementHex } from "@/lib/game/colors";
import { cn } from "@/lib/utils";
import { buildUiCss, utilityDeclarations } from "../../helpers/tailwindCss";

let css: string;
beforeAll(async () => {
  css = await buildUiCss();
});

describe("game colors in compiled Tailwind CSS", () => {
  it("preserves item badge and level strip colors", () => {
    expect(utilityDeclarations(css, "bg-item-badge")["background-color"]).toBe(
      "#4a3b2a"
    );
    expect(utilityDeclarations(css, "text-item-badge-foreground").color).toBe(
      "#eccf83"
    );
    expect(utilityDeclarations(css, "bg-item-level")["background-color"]).toBe(
      "#f5f0e6"
    );
    expect(utilityDeclarations(css, "text-item-level-foreground").color).toBe(
      "#3d3d3d"
    );
    expect(utilityDeclarations(css, "bg-item-mixed")["background-color"]).toBe(
      "#3a2d13"
    );
  });
  it("merges gradient images independently of solid backgrounds", () => {
    expect(cn("bg-rarity-4", getRarityColor(5, "gradient"))).toBe(
      "bg-rarity-4 bg-rarity-gradient-5"
    );
    expect(
      cn(getRarityColor(4, "gradient"), getRarityColor(5, "gradient"))
    ).toBe("bg-rarity-gradient-5");
    expect(cn("bg-rarity-4", "bg-rarity-5")).toBe("bg-rarity-5");
  });
  it("preserves element hues for DOM and chart consumers", () => {
    const elements = [
      "Pyro",
      "Hydro",
      "Electro",
      "Cryo",
      "Anemo",
      "Geo",
      "Dendro",
    ] as const;
    const hex = [
      "#b8483f",
      "#22728f",
      "#8f70aa",
      "#7aa8b8",
      "#3d9b6a",
      "#b58f35",
      "#669423",
    ];
    elements.forEach((element, index) => {
      expect(getElementHex(element)).toBe(hex[index]);
      expect(
        utilityDeclarations(css, getElementColor(element, "text")).color
      ).toBe(hex[index]);
      expect(
        utilityDeclarations(css, getElementColor(element, "bg"))[
          "background-color"
        ]
      ).toBe(`color-mix(in oklab, ${hex[index]} 60%, transparent)`);
      expect(
        utilityDeclarations(css, getElementColor(element, "border"))[
          "border-color"
        ]
      ).toBe(`color-mix(in oklab, ${hex[index]} 40%, transparent)`);
      expect(
        utilityDeclarations(css, getElementColor(element, "bgSubtle"))[
          "background-color"
        ]
      ).toBe(`color-mix(in oklab, ${hex[index]} 20%, transparent)`);
    });
    expect(getElementHex("unknown")).toBeUndefined();
    expect(getElementHex("toString")).toBeUndefined();
  });

  it("separates solid rarity colors from the unchanged artwork gradients", () => {
    const gradients = [
      "#6a6d74, #868586",
      "#4b6c67, #519072",
      "#567496, #5392b8",
      "#5e5789, #9c75b7",
      "#945c2c, #b27330",
    ];
    ([1, 2, 3, 4, 5] as const).forEach((rarity, index) => {
      expect(
        utilityDeclarations(css, getRarityColor(rarity, "gradient"))[
          "background-image"
        ]
      ).toBe(`linear-gradient(180deg, ${gradients[index]})`);
      const solid = utilityDeclarations(css, getRarityColor(rarity, "bg"));
      expect(solid["background-color"]).toBeTruthy();
      expect(solid["background-image"]).toBeUndefined();
    });
  });

  it("preserves runtime theme surfaces, sidebar widths and custom animations", () => {
    expect(utilityDeclarations(css, "bg-background")["background-color"]).toBe(
      "hsl(var(--background))"
    );
    expect(utilityDeclarations(css, "text-primary").color).toBe(
      "hsl(var(--primary))"
    );
    for (const surface of ["page", "card", "select"]) {
      expect(
        utilityDeclarations(css, `bg-gradient-${surface}`)["background-image"]
      ).toBe(`var(--gradient-${surface})`);
    }
    expect(utilityDeclarations(css, "xl:w-sidebar").width).toBe("17.5rem");
    expect(utilityDeclarations(css, "w-sidebar-narrow").width).toBe("15rem");
    expect(utilityDeclarations(css, "rounded-sm")["border-radius"]).toBe(
      "calc(var(--radius) - 4px)"
    );
    expect(utilityDeclarations(css, "rounded-[4px]")["border-radius"]).toBe(
      "4px"
    );
    expect(utilityDeclarations(css, "animate-card-enter").animation).toBe(
      "card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both"
    );
    expect(utilityDeclarations(css, "animate-text-shimmer").animation).toBe(
      "text-shimmer 3s linear infinite"
    );
    expect(utilityDeclarations(css, "animate-tab-progress").animation).toBe(
      "tab-progress linear forwards"
    );
    expect(css).toContain("height: var(--radix-accordion-content-height)");
    expect(css).toContain("animation: var(--animate-accordion-down)");
    expect(css).toContain("animation: var(--animate-accordion-up)");
    expect(css).toContain("animation: ice-shimmer 6s ease-in-out infinite");
  });

  it("preserves every Tier header and cell opacity", () => {
    const headers = [
      "#b92f3a",
      "#dd8559",
      "#e6b44d",
      "#43ad8b",
      "#4a85cd",
      "#757575",
    ];
    const backgrounds = [
      "#2e0c0f",
      "#372116",
      "#3a2d13",
      "#112b23",
      "#132133",
      "#1d1d1d",
    ];
    (["S", "A", "B", "C", "D", "Pool"] as const).forEach((tier, index) => {
      expect(
        utilityDeclarations(css, getTierColor(tier, "header"))[
          "background-color"
        ]
      ).toBe(`color-mix(in oklab, ${headers[index]} 70%, transparent)`);
      expect(
        utilityDeclarations(css, getTierColor(tier, "bg"))["background-color"]
      ).toBe(`color-mix(in oklab, ${backgrounds[index]} 40%, transparent)`);
    });
  });
});
