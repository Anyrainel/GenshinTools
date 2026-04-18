import { getEffectiveCombo } from "@/lib/team-comp/calc/combo";
import type { ComboFormula } from "@/lib/team-comp/types";
import type { Team } from "@/stores/useTeamStore";
import { describe, expect, it } from "vitest";

type TeamSlice = Pick<
  Team,
  | "formulaMode"
  | "selectedFormula"
  | "singleReaction"
  | "singleForceOnField"
  | "combo"
>;

function makeTeam(overrides: Partial<TeamSlice>): TeamSlice {
  return {
    formulaMode: "single",
    selectedFormula: null,
    singleReaction: undefined,
    singleForceOnField: undefined,
    combo: null,
    ...overrides,
  };
}

describe("getEffectiveCombo", () => {
  describe("single mode", () => {
    it("returns empty combo when no formula is selected", () => {
      const result = getEffectiveCombo(makeTeam({ formulaMode: "single" }));
      expect(result.lines).toEqual([]);
    });

    it("synthesizes a 1-line combo from selectedFormula", () => {
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "single",
          selectedFormula: { charId: "Nahida", formulaId: "burst" },
        })
      );
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0]).toMatchObject({
        charId: "Nahida",
        formulaId: "burst",
        count: 1,
        reaction: undefined,
      });
    });

    it("includes singleReaction (reaction only)", () => {
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "single",
          selectedFormula: { charId: "Hu Tao", formulaId: "E" },
          singleReaction: { reaction: "vaporize" },
        })
      );
      expect(result.lines[0].reaction).toEqual({ reaction: "vaporize" });
    });

    it("preserves forceOnField=true on the synthesized line", () => {
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "single",
          selectedFormula: { charId: "Xiangling", formulaId: "Q" },
          singleReaction: { reaction: "vaporize" },
          singleForceOnField: true,
        })
      );
      expect(result.lines[0].reaction).toEqual({
        reaction: "vaporize",
      });
      expect(result.lines[0].forceOnField).toBe(true);
    });

    it("preserves forceOnField=false on the synthesized line", () => {
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "single",
          selectedFormula: { charId: "Xiangling", formulaId: "Q" },
          singleReaction: { reaction: "vaporize" },
          singleForceOnField: false,
        })
      );
      expect(result.lines[0].reaction).toEqual({
        reaction: "vaporize",
      });
      expect(result.lines[0].forceOnField).toBe(false);
    });

    it("ignores combo mode state when in single mode", () => {
      const combo: ComboFormula = {
        id: "c1",
        label: { en: "A", zh: "A" },
        lines: [{ charId: "X", formulaId: "Y", count: 9 }],
      };
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "single",
          selectedFormula: { charId: "Nahida", formulaId: "burst" },
          combo: combo,
        })
      );
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].charId).toBe("Nahida");
    });
  });

  describe("combo mode", () => {
    it("returns empty combo when no combos exist", () => {
      const result = getEffectiveCombo(
        makeTeam({ formulaMode: "combo", combo: null })
      );
      expect(result.lines).toEqual([]);
    });

    it("returns selected combo with zero-count lines filtered out", () => {
      const combo: ComboFormula = {
        id: "c1",
        label: { en: "Rot", zh: "循环" },
        lines: [
          { charId: "A", formulaId: "f1", count: 2 },
          { charId: "B", formulaId: "f2", count: 0 },
          { charId: "C", formulaId: "f3", count: 5 },
        ],
      };
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "combo",
          combo,
        })
      );
      expect(result.id).toBe("c1");
      expect(result.lines).toHaveLength(2);
      expect(result.lines.map((l) => l.charId)).toEqual(["A", "C"]);
    });

    it("returns the combo when set", () => {
      const combo: ComboFormula = {
        id: "first",
        label: { en: "F", zh: "F" },
        lines: [{ charId: "A", formulaId: "f1", count: 1 }],
      };
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "combo",
          combo,
        })
      );
      expect(result.id).toBe("first");
    });

    it("ignores single-mode draft state when in combo mode", () => {
      const combo: ComboFormula = {
        id: "c1",
        label: { en: "X", zh: "X" },
        lines: [{ charId: "A", formulaId: "f1", count: 1 }],
      };
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "combo",
          selectedFormula: { charId: "Nahida", formulaId: "burst" },
          singleReaction: { reaction: "bloom" },
          combo,
        })
      );
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].charId).toBe("A");
    });

    it("preserves per-line reaction overrides", () => {
      const combo: ComboFormula = {
        id: "c1",
        label: { en: "X", zh: "X" },
        lines: [
          {
            charId: "A",
            formulaId: "f1",
            count: 1,
            reaction: { reaction: "melt" },
            forceOnField: true,
          },
        ],
      };
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: "combo",
          combo,
        })
      );
      expect(result.lines[0].reaction).toEqual({
        reaction: "melt",
      });
      expect(result.lines[0].forceOnField).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("defaults to single mode when formulaMode is undefined", () => {
      const result = getEffectiveCombo(
        makeTeam({
          formulaMode: undefined as unknown as "single",
          selectedFormula: { charId: "A", formulaId: "f1" },
        })
      );
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].charId).toBe("A");
    });
  });
});
