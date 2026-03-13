import {
  ArtifactDataContent,
  ArtifactDataHoverCard,
} from "@/components/account-data/ArtifactDataHoverCard";
import { FilterChip } from "@/components/archive/FilterChip";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  artifactIdToHalfSetId,
  artifactsById,
  weaponsById,
} from "@/data/constants";
import { artifactHalfSets } from "@/data/resources";
import type {
  AccountData,
  ArtifactData,
  Rarity,
  WeaponData,
} from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getWeaponDisplayMeta } from "@/lib/gameStatsLoader";
import { cn } from "@/lib/utils";
import { Check, Minus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface InventoryViewProps {
  data: AccountData;
  isEditMode?: boolean;
  onDeleteWeapon?: (weaponId: string) => void;
  onDeleteArtifact?: (artifactId: string) => void;
}

type TaggedWeapon = WeaponData & { equipped: boolean };
type TaggedArtifact = ArtifactData & { equipped: boolean };

const ALL_HALF_SET_IDS = artifactHalfSets.map((hs) => hs.id);

const isMaxWeapon = (w: WeaponData) => w.level === 90;
const isMaxArtifact = (a: ArtifactData) =>
  (a.rarity === 5 && a.level === 20) || (a.rarity === 4 && a.level === 16);

export function InventoryView({
  data,
  isEditMode = false,
  onDeleteWeapon,
  onDeleteArtifact,
}: InventoryViewProps) {
  const { t } = useLanguage();
  const { weaponStats } = useGameStats();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const iconSize = isMobile ? "lg" : "xl";

  // ── Edit mode dialog state ──
  const [selectedWeapon, setSelectedWeapon] = useState<TaggedWeapon | null>(
    null
  );
  const [selectedArtifact, setSelectedArtifact] =
    useState<TaggedArtifact | null>(null);

  // ── Category toggles (default: unequipped + maxLevel) ──
  const [wShowEquipped, setWShowEquipped] = useState(false);
  const [wShowUnequipped, setWShowUnequipped] = useState(true);
  const [wShowMaxLevel, setWShowMaxLevel] = useState(true);
  const [wShowOther, setWShowOther] = useState(false);

  const [aShowEquipped, setAShowEquipped] = useState(false);
  const [aShowUnequipped, setAShowUnequipped] = useState(true);
  const [aShowMaxLevel, setAShowMaxLevel] = useState(true);
  const [aShowOther, setAShowOther] = useState(false);

  // ── Weapon filters ──
  const allSecondaryStats = useMemo(() => {
    if (!weaponStats) return [];
    return [
      ...new Set(
        Object.values(weaponStats)
          .map((s) => s.secondaryStat)
          .filter(Boolean)
      ),
    ];
  }, [weaponStats]);

  const [weaponRarities, setWeaponRarities] = useState<Set<Rarity>>(
    () => new Set([5, 4, 3])
  );
  const [weaponSubstats, setWeaponSubstats] = useState<Set<string>>(
    () => new Set()
  );

  // ── Artifact filters ──
  const [artifactRarities, setArtifactRarities] = useState<Set<Rarity>>(
    () => new Set([5, 4])
  );
  const [artifactHalfSetFilter, setArtifactHalfSetFilter] = useState<
    Set<string>
  >(() => new Set());

  // ── Build combined arrays ──
  const equippedWeapons: TaggedWeapon[] = useMemo(
    () =>
      data.characters
        .filter((c) => c.weapon)
        .map((c) => ({ ...c.weapon!, equipped: true })),
    [data.characters]
  );

  const unequippedWeapons: TaggedWeapon[] = useMemo(
    () => (data.extraWeapons || []).map((w) => ({ ...w, equipped: false })),
    [data.extraWeapons]
  );

  const equippedArtifacts: TaggedArtifact[] = useMemo(
    () =>
      data.characters.flatMap((c) =>
        Object.values(c.artifacts).map((a) => ({ ...a, equipped: true }))
      ),
    [data.characters]
  );

  const unequippedArtifacts: TaggedArtifact[] = useMemo(
    () => (data.extraArtifacts || []).map((a) => ({ ...a, equipped: false })),
    [data.extraArtifacts]
  );

  // ── Filter weapons ──
  const filteredWeapons = useMemo(() => {
    const combined = [...equippedWeapons, ...unequippedWeapons];

    return combined.filter((w) => {
      // Category filter
      const eqMatch = w.equipped ? wShowEquipped : wShowUnequipped;
      const lvlMatch = isMaxWeapon(w) ? wShowMaxLevel : wShowOther;
      if (!eqMatch || !lvlMatch) return false;

      // Rarity filter
      const info = weaponsById[w.key];
      const meta = info
        ? getWeaponDisplayMeta(info, weaponStats?.[w.key])
        : null;
      const rarity = meta?.rarity ?? info?.rarity ?? 1;
      if (!weaponRarities.has(rarity as Rarity)) return false;

      // Substat filter
      if (weaponSubstats.size > 0 && meta?.secondaryStat) {
        if (!weaponSubstats.has(meta.secondaryStat)) return false;
      }

      return true;
    });
  }, [
    equippedWeapons,
    unequippedWeapons,
    wShowEquipped,
    wShowUnequipped,
    wShowMaxLevel,
    wShowOther,
    weaponRarities,
    weaponSubstats,
    weaponStats,
  ]);

  // ── Sort & group weapons ──
  const groupedWeapons = useMemo(() => {
    const sorted = filteredWeapons.slice().sort((a, b) => {
      const infoA = weaponsById[a.key];
      const infoB = weaponsById[b.key];
      const metaA = infoA
        ? getWeaponDisplayMeta(infoA, weaponStats?.[a.key])
        : null;
      const metaB = infoB
        ? getWeaponDisplayMeta(infoB, weaponStats?.[b.key])
        : null;
      if (metaA && metaB && metaA.rarity !== metaB.rarity)
        return metaB.rarity - metaA.rarity;
      if (
        metaA?.type != null &&
        metaB?.type != null &&
        metaA.type !== metaB.type
      )
        return metaA.type.localeCompare(metaB.type);
      return a.key.localeCompare(b.key);
    });
    return groupWeapons(sorted);
  }, [filteredWeapons, weaponStats]);

  // ── Filter artifacts ──
  const filteredArtifacts = useMemo(() => {
    const combined = [...equippedArtifacts, ...unequippedArtifacts];

    return combined
      .filter((a) => {
        // Category filter
        const eqMatch = a.equipped ? aShowEquipped : aShowUnequipped;
        const lvlMatch = isMaxArtifact(a) ? aShowMaxLevel : aShowOther;
        if (!eqMatch || !lvlMatch) return false;

        // Rarity filter
        if (!artifactRarities.has(a.rarity)) return false;

        // Half-set filter
        if (artifactHalfSetFilter.size > 0) {
          const halfSetId = artifactIdToHalfSetId[a.setKey];
          if (halfSetId && !artifactHalfSetFilter.has(halfSetId)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.setKey !== b.setKey) return a.setKey.localeCompare(b.setKey);
        const slotOrder: Record<string, number> = {
          flower: 0,
          plume: 1,
          sands: 2,
          goblet: 3,
          circlet: 4,
        };
        return (slotOrder[a.slotKey] ?? 5) - (slotOrder[b.slotKey] ?? 5);
      });
  }, [
    equippedArtifacts,
    unequippedArtifacts,
    aShowEquipped,
    aShowUnequipped,
    aShowMaxLevel,
    aShowOther,
    artifactRarities,
    artifactHalfSetFilter,
  ]);

  // ── Sorted filter lists (by display name) ──
  const sortedWeaponSubstats = useMemo(
    () =>
      [...allSecondaryStats].sort((a, b) => t.stat(a).localeCompare(t.stat(b))),
    [allSecondaryStats, t]
  );

  const sortedHalfSetIds = useMemo(
    () =>
      [...ALL_HALF_SET_IDS].sort((a, b) =>
        t.halfSetShort(a).localeCompare(t.halfSetShort(b))
      ),
    [t]
  );

  // ── Toggle helpers ──
  const toggleSet = <T,>(
    set: Set<T>,
    setter: React.Dispatch<React.SetStateAction<Set<T>>>,
    value: T
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  // ── Edit mode handlers ──
  const handleWeaponClick = useCallback(
    (w: TaggedWeapon) => {
      if (isEditMode) setSelectedWeapon(w);
    },
    [isEditMode]
  );

  const handleArtifactClick = useCallback(
    (a: TaggedArtifact) => {
      if (isEditMode) setSelectedArtifact(a);
    },
    [isEditMode]
  );

  const handleDeleteWeapon = useCallback(() => {
    if (selectedWeapon && onDeleteWeapon) {
      onDeleteWeapon(selectedWeapon.id);
      setSelectedWeapon(null);
    }
  }, [selectedWeapon, onDeleteWeapon]);

  const handleDeleteArtifact = useCallback(() => {
    if (selectedArtifact && onDeleteArtifact) {
      onDeleteArtifact(selectedArtifact.id);
      setSelectedArtifact(null);
    }
  }, [selectedArtifact, onDeleteArtifact]);

  return (
    <ScrollLayout className="space-y-6 pb-12 mt-2">
      {/* ══════ WEAPONS ══════ */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground/90 px-2">
          {t.ui("accountData.weapons")}{" "}
          <span className="text-muted-foreground ml-1 text-base font-normal">
            ({groupedWeapons.length})
          </span>
        </h3>

        <div className="flex flex-wrap items-center gap-1.5 px-2">
          <CategoryChip
            color="teal"
            active={wShowUnequipped}
            onClick={() => setWShowUnequipped((p) => !p)}
          >
            {t.ui("accountData.unequipped")}
          </CategoryChip>
          <CategoryChip
            color="teal"
            active={wShowEquipped}
            onClick={() => setWShowEquipped((p) => !p)}
          >
            {t.ui("accountData.equipped")}
          </CategoryChip>
          <CategoryChip
            color="orange"
            active={wShowMaxLevel}
            onClick={() => setWShowMaxLevel((p) => !p)}
          >
            {t.ui("accountData.maxLevel")}
          </CategoryChip>
          <CategoryChip
            color="orange"
            active={wShowOther}
            onClick={() => setWShowOther((p) => !p)}
          >
            {t.ui("accountData.other")}
          </CategoryChip>
          <span className="mx-0.5" />
          {([5, 4, 3] as Rarity[]).map((r) => (
            <CategoryChip
              key={r}
              color={rarityColor[r] ?? "sky"}
              active={weaponRarities.has(r)}
              onClick={() => toggleSet(weaponRarities, setWeaponRarities, r)}
            >
              {r}★
            </CategoryChip>
          ))}
        </div>
        {allSecondaryStats.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-2">
            {sortedWeaponSubstats.map((stat) => (
              <FilterChip
                key={stat}
                active={weaponSubstats.size === 0 || weaponSubstats.has(stat)}
                onClick={() =>
                  toggleSet(weaponSubstats, setWeaponSubstats, stat)
                }
              >
                {t.stat(stat)}
              </FilterChip>
            ))}
          </div>
        )}

        <WeaponGrid
          weapons={groupedWeapons}
          iconSize={iconSize}
          t={t}
          isEditMode={isEditMode}
          onWeaponClick={handleWeaponClick}
        />
      </div>

      {/* ══════ ARTIFACTS ══════ */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground/90 px-2">
          {t.ui("accountData.artifacts")}{" "}
          <span className="text-muted-foreground ml-1 text-base font-normal">
            ({filteredArtifacts.length})
          </span>
        </h3>

        <div className="flex flex-wrap items-center gap-1.5 px-2">
          <CategoryChip
            color="teal"
            active={aShowUnequipped}
            onClick={() => setAShowUnequipped((p) => !p)}
          >
            {t.ui("accountData.unequipped")}
          </CategoryChip>
          <CategoryChip
            color="teal"
            active={aShowEquipped}
            onClick={() => setAShowEquipped((p) => !p)}
          >
            {t.ui("accountData.equipped")}
          </CategoryChip>
          <CategoryChip
            color="orange"
            active={aShowMaxLevel}
            onClick={() => setAShowMaxLevel((p) => !p)}
          >
            {t.ui("accountData.maxLevel")}
          </CategoryChip>
          <CategoryChip
            color="orange"
            active={aShowOther}
            onClick={() => setAShowOther((p) => !p)}
          >
            {t.ui("accountData.other")}
          </CategoryChip>
          <span className="mx-0.5" />
          {([5, 4] as Rarity[]).map((r) => (
            <CategoryChip
              key={r}
              color={rarityColor[r] ?? "sky"}
              active={artifactRarities.has(r)}
              onClick={() =>
                toggleSet(artifactRarities, setArtifactRarities, r)
              }
            >
              {r}★
            </CategoryChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 px-2">
          {sortedHalfSetIds.map((hsId) => (
            <FilterChip
              key={hsId}
              active={
                artifactHalfSetFilter.size === 0 ||
                artifactHalfSetFilter.has(hsId)
              }
              onClick={() =>
                toggleSet(artifactHalfSetFilter, setArtifactHalfSetFilter, hsId)
              }
            >
              {t.halfSetShort(hsId)}
            </FilterChip>
          ))}
        </div>

        <ArtifactGrid
          artifacts={filteredArtifacts}
          iconSize={iconSize}
          isEditMode={isEditMode}
          onArtifactClick={handleArtifactClick}
        />
      </div>

      {/* ══════ WEAPON DETAIL DIALOG ══════ */}
      <ResponsiveDialog
        open={!!selectedWeapon}
        onOpenChange={(open) => {
          if (!open) setSelectedWeapon(null);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {selectedWeapon ? t.weaponName(selectedWeapon.key) : ""}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription asChild>
              <span>
                Lv. {selectedWeapon?.level}{" "}
                {selectedWeapon &&
                  t
                    .ui("common.refinementFormat")
                    .replace("{0}", String(selectedWeapon.refinement))}
                {selectedWeapon?.equipped &&
                  ` \u2022 ${t.ui("accountData.equipped")}`}
              </span>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {selectedWeapon && (
            <div className="flex justify-center py-2">
              <WeaponTooltip weaponId={selectedWeapon.key} />
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setSelectedWeapon(null)}>
              {t.ui("common.cancel")}
            </Button>
            {selectedWeapon && !selectedWeapon.equipped && onDeleteWeapon && (
              <Button variant="destructive" onClick={handleDeleteWeapon}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t.ui("common.delete")}
              </Button>
            )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* ══════ ARTIFACT DETAIL DIALOG ══════ */}
      <ResponsiveDialog
        open={!!selectedArtifact}
        onOpenChange={(open) => {
          if (!open) setSelectedArtifact(null);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {selectedArtifact ? t.artifact(selectedArtifact.setKey) : ""}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription asChild>
              <span>
                {selectedArtifact && t.slot(selectedArtifact.slotKey)} +
                {selectedArtifact?.level}
                {selectedArtifact?.equipped &&
                  ` \u2022 ${t.ui("accountData.equipped")}`}
              </span>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {selectedArtifact && (
            <div className="flex justify-center py-2">
              <ArtifactDataContent
                artifact={selectedArtifact}
                slot={selectedArtifact.slotKey}
                showIcon
              />
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => setSelectedArtifact(null)}>
              {t.ui("common.cancel")}
            </Button>
            {selectedArtifact &&
              !selectedArtifact.equipped &&
              onDeleteArtifact && (
                <Button variant="destructive" onClick={handleDeleteArtifact}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t.ui("common.delete")}
                </Button>
              )}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </ScrollLayout>
  );
}

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------

const categoryColors = {
  teal: {
    active: "bg-teal-500/15 border-teal-500/40 text-teal-300",
    icon: "text-teal-400",
  },
  orange: {
    active: "bg-orange-500/15 border-orange-500/40 text-orange-300",
    icon: "text-orange-400",
  },
  "rarity-5": {
    active: "bg-rarity-5/15 border-rarity-5/40 text-rarity-5",
    icon: "text-rarity-5",
  },
  "rarity-4": {
    active: "bg-rarity-4/15 border-rarity-4/40 text-rarity-4",
    icon: "text-rarity-4",
  },
  "rarity-3": {
    active: "bg-rarity-3/15 border-rarity-3/40 text-rarity-3",
    icon: "text-rarity-3",
  },
} as const;

type CategoryColor = keyof typeof categoryColors;

const rarityColor: Record<number, CategoryColor> = {
  5: "rarity-5",
  4: "rarity-4",
  3: "rarity-3",
};

function CategoryChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: CategoryColor;
  children: React.ReactNode;
}) {
  const scheme = categoryColors[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm leading-none font-medium transition-all border",
        active
          ? scheme.active
          : "border-transparent text-foreground/70 hover:text-foreground/90"
      )}
    >
      {active ? (
        <Check className={cn("w-3.5 h-3.5", scheme.icon)} />
      ) : (
        <Minus className="w-3.5 h-3.5" />
      )}
      {children}
    </button>
  );
}

function groupWeapons(list: (WeaponData & { equipped: boolean })[]) {
  const result: (WeaponData & { equipped: boolean; count: number })[] = [];
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

function WeaponGrid({
  weapons,
  iconSize,
  t,
  isEditMode,
  onWeaponClick,
}: {
  weapons: (WeaponData & { equipped: boolean; count: number })[];
  iconSize: "lg" | "xl";
  t: ReturnType<typeof useLanguage>["t"];
  isEditMode: boolean;
  onWeaponClick: (w: WeaponData & { equipped: boolean }) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3 px-2">
      {weapons.map((w) => {
        const weaponInfo = weaponsById[w.key];
        const name = t.weaponName(w.key);

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
                imagePath={weaponInfo?.imagePath || ""}
                rarity={weaponInfo?.rarity || 1}
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

        // In edit mode, clicking opens the dialog — no tooltip
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

function ArtifactGrid({
  artifacts,
  iconSize,
  isEditMode,
  onArtifactClick,
}: {
  artifacts: (ArtifactData & { equipped: boolean })[];
  iconSize: "lg" | "xl";
  isEditMode: boolean;
  onArtifactClick: (a: ArtifactData & { equipped: boolean }) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-3 px-2">
      {artifacts.map((a) => {
        const artInfo = artifactsById[a.setKey];
        const badge = a.astralMark ? "⭐" : undefined;

        const iconContent = (
          <div
            className={cn(
              "relative rounded-md overflow-hidden group transition-transform hover:scale-105 duration-200",
              isEditMode ? "cursor-pointer" : "cursor-help"
            )}
            onClick={isEditMode ? () => onArtifactClick(a) : undefined}
          >
            <ItemIcon
              imagePath={artInfo?.imagePaths[a.slotKey] || ""}
              rarity={a.rarity}
              badge={badge}
              lock={a.lock}
              level={`+${a.level}`}
              size={iconSize}
            />
            {a.equipped && (
              <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-green-400 shadow-sm" />
            )}
          </div>
        );

        // In edit mode, clicking opens the dialog — no hovercard
        if (isEditMode) {
          return <div key={a.id}>{iconContent}</div>;
        }

        return (
          <ArtifactDataHoverCard
            key={a.id}
            artifact={a}
            slot={a.slotKey}
            side="right"
          >
            {iconContent}
          </ArtifactDataHoverCard>
        );
      })}
    </div>
  );
}
