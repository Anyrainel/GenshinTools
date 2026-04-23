import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/talentRenderer";

describe("renderTemplate", () => {
  it("renders F1P format", () => {
    expect(renderTemplate("{param1:F1P}", [0.367])).toBe("36.7%");
    expect(renderTemplate("{param1:F1P}", [0.498])).toBe("49.8%");
    expect(renderTemplate("{param1:F1P}", [1.068])).toBe("106.8%");
  });

  it("strips trailing zeros from F1P", () => {
    expect(renderTemplate("{param1:F1P}", [0.3])).toBe("30%");
  });

  it("renders I format", () => {
    expect(renderTemplate("{param1:I}", [20.0])).toBe("20");
    expect(renderTemplate("{param1:I}", [12.0])).toBe("12");
  });

  it("renders P format", () => {
    expect(renderTemplate("{param1:P}", [1.3044])).toBe("130%");
  });

  it("renders F2P format", () => {
    expect(renderTemplate("{param1:F2P}", [0.05])).toBe("5%");
  });

  it("renders F1 format", () => {
    expect(renderTemplate("{param1:F1}", [6.5])).toBe("6.5");
  });

  it("renders multiple params", () => {
    expect(renderTemplate("{param1:F1P}+{param2:F1P}", [0.473, 0.602])).toBe(
      "47.3%+60.2%"
    );
  });

  it("renders template with literal text", () => {
    expect(renderTemplate("{param1:F1P} DEF", [1.34])).toBe("134% DEF");
    expect(renderTemplate("{param1:I}s", [12.0])).toBe("12s");
    expect(renderTemplate("{param1:F1P} each", [0.72])).toBe("72% each");
  });

  it("handles out-of-bounds param", () => {
    expect(renderTemplate("{param5:P}", [1.0])).toBe("0");
  });

  it("handles Albedo E example at Lv1", () => {
    const params = [1.3044, 1.3392, 30.0, 4.0];
    expect(renderTemplate("{param1:P}", params)).toBe("130%");
    expect(renderTemplate("{param2:P} DEF", params)).toBe("134% DEF");
    expect(renderTemplate("{param3:F1}s", params)).toBe("30s");
    expect(renderTemplate("{param4:F1}s", params)).toBe("4s");
  });

  it("renders slash-separated values", () => {
    expect(renderTemplate("{param1:P}/{param2:P}", [1.86, 2.32])).toBe(
      "186%/232%"
    );
  });
});
