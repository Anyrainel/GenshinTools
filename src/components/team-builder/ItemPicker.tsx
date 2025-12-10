import { useState, useMemo } from "react";
import { characters, weapons, artifacts } from "@/data/resources";
import { charactersById, weaponsById, artifactsById } from "@/data/constants";
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
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
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
  disabled?: boolean;
  filter?: (item: Item) => boolean;
}

export function ItemPicker({
  type,
  value,
  onChange,
  disabled,
  filter,
}: ItemPickerProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Determine configuration based on type
  const config = useMemo(() => {
    switch (type) {
      case "character":
        return {
          items: characters,
          getItem: (id: string) => charactersById[id] as Character,
          getName: (id: string) => t.character(id),
          placeholder: t.ui("teamBuilder.selectCharacter"),
          tooltip: (id: string) => <CharacterTooltip characterId={id} />,
        };
      case "weapon":
        return {
          items: weapons,
          getItem: (id: string) => weaponsById[id] as Weapon,
          getName: (id: string) => t.weaponName(id),
          placeholder: t.ui("teamBuilder.selectWeapon"),
          tooltip: (id: string) => <WeaponTooltip weaponId={id} />,
        };
      case "artifact":
        return {
          items: artifacts,
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
    <div
      className={cn(
        THEME.picker.wrapper,
        "select-none",
        selectedItem.rarity
          ? THEME.rarity.bg[selectedItem.rarity as keyof typeof THEME.rarity.bg]
          : "bg-gray-500",
      )}
    >
      <img
        src={getAssetUrl(selectedItem.imagePath)}
        alt={config.getName(selectedItem.id)}
        className={THEME.picker.imageCover}
        draggable={false}
      />
    </div>
  ) : (
    <div className={cn(THEME.picker.placeholder, "select-none")}>
      <span className="text-4xl text-muted-foreground select-none">+</span>
    </div>
  );

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
          <div className={THEME.picker.itemGrid}>
            {filteredItems.map((item, index) => (
              <Tooltip key={item.id} disableHoverableContent>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      THEME.picker.itemWrapper,
                      item.rarity
                        ? THEME.rarity.bg[
                            item.rarity as keyof typeof THEME.rarity.bg
                          ]
                        : "bg-gray-500",
                      value === item.id && THEME.picker.itemSelected,
                    )}
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                    }}
                  >
                    <img
                      src={getAssetUrl(item.imagePath)}
                      alt={config.getName(item.id)}
                      className={THEME.picker.imageCover}
                      loading="lazy"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="start"
                  sideOffset={(5 - (index % 6)) * 64 + 4}
                  className="p-0 border-0 bg-transparent shadow-none z-[60]"
                >
                  {config.tooltip(item.id)}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
