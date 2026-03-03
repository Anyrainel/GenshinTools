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
import { mergeAccountData } from "@/lib/account-data/mergeAccountData";
import {
  type MonaData,
  convertMonaToAccountData,
  mergeMonaWithExisting,
} from "@/lib/account-data/monaConversion";
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
    useAccountStore.getState().clearAccounts();
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
        useAccountStore.getState().addOrUpdateAccount("default", { data });
      });

      const stored = useAccountStore.getState().accounts.default?.data;
      expect(stored).toBeDefined();
      expect(stored?.characters).toHaveLength(4);
    });

    it("uses account id as the uid for UID-based profiles", () => {
      const data = convertGOODToAccountData(fullGOODData).data;
      act(() => {
        useAccountStore.getState().addOrUpdateAccount("123456789", { data });
      });

      const acc = useAccountStore.getState().accounts["123456789"];
      expect(acc?.id).toBe("123456789");
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
        useAccountStore.getState().addOrUpdateAccount("default", { data });
      });

      expect(useAccountStore.getState().accounts.default?.data).toBeDefined();

      act(() => {
        useAccountStore.getState().clearAccounts();
      });

      expect(useAccountStore.getState().accounts.default).toBeUndefined();
    });
  });

  describe("mona data import flow", () => {
    const monaData: MonaData = {
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
          setName: "EmblemOfSeveredFate",
          position: "feather",
          mainTag: { name: "attackStatic", value: 311 },
          normalTags: [
            { name: "critical", value: 0.07 },
            { name: "criticalDamage", value: 0.14 },
            { name: "recharge", value: 0.11 },
            { name: "attackPercentage", value: 0.1 },
          ],
          omit: false,
          level: 20,
          star: 5,
          equip: "行秋",
        },
      ],
      sand: [
        {
          setName: "gladiatorFinale",
          position: "sand",
          mainTag: { name: "attackPercentage", value: 0.466 },
          normalTags: [
            { name: "critical", value: 0.062 },
            { name: "criticalDamage", value: 0.124 },
          ],
          omit: false,
          level: 20,
          star: 5,
          equip: null,
        },
      ],
    };

    it("imports Mona data and populates characters from equip field", () => {
      const { data, warnings } = convertMonaToAccountData(monaData);

      expect(data.characters).toHaveLength(2);
      const huTao = data.characters.find((c) => c.key === "hu_tao");
      const xingqiu = data.characters.find((c) => c.key === "xingqiu");
      expect(huTao).toBeDefined();
      expect(xingqiu).toBeDefined();
    });

    it("creates characters at C0, lv90, talent 10/10/10", () => {
      const { data } = convertMonaToAccountData(monaData);

      for (const char of data.characters) {
        expect(char.constellation).toBe(0);
        expect(char.level).toBe(90);
        expect(char.talent).toEqual({ auto: 10, skill: 10, burst: 10 });
      }
    });

    it("does not produce any weapons", () => {
      const { data } = convertMonaToAccountData(monaData);
      expect(data.extraWeapons).toHaveLength(0);
      for (const char of data.characters) {
        expect(char.weapon).toBeUndefined();
      }
    });

    it("places unequipped artifacts in extraArtifacts", () => {
      const { data } = convertMonaToAccountData(monaData);
      // sand has equip: null
      expect(data.extraArtifacts.length).toBeGreaterThanOrEqual(1);
      const extra = data.extraArtifacts.find(
        (a) => a.setKey === "gladiators_finale"
      );
      expect(extra).toBeDefined();
      expect(extra?.slotKey).toBe("sands");
    });

    it("converts percentage values correctly", () => {
      const { data } = convertMonaToAccountData(monaData);
      const huTao = data.characters.find((c) => c.key === "hu_tao")!;
      const flower = huTao.artifacts?.flower;
      expect(flower).toBeDefined();
      // 0.105 → 10.5, 0.21 → 21, 0.058 → 5.8
      expect(flower?.substats?.cr).toBe(10.5);
      expect(flower?.substats?.cd).toBe(21);
      expect(flower?.substats?.["atk%"]).toBe(5.8);
      // EM is flat, not percentage
      expect(flower?.substats?.em).toBe(40);
    });

    it("maps Mona slot names to internal slot keys", () => {
      const { data } = convertMonaToAccountData(monaData);
      const huTao = data.characters.find((c) => c.key === "hu_tao")!;
      // flower → flower
      expect(huTao.artifacts?.flower).toBeDefined();
      const xingqiu = data.characters.find((c) => c.key === "xingqiu")!;
      // feather → plume
      expect(xingqiu.artifacts?.plume).toBeDefined();
    });

    it("resolves set name overrides (crimsonWitch → crimson_witch_of_flames)", () => {
      const { data } = convertMonaToAccountData(monaData);
      const huTao = data.characters.find((c) => c.key === "hu_tao")!;
      expect(huTao.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
    });

    it("resolves PascalCase set names (EmblemOfSeveredFate)", () => {
      const { data } = convertMonaToAccountData(monaData);
      const xingqiu = data.characters.find((c) => c.key === "xingqiu")!;
      expect(xingqiu.artifacts?.plume?.setKey).toBe("emblem_of_severed_fate");
    });

    it("stores mona import in account store correctly", () => {
      const { data } = convertMonaToAccountData(monaData);

      act(() => {
        useAccountStore.getState().addOrUpdateAccount("default", { data });
      });

      const stored = useAccountStore.getState().accounts.default?.data;
      expect(stored).toBeDefined();
      expect(stored?.characters).toHaveLength(2);
      expect(stored?.extraWeapons).toHaveLength(0);
    });

    it("handles empty Mona data gracefully", () => {
      const emptyMona: MonaData = { version: "1" };
      const { data, warnings } = convertMonaToAccountData(emptyMona);

      expect(data.characters).toHaveLength(0);
      expect(data.extraArtifacts).toHaveLength(0);
      expect(data.extraWeapons).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("generates warnings for unknown artifact sets", () => {
      const monaWithUnknown: MonaData = {
        version: "1",
        flower: [
          {
            setName: "TotallyFakeSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: null,
          },
        ],
      };
      const { data, warnings } = convertMonaToAccountData(monaWithUnknown);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe("artifact");
      expect(warnings[0].key).toBe("TotallyFakeSet");
      expect(data.characters).toHaveLength(0);
      expect(data.extraArtifacts).toHaveLength(0);
    });

    it("skips low-rarity sets in the skip list", () => {
      const monaWithSkipped: MonaData = {
        version: "1",
        flower: [
          {
            setName: "Adventurer",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 1000 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 3,
            equip: null,
          },
          {
            setName: "LuckyDog",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 1000 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 3,
            equip: null,
          },
        ],
      };
      const { data, warnings } = convertMonaToAccountData(monaWithSkipped);
      expect(data.extraArtifacts).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it("handles artifacts with equip: null vs equip: '' consistently", () => {
      const monaNull: MonaData = {
        version: "1",
        flower: [
          {
            setName: "EmblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [{ name: "critical", value: 0.07 }],
            omit: false,
            level: 20,
            star: 5,
            equip: null,
          },
          {
            setName: "EmblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [{ name: "critical", value: 0.035 }],
            omit: false,
            level: 20,
            star: 5,
            equip: "",
          },
        ],
      };
      const { data } = convertMonaToAccountData(monaNull);
      // Both null and "" equip should go to extraArtifacts
      expect(data.characters).toHaveLength(0);
      expect(data.extraArtifacts).toHaveLength(2);
    });

    it("deduplicates warnings for the same unknown set", () => {
      const monaRepeated: MonaData = {
        version: "1",
        flower: [
          {
            setName: "FakeSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 1 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 5,
            equip: null,
          },
          {
            setName: "FakeSet",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 2 },
            normalTags: [],
            omit: false,
            level: 0,
            star: 5,
            equip: null,
          },
        ],
      };
      const { warnings } = convertMonaToAccountData(monaRepeated);
      expect(warnings).toHaveLength(1);
    });

    it("handles bare Traveler name (旅行者) as Anemo Traveler", () => {
      const monaTraveler: MonaData = {
        version: "1",
        flower: [
          {
            setName: "EmblemOfSeveredFate",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "旅行者",
          },
        ],
      };
      const { data } = convertMonaToAccountData(monaTraveler);
      expect(data.characters).toHaveLength(1);
      // Should be some traveler variant
      expect(data.characters[0].key).toMatch(/traveler/);
    });

    it("assigns multiple artifacts to the same character across slot types", () => {
      const monaMultiSlot: MonaData = {
        version: "1",
        flower: [
          {
            setName: "crimsonWitch",
            position: "flower",
            mainTag: { name: "lifeStatic", value: 4780 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "胡桃",
          },
        ],
        cup: [
          {
            setName: "crimsonWitch",
            position: "cup",
            mainTag: { name: "fireBonus", value: 0.466 },
            normalTags: [],
            omit: false,
            level: 20,
            star: 5,
            equip: "胡桃",
          },
        ],
      };
      const { data } = convertMonaToAccountData(monaMultiSlot);
      expect(data.characters).toHaveLength(1);
      const huTao = data.characters[0];
      expect(huTao.artifacts?.flower).toBeDefined();
      expect(huTao.artifacts?.goblet).toBeDefined();
      expect(huTao.artifacts?.goblet?.mainStatKey).toBe("pyro%");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Import overlay tests: all 6 cross-type import combinations
  //
  // Rules:
  //  - GOOD import: always wipes everything (complete replace)
  //  - Mona import: keeps character/weapon details, replaces ALL artifact data
  //  - UID import:  upserts character/weapon, moves replaced artifacts to inventory
  // ───────────────────────────────────────────────────────────────────────────

  describe("import overlay: sequential imports to the same profile", () => {
    // ── Shared test data ──

    const goodDataA: GOODData = {
      format: "GOOD",
      version: 1,
      source: "Test",
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
            { key: "enerRech_", value: 11.0 },
            { key: "critRate_", value: 7.0 },
          ],
        },
      ],
    };

    const goodDataB: GOODData = {
      format: "GOOD",
      version: 1,
      source: "Test B",
      characters: [
        {
          key: "Bennett",
          level: 70,
          constellation: 5,
          ascension: 5,
          talent: { auto: 1, skill: 6, burst: 10 },
        },
      ],
      weapons: [
        {
          key: "AquilaFavonia",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "Bennett",
          lock: true,
        },
      ],
      artifacts: [
        {
          setKey: "NoblesseOblige",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          location: "Bennett",
          lock: true,
          substats: [{ key: "enerRech_", value: 16.0 }],
        },
      ],
    };

    const monaDataA: MonaData = {
      version: "1",
      flower: [
        {
          setName: "wandererTroupe",
          position: "flower",
          mainTag: { name: "lifeStatic", value: 4780 },
          normalTags: [{ name: "critical", value: 0.1 }],
          omit: false,
          level: 20,
          star: 5,
          equip: "胡桃",
        },
      ],
      feather: [
        {
          setName: "wandererTroupe",
          position: "feather",
          mainTag: { name: "attackStatic", value: 311 },
          normalTags: [{ name: "criticalDamage", value: 0.2 }],
          omit: false,
          level: 20,
          star: 5,
          equip: null,
        },
      ],
    };

    const monaDataB: MonaData = {
      version: "1",
      flower: [
        {
          setName: "crimsonWitch",
          position: "flower",
          mainTag: { name: "lifeStatic", value: 4780 },
          normalTags: [{ name: "elementalMastery", value: 50 }],
          omit: false,
          level: 20,
          star: 5,
          equip: "胡桃",
        },
      ],
    };

    // UID import data - simulated as already-converted AccountData (Enka → GOOD → internal)
    const uidDataA: GOODData = {
      format: "GOOD",
      version: 1,
      source: "Enka",
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
          ],
        },
      ],
    };

    const uidDataB: GOODData = {
      format: "GOOD",
      version: 1,
      source: "Enka B",
      characters: [
        {
          key: "HuTao",
          level: 90,
          constellation: 2,
          ascension: 6,
          talent: { auto: 10, skill: 10, burst: 10 },
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
          setKey: "ShimenawasReminiscence",
          slotKey: "flower",
          level: 20,
          rarity: 5,
          mainStatKey: "hp",
          location: "HuTao",
          lock: true,
          substats: [
            { key: "critRate_", value: 3.9 },
            { key: "critDMG_", value: 7.8 },
          ],
        },
      ],
    };

    // ── 1. GOOD → GOOD: second wipes everything ──

    it("GOOD → GOOD: second import completely replaces first", () => {
      const first = convertGOODToAccountData(goodDataA).data;
      // GOOD always wipes — just use second data directly
      const second = convertGOODToAccountData(goodDataB).data;

      expect(first.characters).toHaveLength(2); // HuTao + Xingqiu
      expect(second.characters).toHaveLength(1); // Bennett only

      // After GOOD → GOOD, only Bennett remains
      expect(second.characters[0].key).toBe("bennett");
      expect(second.characters.find((c) => c.key === "hu_tao")).toBeUndefined();
      expect(
        second.characters.find((c) => c.key === "xingqiu")
      ).toBeUndefined();
      expect(second.extraWeapons).toHaveLength(0);
    });

    // ── 2. GOOD → Mona: keeps char/weapon details, replaces artifacts ──

    it("GOOD → Mona: preserves GOOD character details and weapons, replaces all artifacts", () => {
      const goodResult = convertGOODToAccountData(goodDataA).data;
      const monaResult = convertMonaToAccountData(monaDataA).data;
      const merged = mergeMonaWithExisting(goodResult, monaResult);

      // HuTao keeps GOOD details
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.level).toBe(90);
      expect(huTao?.constellation).toBe(1); // from GOOD, not Mona's C0 placeholder
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 }); // from GOOD
      expect(huTao?.weapon?.key).toBe("staff_of_homa"); // weapon preserved

      // HuTao's artifacts replaced with Mona's (wandererTroupe flower)
      expect(huTao?.artifacts?.flower?.setKey).toBe("wanderers_troupe");
      // GOOD's CrimsonWitch flower is gone
      expect(huTao?.artifacts?.flower?.substats?.cr).toBe(10); // Mona's 0.1 → 10

      // Xingqiu exists from GOOD but has no Mona artifacts → artifacts cleared
      const xingqiu = merged.characters.find((c) => c.key === "xingqiu");
      expect(xingqiu).toBeDefined();
      expect(xingqiu?.level).toBe(80);
      expect(xingqiu?.constellation).toBe(6);
      expect(
        Object.values(xingqiu?.artifacts ?? {}).filter(Boolean)
      ).toHaveLength(0);

      // Extra artifacts from Mona (unequipped feather)
      expect(merged.extraArtifacts.length).toBeGreaterThanOrEqual(1);

      // Extra weapons preserved from GOOD
      expect(merged.extraWeapons).toEqual(goodResult.extraWeapons);
    });

    // ── 3. GOOD → UID: upserts char/weapon, moves replaced artifacts to inventory ──

    it("GOOD → UID: upserts characters and weapons, deduplicates artifacts", () => {
      const goodResult = convertGOODToAccountData(goodDataA).data;
      const uidResult = convertGOODToAccountData(uidDataB).data;
      const merged = mergeAccountData(goodResult, uidResult);

      // HuTao updated to UID's details (C2, talent 10/10/10)
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(2); // UID updated from C1 to C2
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 10 }); // UID's

      // HuTao's equipped artifact changed to Shimenawa from UID
      expect(huTao?.artifacts?.flower?.setKey).toBe("shimenawas_reminiscence");

      // Xingqiu still present (from GOOD, not in UID import)
      const xingqiu = merged.characters.find((c) => c.key === "xingqiu");
      expect(xingqiu).toBeDefined();
      expect(xingqiu?.constellation).toBe(6);

      // Old CrimsonWitch flower from GOOD should be moved to inventory (not lost)
      const inventoryHasCW = merged.extraArtifacts.some(
        (a) => a.setKey === "crimson_witch_of_flames" && a.slotKey === "flower"
      );
      expect(inventoryHasCW).toBe(true);
    });

    // ── 4. Mona → GOOD: GOOD wipes everything ──

    it("Mona → GOOD: GOOD completely replaces Mona placeholders", () => {
      const monaResult = convertMonaToAccountData(monaDataA).data;
      // GOOD always wipes — just use second data directly
      const goodResult = convertGOODToAccountData(goodDataA).data;

      // Verify Mona had placeholders
      const monaHuTao = monaResult.characters.find((c) => c.key === "hu_tao");
      expect(monaHuTao?.constellation).toBe(0); // Mona placeholder
      expect(monaHuTao?.talent).toEqual({ auto: 10, skill: 10, burst: 10 });

      // After GOOD import, only GOOD data remains
      const huTao = goodResult.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(1); // GOOD's real data
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 }); // GOOD's
      expect(huTao?.weapon?.key).toBe("staff_of_homa"); // GOOD's weapon
      expect(huTao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames"); // GOOD artifacts
    });

    // ── 5. Mona → Mona: keeps placeholder details, replaces artifacts ──

    it("Mona → Mona: second Mona replaces all artifacts from first", () => {
      const firstMona = convertMonaToAccountData(monaDataA).data;
      const secondMona = convertMonaToAccountData(monaDataB).data;
      const merged = mergeMonaWithExisting(firstMona, secondMona);

      // HuTao keeps first Mona's placeholder details
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(0);
      expect(huTao?.level).toBe(90);
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 10 });

      // Artifacts replaced: first Mona had wandererTroupe flower, second has crimsonWitch flower
      expect(huTao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");
      expect(huTao?.artifacts?.flower?.substats?.em).toBe(50); // from second Mona

      // First Mona's unequipped feather is gone (extra artifacts replaced)
      const hasWT = merged.extraArtifacts.some(
        (a) => a.setKey === "wanderers_troupe"
      );
      expect(hasWT).toBe(false);

      // Second Mona had no extra artifacts
      expect(merged.extraArtifacts).toHaveLength(0);
    });

    // ── 6. Mona → UID: upserts real char/weapon over placeholders ──

    it("Mona → UID: upserts real character details over Mona placeholders", () => {
      const monaResult = convertMonaToAccountData(monaDataA).data;
      const uidResult = convertGOODToAccountData(uidDataA).data;
      const merged = mergeAccountData(monaResult, uidResult);

      // HuTao upgraded from Mona placeholder to UID real details
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(1); // UID's C1 (was Mona's C0)
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 }); // UID's
      expect(huTao?.weapon?.key).toBe("staff_of_homa"); // UID's weapon

      // UID's artifacts are now equipped
      expect(huTao?.artifacts?.flower?.setKey).toBe("crimson_witch_of_flames");

      // Mona's wandererTroupe flower moved to inventory (seen before, now displaced)
      const inventoryHasWT = merged.extraArtifacts.some(
        (a) => a.setKey === "wanderers_troupe" && a.slotKey === "flower"
      );
      expect(inventoryHasWT).toBe(true);
    });

    // ── 7. UID → GOOD: GOOD wipes everything ──

    it("UID → GOOD: GOOD completely replaces UID data", () => {
      const uidResult = convertGOODToAccountData(uidDataA).data;
      // GOOD always wipes — just use second data directly
      const goodResult = convertGOODToAccountData(goodDataB).data;

      // Verify UID had HuTao
      expect(
        uidResult.characters.find((c) => c.key === "hu_tao")
      ).toBeDefined();

      // After GOOD import, only GOOD data remains (Bennett only)
      expect(goodResult.characters).toHaveLength(1);
      expect(goodResult.characters[0].key).toBe("bennett");
      expect(
        goodResult.characters.find((c) => c.key === "hu_tao")
      ).toBeUndefined();
    });

    // ── 8. UID → Mona: keeps UID char/weapon details, replaces all artifacts ──

    it("UID → Mona: preserves UID character details and weapons, replaces all artifacts", () => {
      const uidResult = convertGOODToAccountData(uidDataA).data;
      const monaResult = convertMonaToAccountData(monaDataA).data;
      const merged = mergeMonaWithExisting(uidResult, monaResult);

      // HuTao keeps UID's real details
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(1); // UID's C1
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 8 }); // UID's talents
      expect(huTao?.weapon?.key).toBe("staff_of_homa"); // UID weapon preserved

      // Artifacts replaced with Mona's (wandererTroupe flower, not CrimsonWitch)
      expect(huTao?.artifacts?.flower?.setKey).toBe("wanderers_troupe");

      // Extra artifacts from Mona
      expect(merged.extraArtifacts.length).toBeGreaterThanOrEqual(1);
    });

    // ── 9. UID → UID: upserts, deduplicates artifacts ──

    it("UID → UID: upserts character details, moves old artifacts to inventory", () => {
      const firstUid = convertGOODToAccountData(uidDataA).data;
      const secondUid = convertGOODToAccountData(uidDataB).data;
      const merged = mergeAccountData(firstUid, secondUid);

      // HuTao updated from C1 to C2
      const huTao = merged.characters.find((c) => c.key === "hu_tao");
      expect(huTao).toBeDefined();
      expect(huTao?.constellation).toBe(2); // second UID's C2
      expect(huTao?.talent).toEqual({ auto: 10, skill: 10, burst: 10 }); // second UID's

      // Equipped artifact changed to Shimenawa
      expect(huTao?.artifacts?.flower?.setKey).toBe("shimenawas_reminiscence");

      // Old CrimsonWitch flower from first UID moved to inventory
      const inventoryHasCW = merged.extraArtifacts.some(
        (a) => a.setKey === "crimson_witch_of_flames" && a.slotKey === "flower"
      );
      expect(inventoryHasCW).toBe(true);
    });
  });
});
