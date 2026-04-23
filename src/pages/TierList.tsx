import type { ActionConfig } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import { CharacterTierListView } from "@/pages/tier-list/CharacterTierListView";
import { WeaponTierListView } from "@/pages/tier-list/WeaponTierListView";
import { useTierStore } from "@/stores/useTierStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";
import { useCallback, useMemo, useState } from "react";

type TierListTab = "characters" | "weapons";

const isValidTab = (tab: string | null): tab is TierListTab =>
  tab === "characters" || tab === "weapons";

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
            : useWeaponTierStore.getState().resetTierList
        }
        clearLabel={t.ui("common.clearTierList")}
      >
        {activeTab === "characters" ? (
          <CharacterTierListView onActions={handleActions} />
        ) : (
          <WeaponTierListView onActions={handleActions} />
        )}
      </PageErrorBoundary>
    </PageLayout>
  );
}
