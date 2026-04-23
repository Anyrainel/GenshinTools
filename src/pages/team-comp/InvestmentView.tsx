import type { ControlHandle } from "@/components/shared/controlHandle";
import { InvestmentDetail } from "@/components/team-comp/InvestmentDetail";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { TrendingUp } from "lucide-react";

interface InvestmentViewProps {
  importRef: React.RefObject<ControlHandle | null>;
}

export function InvestmentView({ importRef }: InvestmentViewProps) {
  const { t } = useLanguage();
  const activeTeamId = useSessionNavStore(
    (s) => s.viewSettings.investment.activeTeamId
  );
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);

  return (
    <TeamGrid
      viewId="investment"
      activeTeamId={activeTeamId}
      setActiveTeamId={(id) => setActiveTeamId("investment", id)}
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
