import { getTabsForRoute } from "@/components/layout/appNavigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import "@/lib/dmgcalc";
import { Download, FileDown, HelpCircle, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ClearAllControl } from "@/components/shared/ClearAllControl";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { ExportControl } from "@/components/shared/ExportControl";
import { ImportControl } from "@/components/shared/ImportControl";
import { useTour } from "@/components/ui/tour";
import type { PresetOption } from "@/data/types";
import { useCanonicalTabRoute } from "@/hooks/useCanonicalTabRoute";
import {
  getCachedPresetMetadata,
  loadPresetMetadata,
} from "@/lib/presetLoader";
import { loadTeamPreset } from "@/lib/team-comp/teamPresetRegistry";
import type { TeamCompData } from "@/lib/team-comp/types";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { DamageView } from "./team-comp/DamageView";
import type { FrozenViewHandle } from "./team-comp/FrozenView";
import { FrozenView } from "./team-comp/FrozenView";
import { InvestmentView } from "./team-comp/InvestmentView";
import { WeaponChoiceView } from "./team-comp/WeaponChoiceView";

type TeamCompTab = "damage" | "frozen" | "investment" | "weapon";

function isValidTab(tab: string | null): tab is TeamCompTab {
  return (
    tab === "damage" ||
    tab === "frozen" ||
    tab === "investment" ||
    tab === "weapon"
  );
}

const presetModules = import.meta.glob<{ default: TeamCompData }>(
  "@/presets/team-comp/*.json",
  { eager: false }
);

export default function TeamCompPage() {
  const { t } = useLanguage();
  const { activeTab, setActiveTab } = useCanonicalTabRoute({
    basePath: "/team-comp",
    defaultTab: "damage",
    isValidTab,
  });
  const tabs = useMemo(() => getTabsForRoute(t, "/team-comp"), [t]);
  const tour = useTour();
  const teams = useTeamStore((state) => state.teams);
  const [searchParams] = useSearchParams();
  const teamParam = searchParams.get("team");
  const routedDamageTeamId =
    activeTab === "damage" &&
    teamParam != null &&
    teams.some((team) => team.id === teamParam)
      ? teamParam
      : null;
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);
  const updateTeam = useTeamStore((state) => state.updateTeam);
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

  if (activeTab === "frozen") {
    const hasFrozenTeams = Object.keys(frozenTeams).length > 0;
    return (
      <PageLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          hasFrozenTeams
            ? [
                {
                  key: "download-frozen",
                  icon: FileDown,
                  label: t.ui("teamComp.downloadAllFrozen"),
                  onTrigger: () => frozenViewRef.current?.downloadAllFrozen(),
                },
              ]
            : []
        }
      >
        <FrozenView ref={frozenViewRef} />
      </PageLayout>
    );
  }

  // Shared dialogs — always mounted so import/export/clear refs stay live
  // across tab switches (including the empty-state import button on
  // Investment / Weapon Choice).
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
  // (damage grid, investment, weapon choice). Help is damage-only.
  const teamDataActions = [
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
    {
      key: "clear",
      icon: Trash2,
      label: t.ui("common.clear"),
      onTrigger: () => clearRef.current?.open(),
    },
  ];

  if (activeTab === "investment") {
    return (
      <PageLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClearData={clearTeams}
        clearLabel={t.ui("common.clearTeams")}
        actions={teamDataActions}
      >
        {teamControls}
        <InvestmentView importRef={importRef} />
      </PageLayout>
    );
  }

  if (activeTab === "weapon") {
    return (
      <PageLayout
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClearData={clearTeams}
        clearLabel={t.ui("common.clearTeams")}
        actions={teamDataActions}
      >
        {teamControls}
        <WeaponChoiceView importRef={importRef} />
      </PageLayout>
    );
  }

  // Damage tab — detail view (team selected)
  if (routedDamageTeamId) {
    const activeTeam = teams.find((t) => t.id === routedDamageTeamId);
    if (!activeTeam) {
      setTimeout(() => setActiveTeamId("damage", null), 0);
      return null;
    }
    const clearActiveTeam = () => {
      updateTeam(activeTeam.id, {
        characters: [null, null, null, null],
        weapons: [null, null, null, null],
        artifacts: [null, null, null, null],
        opts: {},
        selectedFormula: null,
        charSettings: {},
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
        ...teamDataActions,
        {
          key: "help",
          icon: HelpCircle,
          label: t.ui("buttons.help"),
          onTrigger: () => tour.start("team-comp"),
        },
      ]}
    >
      {teamControls}
      <DamageView importRef={importRef} />
    </PageLayout>
  );
}
