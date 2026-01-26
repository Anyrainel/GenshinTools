import {
  type ActionConfig,
  AppBar,
  type ControlHandle,
} from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { WideLayout } from "@/components/layout/WideLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  sortedWeaponSecondaryStats,
  sortedWeapons,
  weaponResourcesByName,
  weaponsById,
} from "@/data/constants";
import type {
  MainStat,
  PresetOption,
  Rarity,
  TierAssignment,
  TierCustomization,
  TierListData,
  Weapon,
  WeaponType,
} from "@/data/types";
import { weaponTypes } from "@/data/types";

import { downloadTierListImage } from "@/lib/downloadTierListImage";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";

import { useWeaponTierStore } from "@/stores/useWeaponTierStore";
import { Download, FileDown, Settings, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

export default function WeaponTierListPage() {
  const { t, language, setLanguage } = useLanguage();

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

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  // Local UI state for filters (not persisted)
  const [showRarity, setShowRarity] = useState<Record<Rarity, boolean>>({
    5: true,
    4: true,
    3: true,
    2: false,
    1: false,
  });
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [selectedSecondaryStats, setSelectedSecondaryStats] = useState<
    MainStat[]
  >(sortedWeaponSecondaryStats);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleImport = (importedData: TierListData) => {
    loadTierListData({
      tierAssignments: importedData.tierAssignments,
      tierCustomization: importedData.tierCustomization,
      customTitle: importedData.customTitle || "",
    });
    if (importedData.language && importedData.language !== language) {
      setLanguage(importedData.language);
    }
    toast.success(t.ui("messages.tierListLoaded"));
  };

  const handleExport = (exportAuthor: string, exportDescription: string) => {
    const data: TierListData = {
      tierAssignments,
      tierCustomization,
      customTitle: customTitle || undefined,
      language,
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

  // Actions configuration
  const actions: ActionConfig[] = useMemo(
    () => [
      {
        key: "import",
        icon: Upload,
        label: t.ui("app.import"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
      },
      {
        key: "export",
        icon: Download,
        label: t.ui("app.export"),
        onTrigger: () => exportRef.current?.open(),
      },
      {
        key: "clear",
        icon: Trash2,
        label: t.ui("app.clear"),
        onTrigger: () => clearRef.current?.open(),
      },
      {
        key: "print",
        icon: FileDown,
        label: t.ui("app.print"),
        onTrigger: handleDownloadImage,
      },
    ],
    [t, handleDownloadImage]
  );

  // Filter groups for WideLayout
  const filterGroups = useMemo(
    () => [
      {
        key: "rarity",
        content: (
          <>
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
                  className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
                >
                  {(() => {
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
                  })()}
                </Label>
              </div>
            ))}
          </>
        ),
      },
      {
        key: "stats",
        content: (
          <>
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
                  className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
                >
                  {t.statShort(stat)}
                </Label>
              </div>
            ))}
          </>
        ),
      },
    ],
    [showRarity, selectedSecondaryStats, t]
  );

  return (
    <PageLayout actions={actions}>
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
        defaultDescription={description}
      />
      <ClearAllControl
        ref={clearRef}
        onConfirm={handleClear}
        variant="tier-list"
      />

      <WideLayout
        title={customTitle || t.ui("app.weaponTierListTitle")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCustomizeDialogOpen(true)}
            className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t.ui("buttons.customize")}
            </span>
          </Button>
        }
        filters={filterGroups}
      >
        <TierTable<Weapon, WeaponType>
          items={sortedWeapons}
          itemsById={weaponsById}
          tierAssignments={tierAssignments}
          tierCustomization={tierCustomization}
          onAssignmentsChange={handleAssignmentsChange}
          groups={weaponTypes}
          groupKey="type"
          groupConfig={weaponGroupConfig}
          getGroupName={(group) => t.weaponType(group)}
          getItemName={(item) => t.weaponName(item.id)}
          getTooltip={(weapon) => <WeaponTooltip weaponId={weapon.id} />}
          filterItem={(weapon) => {
            if (!showRarity[weapon.rarity]) return false;
            if (!selectedSecondaryStats.includes(weapon.secondaryStat))
              return false;
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
    </PageLayout>
  );
}
