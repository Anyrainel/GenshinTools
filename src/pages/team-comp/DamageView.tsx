import type { ControlHandle } from "@/components/layout/AppBar";
import { DamageDetail } from "@/components/team-comp/DamageDetail";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import { useSessionNavStore } from "@/stores/useSessionNavStore";

interface DamageViewProps {
  /** Ref to open the import dialog (owned by parent TeamComp). */
  importRef: React.RefObject<ControlHandle | null>;
}

export function DamageView({ importRef }: DamageViewProps) {
  const activeTeamId = useSessionNavStore((s) => s.activeTeamId);
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);

  return (
    <TeamGrid
      activeTeamId={activeTeamId}
      setActiveTeamId={setActiveTeamId}
      renderDetail={(team, onBack) => (
        <DamageDetail team={team} onBack={onBack} />
      )}
      enableFreeze
      emptyState={{ importRef }}
      enableTour
    />
  );
}
