import { RecommendationCard } from "@/components/account-data/RecommendationCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  type CharacterData,
  LUCK_MULTIPLIERS,
  type LuckExpectation,
  tiers,
} from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { BuildAwareScoreResult } from "@/lib/account-data/artifactScore";
import {
  type Insight,
  generateAllInsights,
} from "@/lib/account-data/insightEngine";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useTierStore } from "@/stores/useTierStore";
import { Info } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

interface RecommendationViewProps {
  scores: Record<string, BuildAwareScoreResult>;
}

export function RecommendationView({ scores }: RecommendationViewProps) {
  const { t } = useLanguage();
  const { accountData } = useAccountStore();
  const { tierAssignments, tierCustomization, setTierLuckExpectation } =
    useTierStore();
  const { config: scoreConfig } = useArtifactScoreStore();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Generate insights for all characters
  const allInsights = useMemo(() => {
    if (!accountData) return {};
    const results = generateAllInsights(
      accountData,
      scoreConfig,
      tierAssignments,
      tierCustomization
    );
    return results.reduce(
      (acc, { characterId, insights }) => {
        acc[characterId] = insights;
        return acc;
      },
      {} as Record<string, Insight[]>
    );
  }, [accountData, scoreConfig, tierAssignments, tierCustomization]);

  // Group characters by tier
  const charactersByTier = useMemo(() => {
    if (!accountData) return {};

    const byTier: Record<
      string,
      { char: CharacterData; scoreResult: BuildAwareScoreResult }[]
    > = {};
    for (const tier of tiers) {
      byTier[tier] = [];
    }

    for (const char of accountData.characters) {
      const scoreResult = scores[char.key];
      if (!scoreResult || !scoreResult.isComplete) continue;

      const assignment = tierAssignments[char.key];
      const tier = assignment ? assignment.tier : "Pool";

      if (!byTier[tier]) {
        if (!byTier.Pool) byTier.Pool = [];
        byTier.Pool.push({ char, scoreResult });
      } else {
        byTier[tier].push({ char, scoreResult });
      }
    }

    for (const tier of Object.keys(byTier)) {
      byTier[tier].sort((a, b) => {
        // Sort by max insight scoreDiff (highest potential improvement first)
        const aInsights = allInsights[a.char.key] || [];
        const bInsights = allInsights[b.char.key] || [];
        const aMaxDiff = Math.max(0, ...aInsights.map((i) => i.scoreDiff ?? 0));
        const bMaxDiff = Math.max(0, ...bInsights.map((i) => i.scoreDiff ?? 0));
        return bMaxDiff - aMaxDiff;
      });
    }

    return byTier;
  }, [accountData, scores, tierAssignments, allInsights]);

  if (!accountData) return null;

  return (
    <ScrollLayout className="space-y-8 pb-10 mt-2">
      {tiers.map((tier) => {
        const customization = tierCustomization[tier];
        if (customization?.hidden) return null;

        const chars = charactersByTier[tier] || [];
        if (chars.length === 0) return null;

        const displayName = customization?.displayName || t.tier(tier);
        const isPoolTier = tier === "Pool";
        const luckExpectation = customization?.luckExpectation || "balanced";

        return (
          <div key={tier} className="space-y-3">
            <div className="flex flex-wrap items-center gap-6 border-b border-white/10 pb-2">
              <h2 className="text-2xl font-bold text-white pb-1">
                {displayName}
                <span className="text-base font-normal text-muted-foreground pl-2">
                  ({chars.length})
                </span>
              </h2>

              {/* Luck Expectation: Label + Toggle + Description - skip for Pool tier */}
              {!isPoolTier && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-foreground font-medium">
                    {t.ui("accountData.luckExpectation.label")}:
                  </span>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    value={luckExpectation}
                    onValueChange={(value) => {
                      if (value)
                        setTierLuckExpectation(tier, value as LuckExpectation);
                    }}
                    className="bg-black/30 rounded-md p-0.5"
                  >
                    <ToggleGroupItem
                      value="cautious"
                      title={t.format(
                        "accountData.luckExpectation.tooltip",
                        LUCK_MULTIPLIERS.cautious
                      )}
                      className="text-xs px-2 py-1 data-[state=on]:bg-primary/20"
                    >
                      {t.ui("accountData.luckExpectation.cautious")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="balanced"
                      title={t.format(
                        "accountData.luckExpectation.tooltip",
                        LUCK_MULTIPLIERS.balanced
                      )}
                      className="text-xs px-2 py-1 data-[state=on]:bg-primary/20"
                    >
                      {t.ui("accountData.luckExpectation.balanced")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="hopeful"
                      title={t.format(
                        "accountData.luckExpectation.tooltip",
                        LUCK_MULTIPLIERS.hopeful
                      )}
                      className="text-xs px-2 py-1 data-[state=on]:bg-primary/20"
                    >
                      {t.ui("accountData.luckExpectation.hopeful")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <span className="text-muted-foreground text-xs hidden sm:inline">
                    ({t.ui("accountData.luckExpectation.description")})
                  </span>
                </div>
              )}
            </div>

            {/* Pool tier info message */}
            {isPoolTier && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-white/5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="text-base text-foreground">
                    {t.ui("accountData.insights.poolInfo")}
                  </div>
                  <Button asChild variant="outline">
                    <Link to="/tier-list">
                      {t.ui("accountData.insights.goToTierList")}
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            <div
              className={`grid gap-3 ${
                isMobile
                  ? "grid-cols-1"
                  : "grid-cols-[repeat(auto-fill,minmax(360px,1fr))]"
              }`}
            >
              {chars.map(({ char, scoreResult }) => (
                <RecommendationCard
                  key={char.key}
                  char={char}
                  tier={tier}
                  insights={isPoolTier ? undefined : allInsights[char.key]}
                  score={scoreResult}
                />
              ))}
            </div>
          </div>
        );
      })}
    </ScrollLayout>
  );
}
