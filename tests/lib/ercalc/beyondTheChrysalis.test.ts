import { describe, expect, it } from "vitest";
import {
  calculateTeamER,
  calculateTeamERSequence,
  getEnergyLoopRepeatCount,
  getNodeEnergyEvents,
} from "@/lib/ercalc/erCalculator";
import type { ERTimeline, TeamMember } from "@/lib/ercalc/types";

const wearer = (refinement = 0): TeamMember => ({
  id: "vesna",
  element: "Anemo",
  burstCost: 60,
  weaponId: "beyond_the_chrysalis",
  refinement,
});
const teammate: TeamMember = {
  id: "kaeya",
  element: "Cryo",
  burstCost: 60,
};

function run(actions: ERTimeline["actions"], refinement = 0) {
  return calculateTeamER(
    [wearer(refinement), teammate],
    {
      actions,
      periodic: [],
    },
    { calcMode: "zero-energy-start" }
  )[0];
}

describe("Beyond the Chrysalis energy sequence", () => {
  it.each([
    0, 1, 2, 3, 4,
  ])("restores the refinement amount on each third cast at refinement index %d", (refinement) => {
    const result = run(
      [
        { char: "vesna", action: "E" },
        { char: "vesna", action: "holdE" },
        { char: "vesna", action: "specialE" },
        { char: "vesna", action: "Q" },
      ],
      refinement
    );
    expect(result.qWindows?.[0].flatEnergy).toBe(5 + refinement * 0.5);
  });

  it("does not restore energy before the third cast", () => {
    expect(
      run([
        { char: "vesna", action: "E" },
        { char: "vesna", action: "Q" },
      ]).qWindows?.[0].flatEnergy
    ).toBe(0);
  });

  it("includes burst variants and pays a burst-triggered refund after its checkpoint", () => {
    const result = run([
      { char: "vesna", action: "E" },
      { char: "vesna", action: "Q" },
      { char: "vesna", action: "specialQ" },
      { char: "vesna", action: "Q" },
    ]);
    expect(result.qWindows?.map((window) => window.flatEnergy)).toEqual([
      0, 0, 5,
    ]);
  });

  it("resets the phase on leaving the field, including a teammate wait", () => {
    const result = run([
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "kaeya", action: "wait" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "Q" },
      { char: "vesna", action: "Q" },
    ]);
    expect(result.qWindows?.map((window) => window.flatEnergy)).toEqual([0, 5]);
  });

  it("keeps the phase across pseudo-nodes owned by a different character", () => {
    const result = run([
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "kaeya", action: "enemyOrb", orbCount: 1 },
      { char: "kaeya", action: "grantEnergy", energyGrants: {} },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "Q" },
    ]);
    expect(result.qWindows?.[0].flatEnergy).toBe(5);
  });

  it("advances the sequence while cooldown blocks a refund", () => {
    // Third casts at t=2, 5, 8: the t=5 refund is blocked, then the next
    // eligible third cast at t=8 restores energy again.
    const result = run([
      ...Array.from({ length: 9 }, () => ({
        char: "vesna",
        action: "E" as const,
      })),
      { char: "vesna", action: "Q" },
    ]);
    expect(result.qWindows?.[0].flatEnergy).toBe(10);
    expect(
      result.qWindows?.[0].events
        .filter((event) => event.type === "flat")
        .map((event) => event.sourceIndex)
    ).toEqual([2, 8]);
  });

  it("retains the four-second energy cap across a swap", () => {
    // Third casts at t=2 and t=5.5. The swap clears the sequence but does
    // not make the second refund eligible before the four-second cap.
    const result = run([
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "kaeya", action: "NA" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "E" },
      { char: "vesna", action: "Q" },
    ]);
    expect(result.qWindows?.[0].flatEnergy).toBe(5);
  });

  it("preserves the phase across repeated-loop boundaries without a swap", () => {
    const [result] = calculateTeamER([wearer()], {
      actions: [
        { char: "vesna", action: "E" },
        { char: "vesna", action: "Q" },
      ],
      periodic: [],
    });
    expect(result.qWindows?.[0].flatEnergy).toBe(5);
    expect(result.qWindows?.map((window) => window.flatEnergy)).toContain(0);
  });

  it("checks the worst sustained window across weapon phases and cooldown", () => {
    const team: TeamMember[] = [
      {
        id: "kaeya",
        element: "Cryo",
        burstCost: 60,
        weaponId: "beyond_the_chrysalis",
        refinement: 0,
      },
    ];
    const loop: ERTimeline = {
      actions: [
        { char: "kaeya", action: "E" },
        { char: "kaeya", action: "Q" },
      ],
      periodic: [],
    };
    const [automatic] = calculateTeamER(team, loop);
    const [authored] = calculateTeamERSequence(
      team,
      Array.from({ length: getEnergyLoopRepeatCount(team) }, (_, index) => ({
        timeline: loop,
        source: {
          kind: "loop" as const,
          iteration: index === 0 ? ("first" as const) : ("subsequent" as const),
        },
      })),
      { startFull: true, isRepeating: true }
    );
    expect(automatic.erNeeded).toBeCloseTo(authored.erNeeded, 6);
    expect(automatic.erNeeded).toBeCloseTo(749.0636704119851, 6);
    expect(
      automatic.qWindows?.find((window) => window.isBinding)?.flatEnergy
    ).toBe(0);
    expect(automatic.qWindows?.map((window) => window.flatEnergy)).toEqual([
      5, 0, 0, 5, 0,
    ]);
    expect(getEnergyLoopRepeatCount(team)).toBe(6);
    expect(
      getEnergyLoopRepeatCount([{ ...team[0], weaponId: undefined }])
    ).toBe(2);
  });

  it("keeps authored finite sequence segments unchanged", () => {
    const loop: ERTimeline = {
      actions: [
        { char: "vesna", action: "E" },
        { char: "vesna", action: "Q" },
      ],
      periodic: [],
    };
    const [result] = calculateTeamERSequence(
      [wearer()],
      [
        { timeline: loop, source: { kind: "loop", iteration: "first" } },
        { timeline: loop, source: { kind: "loop", iteration: "subsequent" } },
      ],
      { startFull: true, isRepeating: true }
    );
    expect(result.qWindows).toHaveLength(2);
    expect(result.qWindows?.map((window) => window.flatEnergy)).toEqual([
      60, 5,
    ]);
  });

  it("labels the single-node preview with its sequence condition", () => {
    const refund = getNodeEnergyEvents({ char: "vesna", action: "E" }, [
      wearer(),
    ]).find((event) => event.sourceLabel === "beyond_the_chrysalis");
    expect(refund?.amount).toBe(5);
    expect(refund?.conditionEn).toContain("Every third");
    expect(refund?.conditionZh).toContain("退场时重置顺序");
  });
});
