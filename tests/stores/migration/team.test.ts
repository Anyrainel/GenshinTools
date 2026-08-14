import { describe, expect, it } from "vitest";
import type { TeamSetupConfig } from "@/lib/team-comp/types";
import { migrateTeamStore } from "@/stores/migration/team";

/** v18 persisted shape: the ER scenario was React state in ErCalcCard, so
 *  `energy` carried nothing but the authored timelines. */
function v18State(energy: Record<string, unknown>) {
  return {
    activePresetId: null,
    compDeltas: [],
    configsByTeamId: {
      "team-1": { combatOptions: {}, energy },
    },
    author: "",
    description: "",
    updatedAt: 1_700_000_000_000,
  };
}

const TIMELINES = [
  { actions: [{ char: "bennett", action: "E" }], periodic: [] },
];

function migratedEnergy(
  energy: Record<string, unknown>,
  version = 18
): (TeamSetupConfig["energy"] & Record<string, unknown>) | undefined {
  const result = migrateTeamStore(v18State(energy), version) as {
    configsByTeamId: Record<string, TeamSetupConfig>;
  };
  return result.configsByTeamId["team-1"]?.energy as
    | (TeamSetupConfig["energy"] & Record<string, unknown>)
    | undefined;
}

describe("migrateTeamStore — v19 ER scenario persistence", () => {
  it("keeps pre-v19 energy configs untouched so they read as the old defaults", () => {
    const energy = migratedEnergy({ timelines: TIMELINES });
    expect(energy?.timelines).toEqual(TIMELINES);
    expect(energy?.mode).toBeUndefined();
    expect(energy?.particleMode).toBeUndefined();
  });

  it("folds the removed 'min' particle mode into 'expected'", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      particleMode: "min",
    });
    expect(energy?.particleMode).toBe("expected");
  });

  it("preserves recognized scenario values", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      mode: "zero-energy-repeat",
      particleMode: "max",
    });
    expect(energy?.mode).toBe("zero-energy-repeat");
    expect(energy?.particleMode).toBe("max");
  });

  it("drops unrecognized scenario values back to the defaults", () => {
    const energy = migratedEnergy({
      timelines: TIMELINES,
      mode: "full-energy-once",
      particleMode: "percentile",
    });
    expect(energy?.mode).toBeUndefined();
    expect(energy?.particleMode).toBeUndefined();
    expect(energy?.timelines).toEqual(TIMELINES);
  });

  it("keeps a scenario-only energy config that has no timelines", () => {
    const energy = migratedEnergy({ mode: "zero-energy-start" });
    expect(energy?.mode).toBe("zero-energy-start");
  });

  it("tolerates configs without an energy block", () => {
    const result = migrateTeamStore(
      {
        activePresetId: null,
        compDeltas: [],
        configsByTeamId: { "team-1": { combatOptions: { a: "b" } } },
        author: "",
        description: "",
        updatedAt: 1_700_000_000_000,
      },
      18
    ) as { configsByTeamId: Record<string, TeamSetupConfig> };
    expect(result.configsByTeamId["team-1"]?.combatOptions).toEqual({ a: "b" });
  });
});
