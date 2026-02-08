import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Character } from "@/data/types";
import type { Weapon } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { Eye, EyeOff, Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BuildCard } from "./BuildCard";

interface WeaponSlotProps {
  index: number;
  weaponId: string | null;
  onUpdate: (index: number, val: string) => void;
  onClear: (index: number) => void;
  filter: (item: unknown) => boolean;
  isAddSlot?: boolean;
  size?: "md" | "lg" | "xl";
}

const WeaponSlot = memo(
  ({
    index,
    weaponId,
    onUpdate,
    onClear,
    filter,
    isAddSlot,
    size,
  }: WeaponSlotProps) => {
    const handleChange = useCallback(
      (val: string) => onUpdate(index, val),
      [index, onUpdate]
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
        triggerSize={size}
      />
    );
  }
);
WeaponSlot.displayName = "WeaponSlot";

/** Compact + button that spawns a defaultOpen ItemPicker on click */
const CompactAddWeapon = memo(
  ({
    index,
    onUpdate,
    filter,
  }: {
    index: number;
    onUpdate: (index: number, val: string) => void;
    filter: (item: unknown) => boolean;
  }) => {
    const [isAdding, setIsAdding] = useState(false);

    const handleChange = useCallback(
      (val: string) => {
        onUpdate(index, val);
        setIsAdding(false);
      },
      [index, onUpdate]
    );

    const handleClose = useCallback((open: boolean) => {
      if (!open) setIsAdding(false);
    }, []);

    if (isAdding) {
      return (
        <ItemPicker
          type="weapon"
          value={null}
          onChange={handleChange}
          filter={filter}
          tooltipSide="left"
          defaultOpen
          onOpenChange={handleClose}
        />
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsAdding(true)}
        className="p-1 h-7 w-7 text-muted-foreground"
      >
        <Plus className="w-4 h-4" />
      </Button>
    );
  }
);
CompactAddWeapon.displayName = "CompactAddWeapon";

interface CharacterBuildCardProps {
  character: Character;
  /** Optional tour step ID for onboarding */
  tourStepId?: string;
}

// Empty array constant to avoid creating new arrays on each render
const EMPTY_BUILD_IDS: string[] = [];

function CharacterBuildCardComponent({
  character,
  tourStepId,
}: CharacterBuildCardProps) {
  const { t } = useLanguage();
  const isHidden = useBuildsStore(
    (state) => !!state.hiddenCharacters[character.id]
  );
  const toggleHidden = useBuildsStore((state) => state.toggleCharacterHidden);

  const displayName = useMemo(
    () => t.character(character.id),
    [t, character.id]
  );

  const characterWeapons = useBuildsStore((state) =>
    state.getCharacterWeapons(character.id)
  );

  // Use useMemo with shallow comparison for array to prevent re-renders on reference changes
  const buildIdsFromStore = useBuildsStore(
    (state) => state.characterToBuildIds[character.id]
  );
  const buildIds = useMemo(
    () => buildIdsFromStore ?? EMPTY_BUILD_IDS,
    [buildIdsFromStore]
  );

  const newBuild = useBuildsStore((state) => state.newBuild);
  const copyBuild = useBuildsStore((state) => state.copyBuild);
  const removeBuild = useBuildsStore((state) => state.removeBuild);

  const handleToggle = useCallback(() => {
    toggleHidden(character.id);
  }, [toggleHidden, character.id]);

  const weaponFilter = useCallback(
    (item: unknown) => {
      return (item as Weapon).type === character.weaponType;
    },
    [character.weaponType]
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
    [character.id]
  );

  const handleWeaponClear = useCallback(
    (index: number) => {
      const state = useBuildsStore.getState();
      const currentWeapons = [...state.getCharacterWeapons(character.id)];
      currentWeapons.splice(index, 1);
      state.setCharacterWeapons(character.id, currentWeapons);
    },
    [character.id]
  );

  /* Mobile: Show max 1 weapon */
  const isMobile = !useMediaQuery("(min-width: 768px)");
  const isVeryNarrow = useMediaQuery("(max-width: 560px)");
  const visibleWeapons = isMobile
    ? characterWeapons.slice(0, 1)
    : characterWeapons;
  const iconSize = isVeryNarrow ? "md" : isMobile ? "lg" : "xl";

  // Full placeholder when no weapons — creates urgency to add at least one
  const showFullPlaceholder = isMobile
    ? characterWeapons.length < 1
    : characterWeapons.length === 0;
  // Compact + button when weapons exist but can add more (desktop only)
  const showCompactAdd =
    !isMobile && characterWeapons.length > 0 && characterWeapons.length < 3;

  const handleAddBuild = useCallback(() => {
    newBuild(character.id);
  }, [newBuild, character.id]);

  const handleDeleteBuild = useCallback(
    (buildId: string) => {
      removeBuild(character.id, buildId);
    },
    [removeBuild, character.id]
  );

  const handleDuplicateBuild = useCallback(
    (buildId: string) => {
      copyBuild(character.id, buildId);
    },
    [copyBuild, character.id]
  );

  return (
    <Card className="bg-gradient-card" data-tour-step-id={tourStepId}>
      <CardHeader
        className={cn("pb-3 pt-3 md:pt-5", isVeryNarrow ? "px-3" : "")}
      >
        {/* Title card content (formerly TitleCard) */}
        <div
          className={cn(
            "flex items-center",
            isVeryNarrow ? "gap-2" : "gap-3 md:gap-4"
          )}
        >
          <Link to={`/archive?tab=characters&character=${character.id}`}>
            <ItemIcon
              imagePath={character.imagePath}
              rarity={character.rarity}
              size={iconSize}
            />
          </Link>

          <div className="flex-1 flex items-center justify-between gap-4">
            <CharacterInfo
              character={character}
              nameClassName={
                isHidden ? "text-muted-foreground" : "text-foreground"
              }
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
                <span className="text-muted-foreground text-xs md:text-base italic select-none">
                  {t.ui("characterCard.hiddenNotice")}
                </span>
              )}
            </CharacterInfo>

            {!isHidden && (
              <div className="flex items-center gap-2">
                {visibleWeapons.map((weaponId, index) => (
                  <WeaponSlot
                    key={index}
                    index={index}
                    weaponId={weaponId}
                    onUpdate={handleWeaponUpdate}
                    onClear={handleWeaponClear}
                    filter={weaponFilter}
                    size={iconSize}
                  />
                ))}
                {showFullPlaceholder && (
                  <WeaponSlot
                    index={characterWeapons.length}
                    weaponId={null}
                    onUpdate={handleWeaponUpdate}
                    onClear={handleWeaponClear}
                    filter={weaponFilter}
                    isAddSlot
                    size={iconSize}
                  />
                )}
                {showCompactAdd && (
                  <CompactAddWeapon
                    index={characterWeapons.length}
                    onUpdate={handleWeaponUpdate}
                    filter={weaponFilter}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {!isHidden && (
        <CardContent
          className={cn("pb-3", isVeryNarrow ? "px-2" : "px-3 md:px-6")}
        >
          <div className="grid gap-2 grid-cols-1 2xl:grid-cols-2">
            {buildIds.length === 0 ? (
              <div className="flex justify-center py-2 text-muted-foreground col-span-full">
                <Button
                  onClick={handleAddBuild}
                  variant="outline"
                  className={cn(
                    "gap-2",
                    isVeryNarrow ? "text-xs h-7" : "text-sm h-9"
                  )}
                >
                  <Plus className={isVeryNarrow ? "w-3 h-3" : "w-4 h-4"} />
                  {t.ui("characterCard.addFirstBuild")}
                </Button>
              </div>
            ) : (
              <>
                {buildIds.map((buildId, index) => {
                  // Memoize inline callbacks to prevent BuildCard re-renders
                  const handleDelete = () => handleDeleteBuild(buildId);
                  const handleDuplicate = () => handleDuplicateBuild(buildId);

                  return (
                    <BuildCard
                      key={buildId}
                      buildId={buildId}
                      onDelete={handleDelete}
                      onDuplicate={handleDuplicate}
                      element={character.element}
                    />
                  );
                })}
              </>
            )}
          </div>
          {buildIds.length > 0 && (
            <Button
              onClick={handleAddBuild}
              variant="outline"
              size="sm"
              className={cn(
                "w-full gap-2 mt-2",
                isVeryNarrow ? "text-xs h-7" : "text-sm h-9"
              )}
            >
              <Plus className={isVeryNarrow ? "w-3 h-3" : "w-4 h-4"} />
              {t.ui("characterCard.addBuild")}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export const CharacterBuildCard = memo(
  CharacterBuildCardComponent,
  (prev, next) => {
    // Only re-render if character ID changes (character object should be stable from resources array)
    return prev.character.id === next.character.id;
  }
);
