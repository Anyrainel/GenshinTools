import { memo, useMemo, useCallback } from "react";
import { Character } from "@/data/types";
import {
  elementResourcesByName,
  weaponResourcesByName,
} from "@/data/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { getAssetUrl } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Weapon } from "@/data/types";

interface WeaponSlotProps {
  index: number;
  weaponId: string | null;
  onUpdate: (index: number, val: string) => void;
  onClear: (index: number) => void;
  filter: (item: unknown) => boolean;
  isAddSlot?: boolean;
}

const WeaponSlot = memo(
  ({
    index,
    weaponId,
    onUpdate,
    onClear,
    filter,
    isAddSlot,
  }: WeaponSlotProps) => {
    const handleChange = useCallback(
      (val: string) => onUpdate(index, val),
      [index, onUpdate],
    );
    const handleClear = useCallback(() => onClear(index), [index, onClear]);

    return (
      <ItemPicker
        type="weapon"
        value={weaponId}
        onChange={handleChange}
        onClear={!isAddSlot ? handleClear : undefined}
        filter={filter}
        tooltipSide="left"
        className={isAddSlot ? "w-14 h-14 [&_span]:text-2xl" : "w-14 h-14"}
      />
    );
  },
);
WeaponSlot.displayName = "WeaponSlot";

interface TitleCardProps {
  character: Character;
}

function TitleCardComponent({ character }: TitleCardProps) {
  const { t } = useLanguage();
  const isHidden = useBuildsStore(
    (state) => !!state.hiddenCharacters[character.id],
  );
  const toggleHidden = useBuildsStore((state) => state.toggleCharacterHidden);

  // Memoize all computed display values
  const displayName = useMemo(
    () => t.character(character.id),
    [t, character.id],
  );

  const elementImagePath = useMemo(() => {
    return elementResourcesByName[character.element]?.imagePath || "";
  }, [character.element]);

  const weaponImagePath = useMemo(() => {
    return weaponResourcesByName[character.weaponType]?.imagePath || "";
  }, [character.weaponType]);

  const rarityColor = useMemo(() => {
    return THEME.rarity.bg[character.rarity];
  }, [character.rarity]);

  const rarityTextColor = useMemo(() => {
    return THEME.rarity.text[character.rarity];
  }, [character.rarity]);

  const elementTextColor = useMemo(() => {
    return THEME.element.text[character.element];
  }, [character.element]);

  const elementName = useMemo(
    () => t.element(character.element),
    [t, character.element],
  );
  const weaponName = useMemo(
    () => t.weaponType(character.weaponType),
    [t, character.weaponType],
  );
  const regionName = useMemo(
    () => t.region(character.region),
    [t, character.region],
  );
  const formattedDate = useMemo(
    () => t.formatDate(character.releaseDate),
    [t, character.releaseDate],
  );

  const characterWeapons = useBuildsStore((state) =>
    state.getCharacterWeapons(character.id),
  );

  const handleToggle = useCallback(() => {
    toggleHidden(character.id);
  }, [toggleHidden, character.id]);

  const weaponFilter = useCallback(
    (item: unknown) => {
      return (item as Weapon).type === character.weaponType;
    },
    [character.weaponType],
  );

  // Stable callbacks for weapon updates
  const handleWeaponUpdate = useCallback(
    (index: number, val: string) => {
      const state = useBuildsStore.getState();
      const currentWeapons = [...state.getCharacterWeapons(character.id)];
      if (index >= currentWeapons.length) {
        // Add new weapon
        currentWeapons.push(val);
      } else {
        // Update existing weapon
        currentWeapons[index] = val;
      }
      state.setCharacterWeapons(character.id, currentWeapons);
    },
    [character.id],
  );

  const handleWeaponClear = useCallback(
    (index: number) => {
      const state = useBuildsStore.getState();
      const currentWeapons = [...state.getCharacterWeapons(character.id)];
      currentWeapons.splice(index, 1);
      state.setCharacterWeapons(character.id, currentWeapons);
    },
    [character.id],
  );

  return (
    <div className="flex items-center gap-4">
      <div
        className={`relative w-16 h-16 rounded-lg ${rarityColor} overflow-hidden select-none`}
      >
        <img
          src={getAssetUrl(character.imagePath)}
          alt={displayName}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3
              className={`text-xl font-bold ${isHidden ? "text-muted-foreground" : "text-foreground"}`}
            >
              {displayName}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={
                isHidden
                  ? t.ui("characterCard.showBuilds")
                  : t.ui("characterCard.hideBuilds")
              }
              title={
                isHidden
                  ? t.ui("characterCard.showBuilds")
                  : t.ui("characterCard.hideBuilds")
              }
            >
              {isHidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            {isHidden && (
              <span className="text-muted-foreground text-xs italic select-none">
                {t.ui("characterCard.hiddenNotice")}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Badge
              variant="outline"
              className={`${elementTextColor} border-current border-2 font-medium flex items-center gap-1`}
            >
              <img
                src={getAssetUrl(elementImagePath)}
                alt={character.element}
                loading="lazy"
                className="w-4 h-4"
              />
              {elementName}
            </Badge>
            <Badge
              variant="outline"
              className={`${rarityTextColor} border-current border-2 font-semibold`}
            >
              ★ {character.rarity}
            </Badge>
            <Badge
              variant="outline"
              className="text-slate-400 border-slate-400 border-2 font-medium capitalize flex items-center gap-1"
            >
              <img
                src={getAssetUrl(weaponImagePath)}
                alt={character.weaponType}
                loading="lazy"
                className="w-4 h-4"
              />
              {weaponName}
            </Badge>
            <Badge
              variant="outline"
              className="text-slate-500 border-slate-500 border-2 font-medium capitalize"
            >
              {regionName}
            </Badge>
            <span className="text-sm text-muted-foreground pl-2">
              {formattedDate}
            </span>
          </div>
        </div>

        {!isHidden && (
          <div className="flex gap-2">
            {characterWeapons.map((weaponId, index) => (
              <WeaponSlot
                key={index}
                index={index}
                weaponId={weaponId}
                onUpdate={handleWeaponUpdate}
                onClear={handleWeaponClear}
                filter={weaponFilter}
              />
            ))}
            {characterWeapons.length < 3 && (
              <WeaponSlot
                index={characterWeapons.length}
                weaponId={null}
                onUpdate={handleWeaponUpdate}
                onClear={handleWeaponClear}
                filter={weaponFilter}
                isAddSlot
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const TitleCard = memo(TitleCardComponent, (prev, next) => {
  // Only re-render if character ID changes (character object should be stable)
  return prev.character.id === next.character.id;
});
