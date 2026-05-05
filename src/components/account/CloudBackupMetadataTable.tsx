import { RefreshCw } from "lucide-react";
import type { BackupMetadataRow } from "@/cloud/backupMetadata";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  formatBackupCount,
  formatBackupDateTime,
  formatOptionalBackupDate,
  getMetadataDisplayRows,
  type MetadataLabelParts,
  metadataRowLabelParts,
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
  const displayRows = getMetadataDisplayRows(rows);
  return (
    <div className="w-full max-w-3xl mx-auto rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border bg-background/50 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">
            {t.ui("accountSystem.backupContents")}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {checkedAt && (
            <span className="text-sm text-muted-foreground">
              {t
                .ui("accountSystem.metadataCheckedAt")
                .replace("{0}", formatBackupDateTime(checkedAt))}
            </span>
          )}
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
      <div className="overflow-x-auto bg-gradient-select">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-sky-300">
            <tr>
              <th
                className="text-left font-semibold px-3 py-2 text-muted-foreground"
                rowSpan={2}
              >
                {t.ui("accountSystem.metadataDataColumn")}
              </th>
              <th
                className="text-center font-bold px-3 py-2 bg-amber-600/20 text-amber-300 rounded-t-md"
                colSpan={2}
              >
                {t.ui("accountSystem.manualChoice.thisBrowser")}
              </th>
              <th className="text-center font-bold px-3 py-2" colSpan={2}>
                {t.ui("accountSystem.cloudBackup")}
              </th>
            </tr>
            <tr>
              <th className="text-right font-medium px-3 py-2 bg-amber-600/20 text-amber-300">
                {t.ui("accountSystem.metadataRecordsColumn")}
              </th>
              <th className="text-left font-medium px-3 py-2 bg-amber-600/20 text-amber-300">
                {t.ui("accountSystem.metadataUpdatedColumn")}
              </th>
              <th className="text-right font-medium px-3 py-2">
                {t.ui("accountSystem.metadataRecordsColumn")}
              </th>
              <th className="text-left font-medium px-3 py-2">
                {t.ui("accountSystem.metadataUpdatedColumn")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayRows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  row.startsGroup && index > 0 && "border-t-2 border-border"
                )}
              >
                <td className="px-3 py-2 font-medium">
                  <MetadataLabel
                    parts={metadataRowLabelParts(row.kind, t, row.profileId)}
                  />
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums bg-amber-600/20",
                    row.local.count !== row.cloud.count && "font-semibold",
                    index === displayRows.length - 1 && "rounded-bl-md"
                  )}
                >
                  {formatBackupCount(row.local)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 bg-amber-600/20",
                    index === displayRows.length - 1 && "rounded-br-md"
                  )}
                >
                  {formatOptionalBackupDate(row.local, t)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums",
                    row.local.count !== row.cloud.count && "font-semibold"
                  )}
                >
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

function MetadataLabel({ parts }: { parts: MetadataLabelParts }) {
  return (
    <>
      {parts.label}
      {parts.profile && (
        <span className="text-foreground/80"> [{parts.profile}]</span>
      )}
    </>
  );
}
