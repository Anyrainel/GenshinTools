import { isPaidFiveStarWeapon } from "@/domain/reference/weaponInvestment";
import type { AnalyzerCharConfig, CharInvestment } from "./types";

/** Traveler constellations are free rather than paid investment steps. */
export function hasPaidConstellations(
  config: Pick<AnalyzerCharConfig, "charId" | "rarity">
): boolean {
  return config.rarity >= 5 && !config.charId.startsWith("traveler_");
}

export function characterInvestmentCost(
  investment: CharInvestment,
  config: Pick<AnalyzerCharConfig, "charId" | "rarity">
): number {
  const character = hasPaidConstellations(config)
    ? investment.constellation + 1
    : 0;
  return (
    character +
    (investment.is5StarWeapon && isPaidFiveStarWeapon(investment.weaponId)
      ? investment.refinement
      : 0)
  );
}
