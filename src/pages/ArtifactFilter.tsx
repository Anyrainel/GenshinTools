import { useState, useCallback, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FileDown } from 'lucide-react';
import { ConfigureView, ConfigureViewRef } from '@/components/artifact-filter/ConfigureView';
import { ComputeView } from '@/components/artifact-filter/ComputeView';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBuildsStore } from '@/stores/useBuildsStore';
import { serializeBuildExportPayload } from '@/stores/jsonUtils';
import { Build, BuildGroup, BuildPayload, PresetOption } from '@/data/types';
import { ImportControl, ExportControl, ClearAllControl } from '@/components/shared';
import { computeArtifactFilters } from '@/lib/computeFilters';
import { generateAllArtifactsMarkdown, downloadMarkdown } from '@/lib/printConfig';
import { ToolHeader } from '@/components/shared/ToolHeader';

const presetModules = import.meta.glob<{ default: BuildPayload }>('@/presets/artifact-filter/*.json', { eager: false });

const ACTIVE_TAB_KEY = 'genshin-artifact-filter:activeTab';

const Index = () => {
  const { t, language } = useLanguage();
  const configureViewRef = useRef<ConfigureViewRef>(null);

  // Initialize activeTab from localStorage, fallback to 'configure'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_TAB_KEY) || 'configure';
    } catch {
      return 'configure';
    }
  });

  const importBuilds = useBuildsStore((state) => state.importBuilds);
  const clearAllBuilds = useBuildsStore((state) => state.clearAll);
  const author = useBuildsStore((state) => state.author);
  const description = useBuildsStore((state) => state.description);

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch (error) {
      console.error('Failed to save active tab to localStorage:', error);
    }
  }, [activeTab]);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  // Load preset metadata on mount
  useEffect(() => {
    const loadPresetMetadata = async () => {
      const options = await Promise.all(
        Object.keys(presetModules).map(async (path) => {
          try {
            const loader = presetModules[path];
            const module = await loader();
            const payload = module?.default ?? (module as unknown as BuildPayload);

            // Use author and description if available, otherwise fallback to filename
            if (payload.author && payload.description) {
              return {
                path,
                label: `[${payload.author}] ${payload.description}`,
                author: payload.author,
                description: payload.description
              };
            } else {
              const fileName = path.split('/').pop() || path;
              const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
              return { path, label: label.trim() || fileName };
            }
          } catch (error) {
            console.error(`Failed to load preset metadata for ${path}:`, error);
            const fileName = path.split('/').pop() || path;
            const label = fileName.replace(/\.json$/i, '').replace(/[-_]+/g, ' ');
            return { path, label: label.trim() || fileName };
          }
        })
      );

      setPresetOptions(options.sort((a, b) => a.label.localeCompare(b.label)));
    };

    loadPresetMetadata();
  }, []);

  const loadPresetPayload = useCallback(async (path: string) => {
    const loader = presetModules[path];
    if (!loader) {
      throw new Error(`Preset not found for path: ${path}`);
    }

    const module = await loader();
    return module?.default ?? (module as unknown as BuildPayload);
  }, []);

  const handleExport = (author: string, description: string) => {
    // Read data directly from store at export time (not as a subscription)
    const state = useBuildsStore.getState();
    const { characterToBuildIds, builds, hiddenCharacters, computeOptions } = state;

    // Convert store format to export format
    const exportData: BuildGroup[] = [];

    Object.entries(characterToBuildIds).forEach(([characterId, buildIds]) => {
      const characterBuilds = buildIds
        .map(id => builds[id])
        .filter((b): b is Build => b !== undefined);

      if (characterBuilds.length > 0) {
        exportData.push({
          characterId,
          builds: characterBuilds,
          hidden: !!hiddenCharacters?.[characterId]
        });
      }
    });

    const dataStr = serializeBuildExportPayload(exportData, computeOptions, author, description);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `[${author}] ${description}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Save metadata to store
    state.setMetadata(author, description);
  };

  const getTitle = () => {
    return t.ui('app.artifactFilterTitle');
  };

  const handlePrintConfigs = () => {
    // Get current builds from store
    const state = useBuildsStore.getState();
    const { characterToBuildIds, builds, hiddenCharacters, computeOptions } = state;

    // Convert to the format expected by computeArtifactFilters
    const characterBuilds = Object.entries(characterToBuildIds)
      .filter(([characterId]) => !hiddenCharacters[characterId])
      .map(([characterId, buildIds]) => ({
        characterId,
        builds: buildIds
          .map(id => builds[id])
          .filter((b): b is Build => b !== undefined && b.visible)
      }));

    // Convert to BuildGroup format for the appendix
    const buildGroups: BuildGroup[] = Object.entries(characterToBuildIds).map(([characterId, buildIds]) => ({
      characterId,
      builds: buildIds
        .map(id => builds[id])
        .filter((b): b is Build => b !== undefined),
      hidden: !!hiddenCharacters?.[characterId]
    }));

    // Compute artifact filters
    const artifactFilters = computeArtifactFilters(characterBuilds, computeOptions);

    // Generate markdown
    const markdown = generateAllArtifactsMarkdown(artifactFilters, buildGroups, { t, language });

    // Download
    const timestamp = new Date().toISOString().split('T')[0];
    downloadMarkdown(markdown, `artifact-configs-${timestamp}.md`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-screen bg-gradient-mystical text-foreground flex flex-col overflow-hidden">
        <ToolHeader
          title={getTitle()}
          actions={
            <>
              {activeTab === 'filters' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintConfigs}
                  className="gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  {t.ui('app.print')}
                </Button>
              ) : (
                <>
                  <ClearAllControl
                    onConfirm={clearAllBuilds}
                  />

                  <ImportControl
                    options={presetOptions}
                    loadPreset={loadPresetPayload}
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

        <div className="border-b border-border/50 bg-card/20 backdrop-blur-sm z-40">
          <div className="container mx-auto px-4 pt-2 pb-2">
            {/* Tab Bar */}
            <div className="flex justify-center">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 bg-card/30 border border-border/30 h-10">
                  <TabsTrigger
                    value="configure"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-golden"
                  >
                    {t.ui('navigation.configure')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="filters"
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-golden"
                  >
                    {t.ui('navigation.computeFilters')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Main Content Area - Takes remaining height */}
        <main className="flex-1 overflow-hidden">
          <div className="container mx-auto px-4 h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsContent value="configure" className="mt-0 h-full data-[state=inactive]:hidden">
                <ConfigureView ref={configureViewRef} />
              </TabsContent>

              <TabsContent value="filters" className="mt-0 h-full data-[state=inactive]:hidden">
                <ComputeView
                  onJumpToCharacter={(characterId) => {
                    setActiveTab('configure');
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
    </TooltipProvider>
  );
};

export default Index;
