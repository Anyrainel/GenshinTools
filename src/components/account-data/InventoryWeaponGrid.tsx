import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { WeaponData } from "@/data/types";
import type { ChipColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TaggedWeapon = WeaponData & { equipped: boolean };
type GroupedWeapon = TaggedWeapon & { count: number };
type T = ReturnType<typeof useLanguage>["t"];

export const rarityColor: Record<number, ChipColor> = {
  5: "rarity-5",
  4: "rarity-4",
  3: "rarity-3",
};

export function groupWeapons(list: TaggedWeapon[]): GroupedWeapon[] {
  const result: GroupedWeapon[] = [];
  const seen = new Set<string>();

  for (const w of list) {
    const groupKey = `${w.key}-L${w.level}-R${w.refinement}-E${w.equipped}`;
    if (seen.has(groupKey)) continue;

    const count = list.filter(
      (item) =>
        item.key === w.key &&
        item.level === w.level &&
        item.refinement === w.refinement &&
        item.equipped === w.equipped
    ).length;

    result.push({ ...w, count });
    seen.add(groupKey);
  }
  return result;
}

interface InventoryWeaponGridProps {
  weapons: GroupedWeapon[];
  iconSize: "lg" | "xl";
  t: T;
  isEditMode: boolean;
  onWeaponClick: (w: TaggedWeapon) => void;
}

export function InventoryWeaponGrid({
  weapons,
  iconSize,
  t,
  isEditMode,
  onWeaponClick,
}: InventoryWeaponGridProps) {
  return (
    <div className="flex flex-wrap gap-3 px-2">
      {weapons.map((w) => {
        const name = t.weapon(w.key);

        const cardContent = (
          <Card
            className={cn(
              "flex flex-col bg-transparent border-0 shadow-none group",
              isEditMode ? "cursor-pointer" : "cursor-help"
            )}
            onClick={isEditMode ? () => onWeaponClick(w) : undefined}
          >
            <div className="relative transition-transform group-hover:scale-105 duration-200">
              <ItemIcon
                weaponId={w.key}
                badge={w.refinement}
                lock={w.lock}
                level={`Lv. ${w.level}`}
                size={iconSize}
              />
              {w.count > 1 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/60 text-white font-bold text-lg px-2 py-0.5 rounded-full shadow-sm backdrop-blur-[2px]">
                    x{w.count}
                  </div>
                </div>
              )}
              {w.equipped && (
                <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-green-400 shadow-sm" />
              )}
            </div>
            <div className="pt-1 text-xs text-center font-medium opacity-90 group-hover:opacity-100 group-hover:text-white transition-colors line-clamp-2 leading-tight">
              {name}
            </div>
          </Card>
        );

        if (isEditMode) {
          return <div key={w.id}>{cardContent}</div>;
        }

        return (
          <Tooltip key={w.id}>
            <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
            <TooltipContent
              side="right"
              className="p-0 border-none bg-transparent"
            >
              <WeaponTooltip weaponId={w.key} />
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
