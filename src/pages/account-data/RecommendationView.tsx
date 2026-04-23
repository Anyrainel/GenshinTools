import {
  ArrowBigUpDash,
  ArrowRightLeft,
  Dices,
  Info,
  Pickaxe,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AccountDataNeedsBothState } from "@/components/account-data/AccountDataNeedsBothState";
import { ScoreUpCard } from "@/components/account-data/ScoreUpCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LuckExpectation } from "@/data/enums";
import { LUCK_MULTIPLIERS, tiers } from "@/data/enums";
import { charactersById } from "@/data/gameResources";
import type { CharacterData } from "@/data/types";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  buildArtifactLookup,
  generateAllRecommendations,
  type ScoreUpAction,
} from "@/lib/account-data/scoreUpEngine";
import type { ArtifactScoreResult } from "@/lib/artifact/scoring/artifactScore";
import { cn } from "@/lib/utils";
import { useTierStore } from "@/stores/useTierStore";

// Height model for masonry layout (measured px values)
const CARD_GAP = 16; // gap-4
const HEIGHT = {
  compact: { empty: 146, base: 102, perRec: 83 },
  normal: { empty: 155, base: 111, perRec: 83 },
} as const;

function estimateCardHeight(recCount: number, compact: boolean): number {
  const h = compact ? HEIGHT.compact : HEIGHT.normal;
  if (recCount === 0) return h.empty;
  return h.base + recCount * h.perRec;
}

function computeMasonryColumns<T>(
  items: T[],
  getHeight: (item: T) => number,
  columnCount: number
): T[][] {
  if (columnCount <= 1) return [items];
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights: number[] = new Array(columnCount).fill(0);

  for (const item of items) {
    let minIdx = 0;
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[minIdx]) minIdx = i;
    }
    columns[minIdx].push(item);
    heights[minIdx] += getHeight(item) + CARD_GAP;
  }

  return columns;
}

function ThresholdInput({
  label,
  icon: ThIcon,
  color,
  value,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayed = draft ?? String(value);

  return (
    <div className="flex items-center gap-2">
      <ThIcon className={cn("w-4 h-4", color)} />
      <span className={cn("text-sm", color)}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={displayed}
        onChange={(e) => {
          const raw = e.target.value;
          // Allow empty while editing
          if (raw === "") {
            setDraft("");
            return;
          }
          const v = Number(raw);
          if (!Number.isNaN(v) && v >= 0 && v <= 99) {
            setDraft(raw);
            onChange(v);
          }
        }}
        onBlur={() => {
          // Commit empty → 0
          if (draft === "") onChange(0);
          setDraft(null);
        }}
        className="w-10 bg-transparent border-b border-muted-foreground text-center text-sm font-mono font-bold text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

interface RecommendationViewProps {
  scores: Record<string, ArtifactScoreResult | null>;
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function RecommendationView({
  scores,
  onOpenImport,
  onShowTour,
}: RecommendationViewProps) {
  const { t } = useLanguage();
  const accountData = useActiveAccountData();
  const buildGroups = useAllResolvedBuilds();
  const hasAnyBuilds = buildGroups.some((g) => g.builds.some((b) => b.visible));
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const tierCustomization = useTierStore((s) => s.tierCustomization);
  const setTierLuckExpectation = useTierStore((s) => s.setTierLuckExpectation);
  const investmentThresholds = useTierStore((s) => s.investmentThresholds);
  const setInvestmentThreshold = useTierStore((s) => s.setInvestmentThreshold);
  // Generate optimizer-based recommendations
  const allRecs = useMemo(() => {
    if (!accountData) return null;
    try {
      return generateAllRecommendations(
        accountData,
        scores,
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
    tierAssignments,
    tierCustomization,
    investmentThresholds,
  ]);

  // Build artifact lookup for resolving recommendation artifact IDs
  const artifactLookup = useMemo(
    () => (accountData ? buildArtifactLookup(accountData) : new Map()),
    [accountData]
  );

  // Group characters by tier, sorted by max recommendation impact
  const charactersByTier = useMemo(() => {
    if (!accountData || !allRecs) return {};

    const byTier: Record<
      string,
      {
        char: CharacterData;
        scoreResult: ArtifactScoreResult;
        recommendations: ScoreUpAction[];
      }[]
    > = {};
    for (const tier of tiers) {
      byTier[tier] = [];
    }

    for (const char of accountData.characters) {
      const scoreResult = scores[char.key];
      if (!scoreResult) continue;

      const assignment = tierAssignments[char.key];
      const tier = assignment ? assignment.tier : "Pool";

      const charRecs = allRecs.perCharacter[char.key];
      const recommendations = charRecs?.actions ?? [];

      if (!byTier[tier]) {
        if (!byTier.Pool) byTier.Pool = [];
        byTier.Pool.push({ char, scoreResult, recommendations });
      } else {
        byTier[tier].push({ char, scoreResult, recommendations });
      }
    }

    // Sort by max buildScoreDiff (highest improvement potential first)
    for (const tier of Object.keys(byTier)) {
      byTier[tier].sort((a, b) => {
        const aMax = Math.max(
          0,
          ...a.recommendations.map((r) => r.buildScoreDiff)
        );
        const bMax = Math.max(
          0,
          ...b.recommendations.map((r) => r.buildScoreDiff)
        );
        return bMax - aMax;
      });
    }

    return byTier;
  }, [accountData, scores, tierAssignments, allRecs]);

  const isSm = useMediaQuery("(min-width: 640px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const is2xl = useMediaQuery("(min-width: 1536px)");
  const isCompact = !isMd;
  const columnCount = is2xl ? 4 : isXl ? 3 : isLg ? 3 : isSm ? 2 : 1;

  if (!accountData || !hasAnyBuilds) {
    return (
      <ScrollLayout>
        <AccountDataNeedsBothState
          needsAccountData={!accountData}
          needsBuilds={!hasAnyBuilds}
          onOpenImport={onOpenImport}
          onShowTour={onShowTour}
        />
      </ScrollLayout>
    );
  }

  const hasRankedChars = tiers.some(
    (tier) =>
      tier !== "Pool" &&
      !tierCustomization[tier]?.hidden &&
      (charactersByTier[tier]?.length ?? 0) > 0
  );

  return (
    <ScrollLayout bodyClassName="space-y-4">
      {hasRankedChars ? (
        /* Investment threshold controls */
        <Card className="bg-gradient-card shrink-0">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <div className="flex items-center gap-2 pr-2 lg:pr-4 xl:pr-6">
              <CardTitle className="text-lg font-bold text-white">
                {t.ui("accountData.investmentLevel.label")}
              </CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="bottom"
                  align="start"
                  className="w-80 space-y-2 text-sm"
                >
                  <p className="font-semibold text-foreground">
                    {t.ui("accountData.howItWorks.title")}
                  </p>
                  <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                    <li>{t.ui("accountData.howItWorks.step1")}</li>
                    <li>{t.ui("accountData.howItWorks.step2")}</li>
                    <li>{t.ui("accountData.howItWorks.step3")}</li>
                    <li>{t.ui("accountData.howItWorks.step4")}</li>
                  </ul>
                </PopoverContent>
              </Popover>
            </div>
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
                  label: "accountData.insights.upgrade",
                  icon: ArrowBigUpDash,
                  color: "text-emerald-400",
                },
                {
                  key: "farm" as const,
                  label: "accountData.insights.farm",
                  icon: Pickaxe,
                  color: "text-indigo-400",
                },
                {
                  key: "reroll" as const,
                  label: "accountData.insights.reroll",
                  icon: Dices,
                  color: "text-violet-400",
                },
              ] as const
            ).map(({ key, label, icon: ThIcon, color }) => (
              <ThresholdInput
                key={key}
                label={t.ui(label)}
                icon={ThIcon}
                color={color}
                value={investmentThresholds[key]}
                onChange={(v) => setInvestmentThreshold(key, v)}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center">
            <Info className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t.ui("accountData.noRankedChars")}
          </p>
          <Button asChild variant="outline">
            <Link to="/tier-list/characters">
              {t.ui("accountData.insights.goToTierList")}
            </Link>
          </Button>
        </div>
      )}

      {tiers.map((tier) => {
        if (tier === "Pool") return null;
        const customization = tierCustomization[tier];
        if (customization?.hidden) return null;

        const chars = charactersByTier[tier] || [];
        if (chars.length === 0) return null;

        const displayName = customization?.displayName || t.tier(tier);
        const luckExpectation = customization?.luckExpectation || "balanced";

        return (
          <div key={tier} className="space-y-3">
            {/* Tier Header */}
            <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-2">
              <h2 className="text-2xl font-bold text-white pb-1">
                {displayName}
                <span className="text-base font-normal text-muted-foreground pl-2">
                  ({chars.length})
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

            {/* Per-character cards — masonry layout */}
            {(() => {
              const cols = computeMasonryColumns(
                chars,
                (c) => estimateCardHeight(c.recommendations.length, isCompact),
                columnCount
              );
              return (
                <div className="flex gap-4">
                  {cols.map((col, i) => (
                    <div key={i} className="flex-1 flex flex-col gap-4 min-w-0">
                      {col.map(({ char, scoreResult, recommendations }) => (
                        <ScoreUpCard
                          key={char.key}
                          char={char}
                          tier={tier}
                          recommendations={recommendations}
                          score={scoreResult}
                          artifactLookup={artifactLookup}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
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
                  <Link to="/tier-list/characters">
                    {t.ui("accountData.insights.goToTierList")}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {poolChars.map((c) => {
                const charInfo = charactersById[c.key];
                if (!charInfo) return null;
                return <ItemIcon key={c.key} characterId={c.key} size="md" />;
              })}
            </div>
          </div>
        );
      })()}

      {/* Hint: recommendations are quick suggestions */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {t
          .ui("accountData.hint")
          .split("{0}")
          .map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <Link
                  to="/team-comp/damage"
                  className="underline text-foreground hover:text-primary"
                >
                  {t.ui("accountData.hintDamageLink")}
                </Link>
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
      </p>
    </ScrollLayout>
  );
}
