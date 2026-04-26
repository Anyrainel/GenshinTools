import {
  ArrowBigUpDash,
  ArrowRight,
  ArrowRightLeft,
  CircleHelp,
  CirclePlus,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";
import { memo } from "react";
import { ArtifactComparisonHoverCard } from "@/components/shared/ArtifactDataHoverCard";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Slot } from "@/data/enums";
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

function ArtifactMiniIcon({
  artifact,
  slot,
  placeholder,
}: {
  artifact: ArtifactData | null;
  slot: Slot;
  placeholder?: ReactNode;
}) {
  if (!artifact) {
    return (
      <div className="flex items-center justify-center rounded-sm border-2 border-dashed border-white/10 w-12 h-12">
        {placeholder ?? (
          <CircleHelp className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <ItemIcon
      artifactSetId={artifact.setKey}
      slot={slot}
      rarity={artifact.rarity}
      lock={artifact.lock}
      level={`+${artifact.level}`}
      badge={artifact.astralMark ? "⭐" : undefined}
      size="sm"
    />
  );
}

function ArtifactTransition({
  before,
  after,
  slot,
  emptyBefore,
  placeholder,
}: {
  before: ArtifactData | null;
  after: ArtifactData | null;
  slot: Slot;
  emptyBefore?: boolean;
  placeholder?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <ArtifactMiniIcon
        artifact={emptyBefore ? null : before}
        slot={slot}
        placeholder={<CirclePlus className="w-4 h-4 text-muted-foreground" />}
      />
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <ArtifactMiniIcon
        artifact={after}
        slot={slot}
        placeholder={placeholder}
      />
    </div>
  );
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
  const swapCurrentArtifact = rec.swapCurrentArtifactId
    ? (artifactLookup.get(rec.swapCurrentArtifactId) ?? null)
    : null;
  const swapArtifact = rec.swapArtifactId
    ? (artifactLookup.get(rec.swapArtifactId) ?? null)
    : null;
  const isSwapLike =
    rec.actionType === "swap" ||
    rec.actionType === "equip" ||
    rec.actionType === "upgrade";
  const isCompoundUpgrade =
    rec.actionType === "upgrade" && !!rec.swapSlot && !!rec.swapArtifactId;

  const PlaceholderIcon =
    rec.actionType === "upgrade" ? TrendingUp : CircleHelp;

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
  const showSubtitle = !!subtitle && !inline;
  const primaryActionLabel =
    rec.actionType === "swap"
      ? t.ui("accountData.insights.swap")
      : rec.actionType === "upgrade"
        ? t.ui("accountData.insights.upgrade")
        : rec.actionType === "equip"
          ? t.ui("common.equip")
          : rec.actionType;

  const cardContent = (
    <div
      className={cn(
        "flex flex-col py-2 px-2 rounded-md border-l-[4px] border-y border-r border-white/5 transition-colors bg-gradient-card cursor-pointer hover:bg-white/5 gap-1.5",
        borderClass
      )}
    >
      {/* Top row: lead + score diff + action labels, left-aligned */}
      <div className="flex items-center gap-1.5">
        {inline ? (
          <div
            className={cn(
              "rounded-full flex items-center justify-center shrink-0 w-6 h-6",
              bg,
              color
            )}
          >
            <Icon className="w-3 h-3" />
          </div>
        ) : (
          <ItemIcon characterId={rec.characterId} size="sm" />
        )}

        {inline ? (
          <span className="text-lg italic font-extrabold tracking-tighter leading-none bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
            {rec.slotScoreDiff > 0 ? "+" : ""}
            {rec.slotScoreDiff.toFixed(1)}
          </span>
        ) : (
          <>
            <span className="text-sm font-semibold text-foreground">
              {t.character(rec.characterId)}
            </span>
            {rec.slotScoreDiff > 0 && (
              <span className="text-base italic font-extrabold tracking-tighter bg-gradient-to-br from-amber-100 via-orange-300 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                +{rec.slotScoreDiff.toFixed(1)}
              </span>
            )}
            <Icon className={cn("w-3.5 h-3.5 shrink-0", color)} />
          </>
        )}

        <span className={cn("text-xs font-medium", color)}>
          {primaryActionLabel}
        </span>
        <span className="text-xs text-foreground">{t.slot(rec.slot)}</span>

        {isCompoundUpgrade && rec.swapSlot && (
          <>
            <span className="text-xs font-medium text-sky-400">
              {t.ui("accountData.insights.swap")}
            </span>
            <span className="text-xs text-foreground">
              {t.slot(rec.swapSlot)}
            </span>
          </>
        )}

        {showSubtitle && (
          <span className="text-xs text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Bottom row: artifact transitions, centered, both on same line for compound */}
      <div className="flex items-center justify-center gap-6">
        {isCompoundUpgrade && rec.swapSlot ? (
          <>
            <ArtifactTransition
              before={currentArtifact}
              after={sourceArtifact}
              slot={rec.slot}
              placeholder={
                <PlaceholderIcon className="w-7 h-7 text-muted-foreground" />
              }
            />
            <ArtifactTransition
              before={swapCurrentArtifact}
              after={swapArtifact}
              slot={rec.swapSlot}
              placeholder={
                <CircleHelp className="w-4 h-4 text-muted-foreground" />
              }
            />
          </>
        ) : (
          <ArtifactTransition
            before={currentArtifact}
            after={isSwapLike ? sourceArtifact : null}
            slot={rec.slot}
            emptyBefore={rec.actionType === "equip"}
            placeholder={
              <PlaceholderIcon className="w-7 h-7 text-muted-foreground" />
            }
          />
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

  if (isCompoundUpgrade && sourceArtifact && rec.swapSlot) {
    return (
      <ArtifactComparisonHoverCard
        beforeArtifact={currentArtifact ?? undefined}
        afterArtifact={sourceArtifact}
        slot={rec.slot}
        comparisonRows={[
          {
            beforeArtifact: currentArtifact ?? undefined,
            afterArtifact: sourceArtifact,
            slot: rec.slot,
            currentLabel: t.ui("accountData.current"),
            upgradeLabel: t.ui("accountData.insights.upgrade"),
          },
          {
            beforeArtifact: swapCurrentArtifact ?? undefined,
            afterArtifact: swapArtifact ?? undefined,
            slot: rec.swapSlot,
            currentLabel: t.ui("accountData.current"),
            upgradeLabel: t.ui("accountData.insights.swap"),
          },
        ]}
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

  // Missing source — show only the current artifact
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
