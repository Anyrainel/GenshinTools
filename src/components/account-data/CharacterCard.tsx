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
import { artifactsById, charactersById, weaponsById } from "@/data/constants";
import type { CharacterData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  type ArtifactScoreResult,
  calculateArtifactScore,
} from "@/lib/artifactScore";
import { cn } from "@/lib/utils";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { Sword } from "lucide-react";
import { memo } from "react";
import { StatDisplay } from "./StatDisplay";

interface CharacterCardProps {
  char: CharacterData;
  score?: ArtifactScoreResult;
}

function CharacterCardComponent({ char, score }: CharacterCardProps) {
  const { t } = useLanguage();
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const { config: scoreConfig } = useArtifactScoreStore();
  const charInfo = charactersById[char.key];
  if (!charInfo) return null; // Should not happen if conversion is correct

  const weapon = char.weapon;
  const weaponInfo = weapon ? weaponsById[weapon.key] : null;
  const weaponName = weapon ? t.weaponName(weapon.key) : null;

  // Use provided score or calculate on the fly (fallback)
  const artifactScore = score || calculateArtifactScore(char, scoreConfig);

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

  return (
    <Card className="flex flex-col bg-gradient-card border-border/50 transition-colors overflow-hidden">
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
          {/* Character Icon - No Tooltip */}
          <ItemIcon
            imagePath={charInfo.imagePath}
            rarity={charInfo.rarity}
            badge={char.constellation}
            size={isVeryNarrow ? "lg" : "xl"}
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <CharacterInfo
              character={charInfo}
              showDate={false}
              className="gap-1"
              nameClassName={isVeryNarrow ? "text-base" : undefined}
            >
              {!isVeryNarrow && (
                <div className="flex-1 flex items-center gap-2 text-muted-foreground text-sm min-w-0">
                  <span className="flex-shrink-0">Lv.{char.level}</span>
                  <div className="flex-[1]" />
                  <span className="flex-shrink-0 flex items-center gap-3 overflow-hidden text-ellipsis whitespace-nowrap">
                    <span>
                      {isMobile ? "A" : t.ui("accountData.talents.auto")}{" "}
                      <span className="text-foreground">{talents.auto}</span>
                    </span>
                    <span>
                      {isMobile ? "E" : t.ui("accountData.talents.skill")}{" "}
                      <span className="text-foreground">{talents.skill}</span>
                    </span>
                    <span>
                      {isMobile ? "Q" : t.ui("accountData.talents.burst")}{" "}
                      <span className="text-foreground">{talents.burst}</span>
                    </span>
                  </span>
                  <div className="flex-[3]" />
                  {weapon && (
                    <span className="flex-shrink-0">Lv.{weapon.level}</span>
                  )}
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
                    size={isVeryNarrow ? "lg" : "xl"}
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
                          "font-semibold text-gray-200 hover:text-primary transition-colors leading-tight block truncate",
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
        {artifactScore.isComplete && (
          <div className="flex flex-col items-end leading-none mr-2">
            <span
              className={cn(
                "text-muted-foreground uppercase font-bold tracking-wider mb-0.5",
                isVeryNarrow ? "text-xs" : "text-base"
              )}
            >
              {t.ui("accountData.score")}
            </span>
            <ArtifactScoreHoverCard
              score={artifactScore}
              className={cn(
                "italic tracking-tighter",
                isVeryNarrow ? "text-2xl font-extrabold" : "text-3xl font-black"
              )}
              compact={isVeryNarrow}
            />
          </div>
        )}
      </div>

      {/* Artifacts Body */}
      <CardContent className="p-0 bg-black/15">
        <div className="grid grid-cols-5 divide-x divide-border/20 px-0.5">
          {["flower", "plume", "sands", "goblet", "circlet"].map((slot) => {
            const art = char.artifacts?.[slot as keyof typeof char.artifacts];

            // Determine if main stat is "wrong" for this character
            // (only for sands/goblet/circlet where main stat choice matters)
            const isMainStatWrong =
              art &&
              ["sands", "goblet", "circlet"].includes(slot) &&
              (artifactScore.statScores[art.mainStatKey]?.weight ?? 0) === 0;

            const content = (
              <div
                className={cn(
                  "flex flex-col relative transition-colors",
                  isVeryNarrow ? "p-0.5" : "p-2",
                  art ? "group hover:bg-white/5" : "opacity-30"
                )}
              >
                {art ? (
                  <StatDisplay
                    artifact={art}
                    scoreResult={artifactScore}
                    slotSubScore={artifactScore.slotSubScores[slot]}
                    slotMaxSubScore={artifactScore.slotMaxSubScores[slot]}
                    isMainStatWrong={isMainStatWrong}
                    compact={isVeryNarrow}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-sm text-muted-foreground/50 text-center px-1">
                      {t.ui(`computeFilters.${slot}`)}
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
