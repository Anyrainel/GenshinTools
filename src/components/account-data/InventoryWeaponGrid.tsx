import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponDataHoverCard } from "@/components/shared/WeaponDataHoverCard";
import { Card } from "@/components/ui/card";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { WeaponData } from "@/data/types";
import { cn } from "@/lib/utils";
import type { ChipColor } from "../shared/colors";

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3 px-2">
      {weapons.map((w) => {
        const name = t.weapon(w.key);

        const cardContent = (
          <Card
            className={cn(
              "group flex w-full min-w-0 flex-col items-center border-0 bg-transparent shadow-none",
              isEditMode && "cursor-pointer"
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
            </div>
            <div className="line-clamp-2 w-full min-w-0 break-words pt-1 text-center text-xs font-medium leading-tight opacity-90 transition-colors group-hover:text-white group-hover:opacity-100">
              {name}
            </div>
          </Card>
        );

        if (isEditMode) {
          return (
            <div key={w.id} className="min-w-0">
              {cardContent}
            </div>
          );
        }

        return (
          <WeaponDataHoverCard key={w.id} weapon={w} side="right">
            {cardContent}
          </WeaponDataHoverCard>
        );
      })}
    </div>
  );
}
