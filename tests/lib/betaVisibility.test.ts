/**
 * Guards that verify beta (unreleased) game data does not leak into the
 * default user-facing surfaces. The test environment runs with
 * ``betaEnabled() === false`` (hard-disabled in useBetaStore.ts under MODE=test),
 * which mirrors the experience of a non-DEV visitor who has not opted into
 * beta via localStorage. These tests would fail if any loader or entity map
 * stopped gating its beta data on ``betaEnabled()``.
 */

import { artifactsById, charactersById, weaponsById } from "@/data/constants";
import { loadCharacterKits } from "@/data/gameDataLoader";
import { getCharacterStats, getWeaponStats } from "@/data/gameStatsLoader";
import { i18nBetaData } from "@/data/i18n-beta";
import { i18nGameData } from "@/data/i18n-game";
import {
  artifacts as releasedArtifacts,
  characters as releasedCharacters,
  weapons as releasedWeapons,
} from "@/data/resources";
import {
  betaArtifacts,
  betaCharacters,
  betaWeapons,
} from "@/data/resources_beta";
import { betaEnabled } from "@/data/useBetaStore";
import { describe, expect, it } from "vitest";

const releasedCharIds = new Set(releasedCharacters.map((c) => c.id));
const releasedWeaponIds = new Set(releasedWeapons.map((w) => w.id));
const releasedArtifactIds = new Set(releasedArtifacts.map((a) => a.id));

// IDs that exist only in beta (not yet promoted to the released bundle).
// If these are empty, every assertion below is trivially true — that's fine,
// it just means there are no beta entities to check at the moment.
const betaOnlyCharIds = betaCharacters
  .map((c) => c.id)
  .filter((id) => !releasedCharIds.has(id));
const betaOnlyWeaponIds = betaWeapons
  .map((w) => w.id)
  .filter((id) => !releasedWeaponIds.has(id));
const betaOnlyArtifactIds = betaArtifacts
  .map((a) => a.id)
  .filter((id) => !releasedArtifactIds.has(id));

describe("betaEnabled flag", () => {
  it("is hard-disabled under MODE=test", () => {
    // useBetaStore.ts short-circuits to false when import.meta.env.MODE === 'test'
    // so the suite mirrors the public production default.
    expect(betaEnabled()).toBe(false);
  });
});

describe("beta visibility — entity maps (constants.ts)", () => {
  it("charactersById omits beta-only character ids", () => {
    for (const id of betaOnlyCharIds) {
      expect(charactersById[id]).toBeUndefined();
    }
  });

  it("weaponsById omits beta-only weapon ids", () => {
    for (const id of betaOnlyWeaponIds) {
      expect(weaponsById[id]).toBeUndefined();
    }
  });

  it("artifactsById omits beta-only artifact ids", () => {
    for (const id of betaOnlyArtifactIds) {
      expect(artifactsById[id]).toBeUndefined();
    }
  });
});

describe("beta visibility — async game stats loaders", () => {
  it("getCharacterStats() omits beta-only character ids", async () => {
    const stats = await getCharacterStats();
    for (const id of betaOnlyCharIds) {
      expect(stats[id]).toBeUndefined();
    }
  });

  it("getWeaponStats() omits beta-only weapon ids", async () => {
    const stats = await getWeaponStats();
    for (const id of betaOnlyWeaponIds) {
      expect(stats[id]).toBeUndefined();
    }
  });
});

describe("beta visibility — i18n name maps", () => {
  // i18n-game.ts ships unconditionally; i18n-beta.ts is only consumed when
  // beta is enabled. Names for beta-only entities must live exclusively in
  // i18n-beta to avoid leaking into the public bundle.
  it("i18nGameData.characters omits beta-only character ids", () => {
    for (const id of betaOnlyCharIds) {
      expect(
        (i18nGameData.characters as Record<string, unknown>)[id]
      ).toBeUndefined();
    }
  });

  it("i18nGameData.weapons omits beta-only weapon ids", () => {
    for (const id of betaOnlyWeaponIds) {
      expect(
        (i18nGameData.weapons as Record<string, unknown>)[id]
      ).toBeUndefined();
    }
  });

  it("i18nGameData.artifacts omits beta-only artifact ids", () => {
    for (const id of betaOnlyArtifactIds) {
      expect(
        (i18nGameData.artifacts as Record<string, unknown>)[id]
      ).toBeUndefined();
    }
  });

  it("i18nBetaData has entries only for beta-only ids (no overlap)", () => {
    // Sanity-check the inverse: anything in i18n-beta should be a beta-only id,
    // otherwise we're carrying duplicate translations.
    for (const id of Object.keys(i18nBetaData.characters)) {
      expect(releasedCharIds.has(id)).toBe(false);
    }
    for (const id of Object.keys(i18nBetaData.weapons)) {
      expect(releasedWeaponIds.has(id)).toBe(false);
    }
  });
});

describe("beta visibility — character kit loader", () => {
  it("loadCharacterKits('en') omits beta-only character ids", async () => {
    const kits = await loadCharacterKits("en");
    for (const id of betaOnlyCharIds) {
      expect(kits[id]).toBeUndefined();
    }
  });

  it("loadCharacterKits('zh') omits beta-only character ids", async () => {
    const kits = await loadCharacterKits("zh");
    for (const id of betaOnlyCharIds) {
      expect(kits[id]).toBeUndefined();
    }
  });
});
