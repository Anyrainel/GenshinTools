import type { ActionConfig } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { PageErrorBoundary } from "@/components/shared/ErrorBoundary";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { CharacterTierListView } from "@/pages/tier-list/CharacterTierListView";
import { WeaponTierListView } from "@/pages/tier-list/WeaponTierListView";
import { useTierStore } from "@/stores/useTierStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type TierListTab = "characters" | "weapons";

const isValidTab = (tab: string | null): tab is TierListTab =>
  tab === "characters" || tab === "weapons";

export default function TierListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TierListTab = isValidTab(rawTab) ? rawTab : "characters";

  const { t } = useLanguage();

  // Actions are pushed up from the active view component
  const [actions, setActions] = useState<ActionConfig[]>([]);

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

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
