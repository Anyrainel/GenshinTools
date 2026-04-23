import {
  ArrowBigUpDash,
  ArrowRight,
  ArrowRightLeft,
  CircleHelp,
  CirclePlus,
  Dices,
  Pickaxe,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { memo } from "react";
import { ArtifactComparisonHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/gameResources";
import type { ArtifactData } from "@/data/types";
import type { ScoreUpAction } from "@/lib/account-data/scoreUpEngine";
import { cn } from "@/lib/utils";

interface ScoreUpActionCardProps {
  recommendation: ScoreUpAction;
  /** Lookup map to resolve artifact IDs to real artifact data */
  artifactLookup: Map<string, ArtifactData>;
  tierColor?: string;
  /** When true, renders without character icon (used inside per-character cards) */
  inline?: boolean;
}

function getActionIcon(actionType: string) {
  switch (actionType) {
    case "equip":
      return { icon: CirclePlus, color: "text-teal-400", bg: "bg-teal-800/30" };
    case "swap":
      return {
        icon: ArrowRightLeft,
        color: "text-sky-400",
        bg: "bg-sky-800/30",
      };
    case "upgrade":
      return {
        icon: ArrowBigUpDash,
        color: "text-emerald-400",
        bg: "bg-emerald-800/30",
      };
    case "reroll":
      return { icon: Dices, color: "text-violet-400", bg: "bg-violet-800/30" };
    case "farm":
      return {
        icon: Pickaxe,
        color: "text-indigo-400",
        bg: "bg-indigo-800/30",
      };
    default:
      return { icon: CircleHelp, color: "text-gray-400", bg: "bg-gray-800/30" };
  }
}

function getBorderColor(scoreDiff: number): string {
  if (scoreDiff >= 15) return "border-l-tier-a";
  if (scoreDiff >= 10) return "border-l-tier-b";
  if (scoreDiff >= 6) return "border-l-tier-c";
  if (scoreDiff >= 3) return "border-l-tier-d";
  return "border-l-tier-pool";
}

function ScoreUpActionCardComponent({
  recommendation: rec,
  artifactLookup,
  tierColor,
  inline,
}: ScoreUpActionCardProps) {
  const { t } = useLanguage();
  const charInfo = charactersById[rec.characterId];
  if (!charInfo) return null;

  const { icon: Icon, color, bg } = getActionIcon(rec.actionType);
  const borderClass = tierColor ?? getBorderColor(rec.slotScoreDiff);

  // Resolve artifacts by ID
  const currentArtifact = rec.currentArtifactId
    ? (artifactLookup.get(rec.currentArtifactId) ?? null)
    : null;
  const sourceArtifact = rec.sourceArtifactId
    ? (artifactLookup.get(rec.sourceArtifactId) ?? null)
    : null;
  // Farm actions have no real source artifact — use the optimizer's synthetic ideal.
  const farmIdeal =
    rec.actionType === "farm" && rec.idealArtifact ? rec.idealArtifact : null;

  const isSwapLike =
    rec.actionType === "swap" ||
    rec.actionType === "equip" ||
    rec.actionType === "upgrade";

  const getPlaceholderIcon = () => {
    switch (rec.actionType) {
      case "farm":
        return CircleHelp;
      case "upgrade":
        return TrendingUp;
      case "reroll":
        return RefreshCw;
      default:
        return CircleHelp;
    }
  };
  const PlaceholderIcon = getPlaceholderIcon();

  const isUpgradeInPlace =
    rec.actionType === "upgrade" &&
    rec.sourceArtifactId === rec.currentArtifactId;

  const subtitle =
    rec.isSteal && rec.donorCharacterId
      ? t.format(
          "accountData.insights.fromCharacter",
          t.character(rec.donorCharacterId)
        )
      : isUpgradeInPlace
        ? t.ui("accountData.equipped")
        : (rec.actionType === "swap" || rec.actionType === "equip") &&
            !rec.donorCharacterId
          ? t.ui("accountData.insights.fromInventory")
          : "";

  const cardContent = (
    <div
      className={cn(
        "flex items-center py-2 px-2 rounded-md border-l-[4px] border-y border-r border-white/5 transition-colors bg-gradient-card cursor-pointer hover:bg-white/5 gap-2",
        borderClass
      )}
    >
      {/* Lead icon: character icon (standalone) or action icon circle (inline) */}
      {inline ? (
        <div
          className={cn(
            "rounded-full flex items-center justify-center shrink-0 w-8 h-8",
            bg,
            color
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      ) : (
        <ItemIcon characterId={rec.characterId} size="sm" />
      )}

      {/* Text content */}
      <div className="flex-1 min-w-0">
        {/* Row 1: score diff (inline) or character name + score diff (standalone) */}
        {inline ? (
          rec.slotScoreDiff > 0 && (
            <div className="flex items-baseline gap-1 italic font-extrabold tracking-tighter leading-none">
              <span className="text-lg leading-none bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                +{rec.slotScoreDiff.toFixed(1)}
              </span>
            </div>
          )
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              {t.character(rec.characterId)}
            </span>
            {rec.slotScoreDiff > 0 && (
              <span className="text-base italic font-extrabold tracking-tighter bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                +{rec.slotScoreDiff.toFixed(1)}
              </span>
            )}
          </div>
        )}
        {/* Row 2: Action label + slot */}
        <div className="flex items-center gap-1 mt-0.5">
          {!inline && <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />}
          <span className={cn("text-xs font-medium", color)}>
            {rec.actionType === "swap"
              ? t.ui("accountData.insights.swap")
              : rec.actionType === "upgrade"
                ? t.ui("accountData.insights.upgrade")
                : rec.actionType === "reroll"
                  ? t.ui("accountData.insights.reroll")
                  : rec.actionType === "farm"
                    ? t.ui("accountData.insights.farm")
                    : rec.actionType === "equip"
                      ? t.ui("common.equip")
                      : rec.actionType}
          </span>
          <span className="text-xs text-foreground">{t.slot(rec.slot)}</span>
        </div>
        {/* Row 3: Source label */}
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>

      {/* Artifact icons: before → after */}
      <div className="flex items-center gap-1 shrink-0">
        {rec.actionType === "equip" ? (
          <div className="flex items-center justify-center rounded-sm border-2 border-dashed border-white/10 w-12 h-12">
            <CirclePlus className="w-4 h-4 text-muted-foreground" />
          </div>
        ) : isSwapLike && currentArtifact ? (
          <ItemIcon
            artifactSetId={currentArtifact.setKey}
            slot={rec.slot}
            rarity={currentArtifact.rarity}
            lock={currentArtifact.lock}
            level={`+${currentArtifact.level}`}
            badge={currentArtifact.astralMark ? "⭐" : undefined}
            size="sm"
          />
        ) : currentArtifact ? (
          <ItemIcon
            artifactSetId={currentArtifact.setKey}
            slot={rec.slot}
            rarity={currentArtifact.rarity}
            lock={currentArtifact.lock}
            level={`+${currentArtifact.level}`}
            badge={currentArtifact.astralMark ? "⭐" : undefined}
            size="sm"
          />
        ) : (
          <div className="flex items-center justify-center rounded-sm border-2 border-dashed border-white/10 w-12 h-12">
            <CircleHelp className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
        {isSwapLike && sourceArtifact ? (
          <ItemIcon
            artifactSetId={sourceArtifact.setKey}
            slot={rec.slot}
            rarity={sourceArtifact.rarity}
            lock={sourceArtifact.lock}
            level={`+${sourceArtifact.level}`}
            badge={sourceArtifact.astralMark ? "⭐" : undefined}
            size="sm"
          />
        ) : farmIdeal ? (
          <ItemIcon
            artifactSetId={farmIdeal.setKey}
            slot={rec.slot}
            rarity={farmIdeal.rarity}
            lock={false}
            level={`+${farmIdeal.level}`}
            badge="❓"
            size="sm"
          />
        ) : (
          <div className="flex items-center justify-center w-12 h-12">
            <PlaceholderIcon className="w-7 h-7 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );

  // Wrap with hover card — only show real artifacts, never projected/synthetic data
  if (rec.actionType === "equip" && sourceArtifact) {
    return (
      <ArtifactComparisonHoverCard
        afterArtifact={sourceArtifact}
        slot={rec.slot}
      >
        {cardContent}
      </ArtifactComparisonHoverCard>
    );
  }

  if (isSwapLike && sourceArtifact) {
    return (
      <ArtifactComparisonHoverCard
        beforeArtifact={currentArtifact ?? undefined}
        afterArtifact={sourceArtifact}
        slot={rec.slot}
      >
        {cardContent}
      </ArtifactComparisonHoverCard>
    );
  }

  // Farm: compare current vs the synthetic farm candidate the optimizer used.
  if (farmIdeal) {
    return (
      <ArtifactComparisonHoverCard
        beforeArtifact={currentArtifact ?? undefined}
        afterArtifact={farmIdeal}
        slot={rec.slot}
      >
        {cardContent}
      </ArtifactComparisonHoverCard>
    );
  }

  // Reroll or missing source — show only the current artifact
  if (currentArtifact) {
    return (
      <ArtifactComparisonHoverCard
        beforeArtifact={currentArtifact}
        slot={rec.slot}
      >
        {cardContent}
      </ArtifactComparisonHoverCard>
    );
  }

  return cardContent;
}

export const ScoreUpActionCard = memo(ScoreUpActionCardComponent);
