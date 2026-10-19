import type { Slot } from "@/domain/enums";
import type { ArtifactData, ArtifactSetConfig } from "@/domain/models";
import { frozenArtifactsMatchConfig } from "./teamConfigUtils";

export type ArtifactInventoryReuseMode = "none" | "sameChar" | "forceReuse";
export interface ReservedArtifactTeam {
  frozenCharIds: string[];
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

export interface TeamInventory {
  /** All artifacts from the account (equipped + inventory), unfiltered */
  allArtifacts: ArtifactData[];
  /** Artifacts available for optimization, excluding frozen allocations. */
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
  frozenTeams: Record<string, ReservedArtifactTeam>;
  reuseMode: ArtifactInventoryReuseMode;
  standaloneFrozenIds: string[];
  teamId: string;
  teamCharacters: (string | null)[];
  teamArtifacts: (ArtifactSetConfig | null)[];
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
  const ownFrozenCharIds = new Set(frozenTeams[teamId]?.frozenCharIds ?? []);

  // Reserve all frozen allocations, including the current team's fixed gear.
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
      // from OTHER teams only; own frozen characters stay fixed.
      if (
        reuseMode !== "none" &&
        tid !== teamId &&
        teamCharIdSet.has(cid) &&
        !ownFrozenCharIds.has(cid) &&
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
