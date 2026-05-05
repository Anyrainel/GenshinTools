import { describe, expect, it } from "vitest";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import { mergeRecentArtifactsIntoAccount } from "@/lib/account-data/import/mergeAccountData";

function makeArtifact(overrides: Partial<ArtifactData> = {}): ArtifactData {
  return {
    id: "artifact-0",
    setKey: "gladiators_finale",
    slotKey: "flower",
    level: 20,
    rarity: 5,
    mainStatKey: "hp",
    lock: false,
    substats: {
      cr: 3.9,
      cd: 7.8,
    },
    ...overrides,
  };
}

function makeCharacter(
  key: string,
  artifacts: CharacterData["artifacts"] = {}
): CharacterData {
  return {
    key,
    level: 90,
    constellation: 0,
    talent: { auto: 1, skill: 1, burst: 1 },
    artifacts,
  };
}

function makeAccount(overrides: Partial<AccountData> = {}): AccountData {
  return {
    characters: [],
    extraArtifacts: [],
    extraWeapons: [],
    ...overrides,
  };
}

describe("mergeRecentArtifactsIntoAccount", () => {
  it("adds new recent artifacts without removing existing artifacts", () => {
    const existingArtifact = makeArtifact({ id: "artifact-0" });
    const recentArtifact = makeArtifact({
      id: "artifact-0",
      setKey: "emblem_of_severed_fate",
      slotKey: "plume",
      mainStatKey: "atk",
    });
    const existing = makeAccount({ extraArtifacts: [existingArtifact] });
    const incoming = makeAccount({ extraArtifacts: [recentArtifact] });

    const { data: result } = mergeRecentArtifactsIntoAccount(
      existing,
      incoming
    );

    expect(result.extraArtifacts).toHaveLength(2);
    expect(result.extraArtifacts[0]).toBe(existingArtifact);
    expect(result.extraArtifacts[1]).toMatchObject({
      id: "artifact-1",
      setKey: "emblem_of_severed_fate",
      slotKey: "plume",
    });
  });

  it("updates matching artifacts by fingerprint without duplicating them", () => {
    const existingArtifact = makeArtifact({
      id: "artifact-4",
      lock: false,
      astralMark: false,
    });
    const recentArtifact = makeArtifact({
      id: "artifact-0",
      lock: true,
      astralMark: true,
    });
    const existing = makeAccount({ extraArtifacts: [existingArtifact] });
    const incoming = makeAccount({ extraArtifacts: [recentArtifact] });

    const { data: result } = mergeRecentArtifactsIntoAccount(
      existing,
      incoming
    );

    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0]).toMatchObject({
      id: "artifact-4",
      lock: true,
      astralMark: true,
    });
  });

  it("keeps a matching equipped artifact equipped when recent data has no location", () => {
    const existingArtifact = makeArtifact({
      id: "artifact-2",
      lock: false,
    });
    const recentArtifact = makeArtifact({
      id: "artifact-0",
      lock: true,
    });
    const existing = makeAccount({
      characters: [makeCharacter("hu_tao", { flower: existingArtifact })],
    });
    const incoming = makeAccount({ extraArtifacts: [recentArtifact] });

    const { data: result } = mergeRecentArtifactsIntoAccount(
      existing,
      incoming
    );

    expect(result.characters[0].artifacts.flower).toMatchObject({
      id: "artifact-2",
      lock: true,
    });
    expect(result.extraArtifacts).toHaveLength(0);
  });

  it("places new located artifacts and preserves displaced artifacts", () => {
    const oldEquipped = makeArtifact({
      id: "artifact-0",
      setKey: "gladiators_finale",
    });
    const recentEquipped = makeArtifact({
      id: "artifact-0",
      setKey: "emblem_of_severed_fate",
      substats: { er: 11, cd: 7.8 },
    });
    const existing = makeAccount({
      characters: [makeCharacter("hu_tao", { flower: oldEquipped })],
    });
    const incoming = makeAccount({
      characters: [makeCharacter("hu_tao", { flower: recentEquipped })],
    });

    const { data: result } = mergeRecentArtifactsIntoAccount(
      existing,
      incoming
    );

    expect(result.characters[0].artifacts.flower).toMatchObject({
      id: "artifact-1",
      setKey: "emblem_of_severed_fate",
    });
    expect(result.extraArtifacts).toHaveLength(1);
    expect(result.extraArtifacts[0]).toBe(oldEquipped);
  });
});
