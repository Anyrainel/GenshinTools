import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import type { Character } from "@/data/types";
import { THEME } from "@/lib/theme";
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

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-2">
          <h3
            className={cn("text-2xl font-bold text-foreground", nameClassName)}
          >
            {displayName}
          </h3>
          {children}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Badge
            variant="outline"
            className={cn(
              elementTextColor,
              "rounded-full shadow-none border-current border-2 font-medium text-base flex items-center gap-1"
            )}
          >
            <img
              src={getAssetUrl(elementImagePath)}
              alt={character.element}
              loading="lazy"
              className="w-5 h-5"
            />
            {elementName}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              rarityTextColor,
              "rounded-full shadow-none border-current border-2 font-semibold text-base"
            )}
          >
            ★ {character.rarity}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full shadow-none text-slate-400 border-slate-400 border-2 font-medium text-base capitalize flex items-center gap-1"
          >
            <img
              src={getAssetUrl(weaponImagePath)}
              alt={character.weaponType}
              loading="lazy"
              className="w-5 h-5"
            />
            {weaponName}
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full shadow-none text-slate-500 border-slate-500 border-2 font-medium text-base capitalize"
          >
            {regionName}
          </Badge>
          {showDate && (
            <span className="text-base text-muted-foreground pl-2">
              {formattedDate}
            </span>
          )}
        </div>
      </div>
    );
  }
);

CharacterInfo.displayName = "CharacterInfo";
