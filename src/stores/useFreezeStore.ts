import type { ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FrozenTeam {
  /** Which character IDs have their artifacts frozen */
  frozenCharIds: string[];
  /** Full optimized artifact data per character, for restoring on re-entry */
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FreezeState {
  /** Map of teamId → frozen data */
  frozenTeams: Record<string, FrozenTeam>;

  /** Freeze specific characters within a team */
  freezeCharacters: (
    teamId: string,
    charIds: string[],
    artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
  ) => void;
  /** Unfreeze specific characters within a team (removes team entry if none left) */
  unfreezeCharacters: (teamId: string, charIds: string[]) => void;
  /** Remove the entire team's freeze entry */
  unfreezeTeam: (teamId: string) => void;
  clearAll: () => void;
  /** True if any character in the team is frozen */
  isFrozen: (teamId: string) => boolean;
  /** True if a specific character is frozen within a team */
  isCharFrozen: (teamId: string, charId: string) => boolean;
  /** Get all frozen character IDs for a team */
  getFrozenCharIds: (teamId: string) => string[];
  getFrozenTeam: (teamId: string) => FrozenTeam | undefined;
  /** All artifact IDs locked by frozen characters across teams (optionally excluding one team) */
  getFrozenArtifactIds: (excludeTeamId?: string) => Set<string>;
}

/** Collect artifact IDs from a specific set of characters. */
function collectCharArtifactIds(
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>,
  charIds: string[]
): string[] {
  const ids: string[] = [];
  for (const cid of charIds) {
    const arts = artifactsByChar[cid];
    if (!arts) continue;
    for (const slot of allSlots) {
      const a = arts[slot];
      if (a) ids.push(a.id);
    }
  }
  return ids;
}

export const useFreezeStore = create<FreezeState>()(
  persist(
    (set, get) => ({
      frozenTeams: {},

      freezeCharacters: (teamId, charIds, artifactsByChar) =>
        set((state) => {
          const existing = state.frozenTeams[teamId];
          // Merge with existing: keep already-frozen chars, add new ones
          const prevFrozen = existing?.frozenCharIds ?? [];
          const mergedCharIds = Array.from(
            new Set([...prevFrozen, ...charIds])
          );
          const mergedArtifacts = {
            ...(existing?.artifactsByChar ?? {}),
            ...artifactsByChar,
          };
          return {
            frozenTeams: {
              ...state.frozenTeams,
              [teamId]: {
                frozenCharIds: mergedCharIds,
                artifactsByChar: mergedArtifacts,
              },
            },
          };
        }),

      unfreezeCharacters: (teamId, charIds) =>
        set((state) => {
          const existing = state.frozenTeams[teamId];
          if (!existing) return state;
          const charSet = new Set(charIds);
          const remaining = existing.frozenCharIds.filter(
            (id) => !charSet.has(id)
          );
          if (remaining.length === 0) {
            const { [teamId]: _, ...rest } = state.frozenTeams;
            return { frozenTeams: rest };
          }
          return {
            frozenTeams: {
              ...state.frozenTeams,
              [teamId]: {
                ...existing,
                frozenCharIds: remaining,
              },
            },
          };
        }),

      unfreezeTeam: (teamId) =>
        set((state) => {
          const { [teamId]: _, ...rest } = state.frozenTeams;
          return { frozenTeams: rest };
        }),

      clearAll: () => set({ frozenTeams: {} }),

      isFrozen: (teamId) => {
        const entry = get().frozenTeams[teamId];
        return entry != null && (entry.frozenCharIds?.length ?? 0) > 0;
      },

      isCharFrozen: (teamId, charId) => {
        const entry = get().frozenTeams[teamId];
        return entry?.frozenCharIds?.includes(charId) ?? false;
      },

      getFrozenCharIds: (teamId) => {
        const entry = get().frozenTeams[teamId];
        return entry?.frozenCharIds ?? [];
      },

      getFrozenTeam: (teamId) => get().frozenTeams[teamId],

      getFrozenArtifactIds: (excludeTeamId) => {
        const ids = new Set<string>();
        for (const [tid, entry] of Object.entries(get().frozenTeams)) {
          if (tid === excludeTeamId) continue;
          const charIds = entry.frozenCharIds ?? [];
          // Only include artifacts belonging to frozen characters
          for (const id of collectCharArtifactIds(
            entry.artifactsByChar,
            charIds
          )) {
            ids.add(id);
          }
        }
        return ids;
      },
    }),
    {
      name: "frozen-teams-storage",
      // Migrate old shape: { artifactIds, artifactsByChar } → { frozenCharIds, artifactsByChar }
      version: 1,
      migrate: (persisted: unknown) => {
        const state = persisted as {
          frozenTeams: Record<
            string,
            {
              artifactIds?: string[];
              frozenCharIds?: string[];
              artifactsByChar: Record<
                string,
                Record<Slot, ArtifactData | null>
              >;
            }
          >;
        };
        for (const entry of Object.values(state.frozenTeams)) {
          if (!entry.frozenCharIds) {
            // Old format: derive frozenCharIds from artifactsByChar keys
            entry.frozenCharIds = Object.keys(entry.artifactsByChar);
            entry.artifactIds = undefined;
          }
        }
        return state as FreezeState;
      },
      partialize: (state) => ({
        frozenTeams: state.frozenTeams,
      }),
    }
  )
);
