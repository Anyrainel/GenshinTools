import { ArchiveToolbar } from "@/components/archive/ArchiveToolbar";
import { BossDetailPanel } from "@/components/archive/BossDetailPanel";
import { BossGrid, BossListPanel } from "@/components/archive/BossListPanel";
import { SidebarDetailLayout } from "@/components/layout/SidebarDetailLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { leylineBossResource } from "@/data/gameDataLoader";
import { useArchiveSessionStore } from "@/stores/useArchiveSessionStore";
import { Skull } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

export function BossArchiveView() {
  const { t } = useLanguage();
  const bossData = leylineBossResource.use();
  const searchQuery = useArchiveSessionStore((s) => s.bossSearch);
  const setSearchQuery = useArchiveSessionStore((s) => s.setBossSearch);
  const selectedBossId = useArchiveSessionStore((s) => s.selectedBossId);
  const setSelectedBossId = useArchiveSessionStore((s) => s.setSelectedBossId);

  // Default to a boss from the current rotation only on the very first mount
  // of the session (when nothing has been selected yet). Subsequent nulls —
  // e.g. from the mobile "Back" button — must not be re-seeded.
  const didSeed = useRef(false);
  useEffect(() => {
    if (!bossData) return;
    if (didSeed.current) return;
    didSeed.current = true;
    if (selectedBossId != null) return;
    const current = bossData.getCurrentSchedule();
    const fallback =
      current?.boss_ids[0] ??
      bossData.schedules[bossData.schedules.length - 1]?.boss_ids[0] ??
      null;
    if (fallback != null) setSelectedBossId(fallback);
  }, [bossData, selectedBossId, setSelectedBossId]);

  const handleSelect = useCallback(
    (id: number) => {
      setSelectedBossId(id);
    },
    [setSelectedBossId]
  );

  const handleBack = useCallback(() => {
    setSelectedBossId(null);
  }, [setSelectedBossId]);

  const toolbar = (
    <ArchiveToolbar
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t.ui("archive.bossSearchPlaceholder")}
    />
  );

  if (!bossData) {
    return (
      <SidebarDetailLayout
        header={toolbar}
        hasSelection={false}
        onBack={handleBack}
        backLabel={t.ui("archive.bossList")}
        sidebarWidth="w-2/5 max-w-[20rem]"
        sidebar={null}
      >
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Skull className="h-12 w-12 mb-4 opacity-30 animate-pulse" />
        </div>
      </SidebarDetailLayout>
    );
  }

  const detailPanel =
    selectedBossId !== null ? (
      <BossDetailPanel
        key={selectedBossId}
        bossId={selectedBossId}
        bossData={bossData}
      />
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
          bossData={bossData}
        />
      }
      mobileGrid={
        <BossGrid
          onSelect={handleSelect}
          searchQuery={searchQuery}
          bossData={bossData}
        />
      }
    >
      {detailPanel}
    </SidebarDetailLayout>
  );
}
