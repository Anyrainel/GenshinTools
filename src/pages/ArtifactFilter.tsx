import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import {
  ConfigureView,
  ConfigureViewRef,
} from "@/components/artifact-filter/ConfigureView";
import { ComputeView } from "@/components/artifact-filter/ComputeView";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { serializeBuildExportPayload } from "@/stores/jsonUtils";
import { Build, BuildGroup, BuildPayload, PresetOption } from "@/data/types";
import { ImportControl } from "@/components/shared/ImportControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";

const presetModules = import.meta.glob<{ default: BuildPayload }>(
  "@/presets/artifact-filter/*.json",
  { eager: false },
);

const Index = () => {
  const { t } = useLanguage();
  const configureViewRef = useRef<ConfigureViewRef>(null);
  const computeContentRef = useRef<HTMLDivElement>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "configure";

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

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

  const handleExport = (author: string, description: string) => {
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

    Object.entries(characterToBuildIds).forEach(([characterId, buildIds]) => {
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
    });

    const dataStr = serializeBuildExportPayload(
      exportData,
      computeOptions,
      author,
      description,
    );
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `[${author}] ${description}.json`;
    link.click();
    URL.revokeObjectURL(url);

    // Save metadata to store
    state.setMetadata(author, description);
  };

  const handleDownloadImage = async () => {
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
  };

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader
        actions={
          <>
            {activeTab === "filters" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadImage}
                className="gap-2"
              >
                <FileDown className="w-4 h-4" />
                {t.ui("app.print")}
              </Button>
            ) : (
              <>
                <ClearAllControl onConfirm={clearAllBuilds} />

                <ImportControl
                  options={presetOptions}
                  loadPreset={loadPreset}
                  onApply={importBuilds}
                  onLocalImport={importBuilds}
                />

                <ExportControl
                  onExport={handleExport}
                  defaultAuthor={author}
                  defaultDescription={description}
                />
              </>
            )}
          </>
        }
      />

      <div className={cn(THEME.layout.headerBorder, "z-40")}>
        <div className="container mx-auto pt-2 pb-2">
          {/* Tab Bar */}
          <div className="flex justify-center">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2">
                <TabsTrigger
                  value="configure"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("navigation.configure")}
                </TabsTrigger>
                <TabsTrigger
                  value="filters"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("navigation.computeFilters")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Main Content Area - Takes remaining height */}
      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto h-full">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full"
          >
            <TabsContent
              value="configure"
              className="mt-0 h-full data-[state=inactive]:hidden"
            >
              <ConfigureView ref={configureViewRef} />
            </TabsContent>

            <TabsContent
              value="filters"
              className="mt-0 h-full data-[state=inactive]:hidden"
            >
              <ComputeView
                contentRef={computeContentRef}
                onJumpToCharacter={(characterId) => {
                  setActiveTab("configure");
                  setTimeout(() => {
                    configureViewRef.current?.scrollToCharacter(characterId);
                  }, 0);
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
