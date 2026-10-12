import { describe, expect, it } from "vitest";
import { collectOwnedWeaponChoices } from "@/domain/combat/analyzer/weaponChoiceCandidates";
import type { AccountData, WeaponData } from "@/domain/models";

function weapon(id: string, refinement: number): WeaponData {
  return { id, key: "staff_of_homa", refinement, level: 90, lock: false };
}

describe("owned weapon comparison candidates", () => {
  it("includes equipped and inventory copies, preserves R2/R3/R4 and deduplicates matching ranks", () => {
    const account: AccountData = {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: {},
          weapon: weapon("equipped", 2),
        },
      ],
      extraArtifacts: [],
      extraWeapons: [weapon("duplicate", 2), weapon("r3", 3), weapon("r4", 4)],
    };
    const choices = collectOwnedWeaponChoices(account);
    expect(choices).toHaveLength(3);
    expect(choices).toEqual(
      expect.arrayContaining([
        { weaponId: "staff_of_homa", refinement: 2 },
        { weaponId: "staff_of_homa", refinement: 3 },
        { weaponId: "staff_of_homa", refinement: 4 },
      ])
    );
  });

  it("does not invent another rank when inventory repeats an equipped physical ID", () => {
    const account: AccountData = {
      characters: [
        {
          key: "hu_tao",
          level: 90,
          constellation: 0,
          talent: { auto: 10, skill: 10, burst: 10 },
          artifacts: {},
          weapon: weapon("same-copy", 2),
        },
      ],
      extraArtifacts: [],
      extraWeapons: [weapon("same-copy", 5), weapon("real-second-copy", 3)],
    };
    expect(collectOwnedWeaponChoices(account)).toEqual(
      expect.arrayContaining([
        { weaponId: "staff_of_homa", refinement: 2 },
        { weaponId: "staff_of_homa", refinement: 3 },
      ])
    );
    expect(collectOwnedWeaponChoices(account)).not.toContainEqual({
      weaponId: "staff_of_homa",
      refinement: 5,
    });
  });
});
