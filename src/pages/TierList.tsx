import type { ActionConfig, TabConfig } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { CharacterTierListView } from "@/components/tier-list/CharacterTierListView";
import { WeaponTierListView } from "@/components/tier-list/WeaponTierListView";
import { useLanguage } from "@/contexts/LanguageContext";
import { Award, Sword } from "lucide-react";
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

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        value: "characters",
        label: t.ui("app.tierListTitle"),
        icon: Award,
      },
      {
        value: "weapons",
        label: t.ui("app.weaponTierListTitle"),
        icon: Sword,
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
      {activeTab === "characters" ? (
        <CharacterTierListView onActions={handleActions} />
      ) : (
        <WeaponTierListView onActions={handleActions} />
      )}
    </PageLayout>
  );
}
