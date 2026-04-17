import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon, type ItemIconSize } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  LightweightSelect,
  LightweightSelectContent,
  LightweightSelectItem,
  LightweightSelectTrigger,
  LightweightSelectValue,
} from "@/components/ui/lightweight-select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { charactersById, weaponsById } from "@/data/constants";
import type { WeaponResource } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import type { AnalyzerCharConfig } from "@/lib/team-comp/analyzer/types";
import type { TeamSlotConfig } from "@/lib/team-comp/types";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  CARD_BODY_CLS,
  CARD_CLS,
  CARD_HEADER_CLS,
  CARD_TITLE_CLS,
} from "./cardStyles";

// ─── Helpers ───

function getArtifactIconProps(bc: TeamSlotConfig): {
  artifactSetId?: string;
  halfSetIds?: [string, string];
  imagePath?: string;
} {
  if (bc.artifactSetId) {
    return { artifactSetId: bc.artifactSetId };
  }
  if (bc.artifactHalfSetIds.length >= 2) {
    return {
      halfSetIds: [bc.artifactHalfSetIds[0], bc.artifactHalfSetIds[1]],
    };
  }
  return { imagePath: "" };
}

// ─── Props ───

interface AnalyzerConfigCardProps {
  charConfigs: AnalyzerCharConfig[];
  configs: TeamSlotConfig[];
  onUpdateWeapon: (
    charId: string,
    star: "4" | "5",
    weaponId: string | null
  ) => void;
  onUpdateStart: (
    charId: string,
    field: "startConstellation" | "startRefinement",
    value: number
  ) => void;
  onUpdateMax: (
    charId: string,
    field: "maxConstellation" | "maxRefinement",
    value: number
  ) => void;
  charIconSize: ItemIconSize;
  subIconSize: ItemIconSize;
}

// ─── Main Card ───

export function AnalyzerConfigCard({
  charConfigs,
  configs,
  onUpdateWeapon,
  onUpdateStart,
  onUpdateMax,
  charIconSize,
  subIconSize,
}: AnalyzerConfigCardProps) {
  const { t } = useLanguage();

  return (
    <Card className={CARD_CLS}>
      <CardHeader className={cn(CARD_HEADER_CLS, "py-2")}>
        <span className={CARD_TITLE_CLS}>
          <Users className="w-4 h-4 opacity-70" />
          {t.ui("teamComp.teamRoster")}
        </span>
      </CardHeader>
      <CardContent className={CARD_BODY_CLS}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-2">
          {charConfigs.map((cfg) => {
            const bc = configs.find((b) => b.charId === cfg.charId);
            if (!bc) return null;
            return (
              <div
                key={cfg.charId}
                className="flex flex-col rounded-lg bg-black/10 border border-border/10 p-1 gap-1 xl:p-2"
              >
                <CharConfigGroup
                  config={cfg}
                  baseConfig={bc}
                  onUpdateWeapon={onUpdateWeapon}
                  charIconSize={charIconSize}
                  subIconSize={subIconSize}
                />
                <CharStartSelectors
                  config={cfg}
                  onUpdateStart={onUpdateStart}
                />
                <CharMaxSelectors config={cfg} onUpdateMax={onUpdateMax} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Per-character group: [char] [artifact] [4★wep] [5★wep] ───

function CharConfigGroup({
  config,
  baseConfig,
  onUpdateWeapon,
  charIconSize = "sm",
  subIconSize = "xs",
}: {
  config: AnalyzerCharConfig;
  baseConfig: TeamSlotConfig;
  onUpdateWeapon: (
    charId: string,
    star: "4" | "5",
    weaponId: string | null
  ) => void;
  charIconSize?: ItemIconSize;
  subIconSize?: ItemIconSize;
}) {
  const { t } = useLanguage();
  const { characterStats, weaponStats } = useGameStats();
  const char = charactersById[config.charId];

  const charWeaponType = useMemo(() => {
    if (!char || !characterStats) return undefined;
    return getCharacterDisplayMeta(char, characterStats[config.charId])
      .weaponType;
  }, [char, characterStats, config.charId]);

  const makeFilter = useCallback(
    (targetRarity: number) => {
      return (w: WeaponResource) => {
        if (!weaponStats) return w.rarity === targetRarity;
        const meta = getWeaponDisplayMeta(w, weaponStats[w.id]);
        if (meta.rarity !== targetRarity) return false;
        if (charWeaponType && meta.type && meta.type !== charWeaponType)
          return false;
        return true;
      };
    },
    [weaponStats, charWeaponType]
  );

  const filterLowStar = useMemo(() => {
    return (w: WeaponResource) => {
      if (!weaponStats) return w.rarity === 3 || w.rarity === 4;
      const meta = getWeaponDisplayMeta(w, weaponStats[w.id]);
      if (meta.rarity !== 3 && meta.rarity !== 4) return false;
      if (charWeaponType && meta.type && meta.type !== charWeaponType)
        return false;
      return true;
    };
  }, [weaponStats, charWeaponType]);
  const filter5Star = useMemo(() => makeFilter(5), [makeFilter]);
  const artifactIcon = useMemo(
    () => getArtifactIconProps(baseConfig),
    [baseConfig]
  );

  const rosterWeapon = weaponsById[baseConfig.weaponId];
  const rosterIs5Star = rosterWeapon?.rarity === 5;

  const artifactTooltip = useMemo(() => {
    if (baseConfig.artifactSetId) {
      return <ArtifactTooltip setId={baseConfig.artifactSetId} />;
    }
    if (baseConfig.artifactHalfSetIds.length >= 2) {
      return (
        <MixedSetTooltip
          id1={baseConfig.artifactHalfSetIds[0]}
          id2={baseConfig.artifactHalfSetIds[1]}
        />
      );
    }
    return null;
  }, [baseConfig.artifactSetId, baseConfig.artifactHalfSetIds]);

  const SIZE_TO_W: Record<string, string> = {
    xs: "w-10",
    sm: "w-12",
    md: "w-14",
    lg: "w-16",
    xl: "w-20",
  };
  const charW = SIZE_TO_W[charIconSize] ?? "w-12";
  const subW = SIZE_TO_W[subIconSize] ?? "w-10";

  return (
    <>
      {/* Row 1: Icons — flat flex, uniform gaps */}
      <div className="flex items-end gap-0.5 md:gap-1.5 lg:gap-0.5 2xl:gap-1.5">
        {char ? (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon characterId={config.charId} size={charIconSize} />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <CharacterTooltip characterId={config.charId} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <ItemIcon characterId={config.charId} size={charIconSize} />
        )}
        <Tooltip disableHoverableContent>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              <ItemIcon {...artifactIcon} size={subIconSize} />
            </span>
          </TooltipTrigger>
          {artifactTooltip && (
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              {artifactTooltip}
            </TooltipContent>
          )}
        </Tooltip>
        {!rosterIs5Star && rosterWeapon ? (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon weaponId={baseConfig.weaponId} size={subIconSize} />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <WeaponTooltip weaponId={baseConfig.weaponId} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <ItemPicker
            type="weapon"
            value={config.weapon4Star?.id ?? null}
            onChange={(id) => onUpdateWeapon(config.charId, "4", id as string)}
            onClear={() => onUpdateWeapon(config.charId, "4", null)}
            filter={filterLowStar}
            triggerSize={subIconSize}
            menuSize="sm"
          />
        )}
        {rosterIs5Star && rosterWeapon ? (
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <span className="cursor-help">
                <ItemIcon weaponId={baseConfig.weaponId} size={subIconSize} />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="p-0 border-none bg-transparent shadow-none"
            >
              <WeaponTooltip weaponId={baseConfig.weaponId} />
            </TooltipContent>
          </Tooltip>
        ) : (
          <ItemPicker
            type="weapon"
            value={config.weapon5Star?.id ?? null}
            onChange={(id) => onUpdateWeapon(config.charId, "5", id as string)}
            onClear={() => onUpdateWeapon(config.charId, "5", null)}
            filter={filter5Star}
            triggerSize={subIconSize}
            menuSize="sm"
          />
        )}
      </div>
      {/* Row 2: Name + labels, widths matching icon sizes */}
      <div className="flex items-baseline gap-0.5 md:gap-1.5 lg:gap-0.5 2xl:gap-1.5">
        <span
          className={cn(
            "shrink-0 font-bold text-foreground/90 whitespace-nowrap text-sm md:text-base lg:text-sm xl:text-base ml-2 xl:ml-3",
            charW
          )}
        >
          {t.character(config.charId)}
        </span>
        <span className={cn("shrink-0", subW)} />
        <span
          className={cn(
            "shrink-0 text-center text-xs xl:text-sm font-bold text-foreground",
            subW
          )}
        >
          3/4★
        </span>
        <span
          className={cn(
            "shrink-0 text-center text-xs xl:text-sm font-bold text-foreground",
            subW
          )}
        >
          5★
        </span>
      </div>
    </>
  );
}

// ─── Per-character start C/R selectors ───

function CharStartSelectors({
  config,
  onUpdateStart,
}: {
  config: AnalyzerCharConfig;
  onUpdateStart: (
    charId: string,
    field: "startConstellation" | "startRefinement",
    value: number
  ) => void;
}) {
  const { t } = useLanguage();
  const is5Star = config.rarity >= 5;
  const has5Wep = !!config.weapon5Star;
  const hasBothWeps = !!config.weapon4Star && has5Wep;
  const hasAnySelector = is5Star || has5Wep;

  const weaponOptions = useMemo(() => {
    if (!has5Wep) return null;
    const opts: { value: string; label: string }[] = [];
    if (hasBothWeps) {
      opts.push({ value: "0", label: t.ui("teamComp.analyzerWeapon4StarR0") });
    }
    for (let r = 1; r <= 5; r++) {
      opts.push({
        value: String(r),
        label: t.format("common.refinementFormat", r),
      });
    }
    return opts;
  }, [has5Wep, hasBothWeps, t]);

  if (!hasAnySelector) return null;

  return (
    <div className="flex flex-col bg-black/10 rounded-md border border-border/30 px-1 py-0.5 md:px-2 md:py-1 lg:px-1 lg:py-0.5 xl:px-2 xl:py-1 w-full">
      <div className="flex items-center justify-center gap-1">
        <span className="text-[10px] md:text-sm lg:text-xs xl:text-sm font-bold text-foreground/70 whitespace-nowrap shrink-0">
          {t.ui("teamComp.analyzerMinConfig")}
        </span>
        <div className="flex items-center gap-1">
          {is5Star && (
            <LightweightSelect
              value={String(config.startConstellation)}
              onValueChange={(v) =>
                onUpdateStart(config.charId, "startConstellation", Number(v))
              }
            >
              <LightweightSelectTrigger className="w-16 md:w-20 lg:w-16 xl:w-20 bg-white/5 border-border/30 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs md:h-7 md:px-1.5 md:text-sm lg:h-6 lg:px-1 lg:text-xs xl:h-7 xl:px-1.5 xl:text-sm">
                <LightweightSelectValue />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {Array.from({ length: 7 }, (_, i) => (
                  <LightweightSelectItem key={i} value={String(i)}>
                    {t.format("common.constellationFormat", i)}
                  </LightweightSelectItem>
                ))}
              </LightweightSelectContent>
            </LightweightSelect>
          )}
          {weaponOptions && (
            <LightweightSelect
              value={String(config.startRefinement)}
              onValueChange={(v) =>
                onUpdateStart(config.charId, "startRefinement", Number(v))
              }
            >
              <LightweightSelectTrigger className="w-20 md:w-24 lg:w-20 xl:w-24 bg-white/5 border-border/30 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs md:h-7 md:px-1.5 md:text-sm lg:h-6 lg:px-1 lg:text-xs xl:h-7 xl:px-1.5 xl:text-sm">
                <LightweightSelectValue />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {weaponOptions.map((opt) => (
                  <LightweightSelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </LightweightSelectItem>
                ))}
              </LightweightSelectContent>
            </LightweightSelect>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Per-character max C/R selectors ───

function CharMaxSelectors({
  config,
  onUpdateMax,
}: {
  config: AnalyzerCharConfig;
  onUpdateMax: (
    charId: string,
    field: "maxConstellation" | "maxRefinement",
    value: number
  ) => void;
}) {
  const { t } = useLanguage();
  const is5Star = config.rarity >= 5;
  const has5Wep = !!config.weapon5Star;
  const hasAnySelector = is5Star || has5Wep;

  if (!hasAnySelector) return null;

  return (
    <div className="flex flex-col bg-black/10 rounded-md border border-border/30 px-1 py-0.5 md:px-2 md:py-1 lg:px-1 lg:py-0.5 xl:px-2 xl:py-1 w-full">
      <div className="flex items-center justify-center gap-1">
        <span className="text-[10px] md:text-sm lg:text-xs xl:text-sm font-bold text-foreground/70 whitespace-nowrap shrink-0">
          {t.ui("teamComp.analyzerMaxConfig")}
        </span>
        <div className="flex items-center gap-1">
          {is5Star && (
            <LightweightSelect
              value={String(config.maxConstellation)}
              onValueChange={(v) =>
                onUpdateMax(config.charId, "maxConstellation", Number(v))
              }
            >
              <LightweightSelectTrigger className="w-16 md:w-20 lg:w-16 xl:w-20 bg-white/5 border-border/30 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs md:h-7 md:px-1.5 md:text-sm lg:h-6 lg:px-1 lg:text-xs xl:h-7 xl:px-1.5 xl:text-sm">
                <LightweightSelectValue />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {Array.from({ length: 7 }, (_, i) => (
                  <LightweightSelectItem key={i} value={String(i)}>
                    {t.format("common.constellationFormat", i)}
                  </LightweightSelectItem>
                ))}
              </LightweightSelectContent>
            </LightweightSelect>
          )}
          {has5Wep && (
            <LightweightSelect
              value={String(config.maxRefinement)}
              onValueChange={(v) =>
                onUpdateMax(config.charId, "maxRefinement", Number(v))
              }
            >
              <LightweightSelectTrigger className="w-20 md:w-24 lg:w-20 xl:w-24 bg-white/5 border-border/30 [&>span]:text-center [&>span]:w-full font-bold h-6 px-1 text-xs md:h-7 md:px-1.5 md:text-sm lg:h-6 lg:px-1 lg:text-xs xl:h-7 xl:px-1.5 xl:text-sm">
                <LightweightSelectValue />
              </LightweightSelectTrigger>
              <LightweightSelectContent>
                {Array.from({ length: 6 }, (_, i) => (
                  <LightweightSelectItem key={i} value={String(i)}>
                    {i === 0
                      ? t.ui("teamComp.noWeapon5Star")
                      : t.format("common.refinementFormat", i)}
                  </LightweightSelectItem>
                ))}
              </LightweightSelectContent>
            </LightweightSelect>
          )}
        </div>
      </div>
    </div>
  );
}
