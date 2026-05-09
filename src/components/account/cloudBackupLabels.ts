import type { BackupMetadataRow } from "@/cloud/backupMetadata";
import type { CloudBackupRecordKind } from "@/cloud/types";
import type { useLanguage } from "@/contexts/LanguageContext";

type Translator = ReturnType<typeof useLanguage>["t"];
type BackupMetadataSide = BackupMetadataRow["local"];
export type MetadataLabelParts = {
  label: string;
  profile?: string;
};
export type MetadataDisplayRow = BackupMetadataRow & {
  startsGroup: boolean;
};

const METADATA_DISPLAY_GROUPS: CloudBackupRecordKind[][] = [
  ["characters", "weapons"],
  ["artifacts"],
  ["frozen", "settings"],
  ["teams", "teamConfigs"],
  ["builds"],
  ["tiers"],
];

export function metadataRowLabel(
  kind: CloudBackupRecordKind,
  t: Translator,
  profileId?: string
): string {
  const parts = metadataRowLabelParts(kind, t, profileId);
  return formatMetadataLabelParts(parts);
}

export function metadataRowLabelParts(
  kind: CloudBackupRecordKind,
  t: Translator,
  profileId?: string
): MetadataLabelParts {
  const label = (() => {
    switch (kind) {
      case "characters":
        return t.ui("accountData.characters");
      case "weapons":
        return t.ui("accountData.weapons");
      case "artifacts":
        return t.ui("accountData.artifacts");
      case "frozen":
        return t.ui("accountSystem.metadata.frozen");
      case "settings":
        return t.ui("accountSystem.metadata.settings");
      case "builds":
        return t.ui("accountSystem.metadata.builds");
      case "teams":
        return t.ui("accountSystem.metadata.teams");
      case "teamConfigs":
        return t.ui("accountSystem.metadata.teamConfigs");
      case "tiers":
        return t.ui("accountSystem.metadata.tiers");
    }
  })();
  if (profileId == null) return { label };
  return { label, profile: profileDisplayName(profileId, t) };
}

export function profileDisplayName(profileId: string, t: Translator): string {
  if (profileId === "0") {
    return t.ui("accountData.defaultAccount");
  }
  return profileId;
}

export function categoryList(
  kinds: CloudBackupRecordKind[],
  t: Translator
): string {
  return kinds
    .map((kind) => metadataRowLabel(kind, t))
    .join(t.ui("accountSystem.manualChoice.categoryJoiner"));
}

export function metadataGroupLabel(
  kinds: CloudBackupRecordKind[],
  t: Translator,
  profileId?: string
): string {
  const parts = metadataGroupLabelParts(kinds, t, profileId);
  return formatMetadataLabelParts(parts);
}

export function metadataGroupLabelParts(
  kinds: CloudBackupRecordKind[],
  t: Translator,
  profileId?: string
): MetadataLabelParts {
  const label = categoryList(kinds, t);
  if (profileId == null) return { label };
  return { label, profile: profileDisplayName(profileId, t) };
}

export function getMetadataDisplayRows(
  rows: BackupMetadataRow[]
): MetadataDisplayRow[] {
  const rowsByKey = new Map(
    rows.map((row) => [metadataRowKey(row.kind, row.profileId), row])
  );
  const profileIds = [
    ...new Set(rows.map((row) => row.profileId).filter(isPresent)),
  ].sort();
  const displayRows: MetadataDisplayRow[] = [];

  for (const group of METADATA_DISPLAY_GROUPS) {
    const scoped = group.some(isProfileScopedKind);
    const profileKeys = scoped ? profileIds : [undefined];
    for (const profileId of profileKeys) {
      const groupRows = group.flatMap(
        (kind) => rowsByKey.get(metadataRowKey(kind, profileId)) ?? []
      );
      if (groupRows.length === 0) continue;
      displayRows.push(
        ...groupRows.map((row, index) => ({
          ...row,
          startsGroup: index === 0,
        }))
      );
    }
  }

  return displayRows;
}

export function compareBackupRecordGroups(
  a: {
    recordKinds: CloudBackupRecordKind[];
    profileId?: string;
    id: string;
  },
  b: {
    recordKinds: CloudBackupRecordKind[];
    profileId?: string;
    id: string;
  }
): number {
  const groupDiff =
    getBackupRecordGroupIndex(a.recordKinds) -
    getBackupRecordGroupIndex(b.recordKinds);
  if (groupDiff !== 0) return groupDiff;
  const profileDiff = (a.profileId ?? "").localeCompare(b.profileId ?? "");
  if (profileDiff !== 0) return profileDiff;
  return a.id.localeCompare(b.id);
}

export function formatBackupCount(side: BackupMetadataSide): string {
  if (!side.hasRecord) return "-";
  return String(side.count);
}

export function formatOptionalBackupDate(
  side: BackupMetadataSide,
  t: Translator
): string {
  if (!side.hasRecord) return t.ui("accountSystem.noRecord");
  const value = side.updatedAt;
  if (value != null) return formatBackupDateTime(value);
  return t.ui("accountSystem.missingUpdateTime");
}

export function formatBackupDateTime(value: number): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metadataRowKey(
  kind: CloudBackupRecordKind,
  profileId: string | undefined
): string {
  return `${kind}/${profileId ?? ""}`;
}

function formatMetadataLabelParts(parts: MetadataLabelParts): string {
  return parts.profile ? `${parts.label} [${parts.profile}]` : parts.label;
}

function isProfileScopedKind(kind: CloudBackupRecordKind): boolean {
  return (
    kind === "characters" ||
    kind === "weapons" ||
    kind === "artifacts" ||
    kind === "frozen" ||
    kind === "settings"
  );
}

function getBackupRecordGroupIndex(kinds: CloudBackupRecordKind[]): number {
  const indexes = kinds.map((kind) =>
    METADATA_DISPLAY_GROUPS.findIndex((group) => group.includes(kind))
  );
  const knownIndexes = indexes.filter((index) => index >= 0);
  return knownIndexes.length > 0 ? Math.min(...knownIndexes) : 999;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
