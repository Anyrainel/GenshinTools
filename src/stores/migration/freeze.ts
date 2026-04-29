import type { Slot } from "@/data/enums";
import type { ArtifactData } from "@/data/types";
import { DEFAULT_ACCOUNT_PROFILE_ID } from "@/lib/account-data/accountProfile";

type ArtifactReuseMode = "none" | "sameChar" | "forceReuse";

interface FrozenTeamMigration {
  frozenCharIds: string[];
  artifactsByChar: Record<string, Record<Slot, ArtifactData | null>>;
}

interface FreezeMigrationState {
  frozenTeams: Record<string, FrozenTeamMigration>;
  reuseMode: ArtifactReuseMode;
  frozenArtifactIds: string[];
  freezesByProfileId?: Record<string, FreezeProfileMigration>;
}

interface FreezeProfileMigration {
  frozenTeams: Record<string, FrozenTeamMigration>;
  reuseMode: ArtifactReuseMode;
  frozenArtifactIds: string[];
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
  return state as Partial<FreezeMigrationState> as FreezeMigrationState;
}
