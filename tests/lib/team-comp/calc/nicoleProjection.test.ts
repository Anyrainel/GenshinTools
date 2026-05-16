/**
 * Tests for Nicole's cross-scaled Q Arcane Projection and C1 Unity formulas.
 *
 * Nicole's Q projections evaluate in the triggering teammate's stat context
 * (their ATK, element, DMG%, crit, EM) via FormulaPart.statsCharId override.
 * Game text: "该伤害受益于该角色的攻击力,并视为由该角色造成的伤害"
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { createCharacter, getOptionDef } from "@/lib/dmgcalc/core/registry";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import type { FormulaEntry, OptionMap } from "@/lib/dmgcalc/types";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function nicoleWithTeam(
  teammates: string[],
  constellation = 0,
  combatOpts: OptionMap = {}
) {
  const charIds = ["nicole", ...teammates];
  const constellations: Record<string, number> = { nicole: constellation };
  const teamMeta = new TeamMeta(charIds, constellations);
  const char = createCharacter(
    "nicole",
    90,
    constellation,
    teamMeta,
    combatOpts
  );
  return { char, teamMeta };
}

function getEntries(char: { allFormulaEntries: Record<string, FormulaEntry> }) {
  return char.allFormulaEntries;
}

function projEntries(entries: Record<string, FormulaEntry>) {
  return Object.entries(entries).filter(([id]) =>
    id.startsWith("nicole-q-coord-slot")
  );
}

function unityEntries(entries: Record<string, FormulaEntry>) {
  return Object.entries(entries).filter(([id]) =>
    id.startsWith("nicole-c1-coord-slot")
  );
}

type InspectableBuff = {
  source: { origin?: string };
  target: {
    receiver: string;
    factions?: readonly string[];
    filter?: { elements?: readonly string[] };
  };
  staticBuffs: readonly { key: string; value: number }[];
};

function inspectBuffs(char: { buffs: unknown[] }): InspectableBuff[] {
  return char.buffs as InspectableBuff[];
}

function atkBuffsForOrigin(char: { buffs: unknown[] }, origin: string) {
  return inspectBuffs(char).filter(
    (buff) =>
      buff.source.origin === origin &&
      buff.staticBuffs.some((entry) => entry.key === "atk")
  );
}

function resReductionElements(char: { buffs: unknown[] }) {
  return inspectBuffs(char)
    .filter(
      (buff) =>
        buff.source.origin === "C2" &&
        buff.staticBuffs.some((entry) => entry.key === "resReduction%")
    )
    .flatMap((buff) => buff.target.filter?.elements ?? [])
    .sort();
}

describe("Nicole E ATK buff option", () => {
  it("registers all-Theosis as the default option", () => {
    const option = getOptionDef("nicole");

    expect(option?.label.en).toBe("E ATK Buff");
    expect(option?.choices.map((choice) => choice.value)).toEqual([
      "all-theosis",
      "hexerei-theosis",
    ]);
  });

  it("defaults to teamwide Theosis ATK uplift", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"]);
    const p1AtkBuffs = atkBuffsForOrigin(char, "P1");

    expect(p1AtkBuffs).toHaveLength(1);
    expect(p1AtkBuffs[0].target.receiver).toBe("team");
    expect(p1AtkBuffs[0].target.factions).toBeUndefined();
    expect(p1AtkBuffs[0].staticBuffs).toContainEqual({
      key: "atk",
      value: 300,
    });
  });

  it("can keep only Hexerei characters on the higher Theosis ATK tier", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"], 0, {
      nicole: "hexerei-theosis",
    });
    const p1AtkBuffs = atkBuffsForOrigin(char, "P1");

    expect(p1AtkBuffs).toHaveLength(1);
    expect(p1AtkBuffs[0].target.receiver).toBe("team");
    expect(p1AtkBuffs[0].target.factions).toEqual(["Hexerei"]);
    expect(p1AtkBuffs[0].staticBuffs).toContainEqual({
      key: "atk",
      value: 300,
    });
  });

  it("keeps C2 Grace ATK teamwide as the lower tier in split mode", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"], 2, {
      nicole: "hexerei-theosis",
    });
    const c2AtkBuffs = atkBuffsForOrigin(char, "C2");
    const p1AtkBuffs = atkBuffsForOrigin(char, "P1");

    expect(c2AtkBuffs).toHaveLength(1);
    expect(c2AtkBuffs[0].target.receiver).toBe("team");
    expect(c2AtkBuffs[0].target.factions).toBeUndefined();
    expect(c2AtkBuffs[0].staticBuffs).toContainEqual({
      key: "atk",
      value: 300,
    });

    expect(p1AtkBuffs).toHaveLength(1);
    expect(p1AtkBuffs[0].target.factions).toEqual(["Hexerei"]);
  });

  it("limits C2 RES shred to Theosis recipient elements in split mode", () => {
    const defaultCase = nicoleWithTeam(["prune", "kaeya"], 2);
    const splitCase = nicoleWithTeam(["prune", "kaeya"], 2, {
      nicole: "hexerei-theosis",
    });

    expect(resReductionElements(defaultCase.char)).toEqual([
      "Anemo",
      "Cryo",
      "Pyro",
    ]);
    expect(resReductionElements(splitCase.char)).toEqual(["Anemo", "Pyro"]);
  });

  it("treats C6 as teamwide Theosis even when split mode is selected", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"], 6, {
      nicole: "hexerei-theosis",
    });
    const p1AtkBuffs = atkBuffsForOrigin(char, "P1");

    expect(p1AtkBuffs).toHaveLength(1);
    expect(p1AtkBuffs[0].target.receiver).toBe("team");
    expect(p1AtkBuffs[0].target.factions).toBeUndefined();
  });
});

describe("Nicole Q Arcane Projection — slot-based formulas", () => {
  it("generates one projection formula per teammate slot", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    expect(projs).toHaveLength(4); // nicole + 3 teammates = 4 slots
    expect(projs.map(([id]) => id)).toEqual([
      "nicole-q-coord-slot1",
      "nicole-q-coord-slot2",
      "nicole-q-coord-slot3",
      "nicole-q-coord-slot4",
    ]);
  });

  it("sets statsCharId to the slot occupant for each projection", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);

    expect(entries["nicole-q-coord-slot1"].parts[0].statsCharId).toBe("nicole");
    expect(entries["nicole-q-coord-slot2"].parts[0].statsCharId).toBe("amber");
    expect(entries["nicole-q-coord-slot3"].parts[0].statsCharId).toBe("kaeya");
    expect(entries["nicole-q-coord-slot4"].parts[0].statsCharId).toBe("lisa");
  });

  it("sets DamageTag element to each occupant's element", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya", "lisa"]);
    const entries = getEntries(char);

    // nicole = Pyro, amber = Pyro, kaeya = Cryo, lisa = Electro
    expect(entries["nicole-q-coord-slot1"].parts[0].formula.tag.element).toBe(
      "Pyro"
    );
    expect(entries["nicole-q-coord-slot2"].parts[0].formula.tag.element).toBe(
      "Pyro"
    );
    expect(entries["nicole-q-coord-slot3"].parts[0].formula.tag.element).toBe(
      "Cryo"
    );
    expect(entries["nicole-q-coord-slot4"].parts[0].formula.tag.element).toBe(
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

  it("projection parts have no hits override (count expressed via combo)", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);

    expect(entries["nicole-q-coord-slot1"].parts[0].hits).toBeUndefined();
    expect(entries["nicole-q-coord-slot2"].parts[0].hits).toBeUndefined();
  });

  it("bakes occupant name into labels", () => {
    const { char } = nicoleWithTeam(["amber"]);
    const entries = getEntries(char);

    const proj2 = entries["nicole-q-coord-slot2"];
    expect(proj2.label.en).toContain("Amber");
    expect(proj2.label.zh).toContain("安柏");
  });

  it("3-char team → 3 projection entries (no slot 4)", () => {
    const { char } = nicoleWithTeam(["amber", "kaeya"]);
    const entries = getEntries(char);
    const projs = projEntries(entries);

    expect(projs).toHaveLength(3);
    expect(entries["nicole-q-coord-slot4"]).toBeUndefined();
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

    expect(entries["nicole-q-coord-slot1"].parts[0].statsCharId).toBe("nicole");
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

    expect(entries["nicole-c1-coord-slot1"].parts[0].statsCharId).toBe(
      "nicole"
    );
    expect(entries["nicole-c1-coord-slot2"].parts[0].statsCharId).toBe("amber");
    expect(entries["nicole-c1-coord-slot3"].parts[0].statsCharId).toBe("kaeya");
  });

  it("C1 Unity uses occupant's element", () => {
    const { char } = nicoleWithTeam(["kaeya"], 1);
    const entries = getEntries(char);

    expect(entries["nicole-c1-coord-slot2"].parts[0].formula.tag.element).toBe(
      "Cryo"
    );
  });

  it("C1 Unity entries have minC: 1", () => {
    const { char } = nicoleWithTeam(["amber"], 6);
    const entries = getEntries(char);

    expect(entries["nicole-c1-coord-slot1"].minC).toBe(1);
    expect(entries["nicole-c1-coord-slot2"].minC).toBe(1);
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

  it("has bespoke buff only on Hexerei occupants when Hexerei count ≥ 2", () => {
    // nicole (Hexerei) + prune (Hexerei) → P4 active, but kaeya is not Hexerei
    const { char } = nicoleWithTeam(["prune", "kaeya"], 6);
    const entries = getEntries(char);

    expect(
      entries["nicole-q-coord-slot1"].parts[0].bespokeBuffs?.length
    ).toBeGreaterThan(0);
    expect(
      entries["nicole-q-coord-slot2"].parts[0].bespokeBuffs?.length
    ).toBeGreaterThan(0);
    expect(
      entries["nicole-q-coord-slot3"].parts[0].bespokeBuffs ?? []
    ).toHaveLength(0);
  });

  it("P4 buff targets each Hexerei occupant via receiver team + charId", () => {
    const { char } = nicoleWithTeam(["prune", "kaeya"], 6);
    const entries = getEntries(char);

    const proj1 = entries["nicole-q-coord-slot1"]; // nicole's slot
    const buff1 = proj1.parts[0].bespokeBuffs![0];
    expect(buff1.target.receiver).toBe("team");
    expect((buff1.target as { charId: string }).charId).toBe("nicole");

    const proj2 = entries["nicole-q-coord-slot2"]; // prune's slot
    const buff = proj2.parts[0].bespokeBuffs![0];
    expect(buff.target.receiver).toBe("team");
    expect((buff.target as { charId: string }).charId).toBe("prune");

    const proj3 = entries["nicole-q-coord-slot3"]; // kaeya's slot
    expect(proj3.parts[0].bespokeBuffs ?? []).toHaveLength(0);
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
    const combo = (
      char as unknown as { comboDescriptor: { id: string; count: number }[] }
    ).comboDescriptor;

    expect(combo.find((c) => c.id === "nicole-q-coord-slot1")).toEqual({
      id: "nicole-q-coord-slot1",
      count: 4,
    });
  });

  it("includes 3 C1 Unity chances for slot 1 in combo at C1+", () => {
    const { char } = nicoleWithTeam(["amber"], 1);
    const combo = (
      char as unknown as { comboDescriptor: { id: string; count: number }[] }
    ).comboDescriptor;

    expect(combo.find((c) => c.id === "nicole-c1-coord-slot1")).toEqual({
      id: "nicole-c1-coord-slot1",
      count: 3,
    });
  });

  it("no C1 Unity in combo at C0", () => {
    const { char } = nicoleWithTeam(["amber"], 0);
    const combo = (
      char as unknown as { comboDescriptor: { id: string; count: number }[] }
    ).comboDescriptor;

    expect(combo.find((c) => c.id === "nicole-c1-coord-slot1")).toBeUndefined();
  });
});
