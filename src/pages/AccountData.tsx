import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import { CharacterView } from "@/components/account-data/CharacterView";
import { EvaluationView } from "@/components/account-data/EvaluationView";
import { InventoryView } from "@/components/account-data/InventoryView";
import { RecommendationView } from "@/components/account-data/RecommendationView";

import {
  AccountManagerDialog,
  type PendingImport,
} from "@/components/account-data/AccountManagerDialog";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import {
  type ActionConfig,
  AppBar,
  type ControlHandle,
} from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import type {
  AccountData,
  ArtifactData,
  Build,
  WeaponData,
} from "@/data/types";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type ArtifactScoreResult,
  scoreWithBuilds,
} from "@/lib/account-data/artifactScore";
import {
  convertEnkaToGOOD,
  fetchEnkaData,
} from "@/lib/account-data/enkaFetcher";
import {
  type ConversionResult,
  type GOODData,
  convertGOODToAccountData,
} from "@/lib/account-data/goodConversion";
import type { ConversionWarning } from "@/lib/account-data/goodConversion";
import { mergeEnkaImportWithInventory } from "@/lib/account-data/mergeEnkaImport";
import { getCachedPreset } from "@/lib/artifact-builds/buildPresetRegistry";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { useAccountStore } from "@/stores/useAccountStore";
import { getActiveAccount } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useOwnershipStore } from "@/stores/useOwnershipStore";
import {
  AlertTriangle,
  Database,
  HelpCircle,
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
          {t.ui("import.action")}
        </Button>
      </div>
    </div>
  </div>
);

function mergeAccountData(
  oldData: AccountData,
  newData: AccountData
): AccountData {
  const { maxA, maxW } = getMaxIds(oldData);
  reassignIds(newData, maxA + 1, maxW + 1);

  const mergedCharacters = [...oldData.characters];
  for (const newChar of newData.characters) {
    const index = mergedCharacters.findIndex((c) => c.key === newChar.key);
    if (index >= 0) {
      mergedCharacters[index] = newChar; // Overwrite
    } else {
      mergedCharacters.push(newChar); // Add
    }
  }

  const mergedExtraArtifacts = mergeEnkaImportWithInventory(oldData, newData);
  const mergedData: AccountData = {
    characters: mergedCharacters,
    extraArtifacts: mergedExtraArtifacts,
    extraWeapons: oldData.extraWeapons,
  };
  reassignIds(mergedData, 0, 0);
  return mergedData;
}

export default function AccountDataPage() {
  const { t } = useLanguage();
  const tour = useTour();
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

  const {
    accounts,
    activeAccountId,
    clearAccounts,
    addOrUpdateAccount,
    setActiveAccount,
    setScores,
    isScoresStale,
  } = useAccountStore();
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const scores = activeAccount?.scores || {};
  const lastUid = activeAccount?.uid || "";

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null
  );
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  // Start tour on first visit (after a short delay for page to render)
  useEffect(() => {
    if (!isTourCompleted("account-data") && activeTab === "characters") {
      const timer = setTimeout(() => {
        tour.start("account-data");
        markTourCompleted("account-data");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [tour, activeTab]);
  const { config: scoreConfig } = useArtifactScoreStore();
  const buildsMap = useBuildsStore((s) => s.builds);
  const characterToBuildIds = useBuildsStore((s) => s.characterToBuildIds);

  // When scores are stale (e.g. weights changed) OR missing (migration), recalculate them asynchronously
  // to avoid blocking the UI thread during interaction or navigation.

  // Use the hook to get all resolved builds efficiently
  const buildGroups = useAllResolvedBuilds();

  // Convert array of groups to a map for quick lookup during scoring
  const resolvedBuildsMap = useMemo(() => {
    const map: Record<string, Build[]> = {};
    for (const group of buildGroups) {
      if (group.builds.length > 0) {
        map[group.characterId] = group.builds;
      }
    }
    return map;
  }, [buildGroups]);

  useEffect(() => {
    if (accountData && accountData.characters.length > 0) {
      const timer = setTimeout(() => {
        const results: Record<string, ArtifactScoreResult> = {};
        for (const char of accountData.characters) {
          const builds = resolvedBuildsMap[char.key] ?? [];
          results[char.key] = scoreWithBuilds(char, builds, scoreConfig.global);
        }
        setScores(results);
      }, 50); // Short delay to yield to main thread (click/nav animations)
      return () => clearTimeout(timer);
    }
  }, [accountData, scoreConfig, setScores, resolvedBuildsMap]);

  useEffect(() => {
    // Detect old data format (missing extraWeapons or missing talents) and clear it
    if (accountData) {
      const isOldFormat =
        !accountData.extraWeapons ||
        accountData.characters.some((c) => !c.talent);
      if (isOldFormat && activeAccountId) {
        clearAccounts();
      }
    }
  }, [accountData, activeAccountId, clearAccounts]);

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

  const handleLocalImport = (data: GOODData, optionalUid: string) => {
    try {
      const result = convertGOODToAccountData(data);
      const newData = result.data;

      if (optionalUid) {
        // UID provided: always overwrite that UID profile directly, no dialog
        addOrUpdateAccount(optionalUid, {
          data: newData,
          uid: optionalUid,
          name: accounts[optionalUid]?.name || optionalUid,
        });
        setActiveAccount(optionalUid);
        toast.success(t.ui("accountData.importSuccess"));
      } else if (Object.keys(accounts).length === 0) {
        // First-ever import, no UID → create "default" (store auto-activates it)
        addOrUpdateAccount("default", {
          data: newData,
          name: t.ui("accountData.defaultAccount"),
          uid: "",
        });
        toast.success(t.ui("accountData.importSuccess"));
      } else {
        // Existing profiles + no UID → let user pick via dialog
        setPendingImport({
          type: "json",
          uid: "",
          data: newData,
          nickname: "",
        });
        setIsAccountManagerOpen(true);
      }

      showConversionWarnings(result);
    } catch (error) {
      console.error("Failed to convert GOOD data", error);
      toast.error(t.ui("accountData.failedToParseFile"));
      throw error; // Re-throw to let AccountImportControl handle UI state
    }
  };

  const handleUidImport = async (uid: string, clearBeforeImport: boolean) => {
    try {
      const rawData = await fetchEnkaData(uid);
      const enkaResult = await convertEnkaToGOOD(rawData);
      const result = convertGOODToAccountData(enkaResult.data);
      const newData = result.data;
      const nickname = rawData.playerInfo?.nickname || "";

      // Merge warnings from Enka conversion (missing IDs) and GOOD conversion
      const allWarnings = [...enkaResult.warnings, ...result.warnings];
      showConversionWarnings({ ...result, warnings: allWarnings });

      // Match by id first, then by uid field (covers manually-linked "default" profiles)
      const matchById = accounts[uid];
      const matchByUidField = !matchById
        ? Object.values(accounts).find((acc) => acc.uid === uid)
        : null;
      const existingAccount = matchById ?? matchByUidField ?? null;
      const existingAccountId = matchById ? uid : (matchByUidField?.id ?? uid);

      if (existingAccount) {
        // Profile found → import directly (merge or overwrite)
        const profileData = clearBeforeImport
          ? newData
          : mergeAccountData({ ...existingAccount.data }, newData);
        addOrUpdateAccount(existingAccountId, {
          data: profileData,
          // Always update name from Enka when a nickname is available
          name:
            nickname ||
            existingAccount.name ||
            `${t.ui("accountData.account")} ${uid}`,
          uid,
        });
        setActiveAccount(existingAccountId);
        toast.success(t.ui("accountData.importSuccess"));
      } else if (accounts.default) {
        // No profile with this UID → ask user: update default or create new
        setPendingImport({
          type: "uid",
          uid,
          data: newData,
          nickname,
          clearBeforeImport,
        });
        setIsAccountManagerOpen(true);
      } else {
        // No matching profile, no default → create UID profile directly
        addOrUpdateAccount(uid, {
          data: newData,
          name: nickname || `${t.ui("accountData.account")} ${uid}`,
          uid,
        });
        setActiveAccount(uid);
        toast.success(t.ui("accountData.importSuccess"));
      }
    } catch (error: unknown) {
      console.error("UID Import failed", error);
      const message =
        error instanceof Error ? error.message : t.ui("import.fileLoadError");
      toast.error(message);
      throw error; // Re-throw to let ImportControl handle UI state
    }
  };

  const handleResolveImport = (
    action: "overwrite" | "merge" | "create",
    targetId: string,
    renamedName?: string,
    assignUid?: string
  ) => {
    if (!pendingImport) return;

    const { data: newData, uid, nickname } = pendingImport;

    if (action === "create") {
      addOrUpdateAccount(targetId, {
        data: newData,
        name:
          renamedName ||
          nickname ||
          `${t.ui("accountData.account")} ${targetId}`,
        uid: assignUid || uid || targetId,
      });
    } else {
      // Overwrite or Merge
      const existingAccount = accounts[targetId];
      if (!existingAccount) return;

      let finalData = newData;
      if (action === "merge") {
        finalData = mergeAccountData({ ...existingAccount.data }, newData);
      }

      const updates: Partial<(typeof accounts)[string]> & {
        data: AccountData;
      } = { data: finalData };
      if (renamedName) updates.name = renamedName;
      if (assignUid) updates.uid = assignUid;

      addOrUpdateAccount(targetId, updates);
    }

    setActiveAccount(targetId);
    toast.success(t.ui("accountData.importSuccess"));
    setPendingImport(null);
    setIsAccountManagerOpen(false);
  };

  // Tab configuration for AppBar
  const tabs = useMemo(() => getTabsForRoute(t, "/account-data"), [t]);

  // Actions configuration
  const actions: ActionConfig[] = useMemo(() => {
    const defaultActions: ActionConfig[] = [
      {
        key: "accounts",
        icon: Users,
        label: t.ui("accountData.accounts"),
        onTrigger: () => setIsAccountManagerOpen(true),
        alwaysShow: true,
      },
      {
        key: "import",
        icon: Upload,
        label: t.ui("import.action"),
        onTrigger: () => importRef.current?.open(),
        alwaysShow: true,
        tourStepId: "ad-import",
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
        onTrigger: () => tour.start("account-data"),
      },
    ];

    return defaultActions;
  }, [t, tour]);

  return (
    <PageErrorBoundary onClearData={clearAccounts}>
      <PageLayout
        actions={actions}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <BuildsDefaultPresetPrompt />

        {/* Control dialogs - render without triggers, opened via ref */}
        <AccountImportControl
          ref={importRef}
          onLocalImport={handleLocalImport}
          onUidImport={handleUidImport}
          initialUid={lastUid}
        />
        <ClearAllControl ref={clearRef} onConfirm={clearAccounts} />

        <AccountManagerDialog
          isOpen={isAccountManagerOpen}
          onClose={() => {
            setIsAccountManagerOpen(false);
            setPendingImport(null);
          }}
          pendingImport={pendingImport}
          onResolveImport={handleResolveImport}
          onOpenImportControl={() => importRef.current?.open()}
        />

        {/* Conversion Warnings - visible on all tabs */}
        {conversionWarnings.length > 0 && (
          <div className="container mx-auto px-4 pt-2">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <AlertTitle>
                    {t.ui("accountData.conversionWarning")}
                  </AlertTitle>
                  <AlertDescription>
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
                      {conversionWarnings.filter((w) => w.type === "weapon")
                        .length > 0 && (
                        <div>
                          <span className="font-medium">
                            {t.ui("teamComp.weapon")}:
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
                            {t.ui("teamComp.artifact")}:
                          </span>{" "}
                          {conversionWarnings
                            .filter((w) => w.type === "artifact")
                            .map((w) => w.key)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 -mt-0.5 -mr-1 hover:bg-destructive/20"
                  onClick={dismissWarnings}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
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

          <TabsContent value="recommendations" className="mt-0 h-full">
            {accountData ? (
              <RecommendationView scores={scores} />
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

          <TabsContent value="evaluation" className="mt-0 h-full">
            {accountData ? (
              <EvaluationView />
            ) : (
              <NoDataPlaceholder
                t={t}
                onAction={() => importRef.current?.open()}
              />
            )}
          </TabsContent>
        </Tabs>
      </PageLayout>
    </PageErrorBoundary>
  );
}
