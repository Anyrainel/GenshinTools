import type { ArtifactData, CharacterData } from "@/data/types";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useMemo } from "react";

export interface TeamInventory {
  /** All artifacts from the account (equipped + inventory), unfiltered */
  allArtifacts: ArtifactData[];
  /** Artifacts available for optimization/assignment (all frozen excluded) */
  availableArtifacts: ArtifactData[];
  /** All frozen artifact IDs across ALL teams */
  frozenArtifactIds: Set<string>;
  /**
   * Per-character extra artifacts from same-char frozen reuse.
   * These are NOT in availableArtifacts — they must be injected per-character
   * into the optimizer so only the owning character can use them.
   */
  perCharExtraArtifacts: Record<string, ArtifactData[]>;
}

/**
 * Centralized hook for accessing the artifact inventory with freeze-awareness.
 * Guards against using frozen artifacts across all optimizer features.
 *
 * When `allowSameCharReuse` is enabled, artifacts frozen for character X in
 * another team are returned via `perCharExtraArtifacts[X]` so the optimizer
 * can inject them into only that character's BnB search.
 */
export function useTeamInventory(teamId: string): TeamInventory {
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const allowSameCharReuse = useFreezeStore((s) => s.allowSameCharReuse);
  const teamCharacters = useTeamStore(
    (s) => s.teams.find((t) => t.id === teamId)?.characters
  );

  return useMemo(() => {
    if (!accountData) {
      return {
        allArtifacts: [],
        availableArtifacts: [],
        frozenArtifactIds: new Set<string>(),
        perCharExtraArtifacts: {},
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

    // Build the set of character IDs in the current team
    const teamCharIdSet = new Set(
      (teamCharacters ?? []).filter((id): id is string => id != null)
    );

    // Collect frozen artifact IDs from ALL teams — these are excluded from the shared pool
    const frozenArtifactIds = new Set<string>();
    // Per-character extras: frozen artifacts from OTHER teams for characters in this team
    const perCharExtraArtifacts: Record<string, ArtifactData[]> = {};

    for (const [tid, entry] of Object.entries(frozenTeams)) {
      if (!entry?.artifactsByChar) continue;
      for (const cid of entry.frozenCharIds ?? []) {
        const arts = entry.artifactsByChar[cid];
        if (!arts) continue;

        // Always add to frozenArtifactIds (excluded from shared pool)
        const charArtifacts: ArtifactData[] = [];
        for (const art of Object.values(arts)) {
          if (art) {
            frozenArtifactIds.add((art as ArtifactData).id);
            charArtifacts.push(art as ArtifactData);
          }
        }

        // Same-char reuse: collect extras for characters in THIS team
        // from OTHER teams only (same-team frozen chars stay fully locked)
        if (
          allowSameCharReuse &&
          tid !== teamId &&
          teamCharIdSet.has(cid) &&
          charArtifacts.length > 0
        ) {
          const existing = perCharExtraArtifacts[cid];
          if (existing) {
            existing.push(...charArtifacts);
          } else {
            perCharExtraArtifacts[cid] = charArtifacts;
          }
        }
      }
    }

    const availableArtifacts = allArtifacts.filter(
      (a) => !frozenArtifactIds.has(a.id)
    );

    return {
      allArtifacts,
      availableArtifacts,
      frozenArtifactIds,
      perCharExtraArtifacts,
    };
  }, [accountData, frozenTeams, allowSameCharReuse, teamCharacters, teamId]);
}
