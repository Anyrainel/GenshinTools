import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { WeaponTooltip } from "@/components/shared/WeaponTooltip";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";
import { Download, FileDown, Filter, Settings, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
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

  const handleExport = (author: string, description: string) => {
    const data: TierListData = {
      tierAssignments,
      tierCustomization,
      customTitle: customTitle || undefined,
      language,
      author,
      description,
    };
    try {
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `[${author}] ${description}.json`;
      link.click();
      URL.revokeObjectURL(url);

      useWeaponTierStore.getState().setMetadata(author, description);

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

  const handleDownloadImage = async () => {
    if (!tableRef.current) return;

    await downloadTierListImage({
      tableElement: tableRef.current,
      title: customTitle || t.ui("app.weaponTierListTitle"),
      filename: "weapon-tier-list",
      t,
    });
  };

  const renderFilters = (isMobile: boolean) => (
    <div
      className={cn(
        "flex gap-4",
        isMobile ? "flex-col items-start" : "items-center flex-wrap justify-end"
      )}
    >
      <div
        className={cn(
          "flex gap-4",
          isMobile ? "flex-col items-start" : "items-center"
        )}
      >
        {WEAPON_RARITIES.map((rarity) => (
          <div key={rarity} className="flex items-center space-x-2">
            <Checkbox
              id={`rarity-${rarity}-${isMobile ? "m" : "d"}`}
              checked={showRarity[rarity]}
              onCheckedChange={(checked) =>
                setShowRarity((prev) => ({
                  ...prev,
                  [rarity]: checked === true,
                }))
              }
            />
            <Label
              htmlFor={`rarity-${rarity}-${isMobile ? "m" : "d"}`}
              className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
            >
              {t.ui(`buttons.includeRarity${rarity}`)}
            </Label>
          </div>
        ))}
      </div>

      {!isMobile && (
        <div className="w-px h-6 bg-gray-600 mx-2 hidden xl:block" />
      )}
      {isMobile && <div className="w-full h-px bg-border my-2" />}

      <div
        className={cn(
          "grid gap-y-2 gap-x-4",
          isMobile ? "grid-cols-2" : "flex items-center flex-wrap justify-end"
        )}
      >
        {sortedWeaponSecondaryStats.map((stat) => (
          <div key={stat} className="flex items-center space-x-2">
            <Checkbox
              id={`stat-${stat}-${isMobile ? "m" : "d"}`}
              checked={selectedSecondaryStats.includes(stat)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedSecondaryStats([...selectedSecondaryStats, stat]);
                } else {
                  setSelectedSecondaryStats(
                    selectedSecondaryStats.filter((s) => s !== stat)
                  );
                }
              }}
            />
            <Label
              htmlFor={`stat-${stat}-${isMobile ? "m" : "d"}`}
              className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
            >
              {t.statShort(stat)}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader
        actions={
          <>
            {/* Desktop Actions */}
            <ClearAllControl onConfirm={handleClear} variant="tier-list" />

            <ImportControl<TierListData>
              options={presetOptions}
              loadPreset={loadPreset}
              onApply={handleImport}
              onLocalImport={handleImport}
              variant="tier-list"
            />

            <ExportControl
              onExport={handleExport}
              variant="tier-list"
              defaultAuthor={author}
              defaultDescription={description}
              className="hidden md:flex"
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
              className="gap-2 hidden md:flex"
            >
              <FileDown className="w-4 h-4" />
              {t.ui("app.print")}
            </Button>
          </>
        }
        mobileMenuItems={
          <>
            <DropdownMenuItem
              onSelect={() => setExportDialogOpen(true)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {t.ui("app.export")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadImage} className="gap-2">
              <FileDown className="w-4 h-4" />
              {t.ui("app.print")}
            </DropdownMenuItem>
          </>
        }
      />

      {/* Hidden Controlled Dialogs for Mobile */}
      <ClearAllControl
        onConfirm={handleClear}
        variant="tier-list"
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        renderTrigger={false}
      />
      <ExportControl
        onExport={handleExport}
        variant="tier-list"
        defaultAuthor={author}
        defaultDescription={description}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        renderTrigger={false}
      />

      <div
        className={cn(
          THEME.layout.headerBorder,
          "z-40 flex-shrink-0 sticky top-0"
        )}
      >
        <div className="container mx-auto flex items-center py-2 gap-4">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-2xl font-bold text-gray-200 truncate">
              {customTitle || t.ui("app.weaponTierListTitle")}
            </h1>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCustomizeDialogOpen(true)}
              className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white flex-shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t.ui("buttons.customize")}
              </span>
            </Button>
          </div>

          {/* Quick Filter Button on Mobile Toolbar */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden gap-2">
                <Filter className="w-4 h-4" />
                <span className="sr-only">Filter</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[240px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{t.ui("filters.filterWeapons")}</SheetTitle>
              </SheetHeader>
              <div className="mt-6">{renderFilters(true)}</div>
            </SheetContent>
          </Sheet>

          <div className="hidden lg:flex flex-wrap items-center gap-4 justify-end">
            {renderFilters(false)}
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-2">
        <div className="w-[95%] mx-auto h-full">
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
        </div>
      </main>

      <TierCustomizationDialog
        isOpen={isCustomizeDialogOpen}
        onClose={() => setIsCustomizeDialogOpen(false)}
        onSave={handleTierCustomizationSave}
        initialCustomization={tierCustomization}
        initialCustomTitle={customTitle}
      />
    </div>
  );
}
