import type { TeamMemberInvestment } from "./teamMemberInvestment";

export type TeamMemberConstellationScope =
  | { type: "unspecified" }
  | { type: "exact"; constellation: number }
  | {
      type: "range";
      minConstellation: number;
      maxConstellation?: number;
    }
  | {
      type: "range";
      minConstellation?: number;
      maxConstellation: number;
    };

export type SourceBaselineConstellationScopeOutcome =
  | "not-constrained-by-source"
  | "unresolved-baseline-unspecified"
  | "guaranteed-satisfies"
  | "guaranteed-conflict"
  | "unresolved-partial-overlap";

export type SourceBaselineConstellationScopeComparison = {
  sourceScope: TeamMemberConstellationScope;
  baselineScope: TeamMemberConstellationScope;
  outcome: SourceBaselineConstellationScopeOutcome;
  talentLevelsEvaluated: false;
};

export function constellationScopeFromInvestment(
  investment: TeamMemberInvestment,
): TeamMemberConstellationScope {
  if (investment.status === "unspecified") return { type: "unspecified" };
  if (investment.constellation != null) {
    return { type: "exact", constellation: investment.constellation };
  }
  if (investment.status === "partial" && investment.minConstellation != null) {
    return {
      type: "range",
      minConstellation: investment.minConstellation,
      ...(investment.maxConstellation == null
        ? {}
        : { maxConstellation: investment.maxConstellation }),
    };
  }
  if (investment.status === "partial" && investment.maxConstellation != null) {
    return {
      type: "range",
      maxConstellation: investment.maxConstellation,
    };
  }
  return { type: "unspecified" };
}

/**
 * Compare source applicability with a baseline investment scope.
 *
 * The returned scopes preserve exactly which source bounds were present.
 * C0 and C6 are used only as internal interval limits. Talent levels are
 * intentionally outside this comparison.
 */
export function compareSourceToBaselineConstellationScope(
  sourceInvestment: TeamMemberInvestment,
  baselineInvestment: TeamMemberInvestment,
): SourceBaselineConstellationScopeComparison {
  const sourceScope = constellationScopeFromInvestment(sourceInvestment);
  const baselineScope = constellationScopeFromInvestment(baselineInvestment);
  let outcome: SourceBaselineConstellationScopeOutcome;

  if (sourceScope.type === "unspecified") {
    outcome = "not-constrained-by-source";
  } else if (baselineScope.type === "unspecified") {
    outcome = "unresolved-baseline-unspecified";
  } else {
    const sourceInterval = constellationInterval(sourceScope);
    const baselineInterval = constellationInterval(baselineScope);
    if (
      baselineInterval.minimum >= sourceInterval.minimum &&
      baselineInterval.maximum <= sourceInterval.maximum
    ) {
      outcome = "guaranteed-satisfies";
    } else if (
      baselineInterval.maximum < sourceInterval.minimum ||
      baselineInterval.minimum > sourceInterval.maximum
    ) {
      outcome = "guaranteed-conflict";
    } else {
      outcome = "unresolved-partial-overlap";
    }
  }

  return {
    sourceScope,
    baselineScope,
    outcome,
    talentLevelsEvaluated: false,
  };
}

function constellationInterval(
  scope: Exclude<TeamMemberConstellationScope, { type: "unspecified" }>,
): { minimum: number; maximum: number } {
  if (scope.type === "exact") {
    return { minimum: scope.constellation, maximum: scope.constellation };
  }
  return {
    minimum: scope.minConstellation ?? 0,
    maximum: scope.maxConstellation ?? 6,
  };
}
