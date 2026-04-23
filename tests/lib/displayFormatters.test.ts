import { describe, expect, it } from "vitest";
import { fmtStat } from "@/lib/team-comp/displayFormatter";

describe("fmtStat flat stat rounding", () => {
  it("rounds precise flat HP to integer", () => {
    expect(fmtStat("hp", 448.13, false, true)).toBe("448");
  });

  it("rounds precise flat ATK to integer", () => {
    expect(fmtStat("atk", 58.34, false, true)).toBe("58");
  });

  it("rounds precise flat DEF to integer", () => {
    expect(fmtStat("def", 39.35, false, true)).toBe("39");
  });

  it("rounds precise flat EM to integer", () => {
    expect(fmtStat("em", 56.31, false, true)).toBe("56");
  });

  it("preserves existing integer flat stat display", () => {
    expect(fmtStat("hp", 448, false, true)).toBe("448");
    expect(fmtStat("atk", 311, false, true)).toBe("311");
  });

  it("still shows pct stats with 1 decimal", () => {
    expect(fmtStat("cr", 10.47, false, true)).toBe("10.5%");
    expect(fmtStat("cd", 21.0, false, true)).toBe("21.0%");
  });

  it("handles forceSign on precise flat values", () => {
    expect(fmtStat("hp", 448.13, true, true)).toBe("+448");
  });
});
