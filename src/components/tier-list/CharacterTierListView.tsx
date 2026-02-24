import type { ActionConfig, ControlHandle } from "@/components/layout/AppBar";
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
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  charactersById,
  elementResourcesByName,
  getSortedCharacters,
  weaponResourcesByName,
} from "@/data/constants";
import { getCharacterDisplayMeta } from "@/data/gameStatsLoader";
import type {
  CharacterResource,
  Element,
  PresetOption,
  TierAssignment,
  TierCustomization,
  TierListData,
} from "@/data/types";
import { elements } from "@/data/types";
import { useGameStats } from "@/hooks/useGameStats";
import { downloadTierListImage } from "@/lib/downloadTierListImage";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";

import { getElementColor } from "@/lib/utils";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import { useTierStore } from "@/stores/useTierStore";
import {
  Download,
  FileDown,
  HelpCircle,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
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
  const { characterStats } = useGameStats();
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
  const author = useTierStore((state) => state.author);
  const description = useTierStore((state) => state.description);

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);
  const [show5Star, setShow5Star] = useState(true);
  const [show4Star, setShow4Star] = useState(true);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Ownership check callback
  const isOwned = useOwnershipStore((s) => s.isOwned);

  // Start tour on first visit (after a short delay for page to render)
  useEffect(() => {
    if (!isTourCompleted("tier-list")) {
      const timer = setTimeout(() => {
        tour.start("tier-list");
        markTourCompleted("tier-list");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tour]);

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
          normalizedAssignments[key] = value;
        } else {
          // Try to generate ID from the key (assuming it's an English name)
          const generatedId = generateId(key);
          if (charactersById[generatedId]) {
            normalizedAssignments[generatedId] = value;
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
        icon: Upload,
        label: t.ui("import.action"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
      },
      {
        key: "export",
        icon: Download,
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
          <>
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-travelers"
                checked={showTravelers}
                onCheckedChange={(checked) =>
                  setShowTravelers(checked === true)
                }
              />
              <Label
                htmlFor="show-travelers"
                className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
              >
                {t.ui("buttons.showTravelers")}
              </Label>
            </div>
          </>
        ),
      },
      {
        key: "rarity",
        content: (
          <>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-5star"
                checked={show5Star}
                onCheckedChange={(checked) => setShow5Star(checked === true)}
              />
              <Label
                htmlFor="show-5star"
                className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
              >
                5★
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-4star"
                checked={show4Star}
                onCheckedChange={(checked) => setShow4Star(checked === true)}
              />
              <Label
                htmlFor="show-4star"
                className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
              >
                4★
              </Label>
            </div>
          </>
        ),
      },
      {
        key: "ownership",
        content: (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="owned-only"
              checked={ownedOnly}
              onCheckedChange={(checked) => setOwnedOnly(checked === true)}
            />
            <Label
              htmlFor="owned-only"
              className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
            >
              {t.ui("common.ownedOnly")}
            </Label>
          </div>
        ),
      },
    ],
    [
      showWeapons,
      showTravelers,
      setShowWeapons,
      setShowTravelers,
      show5Star,
      show4Star,
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
        defaultDescription={description}
      />
      <ClearAllControl
        ref={clearRef}
        onConfirm={handleClear}
        variant="tier-list"
      />

      <WideLayout
        title={customTitle || t.ui("app.tierListTitle")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsCustomizeDialogOpen(true)}
            className="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
            data-tour-step-id="tl-customize"
          >
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t.ui("buttons.customize")}
            </span>
          </Button>
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
            if (meta.rarity === 5 && !show5Star) return false;
            if (meta.rarity === 4 && !show4Star) return false;
            if (character.id.startsWith("traveler") && !showTravelers) {
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
    </>
  );
}
