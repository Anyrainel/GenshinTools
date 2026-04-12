import { describe, expect, it } from "vitest";

import type { Timeline } from "@/lib/ercalc/erCalculator";
import { analyzeRotation } from "@/lib/ercalc/rotationHints";

describe("analyzeRotation", () => {
  it("detects Q before E (burst before skill)", () => {
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" }, // XL Q before XL E
      { char: "xiangling", action: "E" },
      { char: "bennett", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["bennett", "xiangling"]);
    const xlHint = hints.find((h) => h.charId === "xiangling");
    expect(xlHint).toBeDefined();
    expect(xlHint!.type).toBe("info");
  });

  it("no hint when E comes before Q", () => {
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["bennett"]);
    const qBeforeE = hints.find(
      (h) => h.charId === "bennett" && h.messageEn.includes("bursts before")
    );
    expect(qBeforeE).toBeUndefined();
  });

  it("detects periodic deployer missing E", () => {
    const timeline: Timeline = [
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["xiangling"]);
    const missingE = hints.find(
      (h) => h.charId === "xiangling" && h.messageEn.includes("no E deployment")
    );
    expect(missingE).toBeDefined();
    expect(missingE!.type).toBe("warning");
  });

  it("detects character with no actions", () => {
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["bennett", "sucrose"]);
    const noAction = hints.find(
      (h) => h.charId === "sucrose" && h.messageEn.includes("no actions")
    );
    expect(noAction).toBeDefined();
  });

  it("returns empty hints for well-formed rotation", () => {
    const timeline: Timeline = [
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["bennett", "sucrose"]);
    // Should have no warnings (both chars have E before Q, both are in timeline)
    const warnings = hints.filter((h) => h.type === "warning");
    expect(warnings).toHaveLength(0);
  });

  it("warns about 3+ consecutive bursts", () => {
    const timeline: Timeline = [
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "Q" },
      { char: "xingqiu", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, [
      "bennett",
      "xiangling",
      "xingqiu",
    ]);
    const burstHint = hints.find((h) => h.messageEn.includes("3+ bursts"));
    expect(burstHint).toBeDefined();
  });

  it("warns about too few periodicE procs", () => {
    // Xiangling expects 4 procs, give her only 1
    const timeline: Timeline = [
      { char: "xiangling", action: "E" },
      { char: "xiangling", action: "periodicE" },
      { char: "xiangling", action: "Q" },
    ];
    const hints = analyzeRotation(timeline, ["xiangling"]);
    const procHint = hints.find(
      (h) => h.charId === "xiangling" && h.messageEn.includes("periodic procs")
    );
    expect(procHint).toBeDefined();
  });
});
