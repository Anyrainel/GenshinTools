import type { ControlHandle } from "@/components/layout/AppBar";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import { WeaponChoiceDetail } from "@/components/team-comp/WeaponChoiceDetail";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSessionNavStore } from "@/stores/useSessionNavStore";
import { Sword } from "lucide-react";

interface WeaponChoiceViewProps {
  importRef: React.RefObject<ControlHandle | null>;
}

export function WeaponChoiceView({ importRef }: WeaponChoiceViewProps) {
  const { t } = useLanguage();
  const activeTeamId = useSessionNavStore(
    (s) => s.viewSettings.weaponChoice.activeTeamId
  );
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);

  return (
    <TeamGrid
      viewId="weaponChoice"
      activeTeamId={activeTeamId}
      setActiveTeamId={(id) => setActiveTeamId("weaponChoice", id)}
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
