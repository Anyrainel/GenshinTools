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
 * Must be called BEFORE addOrUpdateAccount. The auto-validation subscriber
 * at the bottom of this file handles validation during the save.
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

export type FrozenArtifactIdsByChar = Record<
  string,
  Partial<Record<Slot, string>>
>;

export interface FrozenTeamLoadout {
  /** Which character IDs have their artifacts frozen. */
  frozenCharIds: string[];
  /** Stable artifact IDs per character/slot. Source of truth. */
  artifactIdsByChar: FrozenArtifactIdsByChar;
}

export interface FrozenTeam {
  /** Which character IDs have their artifacts frozen. */
  frozenCharIds: string[];
  /** Stable artifact IDs per character/slot. */
  artifactIdsByChar?: FrozenArtifactIdsByChar;
  /** Resolved artifact data for UI and optimizer inputs. Derived from account data. */
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FrozenProfileState {
  /** Map of teamId to stable frozen artifact IDs. */
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>;
  /** Controls how frozen artifacts can be reused across teams. */
  reuseMode: ArtifactReuseMode;
  /** Individually frozen artifact IDs, not tied to any team. */
  frozenArtifactIds: string[];
}

interface FreezeState {
  /** Map of teamId to stable frozen artifact IDs. Source of truth. */
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>;
  /** Map of teamId to resolved frozen data. Derived runtime view. */
  frozenTeams: Record<string, FrozenTeam>;
  /** Controls how frozen artifacts can be reused across teams. */
  reuseMode: ArtifactReuseMode;
  /** Individually frozen artifact IDs, not tied to any team. */
  frozenArtifactIds: string[];

  /** Freeze specific characters within a team. */
  freezeCharacters: (
    teamId: string,
    charIds: string[],
    artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>
  ) => void;
  /** Unfreeze specific characters within a team; removes team entry if none left. */
  unfreezeCharacters: (teamId: string, charIds: string[]) => void;
  /** Remove the entire team's freeze entry. */
  unfreezeTeam: (teamId: string) => void;
  clearAll: () => void;
  setReuseMode: (mode: ArtifactReuseMode) => void;
  /** Freeze a standalone artifact by ID. */
  freezeArtifact: (id: string) => void;
  /** Unfreeze a standalone artifact by ID. */
  unfreezeArtifact: (id: string) => void;
  /** True if any character in the team is frozen. */
  isFrozen: (teamId: string) => boolean;
  /** True if a specific character is frozen within a team. */
  isCharFrozen: (teamId: string, charId: string) => boolean;
  /** Get all frozen character IDs for a team. */
  getFrozenCharIds: (teamId: string) => string[];
  getFrozenTeam: (teamId: string) => FrozenTeam | undefined;
  /** All artifact IDs locked by frozen characters across teams plus standalone frozen artifacts. */
  getFrozenArtifactIds: (excludeTeamId?: string) => Set<string>;
  /** Remap frozen artifact IDs using an old-to-new mapping from ID reassignment. */
  remapArtifactIds: (
    mapping: Map<string, string>,
    profileId?: AccountProfileId
  ) => void;
  /** Remove any frozen artifact IDs that do not exist in the given set. */
  validateFrozenArtifacts: (
    allArtifactIds: Set<string>,
    profileId?: AccountProfileId | null
  ) => void;
  /** All per-account frozen state. Top-level fields mirror the active profile. */
  freezesByProfileId: Record<AccountProfileId, FrozenProfileState>;
  renameProfile: (
    sourceProfileId: AccountProfileId,
    targetProfileId: AccountProfileId
  ) => void;
  setActiveProfile: (profileId: AccountProfileId | null) => void;
}

const cloneDefaultProfileState = (): FrozenProfileState => ({
  frozenTeamLoadouts: {},
  reuseMode: "sameChar",
  frozenArtifactIds: [],
});

const getActiveProfileId = () =>
  useAccountStore.getState().activeAccountId ?? DEFAULT_ACCOUNT_PROFILE_ID;

function toArtifactIdSlots(
  artifacts: Partial<Record<Slot, ArtifactData | null>>
): Partial<Record<Slot, string>> {
  const ids: Partial<Record<Slot, string>> = {};
  for (const slot of allSlots) {
    const artifact = artifacts[slot];
    if (artifact?.id) ids[slot] = artifact.id;
  }
  return ids;
}

function hasAnySlotId(ids: Partial<Record<Slot, string>>): boolean {
  return allSlots.some((slot) => ids[slot] != null);
}

function getProfileLoadouts(
  profile: FrozenProfileState
): Record<string, FrozenTeamLoadout> {
  return profile.frozenTeamLoadouts;
}

function normalizeProfileState(
  profile: FrozenProfileState
): FrozenProfileState {
  return {
    frozenTeamLoadouts: getProfileLoadouts(profile),
    reuseMode: profile.reuseMode,
    frozenArtifactIds: profile.frozenArtifactIds,
  };
}

function profileStateEqual(
  first: FrozenProfileState,
  second: FrozenProfileState
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

const accountArtifactIndexCache = new WeakMap<
  AccountData,
  Map<string, ArtifactData>
>();

function getArtifactIndexForAccount(
  data: AccountData | undefined
): Map<string, ArtifactData> {
  if (!data) return new Map<string, ArtifactData>();
  const cached = accountArtifactIndexCache.get(data);
  if (cached) return cached;
  const artifacts = new Map<string, ArtifactData>();
  for (const char of data.characters) {
    for (const artifact of Object.values(char.artifacts)) {
      if (artifact) artifacts.set(artifact.id, artifact);
    }
  }
  for (const artifact of data.extraArtifacts) {
    artifacts.set(artifact.id, artifact);
  }
  accountArtifactIndexCache.set(data, artifacts);
  return artifacts;
}

function resolveFrozenTeams(
  frozenTeamLoadouts: Record<string, FrozenTeamLoadout>,
  profileId: AccountProfileId | null | undefined
): Record<string, FrozenTeam> {
  const account =
    useAccountStore.getState().accounts[
      profileId ?? DEFAULT_ACCOUNT_PROFILE_ID
    ];
  const artifactById = getArtifactIndexForAccount(account?.data);
  const frozenTeams: Record<string, FrozenTeam> = {};

  for (const [teamId, loadout] of Object.entries(frozenTeamLoadouts)) {
    const artifactsByChar: Record<
      string,
      Record<Slot, ArtifactData | null>
    > = {};
    for (const charId of loadout.frozenCharIds) {
      const ids = loadout.artifactIdsByChar[charId] ?? {};
      const artifacts = {} as Record<Slot, ArtifactData | null>;
      for (const slot of allSlots) {
        const id = ids[slot];
        artifacts[slot] = id ? (artifactById.get(id) ?? null) : null;
      }
      artifactsByChar[charId] = artifacts;
    }
    frozenTeams[teamId] = {
      frozenCharIds: [...loadout.frozenCharIds],
      artifactIdsByChar: structuredClone(loadout.artifactIdsByChar),
      artifactsByChar,
    };
  }

  return frozenTeams;
}

const currentProfileState = (state: FreezeState): FrozenProfileState => ({
  frozenTeamLoadouts: state.frozenTeamLoadouts,
  reuseMode: state.reuseMode,
  frozenArtifactIds: state.frozenArtifactIds,
});

const applyProfileState = (
  profile: FrozenProfileState,
  profileId: AccountProfileId | null | undefined
) => ({
  frozenTeamLoadouts: getProfileLoadouts(profile),
  frozenTeams: resolveFrozenTeams(getProfileLoadouts(profile), profileId),
  reuseMode: profile.reuseMode,
  frozenArtifactIds: profile.frozenArtifactIds,
});

const getStoredProfileState = (
  state: Pick<
    FreezeState,
    | "freezesByProfileId"
    | "frozenTeamLoadouts"
    | "reuseMode"
    | "frozenArtifactIds"
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
  ...(profileId === getActiveProfileId()
    ? applyProfileState(profile, profileId)
    : {}),
  freezesByProfileId: {
    ...state.freezesByProfileId,
    [profileId]: normalizeProfileState(profile),
  },
});

const remapProfileArtifacts = (
  profile: FrozenProfileState,
  mapping: Map<string, string>
): FrozenProfileState => {
  const frozenArtifactIds = profile.frozenArtifactIds
    .map((id) => mapping.get(id) ?? id)
    .filter((id) => id !== "");

  const frozenTeamLoadouts: Record<string, FrozenTeamLoadout> = {};
  for (const [teamId, team] of Object.entries(getProfileLoadouts(profile))) {
    const artifactIdsByChar: FrozenArtifactIdsByChar = {};
    for (const [charId, ids] of Object.entries(team.artifactIdsByChar)) {
      const nextIds: Partial<Record<Slot, string>> = {};
      for (const slot of allSlots) {
        const id = ids[slot];
        if (!id) continue;
        const mapped = mapping.get(id);
        if (mapped === "") continue;
        nextIds[slot] = mapped ?? id;
      }
      if (hasAnySlotId(nextIds)) artifactIdsByChar[charId] = nextIds;
    }

    const frozenCharIds = team.frozenCharIds.filter((cid) =>
      hasAnySlotId(artifactIdsByChar[cid] ?? {})
    );
    if (frozenCharIds.length > 0) {
      frozenTeamLoadouts[teamId] = { frozenCharIds, artifactIdsByChar };
    }
  }

  return { ...profile, frozenArtifactIds, frozenTeamLoadouts };
};

const validateProfileArtifacts = (
  profile: FrozenProfileState,
  allArtifactIds: Set<string>
): FrozenProfileState => {
  const frozenArtifactIds = profile.frozenArtifactIds.filter((id) =>
    allArtifactIds.has(id)
  );

  const frozenTeamLoadouts: Record<string, FrozenTeamLoadout> = {};
  let changed = frozenArtifactIds.length !== profile.frozenArtifactIds.length;

  for (const [teamId, team] of Object.entries(getProfileLoadouts(profile))) {
    const artifactIdsByChar: FrozenArtifactIdsByChar = {};
    for (const [charId, ids] of Object.entries(team.artifactIdsByChar)) {
      const nextIds: Partial<Record<Slot, string>> = {};
      for (const slot of allSlots) {
        const id = ids[slot];
        if (!id) continue;
        if (allArtifactIds.has(id)) nextIds[slot] = id;
        else changed = true;
      }
      if (hasAnySlotId(nextIds)) artifactIdsByChar[charId] = nextIds;
    }

    const frozenCharIds = team.frozenCharIds.filter((cid) =>
      hasAnySlotId(artifactIdsByChar[cid] ?? {})
    );
    if (frozenCharIds.length > 0) {
      frozenTeamLoadouts[teamId] = { frozenCharIds, artifactIdsByChar };
    } else if (team.frozenCharIds.length > 0) {
      changed = true;
    }
  }

  return changed
    ? { ...profile, frozenArtifactIds, frozenTeamLoadouts }
    : profile;
};

export const useFreezeStore = create<FreezeState>()(
  persist(
    (set, get) => ({
      frozenTeamLoadouts: {},
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
          const profileLoadouts = getProfileLoadouts(profile);
          const existing = profileLoadouts[teamId];
          const artifactIdsByChar: FrozenArtifactIdsByChar = {
            ...(existing?.artifactIdsByChar ?? {}),
          };
          const frozenSet = new Set(existing?.frozenCharIds ?? []);

          for (const charId of charIds) {
            const ids = toArtifactIdSlots(artifactsByChar[charId] ?? {});
            if (!hasAnySlotId(ids)) {
              delete artifactIdsByChar[charId];
              frozenSet.delete(charId);
              continue;
            }
            artifactIdsByChar[charId] = ids;
            frozenSet.add(charId);
          }

          const frozenCharIds = [...frozenSet].filter((charId) =>
            hasAnySlotId(artifactIdsByChar[charId] ?? {})
          );
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeamLoadouts: {
              ...profileLoadouts,
              [teamId]: { frozenCharIds, artifactIdsByChar },
            },
          });
        }),

      unfreezeCharacters: (teamId, charIds) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          const profileLoadouts = getProfileLoadouts(profile);
          const existing = profileLoadouts[teamId];
          if (!existing) return state;
          const charSet = new Set(charIds);
          const remaining = existing.frozenCharIds.filter(
            (id) => !charSet.has(id)
          );
          if (remaining.length === 0) {
            const { [teamId]: _, ...rest } = profileLoadouts;
            return updateProfileState(state, profileId, {
              ...profile,
              frozenTeamLoadouts: rest,
            });
          }

          const artifactIdsByChar = { ...existing.artifactIdsByChar };
          for (const charId of charIds) delete artifactIdsByChar[charId];
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeamLoadouts: {
              ...profileLoadouts,
              [teamId]: {
                ...existing,
                frozenCharIds: remaining,
                artifactIdsByChar,
              },
            },
          });
        }),

      unfreezeTeam: (teamId) =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          const { [teamId]: _, ...rest } = getProfileLoadouts(profile);
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeamLoadouts: rest,
          });
        }),

      clearAll: () =>
        set((state) => {
          const profileId = getActiveProfileId();
          const profile = getProfileState(state, profileId);
          return updateProfileState(state, profileId, {
            ...profile,
            frozenTeamLoadouts: {},
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
        const ids = new Set<string>(state.frozenArtifactIds);
        const frozenTeamLoadouts = state.frozenTeamLoadouts;

        for (const [tid, entry] of Object.entries(frozenTeamLoadouts)) {
          if (tid === excludeTeamId) continue;
          for (const charId of entry.frozenCharIds ?? []) {
            const slotIds = entry.artifactIdsByChar[charId] ?? {};
            for (const slot of allSlots) {
              const id = slotIds[slot];
              if (id) ids.add(id);
            }
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
          return updateProfileState(state, targetProfileId, validated);
        }),

      renameProfile: (sourceProfileId, targetProfileId) =>
        set((state) => {
          if (sourceProfileId === targetProfileId) return state;
          const sourceProfile =
            getActiveProfileId() === sourceProfileId
              ? currentProfileState(state)
              : state.freezesByProfileId[sourceProfileId];
          if (!sourceProfile) return state;

          const normalized = normalizeProfileState(sourceProfile);
          const defaultProfile = cloneDefaultProfileState();
          const freezesByProfileId = { ...state.freezesByProfileId };
          delete freezesByProfileId[sourceProfileId];
          if (!profileStateEqual(normalized, defaultProfile)) {
            freezesByProfileId[targetProfileId] = normalized;
          }

          const activeProfileId = getActiveProfileId();
          return {
            ...(activeProfileId === sourceProfileId ||
            activeProfileId === targetProfileId
              ? applyProfileState(normalized, activeProfileId)
              : {}),
            freezesByProfileId,
          };
        }),

      setActiveProfile: (profileId) =>
        set((state) =>
          applyProfileState(getStoredProfileState(state, profileId), profileId)
        ),
    }),
    {
      name: "frozen-teams-storage",
      version: 7,
      migrate: migrateFreezeStore,
      partialize: (state) => ({
        freezesByProfileId: {
          ...state.freezesByProfileId,
          [getActiveProfileId()]: normalizeProfileState(
            currentProfileState(state)
          ),
        },
      }),
      merge: (persistedState, currentState) => {
        const parsed = PersistedFreezeStoreSchema.safeParse(persistedState);
        const persistedProfiles = parsed.success
          ? (parsed.data.freezesByProfileId as Record<
              AccountProfileId,
              FrozenProfileState
            >)
          : {};
        const freezesByProfileId = Object.fromEntries(
          Object.entries(persistedProfiles).map(([profileId, profile]) => [
            profileId,
            normalizeProfileState(profile),
          ])
        ) as Record<AccountProfileId, FrozenProfileState>;
        if (Object.keys(freezesByProfileId).length === 0) {
          freezesByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] =
            cloneDefaultProfileState();
        }
        const activeProfile =
          freezesByProfileId[getActiveProfileId()] ??
          freezesByProfileId[DEFAULT_ACCOUNT_PROFILE_ID] ??
          cloneDefaultProfileState();
        return {
          ...currentState,
          ...applyProfileState(activeProfile, getActiveProfileId()),
          freezesByProfileId,
        };
      },
    }
  )
);

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
