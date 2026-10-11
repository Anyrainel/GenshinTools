import { beforeAll, describe, expect, it } from "vitest";
import { allSlots } from "@/data/enums";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { ArtifactData, CharacterData, WeaponData } from "@/data/types";
import {
  collectSearchWeapons,
  resolveSearchInvestment,
  searchTeammates,
} from "@/lib/team-comp/teammateSearch";
import type {
  TeammateSearchMessage,
  TeammateSearchRequest,
} from "@/lib/team-comp/teammateSearchTypes";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function character(
  key: string,
  weaponKey: string,
  refinement: number
): CharacterData {
  const weapon: WeaponData = {
    id: `${key}-weapon`,
    key: weaponKey,
    refinement,
    level: 90,
    lock: false,
  };
  return {
    key,
    level: 90,
    constellation: key === "hu_tao" ? 1 : 6,
    talent: { auto: 10, skill: 10, burst: 10 },
    weapon,
    artifacts: Object.fromEntries(
      allSlots.map((slotKey) => [
        slotKey,
        {
          id: `${key}-${slotKey}`,
          setKey: "gladiators_finale",
          slotKey,
          level: 20,
          rarity: 5,
          mainStatKey:
            slotKey === "flower"
              ? "hp"
              : slotKey === "plume"
                ? "atk"
                : slotKey === "circlet"
                  ? "cr"
                  : "atk%",
          lock: false,
          substats: { cr: 10, cd: 20, er: 12, "atk%": 10 },
        } satisfies ArtifactData,
      ])
    ),
  };
}

function request(): TeammateSearchRequest {
  return {
    fixedIds: ["hu_tao", "xingqiu", "zhongli"],
    settings: {
      constellation4: null,
      constellation5: null,
      refinement34: null,
      refinement5: null,
    },
    account: {
      characters: [
        character("hu_tao", "staff_of_homa", 1),
        character("xingqiu", "sacrificial_sword", 3),
        character("zhongli", "favonius_lance", 2),
        character("bennett", "favonius_sword", 4),
      ],
      extraArtifacts: [],
      extraWeapons: [],
    },
  };
}

async function run(input: TeammateSearchRequest) {
  let result: Extract<TeammateSearchMessage, { type: "result" }> | undefined;
  await searchTeammates(
    input,
    characterStatsResource.peek()!,
    weaponStatsResource.peek()!,
    (message) => {
      if (message.type === "result") result = message;
    }
  );
  expect(result).toBeDefined();
  return result!;
}

describe("teammate search", () => {
  it.each([
    1, 2,
  ])("fills all remaining slots with %i fixed characters", async (fixedCount) => {
    const input = request();
    input.fixedIds = input.fixedIds.slice(0, fixedCount);
    const result = await run(input);
    expect(result.results.length).toBeGreaterThan(0);
    for (const team of result.results) {
      expect(team.configs).toHaveLength(4);
      expect(
        team.configs.slice(0, fixedCount).map((config) => config.charId)
      ).toEqual(input.fixedIds);
      expect(new Set(team.configs.map((config) => config.charId)).size).toBe(4);
      expect(new Set(team.weaponInstanceIds).size).toBe(4);
      const ids = Object.values(team.artifactsByChar).flatMap((slots) =>
        Object.values(slots).map((artifact) => artifact?.id)
      );
      expect(ids).toHaveLength(20);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(20);
    }
  }, 30000);
  it("uses account levels by default and applies rarity group overrides", () => {
    const input = request();
    const five = input.account.characters[0];
    const four = input.account.characters[1];
    expect(resolveSearchInvestment(five, five.weapon!, input.settings)).toEqual(
      { constellation: 1, refinement: 1 }
    );
    expect(resolveSearchInvestment(four, four.weapon!, input.settings)).toEqual(
      { constellation: 6, refinement: 3 }
    );
    const overrides = {
      constellation4: 2,
      constellation5: 0,
      refinement34: 5,
      refinement5: 2,
    };
    expect(resolveSearchInvestment(five, five.weapon!, overrides)).toEqual({
      constellation: 0,
      refinement: 2,
    });
    expect(resolveSearchInvestment(four, four.weapon!, overrides)).toEqual({
      constellation: 2,
      refinement: 5,
    });
  });

  it("preserves physical weapon copies and deduplicates overlapping account boundaries", () => {
    const input = request();
    const weapon = input.account.characters[1].weapon!;
    input.account.extraWeapons.push(weapon, {
      ...weapon,
      id: "second-copy",
      refinement: 1,
    });
    const copies = collectSearchWeapons(input);
    expect(
      copies.filter((copy) => copy.key === weapon.key).map((copy) => copy.id)
    ).toEqual([weapon.id, "second-copy"]);
  });

  it("returns reproducible complete teams with distinct owned weapons and artifacts", async () => {
    const input = request();
    const result = await run(input);
    expect(result.results.length).toBeGreaterThan(0);
    for (const team of result.results) {
      expect(team.configs).toHaveLength(4);
      expect(team.configs.slice(0, 3).map((config) => config.charId)).toEqual(
        input.fixedIds
      );
      expect(new Set(team.weaponInstanceIds).size).toBe(4);
      const artifacts = Object.values(team.artifactsByChar).flatMap((slots) =>
        Object.values(slots)
      );
      expect(artifacts).toHaveLength(20);
      expect(artifacts.every(Boolean)).toBe(true);
      expect(new Set(artifacts.map((artifact) => artifact!.id)).size).toBe(20);
      expect(team.damage).toBeGreaterThan(0);
      expect(team.calcContext.enemyRes).toBe(0.1);
      expect(
        team.combo.lines.every((line) => line.charId === input.fixedIds[0])
      ).toBe(true);
    }
  }, 30000);

  it("does not reuse a fixed weapon instance to fill a remaining slot", async () => {
    const input = request();
    input.account.characters[3].weapon = input.account.characters[1].weapon;
    const result = await run(input);
    expect(result.results).toEqual([]);
  });

  it("does not suggest frozen artifacts or incomplete loadouts", async () => {
    const input = request();
    input.excludedArtifactIds = Object.values(
      input.account.characters[0].artifacts
    ).map((artifact) => artifact.id);
    const result = await run(input);
    expect(result.results).toEqual([]);
  }, 30000);

  it("rejects invalid fixed rosters and rank settings", async () => {
    const input = request();
    input.fixedIds = ["hu_tao", "hu_tao"];
    await expect(run(input)).rejects.toThrow("different fixed");
    input.fixedIds = ["hu_tao"];
    input.settings.refinement5 = 0;
    await expect(run(input)).rejects.toThrow("refinement");
  });
});
