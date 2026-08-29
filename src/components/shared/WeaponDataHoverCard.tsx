import { type ReactNode, useState } from "react";
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
import type { WeaponData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { WeaponTooltip } from "./WeaponTooltip";

interface WeaponDataHoverCardProps {
  weapon: WeaponData;
  children: ReactNode;
  side?: "left" | "right" | "top" | "bottom";
}

export function WeaponDataHoverCard({
  weapon,
  children,
  side = "right",
}: WeaponDataHoverCardProps) {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const openDrawer = () => {
    setIsHovering(false);
    setDrawerOpen(true);
  };

  const trigger = (
    <button
      type="button"
      className="block w-full min-w-0 cursor-pointer text-left"
      aria-label={t.weapon(weapon.key)}
      onClick={openDrawer}
    >
      {children}
    </button>
  );

  const drawer = (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DrawerContent className="max-h-[85vh] border-t border-white/10 bg-slate-950/95">
        <DrawerTitle className="sr-only">
          {t.ui("accountData.weaponDetails")}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          {t.weapon(weapon.key)} - {t.ui("common.level")} {weapon.level} -{" "}
          {t.format("common.refinementFormat", weapon.refinement)}
        </DrawerDescription>
        <div className="safe-area-bottom overflow-y-auto px-4 pb-6 pt-0">
          <WeaponTooltip
            weaponId={weapon.key}
            inventoryWeapon={weapon}
            showIcon
            className="mx-auto"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        {drawer}
      </>
    );
  }

  return (
    <>
      <Tooltip open={isHovering} onOpenChange={setIsHovering}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side} className="border-none bg-transparent p-0">
          <WeaponTooltip weaponId={weapon.key} inventoryWeapon={weapon} />
        </TooltipContent>
      </Tooltip>
      {drawer}
    </>
  );
}
