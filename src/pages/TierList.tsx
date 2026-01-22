import {
  type ActionConfig,
  AppBar,
  type ControlHandle,
} from "@/components/layout/AppBar";
import { WideLayout } from "@/components/layout/WideLayout";
import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  charactersById,
  elementResourcesByName,
  sortedCharacters,
  weaponResourcesByName,
} from "@/data/constants";
import type {
  Character,
  Element,
  PresetOption,
  TierAssignment,
  TierCustomization,
  TierListData,
} from "@/data/types";
import { elements } from "@/data/types";
import { downloadTierListImage } from "@/lib/downloadTierListImage";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { THEME } from "@/lib/styles";
import { useTierStore } from "@/stores/useTierStore";
import { Download, FileDown, Settings, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

// Build group config from element resources
const elementGroupConfig: Record<Element, TierGroupConfig> = Object.fromEntries(
  elements.map((element) => [
    element,
    {
      bgClass: THEME.element.bg[element],
      iconPath: elementResourcesByName[element].imagePath,
    },
  ])
) as Record<Element, TierGroupConfig>;

export default function TierListPage() {
  const { t, language, setLanguage } = useLanguage();

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
  const author = useTierStore((state) => state.author);
  const description = useTierStore((state) => state.description);

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load preset metadata on mount
  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleImport = (importedData: TierListData) => {
    // Normalize imported data assignments using generateId
    const normalizedAssignments: TierAssignment = {};
    if (importedData.tierAssignments) {
      for (const [key, value] of Object.entries(importedData.tierAssignments)) {
        if (charactersById[key]) {
          normalizedAssignments[key] = value as {
            tier: string;
            position: number;
          };
        } else {
          // Try to generate ID from the key (assuming it's an English name)
          const generatedId = generateId(key);
          if (charactersById[generatedId]) {
            normalizedAssignments[generatedId] = value as {
              tier: string;
              position: number;
            };
          }
        }
      }
      importedData.tierAssignments = normalizedAssignments;
    }

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

  // Actions configuration
  const actions: ActionConfig[] = useMemo(
    () => [
      {
        key: "clear",
        icon: Trash2,
        label: t.ui("app.clear"),
        onTrigger: () => clearRef.current?.open(),
        alwaysShow: true,
      },
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
        key: "display",
        title: "Display", // Optional title if supported by WideLayout, otherwise just separation
        content: (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-weapons"
              checked={showWeapons}
              onCheckedChange={(checked) => setShowWeapons(checked === true)}
            />
            <Label
              htmlFor="show-weapons"
              className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
            >
              {t.ui("buttons.showWeapons")}
            </Label>
          </div>
        ),
      },
      {
        key: "filter",
        title: "Filter",
        content: (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-travelers"
              checked={showTravelers}
              onCheckedChange={(checked) => setShowTravelers(checked === true)}
            />
            <Label
              htmlFor="show-travelers"
              className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
            >
              {t.ui("buttons.showTravelers")}
            </Label>
          </div>
        ),
      },
    ],
    [showWeapons, showTravelers, setShowWeapons, setShowTravelers, t]
  );

  return (
    <div className={THEME.layout.page}>
      <AppBar actions={actions} />

      {/* Control dialogs - render without triggers, opened via ref */}
      <ClearAllControl
        ref={clearRef}
        onConfirm={handleClear}
        variant="tier-list"
      />
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

      <WideLayout
        title={customTitle || t.ui("app.tierListTitle")}
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
        <div className="w-full h-full">
          <TierTable<Character, Element>
            items={sortedCharacters}
            itemsById={charactersById}
            tierAssignments={tierAssignments}
            tierCustomization={tierCustomization}
            onAssignmentsChange={handleAssignmentsChange}
            groups={elements}
            groupKey="element"
            groupConfig={elementGroupConfig}
            getGroupName={(group) => t.element(group)}
            getItemName={(item) => t.character(item.id)}
            getTooltip={(character) => (
              <CharacterTooltip characterId={character.id} />
            )}
            filterItem={(character) => {
              if (character.id.startsWith("traveler") && !showTravelers) {
                return false;
              }
              return true;
            }}
            getOverlayImage={(character) => {
              if (!showWeapons) return undefined;
              return weaponResourcesByName[character.weaponType].imagePath;
            }}
            tableRef={tableRef}
          />
        </div>
      </WideLayout>

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
