import { RefreshCw } from "lucide-react";
import type { BackupMetadataRow } from "@/cloud/backupMetadata";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  formatBackupCount,
  formatBackupDateTime,
  formatOptionalBackupDate,
  metadataRowLabel,
} from "./cloudBackupLabels";

export function CloudBackupMetadataTable({
  rows,
  checkedAt,
  loading,
  onRefresh,
}: {
  rows: BackupMetadataRow[];
  checkedAt?: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-lg border border-border bg-background/50 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {t.ui("accountSystem.backupContents")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {checkedAt
              ? t
                  .ui("accountSystem.metadataCheckedAt")
                  .replace("{0}", formatBackupDateTime(checkedAt))
              : t.ui("accountSystem.metadataNotChecked")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t.ui("accountSystem.refreshMetadata")}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">
                {t.ui("accountSystem.dataType")}
              </th>
              <th className="text-right font-medium px-3 py-2">
                {t.ui("accountSystem.localRecords")}
              </th>
              <th className="text-left font-medium px-3 py-2">
                {t.ui("accountSystem.localUpdated")}
              </th>
              <th className="text-right font-medium px-3 py-2">
                {t.ui("accountSystem.cloudRecords")}
              </th>
              <th className="text-left font-medium px-3 py-2">
                {t.ui("accountSystem.cloudUpdated")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 font-medium">
                  {metadataRowLabel(row.kind, t, row.profileId)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBackupCount(row.local)}
                </td>
                <td className="px-3 py-2">
                  {formatOptionalBackupDate(row.local, t)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatBackupCount(row.cloud)}
                </td>
                <td className="px-3 py-2">
                  {formatOptionalBackupDate(row.cloud, t)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
