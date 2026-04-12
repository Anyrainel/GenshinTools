import type { ArtifactConfig } from "@/components/shared/ItemPicker";
import type { ArtifactData, CharacterData, Slot } from "@/data/types";
import { frozenArtifactsMatchConfig } from "@/lib/team-comp/teamOptUtils";
import { getActiveAccount, useAccountStore } from "@/stores/useAccountStore";
import type { ArtifactReuseMode, FrozenTeam } from "@/stores/useFreezeStore";
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
  /** Characters whose artifacts are force-reused (forceReuse mode + set match) */
  forceReuseChars: Record<string, Record<Slot, ArtifactData | null>>;
}

/** Input parameters for the pure inventory computation. */
export interface ComputeInventoryParams {
  allArtifacts: ArtifactData[];
  frozenTeams: Record<string, FrozenTeam>;
  reuseMode: ArtifactReuseMode;
  standaloneFrozenIds: string[];
  teamId: string;
  teamCharacters: (string | null)[];
  teamArtifacts: (ArtifactConfig | null)[];
}

/**
 * Pure function that computes the freeze-filtered inventory.
 * Extracted from the hook for testability.
 *
 * reuseMode behavior:
 * - "none": no reuse of frozen artifacts
 * - "sameChar": frozen artifacts from other teams are available per-character
 * - "forceReuse": same as sameChar, plus characters with matching set configs
 *   are force-reused (their artifacts are locked without BnB optimization)
 */
export function computeTeamInventory(
  params: ComputeInventoryParams
): Omit<TeamInventory, "allArtifacts"> {
  const {
    allArtifacts,
    frozenTeams,
    reuseMode,
    standaloneFrozenIds,
    teamId,
    teamCharacters,
    teamArtifacts,
  } = params;

  // Build the set of character IDs in the current team
  const teamCharIdSet = new Set(
    teamCharacters.filter((id): id is string => id != null)
  );

  // Collect frozen artifact IDs from ALL teams + standalone — these are excluded from the shared pool
  const frozenArtifactIds = new Set<string>(standaloneFrozenIds);
  // Per-character extras: frozen artifacts from OTHER teams for characters in this team
  const perCharExtraArtifacts: Record<string, ArtifactData[]> = {};
  // forceReuse: chars from other teams whose frozen artifacts match the current team's config
  const forceReuseChars: Record<string, Record<Slot, ArtifactData | null>> = {};

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
        reuseMode !== "none" &&
        tid !== teamId &&
        teamCharIdSet.has(cid) &&
        charArtifacts.length > 0
      ) {
        const existing = perCharExtraArtifacts[cid];
        if (existing) {
          existing.push(...charArtifacts);
        } else {
          perCharExtraArtifacts[cid] = [...charArtifacts];
        }

        // forceReuse: check if the frozen artifacts match the current team's config
        if (reuseMode === "forceReuse" && !(cid in forceReuseChars)) {
          const charIdx = teamCharacters.indexOf(cid);
          const goalConfig = charIdx >= 0 ? teamArtifacts[charIdx] : null;
          if (
            goalConfig &&
            frozenArtifactsMatchConfig(
              arts as Record<Slot, ArtifactData | null>,
              goalConfig
            )
          ) {
            forceReuseChars[cid] = arts as Record<Slot, ArtifactData | null>;
          }
        }
      }
    }
  }

  const availableArtifacts = allArtifacts.filter(
    (a) => !frozenArtifactIds.has(a.id)
  );

  return {
    availableArtifacts,
    frozenArtifactIds,
    perCharExtraArtifacts,
    forceReuseChars,
  };
}

/**
 * Centralized hook for accessing the artifact inventory with freeze-awareness.
 * Guards against using frozen artifacts across all optimizer features.
 */
export function useTeamInventory(teamId: string): TeamInventory {
  const activeAccount = useAccountStore(getActiveAccount);
  const accountData = activeAccount?.data || null;
  const frozenTeams = useFreezeStore((s) => s.frozenTeams);
  const reuseMode = useFreezeStore((s) => s.reuseMode);
  const standaloneFrozenIds = useFreezeStore((s) => s.frozenArtifactIds);
  const team = useTeamStore((s) => s.getTeamById(teamId));
  const teamCharacters = team?.characters;
  const teamArtifacts = team?.artifacts;

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
      teamArtifacts: (teamArtifacts ?? []) as (ArtifactConfig | null)[],
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
