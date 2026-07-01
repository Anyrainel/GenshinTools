import { describe, expect, it } from "vitest";
import { runRedesignedCalculation } from "@/lib/ercalc/redesignedCalculator";
import { parseRedesignedInput } from "@/lib/ercalc/redesignedParser";

const EXAMPLE_METADATA = `【队伍编码 N】
N=｛1哥伦比娅60, 33菲林斯(30,80), 1伊涅芙60, 03砂糖(0,80)｝

【轴长 C】
C=｛24, 20, 20, 24｝

【动作序列 P】
P=｛3EQ1QE4QE2QEEQAAAAAEQAAAAAEQ1QE3QE4E2EEQAAAAAEQAAAAAEQ｝

【动作耗时 t_i】
t_i:=｛t_Q=1, t_E=1, t_A=0.8｝

【元素属性】
元素属性：哥伦比娅(水), 菲林斯(雷), 伊涅芙(雷), 砂糖(风)

【元素微粒参数】
哥伦比娅: δ=4, Tprod=25, e₀={1(0.66),2(0.33)}
菲林斯:   δ=2, Tprod=10, e₀=1.0
伊涅芙:   δ=2, Tprod=20, e₀={0(0.33),1(0.66)}
砂糖:     δ=1, Tprod=0.4, e₀=4.0

【周期性回复】
哥伦比娅: S=86, n=3, d_in=0.18, V=1, P=2
  T1: 2.28, 15, 4, 1
  T2: 0, 18, 14, 1
  T3: 2.28, 15, 8, 0.1
菲林斯:   S=86, n=3, d_in=0.18, V=14, P=1
  T1: 6.86, 14, 12, 1
  T2: 2.28, 15, 8, 0.7
  T3: 2.28, 5.5, 8, 1
伊涅芙、砂糖: 无`;

describe("Redesigned ER Calculator", () => {
  it("should correctly parse the NGA example input", () => {
    const input = parseRedesignedInput(EXAMPLE_METADATA);

    expect(input.charOrders).toEqual(["哥伦比娅", "菲林斯", "伊涅芙", "砂糖"]);
    expect(input.axisLengths).toEqual([24, 20, 20, 24]);
    expect(input.actionSequence).toBe(
      "3EQ1QE4QE2QEEQAAAAAEQAAAAAEQ1QE3QE4E2EEQAAAAAEQAAAAAEQ"
    );
    expect(input.actionCosts).toEqual({ Q: 1.0, E: 1.0, A: 0.8 });

    expect(input.elements["哥伦比娅"]).toBe("水");
    expect(input.elements["菲林斯"]).toBe("雷");
    expect(input.elements["伊涅芙"]).toBe("雷");
    expect(input.elements["砂糖"]).toBe("风");

    // Check particles config
    expect(input.particles["哥伦比娅"].delta).toBe(4);
    expect(input.particles["哥伦比娅"].tProd).toBe(25);
    expect(input.particles["哥伦比娅"].e0).toEqual([
      { value: 1, prob: 0.66 },
      { value: 2, prob: 0.33 },
    ]);

    expect(input.particles["菲林斯"].delta).toBe(2);
    expect(input.particles["菲林斯"].tProd).toBe(10);
    expect(input.particles["菲林斯"].e0).toBe(1.0);

    // Check recoveries config
    expect(input.recoveries["哥伦比娅"].S).toBe(86);
    expect(input.recoveries["哥伦比娅"].n).toBe(3);
    expect(input.recoveries["哥伦比娅"].V).toBe(1);
    expect(input.recoveries["哥伦比娅"].P).toBe(2);
    expect(input.recoveries["哥伦比娅"].tuples).toHaveLength(3);
    expect(input.recoveries["哥伦比娅"].tuples[0]).toEqual({
      a: 2.28,
      b: 15,
      lambda: 4,
      k: 1,
    });

    expect(input.recoveries["伊涅芙"].n).toBe(0);
    expect(input.recoveries["砂糖"].n).toBe(0);
  });

  it("should compute correct timings and action boundaries matching NGA specifications", () => {
    const input = parseRedesignedInput(EXAMPLE_METADATA);
    // Overriding timings table to match the explicit NGA table provided in the example
    input.customTiming = [
      {
        name: "哥伦比娅",
        element: "水",
        actionCount: 2,
        tIn: 16 / 7,
        tOut: 32 / 7,
      },
      { name: "菲林斯", element: "雷", actionCount: 18, tIn: 48 / 7, tOut: 24 },
      { name: "伊涅芙", element: "雷", actionCount: 2, tIn: 0, tOut: 16 / 7 },
      {
        name: "砂糖",
        element: "风",
        actionCount: 2,
        tIn: 32 / 7,
        tOut: 48 / 7,
      },
    ];

    const res = runRedesignedCalculation(input);

    // 1. Check timings are retained
    expect(res.timings[0].tIn).toBeCloseTo(2.2857, 4);
    expect(res.timings[0].tOut).toBeCloseTo(4.5714, 4);

    // 2. Check Group A particles calculations
    // 哥伦比娅: expected e0 = 1*0.66 + 2*0.33 = 1.32. Pe = 4. E = 5.28.
    const aGelb = res.groupA["哥伦比娅"];
    expect(aGelb.E).toBeCloseTo(5.28, 2);
    expect(aGelb.Q_same_front).toBeCloseTo(15.84, 2);
    expect(aGelb.Q_same_back).toBeCloseTo(9.504, 3);
    expect(aGelb.Q_diff_back).toBeCloseTo(3.168, 3);

    // 菲林斯: e0 = 1.0. Pe = 6. E = 6.0.
    const aFlins = res.groupA["菲林斯"];
    expect(aFlins.E).toBeCloseTo(6.0, 2);
    expect(aFlins.Q_same_front).toBeCloseTo(18.0, 2);
    expect(aFlins.Q_diff_back).toBeCloseTo(3.6, 2);

    // 伊涅芙: expected e0 = 0*0.33 + 1*0.66 = 0.66. Pe = 7. E = 4.62.
    const aInev = res.groupA["伊涅芙"];
    expect(aInev.E).toBeCloseTo(4.62, 2);
    expect(aInev.Q_same_front).toBeCloseTo(13.86, 2);

    // 砂糖: e0 = 4.0. Pe = 1. E = 4.0.
    const aSugar = res.groupA["砂糖"];
    expect(aSugar.E).toBeCloseTo(4.0, 2);
    expect(aSugar.Q_same_front).toBeCloseTo(12.0, 2);

    // 3. Check Group B recoveries calculations
    // 哥伦比娅: R_avg approx 31.375, R_min = 26.667, R_max = 33.933
    const bGelb = res.groupB["哥伦比娅"];
    expect(bGelb.avg).toBeCloseTo(31.375, 2);
    expect(bGelb.min).toBeCloseTo(26.667, 3);
    expect(bGelb.max).toBeCloseTo(33.933, 3);

    // 菲林斯: R_avg approx 75.473, R_min = 69.333, R_max = 91.867
    const bFlins = res.groupB["菲林斯"];
    expect(bFlins.avg).toBeCloseTo(75.473, 2);
    expect(bFlins.min).toBeCloseTo(69.333, 3);
    expect(bFlins.max).toBeCloseTo(91.867, 3);

    // 4. Check ER results matching NGA outputs
    // 哥伦比娅: ER avg = 1.1631 (116.31%), recommended = 120%
    const rGelb = res.erResults.find((r) => r.name === "哥伦比娅")!;
    expect(rGelb.erNeeded["D=60"].avg).toBeCloseTo(116.31, 1);
    expect(rGelb.erNeeded["D=60"].min).toBeCloseTo(105.91, 1); // note: min ER corresponds to max recovery (33.933) -> (60-33.933)/24.612 = 1.0591
    expect(rGelb.erNeeded["D=60"].max).toBeCloseTo(135.42, 1); // note: max ER corresponds to min recovery (26.667) -> (60-26.667)/24.612 = 1.3542
    expect(rGelb.erNeeded["D=60"].recommended).toBe(120);

    // 菲林斯 D_avg: ER avg = 1.2920 (129.20%), recommended = 130%
    const rFlins = res.erResults.find((r) => r.name === "菲林斯")!;
    expect(rFlins.erNeeded["D_avg"].avg).toBeCloseTo(129.2, 1);
    expect(rFlins.erNeeded["D_avg"].min).toBeCloseTo(77.79, 1);
    expect(rFlins.erNeeded["D_avg"].max).toBeCloseTo(148.46, 1);
    expect(rFlins.erNeeded["D_avg"].recommended).toBe(130);

    // 伊涅芙: ER avg = 1.9850 (198.50%), recommended = 200%
    const rInev = res.erResults.find((r) => r.name === "伊涅芙")!;
    expect(rInev.erNeeded["D=60"].avg).toBeCloseTo(198.5, 1);
    expect(rInev.erNeeded["D=60"].recommended).toBe(200);

    // 砂糖 D_avg: ER avg = 1.2381 (123.81%), recommended = 125%
    const rSugar = res.erResults.find((r) => r.name === "砂糖")!;
    expect(rSugar.erNeeded["D_avg"].avg).toBeCloseTo(123.81, 1);
    expect(rSugar.erNeeded["D_avg"].recommended).toBe(125);
  });
});
