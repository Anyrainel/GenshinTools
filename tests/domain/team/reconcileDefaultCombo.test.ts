import type { TeamBuild } from "@/domain/combat/damage/core/teamBuild";
import type { ComboFormula } from "@/domain/combat/damage/types";
import { reconcileDefaultCombo } from "@/domain/team/reconcileDefaultCombo";

function catalog(counts: Record<string, number>): TeamBuild {
  return { catalog: { getCombo: () => counts } } as unknown as TeamBuild;
}
const before = catalog({ charged: 5, burst: 1 });
const after = catalog({ charged: 3, burst: 1, followup: 2 });
const combo: ComboFormula = {
  id: "authored-team",
  label: { en: "My rotation", zh: "自定义循环" },
  lines: [
    {
      charId: "carry",
      formulaId: "charged",
      count: 5,
      reaction: { reaction: "vaporize" },
    },
    { charId: "carry", formulaId: "burst", count: 1 },
    { charId: "support", formulaId: "burst", count: 10 },
  ],
};
describe("default count reconciliation after constellation edits", () => {
  it("refreshes identifiable defaults, adds newly appearing lines and preserves reaction choices and other members", () => {
    const result = reconcileDefaultCombo(
      combo,
      before,
      after,
      new Set(["carry"])
    );
    expect(result.lines).toEqual([
      { ...combo.lines[0], count: 3 },
      combo.lines[1],
      { charId: "carry", formulaId: "followup", count: 2 },
      combo.lines[2],
    ]);
    expect(result.id).toBe(combo.id);
    expect(result.label).toEqual(combo.label);
  });
  it("preserves explicitly authored non-default counts on reset", () => {
    const customized = {
      ...combo,
      lines: [{ ...combo.lines[0], count: 7 }, ...combo.lines.slice(1)],
    };
    expect(
      reconcileDefaultCombo(customized, before, after, new Set(["carry"]))
    ).toBe(customized);
  });
  it("preserves mixed reaction splits even when their total matches a catalog default", () => {
    const mixed = {
      ...combo,
      lines: [
        { ...combo.lines[0], count: 3 },
        { ...combo.lines[0], count: 2, reaction: undefined },
        ...combo.lines.slice(1),
      ],
    };
    expect(
      reconcileDefaultCombo(mixed, before, after, new Set(["carry"]))
    ).toBe(mixed);
  });
});
