import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import type { CharacterResource } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getCharacterDisplayMeta } from "@/lib/gameStatsLoader";
import { cn, getAssetUrl, getElementColor, getRarityColor } from "@/lib/utils";
import { memo, useMemo } from "react";

interface CharacterInfoProps {
  character: CharacterResource;
  className?: string;
  showDate?: boolean;
  nameClassName?: string;
  children?: React.ReactNode;
}

export const CharacterInfo = memo(
  ({
    character,
    className,
    showDate = true,
    nameClassName,
    children,
  }: CharacterInfoProps) => {
    const { t } = useLanguage();
    const { characterStats } = useGameStats();
    const meta = useMemo(
      () => getCharacterDisplayMeta(character, characterStats?.[character.id]),
      [character, characterStats]
    );

    const displayName = useMemo(
      () => t.character(character.id),
      [t, character.id]
    );

    const elementImagePath = useMemo(() => {
      return meta.element
        ? (elementResourcesByName[meta.element]?.imagePath ?? "")
        : "";
    }, [meta.element]);

    const weaponImagePath = useMemo(() => {
      return meta.weaponType
        ? (weaponResourcesByName[meta.weaponType]?.imagePath ?? "")
        : "";
    }, [meta.weaponType]);

    const rarityTextColor = getRarityColor(meta.rarity, "text");
    const elementTextColor = meta.element
      ? getElementColor(meta.element, "text")
      : "";

    const elementName = useMemo(
      () => (meta.element ? t.element(meta.element) : ""),
      [t, meta.element]
    );
    const weaponName = useMemo(
      () => (meta.weaponType ? t.weaponType(meta.weaponType) : ""),
      [t, meta.weaponType]
    );
    const regionName = useMemo(
      () => (meta.region ? t.region(meta.region) : ""),
      [t, meta.region]
    );
    const formattedDate = useMemo(
      () => t.formatDate(meta.releaseDate ?? null),
      [t, meta.releaseDate]
    );

    const isMobile = !useMediaQuery("(min-width: 768px)");

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-bold text-foreground whitespace-nowrap",
              isMobile ? "text-lg" : "text-xl",
              nameClassName
            )}
          >
            {displayName}
          </h3>
          {children}
        </div>
        <div
          className={cn(
            "flex items-center flex-wrap",
            isMobile ? "gap-1" : "gap-2"
          )}
        >
          {meta.element != null && (
            <Badge
              variant="outline"
              className={cn(
                elementTextColor,
                "rounded-full shadow-none border-current border-2 flex items-center gap-1",
                isMobile
                  ? "px-1.5 py-0 text-sm font-normal"
                  : "font-medium text-sm"
              )}
            >
              <img
                src={getAssetUrl(elementImagePath)}
                alt={meta.element}
                loading="lazy"
                className={cn(isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}
              />
              {elementName}
            </Badge>
          )}

          {!isMobile && (
            <Badge
              variant="outline"
              className={cn(
                rarityTextColor,
                "rounded-full shadow-none border-current border-2 font-semibold text-sm"
              )}
            >
              ★ {meta.rarity}
            </Badge>
          )}

          {meta.weaponType != null && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full shadow-none text-slate-400 border-slate-400 border-2 capitalize flex items-center gap-1",
                isMobile
                  ? "px-1.5 py-0 text-sm font-normal"
                  : "font-medium text-sm"
              )}
            >
              <img
                src={getAssetUrl(weaponImagePath)}
                alt={meta.weaponType}
                loading="lazy"
                className={cn(isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}
              />
              {weaponName}
            </Badge>
          )}

          {!isMobile && meta.region != null && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full shadow-none text-slate-400 border-slate-400 border-2 capitalize",
                "font-medium text-sm"
              )}
            >
              {regionName}
            </Badge>
          )}

          {showDate && !isMobile && (
            <span
              className={cn(
                "text-muted-foreground pl-2",
                isMobile ? "text-xs" : "text-sm"
              )}
            >
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CharacterInfo.displayName = "CharacterInfo";
