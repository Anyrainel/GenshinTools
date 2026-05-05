import type { BackupMetadataRow } from "@/cloud/backupMetadata";
import type { CloudBackupRecordKind } from "@/cloud/types";
import type { useLanguage } from "@/contexts/LanguageContext";

type Translator = ReturnType<typeof useLanguage>["t"];
type BackupMetadataSide = BackupMetadataRow["local"];

export function metadataRowLabel(
  kind: CloudBackupRecordKind,
  t: Translator,
  profileId?: string
): string {
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
  if (profileId == null) return label;
  return t
    .ui("accountSystem.profileDataLabel")
    .replace("{0}", label)
    .replace("{1}", profileDisplayName(profileId, t));
}

export function profileDisplayName(profileId: string, t: Translator): string {
  if (profileId === "0") {
    return t.ui("accountSystem.defaultProfile");
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
  if (side.count === 0) return t.ui("accountSystem.noRecord");
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
