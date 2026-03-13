import { ActionRecommendationCard } from "@/components/account-data/ActionRecommendationCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import {
  type InvestmentThresholds,
  LUCK_MULTIPLIERS,
  type LuckExpectation,
  tiers,
} from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import {
  type ActionType,
  type Recommendation,
  generateAllRecommendations,
} from "@/lib/account-data/recommendationEngine";
import { cn } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  ArrowBigUpDash,
  ArrowRightLeft,
  Dices,
  Info,
  PartyPopper,
  Pickaxe,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

interface RecommendationViewProps {
  scores: Record<string, ArtifactScoreResult>;
}

/** Sections shown within each tier, in display order. */
const SECTIONS: {
  key: ActionType | "free";
  labelKey: string;
  icon: typeof ArrowBigUpDash;
  color: string;
  actionTypes: ActionType[];
}[] = [
  {
    key: "free",
    labelKey: "accountData.insights.swap",
    icon: ArrowRightLeft,
    color: "text-sky-400",
    actionTypes: ["swap", "equip"],
  },
  {
    key: "upgrade",
    labelKey: "accountData.recTabs.upgrade",
    icon: ArrowBigUpDash,
    color: "text-emerald-400",
    actionTypes: ["upgrade"],
  },
  {
    key: "farm",
    labelKey: "accountData.recTabs.farm",
    icon: Pickaxe,
    color: "text-indigo-400",
    actionTypes: ["farm"],
  },
  {
    key: "reroll",
    labelKey: "accountData.recTabs.reroll",
    icon: Dices,
    color: "text-violet-400",
    actionTypes: ["reroll"],
  },
];

export function RecommendationView({ scores }: RecommendationViewProps) {
  const { t } = useLanguage();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const {
    tierAssignments,
    tierCustomization,
    setTierLuckExpectation,
    investmentThresholds,
    setInvestmentThreshold,
  } = useTierStore();
  const { config: scoreConfig } = useArtifactScoreStore();

  // Generate optimizer-based recommendations
  const allRecs = useMemo(() => {
    if (!accountData) return null;
    try {
      return generateAllRecommendations(
        accountData,
        scores,
        scoreConfig.global,
        tierAssignments,
        tierCustomization,
        investmentThresholds
      );
    } catch (e) {
      console.error("Recommendation engine error:", e);
      return null;
    }
  }, [
    accountData,
    scores,
    scoreConfig.global,
    tierAssignments,
    tierCustomization,
    investmentThresholds,
  ]);

  // Group all recommendations by tier, then by section
  const recsByTier = useMemo(() => {
    if (!allRecs) return {};
    const grouped: Record<string, Record<string, Recommendation[]>> = {};

    for (const tier of tiers) {
      grouped[tier] = {};
      for (const section of SECTIONS) {
        grouped[tier][section.key] = [];
      }
    }

    // Distribute all recommendations
    for (const charRecs of Object.values(allRecs.perCharacter)) {
      const tier = tierAssignments[charRecs.characterId]?.tier || "Pool";
      if (tier === "Pool") continue;
      if (!grouped[tier]) continue;

      for (const rec of charRecs.recommendations) {
        const section = SECTIONS.find((s) =>
          s.actionTypes.includes(rec.actionType)
        );
        if (section && grouped[tier][section.key]) {
          grouped[tier][section.key].push(rec);
        }
      }
    }

    // Sort each section by buildScoreDiff desc
    for (const tier of Object.keys(grouped)) {
      for (const sectionKey of Object.keys(grouped[tier])) {
        grouped[tier][sectionKey].sort(
          (a, b) => b.buildScoreDiff - a.buildScoreDiff
        );
      }
    }

    return grouped;
  }, [allRecs, tierAssignments]);

  if (!accountData) return null;

  // Check if there are any recommendations at all
  const hasAnyRecs = Object.values(recsByTier).some((tierSections) =>
    Object.values(tierSections).some((recs) => recs.length > 0)
  );

  return (
    <ScrollLayout className="space-y-8 pb-10 mt-2">
      {/* Investment threshold controls */}
      <Card className="bg-gradient-card shrink-0">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <CardTitle className="text-lg font-bold text-white pr-2 lg:pr-4 xl:pr-6">
            {t.ui("accountData.investmentLevel.label")}
          </CardTitle>
          {(
            [
              {
                key: "swap" as const,
                label: "accountData.insights.swap",
                icon: ArrowRightLeft,
                color: "text-sky-400",
              },
              {
                key: "upgrade" as const,
                label: "accountData.recTabs.upgrade",
                icon: ArrowBigUpDash,
                color: "text-emerald-400",
              },
              {
                key: "farm" as const,
                label: "accountData.recTabs.farm",
                icon: Pickaxe,
                color: "text-indigo-400",
              },
              {
                key: "reroll" as const,
                label: "accountData.recTabs.reroll",
                icon: Dices,
                color: "text-violet-400",
              },
            ] as const
          ).map(({ key, label, icon: ThIcon, color }) => (
            <div key={key} className="flex items-center gap-2">
              <ThIcon className={cn("w-4 h-4", color)} />
              <span className={cn("text-sm", color)}>{t.ui(label)}</span>
              <input
                type="text"
                inputMode="numeric"
                value={investmentThresholds[key]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v) && v >= 0 && v <= 30)
                    setInvestmentThreshold(key, v);
                }}
                className="w-10 bg-transparent border-b border-muted-foreground text-center text-sm font-mono font-bold text-foreground outline-none focus:border-primary"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {!hasAnyRecs && allRecs && (
        <div className="flex items-center justify-center gap-3 py-12">
          <div className="rounded-full bg-primary/20 w-10 h-10 flex items-center justify-center">
            <PartyPopper className="w-5 h-5 text-primary" />
          </div>
          <div className="text-foreground font-medium">
            {t.ui("accountData.recNoRecommendations")}
          </div>
        </div>
      )}

      {tiers.map((tier) => {
        if (tier === "Pool") return null;
        const customization = tierCustomization[tier];
        if (customization?.hidden) return null;

        const tierSections = recsByTier[tier];
        if (!tierSections) return null;

        const totalCount = Object.values(tierSections).reduce(
          (sum, recs) => sum + recs.length,
          0
        );
        if (totalCount === 0) return null;

        const displayName = customization?.displayName || t.tier(tier);
        const luckExpectation = customization?.luckExpectation || "balanced";

        return (
          <div key={tier} className="space-y-3">
            {/* Tier Header */}
            <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-2">
              <h2 className="text-2xl font-bold text-white pb-1">
                {displayName}
                <span className="text-base font-normal text-muted-foreground pl-2">
                  ({totalCount})
                </span>
              </h2>
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
            </div>

            {/* Sections within tier */}
            {SECTIONS.map(
              ({ key, labelKey, icon: SectionIcon, color: sectionColor }) => {
                const recs = tierSections[key];
                if (!recs || recs.length === 0) return null;

                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center gap-2 pl-1">
                      <SectionIcon className={cn("w-4 h-4", sectionColor)} />
                      <span
                        className={cn("text-sm font-semibold", sectionColor)}
                      >
                        {t.ui(labelKey)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({recs.length})
                      </span>
                    </div>
                    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                      {recs.map((rec) => (
                        <ActionRecommendationCard
                          key={`${rec.characterId}-${rec.slot}-${rec.actionType}`}
                          recommendation={rec}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        );
      })}

      {/* Pool tier info */}
      {(() => {
        const poolChars = accountData.characters.filter(
          (c) => (tierAssignments[c.key]?.tier || "Pool") === "Pool"
        );
        if (poolChars.length === 0) return null;
        const poolDisplayName =
          tierCustomization.Pool?.displayName || t.tier("Pool");
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-2">
              <h2 className="text-2xl font-bold text-white pb-1">
                {poolDisplayName}
              </h2>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-white/5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-sm text-muted-foreground">
                  {t.ui("accountData.insights.poolInfo")}
                </div>
                <Button asChild variant="outline">
                  <Link to="/tier-list">
                    {t.ui("accountData.insights.goToTierList")}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {poolChars.map((c) => {
                const charInfo = charactersById[c.key];
                if (!charInfo) return null;
                return (
                  <ItemIcon
                    key={c.key}
                    imagePath={charInfo.imagePath}
                    rarity={charInfo.rarity}
                    size="md"
                  />
                );
              })}
            </div>
          </div>
        );
      })()}
    </ScrollLayout>
  );
}
