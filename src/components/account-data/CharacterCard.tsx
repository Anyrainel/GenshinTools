import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { charInfo as charInfoData } from "@/data/charInfo";
import { charactersById, weaponsById } from "@/data/constants";
import type { CharacterData, MainStatSlot, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { cn } from "@/lib/utils";
import { Pencil, Sword } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";
import { StatDisplay } from "./StatDisplay";

/** Pre-computed layout flags, hoisted to the parent to avoid per-card useMediaQuery hooks. */
export interface CardLayout {
  isMobile: boolean;
  isVeryNarrow: boolean;
  isArtifactCompact: boolean;
}

/** Default layout for single-card usage (e.g. archive detail panel). */
const DEFAULT_LAYOUT: CardLayout = {
  isMobile: false,
  isVeryNarrow: false,
  isArtifactCompact: false,
};

interface CharacterCardProps {
  char: CharacterData;
  score?: ArtifactScoreResult | null;
  onEdit?: () => void;
  /** Pass pre-computed layout to avoid per-card useMediaQuery overhead in lists. */
  layout?: CardLayout;
}

function CharacterCardComponent({
  char,
  score,
  onEdit,
  layout = DEFAULT_LAYOUT,
}: CharacterCardProps) {
  const { t } = useLanguage();
  const { isMobile, isVeryNarrow, isArtifactCompact } = layout;
  const charInfo = charactersById[char.key];
  if (!charInfo) return null;

  const weapon = char.weapon;
  const weaponInfo = weapon ? weaponsById[weapon.key] : null;

  const artifactScore = score ?? null;

  // Set Bonus Logic
  const setCounts: Record<string, number> = {};
  for (const a of Object.values(char.artifacts || {})) {
    if (a) {
      setCounts[a.setKey] = (setCounts[a.setKey] || 0) + 1;
    }
  }

  const activeSets = Object.entries(setCounts)
    .filter((entry) => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1]);

  const talents = char.talent || { auto: 1, skill: 1, burst: 1 };

  const charInfoDataData = charInfoData[char.key];
  const getTalentPlus = (talent: "A" | "E" | "Q") => {
    let plus = 0;
    if (charInfoDataData) {
      if (charInfoDataData.c3Talent === talent && char.constellation >= 3)
        plus += 3;
      if (charInfoDataData.c5Talent === talent && char.constellation >= 5)
        plus += 3;
    }
    return plus;
  };
  const plusAuto = getTalentPlus("A");
  const plusSkill = getTalentPlus("E");
  const plusBurst = getTalentPlus("Q");

  return (
    <Card className="flex flex-col bg-gradient-card border-border/50 transition-colors overflow-hidden max-w-3xl mx-auto">
      {/* Header */}
      <div
        className={cn(
          "flex flex-col gap-2 bg-gradient-select border-b border-border/40",
          isVeryNarrow ? "p-1.5" : "p-3"
        )}
      >
        {/* Top Row: Icon + Name/Badges + Weapon */}
        <div
          className={cn("flex items-center", isVeryNarrow ? "gap-2" : "gap-3")}
        >
          {/* Character Icon — links to archive */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={`/archive/characters?character=${char.key}`}>
                <ItemIcon
                  characterId={char.key}
                  badge={char.constellation}
                  level={`Lv. ${char.level}`}
                  size={isVeryNarrow ? "md" : "lg"}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={char.key} />
            </TooltipContent>
          </Tooltip>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <CharacterInfo
              character={charInfo}
              showDate={false}
              className="gap-1"
              nameClassName={isVeryNarrow ? "text-base" : undefined}
            >
              {!isVeryNarrow && (
                <div className="3xl:ml-2 flex flex-shrink-0 items-center gap-1.5 text-muted-foreground text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                  <span>
                    {isMobile ? "A" : t.ui("accountData.talents.auto")}{" "}
                    <span className="text-foreground/90">
                      {talents.auto}
                      {plusAuto > 0 && (
                        <span className="text-foreground/90">+{plusAuto}</span>
                      )}
                    </span>
                  </span>
                  <span>
                    {isMobile ? "E" : t.ui("accountData.talents.skill")}{" "}
                    <span className="text-foreground/90">{talents.skill}</span>
                    {plusSkill > 0 && (
                      <span className="text-foreground/90">+{plusSkill}</span>
                    )}
                  </span>
                  <span>
                    {isMobile ? "Q" : t.ui("accountData.talents.burst")}{" "}
                    <span className="text-foreground/90">{talents.burst}</span>
                    {plusBurst > 0 && (
                      <span className="text-foreground/90">+{plusBurst}</span>
                    )}
                  </span>
                </div>
              )}
            </CharacterInfo>
          </div>

          {/* Edit Button */}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/20 hover:bg-primary/30 border border-primary/20 flex items-center justify-center transition-colors self-end mb-1 z-10"
            >
              <Pencil className="w-3.5 h-3.5 text-primary drop-shadow-sm" />
            </button>
          )}

          {/* Weapon Icon */}
          <Tooltip>
            {/* ... tooltip trigger ... */}
            <TooltipTrigger asChild>
              {weapon && weaponInfo ? (
                <div className="cursor-help flex-shrink-0">
                  <ItemIcon
                    weaponId={weapon.key}
                    badge={weapon.refinement}
                    level={`Lv. ${weapon.level}`}
                    size={isVeryNarrow ? "md" : "lg"}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center opacity-30 cursor-help flex-shrink-0">
                  <Sword className="w-6 h-6" />
                </div>
              )}
            </TooltipTrigger>
            {weapon && weaponInfo && (
              <TooltipContent
                side="left"
                className="p-0 border-none bg-transparent"
              >
                <WeaponTooltip weaponId={weapon.key} />
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* Artifact Sets Row */}
      <div
        className={cn(
          "bg-black/20 border-b border-border/20 flex min-h-[56px] items-center overflow-hidden",
          isVeryNarrow ? "px-1.5 gap-x-2" : "px-4 gap-x-4"
        )}
      >
        <div className="flex flex-1 min-w-0 items-center gap-x-4">
          {activeSets.length > 0 ? (
            activeSets.map(([setKey, count]) => (
              <Tooltip key={setKey}>
                <TooltipTrigger className="flex flex-1 min-w-0 items-center gap-2 cursor-help">
                  <ItemIcon
                    artifactSetId={setKey}
                    size={isVeryNarrow ? "sm" : "md"}
                    className="shrink-0"
                  />
                  <div className="flex flex-col items-start min-w-0">
                    {/* Hide set name in compact mode for 2-piece sets to save space */}
                    {(!isVeryNarrow || count >= 4) && (
                      <span
                        className={cn(
                          "font-semibold text-gray-200 leading-tight block truncate max-w-full",
                          isVeryNarrow ? "text-xs" : "text-base"
                        )}
                      >
                        {t.artifact(setKey)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-muted-foreground font-mono leading-tight",
                        isVeryNarrow ? "text-[10px]" : "text-base"
                      )}
                    >
                      {count >= 4
                        ? t.ui("accountData.fourPiece")
                        : t.ui("accountData.twoPiece")}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="p-0 border-none bg-transparent"
                >
                  <ArtifactTooltip
                    setId={setKey}
                    hideFourPieceEffect={count < 4}
                  />
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <span className="text-muted-foreground italic text-base pl-1">
              {t.ui("accountData.noSetBonus")}
            </span>
          )}
        </div>

        {/* Artifact Score */}
        {(artifactScore == null || artifactScore.substatScore.subScore > 0) && (
          <ArtifactScoreHoverCard
            score={artifactScore}
            characterId={char.key}
            className="leading-none mr-2"
            compact={isVeryNarrow}
          />
        )}
      </div>

      {/* Artifacts Body */}
      <CardContent className="p-0 bg-black/10">
        <div className="grid grid-cols-5 divide-x divide-border/20 px-0.5">
          {allSlots.map((slot) => {
            const art = char.artifacts?.[slot as keyof typeof char.artifacts];

            // Determine if main stat is "wrong" for this character
            // Uses build match result for accurate detection
            const isMainStatWrong =
              art &&
              artifactScore &&
              ["sands", "goblet", "circlet"].includes(slot) &&
              artifactScore.buildMatch?.mainStatMismatches?.some(
                (m) => m.slot === (slot as MainStatSlot)
              );

            const content = (
              <div
                className={cn(
                  "flex flex-col relative transition-colors",
                  isArtifactCompact ? "p-1" : "p-2",
                  art ? "group hover:bg-white/5" : "opacity-30"
                )}
              >
                {art ? (
                  <StatDisplay
                    artifact={art}
                    scoreResult={artifactScore ?? undefined}
                    slotSubScore={
                      artifactScore?.substatScore.slotSubScores[slot as Slot]
                    }
                    slotMaxSubScore={
                      artifactScore?.substatScore.slotMaxSubScores[slot as Slot]
                    }
                    isMainStatWrong={isMainStatWrong ?? undefined}
                    compact={isArtifactCompact}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-1",
                      isArtifactCompact ? "min-h-[100px]" : "min-h-[136px]"
                    )}
                  >
                    <span className="text-sm text-muted-foreground font-medium">
                      {t.slot(slot)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t.ui("accountData.unequipped")}
                    </span>
                  </div>
                )}
              </div>
            );

            return <div key={slot}>{content}</div>;
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Memoize to prevent re-renders - CharacterCard is rendered for each character in the list
export const CharacterCard = memo(CharacterCardComponent);
