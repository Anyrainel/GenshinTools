import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { FrozenTeamSection } from "@/components/team-comp/FrozenTeamSection";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Plus, Snowflake } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

export function FrozenView() {
  const { t } = useLanguage();
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const frozenArtifactIds = useFreezeStore((s) => s.frozenArtifactIds);
  const teams = useTeamStore((s) => s.teams);
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;

  // Match frozen teams to team store entries, preserving team store order
  const frozenTeamEntries = useMemo(() => {
    const entries: { teamId: string; team: (typeof teams)[number] }[] = [];
    for (const team of teams) {
      if (frozenTeams[team.id]) {
        entries.push({ teamId: team.id, team });
      }
    }
    return entries;
  }, [teams, frozenTeams]);

  const hasFrozenTeams = frozenTeamEntries.length > 0;
  const hasStandaloneArtifacts = frozenArtifactIds.length > 0;
  const isEmpty = !hasFrozenTeams && !hasStandaloneArtifacts;

  return (
    <ScrollLayout>
      <div className="flex flex-col gap-6 py-2">
        {/* Standalone frozen artifacts section */}
        <div className="bg-black/15 border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-black/20 border-b border-border">
            <Snowflake className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-bold text-sm text-foreground">
              {t.ui("teamComp.standaloneArtifacts")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                toast.info("Artifact freeze dialog coming soon");
              }}
              className="ml-auto h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t.ui("teamComp.freezeArtifact")}
            </Button>
          </div>

          {!hasStandaloneArtifacts && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t.ui("teamComp.frozenEmpty")}
            </div>
          )}

          {/* Future: grid of standalone frozen artifacts with hover cards */}
        </div>

        {/* Per-team frozen sections */}
        {frozenTeamEntries.map(({ teamId, team }) => (
          <FrozenTeamSection
            key={teamId}
            teamId={teamId}
            team={team}
            frozenTeam={frozenTeams[teamId]}
            accountData={accountData}
          />
        ))}

        {/* Empty state — only if no frozen teams AND no standalone section content */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
            <Snowflake className="w-10 h-10 text-cyan-500/30" />
            <p className="text-sm text-muted-foreground">
              {t.ui("teamComp.frozenEmpty")}
            </p>
          </div>
        )}
      </div>
    </ScrollLayout>
  );
}
