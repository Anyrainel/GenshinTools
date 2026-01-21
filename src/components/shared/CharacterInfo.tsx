import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import type { Character } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { THEME } from "@/lib/styles";
import { cn, getAssetUrl } from "@/lib/utils";
import { memo, useMemo } from "react";

interface CharacterInfoProps {
  character: Character;
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

    const displayName = useMemo(
      () => t.character(character.id),
      [t, character.id]
    );

    const elementImagePath = useMemo(() => {
      return elementResourcesByName[character.element]?.imagePath || "";
    }, [character.element]);

    const weaponImagePath = useMemo(() => {
      return weaponResourcesByName[character.weaponType]?.imagePath || "";
    }, [character.weaponType]);

    const rarityTextColor = useMemo(() => {
      return THEME.rarity.text[character.rarity];
    }, [character.rarity]);

    const elementTextColor = useMemo(() => {
      return THEME.element.text[character.element];
    }, [character.element]);

    const elementName = useMemo(
      () => t.element(character.element),
      [t, character.element]
    );
    const weaponName = useMemo(
      () => t.weaponType(character.weaponType),
      [t, character.weaponType]
    );
    const regionName = useMemo(
      () => t.region(character.region),
      [t, character.region]
    );
    const formattedDate = useMemo(
      () => t.formatDate(character.releaseDate),
      [t, character.releaseDate]
    );

    const isMobile = !useMediaQuery("(min-width: 768px)");

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-bold text-foreground",
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
              alt={character.element}
              loading="lazy"
              className={cn(isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}
            />
            {elementName}
          </Badge>

          {/* Mobile: Hide Rarity */}
          {!isMobile && (
            <Badge
              variant="outline"
              className={cn(
                rarityTextColor,
                "rounded-full shadow-none border-current border-2 font-semibold text-sm"
              )}
            >
              ★ {character.rarity}
            </Badge>
          )}

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
              alt={character.weaponType}
              loading="lazy"
              className={cn(isMobile ? "w-3.5 h-3.5" : "w-5 h-5")}
            />
            {weaponName}
          </Badge>

          <Badge
            variant="outline"
            className={cn(
              "rounded-full shadow-none text-slate-500 border-slate-500 border-2 capitalize",
              isMobile
                ? "px-1.5 py-0 text-sm font-normal"
                : "font-medium text-sm"
            )}
          >
            {regionName}
          </Badge>

          {showDate && (
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
