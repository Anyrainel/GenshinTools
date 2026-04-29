import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData } from "@/data/types";
import { migrateFreezeStore } from "./migration/freeze";
import { PersistedFreezeStoreSchema } from "./schemas";
import { getActiveAccount, useAccountStore } from "./useAccountStore";

/** Collect all artifact IDs from account data. */
export function collectAllArtifactIds(data: AccountData): Set<string> {
  const ids = new Set<string>();
  for (const c of data.characters) {
    for (const art of Object.values(c.artifacts)) {
      if (art) ids.add((art as ArtifactData).id);
    }
  }
  for (const art of data.extraArtifacts) {
    ids.add(art.id);
  }
  return ids;
}

/**
 * Remap freeze store artifact IDs before saving new account data.
 * Must be called BEFORE addOrUpdateAccount — the auto-validation subscriber
 * (see bottom of file) handles validation during the save.
 */
export function remapFreezeStoreForImport(
  artifactIdMap?: Map<string, string>
): void {
  if (artifactIdMap && artifactIdMap.size > 0) {
    useFreezeStore.getState().remapArtifactIds(artifactIdMap);
  }
}

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
  /** Remap frozen artifact IDs using an old→new mapping from ID reassignment.
   *  IDs mapped to "" are treated as orphaned and removed. */
  remapArtifactIds: (mapping: Map<string, string>) => void;
  /** Remove any frozen artifact IDs that don't exist in the given set. */
  validateFrozenArtifacts: (allArtifactIds: Set<string>) => void;
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

      remapArtifactIds: (mapping) =>
        set((state) => {
          if (mapping.size === 0) return state;

          // Remap standalone frozen artifact IDs
          const newFrozenArtifactIds = state.frozenArtifactIds
            .map((id) => mapping.get(id) ?? id)
            .filter((id) => id !== "");

          // Remap team frozen artifacts
          const newFrozenTeams: Record<string, FrozenTeam> = {};
          for (const [teamId, team] of Object.entries(state.frozenTeams)) {
            const newArtifactsByChar: Record<
              string,
              Record<Slot, ArtifactData | null>
            > = {};
            let hasAnyArtifact = false;
            for (const [charId, arts] of Object.entries(team.artifactsByChar)) {
              const newArts = {} as Record<Slot, ArtifactData | null>;
              for (const slot of allSlots) {
                const art = arts[slot];
                if (art) {
                  const newId = mapping.get(art.id);
                  if (newId === "") {
                    newArts[slot] = null;
                  } else {
                    newArts[slot] =
                      newId !== undefined ? { ...art, id: newId } : art;
                    hasAnyArtifact = true;
                  }
                } else {
                  newArts[slot] = null;
                }
              }
              newArtifactsByChar[charId] = newArts;
            }
            // Only keep team entries that still have artifacts
            if (hasAnyArtifact) {
              // Clean up frozenCharIds — remove chars with no artifacts
              const activeCharIds = team.frozenCharIds.filter((cid) => {
                const arts = newArtifactsByChar[cid];
                return arts && allSlots.some((slot) => arts[slot] != null);
              });
              if (activeCharIds.length > 0) {
                newFrozenTeams[teamId] = {
                  frozenCharIds: activeCharIds,
                  artifactsByChar: newArtifactsByChar,
                };
              }
            }
          }

          return {
            frozenArtifactIds: newFrozenArtifactIds,
            frozenTeams: newFrozenTeams,
          };
        }),

      validateFrozenArtifacts: (allArtifactIds) =>
        set((state) => {
          // Remove standalone frozen IDs that don't exist
          const newFrozenArtifactIds = state.frozenArtifactIds.filter((id) =>
            allArtifactIds.has(id)
          );

          // Validate team frozen artifacts
          const newFrozenTeams: Record<string, FrozenTeam> = {};
          let changed =
            newFrozenArtifactIds.length !== state.frozenArtifactIds.length;

          for (const [teamId, team] of Object.entries(state.frozenTeams)) {
            const newArtifactsByChar: Record<
              string,
              Record<Slot, ArtifactData | null>
            > = {};
            for (const [charId, arts] of Object.entries(team.artifactsByChar)) {
              const newArts = {} as Record<Slot, ArtifactData | null>;
              for (const slot of allSlots) {
                const art = arts[slot];
                if (art && allArtifactIds.has(art.id)) {
                  newArts[slot] = art;
                } else {
                  if (art) changed = true;
                  newArts[slot] = null;
                }
              }
              newArtifactsByChar[charId] = newArts;
            }

            // Clean up chars with no artifacts
            const activeCharIds = team.frozenCharIds.filter((cid) => {
              const arts = newArtifactsByChar[cid];
              return arts && allSlots.some((slot) => arts[slot] != null);
            });
            if (activeCharIds.length > 0) {
              newFrozenTeams[teamId] = {
                frozenCharIds: activeCharIds,
                artifactsByChar: newArtifactsByChar,
              };
            } else if (team.frozenCharIds.length > 0) {
              changed = true;
            }
          }

          if (!changed) return state;

          return {
            frozenArtifactIds: newFrozenArtifactIds,
            frozenTeams: newFrozenTeams,
          };
        }),
    }),
    {
      name: "frozen-teams-storage",
      version: 4,
      migrate: migrateFreezeStore,
      partialize: (state) => ({
        frozenTeams: state.frozenTeams,
        reuseMode: state.reuseMode,
        frozenArtifactIds: state.frozenArtifactIds,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedFreezeStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : {};
        return { ...currentState, ...persisted };
      },
    }
  )
);

// ─── Auto-validation subscriber ──────────────────────────────────────────────
// Validates frozen artifact IDs against live account data whenever the active
// account's data changes. This is the centralized defense that catches ALL
// mutation paths — character edits, artifact deletions, imports, merges,
// scanner snapshots — without requiring each caller to manually trigger
// validation. No code path can bypass this.
let _prevAccountData: AccountData | null | undefined;
useAccountStore.subscribe((state) => {
  const data = getActiveAccount(state)?.data;
  if (data && data !== _prevAccountData) {
    _prevAccountData = data;
    useFreezeStore
      .getState()
      .validateFrozenArtifacts(collectAllArtifactIds(data));
  } else if (!data) {
    _prevAccountData = data;
  }
});
