import { TrendingUp } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { ControlHandle } from "@/components/shared/controlHandle";
import { InvestmentDetail } from "@/components/team-comp/InvestmentDetail";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { useTeamStore } from "@/stores/useTeamStore";

interface InvestmentViewProps {
  importRef: React.RefObject<ControlHandle | null>;
}

export function InvestmentView({ importRef }: InvestmentViewProps) {
  const { t } = useLanguage();
  const activeTeamId = useSessionNavStore(
    (s) => s.viewSettings.investment.activeTeamId
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
      if (activeTeamId !== null) setActiveTeamId("investment", null);
      return;
    }

    if (!teamParamIsValid) {
      if (activeTeamId !== null) setActiveTeamId("investment", null);
      setTeamSearchParam(null);
      return;
    }

    if (activeTeamId !== teamParam) {
      setActiveTeamId("investment", teamParam);
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
      setActiveTeamId("investment", id);
      setTeamSearchParam(id);
    },
    [setActiveTeamId, setTeamSearchParam]
  );

  return (
    <TeamGrid
      viewId="investment"
      activeTeamId={routedTeamId}
      setActiveTeamId={handleActiveTeamChange}
      renderDetail={(team, onBack) => (
        <InvestmentDetail team={team} onBack={onBack} />
      )}
      selectLabel={t.ui("teamComp.tabInvestment")}
      selectIcon={TrendingUp}
      selectClassName="border-amber-600/50 bg-amber-700/40 text-amber-300 hover:bg-amber-700/60 hover:text-amber-200"
      emptyState={{ importRef }}
    />
  );
}
