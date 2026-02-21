import { describe, expect, it } from "vitest";

import {
  allElementalDmg,
  getReactionAttachElements,
  r,
} from "@/lib/team-comp/helpers";

describe("r() — refinement value picker", () => {
  const values: [number, number, number, number, number] = [
    0.16, 0.2, 0.24, 0.28, 0.32,
  ];

  it("R1 returns first value", () => {
    expect(r(1, values)).toBe(0.16);
  });

  it("R3 returns third value", () => {
    expect(r(3, values)).toBe(0.24);
  });

  it("R5 returns fifth value", () => {
    expect(r(5, values)).toBe(0.32);
  });
});

describe("allElementalDmg", () => {
  it("produces 7 entries for all elements", () => {
    const entries = allElementalDmg(0.15);
    expect(entries).toHaveLength(7);
    expect(entries.every((e) => e.value === 0.15)).toBe(true);
  });

  it("includes all 7 element DMG keys", () => {
    const keys = allElementalDmg(0).map((e) => e.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "pyro%",
        "hydro%",
        "electro%",
        "cryo%",
        "anemo%",
        "geo%",
        "dendro%",
      ])
    );
  });
});

describe("getReactionAttachElements", () => {
  it("Pyro reacts with Hydro, Electro, Cryo, Dendro", () => {
    const els = getReactionAttachElements("Pyro");
    expect(els).toContain("Hydro");
    expect(els).toContain("Electro");
    expect(els).toContain("Cryo");
    expect(els).toContain("Dendro");
    expect(els).not.toContain("Pyro");
  });

  it("Cryo does NOT react with Dendro", () => {
    const els = getReactionAttachElements("Cryo");
    expect(els).not.toContain("Dendro");
    expect(els).toHaveLength(3);
  });

  it("Anemo reacts with PHEC", () => {
    const els = getReactionAttachElements("Anemo");
    expect(els).toHaveLength(4);
    expect(els).toContain("Pyro");
    expect(els).toContain("Hydro");
  });
});
