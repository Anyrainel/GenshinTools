import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import {
  ItemIcon,
  type ItemIconSize,
  SIZE_CLASSES,
} from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactsById,
  charactersById,
  sortedArtifacts,
  sortedCharacters,
  sortedWeapons,
  weaponsById,
} from "@/data/constants";
import type { ArtifactSet, Character, Weapon } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { Ban, Search } from "lucide-react";
import { memo, useMemo, useState } from "react";

export type ItemPickerType = "character" | "weapon" | "artifact";

type Item = Character | Weapon | ArtifactSet;

// Re-export for convenience
export type { ItemIconSize };
interface ItemPickerProps {
  type: ItemPickerType;
  value: string | null;
  onChange: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  filter?: (item: Item) => boolean;
  className?: string;
  tooltipSide?: "left" | "right";
  triggerSize?: ItemIconSize; // Size of the trigger icon (default: lg)
  menuSize?: ItemIconSize; // Size of menu item icons (default: md)
}

function ItemPickerComponent({
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
}: ItemPickerProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Determine configuration based on type
  const config = useMemo(() => {
    switch (type) {
      case "character":
        return {
          items: sortedCharacters,
          getItem: (id: string) => charactersById[id] as Character,
          getName: (id: string) => t.character(id),
          placeholder: t.ui("teamBuilder.selectCharacter"),
          tooltip: (id: string) => <CharacterTooltip characterId={id} />,
        };
      case "weapon":
        return {
          items: sortedWeapons,
          getItem: (id: string) => weaponsById[id] as Weapon,
          getName: (id: string) => t.weaponName(id),
          placeholder: t.ui("teamBuilder.selectWeapon"),
          tooltip: (id: string) => <WeaponTooltip weaponId={id} />,
        };
      case "artifact":
        return {
          items: sortedArtifacts,
          getItem: (id: string) => artifactsById[id] as ArtifactSet,
          getName: (id: string) => t.artifact(id),
          placeholder: t.ui("teamBuilder.selectArtifact"),
          tooltip: (id: string) => <ArtifactTooltip setId={id} />,
        };
    }
  }, [type, t]);

  const selectedItem = value ? config.getItem(value) : null;

  const filteredItems = useMemo(() => {
    let list: Item[] = config.items;
    if (filter) {
      list = list.filter(filter);
    }
    return list.filter((item) =>
      config.getName(item.id).toLowerCase().includes(search.toLowerCase())
    );
  }, [search, config, filter]);

  const getImagePath = (item: Item) => {
    if (type === "artifact") {
      return (item as ArtifactSet).imagePaths.flower;
    }
    return (item as Character | Weapon).imagePath;
  };

  const triggerContent = selectedItem ? (
    <ItemIcon
      imagePath={getImagePath(selectedItem)}
      rarity={selectedItem.rarity}
      alt={config.getName(selectedItem.id)}
      size={triggerSize}
    />
  ) : (
    <div
      className={cn(
        SIZE_CLASSES[triggerSize],
        "bg-secondary/30 border-dashed border-2 border-border",
        "flex items-center justify-center hover:bg-secondary/50 transition-colors select-none"
      )}
    >
      <span className="text-4xl text-muted-foreground select-none">+</span>
    </div>
  );

  const calcOffset = (index: number) =>
    (tooltipSide === "right" ? 5 - (index % 6) : index % 6) * 62 + 12;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => !disabled && setIsOpen(open)}
    >
      <Tooltip disableHoverableContent>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild disabled={disabled}>
            <div
              className={cn(
                "cursor-pointer hover:scale-105 transition-transform select-none",
                disabled && "opacity-50 cursor-not-allowed hover:scale-100",
                className
              )}
            >
              {triggerContent}
            </div>
          </PopoverTrigger>
        </TooltipTrigger>
        {selectedItem && !isOpen && (
          <TooltipContent
            side="right"
            className="p-0 border-0 bg-transparent shadow-none z-[60]"
          >
            {config.tooltip(selectedItem.id)}
          </TooltipContent>
        )}
      </Tooltip>

      <PopoverContent className="w-[392px] p-2" side="right" align="start">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={config.placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-2"
            />
          </div>
          <div
            className="grid grid-cols-6 gap-2 max-h-[300px] overflow-y-auto p-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {filteredItems.map((item, index) => (
              <Tooltip key={item.id} disableHoverableContent>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "cursor-pointer hover:scale-110 hover:brightness-125 transition-all rounded-md relative"
                    )}
                  >
                    <ItemIcon
                      imagePath={getImagePath(item)}
                      rarity={item.rarity}
                      alt={config.getName(item.id)}
                      size={menuSize}
                      className="rounded-md"
                    >
                      {/* Traveler Element Overlay */}
                      {type === "character" &&
                        item.id.startsWith("traveler") &&
                        (item as Character).element && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full backdrop-blur-sm bg-black/50 p-0.5 z-10 pointer-events-none w-6 h-6">
                            <img
                              src={getAssetUrl(
                                `element/${(item as Character).element.toLowerCase()}.png`
                              )}
                              alt={(item as Character).element}
                              className="w-5 h-5 drop-shadow-md"
                            />
                          </div>
                        )}
                    </ItemIcon>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side={tooltipSide}
                  align="start"
                  sideOffset={calcOffset(index)}
                  className="p-0 border-0 bg-transparent shadow-none z-[60]"
                >
                  {config.tooltip(item.id)}
                </TooltipContent>
              </Tooltip>
            ))}
            {onClear && value && (
              <div
                className={cn(
                  SIZE_CLASSES[menuSize],
                  "rounded-md overflow-hidden relative cursor-pointer hover:ring-2 ring-primary transition-all",
                  "bg-muted border-2 border-dashed border-muted-foreground/30 hover:bg-muted/80 flex justify-center items-center"
                )}
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
              >
                <Ban className="w-8 h-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ItemPicker = memo(ItemPickerComponent);
