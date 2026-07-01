import { describe, expect, it } from "vitest";
import { compileHighLevelRotation } from "@/lib/ercalc/synthesizer";

describe("High-Level Synthesizer", () => {
  it("should compile a basic high-level rotation with funneling and NAs", () => {
    const input = {
      teamCharIds: ["bennett", "xiangling", "xingqiu", "sucrose"],
      casts: {
        bennett: { skillCount: 1, burstCount: 1 },
        xiangling: { skillCount: 1, burstCount: 1 },
        xingqiu: { skillCount: 2, burstCount: 1 },
        sucrose: { skillCount: 2, burstCount: 1, normalAttackCount: 3 },
      },
      funnels: [
        { sourceCharId: "bennett", targetCharId: "xiangling", castIndex: 0 },
      ],
      driverCharId: "sucrose",
    };

    const timeline = compileHighLevelRotation(input);

    expect(timeline.actions).toBeDefined();
    // Timeline order should match the swapOrder:
    // Setup (xingqiu) -> Anemo (sucrose) -> Buffer (bennett) -> DPS (xiangling)
    // plus Bennett E funneled to Xiangling, driver Sucrose NAs at the end.

    // Check that Bennett E is followed by swap to Xiangling
    const bennettEIdx = timeline.actions.findIndex(
      (a) => a.char === "bennett" && a.action === "E"
    );
    expect(bennettEIdx).not.toBe(-1);

    // Bennett E is immediately followed by Xiangling swap action (Q or wait)
    const nextAction = timeline.actions[bennettEIdx + 1];
    expect(nextAction.char).toBe("xiangling");

    // Sucrose driver NAs at the end of timeline
    const len = timeline.actions.length;
    expect(timeline.actions[len - 1]).toEqual({
      char: "sucrose",
      action: "NA",
    });
    expect(timeline.actions[len - 2]).toEqual({
      char: "sucrose",
      action: "NA",
    });
    expect(timeline.actions[len - 3]).toEqual({
      char: "sucrose",
      action: "NA",
    });
  });
});
