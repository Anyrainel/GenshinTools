import type { ArtifactData, CharacterData } from "@/data/types";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useMemo } from "react";

export interface TeamInventory {
  /** All artifacts from the account (equipped + inventory), unfiltered */
  allArtifacts: ArtifactData[];
  /** Artifacts available for optimization/assignment (all frozen excluded) */
  availableArtifacts: ArtifactData[];
  /** All frozen artifact IDs across ALL teams */
  frozenArtifactIds: Set<string>;
}

/**
 * Centralized hook for accessing the artifact inventory with freeze-awareness.
 * Guards against using frozen artifacts across all optimizer features.
 */
export function useTeamInventory(teamId: string): TeamInventory {
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);

  return useMemo(() => {
    if (!accountData) {
      return {
        allArtifacts: [],
        availableArtifacts: [],
        frozenArtifactIds: new Set<string>(),
      };
    }

    const allArtifacts: ArtifactData[] = [
      ...accountData.extraArtifacts,
      ...accountData.characters.flatMap((c: CharacterData) =>
        (
          Object.values(c.artifacts || {}) as (ArtifactData | undefined)[]
        ).filter((a): a is ArtifactData => !!a)
      ),
    ];

    // Collect frozen artifact IDs from ALL teams — these cannot be used anywhere
    const frozenArtifactIds = new Set<string>();
    for (const entry of Object.values(frozenTeams)) {
      if (!entry?.artifactsByChar) continue;
      for (const cid of entry.frozenCharIds ?? []) {
        const arts = entry.artifactsByChar[cid];
        if (!arts) continue;
        for (const art of Object.values(arts)) {
          if (art) frozenArtifactIds.add((art as ArtifactData).id);
        }
      }
    }

    const availableArtifacts = allArtifacts.filter(
      (a) => !frozenArtifactIds.has(a.id)
    );

    return { allArtifacts, availableArtifacts, frozenArtifactIds };
  }, [accountData, frozenTeams]);
}
