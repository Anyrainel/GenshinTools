import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import { preloadGameStats } from "@/lib/gameStatsLoader";
import {
  TeamMeta,
  createArtifactHalfSet,
  createArtifactSet,
  createCharacter,
  createWeapon,
} from "@/lib/team-comp/damageModels";
import { beforeAll, describe, it } from "vitest";
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

describe("Entity Instantiation", () => {
  describe("Characters", () => {
    it.each(Object.keys(charactersById))("%s", (charId) => {
      try {
        const team = new TeamMeta([charId]);
        const char = createCharacter(charId, 90, 6, team);
        char.buffs; // triggers StatBuff constructors → validation
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
        const char = createCharacter(charId, 90, 6, team);
        const violations: string[] = [];
        for (const [id, label] of Object.entries(char.formulaIds)) {
          if (label.zh.length > 10)
            violations.push(
              `${id}: zh "${label.zh}" (${label.zh.length} > 10)`
            );
          if (label.en.length > 32)
            violations.push(
              `${id}: en "${label.en}" (${label.en.length} > 32)`
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
