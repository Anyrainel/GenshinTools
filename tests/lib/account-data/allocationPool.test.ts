import { describe, expect, it } from "vitest";
import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { buildAllocationPool } from "@/lib/account-data/allocationPool";

function artifact(id: string, slotKey: Slot): ArtifactData {
  return {
    id,
    setKey: "CW",
    slotKey,
    level: 20,
    rarity: 5,
    mainStatKey: slotKey === "flower" ? "hp" : "atk",
    lock: false,
    substats: { cd: 10 },
  };
}

describe("buildAllocationPool", () => {
  it("does not re-add an equipped artifact that is no longer unclaimed", () => {
    const equipped = artifact("claimed-by-higher-tier", "flower");
    const available = artifact("available", "flower");

    const pool = buildAllocationPool(
      { key: "char", artifacts: { flower: equipped } },
      [available]
    );

    expect(pool.flower.map((a) => a.id)).toEqual(["available"]);
  });

  it("keeps an equipped artifact while it is still unclaimed", () => {
    const equipped = artifact("still-free", "flower");

    const pool = buildAllocationPool(
      { key: "char", artifacts: { flower: equipped } },
      [equipped]
    );

    expect(pool.flower.map((a) => a.id)).toEqual(["still-free"]);
  });
});
