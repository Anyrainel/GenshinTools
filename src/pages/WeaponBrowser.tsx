import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  sortedWeaponSecondaryStats,
  sortedWeapons,
  weaponResourcesByName,
} from "@/data/constants";
import type { MainStat, Rarity, Weapon, WeaponType } from "@/data/types";
import { weaponTypes } from "@/data/types";
import { cn, getAssetUrl } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

// Weapon rarities to show in the filter (descending order for display)
const WEAPON_RARITIES = [5, 4, 3] as const;

export default function WeaponBrowserPage() {
  const { t } = useLanguage();

  // Local UI state for filters
  const [showRarity, setShowRarity] = useState<Record<Rarity, boolean>>({
    5: true,
    4: true,
    3: true,
    2: false,
    1: false,
  });
  const [selectedSecondaryStats, setSelectedSecondaryStats] = useState<
    MainStat[]
  >(sortedWeaponSecondaryStats);

  // Track which sections are open (all open by default)
  const [openSections, setOpenSections] = useState<Record<WeaponType, boolean>>(
    {
      Sword: true,
      Claymore: true,
      Polearm: true,
      Catalyst: true,
      Bow: true,
    }
  );

  // Group weapons by type after filtering
  const weaponsByType = useMemo(() => {
    const filtered = sortedWeapons.filter((weapon) => {
      if (!showRarity[weapon.rarity]) return false;
      if (!selectedSecondaryStats.includes(weapon.secondaryStat)) return false;
      return true;
    });

    const grouped: Record<WeaponType, Weapon[]> = {
      Sword: [],
      Claymore: [],
      Polearm: [],
      Catalyst: [],
      Bow: [],
    };

    for (const weapon of filtered) {
      grouped[weapon.type].push(weapon);
    }

    return grouped;
  }, [showRarity, selectedSecondaryStats]);

  const toggleSection = (type: WeaponType) => {
    setOpenSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const getRarityLabel = (rarity: number) => {
    switch (rarity) {
      case 5:
        return t.ui("buttons.includeRarity5");
      case 4:
        return t.ui("buttons.includeRarity4");
      case 3:
        return t.ui("buttons.includeRarity3");
      default:
        return "";
    }
  };

  return (
    <PageLayout>
      <ScrollLayout className="pb-8 mt-2">
        {/* Page title */}
        <h1 className="text-2xl md:text-3xl font-bold mb-4">
          {t.ui("app.navWeaponBrowser")}
        </h1>

        {/* Sticky filter section */}
        <div className="sticky top-0 z-10 pb-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-lg bg-card border border-border/50">
            {/* Rarity filters */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                {t.ui("filters.rarity")}
              </span>
              {WEAPON_RARITIES.map((rarity) => (
                <div key={rarity} className="flex items-center space-x-2">
                  <Checkbox
                    id={`rarity-${rarity}`}
                    checked={showRarity[rarity]}
                    onCheckedChange={(checked) =>
                      setShowRarity((prev) => ({
                        ...prev,
                        [rarity]: checked === true,
                      }))
                    }
                  />
                  <Label
                    htmlFor={`rarity-${rarity}`}
                    className="text-sm cursor-pointer whitespace-nowrap"
                  >
                    {getRarityLabel(rarity)}
                  </Label>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="hidden md:block h-6 w-px bg-border" />

            {/* Secondary stat filters */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">
                {t.ui("filters.secondaryStat")}
              </span>
              {sortedWeaponSecondaryStats.map((stat) => (
                <div key={stat} className="flex items-center space-x-2">
                  <Checkbox
                    id={`stat-${stat}`}
                    checked={selectedSecondaryStats.includes(stat)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSecondaryStats([
                          ...selectedSecondaryStats,
                          stat,
                        ]);
                      } else {
                        setSelectedSecondaryStats(
                          selectedSecondaryStats.filter((s) => s !== stat)
                        );
                      }
                    }}
                  />
                  <Label
                    htmlFor={`stat-${stat}`}
                    className="text-sm cursor-pointer whitespace-nowrap"
                  >
                    {t.statShort(stat)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weapon sections - collapsible by weapon type */}
        <div className="space-y-4">
          {weaponTypes.map((type) => (
            <WeaponTypeSection
              key={type}
              type={type}
              weapons={weaponsByType[type]}
              isOpen={openSections[type]}
              onToggle={() => toggleSection(type)}
              t={t}
            />
          ))}
        </div>
      </ScrollLayout>
    </PageLayout>
  );
}

interface WeaponTypeSectionProps {
  type: WeaponType;
  weapons: Weapon[];
  isOpen: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}

function WeaponTypeSection({
  type,
  weapons,
  isOpen,
  onToggle,
  t,
}: WeaponTypeSectionProps) {
  const resource = weaponResourcesByName[type];

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div className="rounded-lg bg-card border border-border/50 overflow-hidden">
        {/* Section header - clickable to collapse/expand */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-3 p-3",
              "hover:bg-accent/30",
              "transition-colors cursor-pointer"
            )}
          >
            {/* Weapon type icon */}
            <div className="w-10 h-10 rounded-md bg-cyan-900/70 p-2 flex items-center justify-center">
              <img
                src={getAssetUrl(resource.imagePath)}
                alt={type}
                className="w-full h-full object-contain brightness-125"
              />
            </div>

            {/* Type name, count, and chevron grouped together */}
            <span className="font-semibold text-lg">{t.weaponType(type)}</span>
            <span className="text-sm text-muted-foreground">
              ({weapons.length})
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* Weapon grid - flex wrap layout */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-2 border-t border-border/30">
            {weapons.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4">
                {t.ui("filters.noWeaponsFound")}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {weapons.map((weapon) => (
                  <WeaponCard key={weapon.id} weapon={weapon} t={t} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface WeaponCardProps {
  weapon: Weapon;
  t: ReturnType<typeof useLanguage>["t"];
}

function WeaponCard({ weapon, t }: WeaponCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg w-[200px]",
            "bg-gradient-card",
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
}
