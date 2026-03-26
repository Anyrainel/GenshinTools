import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import {
  CharacterView,
  type CharacterViewHandle,
} from "@/components/account-data/CharacterView";
import { EvaluationView } from "@/components/account-data/EvaluationView";
import { InventoryView } from "@/components/account-data/InventoryView";
import { RecommendationView } from "@/components/account-data/RecommendationView";
import { ScoreChangeAnnouncement } from "@/components/account-data/ScoreChangeAnnouncement";
import { TriageView } from "@/components/account-data/TriageView";

import { AccountManagerDialog } from "@/components/account-data/AccountManagerDialog";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import {
  type ActionConfig,
  AppBar,
  type ControlHandle,
} from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, Build } from "@/data/types";
import { useAllResolvedBuilds } from "@/hooks/useResolvedBuilds";
import {
  type ArtifactScoreResult,
  scoreWithBuilds,
} from "@/lib/account-data/artifactScore";
import {
  deleteInventoryArtifact,
  deleteInventoryWeapon,
} from "@/lib/account-data/characterEditor";
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
import {
  type PendingImport,
  routeLocalImport,
  routeResolveImport,
  routeUidImport,
} from "@/lib/account-data/importRouting";
import { mergeAccountData } from "@/lib/account-data/mergeAccountData";
import { mergeMonaWithExisting } from "@/lib/account-data/monaConversion";
import { getCachedPreset } from "@/lib/artifact-builds/buildPresetRegistry";
import { isTourCompleted, markTourCompleted } from "@/lib/tourConfig";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import {
  AlertTriangle,
  Database,
  Download,
  FileDown,
  FileJson,
  Globe,
  HelpCircle,
  Pencil,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const NoDataPlaceholder = ({
  t,
  onAction,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  onAction: () => void;
}) => (
  <div className="flex flex-col items-center pt-16 md:pt-24 h-full p-4">
    <div className="flex flex-col items-center text-center space-y-6 max-w-lg">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl" />
        <div className="relative bg-background p-4 rounded-full border border-border shadow-sm">
          <Database className="w-12 h-12 text-primary opacity-80" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          {t.ui("accountData.noData")}
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
          <Download className="w-5 h-5" />
          {t.ui("import.action")}
        </Button>
      </div>

      {/* Import method hints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md pt-2">
        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 text-left">
          <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {t.ui("accountData.enkaTitle")}
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.ui("accountData.enkaDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 text-left">
          <div className="rounded-md bg-primary/10 p-1.5 mt-0.5 shrink-0">
            <FileJson className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-sm font-medium text-foreground">
              {t.ui("accountData.goodTitle")}
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.ui("accountData.goodDesc")}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-sm">
        {t.ui("accountData.afterImportHint")}
      </p>
    </div>
  </div>
);

export default function AccountDataPage() {
  const { t } = useLanguage();
  const tour = useTour();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "characters";
  const [isEditMode, setIsEditMode] = useState(false);

  // Control refs for ref-based dialog pattern
  const importRef = useRef<ControlHandle>(null);
  const characterViewRef = useRef<CharacterViewHandle>(null);

  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const clearAccounts = useAccountStore((s) => s.clearAccounts);
  const addOrUpdateAccount = useAccountStore((s) => s.addOrUpdateAccount);
  const setActiveAccount = useAccountStore((s) => s.setActiveAccount);
  const promoteToUid = useAccountStore((s) => s.promoteToUid);
  const mergeScores = useAccountStore((s) => s.mergeScores);
  const staleScoreCharIds = useAccountStore((s) => s.staleScoreCharIds);
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const scores = activeAccount?.scores || {};
  // id IS the uid for non-default profiles
  const lastUid =
    activeAccount && activeAccount.id !== "default" ? activeAccount.id : "";

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
  const scoreConfig = useArtifactScoreStore((s) => s.config);
  const buildsMap = useBuildsStore((s) => s.builds);
  const characterToBuildIds = useBuildsStore((s) => s.characterToBuildIds);

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

  // Determine which characters need rescoring: stale, missing, or null with builds now available.
  const charsToScore = useMemo(() => {
    if (!accountData || accountData.characters.length === 0) return [];

    return accountData.characters.filter((c) => {
      // Explicitly marked stale (per-character or global)
      if (
        staleScoreCharIds === true ||
        (staleScoreCharIds.length > 0 && staleScoreCharIds.includes(c.key))
      )
        return true;
      // Missing score
      if (!(c.key in scores)) return true;
      // Null score with builds now available (async preset loaded)
      if (scores[c.key] === null && (resolvedBuildsMap[c.key]?.length ?? 0) > 0)
        return true;
      return false;
    });
  }, [accountData, staleScoreCharIds, scores, resolvedBuildsMap]);

  useEffect(() => {
    if (charsToScore.length === 0) return;

    // Short delay to let dependencies (e.g. preset loading) stabilize
    const timer = setTimeout(() => {
      const results: Record<string, ArtifactScoreResult | null> = {};
      for (const char of charsToScore) {
        const builds = resolvedBuildsMap[char.key] ?? [];
        results[char.key] = scoreWithBuilds(char, builds, scoreConfig.global);
      }
      mergeScores(results);
    }, 50);
    return () => clearTimeout(timer);
  }, [charsToScore, scoreConfig, mergeScores, resolvedBuildsMap]);

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

    const message = `${t.ui("accountData.conversionWarning")}: ${parts.join(", ")} ${t.ui("accountData.conversionSkipped")}`;
    toast.warning(message, { duration: 6000 });
  };

  const dismissWarnings = () => {
    setConversionWarnings([]);
  };

  const handleLocalImport = (data: GOODData, optionalUid: string) => {
    try {
      const result = convertGOODToAccountData(data);
      // Read fresh state to avoid stale closure
      const currentAccounts = useAccountStore.getState().accounts;
      const routing = routeLocalImport(
        currentAccounts,
        result.data,
        optionalUid,
        t.ui("accountData.defaultAccount")
      );

      if (routing.kind === "direct") {
        addOrUpdateAccount(routing.id, {
          data: routing.data,
          name: routing.name,
        });
        setActiveAccount(routing.activeId);
        toast.success(t.ui("accountData.importSuccess"));
      } else {
        setPendingImport(routing.pendingImport);
        setIsAccountManagerOpen(true);
      }

      showConversionWarnings(result);
    } catch (error) {
      console.error("Failed to convert GOOD data", error);
      toast.error(t.ui("accountData.failedToParseFile"));
      throw error;
    }
  };

  const handleUidImport = async (uid: string, clearBeforeImport: boolean) => {
    try {
      const rawData = await fetchEnkaData(uid);
      const enkaResult = await convertEnkaToGOOD(rawData);
      const result = convertGOODToAccountData(enkaResult.data);
      const nickname = rawData.playerInfo?.nickname || "";

      const allWarnings = [...enkaResult.warnings, ...result.warnings];
      showConversionWarnings({ ...result, warnings: allWarnings });

      // Read fresh state to avoid stale closure
      const currentAccounts = useAccountStore.getState().accounts;
      const routing = routeUidImport(
        currentAccounts,
        uid,
        result.data,
        nickname,
        clearBeforeImport,
        mergeAccountData
      );

      if (routing.kind === "direct") {
        addOrUpdateAccount(routing.id, {
          data: routing.data,
          name: routing.name,
        });
        setActiveAccount(routing.activeId);
        toast.success(t.ui("accountData.importSuccess"));
      } else {
        setPendingImport(routing.pendingImport);
        setIsAccountManagerOpen(true);
      }
    } catch (error: unknown) {
      console.error("UID Import failed", error);
      const message =
        error instanceof Error ? error.message : t.ui("import.fileLoadError");
      toast.error(message);
      throw error;
    }
  };

  const handleResolveImport = (
    action: "overwrite" | "merge" | "create",
    targetId: string,
    renamedName?: string
  ) => {
    if (!pendingImport) return;

    // Read fresh state to avoid stale closure
    const currentAccounts = useAccountStore.getState().accounts;

    // For Mona imports targeting an existing profile, pre-merge to preserve
    // character/weapon details regardless of overwrite vs merge action.
    let effectivePending = pendingImport;
    if (pendingImport.type === "mona" && action !== "create") {
      const existingData = currentAccounts[targetId]?.data;
      if (existingData) {
        effectivePending = {
          ...pendingImport,
          data: mergeMonaWithExisting(existingData, pendingImport.data),
        };
      }
    }

    const result = routeResolveImport(
      currentAccounts,
      effectivePending,
      // For Mona, data is already pre-merged, so use "overwrite" to avoid double-merging
      pendingImport.type === "mona" && action === "merge"
        ? "overwrite"
        : action,
      targetId,
      renamedName,
      mergeAccountData
    );

    if (result.kind === "account_not_found") {
      // Account was deleted while the dialog was open
      toast.error(t.ui("common.error"));
      setPendingImport(null);
      setIsAccountManagerOpen(false);
      return;
    }

    addOrUpdateAccount(result.id, {
      data: result.data,
      ...(result.name ? { name: result.name } : {}),
    });
    if (result.promoteToId) {
      promoteToUid(result.id, result.promoteToId);
    }
    setActiveAccount(result.activeId);

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
        icon: Download,
        label: t.ui("import.action"),
        onTrigger: () => importRef.current?.open(),
        tourStepId: "ad-import",
      },
      ...(activeTab === "characters"
        ? [
            {
              key: "print",
              icon: FileDown,
              label: t.ui("app.print"),
              onTrigger: () => characterViewRef.current?.downloadImage(),
            },
          ]
        : []),
      ...(activeTab === "characters" || activeTab === "inventory"
        ? [
            {
              key: "edit",
              icon: Pencil,
              label: isEditMode
                ? t.ui("common.cancel")
                : t.ui("charEdit.editMode"),
              onTrigger: () => setIsEditMode((prev) => !prev),
            },
          ]
        : []),
      {
        key: "help",
        icon: HelpCircle,
        label: t.ui("buttons.help"),
        onTrigger: () => tour.start("account-data"),
      },
    ];

    return defaultActions;
  }, [t, tour, activeTab, isEditMode]);

  return (
    <PageLayout
      actions={actions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClearData={() => {
        clearAccounts();
      }}
      clearLabel={t.ui("common.clearAccountData")}
    >
      <BuildsDefaultPresetPrompt />
      <ScoreChangeAnnouncement />

      {/* Control dialogs - render without triggers, opened via ref */}
      <AccountImportControl
        ref={importRef}
        onLocalImport={handleLocalImport}
        onUidImport={handleUidImport}
        initialUid={lastUid}
      />
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
                <AlertTitle>{t.ui("accountData.conversionWarning")}</AlertTitle>
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
            <CharacterView
              ref={characterViewRef}
              scores={scores}
              isEditMode={isEditMode}
            />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
            />
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-0 h-full">
          {accountData ? (
            <InventoryView
              data={accountData}
              isEditMode={isEditMode}
              onDeleteWeapon={(weaponId) => {
                if (!activeAccountId) return;
                const newData = deleteInventoryWeapon(accountData, weaponId);
                addOrUpdateAccount(activeAccountId, { data: newData });
              }}
              onDeleteArtifact={(artifactId) => {
                if (!activeAccountId) return;
                const newData = deleteInventoryArtifact(
                  accountData,
                  artifactId
                );
                addOrUpdateAccount(activeAccountId, { data: newData });
              }}
            />
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

        <TabsContent value="triage" className="mt-0 h-full">
          {accountData ? (
            <TriageView />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
            />
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
