import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useTeamStore } from "@/stores/useTeamStore";

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
  const teamComps = useTeamStore((s) => s.teamComps);
  const [searchParams, setSearchParams] = useSearchParams();
  const teamParam = searchParams.get("team");
  const hasTeamParam = searchParams.has("team");
  const teamParamIsValid =
    teamParam != null && teamComps.some((team) => team.id === teamParam);
  const routedTeamId = hasTeamParam && teamParamIsValid ? teamParam : null;
  const reuseMode = useFreezeStore((s) => s.reuseMode);
  const setReuseMode = useFreezeStore((s) => s.setReuseMode);

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
      if (activeTeamId !== null) setActiveTeamId("damage", null);
      return;
    }

    if (!teamParamIsValid) {
      if (activeTeamId !== null) setActiveTeamId("damage", null);
      setTeamSearchParam(null);
      return;
    }

    if (activeTeamId !== teamParam) {
      setActiveTeamId("damage", teamParam);
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
      setActiveTeamId("damage", id);
      setTeamSearchParam(id);
    },
    [setActiveTeamId, setTeamSearchParam]
  );

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
      activeTeamId={routedTeamId}
      setActiveTeamId={handleActiveTeamChange}
      renderDetail={(teamComp, setupConfig, onBack) => (
        <DamageDetail
          teamComp={teamComp}
          setupConfig={setupConfig}
          onBack={onBack}
        />
      )}
      enableFreeze
      emptyState={{ importRef }}
      enableTour
      headerExtra={reuseModeRow}
    />
  );
}
