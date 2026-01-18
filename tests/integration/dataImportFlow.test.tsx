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
import { calculateArtifactScore } from "@/lib/artifactScore";
import { type GOODData, convertGOODToAccountData } from "@/lib/goodConversion";
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
      constellation: 1,
      level: 90,
      talent: { auto: 10, skill: 10, burst: 8 },
    },
  ],
  weapons: [
    {
      key: "StaffOfHoma",
      level: 90,
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
    useAccountStore.getState().clearAccountData();
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
      useAccountStore.getState().setAccountData(data);
    });

    // Verify store state
    const storeData = useAccountStore.getState().accountData;
    expect(storeData).toBeDefined();
    expect(storeData!.characters).toHaveLength(1);
    expect(storeData!.characters[0].key).toBe("hu_tao");
  });

  it("calculates artifact scores for imported characters", () => {
    // Setup: Import data to store
    const { data } = convertGOODToAccountData(integrationGOODData);
    act(() => {
      useAccountStore.getState().setAccountData(data);
    });

    const character = useAccountStore.getState().accountData!.characters[0];
    const scoreConfig = useArtifactScoreStore.getState().config;

    // Calculate score
    const score = calculateArtifactScore(character, scoreConfig);

    // Verify score calculation
    expect(score).toBeDefined();
    expect(score.isComplete).toBe(false); // Only 2 of 5 artifacts
    expect(score.subScore).toBeGreaterThan(0); // Has substats
    expect(score.slotSubScores.flower).toBeGreaterThan(0);
    expect(score.slotSubScores.plume).toBeGreaterThan(0);
  });

  it("renders CharacterCard with imported and scored data", () => {
    // Setup: Full import flow
    const { data } = convertGOODToAccountData(integrationGOODData);
    act(() => {
      useAccountStore.getState().setAccountData(data);
    });

    const character = useAccountStore.getState().accountData!.characters[0];
    const scoreConfig = useArtifactScoreStore.getState().config;
    const score = calculateArtifactScore(character, scoreConfig);

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
        { key: "UnknownCharacter", constellation: 0 },
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
      useAccountStore.getState().setAccountData(data);
    });

    const initialCharacter =
      useAccountStore.getState().accountData!.characters[0];
    expect(initialCharacter.artifacts?.flower).toBeDefined();
    expect(initialCharacter.artifacts?.flower?.substats?.cr).toBe(10.5);

    // Verify weapon is attached
    expect(initialCharacter.weapon).toBeDefined();
    expect(initialCharacter.weapon?.key).toBe("staff_of_homa");
    expect(initialCharacter.weapon?.level).toBe(90);
  });
});
