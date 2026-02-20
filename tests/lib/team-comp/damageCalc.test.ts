import { describe, expect, it } from "vitest";

import { TeamResonance } from "@/lib/team-comp/damageCalc";
import { TeamMeta } from "@/lib/team-comp/damageModels";

// ═══════════════════════════════════════════════════════════════
// TeamMeta
// ═══════════════════════════════════════════════════════════════

describe("TeamMeta", () => {
  // Team: Hu Tao (Pyro), Xingqiu (Hydro), Zhongli (Geo), Kazuha (Anemo)
  const meta = new TeamMeta([
    "hu_tao",
    "xingqiu",
    "zhongli",
    "kaedehara_kazuha",
  ]);

  it("resolves element for each character", () => {
    expect(meta.elements.hu_tao).toBe("Pyro");
    expect(meta.elements.xingqiu).toBe("Hydro");
    expect(meta.elements.zhongli).toBe("Geo");
    expect(meta.elements.kaedehara_kazuha).toBe("Anemo");
  });

  it("countByElement returns correct counts", () => {
    expect(meta.countByElement("Pyro")).toBe(1);
    expect(meta.countByElement("Hydro")).toBe(1);
    expect(meta.countByElement("Dendro")).toBe(0);
  });

  it("hasReaction returns true for vaporize (Pyro+Hydro)", () => {
    expect(meta.hasReaction("vaporize")).toBe(true);
  });

  it("hasReaction returns false for superconduct (no Cryo+Electro)", () => {
    expect(meta.hasReaction("superconduct")).toBe(false);
  });

  it("hasReaction returns true for swirl (Anemo + any reactive element)", () => {
    expect(meta.hasReaction("swirl")).toBe(true);
  });

  it("hasReaction returns false for bloom (no Dendro)", () => {
    expect(meta.hasReaction("bloom")).toBe(false);
  });

  it("throws for unknown character ID", () => {
    expect(() => new TeamMeta(["nonexistent_char"])).toThrow(
      "Unknown character ID"
    );
  });
});

describe("TeamMeta — Dendro team", () => {
  // Team: Nahida (Dendro), Nilou (Hydro), Sangonomiya Kokomi (Hydro), Yelan (Hydro)
  const meta = new TeamMeta(["nahida", "nilou", "sangonomiya_kokomi", "yelan"]);

  it("countByElement for Hydro-heavy team", () => {
    expect(meta.countByElement("Hydro")).toBe(3);
    expect(meta.countByElement("Dendro")).toBe(1);
  });

  it("hasReaction for bloom (Hydro+Dendro)", () => {
    expect(meta.hasReaction("bloom")).toBe(true);
  });

  it("hasReaction for hyperbloom requires Electro", () => {
    expect(meta.hasReaction("hyperbloom")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// TeamResonance
// ═══════════════════════════════════════════════════════════════

describe("TeamResonance", () => {
  it("generates ATK +25% for dual Pyro (Fervent Flames)", () => {
    const meta = new TeamMeta(["hu_tao", "xiangling", "xingqiu", "zhongli"]);
    const resonance = new TeamResonance(meta);

    const atkBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "atk%")
    );
    expect(atkBuff).toBeDefined();
    expect(atkBuff!.staticBuffs.find((e) => e.key === "atk%")!.value).toBe(
      0.25
    );
  });

  it("generates HP +25% for dual Hydro (Soothing Water)", () => {
    const meta = new TeamMeta(["xingqiu", "yelan", "hu_tao", "zhongli"]);
    const resonance = new TeamResonance(meta);

    const hpBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "hp%")
    );
    expect(hpBuff).toBeDefined();
    expect(hpBuff!.staticBuffs.find((e) => e.key === "hp%")!.value).toBe(0.25);
  });

  it("generates EM +50 for all unique elements", () => {
    const meta = new TeamMeta([
      "hu_tao",
      "xingqiu",
      "zhongli",
      "kaedehara_kazuha",
    ]);
    const resonance = new TeamResonance(meta);

    const emBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "em")
    );
    expect(emBuff).toBeDefined();
    expect(emBuff!.staticBuffs.find((e) => e.key === "em")!.value).toBe(50);
  });

  it("generates no resonance buffs for 3 unique elements (with one pair)", () => {
    // Hu Tao + Bennett = 2 Pyro, + Xingqiu (Hydro), + Zhongli (Geo) = 3 unique, not 4
    const meta = new TeamMeta(["hu_tao", "bennett", "xingqiu", "zhongli"]);
    const resonance = new TeamResonance(meta);

    // Should have Pyro resonance ATK buff
    const atkBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "atk%")
    );
    expect(atkBuff).toBeDefined();

    // Should NOT have the 4-unique-element EM buff
    const emBuff = resonance.buffs.find((b) =>
      b.staticBuffs.some((e) => e.key === "em")
    );
    expect(emBuff).toBeUndefined();
  });
});
