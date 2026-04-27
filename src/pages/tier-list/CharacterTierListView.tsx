import {
  ArrowLeftRight,
  Download,
  FileDown,
  HelpCircle,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionConfig } from "@/components/layout/AppBar";
import { WideLayout } from "@/components/layout/WideLayout";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ChipColor } from "@/components/shared/colors";
import { getElementColor } from "@/components/shared/colors";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { FilterChip } from "@/components/shared/FilterChip";
import { FilterChipGroup } from "@/components/shared/FilterChipGroup";
import { ImportControl } from "@/components/shared/ImportControl";
import { downloadTierListImage } from "@/components/tier-list/downloadTierListImage";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierListManagerDialog } from "@/components/tier-list/TierListManagerDialog";
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
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Element, Rarity } from "@/data/enums";
import { elements } from "@/data/enums";
import {
  charactersById,
  elementResourcesByName,
  getSortedCharacters,
  weaponResourcesByName,
} from "@/data/gameResources";
import {
  characterStatsResource,
  getCharacterDisplayMeta,
} from "@/data/gameStatsLoader";
import type {
  CharacterResource,
  PresetOption,
  TierAssignment,
  TierCustomization,
  TierListData,
} from "@/data/types";
import { useIsOwned } from "@/hooks/useOwnership";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
  loadPresetPayload,
} from "@/lib/presetLoader";
import { useTierStore } from "@/stores/useTierStore";

const presetModules = import.meta.glob<{ default: TierListData }>(
  "@/presets/tier-list/*.json",
  {
    eager: false,
  }
);

// Helper to generate ID from name (for backwards compatibility from genshin-tier-list project)
const generateId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

const CHARACTER_RARITIES: readonly Rarity[] = [5, 4];

// Build group config from element resources
const elementGroupConfig: Record<Element, TierGroupConfig> = Object.fromEntries(
  elements.map((element) => [
    element,
    {
      bgClass: getElementColor(element, "bg"),
      iconPath: elementResourcesByName[element].imagePath,
    },
  ])
) as Record<Element, TierGroupConfig>;

interface CharacterTierListViewProps {
  onActions: (actions: ActionConfig[]) => void;
}

export function CharacterTierListView({
  onActions,
}: CharacterTierListViewProps) {
  const { t } = useLanguage();
  const characterStats = characterStatsResource.use();
  const sortedCharacters = useMemo(
    () => getSortedCharacters(characterStats ?? null),
    [characterStats]
  );
  const tour = useTour();

  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const tierCustomization = useTierStore((state) => state.tierCustomization);
  const customTitle = useTierStore((state) => state.customTitle);
  const setTierAssignments = useTierStore((state) => state.setTierAssignments);
  const setTierCustomization = useTierStore(
    (state) => state.setTierCustomization
  );
  const setCustomTitle = useTierStore((state) => state.setCustomTitle);
  const resetStoredTierList = useTierStore((state) => state.resetTierList);
  const loadTierListData = useTierStore((state) => state.loadTierListData);
  const showWeapons = useTierStore((state) => state.showWeapons);
  const setShowWeapons = useTierStore((state) => state.setShowWeapons);
  const showTravelers = useTierStore((state) => state.showTravelers);
  const setShowTravelers = useTierStore((state) => state.setShowTravelers);
  const showManekin = useTierStore((state) => state.showManekin);
  const setShowManekin = useTierStore((state) => state.setShowManekin);
  const author = useTierStore((state) => state.author);
  const description = useTierStore((state) => state.description);

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [isManagerDialogOpen, setIsManagerDialogOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );
  const [rarityFilter, setRarityFilter] = useState<Set<Rarity>>(
    () => new Set<Rarity>([5, 4])
  );
  const [ownedOnly, setOwnedOnly] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Ownership check callback
  const isOwned = useIsOwned();

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const [pendingImportData, setPendingImportData] =
    useState<TierListData | null>(null);

  const normalizeImportData = (importedData: TierListData): TierListData => {
    const normalizedAssignments: TierAssignment = {};
    if (importedData.tierAssignments) {
      for (const [key, value] of Object.entries(importedData.tierAssignments)) {
        if (charactersById[key]) {
          normalizedAssignments[key] = value;
        } else {
          const generatedId = generateId(key);
          if (charactersById[generatedId]) {
            normalizedAssignments[generatedId] = value;
          }
        }
      }
    }
    return { ...importedData, tierAssignments: normalizedAssignments };
  };

  const handleImport = (importedData: TierListData) => {
    const normalized = normalizeImportData(importedData);
    const listCount = Object.keys(useTierStore.getState().tierLists).length;
    if (listCount > 1) {
      setPendingImportData(normalized);
    } else {
      loadTierListData({
        tierAssignments: normalized.tierAssignments,
        tierCustomization: normalized.tierCustomization,
        customTitle: normalized.customTitle || "",
      });
      toast.success(t.ui("messages.tierListLoaded"));
    }
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
    useTierStore
      .getState()
      .createTierList(pendingImportData.customTitle || undefined);
    useTierStore.getState().loadTierListData({
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

      // Save metadata to store
      useTierStore.getState().setMetadata(exportAuthor, exportDescription);

      toast.success(t.ui("messages.tierListSaved"));
    } catch (error) {
      console.error("Error saving tier list:", error);
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
      for (const characterId of Object.keys(newAssignments)) {
        if (newAssignments[characterId].tier === tier) {
          delete newAssignments[characterId];
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
      title: customTitle || t.ui("app.tierListTitle"),
      filename: "tier-list",
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
        tourStepId: "tl-export",
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
      {
        key: "help",
        icon: HelpCircle,
        label: t.ui("buttons.help"),
        onTrigger: () => tour.start("tier-list"),
      },
    ];
    onActions(actions);
  }, [t, handleDownloadImage, tour, onActions]);

  // Filter groups for WideLayout
  const filterGroups = useMemo(
    () => [
      {
        key: "display",
        content: (
          <div className="flex flex-wrap gap-1">
            <FilterChip
              active={showWeapons}
              onClick={() => setShowWeapons(!showWeapons)}
            >
              {t.ui("buttons.showWeapons")}
            </FilterChip>
            <FilterChip
              active={showTravelers}
              onClick={() => setShowTravelers(!showTravelers)}
            >
              {t.ui("buttons.showTravelers")}
            </FilterChip>
            <FilterChip
              active={showManekin}
              onClick={() => setShowManekin(!showManekin)}
            >
              {t.ui("buttons.showManekin")}
            </FilterChip>
          </div>
        ),
      },
      {
        key: "rarity",
        content: (
          <FilterChipGroup
            options={CHARACTER_RARITIES}
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
        key: "ownership",
        content: (
          <FilterChip
            active={ownedOnly}
            onClick={() => setOwnedOnly(!ownedOnly)}
          >
            {t.ui("common.ownedOnly")}
          </FilterChip>
        ),
      },
    ],
    [
      showWeapons,
      showTravelers,
      showManekin,
      setShowWeapons,
      setShowTravelers,
      setShowManekin,
      rarityFilter,
      ownedOnly,
      t,
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
        title={customTitle || t.ui("app.tierListTitle")}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCustomizeDialogOpen(true)}
              className="gap-2 bg-yellow-700 hover:bg-yellow-800 text-white"
              data-tour-step-id="tl-customize"
            >
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">
                {t.ui("buttons.customize")}
              </span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
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
        <TierTable<CharacterResource, Element>
          items={sortedCharacters}
          itemsById={charactersById}
          tierAssignments={tierAssignments}
          tierCustomization={tierCustomization}
          onAssignmentsChange={handleAssignmentsChange}
          groups={elements}
          getGroupKey={(character) =>
            getCharacterDisplayMeta(character, characterStats?.[character.id])
              .element ?? "Pyro"
          }
          groupConfig={elementGroupConfig}
          getGroupName={(group) => t.element(group)}
          getItemName={(item) => t.character(item.id)}
          getTooltip={(character) => (
            <CharacterTooltip characterId={character.id} />
          )}
          filterItem={(character) => {
            const meta = getCharacterDisplayMeta(
              character,
              characterStats?.[character.id]
            );
            if (!rarityFilter.has(meta.rarity)) return false;
            if (character.id.startsWith("traveler") && !showTravelers) {
              return false;
            }
            if (character.id.startsWith("manekin") && !showManekin) {
              return false;
            }
            if (ownedOnly && !isOwned("character", character.id)) return false;
            return true;
          }}
          getOverlayImage={(character) => {
            if (!showWeapons) return undefined;
            const meta = getCharacterDisplayMeta(
              character,
              characterStats?.[character.id]
            );
            return meta.weaponType != null
              ? weaponResourcesByName[meta.weaponType].imagePath
              : undefined;
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

      <TierListManagerDialog
        isOpen={isManagerDialogOpen}
        onClose={() => setIsManagerDialogOpen(false)}
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
