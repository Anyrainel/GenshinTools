import { useState, useMemo, useEffect } from "react";
import { useAccountStore } from "@/stores/useAccountStore";
import { AccountData, PresetOption } from "@/data/types";
import { convertGOODToAccountData } from "@/data/goodConversion";
import { GOODData } from "@/data/goodTypes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { ImportControl } from "@/components/shared/ImportControl";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { THEME } from "@/lib/theme";
import { CharacterFilterSidebar } from "@/components/shared/CharacterFilterSidebar";
import { CharacterFilters } from "@/data/types";
import { charactersById } from "@/data/constants";
import { CharacterCard } from "@/components/account-data/CharacterCard";
import { InventoryView } from "@/components/account-data/InventoryView";
import { loadPresetMetadata, loadPresetPayload } from "@/lib/presetLoader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Filter } from "lucide-react";

type GOODPreset = GOODData & { author?: string; description?: string };

const presetModules = import.meta.glob<{ default: GOODPreset }>(
  "@/presets/account-data/*.json",
  { eager: false },
);

export default function AccountDataPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("characters");
  const { accountData, setAccountData, clearAccountData } = useAccountStore();

  const [presetOptions, setPresetOptions] = useState<PresetOption[]>([]);

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const [filters, setFilters] = useState<CharacterFilters>({
    elements: [],
    weaponTypes: [],
    regions: [],
    rarities: [],
    sortOrder: "desc",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

  // Filter Logic
  const filteredCharacters = useMemo(() => {
    if (!accountData) return [];
    let chars = [...accountData.characters];

    // Filter by Element
    if (filters.elements.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.elements.includes(info.element);
      });
    }

    // Filter by Weapon Type
    if (filters.weaponTypes.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.weaponTypes.includes(info.weaponType);
      });
    }

    // Filter by Region
    if (filters.regions.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.regions.includes(info.region);
      });
    }

    // Filter by Rarity
    if (filters.rarities.length > 0) {
      chars = chars.filter((c) => {
        const info = charactersById[c.key];
        return info && filters.rarities.includes(info.rarity);
      });
    }

    // Sort
    chars.sort((a, b) => {
      const infoA = charactersById[a.key];
      const infoB = charactersById[b.key];
      if (!infoA || !infoB) return 0;

      const dateA = new Date(infoA.releaseDate).getTime();
      const dateB = new Date(infoB.releaseDate).getTime();

      return filters.sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    return chars;
  }, [accountData, filters]);

  const hasActiveFilters =
    filters.elements.length > 0 ||
    filters.weaponTypes.length > 0 ||
    filters.regions.length > 0 ||
    filters.rarities.length > 0;

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
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
                <TabsTrigger
                  value="characters"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.characters")}
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.inventory")}
                </TabsTrigger>
                <TabsTrigger
                  value="evaluation"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {t.ui("accountData.evaluation")}
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
                <div className="flex flex-col md:flex-row h-full gap-4 pt-4">
                  {/* Mobile Filter Trigger */}
                  <div className="md:hidden flex items-center justify-between mb-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsFilterOpen(true)}
                      className="gap-2"
                    >
                      <Filter className="w-4 h-4" />
                      {t.ui("filters.title")}
                      {hasActiveFilters && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                          {
                            [
                              filters.elements,
                              filters.weaponTypes,
                              filters.regions,
                              filters.rarities,
                            ].flat().length
                          }
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Desktop Sidebar */}
                  <div className="w-64 flex-shrink-0 hidden md:block h-full">
                    <CharacterFilterSidebar
                      filters={filters}
                      onFiltersChange={setFilters}
                    />
                  </div>

                  {/* Grid */}
                  <div className="flex-1 h-full overflow-hidden">
                    <div className="h-full overflow-y-auto pr-4">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-10">
                        {filteredCharacters.map((char) => (
                          <div key={char.key}>
                            <CharacterCard char={char} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Filter Sheet */}
                <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <SheetContent side="left" className="w-80 p-0 flex flex-col">
                    <div className="flex-1 overflow-y-auto my-4">
                      <CharacterFilterSidebar
                        filters={filters}
                        onFiltersChange={setFilters}
                        isInSidePanel={false}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </TabsContent>

              <TabsContent
                value="inventory"
                className="h-full overflow-y-auto mt-0 pb-10 pt-4 data-[state=inactive]:hidden"
              >
                <InventoryView data={accountData} />
              </TabsContent>

              <TabsContent
                value="evaluation"
                className="mt-0 pt-4 data-[state=inactive]:hidden"
              >
                <div className="text-center text-muted-foreground mt-10">
                  {t.ui("accountData.buildEvaluationComingSoon")}
                </div>
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
