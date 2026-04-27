import { useMemo, useState } from "react";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import { type Element, elements, type Rarity } from "@/data/enums";
import { charactersById, elementResourcesByName } from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
} from "@/data/gameStatsLoader";
import type { CharacterData } from "@/data/types";
import { useToggleSet } from "@/hooks/useToggleSet";
import { cn, getAssetUrl } from "@/lib/utils";
import { type InventoryChipOption, InventoryChipRow } from "./InventoryChipRow";
import { rarityColor } from "./InventoryWeaponGrid";

const CHARACTER_RARITIES: Rarity[] = [5, 4];

const isMaxCharacter = (c: CharacterData) => c.level >= 90;

interface InventoryCharacterSectionProps {
  characters: CharacterData[];
  iconSize: "lg" | "xl";
}

export function InventoryCharacterSection({
  characters,
  iconSize,
}: InventoryCharacterSectionProps) {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const [showMaxLevel, setShowMaxLevel] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [rarities, toggleRarity] = useToggleSet<Rarity>(CHARACTER_RARITIES);
  const [selectedElements, setSelectedElements] = useState<Set<Element>>(
    () => new Set()
  );

  const filteredCharacters = useMemo(() => {
    return characters
      .filter((c) => {
        const levelMatch = isMaxCharacter(c) ? showMaxLevel : showOther;
        if (!levelMatch) return false;

        const info = charactersById[c.key];
        if (!info) return false;

        const meta = getCharacterDisplayMeta(info, characterStats?.[c.key]);
        if (!rarities.has(meta.rarity)) return false;

        if (selectedElements.size > 0) {
          if (!meta.element || !selectedElements.has(meta.element)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const infoA = charactersById[a.key];
        const infoB = charactersById[b.key];
        const metaA = infoA
          ? getCharacterDisplayMeta(infoA, characterStats?.[a.key])
          : null;
        const metaB = infoB
          ? getCharacterDisplayMeta(infoB, characterStats?.[b.key])
          : null;

        if (metaA && metaB && metaA.rarity !== metaB.rarity) {
          return metaB.rarity - metaA.rarity;
        }
        if (
          metaA?.element != null &&
          metaB?.element != null &&
          metaA.element !== metaB.element
        ) {
          return metaA.element.localeCompare(metaB.element);
        }
        return t.character(a.key).localeCompare(t.character(b.key));
      });
  }, [
    characters,
    showMaxLevel,
    showOther,
    rarities,
    selectedElements,
    characterStats,
    t,
  ]);

  const categoryChips: InventoryChipOption[] = [
    {
      key: "max-level",
      label: t.ui("accountData.maxLevel"),
      color: "lime",
      active: showMaxLevel,
      onClick: () => setShowMaxLevel((p) => !p),
    },
    {
      key: "other-level",
      label: t.ui("accountData.other"),
      color: "lime",
      active: showOther,
      onClick: () => setShowOther((p) => !p),
    },
    ...CHARACTER_RARITIES.map((rarity, index) => ({
      key: `rarity-${rarity}`,
      label: `${rarity}★`,
      color: rarityColor[rarity] ?? "sky",
      active: rarities.has(rarity),
      separatorBefore: index === 0,
      onClick: () => toggleRarity(rarity),
    })),
  ];

  return (
    <>
      <InventoryChipRow chips={categoryChips} className="gap-1.5" />
      <FilterChipGroup
        label={t.ui("accountData.filterByElement")}
        options={elements}
        selectedValues={selectedElements}
        onSelectedValuesChange={setSelectedElements}
        getKey={(element) => element}
        getIcon={(element) => {
          const resource = elementResourcesByName[element];
          return (
            <img
              src={getAssetUrl(resource.imagePath)}
              alt={element}
              className="w-4 h-4"
            />
          );
        }}
        getLabel={(element) => t.element(element)}
      />
      <InventoryCharacterGrid
        characters={filteredCharacters}
        iconSize={iconSize}
        t={t}
      />
    </>
  );
}

function InventoryCharacterGrid({
  characters,
  iconSize,
  t,
}: {
  characters: CharacterData[];
  iconSize: "lg" | "xl";
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="flex flex-wrap gap-3 px-2">
      {characters.map((char) => {
        const name = t.character(char.key);

        const cardContent = (
          <Card className="flex flex-col bg-transparent border-0 shadow-none group cursor-help">
            <div className="relative transition-transform group-hover:scale-105 duration-200">
              <ItemIcon
                characterId={char.key}
                badge={char.constellation}
                level={`Lv. ${char.level}`}
                size={iconSize}
              />
            </div>
            <div
              className={cn(
                "pt-1 text-xs text-center font-medium opacity-90",
                "group-hover:opacity-100 group-hover:text-white transition-colors line-clamp-2 leading-tight"
              )}
            >
              {name}
            </div>
          </Card>
        );

        return (
          <Tooltip key={char.key}>
            <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
            <TooltipContent
              side="right"
              className="p-0 border-none bg-transparent"
            >
              <CharacterTooltip characterId={char.key} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
