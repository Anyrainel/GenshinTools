import { CharacterArchiveView } from "@/components/archive/CharacterArchiveView";
import { WeaponArchiveView } from "@/components/archive/WeaponArchiveView";
import type { TabConfig } from "@/components/layout/AppBar";
import { PageLayout } from "@/components/layout/PageLayout";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Book, Sword } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type ArchiveTab = "characters" | "weapons";

const isValidTab = (tab: string | null): tab is ArchiveTab =>
  tab === "characters" || tab === "weapons";

export default function ArchivePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ArchiveTab = isValidTab(rawTab) ? rawTab : "characters";

  const { t } = useLanguage();

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        value: "characters",
        label: t.ui("archive.characters"),
        icon: Book,
      },
      {
        value: "weapons",
        label: t.ui("archive.weapons"),
        icon: Sword,
      },
    ],
    [t]
  );

  return (
    <PageLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "characters" ? (
        <CharacterArchiveView />
      ) : (
        <ScrollLayout className="pb-8 mt-2">
          <WeaponArchiveView />
        </ScrollLayout>
      )}
    </PageLayout>
  );
}
