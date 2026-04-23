import { describe, expect, it } from "vitest";

import type { Slot } from "@/data/enums";
import type { TierAssignment } from "@/data/types";
import { getHigherTierEquippedArtifactIds } from "@/lib/team-comp/teamConfigUtils";
import {
  createAccountData,
  createArtifactData,
  createCharacterData,
} from "../../fixtures";

describe("getHigherTierEquippedArtifactIds", () => {
  const charWithArts = (
    key: string,
    artIds: { id: string; slotKey: Slot }[]
  ) => {
    const artifacts: Partial<
      Record<Slot, ReturnType<typeof createArtifactData>>
    > = {};
    for (const a of artIds) {
      artifacts[a.slotKey] = createArtifactData({
        id: a.id,
        slotKey: a.slotKey,
      });
    }
    return createCharacterData({
      key,
      artifacts: artifacts as Record<
        Slot,
        ReturnType<typeof createArtifactData>
      >,
    });
  };

  it("returns empty set when character has no tier assignment (treated as Pool)", () => {
    const tierAssignments: TierAssignment = {
      xingqiu: { tier: "A", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", []),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
      ],
    });

    // hu_tao has no tier assignment → Pool (lowest), so A-tier xingqiu is higher
    const result = getHigherTierEquippedArtifactIds(
      "hu_tao",
      tierAssignments,
      account
    );
    expect(result).toEqual(new Set(["xq-flower"]));
  });

  it("returns empty set when character is in the highest tier (S)", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "A", position: 0 },
      zhongli: { tier: "B", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [{ id: "ht-flower", slotKey: "flower" }]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
        charWithArts("zhongli", [{ id: "zl-flower", slotKey: "flower" }]),
      ],
    });

    const result = getHigherTierEquippedArtifactIds(
      "hu_tao",
      tierAssignments,
      account
    );
    expect(result.size).toBe(0);
  });

  it("returns artifact IDs from characters in higher tiers", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "A", position: 0 },
      zhongli: { tier: "C", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [
          { id: "ht-flower", slotKey: "flower" },
          { id: "ht-plume", slotKey: "plume" },
        ]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
        charWithArts("zhongli", [{ id: "zl-flower", slotKey: "flower" }]),
      ],
    });

    // zhongli is C-tier, so S-tier hu_tao and A-tier xingqiu are higher
    const result = getHigherTierEquippedArtifactIds(
      "zhongli",
      tierAssignments,
      account
    );
    expect(result).toEqual(new Set(["ht-flower", "ht-plume", "xq-flower"]));
  });

  it("does not include artifacts from characters in same or lower tiers", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "A", position: 0 },
      xingqiu: { tier: "A", position: 1 },
      zhongli: { tier: "B", position: 0 },
      bennett: { tier: "C", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [{ id: "ht-flower", slotKey: "flower" }]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
        charWithArts("zhongli", [{ id: "zl-flower", slotKey: "flower" }]),
        charWithArts("bennett", [{ id: "bn-flower", slotKey: "flower" }]),
      ],
    });

    // hu_tao is A-tier; same tier (xingqiu) and lower (zhongli B, bennett C) excluded
    const result = getHigherTierEquippedArtifactIds(
      "hu_tao",
      tierAssignments,
      account
    );
    expect(result.size).toBe(0);
    expect(result.has("xq-flower")).toBe(false);
    expect(result.has("zl-flower")).toBe(false);
    expect(result.has("bn-flower")).toBe(false);
  });

  it("skips the character itself", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "S", position: 1 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [{ id: "ht-flower", slotKey: "flower" }]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
      ],
    });

    // Both S-tier, but xingqiu should not see its own artifacts
    // and hu_tao (same tier) is not higher, so result is empty
    const result = getHigherTierEquippedArtifactIds(
      "xingqiu",
      tierAssignments,
      account
    );
    expect(result.size).toBe(0);
    expect(result.has("xq-flower")).toBe(false);
  });

  it("handles characters with no artifacts gracefully", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "B", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", []), // S-tier but no artifacts
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
      ],
    });

    // xingqiu is B-tier, hu_tao is S-tier (higher) but has no artifacts
    const result = getHigherTierEquippedArtifactIds(
      "xingqiu",
      tierAssignments,
      account
    );
    expect(result.size).toBe(0);
  });

  it("handles missing tier assignments (defaults to Pool)", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      // xingqiu and zhongli have no tier assignment → Pool
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [{ id: "ht-flower", slotKey: "flower" }]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
        charWithArts("zhongli", [{ id: "zl-flower", slotKey: "flower" }]),
      ],
    });

    // xingqiu defaults to Pool; hu_tao (S) is higher, zhongli (Pool) is same tier
    const result = getHigherTierEquippedArtifactIds(
      "xingqiu",
      tierAssignments,
      account
    );
    expect(result).toEqual(new Set(["ht-flower"]));
    expect(result.has("zl-flower")).toBe(false);
  });

  it("collects artifacts across multiple slots from higher-tier characters", () => {
    const tierAssignments: TierAssignment = {
      hu_tao: { tier: "S", position: 0 },
      xingqiu: { tier: "D", position: 0 },
    };
    const account = createAccountData({
      characters: [
        charWithArts("hu_tao", [
          { id: "ht-flower", slotKey: "flower" },
          { id: "ht-plume", slotKey: "plume" },
          { id: "ht-sands", slotKey: "sands" },
        ]),
        charWithArts("xingqiu", [{ id: "xq-flower", slotKey: "flower" }]),
      ],
    });

    const result = getHigherTierEquippedArtifactIds(
      "xingqiu",
      tierAssignments,
      account
    );
    expect(result).toEqual(new Set(["ht-flower", "ht-plume", "ht-sands"]));
  });
});
