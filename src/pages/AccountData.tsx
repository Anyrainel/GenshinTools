import { CharacterView } from "@/components/account-data/CharacterView";
import { InventoryView } from "@/components/account-data/InventoryView";
import { StatWeightView } from "@/components/account-data/StatWeightView";
import { SummaryView } from "@/components/account-data/SummaryView";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { ToolHeader } from "@/components/shared/ToolHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, ArtifactData, WeaponData } from "@/data/types";
import {
  type ArtifactScoreResult,
  calculateArtifactScore,
} from "@/lib/artifactScore";
import { convertEnkaToGOOD, fetchEnkaData } from "@/lib/enka";
import {
  type ConversionResult,
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/goodConversion";
import type { ConversionWarning } from "@/lib/goodConversion";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

type GOODPreset = GOODData & { author?: string; description?: string };

const getMaxIds = (data: AccountData) => {
  let maxA = -1;
  let maxW = -1;
  const parse = (id: string, prefix: string) => {
    const num = Number.parseInt(id.replace(prefix, ""), 10);
    return Number.isNaN(num) ? -1 : num;
  };

  const checkA = (art: ArtifactData) => {
    const val = parse(art.id, "artifact-");
    if (val > maxA) maxA = val;
  };
  const checkW = (wp: WeaponData) => {
    const val = parse(wp.id, "weapon-");
    if (val > maxW) maxW = val;
  };

  for (const c of data.characters) {
    for (const a of Object.values(c.artifacts)) {
      if (a) checkA(a);
    }
    if (c.weapon) checkW(c.weapon);
  }
  for (const art of data.extraArtifacts) {
    checkA(art);
  }
  for (const wp of data.extraWeapons) {
    checkW(wp);
  }

  return { maxA, maxW };
};

const reassignIds = (
  data: AccountData,
  startArtifactId: number,
  startWeaponId: number
) => {
  let aId = startArtifactId;
  let wId = startWeaponId;

  for (const char of data.characters) {
    // Artifacts
    for (const slot of Object.keys(char.artifacts) as Array<
      keyof typeof char.artifacts
    >) {
      const art = char.artifacts[slot];
      if (art) art.id = `artifact-${aId++}`;
    }
    // Weapon
    if (char.weapon) {
      char.weapon.id = `weapon-${wId++}`;
    }
  }
  // Extras
  for (const art of data.extraArtifacts) {
    art.id = `artifact-${aId++}`;
  }
  for (const wp of data.extraWeapons) {
    wp.id = `weapon-${wId++}`;
  }
};

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

  const { accountData, setAccountData, clearAccountData, lastUid, setLastUid } =
    useAccountStore();
  const { config: scoreConfig } = useArtifactScoreStore();

  const scores = useMemo(() => {
    const results: Record<string, ArtifactScoreResult> = {};
    if (!accountData) return results;

    for (const char of accountData.characters) {
      results[char.key] = calculateArtifactScore(char, scoreConfig);
    }

    return results;
  }, [accountData, scoreConfig]);

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

  const [conversionWarnings, setConversionWarnings] = useState<
    ConversionWarning[]
  >([]);

  const showConversionWarnings = (result: ConversionResult) => {
    if (result.warnings.length === 0) {
      setConversionWarnings([]);
      return;
    }

    // Store warnings for the alert block
    setConversionWarnings(result.warnings);

    const charCount = result.warnings.filter(
      (w) => w.type === "character"
    ).length;
    const weaponCount = result.warnings.filter(
      (w) => w.type === "weapon"
    ).length;
    const artifactCount = result.warnings.filter(
      (w) => w.type === "artifact"
    ).length;

    const parts: string[] = [];
    if (charCount > 0) parts.push(`${charCount} character(s)`);
    if (weaponCount > 0) parts.push(`${weaponCount} weapon(s)`);
    if (artifactCount > 0) parts.push(`${artifactCount} artifact set(s)`);

    const message = `${t.ui("accountData.conversionWarning")}: ${parts.join(", ")} ${t.ui("accountData.conversionWarningSkipped")}`;
    toast.warning(message, { duration: 6000 });
  };

  const dismissWarnings = () => {
    setConversionWarnings([]);
  };

  const onImportApply = (data: GOODPreset) => {
    const result = convertGOODToAccountData(data);
    setAccountData(result.data);
    showConversionWarnings(result);
  };

  const handleLocalImport = (data: unknown) => {
    try {
      const result = convertGOODToAccountData(data as GOODData);
      setAccountData(result.data);
      showConversionWarnings(result);
      toast.success(t.ui("accountData.importSuccess"));
    } catch (error) {
      console.error("Failed to convert GOOD data", error);
      toast.error(t.ui("accountData.failedToParseFile"));
      throw error; // Re-throw to let ImportControl handle UI state
    }
  };

  const handleUidImport = async (uid: string, clearBeforeImport: boolean) => {
    try {
      setLastUid(uid); // Save UID to store
      const rawData = await fetchEnkaData(uid);
      const goodData = convertEnkaToGOOD(rawData);
      const result = convertGOODToAccountData(goodData);
      const newData = result.data;
      showConversionWarnings(result);

      if (clearBeforeImport || !accountData) {
        setAccountData(newData);
      } else {
        // Merge logic
        const { maxA, maxW } = getMaxIds(accountData);
        reassignIds(newData, maxA + 1, maxW + 1);

        const mergedCharacters = [...accountData.characters];

        for (const newChar of newData.characters) {
          const index = mergedCharacters.findIndex(
            (c) => c.key === newChar.key
          );
          if (index >= 0) {
            mergedCharacters[index] = newChar; // Overwrite
          } else {
            mergedCharacters.push(newChar); // Add
          }
        }

        // Keep existing extras, assume Enka import has no extras
        const mergedData: AccountData = {
          characters: mergedCharacters,
          extraArtifacts: accountData.extraArtifacts,
          extraWeapons: accountData.extraWeapons,
        };

        setAccountData(mergedData);
      }
      toast.success(t.ui("accountData.importSuccess"));
    } catch (error: unknown) {
      console.error("UID Import failed", error);
      const message =
        error instanceof Error
          ? error.message
          : t.ui("configure.importDialogLoadError");
      toast.error(message);
      throw error; // Re-throw to let ImportControl handle UI state
    }
  };

  return (
    <div className={THEME.layout.pageContainer}>
      <ToolHeader
        actions={
          <div className="flex gap-2">
            <ClearAllControl onConfirm={clearAccountData} />
            <ImportControl
              options={[]}
              loadPreset={async () => ({}) as GOODPreset} // Dummy
              onApply={onImportApply}
              onLocalImport={handleLocalImport}
              onUidImport={handleUidImport}
              initialUid={lastUid}
              hideEmptyList
              importFromFileText={t.ui("accountData.importGOOD")}
              dialogTitle={t.ui("accountData.importDialogTitle")}
              dialogDescription={
                <div className="flex flex-col gap-4 py-2 text-sm text-muted-foreground">
                  <div>
                    <span className="font-semibold block mb-1 text-foreground">
                      {t.ui("accountData.importHelpGood")}
                    </span>
                    <span>
                      {t.ui("accountData.importHelpGoodDesc")}{" "}
                      <a
                        href="https://konkers.github.io/irminsul/02-quickstart.html"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Irminsul
                      </a>
                      {" / "}
                      <a
                        href="https://github.com/taiwenlee/Inventory_Kamera"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        Inventory Kamera
                      </a>
                      .
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold block mb-1 text-foreground">
                      {t.ui("accountData.importHelpUid")}
                    </span>
                    <span>{t.ui("accountData.importHelpUidDesc")}</span>
                  </div>
                </div>
              }
            />
          </div>
        }
      />

      <div className={cn(THEME.layout.headerBorder, "z-40")}>
        <div className="container mx-auto pt-2 pb-2">
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
        <div className="container mx-auto h-full">
          {accountData ? (
            <Tabs value={activeTab} className="h-full">
              <TabsContent
                value="characters"
                className="h-full mt-0 data-[state=inactive]:hidden"
              >
                {conversionWarnings.length > 0 && (
                  <Alert
                    variant="destructive"
                    className="mx-4 mt-4 mb-2 relative"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={dismissWarnings}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <AlertTitle>
                      {t.ui("accountData.conversionWarning")}
                    </AlertTitle>
                    <AlertDescription className="pr-8">
                      <div className="mt-1">
                        {conversionWarnings.filter(
                          (w) => w.type === "character"
                        ).length > 0 && (
                          <div>
                            <span className="font-medium">
                              {t.ui("accountData.characters")}:
                            </span>{" "}
                            {conversionWarnings
                              .filter((w) => w.type === "character")
                              .map((w) => w.key)
                              .join(", ")}
                          </div>
                        )}
                        {conversionWarnings.filter((w) => w.type === "weapon")
                          .length > 0 && (
                          <div>
                            <span className="font-medium">
                              {t.ui("teamBuilder.weapon")}:
                            </span>{" "}
                            {conversionWarnings
                              .filter((w) => w.type === "weapon")
                              .map((w) => w.key)
                              .join(", ")}
                          </div>
                        )}
                        {conversionWarnings.filter((w) => w.type === "artifact")
                          .length > 0 && (
                          <div>
                            <span className="font-medium">
                              {t.ui("teamBuilder.artifact")}:
                            </span>{" "}
                            {conversionWarnings
                              .filter((w) => w.type === "artifact")
                              .map((w) => w.key)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
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
