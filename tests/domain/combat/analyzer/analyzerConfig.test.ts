import { describe, expect, it } from "vitest";
import {
  fullToStored,
  reconcileConfigs,
} from "@/domain/combat/analyzer/analyzerConfig";
import type { StoredAnalyzerCharConfig } from "@/domain/combat/analyzer/types";
import type { TeamSlotConfig } from "@/domain/combat/damage/types";

const roster = (weaponId: string): TeamSlotConfig => ({
  charId: "hu_tao",
  charLevel: 90,
  constellation: 2,
  weaponId,
  refinement: 3,
  artifactSet: null,
});
const stored = (
  altWeapon: StoredAnalyzerCharConfig["altWeapon"]
): StoredAnalyzerCharConfig[] => [
  {
    charId: "hu_tao",
    altWeapon,
    maxConstellation: 6,
    maxRefinement: 5,
  },
];

describe("investment alternate reconciliation after shared roster edits", () => {
  it("treats a roster gift sword as a zero-pull R5 weapon, including saved configs", () => {
    const base = {
      ...roster("exaiphanes_blade"),
      charId: "traveler_cryo",
      refinement: 1,
    };
    for (const configs of [
      [],
      [
        {
          charId: base.charId,
          altWeapon: { id: "mistsplitter_reforged" },
          maxConstellation: 6,
          maxRefinement: 5,
        },
      ],
    ]) {
      const [config] = reconcileConfigs(configs, [base]);
      expect(config.weapon4Star).toEqual({
        id: "exaiphanes_blade",
        refinement: 5,
      });
      expect(config.startRefinement).toBe(0);
      expect(config.weapon5Star).toEqual(
        configs.length ? { id: "mistsplitter_reforged" } : undefined
      );
    }
  });
  it("keeps a saved gift-sword alternate in the zero-pull group through roundtrip", () => {
    const base = {
      ...roster("mistsplitter_reforged"),
      charId: "traveler_cryo",
    };
    const [config] = reconcileConfigs(
      [
        {
          charId: base.charId,
          altWeapon: { id: "exaiphanes_blade", refinement: 1 },
          maxConstellation: 6,
          maxRefinement: 5,
        },
      ],
      [base]
    );
    expect(config.weapon4Star).toEqual({
      id: "exaiphanes_blade",
      refinement: 5,
    });
    expect(reconcileConfigs([fullToStored(config, base)], [base])[0]).toEqual(
      config
    );
  });
  it("uses free Traveler C6 for fresh and saved investment configs", () => {
    const base = {
      ...roster("favonius_sword"),
      charId: "traveler_anemo",
      constellation: 3,
    };
    expect(reconcileConfigs([], [base])[0].startConstellation).toBe(6);
    expect(reconcileConfigs([], [base])[0].maxConstellation).toBe(6);
    expect(
      reconcileConfigs(
        [{ charId: base.charId, maxConstellation: 6, maxRefinement: 5 }],
        [base]
      )[0].maxConstellation
    ).toBe(6);
  });
  it("does not reinterpret a saved four-star alternate as a five-star target", () => {
    const [config] = reconcileConfigs(
      stored({ id: "dragons_bane", refinement: 4 }),
      [roster("favonius_lance")]
    );
    expect(config.weapon4Star).toEqual({ id: "favonius_lance", refinement: 3 });
    expect(config.weapon5Star).toBeUndefined();
    expect(config.startRefinement).toBe(0);
    expect(config.maxRefinement).toBe(0);
    expect(config.startConstellation).toBe(2);
  });
  it("does not reinterpret a saved five-star alternate as a four-star fallback", () => {
    const [config] = reconcileConfigs(stored({ id: "staff_of_homa" }), [
      roster("engulfing_lightning"),
    ]);
    expect(config.weapon5Star).toEqual({ id: "engulfing_lightning" });
    expect(config.weapon4Star).toBeUndefined();
    expect(config.startRefinement).toBe(3);
  });
  it("retains valid opposite-rarity targets and imported fallback refinement", () => {
    expect(
      reconcileConfigs(stored({ id: "dragons_bane", refinement: 4 }), [
        roster("staff_of_homa"),
      ])[0].weapon4Star
    ).toEqual({ id: "dragons_bane", refinement: 4 });
    expect(
      reconcileConfigs(stored({ id: "staff_of_homa" }), [
        roster("dragons_bane"),
      ])[0].weapon5Star
    ).toEqual({ id: "staff_of_homa" });
  });
});
