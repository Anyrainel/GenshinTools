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
import { toast } from "sonner";
import { AccountImportControl } from "@/components/account-data/AccountImportControl";
import { AccountManagerDialog } from "@/components/account-data/AccountManagerDialog";
import { ScoreChangeAnnouncement } from "@/components/account-data/ScoreChangeAnnouncement";
import { BuildsDefaultPresetPrompt } from "@/components/artifact-builds/BuildsDefaultPresetPrompt";
import type { ActionConfig } from "@/components/layout/AppBar";
import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageLayout } from "@/components/layout/PageLayout";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { EmptyState } from "@/components/shared/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useTour } from "@/components/ui/tour";
import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveAccount } from "@/hooks/useActiveAccount";
import { useArtifactScoreComputation } from "@/hooks/useArtifactScoreComputation";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import {
  DEFAULT_ACCOUNT_PROFILE_ID,
  isDefaultAccountProfile,
  uidToAccountProfileId,
} from "@/lib/account-data/accountProfile";
import {
  deleteInventoryArtifact,
  deleteInventoryWeapon,
} from "@/lib/account-data/characterEditor";
import {
  convertEnkaToGOOD,
  fetchEnkaData,
} from "@/lib/account-data/import/enkaFetcher";
import type { ConversionWarning } from "@/lib/account-data/import/goodConversion";
import {
  type ConversionResult,
  convertGOODToAccountData,
  type GOODData,
} from "@/lib/account-data/import/goodConversion";
import {
  convertHoyolabToGOOD,
  fetchHoyolabData,
} from "@/lib/account-data/import/hoyolabFetcher";
import {
  type PendingImport,
  routeLocalImport,
  routeResolveImport,
  routeUidImport,
} from "@/lib/account-data/import/importRouting";
import {
  mergeAccountData,
  mergePartialAccountData,
} from "@/lib/account-data/import/mergeAccountData";
import type { AccountProfileId } from "@/lib/account-data/types";
import {
  CharacterView,
  type CharacterViewHandle,
} from "@/pages/account-data/CharacterView";
import { EvaluationView } from "@/pages/account-data/EvaluationView";
import { InventoryView } from "@/pages/account-data/InventoryView";
import { RecommendationView } from "@/pages/account-data/RecommendationView";
import { ResourceView } from "@/pages/account-data/ResourceView";
import { TriageView } from "@/pages/account-data/TriageView";
import { applyAccountImport } from "@/stores/applyAccountImport";
import { useAccountStore } from "@/stores/useAccountStore";

const isValidAccountDataTab = (
  tab: string | null
): tab is
  | "characters"
  | "inventory"
  | "recommendations"
  | "evaluation"
  | "resources"
  | "triage" =>
  tab === "characters" ||
  tab === "inventory" ||
  tab === "recommendations" ||
  tab === "evaluation" ||
  tab === "resources" ||
  tab === "triage";

const NoDataPlaceholder = ({
  t,
  onAction,
  onShowTour,
}: {
  t: ReturnType<typeof useLanguage>["t"];
  onAction: () => void;
  onShowTour: () => void;
}) => (
  <EmptyState
    icon={Database}
    title={t.ui("accountData.noData")}
    description={t.ui("accountData.importPrompt")}
    action={{ label: t.ui("import.action"), icon: Download, onClick: onAction }}
    helpAction={{
      label: t.ui("buttons.help"),
      icon: HelpCircle,
      onClick: onShowTour,
    }}
  >
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
  </EmptyState>
);

export default function AccountDataPage() {
  const { t } = useLanguage();
  const tour = useTour();
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/account-data",
    defaultTab: "characters",
    isValidTab: isValidAccountDataTab,
    preserveSearchOnTabChange: true,
  });
  const [isEditMode, setIsEditMode] = useState(false);

  // Control refs for ref-based dialog pattern
  const importRef = useRef<ControlHandle>(null);
  const characterViewRef = useRef<CharacterViewHandle>(null);

  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const clearAccounts = useAccountStore((s) => s.clearAccounts);
  const addOrUpdateAccount = useAccountStore((s) => s.addOrUpdateAccount);
  const promoteToUid = useAccountStore((s) => s.promoteToUid);
  const activeAccount = useActiveAccount();
  const accountData = activeAccount?.data || null;
  const scores = activeAccount?.scores || {};
  useArtifactScoreComputation();
  // id IS the uid for non-default profiles
  const lastUid =
    activeAccount && !isDefaultAccountProfile(activeAccount.id)
      ? String(activeAccount.id)
      : "";

  const [pendingImport, setPendingImport] = useState<PendingImport | null>(
    null
  );
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);

  useEffect(() => {
    // Detect old data format (missing extraWeapons or missing talents) and clear it
    if (accountData) {
      const isOldFormat =
        !accountData.extraWeapons ||
        accountData.characters.some((c) => !c.talent);
      if (isOldFormat && activeAccountId !== null) {
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
      // Read fresh state to avoid stale closure
      const currentAccounts = useAccountStore.getState().accounts;

      // For the direct path, determine the target account so we can seed
      // existing characters for partial imports (location resolution).
      const directTargetId =
        uidToAccountProfileId(optionalUid) ??
        (Object.keys(currentAccounts).length === 0
          ? DEFAULT_ACCOUNT_PROFILE_ID
          : null);
      const existingData =
        directTargetId !== null ? currentAccounts[directTargetId]?.data : null;

      const result = convertGOODToAccountData(data, existingData?.characters);
      const { presentSections } = result;
      const isPartial =
        !presentSections.characters ||
        !presentSections.weapons ||
        !presentSections.artifacts;

      // Merge with existing data for absent sections
      let importData = result.data;
      let partialMergeMap: Map<string, string> | undefined;
      if (isPartial && existingData) {
        const mergeResult = mergePartialAccountData(
          existingData,
          result.data,
          presentSections
        );
        importData = mergeResult.data;
        partialMergeMap = mergeResult.artifactIdMap;
      }

      const routing = routeLocalImport(
        currentAccounts,
        importData,
        optionalUid,
        t.ui("accountData.defaultAccount")
      );

      if (routing.kind === "direct") {
        applyAccountImport({
          accountId: routing.id,
          data: routing.data,
          name: routing.name,
          setAsActive: routing.activeId,
          artifactIdMap: partialMergeMap,
        });
        toast.success(t.ui("accountData.importSuccess"));
      } else {
        // Dialog path — store raw GOOD for re-conversion at resolution time
        const pending = routing.pendingImport;
        if (isPartial) {
          pending.rawGOOD = data;
          pending.presentSections = presentSections;
        }
        setPendingImport(pending);
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
      let uidMergeMap: Map<string, string> | undefined;
      const routing = routeUidImport(
        currentAccounts,
        uid,
        result.data,
        nickname,
        clearBeforeImport,
        (old, incoming) => {
          const r = mergeAccountData(old, incoming);
          uidMergeMap = r.artifactIdMap;
          return r.data;
        }
      );

      if (routing.kind === "direct") {
        applyAccountImport({
          accountId: routing.id,
          data: routing.data,
          name: routing.name,
          setAsActive: routing.activeId,
          artifactIdMap: uidMergeMap,
        });
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

  const handleHoyolabImport = async (
    uid: string,
    cookie: string,
    clearBeforeImport: boolean
  ) => {
    try {
      const fetched = await fetchHoyolabData(uid, cookie);
      const hoyoResult = convertHoyolabToGOOD(fetched);
      const result = convertGOODToAccountData(hoyoResult.data);

      const allWarnings = [...hoyoResult.warnings, ...result.warnings];
      showConversionWarnings({ ...result, warnings: allWarnings });

      const currentAccounts = useAccountStore.getState().accounts;
      let hoyoMergeMap: Map<string, string> | undefined;
      const routing = routeUidImport(
        currentAccounts,
        uid,
        result.data,
        "",
        clearBeforeImport,
        (old, incoming) => {
          const r = mergeAccountData(old, incoming);
          hoyoMergeMap = r.artifactIdMap;
          return r.data;
        }
      );

      if (routing.kind === "direct") {
        applyAccountImport({
          accountId: routing.id,
          data: routing.data,
          name: routing.name,
          setAsActive: routing.activeId,
          artifactIdMap: hoyoMergeMap,
        });
        toast.success(t.ui("accountData.importSuccess"));
      } else {
        setPendingImport(routing.pendingImport);
        setIsAccountManagerOpen(true);
      }
    } catch (error: unknown) {
      console.error("HoYoLAB Import failed", error);
      const message =
        error instanceof Error ? error.message : t.ui("import.fileLoadError");
      toast.error(message);
      throw error;
    }
  };

  const handleResolveImport = (
    action: "overwrite" | "merge" | "create",
    targetId: AccountProfileId,
    renamedName?: string
  ) => {
    if (!pendingImport) return;

    // Read fresh state to avoid stale closure
    const currentAccounts = useAccountStore.getState().accounts;

    // For partial GOOD imports via dialog, re-convert with the target's
    // existing characters so location resolution works, then merge.
    let effectivePending = pendingImport;
    let resolveArtifactIdMap: Map<string, string> | undefined;
    if (
      pendingImport.rawGOOD &&
      pendingImport.presentSections &&
      action !== "create"
    ) {
      const existingData = currentAccounts[targetId]?.data;
      if (existingData) {
        const reConverted = convertGOODToAccountData(
          pendingImport.rawGOOD,
          existingData.characters
        );
        const partialResult = mergePartialAccountData(
          existingData,
          reConverted.data,
          pendingImport.presentSections
        );
        resolveArtifactIdMap = partialResult.artifactIdMap;
        effectivePending = {
          ...pendingImport,
          data: partialResult.data,
        };
      }
    }

    const result = routeResolveImport(
      currentAccounts,
      effectivePending,
      action,
      targetId,
      renamedName,
      (old, incoming) => {
        const r = mergeAccountData(old, incoming);
        resolveArtifactIdMap = r.artifactIdMap;
        return r.data;
      }
    );

    if (result.kind === "account_not_found") {
      // Account was deleted while the dialog was open
      toast.error(t.ui("common.error"));
      setPendingImport(null);
      setIsAccountManagerOpen(false);
      return;
    }

    applyAccountImport({
      accountId: result.id,
      data: result.data,
      name: result.name || undefined,
      setAsActive: result.activeId,
      artifactIdMap: resolveArtifactIdMap,
    });
    if (result.promoteToId !== undefined) {
      promoteToUid(result.id, result.promoteToId);
    }

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
        onHoyolabImport={handleHoyolabImport}
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
            <CharacterView ref={characterViewRef} isEditMode={isEditMode} />
          ) : (
            <NoDataPlaceholder
              t={t}
              onAction={() => importRef.current?.open()}
              onShowTour={() => tour.start("account-data")}
            />
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-0 h-full">
          {accountData ? (
            <InventoryView
              data={accountData}
              lastUpdate={activeAccount?.lastUpdate}
              isEditMode={isEditMode}
              onDeleteWeapon={(weaponId) => {
                if (activeAccountId === null) return;
                const newData = deleteInventoryWeapon(accountData, weaponId);
                addOrUpdateAccount(activeAccountId, { data: newData });
              }}
              onDeleteArtifact={(artifactId) => {
                if (activeAccountId === null) return;
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
              onShowTour={() => tour.start("account-data")}
            />
          )}
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0 h-full">
          <RecommendationView
            scores={scores}
            onOpenImport={() => importRef.current?.open()}
            onShowTour={() => tour.start("account-data")}
          />
        </TabsContent>

        <TabsContent value="evaluation" className="mt-0 h-full">
          <EvaluationView
            onOpenImport={() => importRef.current?.open()}
            onShowTour={() => tour.start("account-data")}
          />
        </TabsContent>

        <TabsContent value="resources" className="mt-0 h-full">
          <ResourceView
            onOpenImport={() => importRef.current?.open()}
            onShowTour={() => tour.start("account-data")}
          />
        </TabsContent>

        <TabsContent value="triage" className="mt-0 h-full">
          <TriageView
            onOpenImport={() => importRef.current?.open()}
            onShowTour={() => tour.start("account-data")}
          />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
