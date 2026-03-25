import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { MainStatPlus, SetConfig, SlotConfig } from "@/data/types";
import { computeSlotChance } from "@/lib/artifact-builds/artifactChance";
import { hasCrCdMustPresent } from "@/lib/artifact-builds/computeFilters";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

import { ItemIcon } from "@/components/shared/ItemIcon";
import { Info } from "lucide-react";

interface ArtifactConfigCardProps {
  config: SetConfig;
  configNumber: number;
  onJumpToCharacter: (characterId: string) => void;
}

export function ArtifactConfigCard({
  config,
  configNumber,
  onJumpToCharacter,
}: ArtifactConfigCardProps) {
  const { t } = useLanguage();

  const getStatDisplayName = (stat: string) => {
    return t.statShort(stat);
  };

  const getCharacterById = (id: string) => {
    return charactersById[id];
  };

  type SlotKey = "flowerPlume" | "sands" | "goblet" | "circlet";

  type ChanceDetail = {
    base: number;
    tightened: number | null;
    tightenedLabel: string | null;
  };
  const slotChanceDetails = useMemo(() => {
    const getDetail = (slot: SlotKey, slotConfig: SlotConfig): ChanceDetail => {
      const base = computeSlotChance(slot, slotConfig);
      const maxMinCount = Math.min(4, slotConfig.substats.length);
      let tightened: number | null = null;
      let tightenedLabel: string | null = null;
      if (slotConfig.minStatCount < maxMinCount) {
        const tightenedConfig: SlotConfig = {
          ...slotConfig,
          minStatCount: slotConfig.minStatCount + 1,
        };
        tightened = computeSlotChance(slot, tightenedConfig);
        tightenedLabel = `${t.ui("computeFilters.passChance")} (${t.ui(
          "computeFilters.atLeast"
        )} ${tightenedConfig.minStatCount})`;
      }
      return { base, tightened, tightenedLabel };
    };

    return {
      flowerPlume: getDetail("flowerPlume", config.flowerPlume),
      sands: getDetail("sands", config.sands),
      goblet: getDetail("goblet", config.goblet),
      circlet: getDetail("circlet", config.circlet),
    };
  }, [config, t]);

  // Helper function to render main stat cell
  const renderMainStatCell = (slotName: string, mainStats: MainStatPlus[]) => (
    <div>
      <Label className="text-muted-foreground block mb-1 text-[11px] md:text-xs">
        {slotName} {t.ui("computeFilters.mainStat")}
      </Label>
      <div className="flex flex-wrap gap-1">
        {mainStats.length > 0 ? (
          mainStats.map((stat) => (
            <Badge
              key={stat}
              variant="outline"
              className="font-normal shadow-none bg-slate-500/10 border-slate-500/30 text-slate-300 hover:bg-slate-500/10 text-[11px] md:text-xs px-1 md:px-2.5 py-0 md:py-0.5"
            >
              {getStatDisplayName(stat)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground italic text-[11px] md:text-xs">
            {t.ui("computeFilters.any")}
          </span>
        )}
      </div>
    </div>
  );

  // Helper function to render substat cell
  const renderSubstatCell = (slotName: string, slotConfig: SlotConfig) => (
    <div>
      <Label className="text-muted-foreground block mb-1 text-[11px] md:text-xs">
        {slotName} {t.ui("computeFilters.subStat")}{" "}
        <span className="font-semibold text-foreground">
          [{t.ui("computeFilters.atLeast")} {slotConfig.minStatCount}]
        </span>
      </Label>
      <div className="flex flex-wrap gap-1">
        {/* Must-have stats first, then optional (hide optional when mustPresent >= k) */}
        {[...slotConfig.substats]
          .filter((stat) =>
            slotConfig.mustPresent.length >= slotConfig.minStatCount
              ? slotConfig.mustPresent.includes(stat)
              : true
          )
          .sort((a, b) => {
            const aMust = slotConfig.mustPresent.includes(a) ? 0 : 1;
            const bMust = slotConfig.mustPresent.includes(b) ? 0 : 1;
            return aMust - bMust;
          })
          .map((stat) => {
            const isMustPresent = slotConfig.mustPresent.includes(stat);
            return (
              <Badge
                key={stat}
                variant="secondary"
                className={cn(
                  "font-normal shadow-none text-[11px] md:text-xs px-1 md:px-2.5 py-0 md:py-0.5",
                  isMustPresent
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/15"
                    : "bg-slate-500/10 border-slate-500/30 text-slate-300 hover:bg-slate-500/10"
                )}
              >
                {getStatDisplayName(stat)}
              </Badge>
            );
          })}
      </div>
    </div>
  );

  const formatChance = (chance: number): string => {
    if (!Number.isFinite(chance)) {
      return "—";
    }
    return `${(chance * 100).toFixed(chance < 0.01 ? 2 : 1)}%`;
  };

  const getChanceIndicator = (chance: number) => {
    if (chance >= 0.2) return { textClass: "text-destructive" };
    if (chance >= 0.1)
      return { textClass: "text-amber-500 dark:text-amber-400" };
    return { textClass: "text-foreground" };
  };

  const renderChanceCell = (_slotName: string, detail: ChanceDetail) => {
    const { textClass } = getChanceIndicator(detail.base);
    const label = t.ui("computeFilters.passChance");
    const value = formatChance(detail.base);

    return (
      <div className="rounded-md bg-muted/50 px-1 md:px-2 py-0.5 md:py-1 md:mr-3">
        {/* Mobile: stacked */}
        <div className="space-y-0.5 md:hidden">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className={cn("text-xs font-medium", textClass)}>{value}</div>
        </div>
        {/* Desktop: inline */}
        <div className="hidden md:flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn("text-sm font-medium", textClass)}>{value}</div>
        </div>
      </div>
    );
  };

  // Group characters by 4pc/2pc and perfect/imperfect merge
  const fourPcPerfect = config.servedCharacters.filter(
    (c) => c.has4pcBuild && c.hasPerfectMerge
  );
  const fourPcImperfect = config.servedCharacters.filter(
    (c) => c.has4pcBuild && !c.hasPerfectMerge
  );
  const twoPcPerfect = config.servedCharacters.filter(
    (c) => !c.has4pcBuild && c.hasPerfectMerge
  );
  const twoPcImperfect = config.servedCharacters.filter(
    (c) => !c.has4pcBuild && !c.hasPerfectMerge
  );

  const renderCharacter = (charInfo: (typeof config.servedCharacters)[0]) => {
    const character = getCharacterById(charInfo.characterId);
    if (!character) return null;

    return (
      <div
        key={charInfo.characterId}
        className="cursor-pointer hover:scale-110 transition-transform"
        onClick={() => onJumpToCharacter(charInfo.characterId)}
        title={t.character(character.id)}
      >
        <ItemIcon
          imagePath={character.imagePath}
          rarity={character.rarity}
          size="sm"
        />
      </div>
    );
  };

  return (
    <div className="bg-muted/20 rounded-lg border border-border/30 px-1.5 py-2 md:p-3">
      {/* Title row with config number and character groups */}
      <div className="flex flex-wrap items-center mb-1.5 gap-1.5 md:gap-3">
        <h4 className="font-medium text-foreground whitespace-nowrap text-sm md:text-base px-1 md:px-2">
          {t.ui("computeFilters.configNum")} {configNumber}
        </h4>

        {/* Character groups */}
        <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm min-w-0">
          <Label className="text-sm text-muted-foreground hidden md:block">
            {t.ui("computeFilters.for")}
          </Label>

          {/* 4pc group */}
          {(fourPcPerfect.length > 0 || fourPcImperfect.length > 0) && (
            <div className="flex items-center gap-1 md:gap-1.5">
              {fourPcPerfect.map(renderCharacter)}
              {fourPcPerfect.length > 0 && fourPcImperfect.length > 0 && (
                <div className="w-px bg-border h-5 mx-0.5" />
              )}
              {fourPcImperfect.map(renderCharacter)}
              <Label className="text-muted-foreground mx-0.5 whitespace-nowrap shrink-0 text-xs md:text-sm">
                ({t.ui("computeFilters.fourPc")})
              </Label>
            </div>
          )}

          {/* 2pc group */}
          {(twoPcPerfect.length > 0 || twoPcImperfect.length > 0) && (
            <div className="flex items-center gap-1 md:gap-1.5">
              {twoPcPerfect.map(renderCharacter)}
              {twoPcPerfect.length > 0 && twoPcImperfect.length > 0 && (
                <div className="w-px bg-border h-5 mx-0.5" />
              )}
              {twoPcImperfect.map(renderCharacter)}
              <Label className="text-muted-foreground mx-0.5 whitespace-nowrap shrink-0 text-xs md:text-sm">
                ({t.ui("computeFilters.twoPc")})
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Grid layout - Always 4 columns */}
      <div
        className="grid grid-cols-4 pt-2 border-t border-border/40 gap-x-1.5 md:gap-x-3 gap-y-1 md:gap-y-2"
        style={{ gridTemplateRows: "auto auto auto" }}
      >
        {/* Row 1: Main Stats */}
        {/* Flower/Plume cell — reused for optional config tip */}
        {hasCrCdMustPresent(config) ? (
          <div className="flex items-center gap-1 w-fit self-start rounded-md bg-emerald-950/30 text-emerald-300/70 text-[10px] md:text-xs px-1 md:px-2 py-0.5 md:py-1">
            <Info className="w-3 h-3 shrink-0" />
            <span className="leading-tight">
              {t.ui("computeFilters.optionalConfig")}
            </span>
          </div>
        ) : (
          <div />
        )}
        {renderMainStatCell(t.slot("sands"), config.sands.mainStats)}
        {renderMainStatCell(t.slot("goblet"), config.goblet.mainStats)}
        {renderMainStatCell(t.slot("circlet"), config.circlet.mainStats)}
        {/* Row 2: Substats */}
        {renderSubstatCell(
          `${t.slot("flower")}/${t.slot("plume")}`,
          config.flowerPlume
        )}
        {renderSubstatCell(t.slot("sands"), config.sands)}
        {renderSubstatCell(t.slot("goblet"), config.goblet)}
        {renderSubstatCell(t.slot("circlet"), config.circlet)}
        {/* Row 3: Chances */}
        {renderChanceCell(
          `${t.slot("flower")}/${t.slot("plume")}`,
          slotChanceDetails.flowerPlume
        )}
        {renderChanceCell(t.slot("sands"), slotChanceDetails.sands)}
        {renderChanceCell(t.slot("goblet"), slotChanceDetails.goblet)}
        {renderChanceCell(t.slot("circlet"), slotChanceDetails.circlet)}
      </div>
    </div>
  );
}
