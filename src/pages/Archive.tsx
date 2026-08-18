import { useMemo } from "react";
import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import { AchievementArchiveView } from "@/pages/archive/AchievementArchiveView";
import { ArtifactArchiveView } from "@/pages/archive/ArtifactArchiveView";
import { BossArchiveView } from "@/pages/archive/BossArchiveView";
import { CharacterArchiveView } from "@/pages/archive/CharacterArchiveView";
import { WeaponArchiveView } from "@/pages/archive/WeaponArchiveView";

type ArchiveTab =
  | "characters"
  | "weapons"
  | "artifacts"
  | "bosses"
  | "achievements";

const isValidTab = (tab: string | null): tab is ArchiveTab =>
  tab === "characters" ||
  tab === "weapons" ||
  tab === "artifacts" ||
  tab === "bosses" ||
  tab === "achievements";

export default function ArchivePage() {
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/archive",
    defaultTab: "characters",
    isValidTab,
  });

  const { t } = useLanguage();

  const tabs = useMemo(() => getTabsForRoute(t, "/archive"), [t]);

  return (
    <PageLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "characters" ? (
        <CharacterArchiveView />
      ) : activeTab === "weapons" ? (
        <WeaponArchiveView />
      ) : activeTab === "bosses" ? (
        <BossArchiveView />
      ) : activeTab === "achievements" ? (
        <AchievementArchiveView />
      ) : (
        <ArtifactArchiveView />
      )}
    </PageLayout>
  );
}
