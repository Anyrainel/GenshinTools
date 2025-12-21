import { useState, useMemo, memo } from "react";
import {
  charactersById,
  weaponsById,
  artifactsById,
  sortedCharacters,
  sortedWeapons,
  sortedArtifacts,
} from "@/data/constants";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAssetUrl, cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Input } from "@/components/ui/input";
import { Search, Ban } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Character, Weapon, ArtifactSet } from "@/data/types";

export type ItemPickerType = "character" | "weapon" | "artifact";

type Item = Character | Weapon | ArtifactSet;

interface ItemPickerProps {
  type: ItemPickerType;
  value: string | null;
  onChange: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  filter?: (item: Item) => boolean;
  className?: string;
  tooltipSide?: "left" | "right";
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
      config.getName(item.id).toLowerCase().includes(search.toLowerCase()),
    );
  }, [search, config, filter]);

  const triggerContent = selectedItem ? (
    <ItemIcon
      imagePath={selectedItem.imagePath}
      rarity={selectedItem.rarity}
      alt={config.getName(selectedItem.id)}
      size="full"
      className={THEME.picker.wrapper}
    />
  ) : (
    <div className={cn(THEME.picker.placeholder, "select-none")}>
      <span className="text-4xl text-muted-foreground select-none">+</span>
    </div>
  );

  const calcOffset = function (index: number) {
    return (tooltipSide == "right" ? 5 - (index % 6) : index % 6) * 62 + 12;
  };

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
                THEME.picker.trigger,
                "select-none",
                disabled && THEME.picker.triggerDisabled,
                className,
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

      <PopoverContent
        className={cn(THEME.picker.popoverContent)}
        side="right"
        align="start"
      >
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
            className={THEME.picker.itemGrid}
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
                      "cursor-pointer hover:scale-110 hover:brightness-125 transition-all rounded-md relative",
                    )}
                  >
                    <ItemIcon
                      imagePath={item.imagePath}
                      rarity={item.rarity}
                      alt={config.getName(item.id)}
                      size="w-14 h-14" // THEME.picker.itemWrapper is w-14 h-14
                      className="rounded-md"
                    />
                    {/* Traveler Element Overlay - Keep this custom logic or integrate into ItemIcon?
                         ItemIcon handles simple labels. This is a complex overlay. Keep it here for now.
                      */}
                    {type === "character" &&
                      item.id.startsWith("traveler") &&
                      (item as Character).element && (
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full backdrop-blur-sm bg-black/50 p-0.5 z-10 pointer-events-none w-6 h-6">
                          <img
                            src={getAssetUrl(
                              `element/${(item as Character).element.toLowerCase()}.png`,
                            )}
                            alt={(item as Character).element}
                            className="w-5 h-5 drop-shadow-md"
                          />
                        </div>
                      )}
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
                  THEME.picker.itemWrapper,
                  "bg-muted border-2 border-dashed border-muted-foreground/30 hover:bg-muted/80 flex justify-center items-center",
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
