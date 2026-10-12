import { beforeAll, describe, expect, it } from "vitest";
import { allSlots } from "@/data/enums";
import {
  type CharacterStatsMap,
  characterStatsResource,
  type WeaponStatsMap,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { ArtifactData, CharacterData } from "@/data/types";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamBuild } from "@/lib/dmgcalc/core/teamBuild";
import {
  buildReplacementCombo,
  runCharacterReplacement,
} from "@/lib/team-comp/characterReplacement";
import type {
  CharacterReplacementMessage,
  CharacterReplacementRequest,
} from "@/lib/team-comp/characterReplacementTypes";
import { buildTeamSlotConfigs } from "@/lib/team-comp/teamConfigUtils";
import { teamCompInputToComp } from "@/lib/team-comp/teamDeltas";

let chars: CharacterStatsMap;
let weapons: WeaponStatsMap;
beforeAll(async () => {
  const [allChars, allWeapons] = await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
  chars = Object.fromEntries(
    ["hu_tao", "xingqiu", "zhongli", "bennett", "fischl", "xiangling"].map(
      (id) => [id, allChars[id]]
    )
  );
  weapons = Object.fromEntries(
    [
      "staff_of_homa",
      "sacrificial_sword",
      "favonius_lance",
      "favonius_sword",
      "favonius_warbow",
      "the_stringless",
    ].map((id) => [id, allWeapons[id]])
  );
});
function character(key: string, weaponKey: string): CharacterData {
  return {
    key,
    level: 90,
    constellation: key === "hu_tao" ? 1 : 6,
    talent: { auto: 10, skill: 10, burst: 10 },
    weapon: {
      id: `${key}-weapon`,
      key: weaponKey,
      refinement: key === "hu_tao" ? 1 : 3,
      level: 90,
      lock: false,
    },
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
function request(): CharacterReplacementRequest {
  const accountData = {
    characters: [
      character("hu_tao", "staff_of_homa"),
      character("xingqiu", "sacrificial_sword"),
      character("zhongli", "favonius_lance"),
      character("bennett", "favonius_sword"),
      character("fischl", "favonius_warbow"),
    ],
    extraArtifacts: [],
    extraWeapons: [],
  };
  const teamComp = teamCompInputToComp({
    id: "replace",
    characters: accountData.characters.slice(0, 4).map((char) => char.key),
    weapons: accountData.characters.slice(0, 4).map((char) => char.weapon!.key),
    artifacts: Array.from({ length: 4 }, () => null),
  });
  const configs = buildTeamSlotConfigs(
    teamComp,
    { combatOptions: {} },
    accountData
  );
  const team = new TeamBuild(configs);
  const lines = configs.flatMap((config) =>
    Object.entries(team.catalog.getCombo(config.charId))
      .filter(([, count]) => count > 0)
      .map(([formulaId, count]) => ({
        charId: config.charId,
        formulaId,
        count,
      }))
  );
  lines[0].count = 37;
  const objective = {
    id: "authored",
    label: { en: "Custom", zh: "自定义" },
    lines,
  };
  return {
    teamComp,
    accountData,
    setupConfig: {
      combatOptions: {},
      damage: { formulaMode: "combo", combo: objective, enemyAura: "Hydro" },
    },
    objective,
    calcContext: {
      enemyLevel: 105,
      enemyRes: 0.25,
      rollMultiplier: 0.9,
      substatBudget: "8_6",
    },
    settings: {
      replaceSlots: [3],
      pool: "owned-owned",
      artifactBasis: "account",
      constellation4: 2,
      constellation5: 0,
      refinement34: 5,
      refinement5: 1,
    },
    excludedArtifactIds: [],
  };
}
async function run(input: CharacterReplacementRequest) {
  let outcome: CharacterReplacementMessage | undefined;
  await runCharacterReplacement(input, chars, weapons, (message) => {
    if (message.type !== "progress") outcome = message;
  });
  expect(outcome).toBeDefined();
  return outcome!;
}

describe("selected-team character replacement", () => {
  it.each([
    "none",
    "sameChar",
    "forceReuse",
  ] as const)("honors cross-team %s artifact reuse for a replacement character", async (reuseMode) => {
    const input = request();
    const fischl = input.accountData!.characters.find(
      (char) => char.key === "fischl"
    )!;
    const bennett = input.accountData!.characters.find(
      (char) => char.key === "bennett"
    )!;
    const saved = Object.fromEntries(
      allSlots.map((slot) => [slot, fischl.artifacts[slot] ?? null])
    ) as Record<(typeof allSlots)[number], ArtifactData | null>;
    input.inventoryReservations = {
      teams: {
        other: {
          frozenCharIds: ["fischl"],
          artifactsByChar: { fischl: saved },
        },
      },
      reuseMode,
      standaloneIds: Object.values(bennett.artifacts).map(
        (artifact) => artifact.id
      ),
    };
    const outcome = await run(input);
    if (reuseMode === "none") {
      expect(outcome).toMatchObject({ type: "error", reason: "no-results" });
      return;
    }
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    for (const result of outcome.results) {
      expect(
        Object.values(result.artifactsByChar.fischl)
          .map((artifact) => artifact!.id)
          .sort()
      ).toEqual(
        Object.values(saved)
          .map((artifact) => artifact!.id)
          .sort()
      );
      expect(
        Object.entries(result.artifactsByChar)
          .filter(([id]) => id !== "fischl")
          .flatMap(([, slots]) => Object.values(slots))
          .some((artifact) => artifact?.id.startsWith("fischl-"))
      ).toBe(false);
    }
  }, 30000);
  it("can replace every unowned member of a full preset team", async () => {
    const input = request();
    input.teamComp = teamCompInputToComp({
      id: "unowned-preset",
      characters: ["diluc", "kaeya", "amber", "lisa"],
      weapons: [
        "wolfs_gravestone",
        "harbinger_of_dawn",
        "favonius_warbow",
        "thrilling_tales_of_dragon_slayers",
      ],
    });
    const original = new TeamBuild(
      buildTeamSlotConfigs(
        input.teamComp,
        { combatOptions: {} },
        input.accountData
      )
    );
    input.objective.lines = original.configs.flatMap((config) =>
      Object.entries(original.catalog.getCombo(config.charId))
        .filter(([, count]) => count > 0)
        .map(([formulaId, count]) => ({
          charId: config.charId,
          formulaId,
          count,
        }))
    );
    input.setupConfig.damage!.combo = input.objective;
    input.settings.replaceSlots = [0, 1, 2, 3];
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    for (const result of outcome.results) {
      expect(result.configs).toHaveLength(4);
      expect(new Set(result.configs.map((config) => config.charId)).size).toBe(
        4
      );
      expect(
        result.configs.every((config) =>
          input.accountData!.characters.some(
            (char) => char.key === config.charId
          )
        )
      ).toBe(true);
      expect(new Set(result.weaponInstanceIds).size).toBe(4);
      expect(
        result.combo.lines.every(
          (line) => !["diluc", "kaeya", "amber", "lisa"].includes(line.charId)
        )
      ).toBe(true);
    }
  }, 30000);

  it("reports insufficient owned characters when all slots need replacements", async () => {
    const input = request();
    input.settings.replaceSlots = [0, 1, 2, 3];
    input.accountData!.characters = input.accountData!.characters.slice(0, 2);
    expect(await run(input)).toMatchObject({
      type: "error",
      reason: "not-enough-characters",
    });
  });
  it.each([
    { replaceSlots: [3] },
    { replaceSlots: [1, 3] },
    { replaceSlots: [1, 2, 3] },
  ])("finds complete distinct owned allocations replacing slots $replaceSlots", async ({
    replaceSlots,
  }) => {
    const input = request();
    input.settings.replaceSlots = replaceSlots;
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    for (const result of outcome.results) {
      expect(result.configs).toHaveLength(4);
      expect(new Set(result.configs.map((config) => config.charId)).size).toBe(
        4
      );
      expect(new Set(result.weaponInstanceIds).size).toBe(4);
      expect(result.weaponInstanceIds.every(Boolean)).toBe(true);
      const artifacts = Object.values(result.artifactsByChar).flatMap((slots) =>
        Object.values(slots)
      );
      expect(artifacts).toHaveLength(20);
      expect(artifacts.every(Boolean)).toBe(true);
      expect(new Set(artifacts.map((artifact) => artifact!.id)).size).toBe(20);
      expect(
        result.combo.lines.find(
          (line) => line.formulaId === input.objective.lines[0].formulaId
        )?.count
      ).toBe(37);
      const team = new TeamBuild(
        result.configs,
        input.setupConfig.combatOptions,
        input.setupConfig.damage?.enemyAura,
        [],
        undefined,
        input.calcContext
      );
      const sheets = Object.fromEntries(
        result.configs.map((config) => [
          config.charId,
          StatSheet.fromArtifacts(
            Object.values(result.artifactsByChar[config.charId]).filter(
              (artifact) => artifact !== null
            )
          ),
        ])
      );
      expect(
        team.getComboDamageResult(result.combo, sheets, input.calcContext)
          .totalDamage
      ).toBeCloseTo(result.damage, 7);
      expect(
        team.catalog.formulaIndex.has(result.combo.lines[0].formulaId)
      ).toBe(true);
    }
  }, 30000);

  it("drops removed formulas and preserves unchanged authored counts/reactions", () => {
    const input = request();
    input.settings.replaceSlots = [1];
    input.objective.lines[0] = {
      ...input.objective.lines[0],
      count: 37,
      reaction: { reaction: "vaporize", rxnParts: { 0: "none" } },
      forceOnField: true,
    };
    const configs = buildTeamSlotConfigs(
      input.teamComp,
      input.setupConfig,
      input.accountData
    );
    configs[1] = {
      ...configs[1],
      charId: "fischl",
      weaponId: "favonius_warbow",
    };
    const combo = buildReplacementCombo(input, new TeamBuild(configs));
    expect(combo.lines[0]).toEqual(input.objective.lines[0]);
    expect(combo.lines.some((line) => line.charId === "xingqiu")).toBe(false);
    expect(
      combo.lines.some((line) => line.charId === "fischl" && line.count > 0)
    ).toBe(true);
  });

  it("keeps ignored replacement slots support-only", async () => {
    const input = request();
    input.ignoredCharIds = ["bennett"];
    input.objective.lines = input.objective.lines.map((line) =>
      line.charId === "bennett" ? { ...line, count: 0 } : line
    );
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    for (const result of outcome.results) {
      expect(result.ignoredCharIds).toContain("fischl");
      expect(
        result.combo.lines.some(
          (line) => line.charId === "fischl" && line.count > 0
        )
      ).toBe(false);
    }
  }, 30000);

  it("rejects single-formula source replacement visibly", async () => {
    const input = request();
    input.setupConfig.damage!.formulaMode = "single";
    input.objective.lines = [input.objective.lines[0]];
    input.settings.replaceSlots = [0];
    expect(await run(input)).toMatchObject({
      type: "error",
      reason: "single-source",
    });
  });

  it("distinguishes missing account and fixed physical-copy shortages", async () => {
    const input = request();
    input.accountData = null;
    expect(await run(input)).toMatchObject({
      type: "error",
      reason: "no-account",
    });
    const shortage = request();
    shortage.teamComp.slots[2].weaponId = "staff_of_homa";
    expect(await run(shortage)).toMatchObject({
      type: "error",
      reason: "fixed-copy-shortage",
    });
  });

  it("keeps owned characters and generated artifacts independent", async () => {
    const input = request();
    input.settings.artifactBasis = "generated";
    input.excludedArtifactIds = input.accountData!.characters.flatMap((char) =>
      Object.values(char.artifacts).map((artifact) => artifact.id)
    );
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    expect(outcome.results[0].artifactBasis).toBe("generated");
    expect(outcome.results[0].weaponInstanceIds.every(Boolean)).toBe(true);
    expect(
      Object.values(outcome.results[0].artifactsByChar)
        .flatMap((slots) => Object.values(slots))
        .every((artifact) => artifact?.id.startsWith("gen-"))
    ).toBe(true);
  }, 30000);

  it("does not output reserved artifacts or incomplete real loadouts", async () => {
    const input = request();
    input.excludedArtifactIds = input.accountData!.characters.flatMap((char) =>
      Object.values(char.artifacts)
        .filter((artifact) => artifact.slotKey === "flower")
        .map((artifact) => artifact.id)
    );
    expect(await run(input)).toMatchObject({
      type: "error",
      reason: "no-results",
    });
  }, 30000);

  it("owned characters with any weapons can use explicit catalog refinements", async () => {
    const input = request();
    input.settings.pool = "owned-any";
    input.settings.artifactBasis = "generated";
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    const replacement = outcome.results[0].configs[3];
    expect(replacement.charId).toBe("fischl");
    expect(replacement.constellation).toBe(6);
    expect(replacement.refinement).toBe(5);
    expect(replacement.weaponId).toBe("the_stringless");
    expect(outcome.results[0].weaponInstanceIds[3]).toBeNull();
  }, 30000);

  it("all-character pool supplies assumed ranks for unowned candidates without forcing generated artifacts", async () => {
    const input = request();
    input.settings.pool = "all-any";
    const outcome = await run(input);
    expect(outcome.type).toBe("result");
    if (outcome.type !== "result") return;
    const unowned = outcome.results.find((result) =>
      result.configs.some((config) => config.charId === "xiangling")
    );
    expect(unowned).toBeDefined();
    expect(unowned!.artifactBasis).toBe("account");
    expect(
      unowned!.configs.find((config) => config.charId === "xiangling")
    ).toMatchObject({
      constellation: 2,
      charLevel: 90,
      talentLevels: { auto: 10, skill: 10, burst: 10 },
    });
  }, 30000);
});
