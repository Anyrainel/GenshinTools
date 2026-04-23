import {
  InventoryArtifactGrid,
  type TaggedArtifact,
} from "@/components/account-data/InventoryArtifactGrid";
import {
  ArtifactDeleteDialog,
  WeaponDeleteDialog,
} from "@/components/account-data/InventoryDeleteDialogs";
import {
  InventoryWeaponGrid,
  type TaggedWeapon,
  groupWeapons,
  rarityColor,
} from "@/components/account-data/InventoryWeaponGrid";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { CategoryChip } from "@/components/shared/CategoryChip";
import { FilterChip } from "@/components/shared/FilterChip";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Rarity } from "@/data/enums";
import {
  allHalfSetIds,
  artifactIdToHalfSetId,
  weaponsById,
} from "@/data/gameResources";
import {
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type { AccountData, ArtifactData, WeaponData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCallback, useMemo, useState } from "react";

interface InventoryViewProps {
  data: AccountData;
  isEditMode?: boolean;
  onDeleteWeapon?: (weaponId: string) => void;
  onDeleteArtifact?: (artifactId: string) => void;
}

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
  const weaponStats = weaponStatsResource.use();
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
      const eqMatch = w.equipped ? wShowEquipped : wShowUnequipped;
      const lvlMatch = isMaxWeapon(w) ? wShowMaxLevel : wShowOther;
      if (!eqMatch || !lvlMatch) return false;

      const info = weaponsById[w.key];
      const meta = info
        ? getWeaponDisplayMeta(info, weaponStats?.[w.key])
        : null;
      const rarity = meta?.rarity ?? info?.rarity ?? 1;
      if (!weaponRarities.has(rarity as Rarity)) return false;

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
        const eqMatch = a.equipped ? aShowEquipped : aShowUnequipped;
        const lvlMatch = isMaxArtifact(a) ? aShowMaxLevel : aShowOther;
        if (!eqMatch || !lvlMatch) return false;

        if (!artifactRarities.has(a.rarity)) return false;

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

  const sortedWeaponSubstats = useMemo(
    () =>
      [...allSecondaryStats].sort((a, b) => t.stat(a).localeCompare(t.stat(b))),
    [allSecondaryStats, t]
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
    <ScrollLayout bodyClassName="space-y-6">
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

        <InventoryWeaponGrid
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
          <span className="text-sm font-medium text-foreground shrink-0">
            {t.ui("triage.filterByHalfSet")}
          </span>
          {allHalfSetIds.map((hsId) => (
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

        <InventoryArtifactGrid
          artifacts={filteredArtifacts}
          iconSize={iconSize}
          isEditMode={isEditMode}
          onArtifactClick={handleArtifactClick}
        />
      </div>

      <WeaponDeleteDialog
        weapon={selectedWeapon}
        onClose={() => setSelectedWeapon(null)}
        onDelete={
          selectedWeapon && !selectedWeapon.equipped && onDeleteWeapon
            ? handleDeleteWeapon
            : undefined
        }
        t={t}
      />

      <ArtifactDeleteDialog
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
        onDelete={
          selectedArtifact && !selectedArtifact.equipped && onDeleteArtifact
            ? handleDeleteArtifact
            : undefined
        }
        t={t}
      />
    </ScrollLayout>
  );
}
