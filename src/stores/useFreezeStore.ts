import type { ArtifactData, Slot } from "@/data/types";
import { allSlots } from "@/data/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { repairArtifact } from "./storeValidation";

export type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

export interface FrozenTeam {
  /** Which character IDs have their artifacts frozen */
  frozenCharIds: string[];
  /** Full optimized artifact data per character, for restoring on re-entry */
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FreezeState {
  /** Map of teamId → frozen data */
  frozenTeams: Record<string, FrozenTeam>;
  /** Controls how frozen artifacts can be reused across teams */
  reuseMode: ArtifactReuseMode;
  /** Individually frozen artifact IDs (not tied to any team) */
  frozenArtifactIds: string[];

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
  setReuseMode: (mode: ArtifactReuseMode) => void;
  /** Freeze a standalone artifact by ID */
  freezeArtifact: (id: string) => void;
  /** Unfreeze a standalone artifact by ID */
  unfreezeArtifact: (id: string) => void;
  /** True if any character in the team is frozen */
  isFrozen: (teamId: string) => boolean;
  /** True if a specific character is frozen within a team */
  isCharFrozen: (teamId: string, charId: string) => boolean;
  /** Get all frozen character IDs for a team */
  getFrozenCharIds: (teamId: string) => string[];
  getFrozenTeam: (teamId: string) => FrozenTeam | undefined;
  /** All artifact IDs locked by frozen characters across teams + standalone frozen artifacts (optionally excluding one team) */
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
      reuseMode: "sameChar" as ArtifactReuseMode,
      frozenArtifactIds: [],

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

      clearAll: () => set({ frozenTeams: {}, frozenArtifactIds: [] }),
      setReuseMode: (mode) => set({ reuseMode: mode }),

      freezeArtifact: (id) =>
        set((state) => {
          if (state.frozenArtifactIds.includes(id)) return state;
          return { frozenArtifactIds: [...state.frozenArtifactIds, id] };
        }),

      unfreezeArtifact: (id) =>
        set((state) => ({
          frozenArtifactIds: state.frozenArtifactIds.filter((a) => a !== id),
        })),

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
        const state = get();
        const ids = new Set<string>();
        // Include standalone frozen artifacts
        for (const id of state.frozenArtifactIds) {
          ids.add(id);
        }
        for (const [tid, entry] of Object.entries(state.frozenTeams)) {
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
      version: 4,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        // v0 → v1: { artifactIds, artifactsByChar } → { frozenCharIds, artifactsByChar }
        if (version < 1) {
          const ft = (state.frozenTeams ?? {}) as Record<
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
          for (const entry of Object.values(ft)) {
            if (!entry.frozenCharIds) {
              entry.frozenCharIds = Object.keys(entry.artifactsByChar);
              entry.artifactIds = undefined;
            }
          }
        }
        // v1 → v2: add allowSameCharReuse (default true)
        if (version < 2) {
          if (!("allowSameCharReuse" in state)) {
            (state as Record<string, unknown>).allowSameCharReuse = true;
          }
        }
        // v2 → v3: allowSameCharReuse → reuseMode
        if (version < 3) {
          const legacy = state as Record<string, unknown>;
          legacy.reuseMode =
            legacy.allowSameCharReuse === false ? "none" : "sameChar";
          legacy.allowSameCharReuse = undefined;
        }
        // v3 → v4: add frozenArtifactIds
        if (version < 4) {
          if (!Array.isArray(state.frozenArtifactIds)) {
            state.frozenArtifactIds = [];
          }
        }
        return state as unknown as FreezeState;
      },
      partialize: (state) => ({
        frozenTeams: state.frozenTeams,
        reuseMode: state.reuseMode,
        frozenArtifactIds: state.frozenArtifactIds,
      }),
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as object),
        } as FreezeState;
        // Validate all frozen artifacts on every rehydration
        for (const entry of Object.values(merged.frozenTeams)) {
          if (!entry?.artifactsByChar) continue;
          for (const slotMap of Object.values(entry.artifactsByChar)) {
            for (const slot of allSlots) {
              const art = slotMap[slot];
              if (art) repairArtifact(art);
            }
          }
        }
        return merged;
      },
    }
  )
);
