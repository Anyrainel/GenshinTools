import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import { getCharacterDisplayMeta } from "@/data/gameStatsLoader";
import type { CharacterResource } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { cn, getAssetUrl, getElementColor, getRarityColor } from "@/lib/utils";
import { memo } from "react";

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
    const meta = getCharacterDisplayMeta(
      character,
      characterStats?.[character.id]
    );
    const displayName = t.character(character.id);
    const elementImagePath = meta.element
      ? (elementResourcesByName[meta.element]?.imagePath ?? "")
      : "";
    const weaponImagePath = meta.weaponType
      ? (weaponResourcesByName[meta.weaponType]?.imagePath ?? "")
      : "";
    const rarityTextColor = getRarityColor(meta.rarity, "text");
    const elementTextColor = meta.element
      ? getElementColor(meta.element, "text")
      : "";
    const elementName = meta.element ? t.element(meta.element) : "";
    const weaponName = meta.weaponType ? t.weaponType(meta.weaponType) : "";
    const regionName = meta.region ? t.region(meta.region) : "";
    const formattedDate = t.formatDate(meta.releaseDate ?? null);

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-bold text-foreground whitespace-nowrap text-lg md:text-xl",
              nameClassName
            )}
          >
            {displayName}
          </h3>
          {children}
        </div>
        <div className="flex items-center flex-wrap gap-1 md:gap-2">
          {meta.element != null && (
            <Badge
              variant="outline"
              className={cn(
                elementTextColor,
                "rounded-full shadow-none border-current border-2 flex items-center gap-1",
                "px-1.5 py-0 md:px-2.5 md:py-0.5 text-sm font-normal md:font-medium"
              )}
            >
              <img
                src={getAssetUrl(elementImagePath)}
                alt={meta.element}
                loading="lazy"
                className="w-3.5 h-3.5 md:w-5 md:h-5"
              />
              {elementName}
            </Badge>
          )}

          <Badge
            variant="outline"
            className={cn(
              rarityTextColor,
              "rounded-full shadow-none border-current border-2 font-semibold text-sm",
              "hidden md:inline-flex"
            )}
          >
            ★ {meta.rarity}
          </Badge>

          {meta.weaponType != null && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full shadow-none text-slate-400 border-slate-400 border-2 capitalize flex items-center gap-1",
                "px-1.5 py-0 md:px-2.5 md:py-0.5 text-sm font-normal md:font-medium"
              )}
            >
              <img
                src={getAssetUrl(weaponImagePath)}
                alt={meta.weaponType}
                loading="lazy"
                className="w-3.5 h-3.5 md:w-5 md:h-5"
              />
              {weaponName}
            </Badge>
          )}

          {meta.region != null && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full shadow-none text-slate-400 border-slate-400 border-2 capitalize",
                "font-medium text-sm hidden md:inline-flex"
              )}
            >
              {regionName}
            </Badge>
          )}

          {showDate && (
            <span className="text-muted-foreground pl-2 text-sm hidden md:inline">
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CharacterInfo.displayName = "CharacterInfo";
