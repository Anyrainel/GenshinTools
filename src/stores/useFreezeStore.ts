import type { ArtifactData, Slot } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FrozenTeam {
  /** Artifact IDs locked by this team's optimization result */
  artifactIds: string[];
  /** Full optimized artifact data per character, for restoring on re-entry */
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FreezeState {
  /** Map of teamId → frozen artifact data */
  frozenTeams: Record<string, FrozenTeam>;

  freezeTeam: (
    teamId: string,
    artifactIds: string[],
    artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
  ) => void;
  unfreezeTeam: (teamId: string) => void;
  clearAll: () => void;
  isFrozen: (teamId: string) => boolean;
  getFrozenTeam: (teamId: string) => FrozenTeam | undefined;
  /** All artifact IDs locked by frozen teams (optionally excluding one team) */
  getFrozenArtifactIds: (excludeTeamId?: string) => Set<string>;
}

export const useFreezeStore = create<FreezeState>()(
  persist(
    (set, get) => ({
      frozenTeams: {},

      freezeTeam: (teamId, artifactIds, artifactsByChar) =>
        set((state) => ({
          frozenTeams: {
            ...state.frozenTeams,
            [teamId]: { artifactIds, artifactsByChar },
          },
        })),

      unfreezeTeam: (teamId) =>
        set((state) => {
          const { [teamId]: _, ...rest } = state.frozenTeams;
          return { frozenTeams: rest };
        }),

      clearAll: () => set({ frozenTeams: {} }),

      isFrozen: (teamId) => teamId in get().frozenTeams,

      getFrozenTeam: (teamId) => get().frozenTeams[teamId],

      getFrozenArtifactIds: (excludeTeamId) => {
        const ids = new Set<string>();
        for (const [tid, entry] of Object.entries(get().frozenTeams)) {
          if (tid === excludeTeamId) continue;
          for (const id of entry.artifactIds) ids.add(id);
        }
        return ids;
      },
    }),
    {
      name: "frozen-teams-storage",
      partialize: (state) => ({
        frozenTeams: state.frozenTeams,
      }),
    }
  )
);
