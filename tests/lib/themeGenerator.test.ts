import { describe, expect, it } from "vitest";
import { generateThemeVars, THEME_SEEDS } from "@/lib/themeGenerator";

const ALL_THEME_IDS = Object.keys(THEME_SEEDS) as Array<
  keyof typeof THEME_SEEDS
>;

const parseLightness = (hslVar: string) =>
  Number.parseInt(hslVar.split(" ")[2], 10);

describe("THEME_SEEDS", () => {
  it("has seeds for all expected regions + abyss", () => {
    const expected = [
      "mondstadt",
      "liyue",
      "inazuma",
      "sumeru",
      "fontaine",
      "natlan",
      "snezhnaya",
      "nodkrai",
      "abyss",
    ];
    for (const id of expected) {
      expect(THEME_SEEDS).toHaveProperty(id);
    }
  });

  it("each seed has base, glow1, glow2 with h/s/l", () => {
    for (const [id, seed] of Object.entries(THEME_SEEDS)) {
      for (const key of ["base", "glow1", "glow2"] as const) {
        const color = seed[key];
        expect(color, `${id}.${key} missing`).toBeDefined();
        expect(typeof color.h).toBe("number");
        expect(typeof color.s).toBe("number");
        expect(typeof color.l).toBe("number");
        // Hue in 0-360, saturation/lightness in 0-100
        expect(color.h).toBeGreaterThanOrEqual(0);
        expect(color.h).toBeLessThan(360);
        expect(color.s).toBeGreaterThanOrEqual(0);
        expect(color.s).toBeLessThanOrEqual(100);
        expect(color.l).toBeGreaterThanOrEqual(0);
        expect(color.l).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("generateThemeVars", () => {
  it("returns all required CSS variable keys", () => {
    const vars = generateThemeVars("mondstadt");
    const requiredKeys = [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "destructive-foreground",
      "border",
      "input",
      "ring",
      "gradient-page",
      "gradient-card",
      "gradient-select",
    ];

    for (const key of requiredKeys) {
      expect(vars, `Missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("produces valid HSL variable format (h s% l%)", () => {
    const vars = generateThemeVars("liyue");
    // HSL vars should match "N N% N%" pattern
    const hslPattern = /^\d{1,3}\s\d{1,3}%\s\d{1,3}%$/;

    expect(vars.background).toMatch(hslPattern);
    expect(vars.foreground).toMatch(hslPattern);
    expect(vars.primary).toMatch(hslPattern);
    expect(vars.border).toMatch(hslPattern);
  });

  it("produces gradient strings for gradient keys", () => {
    const vars = generateThemeVars("natlan");

    expect(vars["gradient-page"]).toContain("radial-gradient");
    expect(vars["gradient-card"]).toContain("linear-gradient");
    expect(vars["gradient-select"]).toContain("linear-gradient");
  });

  it("generates deterministic output for the same themeId", () => {
    const vars1 = generateThemeVars("fontaine");
    const vars2 = generateThemeVars("fontaine");

    expect(vars1).toEqual(vars2);
  });

  it("generates different output for different themeIds", () => {
    const mondstadt = generateThemeVars("mondstadt");
    const natlan = generateThemeVars("natlan");

    expect(mondstadt.primary).not.toBe(natlan.primary);
    expect(mondstadt["gradient-page"]).not.toBe(natlan["gradient-page"]);
  });

  it("works for all theme IDs without throwing", () => {
    for (const id of ALL_THEME_IDS) {
      expect(() => generateThemeVars(id)).not.toThrow();
    }
  });

  it("has chart colors consistent across themes", () => {
    const a = generateThemeVars("mondstadt");
    const b = generateThemeVars("abyss");

    // Chart colors are static (data-viz consistency)
    expect(a["chart-1"]).toBe(b["chart-1"]);
    expect(a["chart-2"]).toBe(b["chart-2"]);
  });

  it("abyss theme has darker primary than non-abyss themes", () => {
    const abyss = generateThemeVars("abyss");
    const mondstadt = generateThemeVars("mondstadt");

    expect(parseLightness(abyss.primary)).toBeLessThan(
      parseLightness(mondstadt.primary)
    );
  });

  it("raises muted foreground across all themes", () => {
    for (const id of ALL_THEME_IDS) {
      const seed = THEME_SEEDS[id];
      const isRedBase = seed.base.h <= 30 || seed.base.h >= 330;
      const expectedMinimumLightness = seed.base.l + 48 + (isRedBase ? 12 : 0);

      expect(
        parseLightness(generateThemeVars(id)["muted-foreground"]),
        id
      ).toBe(expectedMinimumLightness);
    }
  });

  it("keeps the red hue visibility compensation on top of the global lift", () => {
    const natlan = generateThemeVars("natlan");
    const mondstadt = generateThemeVars("mondstadt");

    expect(parseLightness(natlan["muted-foreground"])).toBeGreaterThan(
      parseLightness(mondstadt["muted-foreground"])
    );
  });
});
