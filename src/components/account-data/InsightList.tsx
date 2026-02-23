import { ArtifactComparisonHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ArtifactIcon } from "@/components/shared/ArtifactIcon";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { artifactsById } from "@/data/constants";
import type { ArtifactData, Slot } from "@/data/types";
import type { Insight, InsightType } from "@/lib/account-data/insightEngine";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowBigUpDash,
  ArrowRight,
  ArrowRightLeft,
  CircleHelp,
  Dices,
  PartyPopper,
  Pickaxe,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

interface InsightListProps {
  insights: Insight[];
  isComplete?: boolean;
  compact?: boolean;
}

// Get left border color based on score diff - uses tier colors for semantic urgency
// FIX_MAIN gets S tier (red), then A→B→C→D→Pool for high→low score diff
function getScoreDiffBorderColor(
  scoreDiff: number | undefined,
  type: InsightType
): string {
  // FIX_MAIN always uses S tier (red) border
  if (type === "FIX_MAIN") return "border-l-tier-s";

  if (scoreDiff === undefined || scoreDiff <= 0) return "border-l-tier-pool";

  // Map score diff to tier colors (shifted: A→B→C→D→Pool)
  if (scoreDiff >= 15) return "border-l-tier-a"; // A tier - highest gain
  if (scoreDiff >= 10) return "border-l-tier-b"; // B tier
  if (scoreDiff >= 6) return "border-l-tier-c"; // C tier
  if (scoreDiff >= 3) return "border-l-tier-d"; // D tier
  return "border-l-tier-pool"; // Pool - lowest gain
}

export function InsightList({ insights, isComplete }: InsightListProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  // Show warning for incomplete artifact sets
  if (isComplete === false) {
    return (
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-amber-500/10">
        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t.ui("accountData.insights.incomplete")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.ui("accountData.insights.incompleteDescription")}
          </div>
        </div>
      </div>
    );
  }

  // Show celebration for no suggestions
  if (!insights.length) {
    return (
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-primary/10">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <PartyPopper className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t.ui("accountData.insights.allGood")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t.ui("accountData.insights.allGoodDescription")}
          </div>
        </div>
      </div>
    );
  }

  const showCollapseControls = insights.length > 2;
  const visibleInsights =
    showCollapseControls && !expanded ? insights.slice(0, 2) : insights;

  return (
    <div className="flex flex-col gap-1 pt-1 pb-3 px-3 border-t border-white/5">
      {/* Section Label */}
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {t.ui("accountData.insights.title")}
      </div>
      <div className="flex flex-col gap-2">
        {/* Cards + Button - unified gap */}
        {visibleInsights.map((insight, idx) => (
          <InsightItem key={idx} insight={insight} />
        ))}
        {showCollapseControls && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-3 py-1.5 transition-colors"
          >
            {expanded
              ? t.ui("accountData.insights.showLess")
              : t.format("accountData.insights.showMore", insights.length - 2)}
          </button>
        )}
      </div>
    </div>
  );
}

// Helper to get reroll cost based on slot
function getRerollCost(slot: Slot): number {
  return slot === "flower" || slot === "plume" ? 1 : 2;
}

// Helper to get craft cost based on slot
function getCraftCost(slot: Slot): number {
  switch (slot) {
    case "flower":
    case "plume":
      return 1;
    case "sands":
      return 2;
    case "circlet":
      return 3;
    case "goblet":
      return 4;
    default:
      return 1;
  }
}
// Score display component - combines score diff and efficiency in a fancy display
// Uses the same amber/gold gradient and italic style as ArtifactScoreHoverCard
function ScoreGainDisplay({
  scoreDiff,
  efficiencyPercent,
}: {
  scoreDiff: number;
  efficiencyPercent: number | null;
}) {
  return (
    <div className="flex items-baseline gap-1 italic font-extrabold tracking-tighter leading-none">
      <span className="text-lg leading-none bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
        +{scoreDiff.toFixed(1)}
      </span>
      {efficiencyPercent !== null && (
        <span className="text-base leading-none bg-gradient-to-br from-amber-100/70 via-orange-300/70 to-amber-500/70 bg-clip-text text-transparent">
          ({efficiencyPercent}%)
        </span>
      )}
    </div>
  );
}

function InsightItem({ insight }: { insight: Insight }) {
  const { t } = useLanguage();

  // Get insight type styling (icon, color, iconBg, label, subtitle)
  // Colors: emerald=growth, sky=exchange, violet=chance, stone=effort, rose=warning
  const {
    icon: Icon,
    color,
    iconBg,
    label,
    subtitle,
  } = useMemo(() => {
    switch (insight.type) {
      case "UPGRADE":
        return {
          icon: ArrowBigUpDash,
          color: "text-emerald-400",
          iconBg: "bg-emerald-800/30",
          label: t.ui("accountData.insights.upgrade"),
          subtitle: insight.isEquipped
            ? t.ui("accountData.insights.equipped")
            : insight.isSteal && insight.donorCharacterId
              ? t.format(
                  "accountData.insights.fromCharacter",
                  t.character(insight.donorCharacterId)
                )
              : t.ui("accountData.insights.fromInventory"),
        };
      case "SWAP":
        return {
          icon: ArrowRightLeft,
          color: insight.isSteal ? "text-orange-400" : "text-sky-400",
          iconBg: insight.isSteal ? "bg-orange-800/30" : "bg-sky-800/30",
          label: t.ui("accountData.insights.swap"),
          subtitle:
            insight.isSteal && insight.donorCharacterId
              ? t.format(
                  "accountData.insights.fromCharacter",
                  t.character(insight.donorCharacterId)
                )
              : t.ui("accountData.insights.fromInventory"),
        };
      case "REROLL":
        return {
          icon: Dices,
          color: "text-violet-400",
          iconBg: "bg-violet-800/30",
          label: t.ui("accountData.insights.reroll"),
          subtitle: t.format(
            "accountData.insights.rerollCost",
            getRerollCost(insight.slot)
          ),
        };
      case "FARM": {
        const showCraftSubtitle = insight.artifact?.rarity === 5;
        return {
          icon: Pickaxe,
          color: "text-indigo-400",
          iconBg: "bg-indigo-800/30",
          label: t.ui("accountData.insights.farm"),
          subtitle: showCraftSubtitle
            ? t.format(
                "accountData.insights.farmOrCraft",
                getCraftCost(insight.slot)
              )
            : "",
        };
      }
      case "FIX_MAIN":
        return {
          icon: AlertTriangle,
          color: "text-rose-400",
          iconBg: "bg-rose-800/30",
          label: t.ui("accountData.insights.fixMain"),
          subtitle: "",
        };
      default:
        return {
          icon: ArrowBigUpDash,
          color: "text-gray-400",
          iconBg: "bg-gray-800/30",
          label: "Action",
          subtitle: "",
        };
    }
  }, [insight, t]);

  // Left border color based on score diff (uses tier colors)
  const borderClass = getScoreDiffBorderColor(insight.scoreDiff, insight.type);

  // Use efficiencyDiff from insight engine (already calculated as scoreDiff / maxPotentialScore)
  const efficiencyPercent = useMemo(() => {
    if (insight.efficiencyDiff !== undefined && insight.efficiencyDiff > 0) {
      return Math.round(insight.efficiencyDiff * 100);
    }
    return null;
  }, [insight.efficiencyDiff]);

  // Handle non-artifact cases
  if (!insight.artifact) return null;

  const artInfo = artifactsById[insight.artifact.setKey];

  // Determine if this is a swap/replacement scenario (has both before and after artifacts)
  const hasSwap =
    insight.type === "SWAP" ||
    (insight.type === "UPGRADE" && !insight.isEquipped);

  const compareArtInfo = insight.compareArtifact
    ? artifactsById[insight.compareArtifact.setKey]
    : null;

  // Determine placeholder icon for "after" state when no compareArtifact exists
  // - FARM: question mark (unknown new artifact)
  // - UPGRADE (equipped): trending up (same artifact, leveled up)
  // - REROLL: refresh (same artifact, re-rolled substats)
  const getPlaceholderIcon = () => {
    switch (insight.type) {
      case "FARM":
        return CircleHelp;
      case "UPGRADE":
        return TrendingUp;
      case "REROLL":
        return RefreshCw;
      default:
        return CircleHelp;
    }
  };

  const PlaceholderIcon = getPlaceholderIcon();
  const showPlaceholder = !hasSwap;

  // The unified card content - always shows before → after pattern
  const cardContent = (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-2 rounded-md border-l-[4px] border-y border-r border-white/5 transition-colors text-sm bg-gradient-card cursor-pointer hover:bg-white/5",
        borderClass
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          iconBg,
          color
        )}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Text Info - 3-Row Layout */}
      <div className="flex-1 min-w-0">
        {/* Row 1: Score Display */}
        {insight.scoreDiff !== undefined && insight.scoreDiff > 0 && (
          <ScoreGainDisplay
            scoreDiff={insight.scoreDiff}
            efficiencyPercent={efficiencyPercent}
          />
        )}
        {/* Row 2: Title */}
        <div className="text-base font-semibold text-foreground">
          {label} {t.slot(insight.slot)}
        </div>
        {/* Row 3: Subtitle */}
        {subtitle && (
          <div className="text-xs text-muted-foreground truncate">
            {subtitle}
          </div>
        )}
      </div>

      {/* Artifact Icons: always show before → after */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Before Artifact (current equipped or the one being replaced) */}
        {hasSwap && insight.compareArtifact && compareArtInfo ? (
          <ArtifactIcon
            artifact={insight.compareArtifact}
            artInfo={compareArtInfo}
            slot={insight.slot}
          />
        ) : (
          <ArtifactIcon
            artifact={insight.artifact}
            artInfo={artInfo}
            slot={insight.slot}
          />
        )}
        {/* Arrow */}
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        {/* After: new artifact or placeholder icon */}
        {hasSwap ? (
          <ArtifactIcon
            artifact={insight.artifact}
            artInfo={artInfo}
            slot={insight.slot}
          />
        ) : (
          <div className="w-14 h-14 flex items-center justify-center">
            <PlaceholderIcon className="w-10 h-10 text-muted-foreground/50" />
          </div>
        )}
      </div>
    </div>
  );

  // Always wrap with ArtifactComparisonHoverCard
  // For swap: compareArtifact → artifact
  // For others (FARM, UPGRADE-equipped, REROLL): artifact → placeholder
  const hasComparisonTarget = !!insight.compareArtifact;

  return (
    <ArtifactComparisonHoverCard
      artifact={
        hasComparisonTarget ? insight.compareArtifact! : insight.artifact
      }
      compareArtifact={hasComparisonTarget ? insight.artifact : undefined}
      slot={insight.slot}
    >
      {cardContent}
    </ArtifactComparisonHoverCard>
  );
}
