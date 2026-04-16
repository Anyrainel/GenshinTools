import type { ActionConfig } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import { betaEnabled, setBetaEnabled } from "@/lib/betaFlag";
import { ArtifactArchiveView } from "@/pages/archive/ArtifactArchiveView";
import { BossArchiveView } from "@/pages/archive/BossArchiveView";
import { CharacterArchiveView } from "@/pages/archive/CharacterArchiveView";
import { WeaponArchiveView } from "@/pages/archive/WeaponArchiveView";
import { FlaskConical } from "lucide-react";
import { useMemo } from "react";

type ArchiveTab = "characters" | "weapons" | "artifacts" | "bosses";

const isValidTab = (tab: string | null): tab is ArchiveTab =>
  tab === "characters" ||
  tab === "weapons" ||
  tab === "artifacts" ||
  tab === "bosses";

export default function ArchivePage() {
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/archive",
    defaultTab: "characters",
    isValidTab,
  });

  const { t } = useLanguage();

  const tabs = useMemo(() => getTabsForRoute(t, "/archive"), [t]);

  // Dev-only toggle for beta visibility. Most beta-gated data is computed at
  // module init (constants.ts merges beta entities once), so we reload after
  // flipping the flag to reset that state.
  const actions = useMemo<ActionConfig[] | undefined>(() => {
    if (!import.meta.env.DEV) return undefined;
    const isOn = betaEnabled();
    return [
      {
        key: "beta-toggle",
        icon: FlaskConical,
        label: isOn ? "Beta: On" : "Beta: Off",
        onTrigger: () => {
          setBetaEnabled(!isOn);
          window.location.reload();
        },
      },
    ];
  }, []);

  return (
    <PageLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={actions}
    >
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
