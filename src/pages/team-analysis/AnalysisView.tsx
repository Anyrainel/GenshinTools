import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { AnalysisWorkspace } from "@/components/team-analysis/AnalysisWorkspace";
import { TeamGrid } from "@/components/team-analysis/TeamGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AnalysisMode } from "@/domain/team/analysisTypes";
import { cn } from "@/lib/utils";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";

function isAnalysisMode(value: string | null): value is AnalysisMode {
  return (
    value === "artifacts" ||
    value === "builds" ||
    value === "investment" ||
    value === "characters" ||
    value === "energy"
  );
}

export function AnalysisView({
  importRef,
  active = true,
}: {
  importRef: React.RefObject<ControlHandle | null>;
  active?: boolean;
}) {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const teams = useTeamStore((s) => s.teamComps);
  const configs = useTeamStore((s) => s.configsByTeamId);
  const getSetup = useTeamStore((s) => s.getTeamSetupConfigById);
  const modes = useSessionNavStore((s) => s.analysisModes);
  const setMode = useSessionNavStore((s) => s.setAnalysisMode);
  const setActiveTeam = useSessionNavStore((s) => s.setActiveTeamId);
  const teamParam = params.get("team");
  const selectedId = teams.some((team) => team.id === teamParam)
    ? teamParam
    : null;
  const rawMode = params.get("mode");
  const selectedMode = isAnalysisMode(rawMode)
    ? rawMode
    : selectedId
      ? (modes[selectedId] ?? "artifacts")
      : "artifacts";
  const lastSelectedId = useRef(selectedId);
  const wasActive = useRef(active);
  const [visited, setVisited] = useState<string[]>(() =>
    selectedId ? [selectedId] : []
  );

  useEffect(() => {
    const resumed = active && !wasActive.current;
    wasActive.current = active;
    if (!active) return;
    if (
      resumed &&
      !teamParam &&
      lastSelectedId.current &&
      teams.some((team) => team.id === lastSelectedId.current)
    ) {
      const id = lastSelectedId.current;
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("team", id);
          next.set(
            "mode",
            useSessionNavStore.getState().analysisModes[id] ?? "artifacts"
          );
          return next;
        },
        { replace: true }
      );
      return;
    }
    lastSelectedId.current = selectedId;
    setActiveTeam("analysis", selectedId);
    if (selectedId) {
      setVisited((prev) =>
        prev.includes(selectedId) ? prev : [...prev, selectedId]
      );
      setMode(selectedId, selectedMode);
    }
    if ((teamParam && !selectedId) || (rawMode && !isAnalysisMode(rawMode))) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (!selectedId) next.delete("team");
          if (!isAnalysisMode(rawMode)) next.delete("mode");
          return next;
        },
        { replace: true }
      );
    } else if (selectedId && !rawMode) {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("mode", selectedMode);
          return next;
        },
        { replace: true }
      );
    }
  }, [
    selectedId,
    selectedMode,
    teamParam,
    rawMode,
    setActiveTeam,
    setMode,
    setParams,
    active,
    teams,
  ]);

  const chooseTeam = useCallback(
    (id: string | null) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (id) {
          next.set("team", id);
          next.set("mode", modes[id] ?? "artifacts");
        } else {
          next.delete("team");
          next.delete("mode");
        }
        return next;
      });
    },
    [modes, setParams]
  );

  return (
    <>
      <div
        hidden={selectedId !== null}
        className={cn(
          "min-h-0 flex-1 flex-col",
          selectedId ? "hidden" : "flex"
        )}
      >
        <TeamGrid
          viewId="analysis"
          activeTeamId={null}
          setActiveTeamId={chooseTeam}
          renderDetail={() => null}
          selectLabel={t.ui("teamComp.tabAnalysis")}
          enableFreeze
          enableTour
          emptyState={{ importRef }}
          selectionCue={t.ui("teamComp.selectTeam")}
        />
      </div>
      {visited.map((id) => {
        const team = teams.find((entry) => entry.id === id);
        if (!team) return null;
        // Keep authored panel interactions, running jobs and local previews alive
        // on team switches. Hidden workspaces never duplicate visible controls.
        return (
          <div
            key={id}
            hidden={selectedId !== id}
            className={cn(
              "min-h-0 flex-1 flex-col",
              selectedId === id ? "flex" : "hidden"
            )}
          >
            <AnalysisWorkspace
              teamComp={team}
              setupConfig={configs[id] ?? getSetup(id)}
              onBack={() => chooseTeam(null)}
              mode={
                selectedId === id ? selectedMode : (modes[id] ?? "artifacts")
              }
              onModeChange={(mode) => {
                setMode(id, mode);
                setParams(
                  (previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("mode", mode);
                    return next;
                  },
                  { replace: true }
                );
              }}
            />
          </div>
        );
      })}
    </>
  );
}
