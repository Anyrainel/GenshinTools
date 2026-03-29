import { ArtifactDataHoverCard } from "@/components/account-data/ArtifactDataHoverCard";
import { ScrollLayout } from "@/components/layout/ScrollLayout";
import { ItemIcon } from "@/components/shared/ItemIcon";
import { ArtifactFreezeDialog } from "@/components/team-comp/ArtifactFreezeDialog";
import { FrozenTeamSection } from "@/components/team-comp/FrozenTeamSection";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { cn, getRarityColor } from "@/lib/utils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { Plus, Snowflake, X } from "lucide-react";
import { useMemo, useState } from "react";

export function FrozenView() {
  const { t } = useLanguage();
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const frozenArtifactIds = useFreezeStore((s) => s.frozenArtifactIds);
  const unfreezeArtifact = useFreezeStore((s) => s.unfreezeArtifact);
  const teams = useTeamStore((s) => s.teams);
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);

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

  // Resolve standalone frozen artifact IDs to actual artifact data
  const standaloneArtifacts = useMemo(() => {
    if (!accountData || frozenArtifactIds.length === 0) return [];
    // Build a lookup of all artifacts in the account
    const byId = new Map<string, { art: ArtifactData; slot: Slot }>();
    for (const char of accountData.characters) {
      for (const slot of allSlots) {
        const art = char.artifacts[slot];
        if (art) byId.set(art.id, { art, slot });
      }
    }
    for (const art of accountData.extraArtifacts) {
      byId.set(art.id, { art, slot: art.slotKey as Slot });
    }
    // Resolve each frozen ID
    const result: { art: ArtifactData; slot: Slot }[] = [];
    for (const id of frozenArtifactIds) {
      const entry = byId.get(id);
      if (entry) result.push(entry);
    }
    return result;
  }, [accountData, frozenArtifactIds]);

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
              onClick={() => setFreezeDialogOpen(true)}
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

          {/* Grid of standalone frozen artifacts */}
          {standaloneArtifacts.length > 0 && (
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {standaloneArtifacts.map(({ art, slot }) => (
                <ArtifactDataHoverCard
                  key={art.id}
                  artifact={art}
                  slot={slot}
                  side="top"
                >
                  <div
                    className={cn(
                      "relative group flex flex-col items-center gap-1.5 p-2 rounded-lg",
                      "border border-sky-800/40 bg-sky-950/15 hover:bg-sky-950/25 transition-colors cursor-pointer"
                    )}
                  >
                    <ItemIcon
                      artifactSetId={art.setKey}
                      slot={slot}
                      rarity={art.rarity}
                      lock={art.lock}
                      level={`+${art.level}`}
                      badge={art.astralMark ? "⭐" : undefined}
                      size="md"
                    />
                    <div className="text-center min-w-0 w-full">
                      <div
                        className={cn(
                          "text-xs font-bold truncate",
                          getRarityColor(art.rarity, "text")
                        )}
                      >
                        {t.artifact(art.setKey)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t.statShort(art.mainStatKey)}
                      </div>
                    </div>
                    {/* Unfreeze button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        unfreezeArtifact(art.id);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-muted-foreground hover:text-red-400 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Unfreeze"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {/* Frozen indicator */}
                    <Snowflake className="absolute top-1 left-1 w-3 h-3 text-sky-400/60" />
                  </div>
                </ArtifactDataHoverCard>
              ))}
            </div>
          )}
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

      <ArtifactFreezeDialog
        open={freezeDialogOpen}
        onOpenChange={setFreezeDialogOpen}
      />
    </ScrollLayout>
  );
}
