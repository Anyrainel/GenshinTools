import type { AccountData, ArtifactData, Slot } from "@/data/types";
import { buildEquipInstructions } from "@/lib/artifact-manager/instructions";
import type { Team } from "@/stores/useTeamStore";
import { describe, expect, it } from "vitest";

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "art-1",
    setKey: "emblem_of_severed_fate",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: true,
    substats: { cr: 3.89, cd: 7.77 },
    ...overrides,
  };
}

function makeTeam(charIds: (string | null)[]): Team {
  return {
    id: "team-1",
    name: "Test Team",
    characters: [
      charIds[0] ?? null,
      charIds[1] ?? null,
      charIds[2] ?? null,
      charIds[3] ?? null,
    ],
    weapons: [null, null, null, null],
    artifacts: [null, null, null, null],
    reactions: [],
    opts: {},
    calcContext: {
      enemyLevel: 110,
      enemyRes: 0.1,
      rollMultiplier: 0.85,
      substatBudget: "8_6",
    },
    selectedFormula: null,
    optimizationResult: null,
    formulaMode: "single",
    combo: null,
  };
}

function makeAccount(
  chars: { key: string; artifacts: Partial<Record<Slot, ArtifactData>> }[]
): AccountData {
  return {
    characters: chars.map((c) => ({
      key: c.key,
      constellation: 0,
      level: 90,
      talent: { auto: 1, skill: 1, burst: 1 },
      artifacts: c.artifacts,
    })),
    extraArtifacts: [],
    extraWeapons: [],
  };
}

describe("buildEquipInstructions", () => {
  it("creates equip instructions for all optimized artifacts", () => {
    const team = makeTeam(["furina", "raiden_shogun"]);
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: {
        flower: makeArtifact({ id: "a1", slotKey: "flower" }),
        plume: makeArtifact({ id: "a2", slotKey: "plume" }),
      },
      raiden_shogun: {
        flower: makeArtifact({ id: "a3", slotKey: "flower" }),
      },
    };
    const account = makeAccount([
      { key: "furina", artifacts: {} },
      { key: "raiden_shogun", artifacts: {} },
    ]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.request.equip).toHaveLength(3);
    expect(payload.artifactIds).toEqual(["a1", "a2", "a3"]);
  });

  it("sets GOOD character key as location on each instruction", () => {
    const team = makeTeam(["furina"]);
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: {
        flower: makeArtifact({ id: "a1", slotKey: "flower" }),
      },
    };
    const account = makeAccount([{ key: "furina", artifacts: {} }]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.request.equip[0].location).toBe("Furina");
  });

  it("converts artifact to GOOD v3 format with current owner as artifact.location", () => {
    const team = makeTeam(["furina"]);
    const art = makeArtifact({
      id: "a1",
      slotKey: "flower",
      setKey: "emblem_of_severed_fate",
    });
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: { flower: art },
    };
    // Artifact is currently on raiden_shogun
    const account = makeAccount([
      { key: "furina", artifacts: {} },
      { key: "raiden_shogun", artifacts: { flower: art } },
    ]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.request.equip[0].artifact.location).toBe("RaidenShogun");
    expect(payload.request.equip[0].location).toBe("Furina");
  });

  it("builds swapMap with fromChar and toChar for each artifact", () => {
    const team = makeTeam(["furina"]);
    const art = makeArtifact({ id: "a1", slotKey: "flower" });
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: { flower: art },
    };
    const account = makeAccount([
      { key: "furina", artifacts: {} },
      { key: "raiden_shogun", artifacts: { flower: art } },
    ]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.swapMap.get("a1")).toEqual({
      fromChar: "raiden_shogun",
      toChar: "furina",
    });
  });

  it("sets fromChar to null when artifact is in inventory", () => {
    const team = makeTeam(["furina"]);
    const art = makeArtifact({ id: "a1", slotKey: "flower" });
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: { flower: art },
    };
    const account = makeAccount([{ key: "furina", artifacts: {} }]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.swapMap.get("a1")).toEqual({
      fromChar: null,
      toChar: "furina",
    });
  });

  it("skips null character slots in team", () => {
    const team = makeTeam(["furina", null, null, null]);
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: { flower: makeArtifact({ id: "a1" }) },
    };
    const account = makeAccount([{ key: "furina", artifacts: {} }]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.request.equip).toHaveLength(1);
  });

  it("skips characters with no optimized artifacts", () => {
    const team = makeTeam(["furina", "raiden_shogun"]);
    const optimized: Record<string, Record<string, ArtifactData>> = {
      furina: { flower: makeArtifact({ id: "a1" }) },
    };
    const account = makeAccount([
      { key: "furina", artifacts: {} },
      { key: "raiden_shogun", artifacts: {} },
    ]);

    const payload = buildEquipInstructions(team, optimized, account);

    expect(payload.request.equip).toHaveLength(1);
  });
});
