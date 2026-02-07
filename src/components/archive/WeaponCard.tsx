import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Weapon } from "@/data/types";
import { cn } from "@/lib/utils";
import { memo } from "react";

export const WeaponCard = memo(({ weapon }: { weapon: Weapon }) => {
  const { t } = useLanguage();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg w-[200px]",
            "bg-card/50",
            "hover:ring-2 hover:ring-primary/80",
            "transition-all cursor-pointer"
          )}
        >
          <ItemIcon
            imagePath={weapon.imagePath}
            rarity={weapon.rarity}
            size="sm"
            className="shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium line-clamp-2 leading-tight">
              {t.weaponName(weapon.id)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t.statShort(weapon.secondaryStat)}
            </div>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="p-0 bg-transparent border-0"
      >
        <WeaponTooltip weaponId={weapon.id} />
      </TooltipContent>
    </Tooltip>
  );
});
WeaponCard.displayName = "WeaponCard";
