import { Eye, EyeOff, Plus, RotateCcw } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CharacterInfo } from "@/components/shared/CharacterInfo";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ItemPicker } from "@/components/shared/ItemPicker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { Build, CharacterResource, WeaponResource } from "@/data/types";
import { useResolvedBuilds } from "@/hooks/useResolvedBuilds";
import { getCachedPreset } from "@/lib/artifact-builds/buildPresetRegistry";
import { cn } from "@/lib/utils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { BuildCard } from "./BuildCard";

interface WeaponSlotProps {
  index: number;
  weaponId: string | null;
  onUpdate: (index: number, val: string) => void;
  onClear: (index: number) => void;
  filter: (item: WeaponResource) => boolean;
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
    filter: (item: WeaponResource) => boolean;
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

/** Pre-computed layout flags, hoisted to the parent to avoid per-card useMediaQuery hooks. */
export interface BuildCardLayout {
  isMobile: boolean;
  isDesktop: boolean;
  isVeryNarrow: boolean;
}

interface CharacterBuildCardProps {
  character: CharacterResource;
  /** Optional tour step ID for onboarding */
  tourStepId?: string;
  layout?: BuildCardLayout;
}

const DEFAULT_BUILD_LAYOUT: BuildCardLayout = {
  isMobile: false,
  isDesktop: true,
  isVeryNarrow: false,
};

function CharacterBuildCardComponent({
  character,
  tourStepId,
  layout = DEFAULT_BUILD_LAYOUT,
}: CharacterBuildCardProps) {
  const { t } = useLanguage();
  const isHidden = useBuildsStore(
    (state) => !!state.hiddenCharacters[character.id]
  );
  const toggleHidden = useBuildsStore((state) => state.toggleCharacterHidden);

  const characterWeapons = useBuildsStore((state) =>
    state.getCharacterWeapons(character.id)
  );

  // Has customizations = any build for this character has a local override, or a preset build was deleted
  const hasCustomizations = useBuildsStore((state) => {
    // Check 1: Any local build overrides (modified or custom)
    const ids = state.characterToBuildIds[character.id];
    if (ids?.some((id) => id in state.builds)) return true;

    // Check 2: Any preset builds for this character were deleted
    if (state.presetDeletedBuildIds.length > 0) {
      const preset = getCachedPreset(state.activePresetId);
      const presetBuildIds = preset?.characterBuilds?.[character.id];
      if (
        presetBuildIds?.some((id) => state.presetDeletedBuildIds.includes(id))
      )
        return true;
    }

    return false;
  });

  // Use useMemo with shallow comparison for array to prevent re-renders on reference changes
  const builds = useResolvedBuilds(character.id);

  const newBuild = useBuildsStore((state) => state.newBuild);
  const copyBuild = useBuildsStore((state) => state.copyBuild);
  const restoreCharacter = useBuildsStore((state) => state.restoreCharacter);

  const [confirmRestore, setConfirmRestore] = useState(false);

  const handleToggle = useCallback(() => {
    toggleHidden(character.id);
  }, [toggleHidden, character.id]);

  const characterStats = characterStatsResource.use();
  const weaponStats = weaponStatsResource.use();
  const charMeta = useMemo(
    () => getCharacterDisplayMeta(character, characterStats?.[character.id]),
    [character, characterStats]
  );
  const weaponFilter = useCallback(
    (w: WeaponResource) => {
      const weaponMeta = getWeaponDisplayMeta(w, weaponStats?.[w.id]);
      return (
        charMeta.weaponType == null || weaponMeta.type === charMeta.weaponType
      );
    },
    [charMeta.weaponType, weaponStats]
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

  /* Responsive weapon caps: mobile=1, tablet=3, desktop=5 */
  const { isMobile, isDesktop, isVeryNarrow } = layout;
  const maxWeapons = isMobile ? 1 : isDesktop ? 5 : 3;
  const visibleWeapons = characterWeapons.slice(0, maxWeapons);
  const iconSize = isVeryNarrow ? "md" : "lg";

  // Full placeholder when no weapons — creates urgency to add at least one
  const showFullPlaceholder = isMobile
    ? characterWeapons.length < 1
    : characterWeapons.length === 0;
  // Compact + button when weapons exist but can add more
  const showCompactAdd =
    !isMobile &&
    characterWeapons.length > 0 &&
    characterWeapons.length < maxWeapons;

  const handleAddBuild = useCallback(() => {
    newBuild(character.id);
  }, [newBuild, character.id]);

  const handleDuplicateBuild = useCallback(
    (buildId: string, build: Build) => {
      copyBuild(character.id, buildId, build);
    },
    [copyBuild, character.id]
  );

  const moveBuild = useBuildsStore((state) => state.moveBuild);

  const handleMoveBuild = useCallback(
    (buildId: string, direction: "up" | "down") => {
      const resolvedIds = builds.map((b) => b.id);
      moveBuild(character.id, resolvedIds, buildId, direction);
    },
    [moveBuild, character.id, builds]
  );

  const handleRestore = useCallback(() => {
    restoreCharacter(character.id);
    setConfirmRestore(false);
  }, [restoreCharacter, character.id]);

  return (
    <Card className="bg-gradient-card" data-tour-step-id={tourStepId}>
      <CardHeader className={cn("pb-3 pt-3", isVeryNarrow ? "px-2" : "px-3")}>
        {/* Title card content (formerly TitleCard) */}
        <div
          className={cn(
            "flex items-center",
            isVeryNarrow ? "gap-2" : "gap-3 md:gap-4"
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={`/archive/characters?character=${character.id}`}>
                <ItemIcon characterId={character.id} size={iconSize} />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={character.id} />
            </TooltipContent>
          </Tooltip>

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
                <span className="text-muted-foreground text-xs md:text-sm xl:text-base italic select-none">
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
        <CardContent className={cn("pb-3", isVeryNarrow ? "px-2" : "px-3")}>
          <div className="grid gap-2 grid-cols-1 2xl:grid-cols-2">
            {builds.length === 0 ? (
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
              builds.map((build, index) => (
                <BuildCard
                  key={build.id}
                  build={build}
                  buildId={build.id}
                  onDuplicate={handleDuplicateBuild}
                  onMove={handleMoveBuild}
                  canMoveUp={index > 0}
                  canMoveDown={index < builds.length - 1}
                  element={charMeta.element ?? "Pyro"}
                />
              ))
            )}
          </div>
          {builds.length > 0 && (
            <div className="mt-2 flex gap-2">
              {hasCustomizations && (
                <Button
                  onClick={() => setConfirmRestore(true)}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-auto max-w-[50%] gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
                    isVeryNarrow ? "text-xs h-7" : "text-sm h-9"
                  )}
                >
                  <RotateCcw className={isVeryNarrow ? "w-3 h-3" : "w-4 h-4"} />
                  {t.ui("common.restore") || "Restore"}
                </Button>
              )}
              <Button
                onClick={handleAddBuild}
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 flex-1",
                  isVeryNarrow ? "text-xs h-7" : "text-sm h-9"
                )}
              >
                <Plus className={isVeryNarrow ? "w-3 h-3" : "w-4 h-4"} />
                {t.ui("common.addBuild")}
              </Button>
            </div>
          )}
        </CardContent>
      )}

      <AlertDialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.ui("common.restoreTitle") || "Restore Preset Defaults?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.ui("common.restoreConfirm") ||
                "This will remove all custom builds and weapon settings for this character. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t.ui("common.restore") || "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export const CharacterBuildCard = memo(CharacterBuildCardComponent);
