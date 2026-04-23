import { describe, expect, it } from "vitest";
import {
  getElementColor,
  getRarityColor,
  getTierColor,
} from "@/components/shared/colors";
import { getAssetUrl } from "@/lib/utils";

describe("getAssetUrl", () => {
  it("prepends base URL to absolute paths", () => {
    const result = getAssetUrl("/character/hu_tao.png");
    expect(result).toContain("/character/hu_tao.png");
  });

  it("returns path as-is if it already starts with BASE_URL", () => {
    // import.meta.env.BASE_URL defaults to "/" in test environment
    const result = getAssetUrl("/character/hu_tao.png");
    // Should not double-prefix
    expect(result).not.toMatch(/^\/\//);
  });

  it("handles relative paths", () => {
    const result = getAssetUrl("character/hu_tao.png");
    expect(result).toContain("character/hu_tao.png");
  });
});

describe("getRarityColor", () => {
  it("returns correct bg class for 5-star", () => {
    expect(getRarityColor(5, "bg")).toBe("bg-rarity-5");
  });

  it("returns correct text class for 4-star", () => {
    expect(getRarityColor(4, "text")).toBe("text-rarity-4");
  });

  it("returns correct border class for 3-star", () => {
    expect(getRarityColor(3, "border")).toBe("border-rarity-3");
  });

  it("returns consistent prefix for all rarities", () => {
    for (const rarity of [1, 2, 3, 4, 5] as const) {
      expect(getRarityColor(rarity, "bg")).toMatch(/^bg-rarity-\d$/);
      expect(getRarityColor(rarity, "text")).toMatch(/^text-rarity-\d$/);
      expect(getRarityColor(rarity, "border")).toMatch(/^border-rarity-\d$/);
    }
  });
});

describe("getElementColor", () => {
  it("returns bg class for Pyro", () => {
    expect(getElementColor("Pyro", "bg")).toBe("bg-element-pyro/60");
  });

  it("returns text class for Hydro", () => {
    expect(getElementColor("Hydro", "text")).toBe("text-element-hydro");
  });

  it("covers all 7 elements", () => {
    const elements = [
      "Pyro",
      "Hydro",
      "Electro",
      "Cryo",
      "Anemo",
      "Geo",
      "Dendro",
    ] as const;

    for (const el of elements) {
      expect(getElementColor(el, "bg")).toBeTruthy();
      expect(getElementColor(el, "text")).toBeTruthy();
    }
  });
});

describe("getTierColor", () => {
  it("returns bg class for S tier", () => {
    expect(getTierColor("S", "bg")).toBe("bg-tier-bg-s/40");
  });

  it("returns header class for A tier", () => {
    expect(getTierColor("A", "header")).toBe("bg-tier-a/70");
  });

  it("returns pool color for Pool tier", () => {
    expect(getTierColor("Pool", "bg")).toBe("bg-tier-bg-pool/40");
  });

  it("covers all tiers", () => {
    const tiers = ["S", "A", "B", "C", "D", "Pool"] as const;
    for (const tier of tiers) {
      expect(getTierColor(tier, "bg")).toBeTruthy();
      expect(getTierColor(tier, "header")).toBeTruthy();
    }
  });
});
