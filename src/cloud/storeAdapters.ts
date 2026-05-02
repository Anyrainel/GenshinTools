import {
  type AccountCloudSnapshot,
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
    plan.freezesByProfileId = accountPatch.freezesByProfileId;
    plan.triageByProfileId = accountPatch.triageByProfileId;
    plan.resourcesByProfileId = accountPatch.resourcesByProfileId;
    plan.recommendationsByProfileId = accountPatch.recommendationsByProfileId;
  }

  if (namespaces.has("builds")) {
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

export function applyCloudRestorePlan(
  plan: CloudRestorePlan
): CloudRestoreApplyResult {
  const appliedSections: string[] = [];

  if (plan.accounts !== undefined) {
    const accounts = plan.accounts as Record<AccountProfileId, AccountState>;
    useAccountStore.setState((state) => ({
      accounts,
      activeAccountId: chooseRestoredActiveAccount(
        accounts,
        state.activeAccountId
      ),
    }));
    useAccountScoreCacheStore.getState().clearAllScores();
    appliedSections.push("accounts");
  }

  if (plan.freezesByProfileId !== undefined) {
    useFreezeStore.setState({
      freezesByProfileId: plan.freezesByProfileId as Record<
        AccountProfileId,
        FrozenProfileStateSnapshot
      >,
    });
    useFreezeStore
      .getState()
      .setActiveProfile(useAccountStore.getState().activeAccountId);
    appliedSections.push("freezesByProfileId");
  }

  if (plan.triageByProfileId !== undefined) {
    useTriageStore.setState({
      settingsByProfileId:
        plan.triageByProfileId as TriageState["settingsByProfileId"],
    });
    appliedSections.push("triageByProfileId");
  }

  if (plan.resourcesByProfileId !== undefined) {
    useResourceRecStore.setState({
      settingsByProfileId:
        plan.resourcesByProfileId as ResourceRecState["settingsByProfileId"],
    });
    appliedSections.push("resourcesByProfileId");
  }

  if (plan.recommendationsByProfileId !== undefined) {
    useScoreUpSettingsStore.setState({
      settingsByProfileId:
        plan.recommendationsByProfileId as ScoreUpSettingsState["settingsByProfileId"],
    });
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
    hiddenCharacters: state.hiddenCharacters,
    characterWeapons: state.characterWeapons,
    computeOptions: state.computeOptions,
    artifactScore: useArtifactScoreStore.getState().config,
    author: state.author,
    description: state.description,
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
  };
}

function getCharacterTierSnapshot() {
  const state = useTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
  };
}

function getWeaponTierSnapshot() {
  const state = useWeaponTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
  };
}

function getArtifactTierSnapshot() {
  const state = useArtifactTierStore.getState();
  return {
    tierLists: state.tierLists,
    activeTierListId: state.activeTierListId,
    nextId: state.nextId,
  };
}

function chooseRestoredActiveAccount(
  accounts: Record<AccountProfileId, AccountState>,
  currentActive: AccountProfileId | null
): AccountProfileId | null {
  if (currentActive != null && accounts[currentActive]) return currentActive;
  const ids = Object.keys(accounts).map(Number);
  return ids.length ? Math.min(...ids) : null;
}

function applyCharacterTierSnapshot(snapshot: CharacterTierListSnapshot): void {
  useTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
  });
}

function applyWeaponTierSnapshot(snapshot: GenericTierListSnapshot): void {
  useWeaponTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
  });
}

function applyArtifactTierSnapshot(snapshot: GenericTierListSnapshot): void {
  useArtifactTierStore.setState({
    tierLists: snapshot.tierLists,
    activeTierListId: snapshot.activeTierListId,
    nextId: snapshot.nextId,
  });
}
