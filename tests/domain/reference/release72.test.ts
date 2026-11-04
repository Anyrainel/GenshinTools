import { afterEach, expect, it, vi } from "vitest";
import { i18nGameData } from "@/generated/translations/i18n-game";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("exposes the released 7.2 characters and catalyst with beta disabled", async () => {
  vi.stubEnv("__BETA_ENABLED_OVERRIDE__", "false");
  vi.resetModules();
  const { betaEnabled } = await import("@/config/beta");
  const catalog = await import("@/domain/reference/catalog");
  expect(betaEnabled()).toBe(false);
  for (const id of ["mitya", "valeriy"] as const) {
    expect(catalog.allCharacters.some((character) => character.id === id)).toBe(
      true
    );
    expect(catalog.betaCharacterIds.has(id)).toBe(false);
    expect(i18nGameData.characters[id].en).toBeTruthy();
    expect(i18nGameData.characters[id].zh).toBeTruthy();
  }
  expect(
    catalog.allWeapons.some((weapon) => weapon.id === "starsealed_edict")
  ).toBe(true);
  expect(catalog.betaWeaponIds.has("starsealed_edict")).toBe(false);
  expect(i18nGameData.weapons.starsealed_edict.en).toBe("Starsealed Edict");
  expect(i18nGameData.weapons.starsealed_edict.zh).toBeTruthy();
});
