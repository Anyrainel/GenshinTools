import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  weaponsById,
} from "@/data/constants";
import { preloadGameStats } from "@/data/gameStatsLoader";
import { assertNoDuplicateStatKeys } from "@/lib/team-comp/damageBuffs";
import {
  StatSheet,
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

// Sentinel StatSheet used to invoke dynamic buffs.
// Values are all zero — we only care about key validity, not values.
const emptySheet = new StatSheet([]);

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
        const buffs = char.buffs;
        emptySheet.apply(buffs);
        for (const b of buffs) {
          const dynEntries = b.dynamicBuffs(emptySheet, []);
          assertNoDuplicateStatKeys(
            dynEntries,
            `dynamicBuffs for character ${charId} (source: ${b.source.type}:${b.source.id})`
          );
        }
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
        const buffs = weapon.buffs;
        emptySheet.apply(buffs);
        for (const b of buffs) {
          const dynEntries = b.dynamicBuffs(emptySheet, []);
          assertNoDuplicateStatKeys(
            dynEntries,
            `dynamicBuffs for weapon ${weaponId} (source: ${b.source.type}:${b.source.id})`
          );
        }
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
        const buffs = artifactSet.buffs;
        emptySheet.apply(buffs);
        for (const b of buffs) {
          const dynEntries = b.dynamicBuffs(emptySheet, []);
          assertNoDuplicateStatKeys(
            dynEntries,
            `dynamicBuffs for artifact set ${artifactId} (source: ${b.source.type}:${b.source.id})`
          );
        }
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
        const buffs = halfSet.buffs;
        emptySheet.apply(buffs);
        for (const b of buffs) {
          const dynEntries = b.dynamicBuffs(emptySheet, []);
          assertNoDuplicateStatKeys(
            dynEntries,
            `dynamicBuffs for artifact half-set ${halfSetId} (source: ${b.source.type}:${b.source.id})`
          );
        }
      } catch (e) {
        rethrowIfUnexpected(e, "No artifact half-set registered");
      }
    });
  });
});
