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
  type FreezeCloudSnapshot,
  freezeFromCloud,
  freezeToCloud,
} from "@/cloud/adapters/freezeAdapter";
import {
  type SettingsCloudSnapshot,
  settingsFromCloud,
  settingsToCloud,
} from "@/cloud/adapters/settingsAdapter";
import {
  type TeamCloudSnapshot,
  teamFromCloud,
  teamToCloud,
} from "@/cloud/adapters/teamAdapter";
import {
  characterTiersFromCloud,
  characterTiersToCloud,
  genericTiersFromCloud,
  genericTiersToCloud,
} from "@/cloud/adapters/tierAdapter";
import type { CloudExportPartition, CloudRestorePlan } from "@/cloud/types";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

export type LocalCloudSnapshots = {
  account: AccountCloudSnapshot;
  builds: BuildsCloudSnapshot;
  teams: TeamCloudSnapshot;
  freeze: FreezeCloudSnapshot;
  characterTiers: ReturnType<typeof getCharacterTierSnapshot>;
  weaponTiers: ReturnType<typeof getWeaponTierSnapshot>;
  artifactTiers: ReturnType<typeof getArtifactTierSnapshot>;
  settings: SettingsCloudSnapshot;
};

export function getLocalCloudSnapshots(): LocalCloudSnapshots {
  return {
    account: getAccountSnapshot(),
    builds: getBuildsSnapshot(),
    teams: getTeamSnapshot(),
    freeze: getFreezeSnapshot(),
    characterTiers: getCharacterTierSnapshot(),
    weaponTiers: getWeaponTierSnapshot(),
    artifactTiers: getArtifactTierSnapshot(),
    settings: getSettingsSnapshot(),
  };
}

export function buildLocalBackupPartitions(): CloudExportPartition[] {
  const snapshots = getLocalCloudSnapshots();
  return [
    ...accountToCloud(snapshots.account),
    ...buildsToCloud(snapshots.builds),
    ...teamToCloud(snapshots.teams),
    ...freezeToCloud(snapshots.freeze),
    ...characterTiersToCloud(snapshots.characterTiers),
    ...genericTiersToCloud(snapshots.weaponTiers, "tier.weapon"),
    ...genericTiersToCloud(snapshots.artifactTiers, "tier.artifact"),
    ...settingsToCloud(snapshots.settings),
  ];
}

export function buildCloudRestorePlan(
  partitions: CloudExportPartition[]
): CloudRestorePlan {
  return {
    accounts: accountFromCloud(partitions),
    builds: buildsFromCloud(partitions),
    teams: teamFromCloud(partitions),
    freezesByProfileId: freezeFromCloud(partitions),
    characterTierLists: characterTiersFromCloud(partitions),
    weaponTierLists: genericTiersFromCloud(partitions, "tier.weapon"),
    artifactTierLists: genericTiersFromCloud(partitions, "tier.artifact"),
    ...settingsFromCloud(partitions),
  };
}

function getAccountSnapshot(): AccountCloudSnapshot {
  const state = useAccountStore.getState();
  return {
    accounts: state.accounts,
    activeAccountId: state.activeAccountId,
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

function getFreezeSnapshot(): FreezeCloudSnapshot {
  return {
    freezesByProfileId: useFreezeStore.getState().freezesByProfileId,
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

function getSettingsSnapshot(): SettingsCloudSnapshot {
  return {
    artifactScore: useArtifactScoreStore.getState().config,
    triageByProfileId: useTriageStore.getState().settingsByProfileId,
    resourcesByProfileId: useResourceRecStore.getState().settingsByProfileId,
  };
}
