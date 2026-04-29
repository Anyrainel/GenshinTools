import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Slot } from "@/data/enums";
import { allSlots } from "@/data/enums";
import type { AccountData, ArtifactData } from "@/data/types";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";
import type { AccountProfileId } from "@/lib/account-data/types";
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
  artifactIdMap?: Map<string, string>,
  profileId?: AccountProfileId
): void {
  if (artifactIdMap && artifactIdMap.size > 0) {
    useFreezeStore.getState().remapArtifactIds(artifactIdMap, profileId);
  }
}

export type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

export interface FrozenTeam {
  /** Which character IDs have their artifacts frozen */
  frozenCharIds: string[];
  /** Full optimized artifact data per character, for restoring on re-entry */
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FrozenProfileState {
  /** Map of teamId → frozen data */
  frozenTeams: Record<string, FrozenTeam>;
  /** Controls how frozen artifacts can be reused across teams */
  reuseMode: ArtifactReuseMode;
  /** Individually frozen artifact IDs (not tied to any team) */
  frozenArtifactIds: string[];
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
  remapArtifactIds: (
    mapping: Map<string, string>,
    profileId?: AccountProfileId
  ) => void;
  /** Remove any frozen artifact IDs that don't exist in the given set. */
  validateFrozenArtifacts: (
    allArtifactIds: Set<string>,
    profileId?: AccountProfileId | null
  ) => void;
  /** All per-account frozen state. Top-level fields mirror the active profile. */
  freezesByProfileId: Record<AccountProfileId, FrozenProfileState>;
  setActiveProfile: (profileId: AccountProfileId | null) => void;
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

const cloneDefaultProfileState = (): FrozenProfileState => ({
  frozenTeams: {},
  reuseMode: "sameChar",
  frozenArtifactIds: [],
});

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

const currentProfileState = (state: FreezeState): FrozenProfileState => ({
  frozenTeams: state.frozenTeams,
  reuseMode: state.reuseMode,
  frozenArtifactIds: state.frozenArtifactIds,
});

const applyProfileState = (profile: FrozenProfileState) => ({
  frozenTeams: profile.frozenTeams,
  reuseMode: profile.reuseMode,
  frozenArtifactIds: profile.frozenArtifactIds,
});

const getStoredProfileState = (
  state: Pick<
    FreezeState,
    "freezesByProfileId" | "frozenTeams" | "reuseMode" | "frozenArtifactIds"
  >,
  profileId: AccountProfileId | null | undefined
): FrozenProfileState =>
  state.freezesByProfileId[profileId ?? DEFAULT_ACCOUNT_PROFILE_ID] ??
  cloneDefaultProfileState();

const getProfileState = (
  state: FreezeState,
  profileId: AccountProfileId | null | undefined
): FrozenProfileState =>
  (profileId ?? DEFAULT_ACCOUNT_PROFILE_ID) === getActiveProfileId()
    ? currentProfileState(state)
    : getStoredProfileState(state, profileId);

const updateProfileState = (
  state: FreezeState,
  profileId: AccountProfileId,
  profile: FrozenProfileState
) => ({
  ...(profileId === getActiveProfileId() ? applyProfileState(profile) : {}),
  freezesByProfileId: {
    ...state.freezesByProfileId,
    [profileId]: profile,
  },
});

const remapProfileArtifacts = (
  profile: FrozenProfileState,
  mapping: Map<string, string>
): FrozenProfileState => {
  const frozenArtifactIds = profile.frozenArtifactIds
    .map((id) => mapping.get(id) ?? id)
    .filter((id) => id !== "");

  const frozenTeams: Record<string, FrozenTeam> = {};
  for (const [teamId, team] of Object.entries(profile.frozenTeams)) {
    const artifactsByChar: Record<
      string,
      Record<Slot, ArtifactData | null>
    > = {};
    let hasAnyArtifact = false;
    for (const [charId, arts] of Object.entries(team.artifactsByChar)) {
      const nextArts = {} as Record<Slot, ArtifactData | null>;
      for (const slot of allSlots) {
        const art = arts[slot];
        if (art) {
          const newId = mapping.get(art.id);
          if (newId === "") {
            nextArts[slot] = null;
          } else {
            nextArts[slot] = newId !== undefined ? { ...art, id: newId } : art;
            hasAnyArtifact = true;
          }
        } else {
          nextArts[slot] = null;
        }
      }
      artifactsByChar[charId] = nextArts;
    }
    if (!hasAnyArtifact) continue;

    const frozenCharIds = team.frozenCharIds.filter((cid) => {
      const arts = artifactsByChar[cid];
      return arts && allSlots.some((slot) => arts[slot] != null);
    });
    if (frozenCharIds.length > 0) {
      frozenTeams[teamId] = { frozenCharIds, artifactsByChar };
    }
  }

  return { ...profile, frozenArtifactIds, frozenTeams };
};

const validateProfileArtifacts = (
  profile: FrozenProfileState,
  allArtifactIds: Set<string>
): FrozenProfileState => {
  const frozenArtifactIds = profile.frozenArtifactIds.filter((id) =>
    allArtifactIds.has(id)
  );

  const frozenTeams: Record<string, FrozenTeam> = {};
  let changed = frozenArtifactIds.length !== profile.frozenArtifactIds.length;

  for (const [teamId, team] of Object.entries(profile.frozenTeams)) {
    const artifactsByChar: Record<
      string,
      Record<Slot, ArtifactData | null>
    > = {};
    for (const [charId, arts] of Object.entries(team.artifactsByChar)) {
      const nextArts = {} as Record<Slot, ArtifactData | null>;
      for (const slot of allSlots) {
        const art = arts[slot];
        if (art && allArtifactIds.has(art.id)) {
          nextArts[slot] = art;
        } else {
          if (art) changed = true;
          nextArts[slot] = null;
        }
      }
      artifactsByChar[charId] = nextArts;
    }

    const frozenCharIds = team.frozenCharIds.filter((cid) => {
      const arts = artifactsByChar[cid];
      return arts && allSlots.some((slot) => arts[slot] != null);
    });
    if (frozenCharIds.length > 0) {
      frozenTeams[teamId] = { frozenCharIds, artifactsByChar };
    } else if (team.frozenCharIds.length > 0) {
      changed = true;
    }
  }

  return changed ? { ...profile, frozenArtifactIds, frozenTeams } : profile;
};

export const useFreezeStore = create<FreezeState>()(
  persist(
    (set, get) => ({
      frozenTeams: {},
      reuseMode: "sameChar" as ArtifactReuseMode,
      frozenArtifactIds: [],
      freezesByProfileId: {
        [DEFAULT_ACCOUNT_PROFILE_ID]: cloneDefaultProfileState(),
      },

      freezeCharacters: (teamId, charIds, artifactsByChar) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          const existing = profile.frozenTeams[teamId];
          // Merge with existing: keep already-frozen chars, add new ones
          const prevFrozen = existing?.frozenCharIds ?? [];
          const mergedCharIds = Array.from(
            new Set([...prevFrozen, ...charIds])
          );
          const mergedArtifacts = {
            ...(existing?.artifactsByChar ?? {}),
            ...artifactsByChar,
          };
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeams: {
              ...profile.frozenTeams,
              [teamId]: {
                frozenCharIds: mergedCharIds,
                artifactsByChar: mergedArtifacts,
              },
            },
          });
        }),

      unfreezeCharacters: (teamId, charIds) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          const existing = profile.frozenTeams[teamId];
          if (!existing) return state;
          const charSet = new Set(charIds);
          const remaining = existing.frozenCharIds.filter(
            (id) => !charSet.has(id)
          );
          if (remaining.length === 0) {
            const { [teamId]: _, ...rest } = profile.frozenTeams;
            return updateProfileState(state, profileId, {
              ...profile,
              frozenTeams: rest,
            });
          }
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeams: {
              ...profile.frozenTeams,
              [teamId]: {
                ...existing,
                frozenCharIds: remaining,
              },
            },
          });
        }),

      unfreezeTeam: (teamId) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          const { [teamId]: _, ...rest } = profile.frozenTeams;
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeams: rest,
          });
        }),

      clearAll: () =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeams: {},
            frozenArtifactIds: [],
          });
        }),
      setReuseMode: (mode) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          return updateProfileState(state, profileId, {
            ...profile,
            reuseMode: mode,
          });
        }),

      freezeArtifact: (id) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          if (profile.frozenArtifactIds.includes(id)) return state;
          return updateProfileState(state, profileId, {
            ...profile,
            frozenArtifactIds: [...profile.frozenArtifactIds, id],
          });
        }),

      unfreezeArtifact: (id) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          return updateProfileState(state, profileId, {
            ...profile,
            frozenArtifactIds: profile.frozenArtifactIds.filter(
              (a) => a !== id
            ),
          });
        }),

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

      remapArtifactIds: (mapping, profileId) =>
        set((state) => {
          if (mapping.size === 0) return state;
          const targetProfileId = profileId ?? getActiveProfileId();
          const profile = getProfileState(state, targetProfileId);
          return updateProfileState(
            state,
            targetProfileId,
            remapProfileArtifacts(profile, mapping)
          );
        }),

      validateFrozenArtifacts: (allArtifactIds, profileId) =>
        set((state) => {
          const targetProfileId = profileId ?? getActiveProfileId();
          const profile = getProfileState(state, targetProfileId);
          const validated = validateProfileArtifacts(profile, allArtifactIds);
          if (validated === profile) return state;
          return updateProfileState(state, targetProfileId, validated);
        }),

      setActiveProfile: (profileId) =>
        set((state) =>
          applyProfileState(getStoredProfileState(state, profileId))
        ),
    }),
    {
      name: "frozen-teams-storage",
      version: 5,
      migrate: migrateFreezeStore,
      partialize: (state) => ({
        frozenTeams: state.frozenTeams,
        reuseMode: state.reuseMode,
        frozenArtifactIds: state.frozenArtifactIds,
        freezesByProfileId: state.freezesByProfileId,
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedFreezeStoreSchema.safeParse(persistedState);
        const persisted = parsed.success ? parsed.data : null;
        const fallbackProfile: FrozenProfileState = {
          frozenTeams: (persisted?.frozenTeams ??
            currentState.frozenTeams) as Record<string, FrozenTeam>,
          reuseMode: persisted?.reuseMode ?? currentState.reuseMode,
          frozenArtifactIds:
            persisted?.frozenArtifactIds ?? currentState.frozenArtifactIds,
        };
        const freezesByProfileId = (persisted?.freezesByProfileId ?? {
          [DEFAULT_ACCOUNT_PROFILE_ID]: fallbackProfile,
        }) as Record<AccountProfileId, FrozenProfileState>;
        const activeProfile =
          freezesByProfileId[getActiveProfileId()] ??
          freezesByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] ??
          fallbackProfile;
        return {
          ...currentState,
          ...applyProfileState(activeProfile),
          freezesByProfileId,
        };
      },
    }
  )
);

// ─── Auto-validation subscriber ──────────────────────────────────────────────
// Validates frozen artifact IDs against the active account whenever that
// account changes or its data changes. Imports into inactive accounts call
// validateFrozenArtifacts(accountId) directly through applyAccountImport.
useAccountStore.subscribe((state, prevState) => {
  if (state.activeAccountId !== prevState.activeAccountId) {
    useFreezeStore.getState().setActiveProfile(state.activeAccountId);
  }

  const profileId = state.activeAccountId;
  if (profileId === null) return;

  const data = getActiveAccount(state)?.data;
  const prevData = prevState.accounts[profileId]?.data;
  if (data && (data !== prevData || profileId !== prevState.activeAccountId)) {
    useFreezeStore
      .getState()
      .validateFrozenArtifacts(collectAllArtifactIds(data), profileId);
  }
});
