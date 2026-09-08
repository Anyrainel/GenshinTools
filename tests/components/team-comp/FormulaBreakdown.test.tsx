import { describe, expect, it } from "vitest";
import { FormulaBreakdown } from "@/components/team-comp/FormulaBreakdown";
import { LunarFormula } from "@/lib/dmgcalc/core/damageFormula";
import { StatSheet } from "@/lib/dmgcalc/core/statSheet";
import { render, screen } from "../../utils/render";

describe("lunar formula breakdown", () => {
  it.each([
    "lunarCharged",
    "lunarCrystallize",
  ] as const)("groups the flat bonus before CRIT for %s", (reaction) => {
    const formula = new LunarFormula(0, {
      element: reaction === "lunarCharged" ? "Electro" : "Geo",
      ability: "special",
      reaction,
    });
    const part = formula.display(
      new StatSheet([
        { key: "baseDmg", value: 2250 },
        { key: "cr", value: 0.5 },
        { key: "cd", value: 1 },
      ]),
      90,
      {
        enemyLevel: 100,
        enemyRes: 0.1,
        rollMultiplier: 0.85,
        substatBudget: "8_6",
      }
    );
    render(
      <FormulaBreakdown
        parts={[part]}
        highlightedStat="baseDmg"
        critMode="expected"
      />
    );
    const flat = screen.getByText(/^(Flat|附加伤害)$/);
    const crit = screen.getByText(/^(Crit Zone|暴击乘区)$/);
    // The additive term belongs inside the reaction subtotal parentheses;
    // CRIT multiplies that entire subtotal from outside the group.
    const group = flat.parentElement?.parentElement?.parentElement;
    expect(group?.textContent).toMatch(/^\(.*\)$/);
    expect(group).not.toContainElement(crit);
    expect(
      flat.compareDocumentPosition(crit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
