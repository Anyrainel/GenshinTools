import { ComputeView } from "@/components/artifact-filter/ComputeView";
import { ConfigureView } from "@/components/artifact-filter/ConfigureView";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  Build,
  BuildGroup,
  BuildPayload,
  PresetOption,
} from "@/data/types";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { serializeBuildExportPayload } from "@/stores/jsonUtils";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { toPng } from "html-to-image";
import { Download, FileDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const presetModules = import.meta.glob<{ default: BuildPayload }>(
  "@/presets/artifact-filter/*.json",
  { eager: false }
);

export default function ArtifactFilterPage() {
  const { t } = useLanguage();
  const computeContentRef = useRef<HTMLDivElement>(null);
  const [targetCharacterId, setTargetCharacterId] = useState<string>();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
      author,
      description
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
          activeTab === "filters" ? (
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
                className="hidden md:flex"
              />
            </>
          )
        }
        mobileMenuItems={
          activeTab === "filters" ? undefined : (
            <DropdownMenuItem
              onSelect={() => setExportDialogOpen(true)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              {t.ui("app.export")}
            </DropdownMenuItem>
          )
        }
      />

      <ExportControl
        onExport={handleExport}
        defaultAuthor={author}
        defaultDescription={description}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        renderTrigger={false}
      />

      <div className={cn(THEME.layout.headerBorder, "z-40")}>
        <div className="px-2 mx-auto pt-2 pb-2">
          {/* Tab Bar */}
          <div className="flex justify-center">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 h-11">
                <TabsTrigger
                  value="configure"
                  className="text-base py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("navigation.configure")}
                </TabsTrigger>
                <TabsTrigger
                  value="filters"
                  className="text-base py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
        <div className="px-2 mx-auto h-full">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full"
          >
            <TabsContent
              value="configure"
              className="mt-0 h-full data-[state=inactive]:hidden"
            >
              <ConfigureView
                targetCharacterId={targetCharacterId}
                onTargetProcessed={() => setTargetCharacterId(undefined)}
              />
            </TabsContent>

            <TabsContent
              value="filters"
              className="mt-0 h-full data-[state=inactive]:hidden"
            >
              <ComputeView
                contentRef={computeContentRef}
                onJumpToCharacter={(characterId) => {
                  setTargetCharacterId(characterId);
                  setActiveTab("configure");
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
