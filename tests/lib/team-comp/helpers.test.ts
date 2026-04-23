import { describe, expect, it } from "vitest";

import {
  ALL_ELEMENTAL_FILTER,
  getReactionAuraElements,
  r,
} from "@/lib/dmgcalc/impl/helpers";

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

describe("ALL_ELEMENTAL_FILTER", () => {
  it("contains all 7 elements sorted alphabetically", () => {
    expect(ALL_ELEMENTAL_FILTER.elements).toEqual([
      "Anemo",
      "Cryo",
      "Dendro",
      "Electro",
      "Geo",
      "Hydro",
      "Pyro",
    ]);
  });

  it("does not include Physical", () => {
    expect(ALL_ELEMENTAL_FILTER.elements).not.toContain("Physical");
  });
});

describe("getReactionAttachElements", () => {
  it("Pyro reacts with Hydro, Electro, Cryo, Dendro", () => {
    const els = getReactionAuraElements("Pyro");
    expect(els).toContain("Hydro");
    expect(els).toContain("Electro");
    expect(els).toContain("Cryo");
    expect(els).toContain("Dendro");
    expect(els).not.toContain("Pyro");
  });

  it("Cryo does NOT react with Dendro", () => {
    const els = getReactionAuraElements("Cryo");
    expect(els).not.toContain("Dendro");
    expect(els).toHaveLength(3);
  });

  it("Anemo reacts with PHEC", () => {
    const els = getReactionAuraElements("Anemo");
    expect(els).toHaveLength(4);
    expect(els).toContain("Pyro");
    expect(els).toContain("Hydro");
  });
});
