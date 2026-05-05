import {
  type AccountCloudSnapshot,
  type AccountRestorePatch,
  accountFromCloud,
  accountToCloud,
  type FrozenProfileStateSnapshot,
} from "@/cloud/adapters/accountAdapter";
import {
  type BuildsCloudSnapshot,
  type BuildsRestorePatch,
  buildsFromCloud,
  buildsToCloud,
} from "@/cloud/adapters/buildsAdapter";
import {
  type TeamCloudSnapshot,
  type TeamRestorePatch,
  teamFromCloud,
  teamToCloud,
} from "@/cloud/adapters/teamAdapter";
import {
  type CharacterTierListSnapshot,
  type GenericTierListSnapshot,
  tiersFromCloud,
  tiersToCloud,
} from "@/cloud/adapters/tierAdapter";
import type { CloudExportPartition, CloudRestorePlan } from "@/cloud/types";
import type { AccountData, ArtifactData, CharacterData } from "@/data/types";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import type { ArtifactScoreGlobalConfig } from "@/stores/migration/artifactScore";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";
import type { BuildsSourceState } from "@/stores/useBuildsStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import type { ResourceRecState } from "@/stores/useResourceRecStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import type { ScoreUpSettingsState } from "@/stores/useScoreUpSettingsStore";
import { useScoreUpSettingsStore } from "@/stores/useScoreUpSettingsStore";
import type { TeamSourceState } from "@/stores/useTeamStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import type { TriageState } from "@/stores/useTriageStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

export type LocalCloudSnapshots = {
  account: AccountCloudSnapshot;
  builds: BuildsCloudSnapshot;
  teams: TeamCloudSnapshot;
  characterTiers: ReturnType<typeof getCharacterTierSnapshot>;
  weaponTiers: ReturnType<typeof getWeaponTierSnapshot>;
  artifactTiers: ReturnType<typeof getArtifactTierSnapshot>;
};

export type CloudRestoreApplyResult = {
  appliedSections: string[];
};

export function getLocalCloudSnapshots(): LocalCloudSnapshots {
  return {
    account: getAccountSnapshot(),
    builds: getBuildsSnapshot(),
    teams: getTeamSnapshot(),
    characterTiers: getCharacterTierSnapshot(),
    weaponTiers: getWeaponTierSnapshot(),
    artifactTiers: getArtifactTierSnapshot(),
  };
}

export function buildLocalBackupPartitions(): CloudExportPartition[] {
  const snapshots = getLocalCloudSnapshots();
  return [
    ...accountToCloud(snapshots.account),
    ...buildsToCloud(snapshots.builds),
    ...teamToCloud(snapshots.teams),
    ...tiersToCloud({
      character: snapshots.characterTiers,
      weapon: snapshots.weaponTiers,
      artifact: snapshots.artifactTiers,
    }),
  ];
}

export function buildCloudRestorePlan(
  partitions: CloudExportPartition[]
): CloudRestorePlan {
  const namespaces = new Set(
    partitions.map((partition) => partition.namespace)
  );
  const plan: CloudRestorePlan = {};

  if (
    namespaces.has("profile.app") ||
    namespaces.has("profile.game") ||
    namespaces.has("profile.artifacts")
  ) {
    const accountPatch = accountFromCloud(partitions);
    plan.accounts = accountPatch.accounts;
    plan.activeAccountId = accountPatch.activeAccountId;
    plan.accountShardPresenceByProfileId =
      accountPatch.shardPresenceByProfileId;
    plan.freezesByProfileId = accountPatch.freezesByProfileId;
    plan.triageByProfileId = accountPatch.triageByProfileId;
    plan.resourcesByProfileId = accountPatch.resourcesByProfileId;
    plan.recommendationsByProfileId = accountPatch.recommendationsByProfileId;
  }

  if (namespaces.has("builds")) {
    assertBuildPayloads(partitions);
    const buildsPatch = buildsFromCloud(partitions);
    plan.builds = buildsPatch;
    plan.artifactScore = buildsPatch.artifactScore;
  }

  if (namespaces.has("teams")) {
    plan.teams = teamFromCloud(partitions);
  }

  if (namespaces.has("tiers")) {
    const tierPatch = tiersFromCloud(partitions);
    plan.characterTierLists = tierPatch.character;
    plan.weaponTierLists = tierPatch.weapon;
    plan.artifactTierLists = tierPatch.artifact;
  }

  return plan;
}

function assertBuildPayloads(partitions: CloudExportPartition[]): void {
  for (const partition of partitions) {
    if (partition.namespace !== "builds") continue;
    const payload = partition.payload as { deltas?: unknown };
    if (!Array.isArray(payload.deltas)) {
      throw new Error(
        "Downloaded builds payload invalid: deltas must be an array"
      );
    }
  }
}

export function applyCloudRestorePlan(
  plan: CloudRestorePlan
): CloudRestoreApplyResult {
  const appliedSections: string[] = [];

  if (plan.accounts !== undefined) {
    const restoredAccounts = plan.accounts as Record<
      AccountProfileId,
      AccountState
    >;
    const shardPresenceByProfileId = plan.accountShardPresenceByProfileId as
      | AccountRestorePatch["shardPresenceByProfileId"]
      | undefined;
    useAccountStore.setState((state) => {
      const accounts = mergeAccountRestore(
        state.accounts,
        restoredAccounts,
        shardPresenceByProfileId
      );
      return {
        accounts,
        activeAccountId: chooseRestoredActiveAccount(
          accounts,
          plan.activeAccountId as AccountProfileId | null | undefined,
          state.activeAccountId
        ),
      };
    });
    useAccountScoreCacheStore.getState().clearAllScores();
    appliedSections.push("accounts");
  }

  if (plan.freezesByProfileId !== undefined) {
    const restoredFreezes = plan.freezesByProfileId as Record<
      AccountProfileId,
      FrozenProfileStateSnapshot
    >;
    useFreezeStore.setState((state) => ({
      freezesByProfileId: {
        ...state.freezesByProfileId,
        ...restoredFreezes,
      },
    }));
    useFreezeStore
      .getState()
      .setActiveProfile(useAccountStore.getState().activeAccountId);
    appliedSections.push("freezesByProfileId");
  }

  if (plan.triageByProfileId !== undefined) {
    const restoredSettings =
      plan.triageByProfileId as TriageState["settingsByProfileId"];
    useTriageStore.setState((state) => ({
      settingsByProfileId: {
        ...state.settingsByProfileId,
        ...restoredSettings,
      },
    }));
    appliedSections.push("triageByProfileId");
  }

  if (plan.resourcesByProfileId !== undefined) {
    const restoredSettings =
      plan.resourcesByProfileId as ResourceRecState["settingsByProfileId"];
    useResourceRecStore.setState((state) => ({
      settingsByProfileId: {
        ...state.settingsByProfileId,
        ...restoredSettings,
      },
    }));
    appliedSections.push("resourcesByProfileId");
  }

  if (plan.recommendationsByProfileId !== undefined) {
    const restoredSettings =
      plan.recommendationsByProfileId as ScoreUpSettingsState["settingsByProfileId"];
    useScoreUpSettingsStore.setState((state) => ({
      settingsByProfileId: {
        ...state.settingsByProfileId,
        ...restoredSettings,
      },
    }));
    appliedSections.push("recommendationsByProfileId");
  }

  if (plan.builds !== undefined) {
    useBuildsStore
      .getState()
      .replaceSourceState(
        plan.builds as BuildsRestorePatch & BuildsSourceState
      );
    appliedSections.push("builds");
  }

  if (plan.artifactScore !== undefined) {
    useArtifactScoreStore
      .getState()
      .replaceConfig(plan.artifactScore as ArtifactScoreGlobalConfig);
    appliedSections.push("artifactScore");
  }

  if (plan.teams !== undefined) {
    useTeamStore
      .getState()
      .replaceSourceState(plan.teams as TeamRestorePatch & TeamSourceState);
    appliedSections.push("teams");
  }

  if (plan.characterTierLists !== undefined) {
    applyCharacterTierSnapshot(
      plan.characterTierLists as CharacterTierListSnapshot
    );
    appliedSections.push("characterTierLists");
  }

  if (plan.weaponTierLists !== undefined) {
    applyWeaponTierSnapshot(plan.weaponTierLists as GenericTierListSnapshot);
    appliedSections.push("weaponTierLists");
  }

  if (plan.artifactTierLists !== undefined) {
    applyArtifactTierSnapshot(
      plan.artifactTierLists as GenericTierListSnapshot
    );
    appliedSections.push("artifactTierLists");
  }

  return { appliedSections };
}

function getAccountSnapshot(): AccountCloudSnapshot {
  const state = useAccountStore.getState();
  return {
    accounts: state.accounts,
    activeAccountId: state.activeAccountId,
    freezesByProfileId: useFreezeStore.getState().freezesByProfileId,
    triageByProfileId: useTriageStore.getState().settingsByProfileId,
    resourcesByProfileId: useResourceRecStore.getState().settingsByProfileId,
    recommendationsByProfileId:
      useScoreUpSettingsStore.getState().settingsByProfileId,
  };
}

function getBuildsSnapshot(): BuildsCloudSnapshot {
  const state = useBuildsStore.getState();
  return {
    activePresetId: state.activePresetId,
    deltas: state.deltas,
    characterWeapons: state.characterWeapons,
    computeOptions: state.computeOptions,
    artifactScore: useArtifactScoreStore.getState().config,
    author: state.author,
    description: state.description,
    updatedAt: state.updatedAt,
  };
}

function getTeamSnapshot(): TeamCloudSnapshot {
  const state = useTeamStore.getState();
  return {
    activePresetId: state.activePresetId,
    compDeltas: state.compDeltas,
    configsByTeamId: state.configsByTeamId,
    author: state.author,
    description: state.description,
    updatedAt: state.updatedAt,
  };
}

function getCharacterTierSnapshot() {
  const state = useTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
    updatedAt: state.updatedAt,
  };
}

function getWeaponTierSnapshot() {
  const state = useWeaponTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
    updatedAt: state.updatedAt,
  };
}

function getArtifactTierSnapshot() {
  const state = useArtifactTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
    updatedAt: state.updatedAt,
  };
}

function mergeAccountRestore(
  currentAccounts: Record<AccountProfileId, AccountState>,
  restoredAccounts: Record<AccountProfileId, AccountState>,
  shardPresenceByProfileId:
    | AccountRestorePatch["shardPresenceByProfileId"]
    | undefined
): Record<AccountProfileId, AccountState> {
  const accounts = { ...currentAccounts };
  for (const [profileIdText, restored] of Object.entries(restoredAccounts)) {
    const profileId = Number(profileIdText) as AccountProfileId;
    const existing = currentAccounts[profileId];
    const shardPresence = shardPresenceByProfileId?.[profileId];
    accounts[profileId] =
      existing && shardPresence
        ? mergeAccountByShard(existing, restored, shardPresence)
        : restored;
  }
  return accounts;
}

function mergeAccountByShard(
  existing: AccountState,
  restored: AccountState,
  shardPresence: AccountRestorePatch["shardPresenceByProfileId"][AccountProfileId]
): AccountState {
  const data = mergeAccountDataByShard(
    existing.data,
    restored.data,
    shardPresence
  );
  return {
    ...existing,
    ...(shardPresence.app
      ? {
          name: restored.name,
          lastUpdate: restored.lastUpdate,
        }
      : {}),
    data,
  };
}

function mergeAccountDataByShard(
  existing: AccountData,
  restored: AccountData,
  shardPresence: AccountRestorePatch["shardPresenceByProfileId"][AccountProfileId]
): AccountData {
  const useRestoredGame = shardPresence.game === true;
  const useRestoredArtifacts = shardPresence.artifacts === true;
  const baseCharacters = useRestoredGame
    ? restored.characters
    : existing.characters;
  const artifactSource = useRestoredArtifacts ? restored : existing;
  const artifactsByCharacter = new Map(
    artifactSource.characters.map((character) => [
      character.key,
      character.artifacts,
    ])
  );
  const assignedArtifactIds = new Set<string>();
  const characters = baseCharacters.map((character) =>
    mergeCharacterArtifacts(
      character,
      artifactsByCharacter.get(character.key) ?? {},
      assignedArtifactIds
    )
  );

  return {
    characters,
    extraWeapons: useRestoredGame
      ? restored.extraWeapons
      : existing.extraWeapons,
    extraArtifacts: collectExtraArtifactsAfterMerge(
      artifactSource,
      assignedArtifactIds
    ),
  };
}

function mergeCharacterArtifacts(
  character: CharacterData,
  artifacts: CharacterData["artifacts"],
  assignedArtifactIds: Set<string>
): CharacterData {
  for (const artifact of Object.values(artifacts)) {
    if (artifact) assignedArtifactIds.add(artifact.id);
  }
  return {
    ...character,
    artifacts,
  };
}

function collectExtraArtifactsAfterMerge(
  source: AccountData,
  assignedArtifactIds: Set<string>
): ArtifactData[] {
  const artifacts = [
    ...source.extraArtifacts,
    ...source.characters.flatMap((character) =>
      Object.values(character.artifacts).flatMap((artifact) =>
        artifact ? [artifact] : []
      )
    ),
  ];
  const byId = new Map<string, ArtifactData>();
  for (const artifact of artifacts) {
    if (!assignedArtifactIds.has(artifact.id)) {
      byId.set(artifact.id, artifact);
    }
  }
  return [...byId.values()];
}

function chooseRestoredActiveAccount(
  accounts: Record<AccountProfileId, AccountState>,
  restoredActive: AccountProfileId | null | undefined,
  currentActive: AccountProfileId | null
): AccountProfileId | null {
  if (restoredActive != null && accounts[restoredActive]) return restoredActive;
  if (currentActive != null && accounts[currentActive]) return currentActive;
  const ids = Object.keys(accounts).map(Number);
  return ids.length ? Math.min(...ids) : null;
}

function applyCharacterTierSnapshot(snapshot: CharacterTierListSnapshot): void {
  useTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
    updatedAt: snapshot.updatedAt,
  });
}

function applyWeaponTierSnapshot(snapshot: GenericTierListSnapshot): void {
  useWeaponTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
    updatedAt: snapshot.updatedAt,
  });
}

function applyArtifactTierSnapshot(snapshot: GenericTierListSnapshot): void {
  useArtifactTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
    updatedAt: snapshot.updatedAt,
  });
}
