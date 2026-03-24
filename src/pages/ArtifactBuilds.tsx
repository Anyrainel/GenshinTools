import { ArtifactBuildsView } from "@/components/artifact-builds/ArtifactBuildsView";
import { BuildImportControl } from "@/components/artifact-builds/BuildImportControl";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import { CharacterBuildView } from "@/components/artifact-builds/CharacterBuildView";
import { WeightsView } from "@/components/artifact-builds/WeightsView";

import type { ActionConfig, ControlHandle } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { captureWithBranding } from "@/components/shared/ExportBranding";
import { ExportControl } from "@/components/shared/ExportControl";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  Build,
  BuildGroup,
  BuildPayload,
  BuildPayloadV5,
  PresetOption,
} from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { resolveAllBuildsSnapshot } from "@/hooks/useResolvedBuilds";
import { loadPreset as loadPresetFromRegistry } from "@/lib/artifact-builds/buildPresetRegistry";
import {
  createBuildExportPayloadV5,
  serializeBuildExportPayload,
} from "@/lib/artifact-builds/buildUtils";
import { downloadElementAsImage } from "@/lib/downloadImage";
import { loadPresetMetadata } from "@/lib/presetLoader";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { Download, FileDown, HelpCircle, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const presetModules = import.meta.glob<{ default: BuildPayload }>(
  "@/presets/artifact-builds/*.json",
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

  // Support deep-linking to a character via ?char=<id> (e.g. from evaluation page)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount
  useEffect(() => {
    const charParam = searchParams.get("char");
    if (charParam) {
      setTargetCharacterId(charParam);
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.delete("char");
        newParams.set("tab", "configure");
        return newParams;
      });
    }
  }, []);

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
  const subscribePreset = useBuildsStore((state) => state.subscribePreset);
  const clearAllBuilds = useBuildsStore((state) => state.clearAll);
  const author = useBuildsStore((state) => state.author);
  const description = useBuildsStore((state) => state.description);
  const computeOptions = useBuildsStore((state) => state.computeOptions);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  // Load preset metadata on mount
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

  const handleDownloadImage = useCallback(async () => {
    const content = computeContentRef.current;
    if (!content) return;
    await captureWithBranding(
      content,
      (wrapper) => downloadElementAsImage(wrapper, "artifact-configs", t),
      { minWidth: 1200 }
    );
  }, [t]);

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
      <BuildImportControl
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onSubscribe={(id, payload) => {
          subscribePreset(id, payload);
          toast.success(t.ui("app.presetLoaded"));
        }}
        onCopy={(payload) => {
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
          />
        </TabsContent>

        <TabsContent value="filters" className="mt-0 h-full">
          <ArtifactBuildsView
            contentRef={computeContentRef}
            onJumpToCharacter={(characterId) => {
              setTargetCharacterId(characterId);
              setActiveTab("configure");
            }}
            onGoToConfigure={() => setActiveTab("configure")}
            onOpenImport={() => importRef.current?.open()}
          />
        </TabsContent>

        <TabsContent value="weights" className="mt-0 h-full">
          <WeightsView />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
