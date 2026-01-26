import { ArtifactFilterView } from "@/components/artifact-filter/ArtifactFilterView";
import { CharacterBuildView } from "@/components/artifact-filter/CharacterBuildView";
import type {
  ActionConfig,
  ControlHandle,
  TabConfig,
} from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  Build,
  BuildGroup,
  BuildPayload,
  PresetOption,
} from "@/data/types";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { serializeBuildExportPayload } from "@/stores/jsonUtils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { toPng } from "html-to-image";
import {
  Download,
  FileDown,
  Filter,
  HelpCircle,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const presetModules = import.meta.glob<{ default: BuildPayload }>(
  "@/presets/artifact-filter/*.json",
  { eager: false }
);

export default function ArtifactBuildsPage() {
  const { t } = useLanguage();
  const tour = useTour();
  const computeContentRef = useRef<HTMLDivElement>(null);
  const [targetCharacterId, setTargetCharacterId] = useState<string>();

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "configure";

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

  // Start tour on first visit (after a short delay for page to render)
  useEffect(() => {
    if (!isTourCompleted("artifact-filter") && activeTab === "configure") {
      const timer = setTimeout(() => {
        tour.start("artifact-filter");
        markTourCompleted("artifact-filter");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tour, activeTab]);

  const importBuilds = useBuildsStore((state) => state.importBuilds);
  const clearAllBuilds = useBuildsStore((state) => state.clearAll);
  const author = useBuildsStore((state) => state.author);
  const description = useBuildsStore((state) => state.description);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  // Load preset metadata on mount
  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleExport = (exportAuthor: string, exportDescription: string) => {
    // Read data directly from store at export time (not as a subscription)
    const state = useBuildsStore.getState();
    const {
      characterToBuildIds,
      builds,
      hiddenCharacters,
      characterWeapons,
      computeOptions,
    } = state;

    // Convert store format to export format
    const exportData: BuildGroup[] = [];

    for (const [characterId, buildIds] of Object.entries(characterToBuildIds)) {
      const characterBuilds = buildIds
        .map((id) => builds[id])
        .filter((b): b is Build => b !== undefined);

      if (characterBuilds.length > 0) {
        exportData.push({
          characterId,
          builds: characterBuilds,
          hidden: !!hiddenCharacters?.[characterId],
          weapons: characterWeapons[characterId],
        });
      }
    }

    const dataStr = serializeBuildExportPayload(
      exportData,
      computeOptions,
      exportAuthor,
      exportDescription
    );
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `[${exportAuthor}] ${exportDescription}.json`;
    link.click();
    URL.revokeObjectURL(url);

    // Save metadata to store
    state.setMetadata(exportAuthor, exportDescription);
  };

  const handleDownloadImage = useCallback(async () => {
    if (!computeContentRef.current) return;

    try {
      const loadingToast = toast.loading(t.ui("app.generatingImage"));

      // Add a small delay to allow toast to show
      await new Promise((resolve) => setTimeout(resolve, 100));

      const element = computeContentRef.current;
      const { scrollWidth, scrollHeight } = element;

      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#10141d", // Match the dark theme background
        width: scrollWidth,
        height: scrollHeight,
        pixelRatio: 2,
        style: {
          // Explicitly set width/height in style to prevent reflow during capture
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
        },
      });

      const link = document.createElement("a");
      link.download = `artifact-configs-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();

      toast.dismiss(loadingToast);
      toast.success(t.ui("app.imageGenerated"));
    } catch (err) {
      console.error(err);
      toast.error(t.ui("app.imageGenerationFailed"));
    }
  }, [t]);

  // Tab configuration for AppBar
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        value: "configure",
        label: t.ui("navigation.configure"),
        icon: Settings,
      },
      {
        value: "filters",
        label: t.ui("navigation.computeFilters"),
        icon: Filter,
        tourStepId: "af-compute-tab",
      },
    ],
    [t]
  );

  // Actions depend on active tab
  const actions: ActionConfig[] = useMemo(() => {
    if (activeTab === "filters") {
      return [
        {
          key: "print",
          icon: FileDown,
          label: t.ui("app.print"),
          onTrigger: handleDownloadImage,
          alwaysShow: true,
        },
        {
          key: "help",
          icon: HelpCircle,
          label: t.ui("buttons.help"),
          onTrigger: () => tour.start("artifact-filter"),
        },
      ];
    }

    return [
      {
        key: "import",
        icon: Upload,
        label: t.ui("app.import"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
        tourStepId: "af-presets",
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
        key: "help",
        icon: HelpCircle,
        label: t.ui("buttons.help"),
        onTrigger: () => tour.start("artifact-filter"),
      },
    ];
  }, [activeTab, t, handleDownloadImage, tour]);

  return (
    <PageLayout
      actions={actions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Control dialogs - render without triggers, opened via ref */}
      <ImportControl
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onApply={importBuilds}
        onLocalImport={importBuilds}
      />
      <ExportControl
        ref={exportRef}
        onExport={handleExport}
        defaultAuthor={author}
        defaultDescription={description}
      />
      <ClearAllControl ref={clearRef} onConfirm={clearAllBuilds} />

      {/* Main Content Area - Takes remaining height */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="h-full overflow-hidden"
      >
        <TabsContent value="configure" className="mt-0 h-full">
          <CharacterBuildView
            targetCharacterId={targetCharacterId}
            onTargetProcessed={() => setTargetCharacterId(undefined)}
          />
        </TabsContent>

        <TabsContent value="filters" className="mt-0 h-full">
          <ArtifactFilterView
            contentRef={computeContentRef}
            onJumpToCharacter={(characterId) => {
              setTargetCharacterId(characterId);
              setActiveTab("configure");
            }}
          />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
