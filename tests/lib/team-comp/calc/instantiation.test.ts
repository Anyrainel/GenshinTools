import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/gameResources";
import {
  characterStatsResource,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import { isPctStat } from "@/data/utils";
import { isSelfReceiver } from "@/lib/dmgcalc/core/fieldState";
import {
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createWeapon,
  getOptionDef,
} from "@/lib/dmgcalc/core/registry";
import {
  CrossScalingBuff,
  ScalingBuff,
  type StatBuff,
  getBuffInstanceKey,
  validateOrigin,
  validateStatBuff,
} from "@/lib/dmgcalc/core/statBuff";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { TeamMeta } from "@/lib/dmgcalc/core/teamMeta";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/dmgcalc";

beforeAll(async () => {
  await Promise.all([
    characterStatsResource.preload(),
    weaponStatsResource.preload(),
  ]);
});

function rethrowIfUnexpected(e: unknown, ...skipPhrases: string[]): void {
  if (
    e instanceof Error &&
    skipPhrases.every((phrase) => !e.message.includes(phrase))
  ) {
    throw e;
  }
}

function findDuplicateBuffKeys(
  buffs: StatBuff[],
  providerCharId: string
): string[] {
  const seen = new Map<string, StatBuff>();
  const duplicates: string[] = [];
  for (const buff of buffs) {
    const key = getBuffInstanceKey(buff, providerCharId);
    const existing = seen.get(key);
    if (existing) {
      duplicates.push(
        `${providerCharId}: ${buff.source.id} ${buff.source.origin ?? ""} collides with ${existing.source.id} ${existing.source.origin ?? ""} (hint: use internalKey to differentiate)`
      );
      continue;
    }
    seen.set(key, buff);
  }
  return duplicates;
}

// ─── Preset team data ───

const presetPath = resolve(
  __dirname,
  "../../../../src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json"
);
const presetData = JSON.parse(readFileSync(presetPath, "utf-8")) as {
  teams: {
    characters: string[];
    weapons: string[];
    artifacts: ({ type: "4pc"; setId: string } | { type: string })[];
    opts: Record<string, string>;
  }[];
};

// [teamLabel, testLabel, charId, characters, artifactSets, opts]
type PresetCase = [
  string,
  string,
  string,
  string[],
  Record<string, string>,
  Record<string, string>,
];
const presetCases: PresetCase[] = [];
const presetCharIds = new Set<string>();

for (const team of presetData.teams) {
  const characters = team.characters.filter(Boolean);
  const artifactSets: Record<string, string> = {};
  for (let i = 0; i < characters.length; i++) {
    const art = team.artifacts[i];
    if (art && art.type === "4pc" && "setId" in art) {
      artifactSets[characters[i]] = art.setId;
    }
  }
  const teamLabel = characters.join("+");
  const baseOpts = team.opts ?? {};
  for (const charId of characters) {
    presetCharIds.add(charId);
    const entityOpt = getOptionDef(charId);
    if (entityOpt) {
      for (const choice of entityOpt.choices) {
        presetCases.push([
          teamLabel,
          `${charId} option=${choice.value}`,
          charId,
          characters,
          artifactSets,
          { ...baseOpts, [charId]: choice.value },
        ]);
      }
    } else {
      presetCases.push([
        teamLabel,
        charId,
        charId,
        characters,
        artifactSets,
        baseOpts,
      ]);
    }
  }
}

const nonPresetCharIds = Object.keys(charactersById).filter(
  (id) => !presetCharIds.has(id)
);

describe("Preset Validation", () => {
  it("every weapon should match the character's weaponType", () => {
    const charStats = characterStatsResource.peek()!;
    const weaponStats = weaponStatsResource.peek()!;
    const violations: string[] = [];

    for (const team of presetData.teams) {
      const characters = team.characters.filter(Boolean);
      const weapons = team.weapons?.filter(Boolean) ?? [];
      const teamLabel = characters.join("+");

      for (let i = 0; i < characters.length; i++) {
        const charId = characters[i];
        const weaponId = weapons[i];
        if (!weaponId) continue;

        const charType = charStats[charId]?.weaponType;
        const weapType = weaponStats[weaponId]?.type;
        if (!charType || !weapType) continue;

        if (charType !== weapType) {
          violations.push(
            `[${teamLabel}] ${charId} (${charType}) has weapon ${weaponId} (${weapType})`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("no duplicate characters in a team", () => {
    const violations: string[] = [];

    for (const team of presetData.teams) {
      const characters = team.characters.filter(Boolean);
      const seen = new Set<string>();
      for (const charId of characters) {
        if (seen.has(charId)) {
          violations.push(
            `[${characters.join("+")}] duplicate character: ${charId}`
          );
        }
        seen.add(charId);
      }
    }

    expect(violations).toEqual([]);
  });
});

describe("Entity Instantiation", () => {
  describe.each([2, 6] as const)(
    "Characters C%i (preset teams)",
    (constellation) => {
      it.each(presetCases)(
        "%s > %s",
        (_teamLabel, _testLabel, charId, characters, artifactSets, opts) => {
          try {
            const team = new TeamMeta(characters, {}, artifactSets);
            const char = createCharacter(
              charId,
              100,
              constellation,
              team,
              opts
            );
            char.buffs;
          } catch (e) {
            rethrowIfUnexpected(
              e,
              "No character registered",
              "No character stats for"
            );
          }
        }
      );
    }
  );

  describe.each([2, 6] as const)(
    "Characters C%i (no preset)",
    (constellation) => {
      it.each(nonPresetCharIds)("%s", (charId) => {
        try {
          const team = new TeamMeta([charId]);
          const char = createCharacter(charId, 100, constellation, team);
          char.buffs;
        } catch (e) {
          rethrowIfUnexpected(
            e,
            "No character registered",
            "No character stats for"
          );
        }
      });
    }
  );

  describe("Characters with options", () => {
    const cases = Object.keys(charactersById).flatMap((charId) => {
      const opt = getOptionDef(charId);
      if (!opt) return [];
      return opt.choices.map((c) => [charId, c.value] as const);
    });

    it.each(cases)("%s option=%s", (charId, optionValue) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team, {
          [charId]: optionValue,
        });
        char.buffs;
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });
  });

  describe("Formula label lengths", () => {
    it.each(Object.keys(charactersById))("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
        const violations: string[] = [];
        for (const [id, label] of Object.entries(char.formulaIds)) {
          if (label.zh.length > 12)
            violations.push(
              `${id}: zh "${label.zh}" (${label.zh.length} > 12)`
            );
          if (label.en.length > 22)
            violations.push(
              `${id}: en "${label.en}" (${label.en.length} > 22)`
            );
        }
        if (violations.length > 0)
          throw new Error(`Label too long:\n${violations.join("\n")}`);
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });
  });

  describe("Self buffs must not have maxStacks", () => {
    it.each(Object.keys(charactersById))("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
        const violations: string[] = [];
        for (const buff of char.buffs) {
          const receiver = buff.target.receiver;
          if (isSelfReceiver(receiver) && buff.source.maxStacks != null) {
            violations.push(
              `${buff.source.id} ${buff.source.origin ?? ""}: self buff with maxStacks=${buff.source.maxStacks}`
            );
          }
        }
        if (violations.length > 0)
          throw new Error(
            `Self buffs must not use maxStacks (use formula nuances instead):\n${violations.join("\n")}`
          );
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });
  });

  describe("Buff identity keys are unique per provider", () => {
    it.each(Object.keys(charactersById))("character %s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
        expect(findDuplicateBuffKeys(char.buffs, charId)).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });

    it.each(Object.keys(weaponsById))("weapon %s", (weaponId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const weapon = createWeapon(weaponId, 5, "amber", team);
        expect(findDuplicateBuffKeys(weapon.buffs, "amber")).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No weapon registered",
          "No weapon stats for",
          "No L90 weapon stats for"
        );
      }
    });

    it.each(Object.keys(artifactsById))("artifact set %s", (artifactId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const artifactSet = createArtifactSet(artifactId, "amber", team);
        expect(findDuplicateBuffKeys(artifactSet.buffs, "amber")).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact set registered");
      }
    });

    it.each(Object.keys(artifactHalfSetsById))("artifact half-set %s", (id) => {
      try {
        const team = new TeamMeta(["amber"]);
        const halfSet = createArtifactHalfSet(id, "amber", team);
        expect(findDuplicateBuffKeys(halfSet.buffs, "amber")).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact half-set registered");
      }
    });
  });

  describe("No scaling ER/CR buffs (breaks optimizer constraint model)", () => {
    // The optimizer precomputes erFloor/crFloor from getTeamStats with empty
    // sheets, then checks erFloor + artifactEr >= minEr. Static team buffs
    // are fine (captured in erFloor). But ScalingBuff/CrossScalingBuff with
    // outputKey "er" or "cr" would make the floor depend on artifact stats,
    // breaking the precomputed constraint model.
    //
    // Known exceptions (inherent to game design):
    //   traveler_electro P2: ER → ER to "team" (Abundance Amulets)
    //   rosaria P2: CR → CR to "other" (shares 15% CR, cap 15%)
    //   nahida P2: EM → CR to "self" (skill CR from EM)
    //   nilou C6: HP → CR to "self"
    //   sigewinne C6: HP → CR to "selfOnField"
    const KNOWN_SCALING_ER_CR: Record<string, Set<string>> = {
      traveler_electro: new Set(["traveler_electro P2"]),
      rosaria: new Set(["rosaria P2"]),
      nahida: new Set(["nahida P2"]),
      nilou: new Set(["nilou C6"]),
      sigewinne: new Set(["sigewinne C6"]),
    };

    it.each(Object.keys(charactersById))("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
        const known = KNOWN_SCALING_ER_CR[charId];
        const violations: string[] = [];
        for (const buff of char.buffs) {
          if ("outputKey" in buff) {
            const outputKey = (buff as Record<string, unknown>)
              .outputKey as string;
            if (outputKey === "er" || outputKey === "cr") {
              const buffLabel =
                `${buff.source.id} ${buff.source.origin ?? ""}`.trim();
              if (!known?.has(buffLabel)) {
                violations.push(
                  `${buffLabel}: scaling buff with outputKey="${outputKey}" (receiver="${buff.target.receiver}")`
                );
              }
            }
          }
        }
        if (violations.length > 0)
          throw new Error(
            `Scaling ER/CR buff violations:\n${violations.join("\n")}`
          );
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });
  });

  describe("Buff sanity: no percentage stat ≥ 1000%", () => {
    // Generous stats for dynamic buff testing — deliberately high to catch uncapped issues
    const generousStats = StatSheet.fromRaw({
      "atk%": 1.5,
      "hp%": 1.5,
      "def%": 1.5,
      em: 1200,
      cr: 0.8,
      cd: 2.0,
      er: 2.0,
    });
    const PCT_THRESHOLD = 10.0; // 1000%

    function checkBuffs(buffs: StatBuff[], selfStats: StatSheet): string[] {
      const violations: string[] = [];
      for (const buff of buffs) {
        const label = `${buff.source.id} ${buff.source.origin ?? ""}`.trim();

        for (const entry of buff.staticBuffs) {
          if (isPctStat(entry.key) && Math.abs(entry.value) >= PCT_THRESHOLD) {
            violations.push(
              `${label}: ${entry.key} = ${(entry.value * 100).toFixed(1)}%`
            );
          }
        }

        if (buff instanceof ScalingBuff) {
          if (
            buff.cap !== undefined &&
            isPctStat(buff.outputKey) &&
            Math.abs(buff.cap) >= PCT_THRESHOLD
          ) {
            violations.push(
              `${label} (cap): ${buff.outputKey} = ${(buff.cap * 100).toFixed(1)}%`
            );
          }
          for (const entry of buff.dynamicBuffs(selfStats)) {
            if (
              isPctStat(entry.key) &&
              Math.abs(entry.value) >= PCT_THRESHOLD
            ) {
              violations.push(
                `${label} (dynamic): ${entry.key} = ${(entry.value * 100).toFixed(1)}%`
              );
            }
          }
        }
      }
      return violations;
    }

    it.each(presetCases)(
      "%s > %s",
      (_teamLabel, _testLabel, charId, characters, artifactSets, opts) => {
        try {
          const team = new TeamMeta(characters, {}, artifactSets);
          const char = createCharacter(charId, 100, 6, team, opts);
          const violations = checkBuffs(char.buffs, generousStats);
          if (violations.length > 0)
            throw new Error(`Buff values ≥ 1000%:\n${violations.join("\n")}`);
        } catch (e) {
          rethrowIfUnexpected(
            e,
            "No character registered",
            "No character stats for"
          );
        }
      }
    );

    it.each(nonPresetCharIds)("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
        const violations = checkBuffs(char.buffs, generousStats);
        if (violations.length > 0)
          throw new Error(`Buff values ≥ 1000%:\n${violations.join("\n")}`);
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No character registered",
          "No character stats for"
        );
      }
    });
  });

  describe("Weapons", () => {
    it.each(Object.keys(weaponsById))("%s", (weaponId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const weapon = createWeapon(weaponId, 5, "amber", team);
        weapon.buffs;
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No weapon registered",
          "No weapon stats for",
          "No L90 weapon stats for"
        );
      }
    });

    // Known exceptions: xiphos_moonlight (EM → ER to self + other)
    const KNOWN_WEAPON_SCALING_ER_CR = new Set(["xiphos_moonlight"]);

    it.each(Object.keys(weaponsById))(
      "%s: no scaling ER/CR buffs",
      (weaponId) => {
        if (KNOWN_WEAPON_SCALING_ER_CR.has(weaponId)) return;
        try {
          const team = new TeamMeta(["amber"]);
          const weapon = createWeapon(weaponId, 5, "amber", team);
          const violations: string[] = [];
          for (const buff of weapon.buffs) {
            const label = `${buff.source.id} ${buff.source.origin ?? ""}`;
            if ("outputKey" in buff) {
              const outputKey = (buff as Record<string, unknown>)
                .outputKey as string;
              if (outputKey === "er" || outputKey === "cr") {
                violations.push(
                  `${label}: scaling buff with outputKey="${outputKey}" (receiver="${buff.target.receiver}")`
                );
              }
            }
          }
          if (violations.length > 0)
            throw new Error(
              `Scaling ER/CR buff violations:\n${violations.join("\n")}`
            );
        } catch (e) {
          rethrowIfUnexpected(
            e,
            "No weapon registered",
            "No weapon stats for",
            "No L90 weapon stats for"
          );
        }
      }
    );
  });

  describe("Artifact Sets", () => {
    it.each(Object.keys(artifactsById))("%s", (artifactId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const artifactSet = createArtifactSet(artifactId, "amber", team);
        artifactSet.buffs;
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact set registered");
      }
    });
  });

  describe("Artifact Half-Sets", () => {
    it.each(Object.keys(artifactHalfSetsById))("%s", (halfSetId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const halfSet = createArtifactHalfSet(halfSetId, "amber", team);
        halfSet.buffs;
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact half-set registered");
      }
    });
  });

  describe("No formula ID collisions across characters", () => {
    it("every character's formula IDs are globally unique", () => {
      const idOwners = new Map<string, string[]>();
      for (const charId of Object.keys(charactersById)) {
        try {
          const team = new TeamMeta([charId]);
          const char = createCharacter(charId, 100, 6, team);
          for (const fid of Object.keys(char.allFormulaEntries)) {
            const owners = idOwners.get(fid);
            if (owners) owners.push(charId);
            else idOwners.set(fid, [charId]);
          }
        } catch (e) {
          rethrowIfUnexpected(
            e,
            "No character registered",
            "No character stats for"
          );
        }
      }
      const collisions: string[] = [];
      for (const [fid, owners] of idOwners) {
        if (owners.length > 1) {
          collisions.push(`"${fid}" owned by: ${owners.join(", ")}`);
        }
      }
      expect(collisions).toEqual([]);
    });
  });

  describe("Buff static validation", () => {
    function validateAllBuffs(buffs: StatBuff[]): string[] {
      const errors: string[] = [];
      for (const buff of buffs) {
        try {
          validateOrigin(buff.source);
          validateStatBuff(buff.staticBuffs, buff.target, buff.source);
        } catch (e) {
          if (e instanceof Error) errors.push(e.message);
        }
        // ScalingBuff / CrossScalingBuff: also validate the dynamic outputKey
        if (buff instanceof ScalingBuff || buff instanceof CrossScalingBuff) {
          try {
            validateStatBuff(
              [{ key: buff.outputKey, value: 0 }],
              buff.target,
              buff.source
            );
          } catch (e) {
            if (e instanceof Error) errors.push(e.message);
          }
        }
      }
      return errors;
    }

    describe.each([2, 6] as const)("Characters C%i", (constellation) => {
      it.each(Object.keys(charactersById))("%s", (charId) => {
        try {
          const team = new TeamMeta([charId]);
          const char = createCharacter(charId, 100, constellation, team);
          expect(validateAllBuffs(char.buffs)).toEqual([]);
        } catch (e) {
          rethrowIfUnexpected(
            e,
            "No character registered",
            "No character stats for"
          );
        }
      });
    });

    it.each(Object.keys(weaponsById))("weapon %s", (weaponId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const weapon = createWeapon(weaponId, 5, "amber", team);
        expect(validateAllBuffs(weapon.buffs)).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(
          e,
          "No weapon registered",
          "No weapon stats for",
          "No L90 weapon stats for"
        );
      }
    });

    it.each(Object.keys(artifactsById))("artifact set %s", (artifactId) => {
      try {
        const team = new TeamMeta(["amber"]);
        const artifactSet = createArtifactSet(artifactId, "amber", team);
        expect(validateAllBuffs(artifactSet.buffs)).toEqual([]);
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact set registered");
      }
    });
  });
});
