import type { CloudBackupDescriptor, CloudNamespace } from "@/cloud/types";

export const CLOUD_BACKUP_DESCRIPTORS: CloudBackupDescriptor[] = [
  {
    id: "account",
    localStorageKeys: [
      "genshin-account-storage",
      "frozen-teams-storage",
      "triage-settings",
      "resource-rec-settings",
    ],
    class: "account",
    includeInBackup: true,
    namespaces: ["profile.app", "profile.game", "profile.artifacts"],
    currentVersion: 1,
    conflictPolicy: "profile-import-wins",
  },
  {
    id: "builds",
    localStorageKeys: ["artifact-filter-builds", "artifact-score-storage"],
    class: "builds",
    includeInBackup: true,
    namespaces: ["builds"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "teams",
    localStorageKey: "team-builder-storage",
    class: "teams",
    includeInBackup: true,
    namespaces: ["teams"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "tiers",
    localStorageKeys: [
      "tierlist-storage",
      "weapon-tierlist-storage",
      "artifact-tierlist-storage",
    ],
    class: "tiers",
    includeInBackup: true,
    namespaces: ["tiers"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "account-score-cache",
    localStorageKey: "account-score-cache-storage",
    class: "local-cache",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "team-result-cache",
    localStorageKey: "team-result-cache",
    class: "local-cache",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "preferences",
    localStorageKey: "preferences-storage",
    class: "preferences",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "cloud-sync-metadata",
    localStorageKey: "cloud-sync-metadata-storage",
    class: "sync-metadata",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "greeting",
    localStorageKey: "greeting-storage",
    class: "session",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "session-nav",
    localStorageKey: "session-nav-storage",
    class: "session",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "archive-session",
    localStorageKey: "archive-session-storage",
    class: "session",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "analyzer-cache",
    class: "local-cache",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "recommendation-cache",
    class: "local-cache",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "pupgrade-cache",
    class: "local-cache",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
  {
    id: "buff-overrides",
    class: "session",
    includeInBackup: false,
    namespaces: [],
    currentVersion: 1,
    conflictPolicy: "excluded",
  },
];

export function getCloudBackupDescriptors() {
  return CLOUD_BACKUP_DESCRIPTORS;
}

export function getIncludedCloudBackupDescriptors() {
  return CLOUD_BACKUP_DESCRIPTORS.filter(
    (descriptor) => descriptor.includeInBackup
  );
}

export function getCloudBackupDescriptorForNamespace(namespace: string) {
  return CLOUD_BACKUP_DESCRIPTORS.find((descriptor) =>
    descriptor.namespaces.includes(namespace as CloudNamespace)
  );
}
