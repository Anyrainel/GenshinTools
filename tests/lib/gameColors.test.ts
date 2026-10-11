import { beforeAll, describe, expect, it } from "vitest";
import {
  getElementColor,
  getRarityColor,
  getTierColor,
} from "@/components/shared/colors";
import { getElementHex } from "@/lib/gameColors";
import { cn } from "@/lib/utils";
import { buildUiCss, utilityDeclarations } from "../helpers/tailwindCss";

let css: string;
beforeAll(async () => {
  css = await buildUiCss();
});

describe("game colors in compiled Tailwind CSS", () => {
  it("preserves item badge and level strip colors", () => {
    expect(utilityDeclarations(css, "bg-item-badge")["background-color"]).toBe(
      "rgb(74 59 42 / var(--tw-bg-opacity, 1))"
    );
    expect(utilityDeclarations(css, "text-item-badge-foreground").color).toBe(
      "rgb(236 207 131 / var(--tw-text-opacity, 1))"
    );
    expect(utilityDeclarations(css, "bg-item-level")["background-color"]).toBe(
      "rgb(245 240 230 / var(--tw-bg-opacity, 1))"
    );
    expect(utilityDeclarations(css, "text-item-level-foreground").color).toBe(
      "rgb(61 61 61 / var(--tw-text-opacity, 1))"
    );
    expect(utilityDeclarations(css, "bg-item-mixed")["background-color"]).toBe(
      "rgb(58 45 19 / var(--tw-bg-opacity, 1))"
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
    const rgb = [
      "184 72 63",
      "34 114 143",
      "143 112 170",
      "122 168 184",
      "61 155 106",
      "181 143 53",
      "102 148 35",
    ];
    elements.forEach((element, index) => {
      expect(getElementHex(element)).toBe(hex[index]);
      expect(
        utilityDeclarations(css, getElementColor(element, "text")).color
      ).toBe(`rgb(${rgb[index]} / var(--tw-text-opacity, 1))`);
      expect(
        utilityDeclarations(css, getElementColor(element, "bg"))[
          "background-color"
        ]
      ).toBe(`rgb(${rgb[index]} / 0.6)`);
      expect(
        utilityDeclarations(css, getElementColor(element, "border"))[
          "border-color"
        ]
      ).toBe(`rgb(${rgb[index]} / 0.4)`);
      expect(
        utilityDeclarations(css, getElementColor(element, "bgSubtle"))[
          "background-color"
        ]
      ).toBe(`rgb(${rgb[index]} / 0.2)`);
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

  it("preserves every Tier header and cell opacity", () => {
    const headers = [
      "185 47 58",
      "221 133 89",
      "230 180 77",
      "67 173 139",
      "74 133 205",
      "117 117 117",
    ];
    const backgrounds = [
      "46 12 15",
      "55 33 22",
      "58 45 19",
      "17 43 35",
      "19 33 51",
      "29 29 29",
    ];
    (["S", "A", "B", "C", "D", "Pool"] as const).forEach((tier, index) => {
      expect(
        utilityDeclarations(css, getTierColor(tier, "header"))[
          "background-color"
        ]
      ).toBe(`rgb(${headers[index]} / 0.7)`);
      expect(
        utilityDeclarations(css, getTierColor(tier, "bg"))["background-color"]
      ).toBe(`rgb(${backgrounds[index]} / 0.4)`);
    });
  });
});
