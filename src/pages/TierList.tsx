import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Settings, FileDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { ImportControl } from "@/components/shared/ImportControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ClearAllControl } from "@/components/shared/ClearAllControl"; // Updated import
import {
  PresetOption,
  TierListData,
  TierAssignment,
  TierCustomization,
} from "@/data/types"; // Import necessary types
import { useTierStore } from "@/stores/useTierStore";
import CharacterTierTable from "@/components/tier-list/CharacterTierTable";
import TierCustomizationDialog from "@/components/tier-list/TierCustomizationDialog";
import { charactersById } from "@/data/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { downloadTierListImage } from "@/lib/downloadTierListImage";

const presetModules = import.meta.glob<{ default: TierListData }>(
  "@/presets/tier-list/*.json",
  {
    eager: false,
  },
);

// Helper to generate ID from name (for backwards compatibility from genshin-tier-list project)
const generateId = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

const TierListPage = () => {
  const { t, language, setLanguage } = useLanguage();

  const tierAssignments = useTierStore((state) => state.tierAssignments);
  const tierCustomization = useTierStore((state) => state.tierCustomization);
  const customTitle = useTierStore((state) => state.customTitle);
  const setTierAssignments = useTierStore((state) => state.setTierAssignments);
  const setTierCustomization = useTierStore(
    (state) => state.setTierCustomization,
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

  // Show toast when tier assignments change (auto-save) - This logic was in TierList.tsx, moving here.
  // Track previous assignments to detect changes
  const prevAssignmentsRef = useRef<TierAssignment>(tierAssignments);
  // Track if we should show auto-save toast (skip on initial load and manual load)
  const shouldShowAutoSaveRef = useRef(false);

  useEffect(() => {
    // Skip on initial mount
    if (!shouldShowAutoSaveRef.current) {
      shouldShowAutoSaveRef.current = true;
      prevAssignmentsRef.current = tierAssignments;
      return;
    }

    const prev = prevAssignmentsRef.current;
    const curr = tierAssignments;

    // Find what changed
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    const changes: {
      characterId: string;
      fromTier?: string;
      toTier?: string;
    }[] = [];

    allKeys.forEach((characterId) => {
      const prevAssignment = prev[characterId];
      const currAssignment = curr[characterId];

      // Character was added or moved
      if (
        currAssignment &&
        (!prevAssignment || prevAssignment.tier !== currAssignment.tier)
      ) {
        changes.push({
          characterId,
          fromTier: prevAssignment?.tier,
          toTier: currAssignment.tier,
        });
      }
      // Character was removed
      else if (prevAssignment && !currAssignment) {
        changes.push({
          characterId,
          fromTier: prevAssignment.tier,
        });
      }
    });

    // Show toast for changes
    if (changes.length > 0) {
      const change = changes[0];
      const character = charactersById[change.characterId];
      if (!character) return;

      const localizedName = t.character(character.id);

      if (change.toTier) {
        const tierLabel =
          change.toTier === "Pool" ? t.ui("tiers.Pool") : change.toTier;
        toast.success(
          t.format("messages.characterMoved", localizedName, tierLabel),
          {
            duration: 2000,
          },
        );
      } else {
        toast.success(t.format("messages.characterRemoved", localizedName), {
          duration: 2000,
        });
      }
    }

    prevAssignmentsRef.current = tierAssignments;
  }, [tierAssignments, t, language]);

  // Load preset metadata on mount
  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleImport = (importedData: TierListData) => {
    shouldShowAutoSaveRef.current = false; // Disable auto-save toast for manual import

    // Normalize imported data assignments using generateId
    const normalizedAssignments: TierAssignment = {};
    if (importedData.tierAssignments) {
      Object.entries(importedData.tierAssignments).forEach(([key, value]) => {
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
      });
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
    shouldShowAutoSaveRef.current = false;
    resetStoredTierList();
    toast.info(t.ui("messages.tierListReset"));
  };

  const handleTierCustomizationSave = (
    customization: TierCustomization,
    newCustomTitle?: string,
  ) => {
    const newAssignments = { ...tierAssignments };
    const hiddenTiers = Object.keys(customization).filter(
      (tier) => customization[tier]?.hidden,
    );

    hiddenTiers.forEach((tier) => {
      Object.keys(newAssignments).forEach((characterId) => {
        if (newAssignments[characterId].tier === tier) {
          delete newAssignments[characterId];
        }
      });
    });

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
    <TooltipProvider delayDuration={200}>
      <div className={THEME.layout.pageContainer}>
        <ToolHeader
          actions={
            <>
              <ClearAllControl
                onConfirm={handleClear}
                dialogTitle={t.ui("resetConfirmDialog.title")}
                dialogDescription={t.ui("resetConfirmDialog.message")}
                confirmActionLabel={t.ui("resetConfirmDialog.confirm")}
              />

              <ImportControl<TierListData> // Specify type for ImportControl
                options={presetOptions}
                loadPreset={loadPreset}
                onApply={handleImport}
                onLocalImport={handleImport} // Use handleImport for local file import as well
                dialogTitle={t.ui("tierList.importDialogTitle")}
                dialogDescription={t.ui("tierList.importDialogDescription")}
                confirmTitle={t.ui("tierList.presetConfirmTitle")}
                confirmDescription={t.ui("tierList.presetConfirmDescription")}
                confirmActionLabel={t.ui("tierList.presetConfirmAction")}
                loadErrorText={t.ui("tierList.loadError")}
                emptyListText={t.ui("tierList.noPresets")}
                importFromFileText={t.ui("tierList.importFromFile")}
              />

              <ExportControl
                onExport={handleExport}
                dialogTitle={t.ui("tierList.exportDialogTitle")}
                dialogDescription={t.ui("tierList.exportDialogDescription")}
                authorLabel={t.ui("tierList.exportAuthorLabel")}
                authorPlaceholder={t.ui("tierList.exportAuthorPlaceholder")}
                descriptionLabel={t.ui("tierList.exportDescriptionLabel")}
                descriptionPlaceholder={t.ui(
                  "tierList.exportDescriptionPlaceholder",
                )}
                authorRequiredError={t.ui("tierList.exportAuthorRequired")}
                descriptionRequiredError={t.ui(
                  "tierList.exportDescriptionRequired",
                )}
                confirmActionLabel={t.ui("tierList.exportConfirmAction")}
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
            "z-40 flex-shrink-0 sticky top-0",
          )}
        >
          <div className="container mx-auto flex items-center gap-4 py-4">
            <h1 className="text-2xl font-bold text-gray-200">
              {customTitle || t.ui("app.tierListTitle")}
            </h1>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCustomizeDialogOpen(true)}
                className={THEME.button.customize}
              >
                <Settings className="w-4 h-4" />
                {t.ui("buttons.customize")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWeapons(!showWeapons)}
                className={THEME.button.toggle}
              >
                {showWeapons
                  ? t.ui("buttons.hideWeapons")
                  : t.ui("buttons.showWeapons")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTravelers(!showTravelers)}
                className={THEME.button.toggle}
              >
                {showTravelers
                  ? t.ui("buttons.hideTravelers")
                  : t.ui("buttons.showTravelers")}
              </Button>
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          <div className="w-full px-4 h-full">
            <CharacterTierTable
              tierAssignments={tierAssignments}
              tierCustomization={tierCustomization}
              showTravelers={showTravelers}
              onAssignmentsChange={handleAssignmentsChange}
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
    </TooltipProvider>
  );
};

export default TierListPage;
