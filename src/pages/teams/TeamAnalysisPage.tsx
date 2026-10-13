import { FileDown, HelpCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout/PageLayout";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { ExportIcon, ImportIcon } from "@/components/shared/importExportIcons";
import { useTour } from "@/components/ui/tour";
import { getTabsForRoute } from "@/config/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PresetOption } from "@/domain/models";
import {
  loadTeamPreset,
  teamPresetModules as presetModules,
} from "@/domain/team/teamPresetRegistry";
import type { TeamCompData } from "@/domain/team/types";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
} from "@/lib/resources/presets";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { AnalysisView } from "./AnalysisView";
import type { FrozenViewHandle } from "./FrozenView";
import { FrozenView } from "./FrozenView";

type TeamCompTab = "analysis" | "loadouts";
function isValidTab(tab: string | null): tab is TeamCompTab {
  return tab === "analysis" || tab === "loadouts";
}

export default function TeamCompPage() {
  const { t } = useLanguage();
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/team-comp",
    defaultTab: "analysis",
    isValidTab,
  });
  const tabs = useMemo(() => getTabsForRoute(t, "/team-comp"), [t]);
  const tour = useTour();
  const importTeams = useTeamStore((state) => state.importTeams);
  const subscribePreset = useTeamStore((state) => state.subscribePreset);
  const exportTeams = useTeamStore((state) => state.exportTeams);
  const clearTeamsRaw = useTeamStore((state) => state.clearTeams);
  const author = useTeamStore((state) => state.author);
  const description = useTeamStore((state) => state.description);
  const clearAllFrozen = useFreezeStore((s) => s.clearAll);
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const clearTeams = useCallback(() => {
    clearAllFrozen();
    clearTeamsRaw();
  }, [clearAllFrozen, clearTeamsRaw]);

  const clearRef = useRef<ControlHandle>(null);
  const importRef = useRef<ControlHandle>(null);
  const exportRef = useRef<ControlHandle>(null);
  const frozenViewRef = useRef<FrozenViewHandle>(null);

  // Preset options
  const [presetOptions, setPresetOptions] = useState<PresetOption[]>(
    () => getCachedPresetMetadata(presetModules) ?? []
  );

  useEffect(() => {
    loadPresetMetadata(presetModules).then(setPresetOptions);
  }, []);

  const loadPreset = useCallback(async (path: string) => {
    return loadTeamPreset(path);
  }, []);

  const handleImport = (data: TeamCompData, preset?: PresetOption) => {
    clearAllFrozen();
    if (preset) {
      subscribePreset(preset.path, data);
    } else {
      importTeams(data);
    }
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

  const showAnalysis = activeTab === "analysis";

  // Shared dialogs — always mounted so import/export/clear refs stay live
  // across tab switches (including the empty-state import button on
  // Analysis).
  const teamControls = (
    <>
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
    </>
  );

  // Shared action buttons for tabs that operate on the team list
  // for the canonical analysis team grid.
  const teamDataActions = [
    {
      key: "import",
      icon: ImportIcon,
      label: t.ui("import.action"),
      alwaysShow: true,
      tourStepId: "tc-import",
      onTrigger: () => importRef.current?.open(),
    },
    {
      key: "export",
      icon: ExportIcon,
      label: t.ui("export.action"),
      onTrigger: () => exportRef.current?.open(),
    },
    {
      key: "clear",
      icon: Trash2,
      label: t.ui("common.clear"),
      onTrigger: () => clearRef.current?.open(),
    },
  ];

  return (
    <PageLayout
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClearData={showAnalysis ? clearTeams : undefined}
      clearLabel={t.ui("common.clearTeams")}
      actions={
        showAnalysis
          ? [
              ...teamDataActions,
              {
                key: "help",
                icon: HelpCircle,
                label: t.ui("buttons.help"),
                onTrigger: () => tour.start("team-comp"),
              },
            ]
          : Object.keys(frozenTeams).length > 0
            ? [
                {
                  key: "download-loadouts",
                  icon: FileDown,
                  label: t.ui("teamComp.downloadAllFrozen"),
                  onTrigger: () => frozenViewRef.current?.downloadAllFrozen(),
                },
              ]
            : []
      }
    >
      {teamControls}
      <div
        hidden={!showAnalysis}
        className={showAnalysis ? "flex min-h-0 flex-1 flex-col" : "hidden"}
      >
        <AnalysisView importRef={importRef} active={showAnalysis} />
      </div>
      <div
        hidden={showAnalysis}
        className={showAnalysis ? "hidden" : "flex min-h-0 flex-1 flex-col"}
      >
        <FrozenView ref={frozenViewRef} />
      </div>
    </PageLayout>
  );
}
