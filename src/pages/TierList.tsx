import { CharacterTooltip } from "@/components/shared/CharacterTooltip";
import { ClearAllControl } from "@/components/shared/ClearAllControl"; // Updated import
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import { Button } from "@/components/ui/button";
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
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useTierStore } from "@/stores/useTierStore";
import { FileDown, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

  const handleExport = (author: string, description: string) => {
    const data: TierListData = {
      tierAssignments,
      tierCustomization,
      customTitle: customTitle || undefined,
      language,
      author, // Add author to export data
      description, // Add description to export data
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

      // Save metadata to store
      useTierStore.getState().setMetadata(author, description);

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

  const handleDownloadImage = async () => {
    if (!tableRef.current) return;

    await downloadTierListImage({
      tableElement: tableRef.current,
      title: customTitle || t.ui("app.tierListTitle"),
      filename: "tier-list",
      t,
    });
  };

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader
        actions={
          <>
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
            />

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
              className="gap-2"
            >
              <FileDown className="w-4 h-4" />
              {t.ui("app.print")}
            </Button>
          </>
        }
      />

      <div
        className={cn(
          THEME.layout.headerBorder,
          "z-40 flex-shrink-0 sticky top-0"
        )}
      >
        <div className="container mx-auto flex items-center gap-4 py-2">
          <h1 className="text-2xl font-bold text-gray-200">
            {customTitle || t.ui("app.tierListTitle")}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsCustomizeDialogOpen(true)}
              className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Settings className="w-4 h-4" />
              {t.ui("buttons.customize")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWeapons(!showWeapons)}
              className="gap-2"
            >
              {showWeapons
                ? t.ui("buttons.hideWeapons")
                : t.ui("buttons.showWeapons")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTravelers(!showTravelers)}
              className="gap-2"
            >
              {showTravelers
                ? t.ui("buttons.hideTravelers")
                : t.ui("buttons.showTravelers")}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-2">
        <div className="w-[95%] mx-auto h-full">
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
