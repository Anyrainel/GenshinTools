import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById } from "@/data/constants";
import type { MainStatPlus, SetConfig, SlotConfig } from "@/data/types";
import { computeSlotChance } from "@/lib/artifactChance";
import { useMemo } from "react";

import { ItemIcon } from "@/components/shared/ItemIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertOctagon, AlertTriangle } from "lucide-react";

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
      <Label className="text-sm text-muted-foreground block mb-1">
        {slotName} {t.ui("computeFilters.mainStat")}
      </Label>
      <div className="flex flex-wrap gap-1">
        {mainStats.length > 0 ? (
          mainStats.map((stat) => (
            <Badge
              key={stat}
              variant="outline"
              className="font-normal shadow-none text-sm bg-slate-500/10 border-slate-500/30 text-slate-300 hover:bg-slate-500/10"
            >
              {getStatDisplayName(stat)}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground italic">
            {t.ui("computeFilters.any")}
          </span>
        )}
      </div>
    </div>
  );

  // Helper function to render substat cell
  const renderSubstatCell = (slotName: string, slotConfig: SlotConfig) => (
    <div>
      <Label className="text-sm text-muted-foreground block mb-1">
        {slotName} {t.ui("computeFilters.subStat")}{" "}
        <span className="font-semibold text-foreground">
          [{t.ui("computeFilters.atLeast")} {slotConfig.minStatCount}]
        </span>
      </Label>
      <div className="flex flex-wrap gap-1">
        {slotConfig.substats.map((stat) => {
          const isMustPresent = slotConfig.mustPresent.includes(stat);
          return (
            <Badge
              key={stat}
              variant="secondary"
              className={`font-normal shadow-none text-sm ${
                isMustPresent
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/15"
                  : "bg-slate-500/10 border-slate-500/30 text-slate-300 hover:bg-slate-500/10"
              }`}
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
    const warningThreshold = 0.1;
    const dangerThreshold = 0.2;

    if (chance >= dangerThreshold) {
      return {
        textClass: "text-destructive",
        Icon: AlertOctagon,
        message: t.ui("computeFilters.highPassChance"),
      };
    }

    if (chance >= warningThreshold) {
      return {
        textClass: "text-amber-500 dark:text-amber-400",
        Icon: AlertTriangle,
        message: t.ui("computeFilters.moderatePassChance"),
      };
    }

    return {
      textClass: "text-foreground",
      Icon: null,
      message: "",
    };
  };

  const renderChanceCell = (slotName: string, detail: ChanceDetail) => {
    const renderChanceRow = (
      label: string,
      chance: number,
      indicator: ReturnType<typeof getChanceIndicator>
    ) => {
      const { textClass, Icon, message } = indicator;
      const content = (
        <>
          {Icon && (
            <Icon className={`h-3.5 w-3.5 ${textClass}`} aria-hidden="true" />
          )}
          {formatChance(chance)}
        </>
      );

      return (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {Icon && message ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`text-sm flex items-center gap-1 cursor-help ${textClass}`}
                >
                  {content}
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="center"
                className="text-xs max-w-xs"
              >
                {message}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className={`text-sm flex items-center gap-1 ${textClass}`}>
              {content}
            </div>
          )}
        </div>
      );
    };

    const baseIndicator = getChanceIndicator(detail.base);
    const showTightened =
      detail.base > 0.1 && detail.tightened !== null && detail.tightenedLabel;

    return (
      <div className="rounded-md bg-muted/50 mr-3 px-3 py-1.5 space-y-1">
        {renderChanceRow(
          t.ui("computeFilters.passChance"),
          detail.base,
          baseIndicator
        )}
        {showTightened &&
          renderChanceRow(
            detail.tightenedLabel!,
            detail.tightened!,
            getChanceIndicator(detail.tightened!)
          )}
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
          alt={t.character(character.id)}
        />
      </div>
    );
  };

  return (
    <div className="p-3 bg-muted/20 rounded-lg border border-border/30">
      {/* Title row with config number and character groups */}
      <div className="flex gap-3 mb-1.5">
        <h4 className="self-center font-medium text-foreground px-2">
          {t.ui("computeFilters.configurationNumber")} {configNumber}
        </h4>

        <Label className="self-end text-sm text-muted-foreground pb-0.5">
          {t.ui("computeFilters.for")}
        </Label>

        {/* Character groups */}
        <div className="flex-1 flex items-end gap-x-5 gap-y-1 text-sm">
          {/* 4pc group */}
          {(fourPcPerfect.length > 0 || fourPcImperfect.length > 0) && (
            <div className="flex gap-1.5">
              {fourPcPerfect.map(renderCharacter)}
              {fourPcPerfect.length > 0 && fourPcImperfect.length > 0 && (
                <div className="w-px bg-border self-stretch mx-0.5" />
              )}
              {fourPcImperfect.map(renderCharacter)}
              <Label className="self-end text-sm text-muted-foreground mx-0.5 pb-0.5">
                ({t.ui("computeFilters.fourPc")})
              </Label>
            </div>
          )}

          {/* 2pc group */}
          {(twoPcPerfect.length > 0 || twoPcImperfect.length > 0) && (
            <div className="flex items-end gap-1.5">
              {twoPcPerfect.map(renderCharacter)}
              {twoPcPerfect.length > 0 && twoPcImperfect.length > 0 && (
                <div className="w-px bg-border self-stretch mx-0.5" />
              )}
              {twoPcImperfect.map(renderCharacter)}
              <Label className="self-end text-sm text-muted-foreground mx-0.5 pb-0.5">
                ({t.ui("computeFilters.twoPc")})
              </Label>
            </div>
          )}
        </div>
      </div>

      {/* Grid layout with explicit rows - 3 rows per column */}
      <div
        className="grid grid-cols-4 gap-x-3 gap-y-2 pt-2 border-t border-border/40"
        style={{ gridTemplateRows: "auto auto auto" }}
      >
        {/* Row 1: Main Stats */}
        <div /> {/* Flower/Plume - empty */}
        {renderMainStatCell(
          t.ui("computeFilters.sands"),
          config.sands.mainStats
        )}
        {renderMainStatCell(
          t.ui("computeFilters.goblet"),
          config.goblet.mainStats
        )}
        {renderMainStatCell(
          t.ui("computeFilters.circlet"),
          config.circlet.mainStats
        )}
        {/* Row 2: Substats */}
        {renderSubstatCell(
          `${t.ui("computeFilters.flower")}/${t.ui("computeFilters.plume")}`,
          config.flowerPlume
        )}
        {renderSubstatCell(t.ui("computeFilters.sands"), config.sands)}
        {renderSubstatCell(t.ui("computeFilters.goblet"), config.goblet)}
        {renderSubstatCell(t.ui("computeFilters.circlet"), config.circlet)}
        {/* Row 3: Chances */}
        {renderChanceCell(
          `${t.ui("computeFilters.flower")}/${t.ui("computeFilters.plume")}`,
          slotChanceDetails.flowerPlume
        )}
        {renderChanceCell(
          t.ui("computeFilters.sands"),
          slotChanceDetails.sands
        )}
        {renderChanceCell(
          t.ui("computeFilters.goblet"),
          slotChanceDetails.goblet
        )}
        {renderChanceCell(
          t.ui("computeFilters.circlet"),
          slotChanceDetails.circlet
        )}
      </div>
    </div>
  );
}
