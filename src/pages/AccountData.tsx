import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import { CharacterView } from "@/components/account-data/CharacterView";
import { InventoryView } from "@/components/account-data/InventoryView";
import { StatWeightView } from "@/components/account-data/StatWeightView";
import { SummaryView } from "@/components/account-data/SummaryView";
import {
  type ActionConfig,
  AppBar,
  type ControlHandle,
  type TabConfig,
} from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import {
  AlertTriangle,
  Box,
  Database,
  LayoutGrid,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

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

const NoDataPlaceholder = ({
  t,
  onAction,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  onAction: () => void;
}) => (
  <div className="flex flex-col items-center pt-24 h-full p-4">
    <div className="flex flex-col items-center text-center space-y-6 max-w-lg">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
          <Database className="w-12 h-12 text-primary opacity-80" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          {t.ui("accountData.noAccountDataLoaded")}
        </h3>
        <p className="text-muted-foreground text-base max-w-md mx-auto">
          {t.ui("accountData.importPrompt")}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <Button
          onClick={onAction}
          size="lg"
          className="w-full gap-2 text-base shadow-lg shadow-primary/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Upload className="w-5 h-5" />
          {t.ui("app.import")}
        </Button>
      </div>
    </div>
  </div>
);

export default function AccountDataPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "characters";

  // Control refs for ref-based dialog pattern
  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);

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

  const handleLocalImport = (data: GOODData) => {
    try {
      const result = convertGOODToAccountData(data);
      setAccountData(result.data);
      showConversionWarnings(result);
      toast.success(t.ui("accountData.importSuccess"));
    } catch (error) {
      console.error("Failed to convert GOOD data", error);
      toast.error(t.ui("accountData.failedToParseFile"));
      throw error; // Re-throw to let AccountImportControl handle UI state
    }
  };

  const handleUidImport = async (uid: string, clearBeforeImport: boolean) => {
    try {
      setLastUid(uid); // Save UID to store
      const rawData = await fetchEnkaData(uid);
      const enkaResult = convertEnkaToGOOD(rawData);
      const result = convertGOODToAccountData(enkaResult.data);
      const newData = result.data;

      // Merge warnings from Enka conversion (missing IDs) and GOOD conversion
      const allWarnings = [...enkaResult.warnings, ...result.warnings];
      showConversionWarnings({ ...result, warnings: allWarnings });

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

  // Tab configuration for AppBar
  const tabs: TabConfig[] = useMemo(
    () => [
      {
        value: "characters",
        label: t.ui("accountData.characters"),
        icon: Users,
      },
      {
        value: "summary",
        label: t.ui("accountData.summary"),
        icon: LayoutGrid,
      },
      { value: "inventory", label: t.ui("accountData.inventory"), icon: Box },
      {
        value: "weights",
        label: t.ui("accountData.statWeights"),
        icon: Settings,
      },
    ],
    [t]
  );

  // Actions configuration
  const actions: ActionConfig[] = useMemo(
    () => [
      {
        key: "import",
        icon: Upload,
        label: t.ui("app.import"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
      },
      {
        key: "clear",
        icon: Trash2,
        label: t.ui("app.clear"),
        onTrigger: () => clearRef.current?.open(),
      },
    ],
    [t]
  );

  return (
    <PageLayout
      actions={actions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Control dialogs - render without triggers, opened via ref */}
      <AccountImportControl
        ref={importRef}
        onLocalImport={handleLocalImport}
        onUidImport={handleUidImport}
        initialUid={lastUid}
      />
      <ClearAllControl ref={clearRef} onConfirm={clearAccountData} />

      {/* Conversion Warnings - visible on all tabs */}
      {conversionWarnings.length > 0 && (
        <div className="container mx-auto px-4 pt-2">
          <Alert variant="destructive" className="relative">
            <AlertTriangle className="h-4 w-4" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={dismissWarnings}
            >
              <X className="h-4 w-4" />
            </Button>
            <AlertTitle>{t.ui("accountData.conversionWarning")}</AlertTitle>
            <AlertDescription className="pr-8">
              <div className="mt-1">
                {conversionWarnings.filter((w) => w.type === "character")
                  .length > 0 && (
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
                {conversionWarnings.filter((w) => w.type === "weapon").length >
                  0 && (
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
        </div>
      )}

      <Tabs value={activeTab} className="h-full overflow-hidden">
        <TabsContent value="characters" className="mt-0 h-full">
          {accountData ? (
            <CharacterView scores={scores} />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
            />
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-0 h-full">
          {accountData ? (
            <SummaryView scores={scores} />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
            />
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-0 h-full">
          {accountData ? (
            <InventoryView data={accountData} />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
            />
          )}
        </TabsContent>

        <TabsContent value="weights" className="mt-0 h-full">
          <StatWeightView />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
