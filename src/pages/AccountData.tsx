import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  calculateArtifactScore,
  ArtifactScoreResult,
} from "@/lib/artifactScore";
import { AccountData, PresetOption } from "@/data/types";
import { convertGOODToAccountData, GOODData } from "@/lib/goodConversion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { ImportControl } from "@/components/shared/ImportControl";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { InventoryView } from "@/components/account-data/InventoryView";
import { SummaryView } from "@/components/account-data/SummaryView";
import { CharacterView } from "@/components/account-data/CharacterView";
import { StatWeightView } from "@/components/account-data/StatWeightView";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";

type GOODPreset = GOODData & { author?: string; description?: string };

const presetModules = import.meta.glob<{ default: GOODPreset }>(
  "@/presets/account-data/*.json",
  { eager: false },
);

export default function AccountDataPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "characters";

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

  const { accountData, setAccountData, clearAccountData } = useAccountStore();
  const { config: scoreConfig } = useArtifactScoreStore();

  const scores = useMemo(() => {
    const results: Record<string, ArtifactScoreResult> = {};
    if (!accountData) return results;

    accountData.characters.forEach((char) => {
      results[char.key] = calculateArtifactScore(char, scoreConfig);
    });

    return results;
  }, [accountData, scoreConfig]);

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  useEffect(() => {
    // Detect old data format (missing extraWeapons or missing talents) and clear it
    if (accountData) {
      const isOldFormat =
        !accountData.extraWeapons ||
        accountData.characters.some((c) => !c.talent);
      if (isOldFormat) {
        clearAccountData();
      }
    }
  }, [accountData, clearAccountData]);

  const loadPreset = async (path: string) => {
    const data = await loadPresetPayload<GOODPreset>(presetModules, path);
    return convertGOODToAccountData(data);
  };

  const onImportApply = (data: AccountData) => {
    setAccountData(data);
  };

  const handleLocalImport = (data: unknown) => {
    try {
      const accountData = convertGOODToAccountData(data as GOODData);
      setAccountData(accountData);
    } catch (error) {
      console.error("Failed to convert GOOD data", error);
      alert(t.ui("accountData.failedToParseFile"));
    }
  };

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader
        actions={
          <div className="flex gap-2">
            <ClearAllControl onConfirm={clearAccountData} />
            <ImportControl
              options={presetOptions}
              loadPreset={loadPreset}
              onApply={onImportApply}
              onLocalImport={handleLocalImport}
              importFromFileText={t.ui("accountData.importGOOD")}
            />
          </div>
        }
      />

      <div className={cn(THEME.layout.headerBorder, "z-40")}>
        <div className="container mx-auto px-4 pt-2 pb-2">
          <div className="flex justify-center">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
                <TabsTrigger
                  value="characters"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.characters")}
                </TabsTrigger>
                <TabsTrigger
                  value="summary"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.summary")}
                </TabsTrigger>
                <TabsTrigger
                  value="weights"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.statWeights")}
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.inventory")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 h-full">
          {accountData ? (
            <Tabs value={activeTab} className="h-full">
              <TabsContent
                value="characters"
                className="h-full mt-0 data-[state=inactive]:hidden"
              >
                <CharacterView scores={scores} />
              </TabsContent>

              <TabsContent
                value="summary"
                className="mt-0 pt-4 data-[state=inactive]:hidden h-full overflow-y-auto"
              >
                <SummaryView scores={scores} />
              </TabsContent>

              <TabsContent
                value="weights"
                className="mt-0 pt-4 data-[state=inactive]:hidden h-full overflow-y-auto"
              >
                <StatWeightView />
              </TabsContent>

              <TabsContent
                value="inventory"
                className="h-full overflow-y-auto mt-0 pb-10 pt-4 data-[state=inactive]:hidden"
              >
                <InventoryView data={accountData} />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <p>{t.ui("accountData.noAccountDataLoaded")}</p>
              <p className="text-sm">
                {t.ui("accountData.importGOODInstruction")}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
