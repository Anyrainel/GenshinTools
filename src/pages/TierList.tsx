import { useCallback, useMemo, useState } from "react";
import type { ActionConfig } from "@/components/layout/AppBar";
import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import { ArtifactTierListView } from "@/pages/tier-list/ArtifactTierListView";
import { CharacterTierListView } from "@/pages/tier-list/CharacterTierListView";
import { WeaponTierListView } from "@/pages/tier-list/WeaponTierListView";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";
import { useTierStore } from "@/stores/useTierStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

type TierListTab = "characters" | "weapons" | "artifacts";

const isValidTab = (tab: string | null): tab is TierListTab =>
  tab === "characters" || tab === "weapons" || tab === "artifacts";

export default function TierListPage() {
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/tier-list",
    defaultTab: "characters",
    isValidTab,
  });

  const { t } = useLanguage();

  // Actions are pushed up from the active view component
  const [actions, setActions] = useState<ActionConfig[]>([]);

  const handleActions = useCallback((newActions: ActionConfig[]) => {
    setActions(newActions);
  }, []);

  const tabs = useMemo(() => getTabsForRoute(t, "/tier-list"), [t]);

  return (
    <PageLayout
      actions={actions}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <PageErrorBoundary
        key={activeTab}
        onClearData={
          activeTab === "characters"
            ? useTierStore.getState().resetTierList
            : activeTab === "weapons"
              ? useWeaponTierStore.getState().resetTierList
              : useArtifactTierStore.getState().resetTierList
        }
        clearLabel={t.ui("common.clearTierList")}
      >
        {activeTab === "characters" ? (
          <CharacterTierListView onActions={handleActions} />
        ) : activeTab === "weapons" ? (
          <WeaponTierListView onActions={handleActions} />
        ) : (
          <ArtifactTierListView onActions={handleActions} />
        )}
      </PageErrorBoundary>
    </PageLayout>
  );
}
