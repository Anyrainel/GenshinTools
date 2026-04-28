import { Sword } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import { WeaponChoiceDetail } from "@/components/team-comp/WeaponChoiceDetail";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";

interface WeaponChoiceViewProps {
  importRef: React.RefObject<ControlHandle | null>;
}

export function WeaponChoiceView({ importRef }: WeaponChoiceViewProps) {
  const { t } = useLanguage();
  const activeTeamId = useSessionNavStore(
    (s) => s.viewSettings.weaponChoice.activeTeamId
  );
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);
  const teams = useTeamStore((s) => s.teams);
  const [searchParams, setSearchParams] = useSearchParams();
  const teamParam = searchParams.get("team");
  const hasTeamParam = searchParams.has("team");
  const teamParamIsValid =
    teamParam != null && teams.some((team) => team.id === teamParam);
  const routedTeamId = hasTeamParam && teamParamIsValid ? teamParam : null;

  const setTeamSearchParam = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("team", id);
          else next.delete("team");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (!hasTeamParam) {
      if (activeTeamId !== null) setActiveTeamId("weaponChoice", null);
      return;
    }

    if (!teamParamIsValid) {
      if (activeTeamId !== null) setActiveTeamId("weaponChoice", null);
      setTeamSearchParam(null);
      return;
    }

    if (activeTeamId !== teamParam) {
      setActiveTeamId("weaponChoice", teamParam);
    }
  }, [
    activeTeamId,
    hasTeamParam,
    setActiveTeamId,
    setTeamSearchParam,
    teamParam,
    teamParamIsValid,
  ]);

  const handleActiveTeamChange = useCallback(
    (id: string | null) => {
      setActiveTeamId("weaponChoice", id);
      setTeamSearchParam(id);
    },
    [setActiveTeamId, setTeamSearchParam]
  );

  return (
    <TeamGrid
      viewId="weaponChoice"
      activeTeamId={routedTeamId}
      setActiveTeamId={handleActiveTeamChange}
      renderDetail={(team, onBack) => (
        <WeaponChoiceDetail team={team} onBack={onBack} />
      )}
      selectLabel={t.ui("teamComp.tabWeaponChoice")}
      selectIcon={Sword}
      selectClassName="border-sky-600/50 bg-sky-700/40 text-sky-300 hover:bg-sky-700/60 hover:text-sky-200"
      emptyState={{ importRef }}
    />
  );
}
