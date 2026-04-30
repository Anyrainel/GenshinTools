import { allSlots, type Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";

type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

interface FrozenTeamMigration {
  frozenCharIds: string[];
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
  artifactIdsByChar?: Record<string, Partial<Record<Slot, string>>>;
}

interface FrozenTeamLoadoutMigration {
  frozenCharIds: string[];
  artifactIdsByChar: Record<string, Partial<Record<Slot, string>>>;
}

interface FreezeMigrationState {
  frozenTeams?: Record<string, FrozenTeamMigration>;
  frozenTeamLoadouts?: Record<string, FrozenTeamLoadoutMigration>;
  reuseMode?: ArtifactReuseMode;
  frozenArtifactIds?: string[];
  freezesByProfileId?: Record<string, FreezeProfileMigration>;
}

interface FreezeProfileMigration {
  frozenTeams?: Record<string, FrozenTeamMigration>;
  frozenTeamLoadouts?: Record<string, FrozenTeamLoadoutMigration>;
  reuseMode: ArtifactReuseMode;
  frozenArtifactIds: string[];
}

function hasAnySlotId(ids: Partial<Record<Slot, string>>): boolean {
  return allSlots.some((slot) => ids[slot] != null);
}

function artifactsToIds(
  artifacts: Partial<Record<Slot, ArtifactData | null>>
): Partial<Record<Slot, string>> {
  const ids: Partial<Record<Slot, string>> = {};
  for (const slot of allSlots) {
    const artifact = artifacts[slot];
    if (artifact?.id) ids[slot] = artifact.id;
  }
  return ids;
}

function frozenTeamsToLoadouts(
  frozenTeams: Record<string, FrozenTeamMigration> = {}
): Record<string, FrozenTeamLoadoutMigration> {
  const loadouts: Record<string, FrozenTeamLoadoutMigration> = {};
  for (const [teamId, team] of Object.entries(frozenTeams)) {
    const artifactIdsByChar: Record<string, Partial<Record<Slot, string>>> = {
      ...(team.artifactIdsByChar ?? {}),
    };
    for (const [charId, artifacts] of Object.entries(
      team.artifactsByChar ?? {}
    )) {
      const ids = artifactsToIds(artifacts);
      if (hasAnySlotId(ids)) artifactIdsByChar[charId] = ids;
    }
    const frozenCharIds = (team.frozenCharIds ?? []).filter((charId) =>
      hasAnySlotId(artifactIdsByChar[charId] ?? {})
    );
    if (frozenCharIds.length > 0) {
      loadouts[teamId] = { frozenCharIds, artifactIdsByChar };
    }
  }
  return loadouts;
}

function normalizeProfile(
  profile: Partial<FreezeProfileMigration> = {}
): FreezeProfileMigration {
  return {
    frozenTeamLoadouts:
      profile.frozenTeamLoadouts ?? frozenTeamsToLoadouts(profile.frozenTeams),
    reuseMode: profile.reuseMode ?? "sameChar",
    frozenArtifactIds: profile.frozenArtifactIds ?? [],
  };
}

/**
 * Migrate persisted FreezeState from an older version to the current format.
 * Exported for testability; called by zustand persist's `migrate` option.
 */
export function migrateFreezeStore(
  persisted: unknown,
  version: number
): FreezeMigrationState {
  const state = persisted as Record<string, unknown>;
  // v0 -> v1: { artifactIds, artifactsByChar } -> { frozenCharIds, artifactsByChar }
  if (version < 1) {
    const ft = (state.frozenTeams ?? {}) as Record<
      string,
      {
        artifactIds?: string[];
        frozenCharIds?: string[];
        artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
      }
    >;
    for (const entry of Object.values(ft)) {
      if (!entry.frozenCharIds) {
        entry.frozenCharIds = Object.keys(entry.artifactsByChar);
        entry.artifactIds = undefined;
      }
    }
  }
  // v2 -> v3: allowSameCharReuse -> reuseMode.
  if (version < 3) {
    const legacy = state as Record<string, unknown>;
    legacy.reuseMode =
      legacy.allowSameCharReuse === false ? "none" : "sameChar";
    legacy.allowSameCharReuse = undefined;
  }
  // v4 -> v5: freeze state became account-profile scoped. Old single-account
  // shape is preserved as profile 0 (the no-UID/default profile).
  if (version < 5) {
    state.freezesByProfileId = {
      [DEFAULT_ACCOUNT_PROFILE_ID]: {
        frozenTeams: (state.frozenTeams ?? {}) as Record<
          string,
          FrozenTeamMigration
        >,
        reuseMode: (state.reuseMode as ArtifactReuseMode) ?? "sameChar",
        frozenArtifactIds: (state.frozenArtifactIds ?? []) as string[],
      },
    };
  }
  if (version < 7 || !state.freezesByProfileId) {
    const profiles = (state.freezesByProfileId ?? {}) as Record<
      string,
      FreezeProfileMigration
    >;
    const normalizedProfiles = Object.fromEntries(
      Object.entries(profiles).map(([profileId, profile]) => [
        profileId,
        normalizeProfile(profile),
      ])
    );
    const fallbackProfile = normalizeProfile({
      frozenTeams: state.frozenTeams as
        | Record<string, FrozenTeamMigration>
        | undefined,
      reuseMode: state.reuseMode as ArtifactReuseMode | undefined,
      frozenArtifactIds: state.frozenArtifactIds as string[] | undefined,
    });
    const defaultProfile =
      normalizedProfiles[DEFAULT_ACCOUNT_PROFILE_ID] ?? fallbackProfile;

    state.freezesByProfileId =
      Object.keys(normalizedProfiles).length > 0
        ? normalizedProfiles
        : { [DEFAULT_ACCOUNT_PROFILE_ID]: defaultProfile };
    delete state.frozenTeams;
    delete state.frozenTeamLoadouts;
    delete state.reuseMode;
    delete state.frozenArtifactIds;
  }
  return state as Partial<FreezeMigrationState> as FreezeMigrationState;
}
