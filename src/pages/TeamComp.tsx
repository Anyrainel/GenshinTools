import { PageLayout } from "@/components/layout/PageLayout";
import { getTabsForRoute } from "@/config/appNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/lib/team-comp";
import type { ControlHandle } from "@/components/layout/AppBar";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import { ExportBranding } from "@/components/shared/ExportBranding";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import {
  ExportColumn,
  buildArtifactOwnerMap,
} from "@/components/team-comp/SwapGuide";
import { useTour } from "@/components/ui/tour";
import type { PresetOption } from "@/data/types";
import type { ArtifactData, CharacterData } from "@/data/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { downloadElementAsImage } from "@/lib/downloadImage";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
  loadPresetPayload,
} from "@/lib/presetLoader";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import type { TeamCompData } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Download, FileDown, HelpCircle, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { DamageView } from "./team-comp/DamageView";

type TeamCompTab = "damage" | "frozen" | "investment";

function isValidTab(tab: string | null): tab is TeamCompTab {
  return tab === "damage" || tab === "frozen" || tab === "investment";
}

const presetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

export default function TeamCompPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: TeamCompTab = isValidTab(rawTab) ? rawTab : "damage";
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  const tabs = useMemo(() => getTabsForRoute(t, "/team-comp"), [t]);
  const tour = useTour();
  const isXl = useMediaQuery("(min-width: 1280px)");
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const teams = useTeamStore((state) => state.teams);
  const activeTeamId = useSessionNavStore((s) => s.activeTeamId);
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);
  const updateTeam = useTeamStore((state) => state.updateTeam);
  const importTeams = useTeamStore((state) => state.importTeams);
  const exportTeams = useTeamStore((state) => state.exportTeams);
  const clearTeamsRaw = useTeamStore((state) => state.clearTeams);
  const author = useTeamStore((state) => state.author);
  const description = useTeamStore((state) => state.description);
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const clearAllFrozen = useFreezeStore((s) => s.clearAll);
  const clearTeams = useCallback(() => {
    clearAllFrozen();
    clearTeamsRaw();
  }, [clearAllFrozen, clearTeamsRaw]);

  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);
  const frozenExportRef = useRef<HTMLDivElement>(null);

  // Preset options
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadPresetPayload(presetModules, path);
  }, []);

  const handleImport = (data: TeamCompData) => {
    clearAllFrozen();
    importTeams(data);
    toast.success(t.ui("import.action"));
  };

  const handleExport = (exportAuthor: string, exportDescription: string) => {
    const data = exportTeams(exportAuthor, exportDescription);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `[${exportAuthor}] ${exportDescription}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Persist metadata to store
      useTeamStore.getState().setMetadata(exportAuthor, exportDescription);
      toast.success(t.ui("export.action"));
    } catch (error) {
      console.error("Error exporting teams:", error);
    }
  };

  // Frozen teams data for export
  const frozenTeamEntries = useMemo(() => {
    const entries: {
      team: (typeof teams)[number];
      equippedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
      optimizedArtifactsByChar: Record<string, Record<string, ArtifactData>>;
    }[] = [];
    for (const [teamId, frozenData] of Object.entries(frozenTeams)) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;
      const equipped: Record<string, Record<string, ArtifactData>> = {};
      for (const cid of team.characters) {
        if (!cid) continue;
        const acctChar = accountData?.characters.find(
          (c: CharacterData) => c.key === cid
        );
        equipped[cid] = (acctChar?.artifacts || {}) as Record<
          string,
          ArtifactData
        >;
      }
      const optimized: Record<string, Record<string, ArtifactData>> = {};
      for (const [cid, artsBySlot] of Object.entries(
        frozenData.artifactsByChar
      )) {
        const slotMap: Record<string, ArtifactData> = {};
        for (const [slot, art] of Object.entries(artsBySlot)) {
          if (art) slotMap[slot] = art;
        }
        optimized[cid] = slotMap;
      }
      entries.push({
        team,
        equippedArtifactsByChar: equipped,
        optimizedArtifactsByChar: optimized,
      });
    }
    return entries;
  }, [frozenTeams, teams, accountData]);

  const handleDownloadAllFrozen = useCallback(() => {
    if (!frozenExportRef.current) return;
    const filename = t
      .ui("teamComp.frozenExportFilename")
      .replace("{0}", String(frozenTeamEntries.length));
    downloadElementAsImage(frozenExportRef.current, filename, t);
  }, [t, frozenTeamEntries]);

  if (activeTab === "frozen") {
    return (
      <PageLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
          Frozen view — coming soon
        </div>
      </PageLayout>
    );
  }

  if (activeTab === "investment") {
    return (
      <PageLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
          Investment view — coming soon
        </div>
      </PageLayout>
    );
  }

  // Damage tab — detail view (team selected)
  if (activeTeamId) {
    const activeTeam = teams.find((t) => t.id === activeTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeamId(null), 0);
      return null;
    }
    const clearActiveTeam = () => {
      updateTeam(activeTeam.id, {
        characters: [null, null, null, null],
        weapons: [null, null, null, null],
        artifacts: [null, null, null, null],
        opts: {},
        selectedFormula: null,
        minEr: {},
      });
    };

    return (
      <PageLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClearData={clearActiveTeam}
        clearLabel={t.ui("teamComp.clearTeamData")}
        actions={[
          {
            key: "help",
            icon: HelpCircle,
            label: t.ui("buttons.help"),
            onTrigger: () => tour.start("team-opt-detail"),
          },
        ]}
      >
        <DamageView importRef={importRef} />
      </PageLayout>
    );
  }

  // Damage tab — grid view
  return (
    <PageLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClearData={clearTeams}
      clearLabel={t.ui("common.clearTeams")}
      actions={[
        {
          key: "import",
          icon: Download,
          label: t.ui("import.action"),
          alwaysShow: true,
          tourStepId: "tc-import",
          onTrigger: () => importRef.current?.open(),
        },
        {
          key: "export",
          icon: Upload,
          label: t.ui("export.action"),
          onTrigger: () => exportRef.current?.open(),
        },
        ...(Object.keys(frozenTeams).length > 0
          ? [
              {
                key: "download-frozen",
                icon: FileDown,
                label: t.ui("teamComp.downloadAllFrozen"),
                onTrigger: handleDownloadAllFrozen,
              },
            ]
          : []),
        {
          key: "clear",
          icon: Trash2,
          label: t.ui("common.clear"),
          onTrigger: () => clearRef.current?.open(),
        },
        {
          key: "help",
          icon: HelpCircle,
          label: t.ui("buttons.help"),
          onTrigger: () => tour.start("team-comp"),
        },
      ]}
    >
      {/* Control dialogs - render without triggers, opened via ref */}
      <ImportControl<TeamCompData>
        ref={importRef}
        options={presetOptions}
        loadPreset={loadPreset}
        onApply={handleImport}
        onLocalImport={handleImport}
        variant="team-comp"
      />
      <ExportControl
        ref={exportRef}
        onExport={handleExport}
        variant="team-comp"
        defaultAuthor={author}
        defaultDescription={description}
      />
      <ClearAllControl ref={clearRef} onConfirm={clearTeams} />

      <DamageView importRef={importRef} />

      {/* Hidden export container for all frozen teams */}
      {frozenTeamEntries.length > 0 && (
        <div
          style={{ position: "fixed", left: -9999, top: 0 }}
          aria-hidden="true"
        >
          <div
            ref={frozenExportRef}
            className="p-1"
            style={{ width: isXl ? 1400 : 700 }}
          >
            <ExportBranding />
            {frozenTeamEntries.map((entry, i) => {
              const ownerMap = buildArtifactOwnerMap(accountData);
              const charIds = entry.team.characters.filter(
                (id): id is string => id != null
              );
              return (
                <div key={entry.team.id}>
                  {i > 0 && <div className="h-px bg-border/20" />}
                  {entry.team.name && (
                    <div className="text-center py-1.5 text-sm font-bold text-foreground/90 bg-black/20">
                      {entry.team.name}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-px bg-border/10">
                    {charIds.map((charId) => (
                      <ExportColumn
                        key={charId}
                        charId={charId}
                        team={entry.team}
                        equipped={entry.equippedArtifactsByChar[charId] ?? {}}
                        optimized={entry.optimizedArtifactsByChar[charId] ?? {}}
                        ownerMap={ownerMap}
                        accountData={accountData}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
