/**
 * Tests for Nicole's cross-scaled Q Arcane Projection and C1 Unity formulas.
 *
 * Nicole's Q projections evaluate in the triggering teammate's stat context
 * (their ATK, element, DMG%, crit, EM) via FormulaEntry.statsCharId override.
 * Game text: "该伤害受益于该角色的攻击力,并视为由该角色造成的伤害"
 *
 * Nicole is a beta character. We mock betaEnabled() and the gzip loader so
 * that beta character/weapon stats are loaded in the test environment.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock betaEnabled BEFORE constants.ts evaluates.
vi.mock("@/lib/betaFlag", () => ({
  betaEnabled: () => true,
  setBetaEnabled: () => {},
  maybeHandleBetaMagic: () => false,
}));

// Mock fetchGzipJson to resolve beta stat files from disk instead of fetch().
vi.mock("@/lib/gzipJson", async (importOriginal) => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const { gunzipSync } = await import("node:zlib");

  return {
    fetchGzipJson: async (url: string) => {
      // url is like "/src/data/game/character_beta_stats.json.gz"
      const fileName = url.split("/").pop()!;
      const filePath = resolve(__dirname, "../../../src/data/game", fileName);
      try {
        const buf = readFileSync(filePath);
        return JSON.parse(gunzipSync(buf).toString("utf-8"));
      } catch {
        // If file doesn't exist, return empty object (no beta data)
        return {};
      }
    },
  };
});

import type { Faction } from "@/data/types";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  type FormulaEntry,
  TeamMeta,
  createCharacter,
} from "@/lib/team-comp/damageModels";
import "@/lib/team-comp/index";

beforeAll(async () => {
  await preloadGameStats();
});

// ─── Helpers ───

function nicoleWithTeam(teammates: string[], constellation = 0) {
  const charIds = ["nicole", ...teammates];
  const constellations: Record<string, number> = { nicole: constellation };
  const teamMeta = new TeamMeta(charIds, constellations);
  const char = createCharacter("nicole", 90, constellation, teamMeta);
  return { char, teamMeta };
}

function getEntries(char: { allFormulaEntries: Record<string, FormulaEntry> }) {
  return char.allFormulaEntries;
}

function projEntries(entries: Record<string, FormulaEntry>) {
  return Object.entries(entries).filter(([id]) =>
    id.startsWith("nicole-q-proj-slot")
  );
}

function unityEntries(entries: Record<string, FormulaEntry>) {
  return Object.entries(entries).filter(([id]) =>
    id.startsWith("nicole-c1-unity-slot")
  );
}

// ─── Tests ───

describe("Nicole Q Arcane Projection — slot-based formulas", () => {
  it("generates one projection formula per teammate slot", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    expect(projs).toHaveLength(4); // nicole + 3 teammates = 4 slots
    expect(projs.map(([id]) => id)).toEqual([
      "nicole-q-proj-slot1",
      "nicole-q-proj-slot2",
      "nicole-q-proj-slot3",
      "nicole-q-proj-slot4",
    ]);
  });

  it("sets statsCharId to the slot occupant for each projection", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);

    expect(entries["nicole-q-proj-slot1"].statsCharId).toBe("nicole");
    expect(entries["nicole-q-proj-slot2"].statsCharId).toBe("amber");
    expect(entries["nicole-q-proj-slot3"].statsCharId).toBe("kaeya");
    expect(entries["nicole-q-proj-slot4"].statsCharId).toBe("lisa");
  });

  it("sets DamageTag element to each occupant's element", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);

    // nicole = Pyro, amber = Pyro, kaeya = Cryo, lisa = Electro
    expect(entries["nicole-q-proj-slot1"].parts[0].formula.tag.element).toBe(
      "Pyro"
    );
    expect(entries["nicole-q-proj-slot2"].parts[0].formula.tag.element).toBe(
      "Pyro"
    );
    expect(entries["nicole-q-proj-slot3"].parts[0].formula.tag.element).toBe(
      "Cryo"
    );
    expect(entries["nicole-q-proj-slot4"].parts[0].formula.tag.element).toBe(
      "Electro"
    );
  });

  it("tags all projections as burst ability", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    for (const [, entry] of projs) {
      expect(entry.parts[0].formula.tag.ability).toBe("burst");
    }
  });

  it("sets offField: false (triggerer is on-field)", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    for (const [, entry] of projs) {
      expect(entry.parts[0].offField).toBe(false);
    }
  });

  it("sets hits: 5 per projection formula", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);

    expect(entries["nicole-q-proj-slot1"].parts[0].hits).toBe(5);
    expect(entries["nicole-q-proj-slot2"].parts[0].hits).toBe(5);
  });

  it("bakes occupant name into labels", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);

    const proj2 = entries["nicole-q-proj-slot2"];
    expect(proj2.label.en).toContain("Amber");
    expect(proj2.label.zh).toContain("安柏");
  });

  it("3-char team → 3 projection entries (no slot 4)", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    expect(projs).toHaveLength(3);
    expect(entries["nicole-q-proj-slot4"]).toBeUndefined();
  });

  it("2-char team → 2 projection entries", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    expect(projs).toHaveLength(2);
  });

  it("Nicole in slot 1 → slot-1 projection uses nicole as statsCharId", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);

    expect(entries["nicole-q-proj-slot1"].statsCharId).toBe("nicole");
  });
});

describe("Nicole C1 Unity — constellation gating", () => {
  it("no C1 Unity entries at C0", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"], 0);
    const entries = getEntries(char);

    expect(unityEntries(entries)).toHaveLength(0);
  });

  it("generates C1 Unity entries at C1", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"], 1);
    const entries = getEntries(char);
    const unity = unityEntries(entries);

    expect(unity).toHaveLength(4);
  });

  it("C1 Unity has correct statsCharId per slot", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"], 1);
    const entries = getEntries(char);

    expect(entries["nicole-c1-unity-slot1"].statsCharId).toBe("nicole");
    expect(entries["nicole-c1-unity-slot2"].statsCharId).toBe("amber");
    expect(entries["nicole-c1-unity-slot3"].statsCharId).toBe("kaeya");
  });

  it("C1 Unity uses occupant's element", () => {
    const { char } = nicoleWithTeam(["kaeya"], 1);
    const entries = getEntries(char);

    expect(entries["nicole-c1-unity-slot2"].parts[0].formula.tag.element).toBe(
      "Cryo"
    );
  });

  it("C1 Unity entries have minC: 1", () => {
    const { char } = nicoleWithTeam(["amber"], 6);
    const entries = getEntries(char);

    expect(entries["nicole-c1-unity-slot1"].minC).toBe(1);
    expect(entries["nicole-c1-unity-slot2"].minC).toBe(1);
  });

  it("C1 Unity entries have offField: false", () => {
    const { char } = nicoleWithTeam(["amber"], 1);
    const entries = getEntries(char);

    for (const [, entry] of unityEntries(entries)) {
      expect(entry.parts[0].offField).toBe(false);
    }
  });
});

describe("Nicole P4 Hexerei bespoke buff", () => {
  it("no bespoke buff when Hexerei count < 2", () => {
    // nicole is Hexerei, amber is not → only 1 Hexerei → P4 inactive
    const { char } = nicoleWithTeam(["amber", "kaeya"], 6);
    const entries = getEntries(char);

    for (const [, entry] of projEntries(entries)) {
      expect(entry.parts[0].bespokeBuffs ?? []).toHaveLength(0);
    }
  });

  it("has bespoke buff when Hexerei count ≥ 2", () => {
    // nicole (Hexerei) + prune (Hexerei) → P4 active
    const { char } = nicoleWithTeam(["prune", "kaeya"], 6);
    const entries = getEntries(char);

    for (const [, entry] of projEntries(entries)) {
      expect(entry.parts[0].bespokeBuffs?.length).toBeGreaterThan(0);
    }
  });

  it("P4 buff targets each occupant via receiver team + charId", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"], 6);
    const entries = getEntries(char);

    const proj2 = entries["nicole-q-proj-slot2"]; // prune's slot
    const buff = proj2.parts[0].bespokeBuffs![0];
    expect(buff.target.receiver).toBe("team");
    expect((buff.target as { charId: string }).charId).toBe("prune");

    const proj3 = entries["nicole-q-proj-slot3"]; // kaeya's slot
    const buff3 = proj3.parts[0].bespokeBuffs![0];
    expect((buff3.target as { charId: string }).charId).toBe("kaeya");
  });

  it("P4 buff on C1 Unity entries when Hexerei active", () => {
    const { char } = nicoleWithTeam(["prune"], 1);
    const entries = getEntries(char);

    for (const [, entry] of unityEntries(entries)) {
      expect(entry.parts[0].bespokeBuffs?.length).toBeGreaterThan(0);
    }
  });
});

describe("Nicole comboDescriptor", () => {
  it("uses slot1 projection in default combo", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"], 0);
    const combo = (char as unknown as { comboDescriptor: { id: string }[] })
      .comboDescriptor;

    expect(
      combo.some((c: { id: string }) => c.id === "nicole-q-proj-slot1")
    ).toBe(true);
  });

  it("includes C1 Unity in combo at C1+", () => {
    const { char } = nicoleWithTeam(["amber"], 1);
    const combo = (char as unknown as { comboDescriptor: { id: string }[] })
      .comboDescriptor;

    expect(
      combo.some((c: { id: string }) => c.id === "nicole-c1-unity-slot1")
    ).toBe(true);
  });

  it("no C1 Unity in combo at C0", () => {
    const { char } = nicoleWithTeam(["amber"], 0);
    const combo = (char as unknown as { comboDescriptor: { id: string }[] })
      .comboDescriptor;

    expect(
      combo.some((c: { id: string }) => c.id === "nicole-c1-unity-slot1")
    ).toBe(false);
  });
});
