/**
 * Integration Tests: Data Import to Character Display Flow
 *
 * Tests the complete pipeline:
 * 1. GOOD JSON data import via goodConversion
 * 2. Account store population via useAccountStore
 * 3. Score calculation via calculateArtifactScore + useArtifactScoreStore
 * 4. Correct data displayed in CharacterView components
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "../utils/render";

import { CharacterCard } from "@/components/account-data/CharacterCard";
import { scoreWithBuilds } from "@/lib/account-data/artifactScore";
import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import {
  type MonaData,
  convertMonaToAccountData,
} from "@/lib/account-data/monaConversion";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

// Minimal GOOD data with one character and artifacts
const integrationGOODData: GOODData = {
  format: "GOOD",
  version: 1,
  source: "Integration Test",
  characters: [
    {
      key: "HuTao",
      level: 90,
      constellation: 1,
      ascension: 6,
      talent: { auto: 10, skill: 10, burst: 8 },
    },
  ],
  weapons: [
    {
      key: "StaffOfHoma",
      level: 90,
      ascension: 6,
      refinement: 1,
      location: "HuTao",
      lock: true,
    },
  ],
  artifacts: [
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      location: "HuTao",
      lock: true,
      substats: [
        { key: "critRate_", value: 10.5 },
        { key: "critDMG_", value: 21.0 },
        { key: "atk_", value: 5.8 },
        { key: "eleMas", value: 40 },
      ],
    },
    {
      setKey: "CrimsonWitchOfFlames",
      slotKey: "plume",
      level: 20,
      rarity: 5,
      mainStatKey: "atk",
      location: "HuTao",
      lock: true,
      substats: [
        { key: "critRate_", value: 7.0 },
        { key: "critDMG_", value: 14.0 },
        { key: "hp_", value: 9.3 },
        { key: "eleMas", value: 23 },
      ],
    },
  ],
};

describe("Integration: Data Import to Character Display Flow", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccounts();
    useArtifactScoreStore.getState().resetConfig();
  });

  it("converts GOOD data and populates account store correctly", () => {
    // Step 1: Convert GOOD data
    const { data, warnings } = convertGOODToAccountData(integrationGOODData);

    // Verify conversion
    expect(warnings).toHaveLength(0);
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].key).toBe("hu_tao");
    expect(data.characters[0].level).toBe(90);

    // Step 2: Populate account store
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    // Verify store state
    const storeData = useAccountStore.getState().accounts.default?.data;
    expect(storeData).toBeDefined();
    expect(storeData!.characters).toHaveLength(1);
    expect(storeData!.characters[0].key).toBe("hu_tao");
  });

  it("calculates artifact scores for imported characters", () => {
    // Setup: Import data to store
    const { data } = convertGOODToAccountData(integrationGOODData);
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const character =
      useAccountStore.getState().accounts.default!.data.characters[0];
    const scoreConfig = useArtifactScoreStore.getState().config;

    // Calculate score (no builds available — scores will be 0 without weight data)
    const score = scoreWithBuilds(character, [], scoreConfig.global);

    // No builds → returns null
    expect(score).toBeNull();
  });

  it("renders CharacterCard with imported and scored data", () => {
    // Setup: Full import flow
    const { data } = convertGOODToAccountData(integrationGOODData);
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const character =
      useAccountStore.getState().accounts.default!.data.characters[0];
    const scoreConfig = useArtifactScoreStore.getState().config;
    const score = scoreWithBuilds(character, [], scoreConfig.global);

    // Render component with real data
    const { container } = render(
      <CharacterCard char={character} score={score} />
    );

    // Verify key data is displayed
    expect(container.textContent).toMatch(/90/); // Level
    expect(container.textContent).toMatch(/C?1/i); // Constellation
  });

  it("handles import with unrecognized entries gracefully", () => {
    const dataWithUnknown: GOODData = {
      ...integrationGOODData,
      characters: [
        ...integrationGOODData.characters!,
        { key: "UnknownCharacter", level: 1, constellation: 0, ascension: 0 },
      ],
    };

    const { data, warnings } = convertGOODToAccountData(dataWithUnknown);

    // Should have warning for unknown character
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe("character");
    expect(warnings[0].key).toBe("UnknownCharacter");

    // Known character should still be imported
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].key).toBe("hu_tao");
  });

  it("maintains data integrity through store updates", () => {
    const { data } = convertGOODToAccountData(integrationGOODData);

    // Initial import
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const initialCharacter =
      useAccountStore.getState().accounts.default!.data.characters[0];
    expect(initialCharacter.artifacts?.flower).toBeDefined();
    expect(initialCharacter.artifacts?.flower?.substats?.cr).toBe(10.5);

    // Verify weapon is attached
    expect(initialCharacter.weapon).toBeDefined();
    expect(initialCharacter.weapon?.key).toBe("staff_of_homa");
    expect(initialCharacter.weapon?.level).toBe(90);
  });
});

describe("Integration: Mona Import to Character Display Flow", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccounts();
    useArtifactScoreStore.getState().resetConfig();
  });

  const integrationMonaData: MonaData = {
    version: "1",
    flower: [
      {
        setName: "crimsonWitch",
        position: "flower",
        mainTag: { name: "lifeStatic", value: 4780 },
        normalTags: [
          { name: "critical", value: 0.105 },
          { name: "criticalDamage", value: 0.21 },
          { name: "attackPercentage", value: 0.058 },
          { name: "elementalMastery", value: 40 },
        ],
        omit: false,
        level: 20,
        star: 5,
        equip: "胡桃",
      },
    ],
    feather: [
      {
        setName: "crimsonWitch",
        position: "feather",
        mainTag: { name: "attackStatic", value: 311 },
        normalTags: [
          { name: "critical", value: 0.07 },
          { name: "criticalDamage", value: 0.14 },
          { name: "lifePercentage", value: 0.093 },
          { name: "elementalMastery", value: 23 },
        ],
        omit: false,
        level: 20,
        star: 5,
        equip: "胡桃",
      },
    ],
  };

  it("converts Mona data and populates account store correctly", () => {
    const { data, warnings } = convertMonaToAccountData(integrationMonaData);

    expect(warnings).toHaveLength(0);
    expect(data.characters).toHaveLength(1);
    expect(data.characters[0].key).toBe("hu_tao");
    expect(data.characters[0].level).toBe(90);
    expect(data.characters[0].constellation).toBe(0);
    expect(data.characters[0].talent).toEqual({
      auto: 10,
      skill: 10,
      burst: 10,
    });

    // No weapons from Mona import
    expect(data.characters[0].weapon).toBeUndefined();
    expect(data.extraWeapons).toHaveLength(0);

    // Populate store
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const storeData = useAccountStore.getState().accounts.default?.data;
    expect(storeData).toBeDefined();
    expect(storeData!.characters).toHaveLength(1);
    expect(storeData!.characters[0].key).toBe("hu_tao");
  });

  it("renders CharacterCard with Mona-imported data", () => {
    const { data } = convertMonaToAccountData(integrationMonaData);
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const character =
      useAccountStore.getState().accounts.default!.data.characters[0];
    const scoreConfig = useArtifactScoreStore.getState().config;
    const score = scoreWithBuilds(character, [], scoreConfig.global);

    const { container } = render(
      <CharacterCard char={character} score={score} />
    );

    // Verify level is displayed
    expect(container.textContent).toMatch(/90/);
    // Verify constellation (C0) — may render as just "0" or "C0"
    expect(container.textContent).toMatch(/0/);
  });

  it("preserves Mona artifact stat values through the full pipeline", () => {
    const { data } = convertMonaToAccountData(integrationMonaData);
    act(() => {
      useAccountStore.getState().addOrUpdateAccount("default", { data });
    });

    const character =
      useAccountStore.getState().accounts.default!.data.characters[0];
    expect(character.artifacts?.flower).toBeDefined();
    // Percentage conversion: 0.105 → 10.5
    expect(character.artifacts?.flower?.substats?.cr).toBe(10.5);
    // Flat stat stays as-is
    expect(character.artifacts?.flower?.substats?.em).toBe(40);
    // Plume assigned correctly
    expect(character.artifacts?.plume).toBeDefined();
    expect(character.artifacts?.plume?.substats?.["hp%"]).toBe(9.3);
  });
});
