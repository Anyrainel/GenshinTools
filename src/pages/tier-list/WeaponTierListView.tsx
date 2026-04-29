import {
  ArrowLeftRight,
  Download,
  FileDown,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionConfig } from "@/components/layout/AppBar";
import { WideLayout } from "@/components/layout/WideLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ChipColor } from "@/components/shared/colors";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { FilterChip } from "@/components/shared/FilterChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ImportControl } from "@/components/shared/ImportControl";
import { OwnedOnlyTooltip } from "@/components/shared/OwnedOnlyTooltip";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { downloadTierListImage } from "@/components/tier-list/downloadTierListImage";
import { SimpleTierListManagerDialog } from "@/components/tier-list/SimpleTierListManagerDialog";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MainStat, Rarity, WeaponType } from "@/data/enums";
import { weaponTypes } from "@/data/enums";
import {
  sortedWeapons,
  weaponResourcesByName,
  weaponsById,
} from "@/data/gameResources";
import {
  getWeaponDisplayMeta,
  weaponStatsResource,
} from "@/data/gameStatsLoader";
import type {
  PresetOption,
  TierAssignment,
  TierCustomization,
  TierListData,
  WeaponResource,
} from "@/data/types";
import { useIsOwned } from "@/hooks/useOwnership";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
  loadPresetPayload,
} from "@/lib/presetLoader";
import { getSortedWeaponSecondaryStats } from "@/lib/utils";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

// Placeholder for weapon tier list presets
const presetModules = import.meta.glob<{ default: TierListData }>(
  "@/presets/weapon-tier-list/*.json",
  { eager: false }
);

// Build group config from weapon type resources
const weaponGroupConfig: Record<WeaponType, TierGroupConfig> =
  Object.fromEntries(
    weaponTypes.map((type) => [
      type,
      {
        bgClass: "bg-cyan-900/70 backdrop-blur-sm",
        iconPath: weaponResourcesByName[type].imagePath,
      },
    ])
  ) as Record<WeaponType, TierGroupConfig>;

// Weapon rarities to show in the filter (descending order for display)
const WEAPON_RARITIES = [5, 4, 3] as const;

interface WeaponTierListViewProps {
  onActions: (actions: ActionConfig[]) => void;
}

export function WeaponTierListView({ onActions }: WeaponTierListViewProps) {
  const { t } = useLanguage();

  const tierAssignments = useWeaponTierStore((state) => state.tierAssignments);
  const tierCustomization = useWeaponTierStore(
    (state) => state.tierCustomization
  );
  const customTitle = useWeaponTierStore((state) => state.customTitle);
  const setTierAssignments = useWeaponTierStore(
    (state) => state.setTierAssignments
  );
  const setTierCustomization = useWeaponTierStore(
    (state) => state.setTierCustomization
  );
  const setCustomTitle = useWeaponTierStore((state) => state.setCustomTitle);
  const resetStoredTierList = useWeaponTierStore(
    (state) => state.resetTierList
  );
  const loadTierListData = useWeaponTierStore(
    (state) => state.loadTierListData
  );
  const author = useWeaponTierStore((state) => state.author);
  const description = useWeaponTierStore((state) => state.description);
  const tierLists = useWeaponTierStore((state) => state.tierLists);
  const activeTierListId = useWeaponTierStore(
    (state) => state.activeTierListId
  );
  const createTierList = useWeaponTierStore((state) => state.createTierList);
  const deleteTierList = useWeaponTierStore((state) => state.deleteTierList);
  const renameTierList = useWeaponTierStore((state) => state.renameTierList);
  const setActiveTierList = useWeaponTierStore(
    (state) => state.setActiveTierList
  );

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  // Local UI state for filters (not persisted)
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(
    () => new Set<Rarity>([5, 4, 3])
  );
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [pendingImportData, setPendingImportData] =
    useState<TierListData | null>(null);
  const weaponStats = weaponStatsResource.use();
  const sortedWeaponSecondaryStats = useMemo(
    () => getSortedWeaponSecondaryStats(weaponStats ?? null),
    [weaponStats]
  );
  const [selectedSecondaryStats, setSelectedSecondaryStats] = useState<
    Set<MainStat>
  >(() => new Set<MainStat>());
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );
  const tableRef = useRef<HTMLDivElement>(null);

  const isOwned = useIsOwned();

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleImport = (importedData: TierListData) => {
    if (Object.keys(tierLists).length > 1) {
      setPendingImportData(importedData);
      return;
    }
    loadTierListData({
      tierAssignments: importedData.tierAssignments,
      tierCustomization: importedData.tierCustomization,
      customTitle: importedData.customTitle || "",
    });
    toast.success(t.ui("messages.tierListLoaded"));
  };

  const handleImportOverride = () => {
    if (!pendingImportData) return;
    loadTierListData({
      tierAssignments: pendingImportData.tierAssignments,
      tierCustomization: pendingImportData.tierCustomization,
      customTitle: pendingImportData.customTitle || "",
    });
    setPendingImportData(null);
    toast.success(t.ui("messages.tierListLoaded"));
  };

  const handleImportCreateNew = () => {
    if (!pendingImportData) return;
    createTierList(pendingImportData.customTitle || undefined);
    loadTierListData({
      tierAssignments: pendingImportData.tierAssignments,
      tierCustomization: pendingImportData.tierCustomization,
      customTitle: pendingImportData.customTitle || "",
    });
    setPendingImportData(null);
    toast.success(t.ui("messages.tierListLoaded"));
  };

  const handleExport = (exportAuthor: string, exportDescription: string) => {
    const data: TierListData = {
      tierAssignments,
      tierCustomization,
      customTitle: customTitle || undefined,
      author: exportAuthor,
      description: exportDescription,
    };
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `[${exportAuthor}] ${exportDescription}.json`;
      link.click();
      URL.revokeObjectURL(url);

      useWeaponTierStore
        .getState()
        .setMetadata(exportAuthor, exportDescription);

      toast.success(t.ui("messages.tierListSaved"));
    } catch (error) {
      console.error("Error saving weapon tier list:", error);
      toast.error(t.ui("messages.tierListSaveFailed"));
    }
  };

  const handleClear = () => {
    resetStoredTierList();
    toast.info(t.ui("messages.tierListReset"));
  };

  const handleTierCustomizationSave = (
    customization: TierCustomization,
    newCustomTitle?: string
  ) => {
    const newAssignments = { ...tierAssignments };
    const hiddenTiers = Object.keys(customization).filter(
      (tier) => customization[tier]?.hidden
    );

    for (const tier of hiddenTiers) {
      for (const weaponId of Object.keys(newAssignments)) {
        if (newAssignments[weaponId].tier === tier) {
          delete newAssignments[weaponId];
        }
      }
    }

    setTierAssignments(newAssignments);
    setTierCustomization(customization);
    if (newCustomTitle !== undefined) {
      setCustomTitle(newCustomTitle);
    }
    toast.success(t.ui("messages.customizationsSaved"));
    setIsCustomizeDialogOpen(false);
  };

  const handleAssignmentsChange = (newAssignments: TierAssignment) => {
    setTierAssignments(newAssignments);
  };

  const handleDownloadImage = useCallback(async () => {
    if (!tableRef.current) return;

    await downloadTierListImage({
      tableElement: tableRef.current,
      title: customTitle || t.ui("app.weaponTierListTitle"),
      filename: "weapon-tier-list",
      t,
    });
  }, [customTitle, t]);

  // Push actions to the parent page
  useEffect(() => {
    const actions: ActionConfig[] = [
      {
        key: "import",
        icon: Download,
        label: t.ui("import.action"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
      },
      {
        key: "export",
        icon: Upload,
        label: t.ui("export.action"),
        onTrigger: () => exportRef.current?.open(),
      },
      {
        key: "clear",
        icon: Trash2,
        label: t.ui("common.clear"),
        onTrigger: () => clearRef.current?.open(),
      },
      {
        key: "print",
        icon: FileDown,
        label: t.ui("app.print"),
        onTrigger: handleDownloadImage,
      },
    ];
    onActions(actions);
  }, [t, handleDownloadImage, onActions]);

  // Filter groups for WideLayout
  const filterGroups = useMemo(
    () => [
      {
        key: "rarity",
        content: (
          <FilterChipGroup
            options={WEAPON_RARITIES}
            selectedValues={rarityFilter}
            onSelectedValuesChange={setRarityFilter}
            getKey={(r) => String(r)}
            getLabel={(r) => `${r}★`}
            getColor={(r) => `rarity-${r}` as ChipColor}
            emptyMeansAll={false}
            className="px-0"
          />
        ),
      },
      {
        key: "stats",
        content: (
          <FilterChipGroup
            options={sortedWeaponSecondaryStats}
            selectedValues={selectedSecondaryStats}
            onSelectedValuesChange={setSelectedSecondaryStats}
            getKey={(stat) => stat}
            getLabel={(stat) => t.statShort(stat)}
            className="px-0"
          />
        ),
      },
      {
        key: "ownership",
        content: (
          <OwnedOnlyTooltip>
            <span className="inline-flex">
              <FilterChip
                active={ownedOnly}
                onClick={() => setOwnedOnly(!ownedOnly)}
              >
                {t.ui("common.ownedOnly")}
              </FilterChip>
            </span>
          </OwnedOnlyTooltip>
        ),
      },
    ],
    [
      rarityFilter,
      selectedSecondaryStats,
      ownedOnly,
      t,
      sortedWeaponSecondaryStats,
    ]
  );

  return (
    <>
      {/* Control dialogs - render without triggers, opened via ref */}
      <ImportControl<TierListData>
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onApply={handleImport}
        onLocalImport={handleImport}
        variant="tier-list"
      />
      <ExportControl
        ref={exportRef}
        onExport={handleExport}
        variant="tier-list"
        defaultAuthor={author}
        defaultDescription={description || customTitle}
      />
      <ClearAllControl
        ref={clearRef}
        onConfirm={handleClear}
        variant="tier-list"
      />

      <WideLayout
        title={customTitle || t.ui("app.weaponTierListTitle")}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.ui("buttons.customize")}
              onClick={() => setIsCustomizeDialogOpen(true)}
              className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t.ui("buttons.customize")}
              </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.ui("tierList.manageLists")}
              onClick={() => setIsManagerDialogOpen(true)}
              className="gap-2 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t.ui("tierList.manageLists")}
              </span>
            </Button>
          </>
        }
        filters={filterGroups}
      >
        <TierTable<WeaponResource, WeaponType>
          items={sortedWeapons}
          itemsById={weaponsById}
          tierAssignments={tierAssignments}
          tierCustomization={tierCustomization}
          onAssignmentsChange={handleAssignmentsChange}
          groups={weaponTypes}
          getGroupKey={(weapon) =>
            getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id]).type ??
            "Sword"
          }
          groupConfig={weaponGroupConfig}
          getGroupName={(group) => t.weaponType(group)}
          getItemName={(item) => t.weapon(item.id)}
          getTooltip={(weapon) => <WeaponTooltip weaponId={weapon.id} />}
          filterItem={(weapon) => {
            const meta = getWeaponDisplayMeta(weapon, weaponStats?.[weapon.id]);
            if (!rarityFilter.has(meta.rarity)) return false;
            if (
              selectedSecondaryStats.size > 0 &&
              meta.secondaryStat != null &&
              !selectedSecondaryStats.has(meta.secondaryStat)
            )
              return false;
            if (ownedOnly && !isOwned("weapon", weapon.id)) return false;
            return true;
          }}
          tableRef={tableRef}
        />
      </WideLayout>

      <TierCustomizationDialog
        isOpen={isCustomizeDialogOpen}
        onClose={() => setIsCustomizeDialogOpen(false)}
        onSave={handleTierCustomizationSave}
        initialCustomization={tierCustomization}
        initialCustomTitle={customTitle}
      />

      <SimpleTierListManagerDialog
        isOpen={isManagerDialogOpen}
        onClose={() => setIsManagerDialogOpen(false)}
        tierLists={tierLists}
        activeTierListId={activeTierListId}
        createTierList={createTierList}
        deleteTierList={deleteTierList}
        renameTierList={renameTierList}
        setActiveTierList={setActiveTierList}
      />

      <AlertDialog
        open={!!pendingImportData}
        onOpenChange={(open) => !open && setPendingImportData(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.ui("tierList.importChoice")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.ui("tierList.importChoiceDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportOverride}>
              {t.ui("tierList.importOverride")}
            </AlertDialogAction>
            <AlertDialogAction onClick={handleImportCreateNew}>
              {t.ui("tierList.importCreateNew")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
