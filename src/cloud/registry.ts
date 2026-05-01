import type { CloudBackupDescriptor, CloudNamespace } from "@/cloud/types";

export const CLOUD_BACKUP_DESCRIPTORS: CloudBackupDescriptor[] = [
  {
    id: "account",
    localStorageKey: "genshin-account-storage",
    class: "account",
    includeInBackup: true,
    namespaces: [
      "account.profile",
      "account.characters",
      "account.weapons",
      "account.artifacts",
      "account.equipment",
    ],
    currentVersion: 1,
    conflictPolicy: "account-import-wins",
  },
  {
    id: "builds",
    localStorageKey: "artifact-filter-builds",
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
    namespaces: ["team.comp", "team.config"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "freeze",
    localStorageKey: "frozen-teams-storage",
    class: "freeze",
    includeInBackup: true,
    namespaces: ["account.freeze"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "character-tiers",
    localStorageKey: "tierlist-storage",
    class: "tiers",
    includeInBackup: true,
    namespaces: ["tier.character.account", "tier.character.custom"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "weapon-tiers",
    localStorageKey: "weapon-tierlist-storage",
    class: "tiers",
    includeInBackup: true,
    namespaces: ["tier.weapon"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "artifact-tiers",
    localStorageKey: "artifact-tierlist-storage",
    class: "tiers",
    includeInBackup: true,
    namespaces: ["tier.artifact"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "artifact-score-settings",
    localStorageKey: "artifact-score-storage",
    class: "settings",
    includeInBackup: true,
    namespaces: ["settings.artifactScore"],
    currentVersion: 1,
    conflictPolicy: "latest-writer-wins",
  },
  {
    id: "triage-settings",
    localStorageKey: "triage-settings",
    class: "settings",
    includeInBackup: true,
    namespaces: ["account.triage"],
    currentVersion: 1,
    conflictPolicy: "explicit-choice",
  },
  {
    id: "resource-settings",
    localStorageKey: "resource-rec-settings",
    class: "settings",
    includeInBackup: true,
    namespaces: ["account.resources"],
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
