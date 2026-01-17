import { memo, useMemo, useCallback } from "react";
import { Character } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
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
        triggerSize="xl"
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

  const displayName = useMemo(
    () => t.character(character.id),
    [t, character.id],
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
      <ItemIcon
        imagePath={character.imagePath}
        rarity={character.rarity}
        alt={displayName}
        size="xl"
        className="rounded-lg shadow-md"
      />

      <div className="flex-1 flex items-center justify-between gap-4">
        <CharacterInfo
          character={character}
          nameClassName={isHidden ? "text-muted-foreground" : "text-foreground"}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
              <EyeOff className="h-7 w-7" />
            ) : (
              <Eye className="h-7 w-7" />
            )}
          </Button>
          {isHidden && (
            <span className="text-muted-foreground text-base italic select-none">
              {t.ui("characterCard.hiddenNotice")}
            </span>
          )}
        </CharacterInfo>

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
