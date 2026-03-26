import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
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
import type { WeaponResource } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useIsOwned, useRefinement } from "@/hooks/useOwnership";
import {
  getWeaponDisplayMeta,
  getWeaponStatsAt90,
} from "@/lib/gameStatsLoader";
import { cn, getAssetUrl, getRarityColor } from "@/lib/utils";
import { Bookmark } from "lucide-react";
import { memo, useMemo, useState } from "react";

export const WeaponCard = memo(({ weapon }: { weapon: WeaponResource }) => {
  const { t } = useLanguage();
  const { weaponStats } = useGameStats();
  const meta = useMemo(
    () => getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id]),
    [weapon, weaponStats]
  );
  const level90 = useMemo(
    () =>
      weaponStats ? getWeaponStatsAt90(weaponStats, weapon.id) : undefined,
    [weaponStats, weapon.id]
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isOwned = useIsOwned();
  const owned = isOwned("weapon", weapon.id);
  const refinement = useRefinement(weapon.id);

  const card = (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg",
        "bg-card/50 hover:bg-card/80 hover:scale-[1.02]",
        "transition-all cursor-pointer",
        !owned && "opacity-40"
      )}
    >
      <ItemIcon
        weaponId={weapon.id}
        rarity={meta.rarity}
        size="sm"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium line-clamp-2 leading-tight">
          {t.weapon(weapon.id)}
        </div>
        {meta.secondaryStat != null && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {t.statShort(meta.secondaryStat)}
          </div>
        )}
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
          weaponMeta={meta}
          level90={level90}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          owned={owned}
          refinement={refinement}
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
        weaponMeta={meta}
        level90={level90}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        owned={owned}
        refinement={refinement}
      />
    </>
  );
});
WeaponCard.displayName = "WeaponCard";

function WeaponDetailDrawer({
  weapon,
  weaponMeta,
  level90,
  open,
  onOpenChange,
  owned,
  refinement,
}: {
  weapon: WeaponResource;
  weaponMeta: ReturnType<typeof getWeaponDisplayMeta>;
  level90?: { baseAtk: number; secondaryStatValue: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owned: boolean;
  refinement: number;
}) {
  const { t } = useLanguage();
  const name = t.weapon(weapon.id);
  const effectHtml = t.weaponEffect(weapon.id);
  const statName =
    weaponMeta.secondaryStat != null ? t.stat(weaponMeta.secondaryStat) : "";
  const weaponType =
    weaponMeta.type != null ? t.weaponType(weaponMeta.type) : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerTitle className="sr-only">{name}</DrawerTitle>
        <DrawerDescription className="sr-only">{weaponType}</DrawerDescription>
        <div className="px-4 pb-6 pt-2 overflow-y-auto space-y-4 max-w-lg mx-auto w-full">
          {/* Header: icon + name + stars + ownership */}
          <div className="flex items-center gap-3">
            <ItemIcon
              weaponId={weapon.id}
              rarity={weaponMeta.rarity}
              size="lg"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold leading-tight">{name}</h3>
              <span
                className={cn(
                  "text-sm mt-0.5",
                  getRarityColor(weaponMeta.rarity, "text")
                )}
              >
                {"★".repeat(weaponMeta.rarity)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 shrink-0 rounded-full h-8 px-3",
                  owned ? "text-amber-400" : "text-muted-foreground"
                )}
              >
                <Bookmark className={cn("h-4 w-4", owned && "fill-current")} />
                <span className="text-xs font-medium">
                  {owned ? t.ui("archive.owned") : t.ui("archive.notOwned")}
                </span>
              </span>
              {owned && refinement > 1 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {t.format("common.refinementFormat", refinement)}
                </span>
              )}
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-2">
            {weaponMeta.type != null && (
              <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5">
                <img
                  src={getAssetUrl(
                    `/weapontype/${weaponMeta.type.toLowerCase()}.png`
                  )}
                  alt={weaponMeta.type}
                  className="w-4 h-4 object-contain"
                />
                {weaponType}
              </span>
            )}
            {level90 != null && (
              <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                {t.stat("atk")}: <strong>{level90.baseAtk}</strong>
              </span>
            )}
            {statName && level90 != null && (
              <span className="bg-secondary text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                {statName}: <strong>{level90.secondaryStatValue}</strong>
              </span>
            )}
          </div>

          {/* Effect */}
          {effectHtml && (
            <div
              className="text-sm text-muted-foreground leading-relaxed"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Weapon effect HTML from game data pipeline
              dangerouslySetInnerHTML={{ __html: effectHtml }}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
