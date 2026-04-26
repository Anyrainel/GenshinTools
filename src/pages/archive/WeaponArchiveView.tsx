import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { WeaponCard } from "@/components/archive/WeaponCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MainStat, Rarity, WeaponType } from "@/data/enums";
import { weaponTypes } from "@/data/enums";
import { sortedWeapons, weaponResourcesByName } from "@/data/gameResources";
import {
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { WeaponResource } from "@/data/types";
import { fuzzyMatch } from "@/lib/search";
import { cn, getAssetUrl, getSortedWeaponSecondaryStats } from "@/lib/utils";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function WeaponFilterChips({
  sortedWeaponSecondaryStats,
  weaponTypeFilter,
  onWeaponTypeFilterChange,
  rarityFilter,
  onRarityFilterChange,
  secondaryStatFilter,
  onSecondaryStatFilterChange,
}: {
  sortedWeaponSecondaryStats: MainStat[];
  weaponTypeFilter: Set<WeaponType>;
  onWeaponTypeFilterChange: (nextValues: Set<WeaponType>) => void;
  rarityFilter: Set<Rarity>;
  onRarityFilterChange: (nextValues: Set<Rarity>) => void;
  secondaryStatFilter: Set<MainStat>;
  onSecondaryStatFilterChange: (nextValues: Set<MainStat>) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      <FilterChipGroup
        options={weaponTypes}
        selectedValues={weaponTypeFilter}
        onSelectedValuesChange={onWeaponTypeFilterChange}
        getKey={(weaponType) => weaponType}
        getIcon={(weaponType) => {
          const res = weaponResourcesByName[weaponType];
          return (
            <img
              src={getAssetUrl(res.imagePath)}
              alt={weaponType}
              className="w-4 h-4 brightness-125"
            />
          );
        }}
        getLabel={(weaponType) => (
          <span className="hidden sm:inline">{t.weaponType(weaponType)}</span>
        )}
        className="contents"
      />

      <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

      <FilterChipGroup
        options={[5, 4, 3] as Rarity[]}
        selectedValues={rarityFilter}
        onSelectedValuesChange={onRarityFilterChange}
        getKey={(rarity) => String(rarity)}
        getLabel={(rarity, active) => (
          <span
            className={cn(
              active
                ? rarity === 5
                  ? "text-amber-400"
                  : rarity === 4
                    ? "text-purple-400"
                    : "text-blue-400"
                : ""
            )}
          >
            ★{rarity}
          </span>
        )}
        className="contents"
      />

      <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

      <FilterChipGroup
        options={sortedWeaponSecondaryStats}
        selectedValues={secondaryStatFilter}
        onSelectedValuesChange={onSecondaryStatFilterChange}
        getKey={(stat) => stat}
        getLabel={(stat) => t.statShort(stat)}
        className="contents"
      />
    </>
  );
}

// ─── Weapon Type Section ──────────────────────────────────────────────────────

function WeaponTypeSection({
  type,
  weapons,
  isOpen,
  onToggle,
}: {
  type: WeaponType;
  weapons: WeaponResource[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();
  const resource = weaponResourcesByName[type];

  return (
    <div className="rounded-lg bg-gradient-card border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 p-3",
          "hover:bg-accent/30",
          "transition-colors cursor-pointer"
        )}
      >
        <div className="w-10 h-10 rounded-md bg-cyan-900/70 p-2 flex items-center justify-center">
          <img
            src={getAssetUrl(resource.imagePath)}
            alt={type}
            className="w-full h-full object-contain brightness-125"
          />
        </div>
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

      {isOpen && (
        <div className="px-1.5 pb-3 pt-2 md:px-3 border-t border-border/30">
          {weapons.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              {t.ui("archive.noWeaponResults")}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1.5 md:gap-2">
              {weapons.map((weapon) => (
                <WeaponCard key={weapon.id} weapon={weapon} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function WeaponArchiveView() {
  const { t } = useLanguage();
  const weaponStats = weaponStatsResource.use();
  const sortedWeaponSecondaryStats = useMemo(
    () => getSortedWeaponSecondaryStats(weaponStats ?? null),
    [weaponStats]
  );
  const searchQuery = useArchiveSessionStore((s) => s.weaponSearch);
  const setSearchQuery = useArchiveSessionStore((s) => s.setWeaponSearch);
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<Set<WeaponType>>(
    () => new Set()
  );
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(
    () => new Set()
  );
  const [secondaryStatFilter, setSecondaryStatFilter] = useState<Set<MainStat>>(
    () => new Set()
  );
  const [openSections, setOpenSections] = useState<Record<WeaponType, boolean>>(
    {
      Sword: true,
      Claymore: true,
      Polearm: true,
      Catalyst: true,
      Bow: true,
    }
  );

  const weaponsByType = useMemo(() => {
    const query = searchQuery.trim();

    const filtered = sortedWeapons.filter((weapon) => {
      const meta = getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id]);
      if (rarityFilter.size > 0 && !rarityFilter.has(meta.rarity)) return false;
      if (
        secondaryStatFilter.size > 0 &&
        (meta.secondaryStat == null ||
          !secondaryStatFilter.has(meta.secondaryStat))
      )
        return false;
      if (
        weaponTypeFilter.size > 0 &&
        (meta.type == null || !weaponTypeFilter.has(meta.type))
      )
        return false;
      if (query) {
        const lowerQuery = query.toLowerCase();
        const name = t.weapon(weapon.id);
        const statLabel =
          meta.secondaryStat != null ? t.statShort(meta.secondaryStat) : "";
        const effect = t.weaponEffect(weapon.id);
        if (
          !fuzzyMatch(query, name) &&
          !fuzzyMatch(query, weapon.id) &&
          !fuzzyMatch(query, statLabel) &&
          !effect.toLowerCase().includes(lowerQuery)
        )
          return false;
      }
      return true;
    });

    const grouped: Record<WeaponType, WeaponResource[]> = {
      Sword: [],
      Claymore: [],
      Polearm: [],
      Catalyst: [],
      Bow: [],
    };

    for (const weapon of filtered) {
      const meta = getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id]);
      if (meta.type != null) grouped[meta.type].push(weapon);
    }

    return grouped;
  }, [
    searchQuery,
    rarityFilter,
    secondaryStatFilter,
    weaponTypeFilter,
    weaponStats,
    t,
  ]);

  const toggleSection = (type: WeaponType) => {
    setOpenSections((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  // Determine which sections to render (hide empty sections when weapon type filter is active)
  const visibleTypes =
    weaponTypeFilter.size > 0 ? [...weaponTypeFilter] : weaponTypes;

  return (
    <ScrollLayout
      className="h-full"
      bodyClassName="space-y-4"
      header={
        <ArchiveToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.ui("archive.searchItemPlaceholder")}
        >
          <WeaponFilterChips
            sortedWeaponSecondaryStats={sortedWeaponSecondaryStats}
            weaponTypeFilter={weaponTypeFilter}
            onWeaponTypeFilterChange={setWeaponTypeFilter}
            rarityFilter={rarityFilter}
            onRarityFilterChange={setRarityFilter}
            secondaryStatFilter={secondaryStatFilter}
            onSecondaryStatFilterChange={setSecondaryStatFilter}
          />
        </ArchiveToolbar>
      }
    >
      {visibleTypes.map((type) => (
        <WeaponTypeSection
          key={type}
          type={type}
          weapons={weaponsByType[type]}
          isOpen={openSections[type]}
          onToggle={() => toggleSection(type)}
        />
      ))}
    </ScrollLayout>
  );
}
