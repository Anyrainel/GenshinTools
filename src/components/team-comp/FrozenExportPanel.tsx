import { ExportBranding } from "@/components/shared/ExportBranding";
import { ExportColumn } from "@/components/team-comp/SwapGuide";
import type { useLanguage } from "@/contexts/LanguageContext";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import { buildArtifactOwnerMap } from "@/lib/artifact/inventory";
import type { Team } from "@/lib/team-comp/types";
import type { FrozenTeam } from "@/stores/useFreezeStore";
import { forwardRef } from "react";

interface FrozenExportPanelProps {
  entries: {
    teamId: string;
    team: Team;
  }[];
  frozenTeams: Record<string, FrozenTeam>;
  accountData: AccountData | null;
  isXl: boolean;
  t: ReturnType<typeof useLanguage>["t"];
}

export const FrozenExportPanel = forwardRef<
  HTMLDivElement,
  FrozenExportPanelProps
>(function FrozenExportPanel(
  { entries, frozenTeams, accountData, isXl, t },
  ref
) {
  return (
    <div style={{ position: "fixed", left: -9999, top: 0 }} aria-hidden="true">
      <div ref={ref} className="p-1" style={{ width: isXl ? 1400 : 700 }}>
        <ExportBranding />
        {entries.map((entry, i) => {
          const ownerMap = buildArtifactOwnerMap(accountData);
          const charIds = entry.team.characters.filter(
            (id): id is string => id != null
          );
          const optimizedArts =
            frozenTeams[entry.teamId]?.artifactsByChar ?? {};
          return (
            <div key={entry.team.id}>
              {i > 0 && <div className="h-px bg-border/20" />}
              {entry.team.name && (
                <div className="text-center py-1.5 text-sm font-bold text-foreground/90 bg-black/20">
                  {entry.team.name}
                </div>
              )}
              <div className="grid grid-cols-4 gap-px bg-border/10">
                {charIds.map((charId) => {
                  const acctChar = accountData?.characters.find(
                    (c: CharacterData) => c.key === charId
                  );
                  const equipped = (acctChar?.artifacts || {}) as Record<
                    string,
                    ArtifactData
                  >;
                  const optimizedRaw = optimizedArts[charId] ?? {};
                  const optimized: Record<string, ArtifactData> = {};
                  for (const [slot, art] of Object.entries(optimizedRaw)) {
                    if (art) optimized[slot] = art;
                  }
                  return (
                    <ExportColumn
                      key={charId}
                      charId={charId}
                      team={entry.team}
                      equipped={equipped}
                      optimized={optimized}
                      ownerMap={ownerMap}
                      accountData={accountData}
                      t={t}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
