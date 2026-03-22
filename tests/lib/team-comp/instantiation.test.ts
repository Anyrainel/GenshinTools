import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import {
  getCharacterStatsSync,
  getWeaponStatsSync,
  preloadGameStats,
} from "@/lib/gameStatsLoader";
import {
  TeamMeta,
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createWeapon,
  getEntityOption,
} from "@/lib/team-comp/damageModels";
import { isSelfReceiver } from "@/lib/team-comp/types";
import { beforeAll, describe, expect, it } from "vitest";
import "@/lib/team-comp/index";

beforeAll(async () => {
  await preloadGameStats();
});

function rethrowIfUnexpected(e: unknown, ...skipPhrases: string[]): void {
  if (
    e instanceof Error &&
    skipPhrases.every((phrase) => !e.message.includes(phrase))
  ) {
    throw e;
  }
}

// ─── Preset team data ───

const presetPath = resolve(
  __dirname,
  "../../../src/presets/team-comp/[GGArtifact] 战舰队伍 Flagship Teams.json"
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
    const entityOpt = getEntityOption(charId);
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

// ─── Tests ───

describe("Preset Validation", () => {
  it("every weapon should match the character's weaponType", () => {
    const charStats = getCharacterStatsSync()!;
    const weaponStats = getWeaponStatsSync()!;
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
  describe("Characters (preset teams)", () => {
    it.each(presetCases)(
      "%s > %s",
      (_teamLabel, _testLabel, charId, characters, artifactSets, opts) => {
        try {
          const team = new TeamMeta(characters, {}, artifactSets);
          const char = createCharacter(charId, 100, 6, team, opts);
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
  });

  describe("Characters (no preset)", () => {
    it.each(nonPresetCharIds)("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 100, 6, team);
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

  describe("Characters with options", () => {
    const cases = Object.keys(charactersById).flatMap((charId) => {
      const opt = getEntityOption(charId);
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
          if (label.en.length > 36)
            violations.push(
              `${id}: en "${label.en}" (${label.en.length} > 36)`
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
});
