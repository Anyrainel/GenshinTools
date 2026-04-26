import type { ControlHandle } from "@/components/shared/controlHandle";
import { DamageDetail } from "@/components/team-comp/DamageDetail";
import { TeamGrid } from "@/components/team-comp/TeamGrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactReuseMode } from "@/stores/useFreezeStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useSessionNavStore } from "@/stores/useSessionNavStore";

interface DamageViewProps {
  /** Ref to open the import dialog (owned by parent TeamComp). */
  importRef: React.RefObject<ControlHandle | null>;
}

export function DamageView({ importRef }: DamageViewProps) {
  const { t } = useLanguage();
  const activeTeamId = useSessionNavStore(
    (s) => s.viewSettings.damage.activeTeamId
  );
  const setActiveTeamId = useSessionNavStore((s) => s.setActiveTeamId);
  const reuseMode = useFreezeStore((s) => s.reuseMode);
  const setReuseMode = useFreezeStore((s) => s.setReuseMode);

  const reuseModeRow = (
    <div className="flex items-center gap-2 pt-0.5">
      <span className="text-xs md:text-sm font-bold text-foreground whitespace-nowrap">
        {t.ui("teamComp.reuseLabel")}
      </span>
      <Select
        value={reuseMode}
        onValueChange={(v) => setReuseMode(v as ArtifactReuseMode)}
      >
        <SelectTrigger className="w-auto text-xs md:text-sm font-bold h-7 md:h-8 gap-1.5 px-3 border-primary/30 bg-primary/10 text-foreground ring-1 ring-primary/15 hover:bg-primary/15">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t.ui("teamComp.reuseNone")}</SelectItem>
          <SelectItem value="sameChar">
            {t.ui("teamComp.reuseSameChar")}
          </SelectItem>
          <SelectItem value="forceReuse">
            {t.ui("teamComp.reuseForce")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <TeamGrid
      viewId="damage"
      activeTeamId={activeTeamId}
      setActiveTeamId={(id) => setActiveTeamId("damage", id)}
      renderDetail={(team, onBack) => (
        <DamageDetail team={team} onBack={onBack} />
      )}
      enableFreeze
      emptyState={{ importRef }}
      enableTour
      headerExtra={reuseModeRow}
    />
  );
}
