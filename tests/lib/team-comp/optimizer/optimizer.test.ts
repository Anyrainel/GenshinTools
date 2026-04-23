import { describe, expect, it } from "vitest";
import type { ArtifactData } from "@/data/types";
import { matchesSetRequirement } from "./optimizerV1";

let artId = 0;
function art(setKey: string, slot = "flower"): ArtifactData {
  return {
    id: `art-${++artId}`,
    setKey,
    slotKey: slot as ArtifactData["slotKey"],
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {},
  };
}

// Real set keys from resources (verified against artifactIdToHalfSetId):
//   halfSetId "atk%-18"  → gladiators_finale, shimenawas_reminiscence, …
//   halfSetId "er-20"    → emblem_of_severed_fate, …
//   halfSetId "pyro%-15" → crimson_witch_of_flames
const CW = "crimson_witch_of_flames"; // pyro%-15
const GL = "gladiators_finale"; // atk%-18
const SH = "shimenawas_reminiscence"; // atk%-18
const ESF = "emblem_of_severed_fate"; // er-20
const OFF = "thundering_fury"; // electro%-15 — used as generic off-set

// 5-slot tuple helpers
function pieces(...sets: string[]): ArtifactData[] {
  return sets.map((s) => art(s));
}

// ── 4-piece set tests ──────────────────────────────────────────────────────

describe("matchesSetRequirement — 4pc", () => {
  it("accepts 4 required pieces + 1 off-set (flexible slot)", () => {
    expect(
      matchesSetRequirement(pieces(CW, CW, CW, CW, OFF), CW, undefined)
    ).toBe(true);
  });

  it("accepts 5 required pieces (no flexible slot needed)", () => {
    expect(
      matchesSetRequirement(pieces(CW, CW, CW, CW, CW), CW, undefined)
    ).toBe(true);
  });

  it("rejects 3 required pieces + 2 off-set", () => {
    expect(
      matchesSetRequirement(pieces(CW, CW, CW, OFF, OFF), CW, undefined)
    ).toBe(false);
  });

  it("rejects fewer than 4 required pieces regardless of off-set variety", () => {
    expect(
      matchesSetRequirement(pieces(CW, CW, GL, SH, OFF), CW, undefined)
    ).toBe(false);
  });
});

// ── 2+2 tests — different halfSetIds ──────────────────────────────────────

describe("matchesSetRequirement — 2+2 (different halfSetIds)", () => {
  const h1 = "atk%-18";
  const h2 = "er-20";

  it("accepts 2 of GL (h1) + 2 of ESF (h2) + 1 off-set (flexible slot)", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, ESF, ESF, OFF), null, [h1, h2])
    ).toBe(true);
  });

  it("accepts 3 of GL (h1) + 2 of ESF (h2) — extra h1 piece fills flexible slot", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, GL, ESF, ESF), null, [h1, h2])
    ).toBe(true);
  });

  it("rejects 1 of GL + 1 of SH (h1 split between sets, neither has 2) + 2 ESF", () => {
    // 1 Gladiator's + 1 Shimenawa = 2 pieces with halfSetId atk%-18 total,
    // but neither set individually has ≥2 → the 2pc bonus cannot activate.
    expect(
      matchesSetRequirement(pieces(GL, SH, ESF, ESF, OFF), null, [h1, h2])
    ).toBe(false);
  });

  it("rejects only 1 piece for h1 (not enough for 2pc bonus)", () => {
    expect(
      matchesSetRequirement(pieces(GL, ESF, ESF, OFF, OFF), null, [h1, h2])
    ).toBe(false);
  });

  it("rejects only 1 piece for h2 (not enough for 2pc bonus)", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, ESF, OFF, OFF), null, [h1, h2])
    ).toBe(false);
  });

  it("rejects 5 off-set pieces", () => {
    expect(
      matchesSetRequirement(pieces(OFF, OFF, OFF, OFF, OFF), null, [h1, h2])
    ).toBe(false);
  });
});

// ── 2+2 tests — same halfSetId (double bonus of same type) ─────────────────

describe("matchesSetRequirement — 2+2 (same halfSetId, e.g. double ATK%)", () => {
  const h = "atk%-18";

  it("accepts 2×GL + 2×SH + 1 off-set — two distinct sets each ≥2 pieces", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, SH, SH, OFF), null, [h, h])
    ).toBe(true);
  });

  it("accepts 2×GL + 3×SH — flexible slot taken by extra SH piece", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, SH, SH, SH), null, [h, h])
    ).toBe(true);
  });

  it("rejects 3×GL + 1×SH + 1 off — SH has only 1 piece, its 2pc bonus cannot activate", () => {
    // This was the 3+1+1 bug: old code counted by halfSetId (total = 4) and
    // passed, but only GL's bonus activates, not SH's.
    expect(
      matchesSetRequirement(pieces(GL, GL, GL, SH, OFF), null, [h, h])
    ).toBe(false);
  });

  it("rejects 4×GL + 1 off — only one distinct set satisfies, need two", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, GL, GL, OFF), null, [h, h])
    ).toBe(false);
  });

  it("rejects 5×GL — still only one distinct set, need two different sets", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, GL, GL, GL), null, [h, h])
    ).toBe(false);
  });

  it("rejects 2×GL + 1×SH + 2 off — SH has only 1 piece", () => {
    expect(
      matchesSetRequirement(pieces(GL, GL, SH, OFF, OFF), null, [h, h])
    ).toBe(false);
  });
});

// ── No set constraint ──────────────────────────────────────────────────────

describe("matchesSetRequirement — no constraint", () => {
  it("accepts any combination when no set is required", () => {
    expect(
      matchesSetRequirement(pieces(CW, GL, SH, ESF, OFF), null, undefined)
    ).toBe(true);
  });

  it("accepts all off-set pieces", () => {
    expect(
      matchesSetRequirement(pieces(OFF, OFF, OFF, OFF, OFF), null, undefined)
    ).toBe(true);
  });

  it("accepts empty halfSetIds array (treated as no constraint)", () => {
    expect(matchesSetRequirement(pieces(CW, GL, SH, ESF, OFF), null, [])).toBe(
      true
    );
  });
});
