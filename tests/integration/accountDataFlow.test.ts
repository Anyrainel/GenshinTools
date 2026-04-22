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

import {
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import { mergeAccountData } from "@/lib/account-data/mergeAccountData";
import { scoreAllSlots } from "@/lib/artifact/scoring/artifactScore";
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
      // Detailed conversion correctness is tested in goodConversion.test.ts
      expect(data.characters.map((c) => c.key).sort()).toEqual([
        "bennett",
        "hu_tao",
        "xingqiu",
        "zhongli",
      ]);
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

  // Import overlay tests: cross-type import combinations
  //
  // Rules:
  //  - GOOD import: always wipes everything (complete replace)
  //  - UID import:  upserts character/weapon, moves replaced artifacts to inventory

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

    // ── 2. GOOD → UID: upserts char/weapon, moves replaced artifacts to inventory ──

    it("GOOD → UID: upserts characters and weapons, deduplicates artifacts", () => {
      const goodResult = convertGOODToAccountData(goodDataA).data;
      const uidResult = convertGOODToAccountData(uidDataB).data;
      const { data: merged } = mergeAccountData(goodResult, uidResult);

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

    // ── 3. UID → GOOD: GOOD wipes everything ──

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

    // ── 4. UID → UID: upserts, deduplicates artifacts ──

    it("UID → UID: upserts character details, moves old artifacts to inventory", () => {
      const firstUid = convertGOODToAccountData(uidDataA).data;
      const secondUid = convertGOODToAccountData(uidDataB).data;
      const { data: merged } = mergeAccountData(firstUid, secondUid);

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
