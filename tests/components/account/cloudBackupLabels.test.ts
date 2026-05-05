import { describe, expect, it } from "vitest";
import type { BackupMetadataRow } from "@/cloud/backupMetadata";
import type { CloudBackupRecordKind } from "@/cloud/types";
import { getMetadataDisplayRows } from "@/components/account/cloudBackupLabels";

describe("cloud backup labels", () => {
  it("orders metadata rows by dialog groups without merging categories", () => {
    const rows = [
      row("tiers"),
      row("characters", "0"),
      row("settings", "0"),
      row("teamConfigs"),
      row("weapons", "0"),
      row("frozen", "0"),
      row("teams"),
      row("artifacts", "0"),
      row("builds"),
    ];

    const displayRows = getMetadataDisplayRows(rows);

    expect(displayRows.map((entry) => entry.id)).toEqual([
      "characters/0",
      "weapons/0",
      "artifacts/0",
      "frozen/0",
      "settings/0",
      "teams",
      "teamConfigs",
      "builds",
      "tiers",
    ]);
    expect(
      displayRows.filter((entry) => entry.startsGroup).map((entry) => entry.id)
    ).toEqual([
      "characters/0",
      "artifacts/0",
      "frozen/0",
      "teams",
      "builds",
      "tiers",
    ]);
  });
});

function row(
  kind: CloudBackupRecordKind,
  profileId?: string
): BackupMetadataRow {
  return {
    id: profileId ? `${kind}/${profileId}` : kind,
    kind,
    ...(profileId != null ? { profileId } : {}),
    local: { hasRecord: true, count: 1, partitionCount: 1 },
    cloud: { hasRecord: false, count: 0, partitionCount: 0 },
  };
}
