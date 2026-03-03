import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
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
import { artifactsById, charactersById, weaponsById } from "@/data/constants";
import type { CharacterData, MainStatSlot, Slot, SubStat } from "@/data/types";
import { allSlots } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ArtifactScoreResult } from "@/lib/account-data/artifactScore";
import { cn } from "@/lib/utils";
import { Sword } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router-dom";
import { StatDisplay } from "./StatDisplay";

interface CharacterCardProps {
  char: CharacterData;
  score: ArtifactScoreResult;
}

function CharacterCardComponent({ char, score }: CharacterCardProps) {
  const { t } = useLanguage();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  // At 2xl (1536–2047px), cards are in 2 columns and ~514px wide — use compact artifacts
  const is2xlCompact = useMediaQuery(
    "(min-width: 1536px) and (max-width: 2047px)"
  );
  const isArtifactCompact = isVeryNarrow || is2xlCompact;
  const charInfo = charactersById[char.key];
  if (!charInfo) return null;

  const weapon = char.weapon;
  const weaponInfo = weapon ? weaponsById[weapon.key] : null;

  // Score must be pre-calculated
  const artifactScore = score;
  if (!artifactScore) return null;

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
          <Link to={`/archive?tab=characters&character=${char.key}`}>
            <ItemIcon
              imagePath={charInfo.imagePath}
              rarity={charInfo.rarity}
              badge={char.constellation}
              level={`Lv. ${char.level}`}
              size={isVeryNarrow ? "md" : "lg"}
            />
          </Link>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <CharacterInfo
              character={charInfo}
              showDate={false}
              className="gap-1"
              nameClassName={isVeryNarrow ? "text-base" : undefined}
            >
              {!isVeryNarrow && (
                <div className="ml-2 flex flex-shrink-0 items-center gap-3 text-muted-foreground text-sm overflow-hidden text-ellipsis whitespace-nowrap">
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

          {/* Weapon Icon */}
          <Tooltip>
            {/* ... tooltip trigger ... */}
            <TooltipTrigger asChild>
              {weapon && weaponInfo ? (
                <div className="cursor-help flex-shrink-0">
                  <ItemIcon
                    imagePath={weaponInfo.imagePath}
                    rarity={weaponInfo.rarity}
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
          "bg-black/20 border-b border-border/20 flex flex-wrap gap-y-2 min-h-[56px] items-center justify-between",
          isVeryNarrow ? "px-1.5 gap-x-2" : "px-4 gap-x-6"
        )}
      >
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          {activeSets.length > 0 ? (
            activeSets.map(([setKey, count]) => (
              <Tooltip key={setKey}>
                <TooltipTrigger className="flex items-center gap-2 cursor-help">
                  <ItemIcon
                    imagePath={artifactsById[setKey]?.imagePaths.flower || ""}
                    rarity={artifactsById[setKey]?.rarity || 5}
                    size={isVeryNarrow ? "sm" : "md"}
                  />
                  <div className="flex flex-col items-start">
                    {/* Hide set name in compact mode for 2-piece sets to save space */}
                    {(!isVeryNarrow || count >= 4) && (
                      <span
                        className={cn(
                          "font-semibold text-gray-200 leading-tight block truncate",
                          isVeryNarrow ? "text-xs max-w-[160px]" : "text-base"
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
        {artifactScore.substatScore.isComplete && (
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
              ["sands", "goblet", "circlet"].includes(slot) &&
              (artifactScore.buildMatch
                ? artifactScore.buildMatch.mainStatMismatches.some(
                    (m) => m.slot === (slot as MainStatSlot)
                  )
                : (artifactScore.substatScore.statScores[
                    art.mainStatKey as SubStat
                  ]?.weight ?? 0) === 0);

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
                    scoreResult={artifactScore}
                    slotSubScore={
                      artifactScore.substatScore.slotSubScores[slot as Slot]
                    }
                    slotMaxSubScore={
                      artifactScore.substatScore.slotMaxSubScores[slot as Slot]
                    }
                    isMainStatWrong={isMainStatWrong}
                    compact={isArtifactCompact}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-sm text-muted-foreground/50 text-center px-1">
                      {t.slot(slot)}
                    </div>
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
