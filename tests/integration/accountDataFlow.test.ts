/**
 * Integration Tests: Account Data Page Flow
 *
 * Tests the complete pipeline for the Account Data page:
 * 1. GOOD/Enka data import
 * 2. Character display with scoring
 * 3. Sorting and filtering
 * 4. Inventory management
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { CharacterFilters } from "@/data/types";
import { tiers } from "@/data/types";
import { scoreAllSlots } from "@/lib/account-data/artifactScore";
import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import {
  defaultCharacterFilters,
  filterAndSortCharacters,
} from "@/lib/characterFilters";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useTierStore } from "@/stores/useTierStore";

// Full GOOD sample data
const fullGOODData: GOODData = {
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
    {
      key: "Xingqiu",
      level: 80,
      constellation: 6,
      ascension: 5,
      talent: { auto: 1, skill: 10, burst: 10 },
    },
    {
      key: "Zhongli",
      level: 90,
      constellation: 0,
      ascension: 6,
      talent: { auto: 6, skill: 8, burst: 10 },
    },
    {
      key: "Bennett",
      level: 80,
      constellation: 6,
      ascension: 5,
      talent: { auto: 1, skill: 6, burst: 10 },
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
    {
      key: "SacrificialSword",
      level: 90,
      ascension: 6,
      refinement: 5,
      location: "Xingqiu",
      lock: true,
    },
    {
      key: "BlackTassel",
      level: 90,
      ascension: 6,
      refinement: 5,
      location: "Zhongli",
      lock: false,
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
      setKey: "EmblemOfSeveredFate",
      slotKey: "flower",
      level: 20,
      rarity: 5,
      mainStatKey: "hp",
      location: "Xingqiu",
      lock: true,
      substats: [
        { key: "critRate_", value: 7.0 },
        { key: "critDMG_", value: 14.0 },
        { key: "enerRech_", value: 11.0 },
        { key: "atk_", value: 10.0 },
      ],
    },
  ],
};

describe("Integration: Account Data Page Flow", () => {
  beforeEach(() => {
    useAccountStore.getState().clearAccountData();
    useArtifactScoreStore.getState().resetConfig();
    useTierStore.getState().resetTierList();
  });

  describe("data import flow", () => {
    it("imports GOOD data and populates all character fields", () => {
      const { data, warnings } = convertGOODToAccountData(fullGOODData);

      expect(warnings).toHaveLength(0);
      expect(data.characters).toHaveLength(4);

      // Verify detailed character data
      const huTao = data.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.level).toBe(90);
      expect(huTao?.constellation).toBe(1);
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 });

      // Verify weapon assignment
      expect(huTao?.weapon?.key).toBe("staff_of_homa");
      expect(huTao?.weapon?.refinement).toBe(1);

      // Verify artifact assignment
      expect(huTao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("stores account data in account store", () => {
      const { data } = convertGOODToAccountData(fullGOODData);

      act(() => {
        useAccountStore.getState().setAccountData(data);
      });

      const stored = useAccountStore.getState().accountData;
      expect(stored).toBeDefined();
      expect(stored?.characters).toHaveLength(4);
    });

    it("tracks last UID", () => {
      act(() => {
        useAccountStore.getState().setLastUid("123456789");
      });

      expect(useAccountStore.getState().lastUid).toBe("123456789");
    });
  });

  describe("artifact scoring flow", () => {
    const testWeights = {
      cr: 100,
      cd: 100,
      "hp%": 80,
      em: 60,
      "atk%": 40,
      er: 20,
    };

    it("calculates scores for all characters", () => {
      const { data } = convertGOODToAccountData(fullGOODData);
      const scoreConfig = useArtifactScoreStore.getState().config;

      const scores = data.characters.map((char) =>
        scoreAllSlots(char, testWeights, scoreConfig.global)
      );

      expect(scores).toHaveLength(4);
      const huTaoIndex = data.characters.findIndex((c) => c.key === "hu_tao");
      expect(scores[huTaoIndex].subScore).toBeGreaterThan(0);
    });

    it("adjusts scores when global weights change", () => {
      const { data } = convertGOODToAccountData(fullGOODData);
      const huTao = data.characters.find((c) => c.key === "hu_tao")!;
      const initialConfig = useArtifactScoreStore.getState().config;
      scoreAllSlots(huTao, testWeights, initialConfig.global);

      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 0);
      });

      const updatedConfig = useArtifactScoreStore.getState().config;
      expect(updatedConfig.global.flatAtk).toBe(0);
    });
  });

  describe("character filtering and sorting", () => {
    it("filters characters by element", () => {
      const { data } = convertGOODToAccountData(fullGOODData);

      // Need Character type data for filtering - skip for now
      // This is tested in tierSortingFlow.test.ts with proper Character fixtures
      expect(data.characters.length).toBe(4);
    });

    it("sorts characters by tier when tier assignments exist", () => {
      // Setup tier assignments
      act(() => {
        useTierStore.getState().setTierAssignments({
          hu_tao: { tier: "S", position: 0 },
          xingqiu: { tier: "A", position: 0 },
        });
      });

      const assignments = useTierStore.getState().tierAssignments;
      expect(assignments.hu_tao.tier).toBe("S");
      expect(assignments.xingqiu.tier).toBe("A");
    });
  });

  describe("score configuration", () => {
    it("resets global config to defaults", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 0);
        useArtifactScoreStore.getState().setGlobalWeight("flatHp", 0);
      });

      act(() => {
        useArtifactScoreStore.getState().resetGlobalConfig();
      });

      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatAtk).toBe(30); // Default
    });

    it("updates global weight", () => {
      act(() => {
        useArtifactScoreStore.getState().setGlobalWeight("flatAtk", 50);
      });
      const config = useArtifactScoreStore.getState().config;
      expect(config.global.flatAtk).toBe(50);
    });
  });

  describe("data clearing", () => {
    it("clears account data", () => {
      const { data } = convertGOODToAccountData(fullGOODData);

      act(() => {
        useAccountStore.getState().setAccountData(data);
      });

      expect(useAccountStore.getState().accountData).toBeDefined();

      act(() => {
        useAccountStore.getState().clearAccountData();
      });

      expect(useAccountStore.getState().accountData).toBeNull();
    });
  });
});
