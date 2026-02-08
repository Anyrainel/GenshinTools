import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Weapon } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { Bookmark } from "lucide-react";
import { memo, useState } from "react";

export const WeaponCard = memo(({ weapon }: { weapon: Weapon }) => {
  const { t } = useLanguage();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const owned = useOwnershipStore((s) => s.isOwned("weapon", weapon.id));
  const toggleOwned = useOwnershipStore((s) => s.toggleOwned);

  const card = (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg w-[200px]",
        "bg-card/50 hover:bg-card/80 hover:scale-[1.02]",
        "transition-all cursor-pointer",
        !owned && "opacity-40"
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
  );

  if (isDesktop) {
    // Desktop: tooltip on hover, drawer on click
    // Mobile: drawer on click only (no tooltip)
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-left"
              onClick={() => setDrawerOpen(true)}
            >
              {card}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            sideOffset={8}
            className="p-0 bg-transparent border-0"
          >
            <WeaponTooltip weaponId={weapon.id} />
          </TooltipContent>
        </Tooltip>
        <WeaponDetailDrawer
          weapon={weapon}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          owned={owned}
          onToggleOwned={() => toggleOwned("weapon", weapon.id)}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="text-left"
        onClick={() => setDrawerOpen(true)}
      >
        {card}
      </button>
      <WeaponDetailDrawer
        weapon={weapon}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        owned={owned}
        onToggleOwned={() => toggleOwned("weapon", weapon.id)}
      />
    </>
  );
});
WeaponCard.displayName = "WeaponCard";

function WeaponDetailDrawer({
  weapon,
  open,
  onOpenChange,
  owned,
  onToggleOwned,
}: {
  weapon: Weapon;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owned: boolean;
  onToggleOwned: () => void;
}) {
  const { t } = useLanguage();
  const name = t.weaponName(weapon.id);
  const effect = t.weaponEffect(weapon.id);
  const statName = t.stat(weapon.secondaryStat);
  const weaponType = t.weaponType(weapon.type);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerTitle className="sr-only">{name}</DrawerTitle>
        <DrawerDescription className="sr-only">{weaponType}</DrawerDescription>
        <div className="px-4 pb-6 pt-2 overflow-y-auto space-y-4 max-w-lg mx-auto w-full">
          {/* Header: icon + name + stars + ownership */}
          <div className="flex items-center gap-3">
            <ItemIcon
              imagePath={weapon.imagePath}
              rarity={weapon.rarity}
              size="lg"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold leading-tight">{name}</h3>
              <span
                className={cn(
                  "text-sm mt-0.5",
                  getRarityColor(weapon.rarity, "text")
                )}
              >
                {"★".repeat(weapon.rarity)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleOwned}
              className={cn(
                "gap-1.5 shrink-0 rounded-full h-8 px-3 transition-colors",
                owned
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bookmark className={cn("h-4 w-4", owned && "fill-current")} />
              <span className="text-xs font-medium">
                {owned ? t.ui("archive.owned") : t.ui("archive.notOwned")}
              </span>
            </Button>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2">
            <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5">
              <img
                src={getAssetUrl(
                  `/weapontype/${weapon.type.toLowerCase()}.png`
                )}
                alt={weapon.type}
                className="w-4 h-4 object-contain"
              />
              {weaponType}
            </span>
            {weapon.baseAtk && (
              <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                {t.stat("atk")}: <strong>{weapon.baseAtk}</strong>
              </span>
            )}
            {statName && (
              <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                {statName}
                {weapon.secondaryStatValue && (
                  <>
                    : <strong>{weapon.secondaryStatValue}</strong>
                  </>
                )}
              </span>
            )}
          </div>

          {/* Effect */}
          {effect && (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {effect}
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
