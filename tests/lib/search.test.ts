import type { CharacterEffect, CharacterSkill } from "@/data/types";
import { characterMatchesSearch, fuzzyMatch } from "@/lib/search";

describe("fuzzyMatch", () => {
  it("matches exact substring", () => {
    expect(fuzzyMatch("hello", "hello world")).toBe(true);
  });

  it("matches characters in order with gaps", () => {
    expect(fuzzyMatch("hlo", "hello")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(fuzzyMatch("ABC", "xaybzc")).toBe(true);
  });

  it("rejects out-of-order characters", () => {
    expect(fuzzyMatch("ba", "abc")).toBe(false);
  });

  it("rejects when query characters are missing", () => {
    expect(fuzzyMatch("xyz", "abc")).toBe(false);
  });

  it("matches empty query to any target", () => {
    expect(fuzzyMatch("", "anything")).toBe(true);
  });

  it("rejects non-empty query against empty target", () => {
    expect(fuzzyMatch("a", "")).toBe(false);
  });

  it("matches Chinese characters as substring", () => {
    expect(fuzzyMatch("攻击", "普通攻击伤害提升")).toBe(true);
  });

  it("matches Chinese characters with gaps", () => {
    expect(fuzzyMatch("攻伤", "攻击伤害提升")).toBe(true);
  });
});

describe("characterMatchesSearch", () => {
  const makeEffect = (name: string, descHtml = ""): CharacterEffect => ({
    name,
    descHtml,
  });

  const makeSkill = (
    name: string,
    descHtml = "",
    details: CharacterSkill["details"] = []
  ): CharacterSkill => ({
    name,
    descHtml,
    details,
  });

  it("matches by character name", () => {
    expect(
      characterMatchesSearch("hu_tao", "tao", "Hu Tao", null, null, null, null)
    ).toBe(true);
  });

  it("matches by character id", () => {
    expect(
      characterMatchesSearch("hu_tao", "hu_tao", "胡桃", null, null, null, null)
    ).toBe(true);
  });

  it("matches by skill name", () => {
    const skills = [makeSkill("Guide to Afterlife")];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "Afterlife",
        "Hu Tao",
        skills,
        null,
        null,
        null
      )
    ).toBe(true);
  });

  it("matches by skill description text", () => {
    const skills = [
      makeSkill("E. Secret Spear", "<b>ATK</b> increased based on HP"),
    ];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "increased",
        "Hu Tao",
        skills,
        null,
        null,
        null
      )
    ).toBe(true);
  });

  it("strips HTML tags before matching description", () => {
    const skills = [makeSkill("E. Test", '<span class="fire">Pyro DMG</span>')];
    // Should match "Pyro DMG" but not "span" or "class"
    expect(
      characterMatchesSearch(
        "test",
        "Pyro DMG",
        "Test",
        skills,
        null,
        null,
        null
      )
    ).toBe(true);
  });

  it("matches by passive description", () => {
    const passives = [
      makeEffect("Flutter By", "When Hu Tao cooks a dish perfectly"),
    ];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "cooks",
        "Hu Tao",
        null,
        passives,
        null,
        null
      )
    ).toBe(true);
  });

  it("matches by constellation description", () => {
    const constellations = [
      makeEffect("C1", "Charged Attack does not consume stamina"),
    ];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "stamina",
        "Hu Tao",
        null,
        null,
        constellations,
        null
      )
    ).toBe(true);
  });

  it("matches by dictionary entry", () => {
    const dictionary = [
      makeEffect("Blood Blossom", "Enemies affected by Blood Blossom"),
    ];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "Blood",
        "Hu Tao",
        null,
        null,
        null,
        dictionary
      )
    ).toBe(true);
  });

  it("returns false when nothing matches", () => {
    const skills = [makeSkill("Guide to Afterlife")];
    const passives = [makeEffect("Flutter By")];
    expect(
      characterMatchesSearch(
        "hu_tao",
        "zzzzz",
        "Hu Tao",
        skills,
        passives,
        null,
        null
      )
    ).toBe(false);
  });

  it("handles null kit data gracefully", () => {
    expect(
      characterMatchesSearch(
        "hu_tao",
        "zzzzz",
        "Hu Tao",
        null,
        null,
        null,
        null
      )
    ).toBe(false);
  });
});
