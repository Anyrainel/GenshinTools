import { BackupApiClient } from "@/cloud/apiClient";
import {
  downloadManualBackupSelection,
  previewManualBackupAction,
} from "@/cloud/manualBackupController";
import { buildLocalBackupPartitions } from "@/cloud/storeAdapters";
import { readDownloadedPartitions } from "@/cloud/syncClient";
import type {
  AccountData,
  TierAssignment,
  TierCustomization,
} from "@/data/types";
import type { AccountProfileId, AccountState } from "@/lib/account-data/types";
import type { BuildDelta } from "@/lib/artifact-builds/buildDeltas";
import { DEFAULT_COMPUTE_OPTIONS } from "@/lib/artifact-builds/computeFilters";
import type { TeamCompDelta } from "@/lib/team-comp/teamDeltas";
import type { TeamSetupConfig } from "@/lib/team-comp/types";
import { DEFAULT_GLOBAL_STAT_WEIGHTS } from "@/stores/schemas";
import { useAccountScoreCacheStore } from "@/stores/useAccountScoreCacheStore";
import { useAccountStore } from "@/stores/useAccountStore";
import { useArtifactScoreStore } from "@/stores/useArtifactScoreStore";
import { useArtifactTierStore } from "@/stores/useArtifactTierStore";
import { useBuildsStore } from "@/stores/useBuildsStore";
import { useCloudSyncMetadataStore } from "@/stores/useCloudSyncMetadataStore";
import { useFreezeStore } from "@/stores/useFreezeStore";
import { useResourceRecStore } from "@/stores/useResourceRecStore";
import { useScoreUpSettingsStore } from "@/stores/useScoreUpSettingsStore";
import { useTeamStore } from "@/stores/useTeamStore";
import { useTierStore } from "@/stores/useTierStore";
import { useTriageStore } from "@/stores/useTriageStore";
import { useWeaponTierStore } from "@/stores/useWeaponTierStore";

type E2eUser = {
  sub: string;
  name?: string;
  email?: string;
};

type E2eBuildsState = {
  activePresetId?: string | null;
  deltas?: BuildDelta[];
  characterWeapons?: Record<string, string[]>;
  author?: string;
  description?: string;
  updatedAt?: number;
};

type E2eTeamsState = {
  activePresetId?: string | null;
  compDeltas?: TeamCompDelta[];
  configsByTeamId?: Record<string, TeamSetupConfig>;
  author?: string;
  description?: string;
  updatedAt?: number;
};

type E2eTierList = {
  id: number;
  tierAssignments: TierAssignment;
  tierCustomization: TierCustomization;
  customTitle: string;
  author: string;
  description: string;
  linkedAccountId?: AccountProfileId | null;
};

type E2eTierState = {
  tierLists?: Record<number, E2eTierList>;
  activeTierListId?: number;
  nextId?: number;
  updatedAt?: number;
};

export type E2eDomainState = {
  accounts?: Record<AccountProfileId, AccountState>;
  activeAccountId?: AccountProfileId | null;
  builds?: E2eBuildsState;
  teams?: E2eTeamsState;
  characterTiers?: E2eTierState;
  weaponTiers?: E2eTierState;
  artifactTiers?: E2eTierState;
};

const AUTH_STORAGE_KEY = "gg_e2e_logto_user";
const DOMAIN_STORAGE_KEYS = [
  "genshin-account-storage",
  "artifact-filter-builds",
  "team-builder-storage",
  "tierlist-storage",
  "weapon-tierlist-storage",
  "artifact-tierlist-storage",
  "cloud-sync-metadata-storage",
  "freeze-storage",
  "triage-settings",
  "resource-rec-settings",
  "recommendation-settings",
  "artifact-score-storage",
  "account-score-cache-storage",
];

declare global {
  interface Window {
    __ggE2E: {
      signIn: (user: E2eUser) => void;
      signOut: () => void;
      clearDomainData: () => void;
      seedDomainData: (state: E2eDomainState) => void;
      replaceDomainData: (state: E2eDomainState) => void;
      readDomainData: () => E2eDomainState;
      readCloudMetadata: () => {
        partitionsById: Record<string, unknown>;
        conflictsById: Record<string, unknown>;
      };
      previewManualPlan: (direction: "upload" | "download") => Promise<{
        status: string;
        automaticPartitionIds: string[];
        choices: Array<{ id: string; kind: string; reason: string }>;
      }>;
      readBackupHead: () => Promise<unknown>;
      readCloudPartitions: () => Promise<
        Array<{ namespace: string; partitionKey: string; payload: unknown }>
      >;
      readLocalPartitions: () => Array<{
        namespace: string;
        partitionKey: string;
        payload: unknown;
      }>;
      restoreAllCloudData: () => Promise<void>;
    };
  }
}

window.__ggE2E = {
  signIn(user) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("gg-e2e-logto-change"));
  },
  signOut() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new Event("gg-e2e-logto-change"));
  },
  clearDomainData() {
    for (const key of DOMAIN_STORAGE_KEYS) window.localStorage.removeItem(key);
    window.sessionStorage.clear();
    resetStores();
  },
  seedDomainData(state) {
    resetStores();
    applyDomainState(state);
  },
  replaceDomainData(state) {
    applyDomainState(state);
  },
  readDomainData() {
    const account = useAccountStore.getState();
    const builds = useBuildsStore.getState();
    const teams = useTeamStore.getState();
    const characterTiers = useTierStore.getState();
    const weaponTiers = useWeaponTierStore.getState();
    const artifactTiers = useArtifactTierStore.getState();
    return {
      accounts: account.accounts,
      activeAccountId: account.activeAccountId,
      builds: {
        activePresetId: builds.activePresetId,
        deltas: builds.deltas,
        characterWeapons: builds.characterWeapons,
        author: builds.author,
        description: builds.description,
        updatedAt: builds.updatedAt,
      },
      teams: {
        activePresetId: teams.activePresetId,
        compDeltas: teams.compDeltas,
        configsByTeamId: teams.configsByTeamId,
        author: teams.author,
        description: teams.description,
        updatedAt: teams.updatedAt,
      },
      characterTiers: {
        tierLists: characterTiers.tierLists,
        activeTierListId: characterTiers.activeTierListId,
        nextId: characterTiers.nextId,
        updatedAt: characterTiers.updatedAt,
      },
      weaponTiers: {
        tierLists: weaponTiers.tierLists,
        activeTierListId: weaponTiers.activeTierListId,
        nextId: weaponTiers.nextId,
        updatedAt: weaponTiers.updatedAt,
      },
      artifactTiers: {
        tierLists: artifactTiers.tierLists,
        activeTierListId: artifactTiers.activeTierListId,
        nextId: artifactTiers.nextId,
        updatedAt: artifactTiers.updatedAt,
      },
    };
  },
  readCloudMetadata() {
    const state = useCloudSyncMetadataStore.getState();
    return {
      partitionsById: state.partitionsById,
      conflictsById: state.conflictsById,
    };
  },
  async previewManualPlan(direction) {
    const apiClient = await createAuthedBackupApiClient();
    const pending = await previewManualBackupAction(direction, apiClient);
    return {
      status: pending.syncResult.status,
      automaticPartitionIds: [...pending.plan.automaticPartitionIds],
      choices: pending.plan.choices.map((choice) => ({
        id: choice.id,
        kind: choice.kind,
        reason: choice.reason,
      })),
    };
  },
  async readBackupHead() {
    await ensureAppSession();
    const response = await fetch("/api/backup/v1/head", {
      credentials: "same-origin",
    });
    return response.json();
  },
  async readCloudPartitions() {
    const apiClient = await createAuthedBackupApiClient();
    const head = await apiClient.getHead();
    if (head.heads.length === 0) return [];
    const downloaded = await apiClient.downloadObjects(
      head.heads.map((entry) => entry.objectId)
    );
    const partitions = await readDownloadedPartitions(head.heads, downloaded);
    return partitions.map((partition) => ({
      namespace: partition.namespace,
      partitionKey: partition.partitionKey,
      payload: partition.payload,
    }));
  },
  readLocalPartitions() {
    return buildLocalBackupPartitions().map((partition) => ({
      namespace: partition.namespace,
      partitionKey: partition.partitionKey,
      payload: partition.payload,
    }));
  },
  async restoreAllCloudData() {
    const apiClient = await createAuthedBackupApiClient();
    const pending = await previewManualBackupAction("download", apiClient);
    await downloadManualBackupSelection(apiClient, pending.syncResult, [
      ...pending.plan.automaticPartitionIds,
      ...pending.plan.choices.map((choice) => choice.id),
    ]);
  },
};

function applyDomainState(state: E2eDomainState): void {
  useAccountStore.setState({
    accounts: state.accounts ?? {},
    activeAccountId: state.activeAccountId ?? null,
  });
  useBuildsStore.getState().replaceSourceState({
    activePresetId: state.builds?.activePresetId ?? null,
    deltas: state.builds?.deltas ?? [],
    characterWeapons: state.builds?.characterWeapons ?? {},
    computeOptions: DEFAULT_COMPUTE_OPTIONS,
    author: state.builds?.author ?? "",
    description: state.builds?.description ?? "",
    updatedAt: state.builds?.updatedAt ?? 1,
  });
  useArtifactScoreStore
    .getState()
    .replaceConfig({ global: DEFAULT_GLOBAL_STAT_WEIGHTS });
  useTeamStore.getState().replaceSourceState({
    activePresetId: state.teams?.activePresetId ?? null,
    compDeltas: state.teams?.compDeltas ?? [],
    configsByTeamId: state.teams?.configsByTeamId ?? {},
    author: state.teams?.author ?? "",
    description: state.teams?.description ?? "",
    updatedAt: state.teams?.updatedAt ?? 1,
  });
  seedTierStores(state);
}

function resetStores(): void {
  useAccountStore.setState({ accounts: {}, activeAccountId: null });
  useAccountScoreCacheStore.getState().clearAllScores();
  useBuildsStore.getState().clearAll();
  useArtifactScoreStore
    .getState()
    .replaceConfig({ global: DEFAULT_GLOBAL_STAT_WEIGHTS });
  useTeamStore.getState().clearTeams();
  useCloudSyncMetadataStore.getState().clearSyncMetadata();
  useCloudSyncMetadataStore.getState().resetDeviceId();
  useFreezeStore.setState({ freezesByProfileId: {} });
  useTriageStore.setState({ settingsByProfileId: {} });
  useResourceRecStore.setState({ settingsByProfileId: {} });
  useScoreUpSettingsStore.setState({ settingsByProfileId: {} });
  useTierStore.setState({
    tierLists: {
      1: characterTierList(""),
    } as ReturnType<typeof useTierStore.getState>["tierLists"],
    activeTierListId: 1,
    nextId: 2,
  });
  useWeaponTierStore.setState({
    tierLists: { 1: genericTierList("") },
    activeTierListId: 1,
    nextId: 2,
  });
  useArtifactTierStore.setState({
    tierLists: { 1: genericTierList("") },
    activeTierListId: 1,
    nextId: 2,
  });
}

function seedTierStores(state: E2eDomainState): void {
  if (state.characterTiers) {
    useTierStore.setState({
      tierLists: (state.characterTiers.tierLists ?? {
        1: characterTierList(""),
      }) as ReturnType<typeof useTierStore.getState>["tierLists"],
      activeTierListId: state.characterTiers.activeTierListId ?? 1,
      nextId: state.characterTiers.nextId ?? 2,
      updatedAt: state.characterTiers.updatedAt ?? 1,
    });
  }
  if (state.weaponTiers) {
    useWeaponTierStore.setState({
      tierLists: (state.weaponTiers.tierLists ?? {
        1: genericTierList(""),
      }) as ReturnType<typeof useWeaponTierStore.getState>["tierLists"],
      activeTierListId: state.weaponTiers.activeTierListId ?? 1,
      nextId: state.weaponTiers.nextId ?? 2,
      updatedAt: state.weaponTiers.updatedAt ?? 1,
    });
  }
  if (state.artifactTiers) {
    useArtifactTierStore.setState({
      tierLists: (state.artifactTiers.tierLists ?? {
        1: genericTierList(""),
      }) as ReturnType<typeof useArtifactTierStore.getState>["tierLists"],
      activeTierListId: state.artifactTiers.activeTierListId ?? 1,
      nextId: state.artifactTiers.nextId ?? 2,
      updatedAt: state.artifactTiers.updatedAt ?? 1,
    });
  }
}

function characterTierList(title: string): E2eTierList {
  return {
    ...genericTierList(title),
    linkedAccountId: null,
  };
}

function genericTierList(title: string): E2eTierList {
  return {
    id: 1,
    tierAssignments: {},
    tierCustomization: {},
    customTitle: title,
    author: "",
    description: "",
    linkedAccountId: null,
  };
}

function readSignedInUser(): E2eUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<E2eUser>;
    return typeof parsed.sub === "string" ? { sub: parsed.sub } : null;
  } catch {
    return null;
  }
}

async function readAccessToken(): Promise<string> {
  const user = readSignedInUser();
  if (!user) throw new Error("No E2E user is signed in");
  const tokenResponse = await fetch(
    `/__e2e__/token?${new URLSearchParams({ sub: user.sub })}`
  );
  const tokenBody = (await tokenResponse.json()) as { accessToken?: string };
  if (!tokenBody.accessToken) {
    throw new Error("E2E token fixture returned no token");
  }
  return tokenBody.accessToken;
}

async function createAuthedBackupApiClient(): Promise<BackupApiClient> {
  await ensureAppSession();
  return new BackupApiClient({ credentials: "same-origin" });
}

async function ensureAppSession(): Promise<void> {
  const accessToken = await readAccessToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Failed to create E2E app session: ${response.status}`);
  }
}

export function makeE2eAccount(
  id: AccountProfileId,
  label: string,
  marker: string,
  updatedAt: number
): AccountState {
  const data: AccountData = {
    characters: [
      {
        key: "amber",
        level: marker === "remote" ? 81 : marker === "conflict" ? 82 : 80,
        constellation: marker === "other-user" ? 1 : 0,
        talent: { auto: 1, skill: 2, burst: 3 },
        weapon: {
          id: `weapon-${marker}`,
          key: "favonius_warbow",
          level: 70,
          refinement: 2,
          lock: true,
        },
        artifacts: {},
      },
    ],
    extraArtifacts: [
      {
        id: `artifact-${marker}`,
        setKey: "CrimsonWitchOfFlames",
        slotKey: "flower",
        level: 20,
        rarity: 5,
        mainStatKey: "hp",
        lock: true,
        substats: { cr: marker === "conflict" ? 7.8 : 3.9, cd: 7.8 },
      },
    ],
    extraWeapons: [
      {
        id: `extra-weapon-${marker}`,
        key: "the_stringless",
        level: 80,
        refinement: 1,
        lock: true,
      },
    ],
  };
  return { id, name: label, lastUpdate: updatedAt, data };
}
