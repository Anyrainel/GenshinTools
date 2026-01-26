import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { DoubleItemIcon } from "@/components/shared/DoubleItemIcon";
import {
  ItemIcon,
  type ItemIconSize,
  SIZE_CLASSES,
} from "@/components/shared/ItemIcon";
import { MixedSetTooltip } from "@/components/shared/MixedSetTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactHalfSetsById,
  artifactsById,
  charactersById,
  elementResourcesByName,
  sortedArtifacts,
  sortedCharacters,
  sortedWeaponSecondaryStats,
  sortedWeapons,
  weaponResourcesByName,
  weaponsById,
} from "@/data/constants";
import { artifactHalfSets } from "@/data/resources";
import type {
  ArtifactHalfSet,
  ArtifactSet,
  Character,
  MainStat,
  Rarity,
  Weapon,
} from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getAssetUrl } from "@/lib/utils";
import { Ban, Check, Search, X } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

export type ItemPickerType = "character" | "weapon" | "artifact";

export type ArtifactConfig =
  | { type: "4pc"; setId: string }
  | { type: "2pc+2pc"; id1: number; id2: number };

type ValueType<T> = T extends "artifact" ? ArtifactConfig : string;

interface ItemPickerProps<T extends ItemPickerType> {
  type: T;
  value: ValueType<T> | null;
  onChange: (value: ValueType<T>) => void;
  onClear?: () => void;
  disabled?: boolean;
  filter?: (item: unknown) => boolean;
  className?: string;
  tooltipSide?: "left" | "right";
  triggerSize?: ItemIconSize;
  menuSize?: ItemIconSize;
  placeholder?: string;
  showItemName?: boolean;
}

const RARITY_FILTERS = [5, 4, 3] as const;

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
}: ItemPickerProps<T>) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!disabled) setIsOpen(open);
    },
    [disabled]
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
      filter={filter}
      menuSize={menuSize}
      tooltipSide={tooltipSide}
      isDesktop={isDesktop}
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
          </DrawerHeader>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
      </DrawerContent>
    </Drawer>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

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
  else if (type === "weapon") name = t.weaponName(value as string);
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
      content = <MixedSetTooltip id1={value.id1} id2={value.id2} />;
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
}: {
  type: ItemPickerType;
  value: ValueType<ItemPickerType> | null;
  size: ItemIconSize;
  disabled?: boolean;
}) {
  // const { t } = useLanguage(); // Not used currently?

  const baseClasses = cn(
    SIZE_CLASSES[size],
    "rounded-md border-2 border-border transition-all flex items-center justify-center shadow-sm relative overflow-hidden",
    disabled
      ? "bg-muted border-dashed opacity-70"
      : "bg-gradient-select hover:shadow-md"
  );

  if (!value) {
    return (
      <div
        className={cn(
          baseClasses,
          "border-dashed ring-1 ring-inset ring-foreground/20"
        )}
      >
        <span className="text-4xl text-muted-foreground/50 select-none pb-1 group-hover:text-primary transition-colors">
          +
        </span>
      </div>
    );
  }

  if (type === "artifact") {
    const conf = value as ArtifactConfig;
    if (conf.type === "4pc") {
      const art = artifactsById[conf.setId];
      return (
        <ItemIcon
          imagePath={art?.imagePaths.flower}
          rarity={art?.rarity ?? 5}
          size={size}
        />
      );
    }
    const half1 = artifactHalfSetsById[conf.id1];
    const half2 = artifactHalfSetsById[conf.id2];
    // Prefer rarity 5 artifacts for display
    const art1 = half1?.setIds
      .map((id) => artifactsById[id])
      .find((a) => a?.rarity === 5);
    const art2 = half2?.setIds
      .filter((id) => half2 !== half1 || id !== art1?.id)
      .map((id) => artifactsById[id])
      .find((a) => a?.rarity === 5);

    return (
      <DoubleItemIcon
        imagePath1={art1?.imagePaths.flower || ""}
        imagePath2={art2?.imagePaths.flower || ""}
        size={size}
        alt1={art1?.id}
        alt2={art2?.id}
      />
    );
  }

  // Character / Weapon
  let item: Character | Weapon | undefined;
  if (type === "character") item = charactersById[value as string];
  else item = weaponsById[value as string];

  return (
    <ItemIcon imagePath={item?.imagePath} rarity={item?.rarity} size={size} />
  );
}

// Normalized interface for the grid items
interface PickerItem {
  id: string | number;
  imagePath: string;
  rarity: Rarity;
  name?: string; // Can be lazily loaded in render but good to have for mapping
  // We keep original just in case we need extra properties
  original: Character | Weapon | ArtifactSet | ArtifactHalfSet;
}

interface PickerContentProps {
  type: ItemPickerType;
  value: ValueType<ItemPickerType> | null;
  onSelect: (val: ValueType<ItemPickerType>) => void;
  onClear?: () => void;
  filter?: (
    item: Character | Weapon | ArtifactSet | ArtifactHalfSet
  ) => boolean;
  menuSize: ItemIconSize;
  tooltipSide: "left" | "right";
  isDesktop: boolean;
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
}: PickerContentProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | number>
  >({});

  // Artifact Specific State
  const initialTab =
    type === "artifact" && (value as ArtifactConfig)?.type === "2pc+2pc"
      ? "2pc"
      : "4pc";
  const [artifactTab, setArtifactTab] = useState(initialTab);

  // Helper to extract 2pc IDs
  const getInitialMixedSlots = (): [number | null, number | null] => {
    if (
      type === "artifact" &&
      value &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "2pc+2pc"
    ) {
      return [value.id1, value.id2];
    }
    return [null, null];
  };

  const [initialSlot1, initialSlot2] = getInitialMixedSlots();

  const [mixedSlot1, setMixedSlot1] = useState<number | null>(initialSlot1);
  const [mixedSlot2, setMixedSlot2] = useState<number | null>(initialSlot2);
  const [pickingSlot, setPickingSlot] = useState<1 | 2 | null>(null);

  // Unified Item Mapping
  const items: PickerItem[] = useMemo(() => {
    if (type === "character") {
      return sortedCharacters.map((c) => ({
        id: c.id,
        imagePath: c.imagePath,
        rarity: c.rarity,
        original: c,
      }));
    }
    if (type === "weapon") {
      return sortedWeapons.map((w) => ({
        id: w.id,
        imagePath: w.imagePath,
        rarity: w.rarity,
        original: w,
      }));
    }
    if (type === "artifact") {
      if (artifactTab === "4pc") {
        return sortedArtifacts.map((a) => ({
          id: a.id,
          imagePath: a.imagePaths.flower,
          rarity: a.rarity,
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
          original: half,
        }));
    }
    return [];
  }, [type, artifactTab]);

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
      result = result.filter((item) => {
        let name = "";
        if (type === "character") name = t.character(item.id as string);
        else if (type === "weapon") name = t.weaponName(item.id as string);
        else if (type === "artifact" && artifactTab === "4pc")
          name = t.artifact(item.id as string);
        else if (type === "artifact" && artifactTab === "2pc")
          name = t.artifactHalfSet(item.id as number);

        return name?.toLowerCase().includes(q);
      });
    }

    // 3. Quick Filters
    if (type === "character") {
      if (activeFilters.element) {
        result = result.filter(
          (item) =>
            (item.original as Character).element === activeFilters.element
        );
      }
      if (activeFilters.weapon) {
        result = result.filter(
          (item) =>
            (item.original as Character).weaponType === activeFilters.weapon
        );
      }
      if (activeFilters.rarity) {
        result = result.filter(
          (item) => (item.original as Character).rarity === activeFilters.rarity
        );
      }
    } else if (type === "weapon") {
      if (activeFilters.rarity) {
        result = result.filter(
          (item) => (item.original as Weapon).rarity === activeFilters.rarity
        );
      }
      if (activeFilters.substat) {
        result = result.filter(
          (item) =>
            (item.original as Weapon).secondaryStat === activeFilters.substat
        );
      }
    }

    // 4. (Special) 2pc Duplicate Checking
    if (type === "artifact" && artifactTab === "2pc" && pickingSlot) {
      const otherValue = pickingSlot === 1 ? mixedSlot2 : mixedSlot1;
      if (otherValue !== null) {
        result = result.filter((item) => {
          if (item.id !== otherValue) return true;
          const original = artifactHalfSetsById[item.id as number];
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
    type,
    artifactTab,
    t,
    pickingSlot,
    mixedSlot1,
    mixedSlot2,
  ]);

  // Handler for artifact 2pc selection
  const handleHalfSetSelect = (halfId: string | number) => {
    if (pickingSlot === 1) {
      setMixedSlot1(halfId as number);
    } else if (pickingSlot === 2) {
      setMixedSlot2(halfId as number);
    }
    setPickingSlot(null);
  };

  // Confirm 2pc selection
  const confirmMixedSet = () => {
    if (mixedSlot1 !== null && mixedSlot2 !== null) {
      onSelect({ type: "2pc+2pc", id1: mixedSlot1, id2: mixedSlot2 });
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
          ? t.weaponName(item.id as string)
          : type === "artifact" && artifactTab === "4pc"
            ? t.artifact(item.id as string)
            : t.artifactHalfSet(item.id as number);

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
          onClick={() => handleHalfSetSelect(item.id)}
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
              "relative cursor-pointer hover:scale-105 transition-all rounded-md group",
              isSelected && "ring-2 ring-primary"
            )}
          >
            <ItemIcon
              imagePath={item.imagePath}
              rarity={item.rarity}
              size={menuSize}
            >
              {type === "character" &&
                (item.id as string).startsWith("traveler") &&
                (item.original as Character).element && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 bg-black/50 backdrop-blur-sm rounded-full p-0.5">
                    <img
                      src={getAssetUrl(
                        `element/${(item.original as Character).element.toLowerCase()}.png`
                      )}
                      className="w-full h-full object-contain"
                      alt={(item.original as Character).element}
                    />
                  </div>
                )}
            </ItemIcon>
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
      <div className="p-3 space-y-3 shrink-0 bg-background/95 backdrop-blur z-10 border-b">
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
          />
        )}
      </div>

      {/* 2pc Builder Area */}
      {type === "artifact" && artifactTab === "2pc" && (
        <div className="px-3 pb-3 shrink-0 flex gap-2 items-center border-b bg-muted/20 pt-2">
          <Button
            type="button"
            variant={pickingSlot === 1 ? "default" : "outline"}
            className={cn(
              "flex-1 h-12 relative",
              !pickingSlot && mixedSlot1 && "border-primary/50"
            )}
            onClick={() => setPickingSlot(pickingSlot === 1 ? null : 1)}
          >
            {mixedSlot1 ? (
              <span className="text-xs line-clamp-2 leading-tight">
                {t.artifactHalfSet(mixedSlot1)}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t.ui("buildCard.effect1")}
              </span>
            )}
          </Button>

          <span className="text-muted-foreground font-bold">+</span>

          <Button
            type="button"
            variant={pickingSlot === 2 ? "default" : "outline"}
            className={cn(
              "flex-1 h-12 relative",
              !pickingSlot && mixedSlot2 && "border-primary/50"
            )}
            onClick={() => setPickingSlot(pickingSlot === 2 ? null : 2)}
          >
            {mixedSlot2 ? (
              <span className="text-xs line-clamp-2 leading-tight">
                {t.artifactHalfSet(mixedSlot2)}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t.ui("buildCard.effect2")}
              </span>
            )}
          </Button>

          <Button
            type="button"
            size="icon"
            disabled={!isMixedComplete}
            onClick={confirmMixedSet}
            className={cn(
              "shrink-0",
              isMixedComplete ? "animate-pulse" : "opacity-50"
            )}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
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
            <p>{t.ui("buildCard.select2pcPrompt")}</p>
            <div className="text-xs opacity-70">
              {t.ui("buildCard.select2pcPromptHint")}
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
}: {
  type: ItemPickerType;
  activeFilters: Record<string, string | number>;
  onChange: (f: Record<string, string | number>) => void;
}) {
  const toggle = (key: string, val: string | number) => {
    const next = { ...activeFilters };
    if (next[key] === val) delete next[key];
    else next[key] = val;
    onChange(next);
  };

  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Rarity */}
      <div className="flex flex-wrap gap-1 items-center">
        {RARITY_FILTERS.map((r) => (
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
                className="w-5 h-5 invert dark:invert-0"
                alt={w.name}
              />
            </FilterChip>
          ))}
        </div>
      )}

      {/* Substat (Weapon only) */}
      {type === "weapon" && (
        <div className="flex flex-wrap gap-1 items-center">
          {sortedWeaponSecondaryStats.map((s) => (
            <FilterChip
              key={s}
              isActive={activeFilters.substat === s}
              onClick={() => toggle("substat", s)}
              className="uppercase text-xs px-1"
              title={t.statShort(s as MainStat)}
            >
              {t.statShort(s as MainStat)}
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
