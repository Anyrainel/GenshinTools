import { ArtifactArchiveView } from "@/components/archive/ArtifactArchiveView";
import { BossArchiveView } from "@/components/archive/BossArchiveView";
import { CharacterArchiveView } from "@/components/archive/CharacterArchiveView";
import { WeaponArchiveView } from "@/components/archive/WeaponArchiveView";
import { PageLayout } from "@/components/layout/PageLayout";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type ArchiveTab = "characters" | "weapons" | "artifacts" | "bosses";

const isValidTab = (tab: string | null): tab is ArchiveTab =>
  tab === "characters" ||
  tab === "weapons" ||
  tab === "artifacts" ||
  tab === "bosses";

export default function ArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ArchiveTab = isValidTab(rawTab) ? rawTab : "characters";

  const { t } = useLanguage();

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const tabs = useMemo(() => getTabsForRoute(t, "/archive"), [t]);

  return (
    <PageLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "characters" ? (
        <CharacterArchiveView />
      ) : activeTab === "weapons" ? (
        <WeaponArchiveView />
      ) : activeTab === "bosses" ? (
        <BossArchiveView />
      ) : (
        <ArtifactArchiveView />
      )}
    </PageLayout>
  );
}
