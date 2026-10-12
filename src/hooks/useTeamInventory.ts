import { useMemo } from "react";
import type {
  ArtifactData,
  ArtifactSetConfig,
  CharacterData,
} from "@/domain/models";
import {
  computeTeamInventory,
  type TeamInventory,
} from "@/domain/team/artifactInventory";
import { teamCompToArrays } from "@/domain/team/teamDeltas";
import { useActiveAccountData } from "@/hooks/useActiveAccount";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useTeamStore } from "@/stores/useTeamStore";

/**
 * Centralized hook for accessing the artifact inventory with freeze-awareness.
 * Guards against using frozen artifacts across all optimizer features.
 */
export function useTeamInventory(teamId: string): TeamInventory {
  const accountData = useActiveAccountData();
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const reuseMode = useFreezeStore((s) => s.reuseMode);
  const standaloneFrozenIds = useFreezeStore((s) => s.frozenArtifactIds);
  const teamComp = useTeamStore((s) => s.getTeamCompById(teamId));
  const teamArrays = useMemo(
    () => (teamComp ? teamCompToArrays(teamComp) : null),
    [teamComp]
  );
  const teamCharacters = teamArrays?.characters;
  const teamArtifacts = teamArrays?.artifacts;

  return useMemo(() => {
    if (!accountData) {
      return {
        allArtifacts: [],
        availableArtifacts: [],
        frozenArtifactIds: new Set<string>(),
        perCharExtraArtifacts: {},
        forceReuseChars: {},
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

    const result = computeTeamInventory({
      allArtifacts,
      frozenTeams,
      reuseMode,
      standaloneFrozenIds,
      teamId,
      teamCharacters: teamCharacters ?? [],
      teamArtifacts: (teamArtifacts ?? []) as (ArtifactSetConfig | null)[],
    });

    return {
      allArtifacts,
      ...result,
    };
  }, [
    accountData,
    frozenTeams,
    reuseMode,
    standaloneFrozenIds,
    teamCharacters,
    teamArtifacts,
    teamId,
  ]);
}
