import { describe, expect, it } from "vitest";

import { analyzeRotation } from "@/lib/ercalc/rotationHints";
import type {
  ERTimeline,
  PeriodicProc,
  TimelineAction,
} from "@/lib/ercalc/types";

/** Flat entry → ERTimeline helper (accepts periodicE for readability). */
type FlatEntry = {
  char: string;
  action: TimelineAction["action"] | "periodicE";
};
function ert(flat: FlatEntry[]): ERTimeline {
  const actions: TimelineAction[] = [];
  const periodic: PeriodicProc[] = [];
  const pending: string[] = [];
  for (const e of flat) {
    if (e.action === "periodicE") {
      pending.push(e.char);
    } else {
      const idx = actions.length;
      for (const src of pending)
        periodic.push({ sourceChar: src, trigger: "E", targetIndex: idx });
      pending.length = 0;
      actions.push({ char: e.char, action: e.action });
    }
  }
  if (pending.length && actions.length > 0) {
    const last = actions.length - 1;
    for (const src of pending)
      periodic.push({ sourceChar: src, trigger: "E", targetIndex: last });
  }
  return { actions, periodic };
}

describe("analyzeRotation", () => {
  it("detects Q before E (burst before skill)", () => {
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "xiangling", action: "Q" },
      { char: "xiangling", action: "E" },
      { char: "bennett", action: "Q" },
    ]);
    const hints = analyzeRotation(timeline, ["bennett", "xiangling"]);
    const xlHint = hints.find((h) => h.charId === "xiangling");
    expect(xlHint).toBeDefined();
    expect(xlHint!.type).toBe("info");
  });

  it("no hint when E comes before Q", () => {
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
    ]);
    const hints = analyzeRotation(timeline, ["bennett"]);
    const qBeforeE = hints.find(
      (h) => h.charId === "bennett" && h.messageEn.includes("bursts before")
    );
    expect(qBeforeE).toBeUndefined();
  });

  it("detects periodic deployer missing E", () => {
    // Xiangling has periodic procs attached but no E/holdE/specialE cast in actions
    const timeline: ERTimeline = {
      actions: [{ char: "xiangling", action: "Q" }],
      periodic: [
        { sourceChar: "xiangling", trigger: "E", targetIndex: 0 },
        { sourceChar: "xiangling", trigger: "E", targetIndex: 0 },
      ],
    };
    const hints = analyzeRotation(timeline, ["xiangling"]);
    const missingE = hints.find(
      (h) => h.charId === "xiangling" && h.messageEn.includes("no E deployment")
    );
    expect(missingE).toBeDefined();
    expect(missingE!.type).toBe("warning");
  });

  it("returns empty warnings for well-formed rotation", () => {
    const timeline = ert([
      { char: "bennett", action: "E" },
      { char: "bennett", action: "Q" },
      { char: "sucrose", action: "E" },
      { char: "sucrose", action: "Q" },
    ]);
    const hints = analyzeRotation(timeline, ["bennett", "sucrose"]);
    const warnings = hints.filter((h) => h.type === "warning");
    expect(warnings).toHaveLength(0);
  });

  it("warns about 3+ consecutive bursts", () => {
    const timeline = ert([
      { char: "bennett", action: "Q" },
      { char: "xiangling", action: "Q" },
      { char: "xingqiu", action: "Q" },
    ]);
    const hints = analyzeRotation(timeline, [
      "bennett",
      "xiangling",
      "xingqiu",
    ]);
    const burstHint = hints.find((h) => h.messageEn.includes("3+ bursts"));
    expect(burstHint).toBeDefined();
  });

  it("warns about too few periodic procs vs schema default", () => {
    // Xiangling's default procs is 4; give only 1
    const timeline: ERTimeline = {
      actions: [
        { char: "xiangling", action: "E" },
        { char: "xiangling", action: "Q" },
      ],
      periodic: [{ sourceChar: "xiangling", trigger: "E", targetIndex: 1 }],
    };
    const hints = analyzeRotation(timeline, ["xiangling"]);
    const procHint = hints.find(
      (h) => h.charId === "xiangling" && h.messageEn.includes("periodic procs")
    );
    expect(procHint).toBeDefined();
  });
});
