import { ArtifactMixedBuilder } from "@/components/shared/ArtifactMixedBuilder";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import {
  ICON_CONFIG,
  ItemIcon,
  type ItemIconSize,
} from "@/components/shared/ItemIcon";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSets,
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  elementResourcesByName,
  getSortedCharacters,
  getSortedWeaponSecondaryStats,
  sortedArtifacts,
  sortedWeapons,
  weaponResourcesByName,
  weaponsById,
} from "@/data/constants";
import type {
  ArtifactHalfSet,
  ArtifactSetResource,
  CharacterResource,
  MainStat,
  Rarity,
  WeaponResource,
} from "@/data/types";
import type { TierAssignment } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasAccountData, useIsOwned } from "@/hooks/useOwnership";
import {
  getCharacterDisplayMeta,
  getWeaponDisplayMeta,
} from "@/lib/gameStatsLoader";
import { cn, getAssetUrl } from "@/lib/utils";
import { useTierStore } from "@/stores/useTierStore";
import { Ban, Bookmark, Search, Trophy, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

type ItemPickerType = "character" | "weapon" | "artifact";

export type { ArtifactSetConfig as ArtifactConfig } from "@/lib/team-comp/types";
import type { ArtifactSetConfig } from "@/lib/team-comp/types";

type ValueType<T> = T extends "artifact" ? ArtifactSetConfig : string;

/** Maps an ItemPickerType to the resource type passed to filter callbacks. */
export type ItemResourceType<T extends ItemPickerType> = T extends "character"
  ? CharacterResource
  : T extends "weapon"
    ? WeaponResource
    : ArtifactSetResource | ArtifactHalfSet;

interface ItemPickerProps<T extends ItemPickerType> {
  type: T;
  value: ValueType<T> | null;
  onChange: (value: ValueType<T>) => void;
  onClear?: () => void;
  disabled?: boolean;
  filter?: (item: ItemResourceType<T>) => boolean;
  className?: string;
  tooltipSide?: "left" | "right";
  triggerSize?: ItemIconSize;
  menuSize?: ItemIconSize;
  placeholder?: string;
  showItemName?: boolean;
  /** Show element badge overlay on character icons */
  showElementBadge?: boolean;
  /** Open the picker immediately on mount (for add-on-demand flows) */
  defaultOpen?: boolean;
  /** Called when the picker's open state changes (e.g. on close) */
  onOpenChange?: (open: boolean) => void;
  /** Show icy/snowy background instead of rarity background */
  frozen?: boolean;
}

const CHARACTER_RARITY_FILTERS = [5, 4] as const;
const WEAPON_RARITY_FILTERS = [5, 4, 3] as const;

function ItemPickerComponent<T extends ItemPickerType>({
  type,
  value,
  onChange,
  onClear,
  disabled,
  filter,
  className,
  tooltipSide = "right",
  triggerSize = "lg",
  menuSize = "md",
  showItemName = false,
  showElementBadge = false,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  frozen = false,
}: ItemPickerProps<T>) {
  const { characterStats, weaponStats } = useGameStats();
  const tierAssignments = useTierStore((s) => s.tierAssignments);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const hasTierData = useMemo(
    () => Object.keys(tierAssignments).length > 0,
    [tierAssignments]
  );
  const sortedWeaponSecondaryStats = useMemo(
    () => getSortedWeaponSecondaryStats(weaponStats ?? null),
    [weaponStats]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!disabled) {
        setIsOpen(open);
        onOpenChangeProp?.(open);
      }
    },
    [disabled, onOpenChangeProp]
  );

  const handleSelect = useCallback(
    (val: ValueType<T>) => {
      onChange(val);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onClear?.();
    setIsOpen(false);
  }, [onClear]);

  const trigger = (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        "cursor-pointer hover:scale-105 transition-transform select-none relative",
        disabled && "opacity-50 cursor-not-allowed hover:scale-100 grayscale",
        className
      )}
    >
      <PickerTrigger
        type={type}
        value={value}
        size={triggerSize}
        disabled={disabled}
        showElementBadge={showElementBadge}
        characterStats={characterStats}
        frozen={frozen}
      />
      {showItemName && value && <PickerItemName type={type} value={value} />}
    </div>
  );

  const content = (
    <PickerContent
      type={type}
      value={value}
      onSelect={handleSelect as (val: ValueType<ItemPickerType>) => void}
      onClear={onClear ? handleClear : undefined}
      filter={filter as PickerContentProps["filter"]}
      menuSize={menuSize}
      tooltipSide={tooltipSide}
      isDesktop={isDesktop}
      characterStats={characterStats}
      weaponStats={weaponStats}
      tierAssignments={tierAssignments}
      hasTierData={hasTierData}
      sortedWeaponSecondaryStats={sortedWeaponSecondaryStats}
    />
  );

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <Tooltip disableHoverableContent>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild disabled={disabled}>
              {trigger}
            </PopoverTrigger>
          </TooltipTrigger>
          <TriggerTooltip type={type} value={value} />
        </Tooltip>
        <PopoverContent
          className="w-[30rem] h-[40rem] flex flex-col p-0 overflow-hidden bg-background border-border"
          side="right"
          align="start"
          collisionPadding={10}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh] h-full flex flex-col">
        <div className="sr-only">
          <DrawerHeader>
            <DrawerTitle className="capitalize">Select {type}</DrawerTitle>
            <DrawerDescription>
              Browse and select a {type} from the list below
            </DrawerDescription>
          </DrawerHeader>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}

// Sub-components

function PickerItemName({
  type,
  value,
}: { type: ItemPickerType; value: ValueType<ItemPickerType> }) {
  const { t } = useLanguage();
  let name = "";

  if (
    type === "artifact" &&
    typeof value === "object" &&
    value &&
    "type" in value &&
    value.type === "2pc+2pc"
  ) {
    name = t.ui("buildCard.2pc+2pc");
  } else if (type === "character") name = t.character(value as string);
  else if (type === "weapon") name = t.weapon(value as string);
  else if (
    type === "artifact" &&
    typeof value === "object" &&
    value &&
    "setId" in value
  ) {
    name = t.artifact(value.setId);
  }

  return (
    <span className="text-xs text-center font-medium leading-tight max-w-[6rem] line-clamp-2">
      {name}
    </span>
  );
}

function TriggerTooltip({
  type,
  value,
}: {
  type: ItemPickerType;
  value: ValueType<ItemPickerType> | null;
}) {
  if (!value) return null;

  let content: React.ReactNode = null;

  if (type === "character")
    content = <CharacterTooltip characterId={value as string} />;
  else if (type === "weapon")
    content = <WeaponTooltip weaponId={value as string} />;
  else if (type === "artifact") {
    // Check if value respects ArtifactConfig
    if (
      typeof value === "object" &&
      value &&
      "type" in value &&
      value.type === "4pc"
    ) {
      content = <ArtifactTooltip setId={value.setId} />;
    } else if (
      typeof value === "object" &&
      value &&
      "type" in value &&
      value.type === "2pc+2pc"
    ) {
      content = (
        <MixedSetTooltip id1={value.halfSetIds[0]} id2={value.halfSetIds[1]} />
      );
    } else {
      return null;
    }
  }

  return (
    <TooltipContent
      side="right"
      className="p-0 border-0 bg-transparent shadow-none z-[60]"
    >
      {content}
    </TooltipContent>
  );
}

function PickerTrigger({
  type,
  value,
  size,
  disabled,
  showElementBadge,
  characterStats,
  frozen,
}: {
  type: ItemPickerType;
  value: ValueType<ItemPickerType> | null;
  size: ItemIconSize;
  disabled?: boolean;
  showElementBadge?: boolean;
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
  frozen?: boolean;
}) {
  const iconSize = ICON_CONFIG[size]?.icon ?? ICON_CONFIG.lg.icon;
  const borderRadius = ICON_CONFIG[size]?.radius ?? ICON_CONFIG.lg.radius;

  if (!value) {
    return (
      <div
        className={cn(
          "rounded-md border-2 border-border transition-all flex items-center justify-center shadow-sm relative overflow-hidden ring-1 ring-inset ring-foreground/20",
          disabled
            ? "bg-muted opacity-70"
            : "bg-gradient-select hover:shadow-md"
        )}
        style={{ width: iconSize, height: iconSize, borderRadius }}
      >
        <span className="text-4xl text-muted-foreground select-none pb-1 group-hover:text-primary transition-colors">
          +
        </span>
      </div>
    );
  }

  if (type === "artifact") {
    const conf = value as ArtifactSetConfig;
    if (conf.type === "4pc") {
      return (
        <ItemIcon artifactSetId={conf.setId} size={size} frozen={frozen} />
      );
    }
    return (
      <ItemIcon
        halfSetIds={[conf.halfSetIds[0], conf.halfSetIds[1]]}
        size={size}
        frozen={frozen}
      />
    );
  }

  // Character / Weapon
  let item: CharacterResource | WeaponResource | undefined;
  if (type === "character") item = charactersById[value as string];
  else item = weaponsById[value as string];

  // Resolve element image path for badge (from stats when available)
  let elementPath: string | undefined;
  if (showElementBadge && type === "character" && item) {
    const meta = getCharacterDisplayMeta(
      item as CharacterResource,
      characterStats?.[(item as CharacterResource).id]
    );
    elementPath =
      meta.element != null
        ? elementResourcesByName[meta.element]?.imagePath
        : undefined;
  }

  return (
    <ItemIcon
      characterId={
        type === "character" ? (item as CharacterResource)?.id : undefined
      }
      weaponId={type === "weapon" ? (item as WeaponResource)?.id : undefined}
      size={size}
      elementBadge={elementPath}
      frozen={frozen}
    />
  );
}

// Normalized interface for the grid items
interface PickerItem {
  id: string | number;
  imagePath: string;
  rarity: Rarity;
  name: string; // Precomputed name for search
  // biome-ignore lint/suspicious/noExplicitAny: Meta is dependent on standard resource.
  meta?: any; // Precomputed meta for filtering
  // We keep original just in case we need extra properties
  original:
    | CharacterResource
    | WeaponResource
    | ArtifactSetResource
    | ArtifactHalfSet;
}

interface PickerContentProps {
  type: ItemPickerType;
  value: ValueType<ItemPickerType> | null;
  onSelect: (val: ValueType<ItemPickerType>) => void;
  onClear?: () => void;
  filter?: (
    item:
      | CharacterResource
      | WeaponResource
      | ArtifactSetResource
      | ArtifactHalfSet
  ) => boolean;
  menuSize: ItemIconSize;
  tooltipSide: "left" | "right";
  isDesktop: boolean;
  characterStats: ReturnType<typeof useGameStats>["characterStats"];
  weaponStats: ReturnType<typeof useGameStats>["weaponStats"];
  tierAssignments: TierAssignment;
  hasTierData: boolean;
  sortedWeaponSecondaryStats: MainStat[];
}

function PickerContent({
  type,
  value,
  onSelect,
  onClear,
  filter,
  menuSize,
  isDesktop,
  tooltipSide,
  characterStats,
  weaponStats,
  tierAssignments,
  hasTierData,
  sortedWeaponSecondaryStats,
}: PickerContentProps) {
  const { t } = useLanguage();
  const isOwned = useIsOwned();
  const hasOwnershipData = useHasAccountData();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | number>
  >({});
  const [sortByTier, setSortByTier] = useState(false);

  const sortedCharacters = useMemo(
    () =>
      getSortedCharacters(
        characterStats ?? null,
        sortByTier ? tierAssignments : null
      ),
    [characterStats, tierAssignments, sortByTier]
  );

  // Artifact Specific State
  const initialTab =
    type === "artifact" && (value as ArtifactSetConfig)?.type === "2pc+2pc"
      ? "2pc"
      : "4pc";
  const [artifactTab, setArtifactTab] = useState(initialTab);

  // Helper to extract 2pc IDs
  const getInitialMixedSlots = (): [string | null, string | null] => {
    if (
      type === "artifact" &&
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "2pc+2pc"
    ) {
      return [value.halfSetIds[0], value.halfSetIds[1]];
    }
    return [null, null];
  };

  const [initialSlot1, initialSlot2] = getInitialMixedSlots();

  const [mixedSlot1, setMixedSlot1] = useState<string | null>(initialSlot1);
  const [mixedSlot2, setMixedSlot2] = useState<string | null>(initialSlot2);
  const [pickingSlot, setPickingSlot] = useState<1 | 2 | null>(null);

  // Unified Item Mapping (use stats-based rarity when from stats list)
  const items: PickerItem[] = useMemo(() => {
    if (type === "character") {
      return sortedCharacters
        .filter((c) => {
          // Hide unreleased characters (no release date in stats)
          const stats = characterStats?.[c.id];
          return stats?.releaseDate != null;
        })
        .map((c) => {
          const meta = getCharacterDisplayMeta(c, characterStats?.[c.id]);
          return {
            id: c.id,
            imagePath: c.imagePath,
            rarity: meta.rarity,
            name: t.character(c.id).toLowerCase(),
            meta,
            original: c,
          };
        });
    }
    if (type === "weapon") {
      return sortedWeapons.map((w) => {
        const meta = getWeaponDisplayMeta(w, weaponStats?.[w.id]);
        return {
          id: w.id,
          imagePath: w.imagePath,
          rarity: meta.rarity,
          name: t.weapon(w.id).toLowerCase(),
          meta,
          original: w,
        };
      });
    }
    if (type === "artifact") {
      if (artifactTab === "4pc") {
        return sortedArtifacts.map((a) => ({
          id: a.id,
          imagePath: a.imagePaths.flower,
          rarity: a.rarity,
          name: t.artifact(a.id).toLowerCase(),
          original: a,
        }));
      }
      // 2pc Half Sets - show all that have at least one rarity 5 set
      return artifactHalfSets
        .filter((half) =>
          half.setIds.some((id) => (artifactsById[id]?.rarity ?? 0) === 5)
        )
        .map((half) => ({
          id: half.id,
          // Use the flower of the first set as the icon rep
          imagePath: artifactsById[half.setIds[0]]?.imagePaths.flower || "",
          rarity: 5,
          name: t.artifactHalfSet(half.id).toLowerCase(),
          original: half,
        }));
    }
    return [];
  }, [type, artifactTab, sortedCharacters, characterStats, weaponStats, t]);

  // Filtering Logic
  const filteredItems = useMemo(() => {
    let result = items;

    // 1. External Filter
    if (filter) {
      if (type !== "artifact" || artifactTab === "4pc") {
        // Unwrap original item for the external filter
        result = result.filter((wrapper) => filter(wrapper.original));
      }
    }

    // 2. Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((item) => item.name.includes(q));
    }

    // 3. Quick Filters (use stats-based meta when available)
    if (type === "character") {
      if (activeFilters.element) {
        result = result.filter(
          (item) => item.meta?.element === activeFilters.element
        );
      }
      if (activeFilters.weapon) {
        result = result.filter(
          (item) => item.meta?.weaponType === activeFilters.weapon
        );
      }
      if (activeFilters.rarity) {
        result = result.filter((item) => item.rarity === activeFilters.rarity);
      }
    } else if (type === "weapon") {
      if (activeFilters.rarity) {
        result = result.filter((item) => item.rarity === activeFilters.rarity);
      }
      if (activeFilters.substat) {
        result = result.filter(
          (item) => item.meta?.secondaryStat === activeFilters.substat
        );
      }
    }

    if (
      activeFilters.ownedOnly &&
      (type === "character" || type === "weapon")
    ) {
      const itemType = type as "character" | "weapon";
      result = result.filter((item) => isOwned(itemType, item.id as string));
    }

    // 4. (Special) 2pc Duplicate Checking
    if (type === "artifact" && artifactTab === "2pc" && pickingSlot) {
      const otherValue = pickingSlot === 1 ? mixedSlot2 : mixedSlot1;
      if (otherValue !== null) {
        result = result.filter((item) => {
          if (item.id !== otherValue) return true;
          const original = artifactHalfSetsById[item.id];
          return original && original.setIds.length >= 2;
        });
      }
    }

    return result;
  }, [
    items,
    filter,
    search,
    activeFilters,
    isOwned,
    type,
    artifactTab,
    pickingSlot,
    mixedSlot1,
    mixedSlot2,
  ]);

  // Handler for artifact 2pc selection
  const handleHalfSetSelect = (halfId: string) => {
    if (pickingSlot === 1) {
      setMixedSlot1(halfId);
    } else if (pickingSlot === 2) {
      setMixedSlot2(halfId);
    }
    setPickingSlot(null);
  };

  // Confirm 2pc selection
  const confirmMixedSet = () => {
    if (mixedSlot1 !== null && mixedSlot2 !== null) {
      onSelect({ type: "2pc+2pc", halfSetIds: [mixedSlot1, mixedSlot2] });
    }
  };

  const isMixedComplete = mixedSlot1 !== null && mixedSlot2 !== null;

  // Render Logic
  const renderItem = (item: PickerItem) => {
    // Determine selection state
    let isSelected = false;
    if (type === "artifact" && artifactTab === "2pc") {
      // Check against current picking slot
      // For 2pc 2pc, we don't really highlight unless it is picked
    } else {
      // Normal selection check
      isSelected = value === item.id;
    }

    const name =
      type === "character"
        ? t.character(item.id as string)
        : type === "weapon"
          ? t.weapon(item.id as string)
          : type === "artifact" && artifactTab === "4pc"
            ? t.artifact(item.id as string)
            : t.artifactHalfSet(item.id);

    const tooltip =
      type === "character" ? (
        <CharacterTooltip characterId={item.id as string} />
      ) : type === "weapon" ? (
        <WeaponTooltip weaponId={item.id as string} />
      ) : type === "artifact" && artifactTab === "4pc" ? (
        <ArtifactTooltip setId={item.id as string} />
      ) : null;

    if (type === "artifact" && artifactTab === "2pc") {
      const original = item.original;
      return (
        <div
          key={item.id}
          onClick={() => handleHalfSetSelect(item.id as string)}
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
            isSelected && "ring-2 ring-primary"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-tight">{name}</div>
          </div>
          {/* Show icons for rarity 5 sets only */}
          <div className="flex -space-x-4">
            {(original as ArtifactHalfSet).setIds
              .filter((setId: string) => artifactsById[setId]?.rarity === 5)
              .map((setId: string) => {
                const art = artifactsById[setId];
                return (
                  <div
                    key={setId}
                    className="w-10 h-10 rounded-full border-2 border-background bg-secondary overflow-hidden shrink-0 z-0 hover:z-10 transition-all"
                  >
                    <img
                      src={getAssetUrl(art.imagePaths.flower)}
                      className="w-full h-full object-cover"
                      alt={art.id}
                    />
                  </div>
                );
              })}
          </div>
        </div>
      );
    }

    return (
      <Tooltip key={item.id} disableHoverableContent>
        <TooltipTrigger asChild>
          <div
            onClick={() => {
              if (type === "artifact") {
                onSelect({ type: "4pc", setId: item.id as string });
              } else {
                onSelect(item.id as string);
              }
            }}
            className={cn(
              "relative cursor-pointer hover:scale-105 transition-all rounded-md group w-fit",
              isSelected && "ring-2 ring-primary"
            )}
          >
            <ItemIcon
              characterId={
                type === "character" ? (item.id as string) : undefined
              }
              weaponId={type === "weapon" ? (item.id as string) : undefined}
              imagePath={
                type !== "character" && type !== "weapon"
                  ? item.imagePath
                  : undefined
              }
              rarity={
                type !== "character" && type !== "weapon"
                  ? item.rarity
                  : undefined
              }
              size={menuSize}
            />
          </div>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent
            side={tooltipSide}
            className="z-[60] bg-transparent border-0 p-0 shadow-none"
          >
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <Tabs
      value={type === "artifact" ? artifactTab : "default"}
      onValueChange={(v) => {
        if (type === "artifact") setArtifactTab(v);
      }}
      className="flex flex-col h-full w-full"
    >
      <div className="p-3 space-y-2 shrink-0 bg-background/95 backdrop-blur z-10 border-b">
        {type === "artifact" && (
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="4pc">{t.ui("buildCard.4pc")}</TabsTrigger>
            <TabsTrigger value="2pc">{t.ui("buildCard.2pc+2pc")}</TabsTrigger>
          </TabsList>
        )}

        {/* Search & Clear */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.ui("common.search")}
              className="pl-8 h-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {onClear && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onClear}
              title={t.ui("common.clear")}
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Quick Filters */}
        {type !== "artifact" && (
          <FilterBar
            type={type}
            activeFilters={activeFilters}
            onChange={setActiveFilters}
            sortedWeaponSecondaryStats={
              type === "weapon" ? sortedWeaponSecondaryStats : undefined
            }
            sortByTier={sortByTier}
            onSortByTierChange={setSortByTier}
            hasTierData={hasTierData}
            hasOwnershipData={hasOwnershipData}
          />
        )}
      </div>

      {/* 2pc Builder Area */}
      {type === "artifact" && artifactTab === "2pc" && (
        <ArtifactMixedBuilder
          mixedSlot1={mixedSlot1}
          mixedSlot2={mixedSlot2}
          pickingSlot={pickingSlot}
          setPickingSlot={setPickingSlot}
          isMixedComplete={isMixedComplete}
          confirmMixedSet={confirmMixedSet}
        />
      )}

      {/* Grid Content */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto p-2 scrollbar-thin overscroll-contain"
          // Flexible height filling the parent container
        )}
      >
        {type === "artifact" && artifactTab === "2pc" && !pickingSlot ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm text-center px-4 space-y-4">
            <p>{t.ui("buildCard.select2pc")}</p>
            <div className="text-xs opacity-70">
              {t.ui("buildCard.select2pcHint")}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-2",
              type === "artifact" && artifactTab === "2pc"
                ? "grid-cols-1"
                : "grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))]"
            )}
          >
            {filteredItems.map(renderItem)}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Search className="h-8 w-8 opacity-20" />
                <span>{t.ui("common.noResults")}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Tabs>
  );
}

function FilterBar({
  type,
  activeFilters,
  onChange,
  sortedWeaponSecondaryStats = [],
  sortByTier,
  onSortByTierChange,
  hasTierData,
  hasOwnershipData,
}: {
  type: ItemPickerType;
  activeFilters: Record<string, string | number>;
  onChange: (f: Record<string, string | number>) => void;
  sortedWeaponSecondaryStats?: MainStat[];
  sortByTier: boolean;
  onSortByTierChange: (v: boolean) => void;
  hasTierData: boolean;
  hasOwnershipData: boolean;
}) {
  const toggle = (key: string, val: string | number) => {
    const next = { ...activeFilters };
    if (next[key] === val) delete next[key];
    else next[key] = val;
    onChange(next);
  };

  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-1.5">
      {/* Rarity + Owned Only */}
      <div className="flex flex-wrap gap-1 items-center">
        {(type === "character"
          ? CHARACTER_RARITY_FILTERS
          : WEAPON_RARITY_FILTERS
        ).map((r) => (
          <FilterChip
            key={`r-${r}`}
            isActive={activeFilters.rarity === r}
            onClick={() => toggle("rarity", r)}
            className="w-auto px-2"
            title={t.ui("filters.rarity")}
          >
            <span className="text-amber-500 text-sm">{"★".repeat(r)}</span>
          </FilterChip>
        ))}
        {(type === "character" || type === "weapon") && (
          <FilterChip
            isActive={!!activeFilters.ownedOnly}
            onClick={() => hasOwnershipData && toggle("ownedOnly", 1)}
            className={cn(
              "w-auto px-2 gap-1",
              !hasOwnershipData && "opacity-40 cursor-not-allowed"
            )}
            title={
              hasOwnershipData
                ? t.ui("common.ownedOnly")
                : t.ui("filters.ownedOnlyDisabled")
            }
          >
            <Bookmark
              className={cn(
                "h-3 w-3",
                activeFilters.ownedOnly && "fill-current"
              )}
            />
            <span className="text-xs">{t.ui("common.ownedOnly")}</span>
          </FilterChip>
        )}
        {type === "character" && (
          <FilterChip
            isActive={sortByTier}
            onClick={() => hasTierData && onSortByTierChange(!sortByTier)}
            className={cn(
              "w-auto px-2 gap-1",
              !hasTierData && "opacity-40 cursor-not-allowed"
            )}
            title={
              hasTierData
                ? t.ui("filters.sortByTier")
                : t.ui("filters.tierSortDisabled")
            }
          >
            <Trophy className="h-3 w-3" />
            <span className="text-xs">{t.ui("filters.sortByTier")}</span>
          </FilterChip>
        )}
      </div>

      {/* Elements (Char only) */}
      {type === "character" && (
        <div className="flex flex-wrap gap-1 items-center">
          {Object.values(elementResourcesByName).map((e) => (
            <FilterChip
              key={e.name}
              isActive={activeFilters.element === e.name}
              onClick={() => toggle("element", e.name)}
              className="p-1 px-1.5"
              title={e.name}
            >
              <img
                src={getAssetUrl(e.imagePath)}
                className="w-5 h-5"
                alt={e.name}
              />
            </FilterChip>
          ))}
        </div>
      )}

      {/* Weapon Type (Char only) */}
      {type === "character" && (
        <div className="flex flex-wrap gap-1 items-center">
          {Object.values(weaponResourcesByName).map((w) => (
            <FilterChip
              key={w.name}
              isActive={activeFilters.weapon === w.name}
              onClick={() => toggle("weapon", w.name)}
              className="p-1 px-1.5"
              title={w.name}
            >
              <img
                src={getAssetUrl(w.imagePath)}
                className="w-5 h-5"
                alt={w.name}
              />
            </FilterChip>
          ))}
        </div>
      )}

      {/* Substat (Weapon only) */}
      {type === "weapon" && (
        <div className="flex flex-wrap gap-1 items-center">
          {sortedWeaponSecondaryStats.map((s: MainStat) => (
            <FilterChip
              key={s}
              isActive={activeFilters.substat === s}
              onClick={() => toggle("substat", s)}
              className="uppercase text-xs px-1"
              title={t.statShort(s)}
            >
              {t.statShort(s)}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  children,
  isActive,
  onClick,
  className,
  title,
}: {
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "h-7 border rounded-md text-xs font-medium transition-all shrink-0 flex items-center justify-center",
        isActive
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80",
        className
      )}
    >
      {children}
    </button>
  );
}

export const ItemPicker = memo(
  ItemPickerComponent
) as typeof ItemPickerComponent;
