import { Download, FileDown, HelpCircle, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import type { ActionConfig } from "@/components/layout/AppBar";
import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import type { BuildPayload, BuildPayloadV5, PresetOption } from "@/data/types";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import { resolveAllBuildsSnapshot } from "@/hooks/useResolvedBuilds";
import { loadPreset as loadPresetFromRegistry } from "@/lib/artifact-builds/buildPresetRegistry";
import { createBuildExportPayloadV5 } from "@/lib/artifact-builds/buildUtils";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
} from "@/lib/presetLoader";
import {
  ArtifactBuildsView,
  type ArtifactBuildsViewHandle,
} from "@/pages/artifact-builds/ArtifactBuildsView";
import { AutoTuneView } from "@/pages/artifact-builds/AutoTuneView";
import { CharacterBuildView } from "@/pages/artifact-builds/CharacterBuildView";
import { useBuildsStore } from "@/stores/useBuildsStore";

const isValidArtifactBuildsTab = (
  tab: string | null
): tab is "configure" | "filters" | "weights" =>
  tab === "configure" || tab === "filters" || tab === "weights";

const presetModules = import.meta.glob<{ default: BuildPayload }>(
  "@/presets/artifact-builds/*.json",
  { eager: false }
);

export default function ArtifactBuildsPage() {
  const { t } = useLanguage();
  const tour = useTour();
  const buildsViewRef = useRef<ArtifactBuildsViewHandle>(null);
  const [targetCharacterId, setTargetCharacterId] = useState<string>();

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/artifact-filter",
    defaultTab: "configure",
    isValidTab: isValidArtifactBuildsTab,
    preserveSearchOnTabChange: true,
  });

  useEffect(() => {
    const charParam = searchParams.get("char");
    if (!charParam) return;

    setTargetCharacterId(charParam);
    if (activeTab !== "configure") {
      setActiveTab("configure");
      return;
    }

    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.delete("char");
      return newParams;
    });
  }, [activeTab, searchParams, setActiveTab, setSearchParams]);

  const importBuilds = useBuildsStore((state) => state.importBuilds);
  const subscribePreset = useBuildsStore((state) => state.subscribePreset);
  const clearAllBuilds = useBuildsStore((state) => state.clearAll);
  const author = useBuildsStore((state) => state.author);
  const description = useBuildsStore((state) => state.description);
  const computeOptions = useBuildsStore((state) => state.computeOptions);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );

  // Load preset metadata on mount (no-op re-render if already cached)
  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetFromRegistry(path);
  }, []);

  const handleExport = useCallback(
    async (exportAuthor: string, exportDescription: string) => {
      const payload = createBuildExportPayloadV5(
        resolveAllBuildsSnapshot(),
        computeOptions,
        exportAuthor,
        exportDescription
      );

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `[${exportAuthor}] ${exportDescription || "genshin-builds"}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Save metadata
      useBuildsStore.getState().setMetadata(exportAuthor, exportDescription);
    },
    [computeOptions]
  );

  const handleDownloadImage = useCallback(() => {
    buildsViewRef.current?.downloadImage();
  }, []);

  const handleExportTrigger = useCallback(() => {
    const state = useBuildsStore.getState();
    const { characterToBuildIds, builds } = state;
    let count = 0;
    const warnings: string[] = [];

    for (const [charId, buildIds] of Object.entries(characterToBuildIds)) {
      for (const buildId of buildIds) {
        const build = builds[buildId];
        if (!build) continue;

        const errorKeys = state.validationErrors?.[buildId] || [];
        if (errorKeys.length > 0) {
          count++;
          if (warnings.length < 3) {
            const charName = t.character(charId);
            const details = errorKeys.map((k) => t.ui(k)).join(", ");
            warnings.push(`${charName} (${build.name}): ${details}`);
          }
        }
      }
    }

    exportRef.current?.open({ warnings, count });
  }, [t]);

  // Tab configuration for AppBar
  const tabs = useMemo(() => getTabsForRoute(t, "/artifact-filter"), [t]);

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
        icon: Download,
        label: t.ui("import.action"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
        tourStepId: "af-presets",
      },
      {
        key: "export",
        icon: Upload,
        label: t.ui("export.action"),
        onTrigger: handleExportTrigger,
      },
      {
        key: "clear",
        icon: Trash2,
        label: t.ui("common.clear"),
        onTrigger: () => clearRef.current?.open(),
      },
      {
        key: "help",
        icon: HelpCircle,
        label: t.ui("buttons.help"),
        onTrigger: () => tour.start("artifact-filter"),
      },
    ];
  }, [activeTab, t, handleDownloadImage, tour, handleExportTrigger]);

  return (
    <PageLayout
      actions={actions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClearData={useBuildsStore.getState().clearAll}
      clearLabel={t.ui("common.clearBuilds")}
    >
      <BuildsDefaultPresetPrompt />

      {/* Control dialogs - render without triggers, opened via ref */}
      <ImportControl<BuildPayloadV5>
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onApply={(payload, preset) => {
          if (!preset) return;
          subscribePreset(preset.path, payload);
          toast.success(t.ui("app.presetLoaded"));
        }}
        onLocalImport={(payload) => {
          importBuilds(payload);
          toast.success(t.ui("app.imported"));
        }}
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
            onOpenImport={() => importRef.current?.open()}
            onShowTour={() => tour.start("artifact-filter")}
          />
        </TabsContent>

        <TabsContent value="filters" className="mt-0 h-full">
          <ArtifactBuildsView
            ref={buildsViewRef}
            onJumpToCharacter={(characterId) => {
              setTargetCharacterId(characterId);
              setActiveTab("configure");
            }}
            onOpenImport={() => importRef.current?.open()}
          />
        </TabsContent>

        <TabsContent value="weights" className="mt-0 h-full">
          <AutoTuneView />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
