import { describe, expect, it } from "vitest";
import {
  characterInvestmentCost,
  hasPaidConstellations,
} from "@/domain/combat/analyzer/investmentCost";
import type { CharInvestment } from "@/domain/combat/analyzer/types";

describe("free Traveler investment", () => {
  const investment: CharInvestment = {
    constellation: 6,
    weaponId: "favonius_sword",
    refinement: 5,
    is5StarWeapon: false,
  };
  it.each(["anemo", "geo", "electro", "dendro", "hydro", "pyro", "cryo"])(
    "counts only paid weapons for %s Traveler",
    (element) => {
      const config = { charId: `traveler_${element}`, rarity: 5 as const };
      expect(hasPaidConstellations(config)).toBe(false);
      expect(characterInvestmentCost(investment, config)).toBe(0);
      expect(
        characterInvestmentCost(
          { ...investment, is5StarWeapon: true, refinement: 3 },
          config
        )
      ).toBe(3);
    }
  );
  it("retains paid five-star and four-star costs", () => {
    expect(
      characterInvestmentCost(investment, { charId: "hu_tao", rarity: 5 })
    ).toBe(7);
    expect(
      characterInvestmentCost(investment, { charId: "bennett", rarity: 4 })
    ).toBe(0);
  });
});
