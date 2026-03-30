import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { BossDetailPanel } from "@/components/archive/BossDetailPanel";
import { BossGrid, BossListPanel } from "@/components/archive/BossListPanel";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrentSchedule, schedules } from "@/data/leylineBoss";
import { Skull } from "lucide-react";
import { useCallback, useState } from "react";

export function BossArchiveView() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedBossId, setSelectedBossId] = useState<number | null>(() => {
    const current = getCurrentSchedule();
    return (
      current?.boss_ids[0] ??
      schedules[schedules.length - 1]?.boss_ids[0] ??
      null
    );
  });

  const handleSelect = useCallback((id: number) => {
    setSelectedBossId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedBossId(null);
  }, []);

  const toolbar = (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t.ui("archive.bossSearchPlaceholder")}
    />
  );

  const detailPanel =
    selectedBossId !== null ? (
      <BossDetailPanel key={selectedBossId} bossId={selectedBossId} />
    ) : (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
        <Skull className="h-12 w-12 mb-4 opacity-30" />
        <p>{t.ui("archive.bossSelectPrompt")}</p>
      </div>
    );

  return (
    <SidebarDetailLayout
      header={toolbar}
      hasSelection={selectedBossId !== null}
      onBack={handleBack}
      backLabel={t.ui("archive.bossList")}
      sidebarWidth="w-2/5 max-w-[20rem]"
      sidebar={
        <BossListPanel
          selectedBossId={selectedBossId}
          onSelect={handleSelect}
          searchQuery={searchQuery}
        />
      }
      mobileGrid={
        <BossGrid onSelect={handleSelect} searchQuery={searchQuery} />
      }
    >
      {detailPanel}
    </SidebarDetailLayout>
  );
}
