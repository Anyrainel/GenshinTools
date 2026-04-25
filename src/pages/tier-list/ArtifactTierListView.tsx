import { Download, FileDown, Settings, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionConfig } from "@/components/layout/AppBar";
import { WideLayout } from "@/components/layout/WideLayout";
import { ArtifactTooltip } from "@/components/shared/ArtifactTooltip";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { downloadTierListImage } from "@/components/tier-list/downloadTierListImage";
import { TierCustomizationDialog } from "@/components/tier-list/TierCustomizationDialog";
import { TierTable } from "@/components/tier-list/TierTable";
import type { TierGroupConfig } from "@/components/tier-list/tierTableTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TIER_LIST_OTHER_ARTIFACT_SETS,
  TIER_LIST_SUPPORT_ARTIFACT_SETS,
} from "@/data/constants";
import type { Rarity } from "@/data/enums";
import { artifactsById, sortedArtifacts } from "@/data/gameResources";
import type {
  ArtifactSetResource,
  TierAssignment,
  TierCustomization,
  TierListData,
} from "@/data/types";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";

type ArtifactTierGroup = "dps" | "support" | "other";

type ArtifactTierItem = ArtifactSetResource & {
  imagePath: string;
};

const ARTIFACT_GROUPS = ["dps", "support", "other"] as const;
const ARTIFACT_RARITIES = [5, 4] as const;

const artifactGroupConfig: Record<ArtifactTierGroup, TierGroupConfig> = {
  dps: {
    bgClass: "bg-indigo-900/70 backdrop-blur-sm",
    iconPath: artifactsById.gladiators_finale?.imagePaths.flower ?? "",
  },
  support: {
    bgClass: "bg-emerald-900/70 backdrop-blur-sm",
    iconPath: artifactsById.noblesse_oblige?.imagePaths.flower ?? "",
  },
  other: {
    bgClass: "bg-slate-800/70 backdrop-blur-sm",
    iconPath: artifactsById.retracing_bolide?.imagePaths.flower ?? "",
  },
};

const getArtifactGroup = (artifact: ArtifactSetResource): ArtifactTierGroup => {
  if (TIER_LIST_SUPPORT_ARTIFACT_SETS.has(artifact.id)) return "support";
  if (TIER_LIST_OTHER_ARTIFACT_SETS.has(artifact.id) || artifact.rarity === 4) {
    return "other";
  }
  return "dps";
};

interface ArtifactTierListViewProps {
  onActions: (actions: ActionConfig[]) => void;
}

export function ArtifactTierListView({ onActions }: ArtifactTierListViewProps) {
  const { t } = useLanguage();

  const tierAssignments = useArtifactTierStore(
    (state) => state.tierAssignments
  );
  const tierCustomization = useArtifactTierStore(
    (state) => state.tierCustomization
  );
  const customTitle = useArtifactTierStore((state) => state.customTitle);
  const setTierAssignments = useArtifactTierStore(
    (state) => state.setTierAssignments
  );
  const setTierCustomization = useArtifactTierStore(
    (state) => state.setTierCustomization
  );
  const setCustomTitle = useArtifactTierStore((state) => state.setCustomTitle);
  const resetStoredTierList = useArtifactTierStore(
    (state) => state.resetTierList
  );
  const loadTierListData = useArtifactTierStore(
    (state) => state.loadTierListData
  );
  const author = useArtifactTierStore((state) => state.author);
  const description = useArtifactTierStore((state) => state.description);

  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const [showRarity, setShowRarity] = useState<Record<Rarity, boolean>>({
    5: true,
    4: true,
    3: false,
    2: false,
    1: false,
  });
  const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);

  const artifactItems = useMemo<ArtifactTierItem[]>(
    () =>
      sortedArtifacts.map((artifact) => ({
        ...artifact,
        imagePath: artifact.imagePaths.flower,
      })),
    []
  );

  const artifactItemsById = useMemo<Record<string, ArtifactTierItem>>(
    () =>
      Object.fromEntries(
        artifactItems.map((artifact) => [artifact.id, artifact])
      ),
    [artifactItems]
  );

  const loadPreset = useCallback(async (): Promise<TierListData> => {
    throw new Error("Artifact tier list presets are not configured.");
  }, []);

  const handleImport = (importedData: TierListData) => {
    loadTierListData({
      tierAssignments: importedData.tierAssignments,
      tierCustomization: importedData.tierCustomization,
      customTitle: importedData.customTitle || "",
      author: importedData.author || "",
      description: importedData.description || "",
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

      useArtifactTierStore
        .getState()
        .setMetadata(exportAuthor, exportDescription);

      toast.success(t.ui("messages.tierListSaved"));
    } catch (error) {
      console.error("Error saving artifact tier list:", error);
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
      for (const artifactId of Object.keys(newAssignments)) {
        if (newAssignments[artifactId].tier === tier) {
          delete newAssignments[artifactId];
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
      title: customTitle || t.ui("app.artifactTierListTitle"),
      filename: "artifact-tier-list",
      t,
    });
  }, [customTitle, t]);

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

  const filterGroups = useMemo(
    () => [
      {
        key: "rarity",
        content: (
          <>
            {ARTIFACT_RARITIES.map((rarity) => (
              <div key={rarity} className="flex items-center space-x-2">
                <Checkbox
                  id={`artifact-rarity-${rarity}`}
                  checked={showRarity[rarity]}
                  onCheckedChange={(checked) =>
                    setShowRarity((prev) => ({
                      ...prev,
                      [rarity]: checked === true,
                    }))
                  }
                />
                <Label
                  htmlFor={`artifact-rarity-${rarity}`}
                  className="text-sm text-gray-200 cursor-pointer whitespace-nowrap"
                >
                  {rarity === 5
                    ? t.ui("buttons.includeRarity5")
                    : t.ui("buttons.includeRarity4")}
                </Label>
              </div>
            ))}
          </>
        ),
      },
    ],
    [showRarity, t]
  );

  return (
    <>
      <ImportControl<TierListData>
        ref={importRef}
        options={[]}
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
        title={customTitle || t.ui("app.artifactTierListTitle")}
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
        <TierTable<ArtifactTierItem, ArtifactTierGroup>
          items={artifactItems}
          itemsById={artifactItemsById}
          tierAssignments={tierAssignments}
          tierCustomization={tierCustomization}
          onAssignmentsChange={handleAssignmentsChange}
          groups={ARTIFACT_GROUPS}
          getGroupKey={getArtifactGroup}
          groupConfig={artifactGroupConfig}
          getGroupName={(group) =>
            group === "support"
              ? t.ui("tierList.supportSet")
              : group === "other"
                ? t.ui("tierList.otherSet")
                : t.ui("tierList.dpsSet")
          }
          getItemName={(item) => t.artifact(item.id)}
          getTooltip={(artifact) => <ArtifactTooltip setId={artifact.id} />}
          filterItem={(artifact) => showRarity[artifact.rarity]}
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
