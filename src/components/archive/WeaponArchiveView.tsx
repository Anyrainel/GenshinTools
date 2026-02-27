import { HeaderScrollLayout } from "@/components/layout/HeaderScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getSortedWeaponSecondaryStats,
  sortedWeapons,
  weaponResourcesByName,
} from "@/data/constants";
import type {
  MainStat,
  Rarity,
  WeaponResource,
  WeaponType,
} from "@/data/types";
import { weaponTypes } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { getWeaponDisplayMeta } from "@/lib/gameStatsLoader";
import { fuzzyMatch } from "@/lib/search";
import { cn, getAssetUrl } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { ArchiveToolbar } from "./ArchiveToolbar";
import { FilterChip } from "./FilterChip";
import { WeaponCard } from "./WeaponCard";

// ─── Filter Chips ─────────────────────────────────────────────────────────────

function WeaponFilterChips({
  sortedWeaponSecondaryStats,
  weaponTypeFilter,
  onToggleWeaponType,
  rarityFilter,
  onToggleRarity,
  secondaryStatFilter,
  onToggleSecondaryStat,
}: {
  sortedWeaponSecondaryStats: MainStat[];
  weaponTypeFilter: WeaponType[];
  onToggleWeaponType: (wt: WeaponType) => void;
  rarityFilter: Rarity[];
  onToggleRarity: (r: Rarity) => void;
  secondaryStatFilter: MainStat[];
  onToggleSecondaryStat: (stat: MainStat) => void;
}) {
  const { t } = useLanguage();

  return (
    <>
      {/* Weapon Types */}
      {weaponTypes.map((wt) => {
        const active =
          weaponTypeFilter.length === 0 || weaponTypeFilter.includes(wt);
        const res = weaponResourcesByName[wt];
        return (
          <FilterChip
            key={wt}
            active={active}
            onClick={() => onToggleWeaponType(wt)}
          >
            <img
              src={getAssetUrl(res.imagePath)}
              alt={wt}
              className="w-4 h-4 brightness-125"
            />
            <span className="hidden sm:inline">{t.weaponType(wt)}</span>
          </FilterChip>
        );
      })}

      <div className="h-5 w-px bg-border/50 mx-1 hidden sm:block" />

      {/* Rarity */}
      {([5, 4, 3] as Rarity[]).map((r) => {
        const active = rarityFilter.length === 0 || rarityFilter.includes(r);
        return (
          <FilterChip key={r} active={active} onClick={() => onToggleRarity(r)}>
            <span
              className={cn(
                active
                  ? r === 5
                    ? "text-amber-400"
                    : r === 4
                      ? "text-purple-400"
                      : "text-blue-400"
                  : ""
              )}
            >
              ★{r}
            </span>
          </FilterChip>
        );
      })}

      <div className="h-5 w-px bg-border/50 mx-1 hidden sm:block" />

      {/* Secondary Stats */}
      {sortedWeaponSecondaryStats.map((stat) => {
        const active =
          secondaryStatFilter.length === 0 ||
          secondaryStatFilter.includes(stat);
        return (
          <FilterChip
            key={stat}
            active={active}
            onClick={() => onToggleSecondaryStat(stat)}
          >
            {t.statShort(stat)}
          </FilterChip>
        );
      })}
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
            <div className="flex flex-wrap gap-1.5 md:gap-2">
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
  const { weaponStats } = useGameStats();
  const sortedWeaponSecondaryStats = useMemo(
    () => getSortedWeaponSecondaryStats(weaponStats ?? null),
    [weaponStats]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<WeaponType[]>([]);
  const [rarityFilter, setRarityFilter] = useState<Rarity[]>([]);
  const [secondaryStatFilter, setSecondaryStatFilter] = useState<MainStat[]>(
    []
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
      if (rarityFilter.length > 0 && !rarityFilter.includes(meta.rarity))
        return false;
      if (
        secondaryStatFilter.length > 0 &&
        (meta.secondaryStat == null ||
          !secondaryStatFilter.includes(meta.secondaryStat))
      )
        return false;
      if (
        weaponTypeFilter.length > 0 &&
        (meta.type == null || !weaponTypeFilter.includes(meta.type))
      )
        return false;
      if (query) {
        const lowerQuery = query.toLowerCase();
        const name = t.weaponName(weapon.id);
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

  const toggleWeaponType = (wt: WeaponType) => {
    setWeaponTypeFilter((prev) =>
      prev.includes(wt) ? prev.filter((w) => w !== wt) : [...prev, wt]
    );
  };

  const toggleRarity = (r: Rarity) => {
    setRarityFilter((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const toggleSecondaryStat = (stat: MainStat) => {
    setSecondaryStatFilter((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  // Determine which sections to render (hide empty sections when weapon type filter is active)
  const visibleTypes =
    weaponTypeFilter.length > 0 ? weaponTypeFilter : weaponTypes;

  return (
    <HeaderScrollLayout
      className="h-full"
      headerClassName="py-4"
      bodyClassName="space-y-4 pb-8 max-md:!px-2"
      header={
        <ArchiveToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.ui("archive.weaponSearchPlaceholder")}
        >
          <WeaponFilterChips
            sortedWeaponSecondaryStats={sortedWeaponSecondaryStats}
            weaponTypeFilter={weaponTypeFilter}
            onToggleWeaponType={toggleWeaponType}
            rarityFilter={rarityFilter}
            onToggleRarity={toggleRarity}
            secondaryStatFilter={secondaryStatFilter}
            onToggleSecondaryStat={toggleSecondaryStat}
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
    </HeaderScrollLayout>
  );
}
