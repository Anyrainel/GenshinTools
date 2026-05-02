import {
  type AccountCloudSnapshot,
  accountFromCloud,
  accountToCloud,
} from "@/cloud/adapters/accountAdapter";
import {
  type BuildsCloudSnapshot,
  buildsFromCloud,
  buildsToCloud,
} from "@/cloud/adapters/buildsAdapter";
import {
  type TeamCloudSnapshot,
  teamFromCloud,
  teamToCloud,
} from "@/cloud/adapters/teamAdapter";
import { tiersFromCloud, tiersToCloud } from "@/cloud/adapters/tierAdapter";
import type { CloudExportPartition, CloudRestorePlan } from "@/cloud/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useScoreUpSettingsStore } from "@/stores/useScoreUpSettingsStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
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
  const accountPatch = accountFromCloud(partitions);
  const buildsPatch = buildsFromCloud(partitions);
  const tierPatch = tiersFromCloud(partitions);
  return {
    accounts: accountPatch.accounts,
    builds: buildsPatch,
    teams: teamFromCloud(partitions),
    freezesByProfileId: accountPatch.freezesByProfileId,
    characterTierLists: tierPatch.character,
    weaponTierLists: tierPatch.weapon,
    artifactTierLists: tierPatch.artifact,
    artifactScore: buildsPatch.artifactScore,
    triageByProfileId: accountPatch.triageByProfileId,
    resourcesByProfileId: accountPatch.resourcesByProfileId,
    recommendationsByProfileId: accountPatch.recommendationsByProfileId,
  };
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
