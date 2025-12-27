import { CharacterData } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { charactersById, weaponsById, artifactsById } from "@/data/constants";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { StatDisplay } from "./StatDisplay";
import { Sword } from "lucide-react";
import {
  calculateArtifactScore,
  ArtifactScoreResult,
} from "@/lib/artifactScore";
import { ArtifactScoreHoverCard } from "@/components/account-data/ArtifactScoreHoverCard";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";

interface CharacterCardProps {
  char: CharacterData;
  score?: ArtifactScoreResult;
}

export const CharacterCard = ({ char, score }: CharacterCardProps) => {
  const { t } = useLanguage();
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
  Object.values(char.artifacts || {}).forEach((a) => {
    if (a) {
      setCounts[a.setKey] = (setCounts[a.setKey] || 0) + 1;
    }
  });

  const activeSets = Object.entries(setCounts)
    .filter((entry) => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1]);

  const talents = char.talent || { auto: 1, skill: 1, burst: 1 };

  return (
    <Card className="flex flex-col bg-card/40 border-border/50 transition-colors overflow-hidden">
      {/* Header */}
      <div className="flex flex-col p-3 gap-2 bg-black/40 border-b border-border/40">
        {/* Top Row: Icon + Name/Badges + Weapon */}
        <div className="flex items-start gap-3">
          {/* Character Icon - No Tooltip */}
          <ItemIcon
            imagePath={charInfo.imagePath}
            rarity={charInfo.rarity}
            label={`C${char.constellation}`}
            size="w-16 h-16" // Match character size
            className="rounded-lg shadow-md flex-shrink-0"
          />

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[4rem]">
            <CharacterInfo
              character={charInfo}
              showDate={false}
              className="gap-1"
              nameClassName="text-xl"
            />
          </div>

          {/* Weapon Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              {weapon && weaponInfo ? (
                <div className="cursor-help flex-shrink-0">
                  <ItemIcon
                    imagePath={weaponInfo.imagePath}
                    rarity={weaponInfo.rarity}
                    label={`R${weapon.refinement}`}
                    size="w-16 h-16" // Match character size
                    className="rounded-lg shadow-md"
                    alt={weaponName || ""}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center opacity-30 cursor-help flex-shrink-0">
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

        {/* Bottom Row: Levels & Talents */}
        <div className="flex items-center gap-3">
          <div className="w-16 text-center text-sm text-muted-foreground leading-none flex-shrink-0">
            Lv.{char.level}
          </div>

          <div className="flex-1 flex items-center justify-start px-2 gap-3 text-xs text-muted-foreground leading-none overflow-hidden">
            <span className="truncate">
              {t.ui("accountData.talents.auto")}: {talents.auto}
            </span>
            <span className="truncate">
              {t.ui("accountData.talents.skill")}: {talents.skill}
            </span>
            <span className="truncate">
              {t.ui("accountData.talents.burst")}: {talents.burst}
            </span>
          </div>

          <div className="w-16 flex-shrink-0 flex justify-center">
            {weapon ? (
              <span className="w-full text-center text-sm text-muted-foreground leading-none">
                Lv.{weapon.level}
              </span>
            ) : (
              <div className="w-full" />
            )}
          </div>
        </div>
      </div>

      {/* Artifact Sets Row */}
      <div className="px-3 py-2 bg-black/10 border-b border-border/20 flex flex-wrap gap-x-6 gap-y-2 min-h-[56px] items-center justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          {activeSets.length > 0 ? (
            activeSets.map(([setKey, count]) => (
              <Tooltip key={setKey}>
                <TooltipTrigger className="flex items-center gap-2 cursor-help">
                  <ItemIcon
                    imagePath={artifactsById[setKey]?.imagePaths.flower || ""}
                    rarity={artifactsById[setKey]?.rarity || 5}
                    size="w-10 h-10"
                    className="border border-white/10 shadow-sm"
                  />
                  <div className="flex flex-col items-start">
                    <span
                      className={cn(
                        "text-base font-semibold text-gray-200 hover:text-primary transition-colors leading-tight",
                      )}
                    >
                      {t.artifact(setKey)}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono leading-tight">
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
            <span className="text-muted-foreground italic text-xs pl-1">
              {t.ui("accountData.noSetBonus")}
            </span>
          )}
        </div>

        {/* Artifact Score */}
        {artifactScore.isComplete && (
          <div className="flex flex-col items-end leading-none mr-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">
              {t.ui("accountData.score")}
            </span>
            <ArtifactScoreHoverCard
              score={artifactScore}
              className="text-2xl font-black italic tracking-tighter"
            />
          </div>
        )}
      </div>

      {/* Artifacts Body */}
      <CardContent className="p-0 bg-black/10">
        <div className="grid grid-cols-5 divide-x divide-border/20">
          {["flower", "plume", "sands", "goblet", "circlet"].map((slot) => {
            const art = char.artifacts?.[slot as keyof typeof char.artifacts];

            const content = (
              <div
                className={cn(
                  "flex flex-col p-2 relative transition-colors",
                  art ? "group hover:bg-white/5" : "opacity-30",
                )}
              >
                {art ? (
                  <StatDisplay artifact={art} scoreResult={artifactScore} />
                ) : (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground/50 text-center px-1">
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
};
