import { ArrowRight } from "lucide-react";
import type {
  ManualBackupActionItemBase,
  ManualBackupAutomaticItem,
  ManualBackupChoice,
} from "@/cloud/manualBackupFlow";
import type { CloudPartitionId } from "@/cloud/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  compareBackupRecordGroups,
  type MetadataLabelParts,
  metadataGroupLabelParts,
} from "./cloudBackupLabels";

type PendingManualBackupAction = {
  direction: "upload" | "download";
  plan: {
    automaticItems: ManualBackupAutomaticItem[];
    choices: ManualBackupChoice[];
  };
};

type ManualBackupDialogRow =
  | {
      item: ManualBackupAutomaticItem;
      selectable: false;
    }
  | {
      item: ManualBackupChoice;
      selectable: true;
    };

export function ManualBackupChoiceDialog({
  action,
  selectedChoiceIds,
  busy,
  onToggleChoice,
  onCancel,
  onConfirm,
}: {
  action: PendingManualBackupAction | null;
  selectedChoiceIds: Set<CloudPartitionId>;
  busy: boolean;
  onToggleChoice: (id: CloudPartitionId, checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  if (!action) return null;

  const isUpload = action.direction === "upload";
  const automaticRows = sortDialogRows(
    action.plan.automaticItems.map((item) => ({
      item,
      selectable: false as const,
    }))
  );
  const choiceRows = sortDialogRows(
    action.plan.choices.map((item) => ({
      item,
      selectable: true as const,
    }))
  );

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isUpload
              ? t.ui("accountSystem.uploadToCloud")
              : t.ui("accountSystem.downloadFromCloud")}
          </DialogTitle>
          <DialogDescription>
            {isUpload
              ? t.ui("accountSystem.manualChoice.uploadDescription")
              : t.ui("accountSystem.manualChoice.downloadDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span>
              {isUpload
                ? t.ui("accountSystem.manualChoice.thisBrowser")
                : t.ui("accountSystem.cloudBackup")}
            </span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              {isUpload
                ? t.ui("accountSystem.cloudBackup")
                : t.ui("accountSystem.manualChoice.thisBrowser")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isUpload
              ? t.ui("accountSystem.manualChoice.uploadScope")
              : t.ui("accountSystem.manualChoice.downloadScope")}
          </p>
        </div>

        <div className="space-y-4">
          {automaticRows.length > 0 && (
            <ManualBackupSection
              title={t.ui("accountSystem.manualChoice.automaticSectionTitle")}
              description={
                isUpload
                  ? t.ui(
                      "accountSystem.manualChoice.automaticUploadSectionDescription"
                    )
                  : t.ui(
                      "accountSystem.manualChoice.automaticDownloadSectionDescription"
                    )
              }
              rows={automaticRows}
              busy={busy}
              selectedChoiceIds={selectedChoiceIds}
              onToggleChoice={onToggleChoice}
              t={t}
            />
          )}

          {choiceRows.length > 0 && (
            <ManualBackupSection
              title={t.ui("accountSystem.manualChoice.choiceSectionTitle")}
              description={
                isUpload
                  ? t.ui(
                      "accountSystem.manualChoice.uploadChoiceSectionDescription"
                    )
                  : t.ui(
                      "accountSystem.manualChoice.downloadChoiceSectionDescription"
                    )
              }
              rows={choiceRows}
              busy={busy}
              selectedChoiceIds={selectedChoiceIds}
              onToggleChoice={onToggleChoice}
              t={t}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.ui("common.cancel")}
          </Button>
          <Button
            type="button"
            variant={isUpload ? "secondary" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {isUpload
              ? t.ui("accountSystem.uploadToCloud")
              : t.ui("accountSystem.downloadFromCloud")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualBackupSection({
  title,
  description,
  rows,
  busy,
  selectedChoiceIds,
  onToggleChoice,
  t,
}: {
  title: string;
  description: string;
  rows: ManualBackupDialogRow[];
  busy: boolean;
  selectedChoiceIds: Set<CloudPartitionId>;
  onToggleChoice: (id: CloudPartitionId, checked: boolean) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <section className="rounded-lg border border-border overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {t
              .ui("accountSystem.manualChoice.rowCount")
              .replace("{0}", String(rows.length))}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="hidden border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.8fr)_8rem] sm:gap-3">
        <span>{t.ui("accountSystem.manualChoice.dataGroupColumn")}</span>
        <span>{t.ui("accountSystem.manualChoice.resultColumn")}</span>
        <span className="text-right">{t.ui("teamComp.extraBuffsStatus")}</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <ManualBackupRow
            key={row.item.id}
            row={row}
            busy={busy}
            checked={row.selectable ? selectedChoiceIds.has(row.item.id) : true}
            onToggleChoice={onToggleChoice}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

function ManualBackupRow({
  row,
  busy,
  checked,
  onToggleChoice,
  t,
}: {
  row: ManualBackupDialogRow;
  busy: boolean;
  checked: boolean;
  onToggleChoice: (id: CloudPartitionId, checked: boolean) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  const { item, selectable } = row;
  const checkboxId = `manual-backup-choice-${item.id.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  )}`;
  const statusText = rowStatusLabel(row, checked, t);

  return (
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.8fr)_8rem] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onBooleanChange={(next) =>
            selectable && onToggleChoice(item.id, next)
          }
          disabled={busy || !selectable}
        />
        <div className="min-w-0 space-y-1">
          <label
            htmlFor={checkboxId}
            className={cn(
              "block text-sm font-medium",
              selectable && "cursor-pointer"
            )}
          >
            <MetadataLabel parts={choiceTitle(item, t)} />
          </label>
        </div>
      </div>
      <div className="pl-8 text-xs text-muted-foreground sm:pl-0 sm:text-sm">
        {selectable
          ? choiceDescription(item, checked, t)
          : automaticDescription(item, t)}
      </div>
      <div className="flex justify-end pl-8 sm:pl-0">
        <Badge
          variant={statusVariant(row, checked)}
          className="max-w-full whitespace-normal text-right leading-snug"
        >
          {statusText}
        </Badge>
      </div>
    </div>
  );
}

function choiceTitle(
  choice: ManualBackupActionItemBase,
  t: ReturnType<typeof useLanguage>["t"]
): MetadataLabelParts {
  return metadataGroupLabelParts(
    choice.recordKinds,
    t,
    choice.namespace.startsWith("profile.") ? choice.partitionKey : undefined
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

function sortDialogRows<T extends ManualBackupDialogRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    compareBackupRecordGroups(
      toBackupRecordGroup(a.item),
      toBackupRecordGroup(b.item)
    )
  );
}

function toBackupRecordGroup(item: ManualBackupActionItemBase) {
  return {
    id: item.id,
    recordKinds: item.recordKinds,
    ...(item.namespace.startsWith("profile.")
      ? { profileId: item.partitionKey }
      : {}),
  };
}

function automaticDescription(
  item: ManualBackupAutomaticItem,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (item.kind === "upload-local") {
    return t.ui("accountSystem.manualChoice.automaticUpload");
  }
  return t.ui("accountSystem.manualChoice.automaticDownload");
}

function choiceDescription(
  choice: ManualBackupChoice,
  checked: boolean,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (!checked) return t.ui("accountSystem.manualChoice.keepBothUnchanged");
  switch (choice.kind) {
    case "upload-overwrite-cloud":
      return t.ui("accountSystem.manualChoice.uploadOverwriteCloud");
    case "upload-delete-cloud":
      return t.ui("accountSystem.manualChoice.uploadDeleteCloud");
    case "download-overwrite-local":
      return t.ui("accountSystem.manualChoice.downloadOverwriteLocal");
  }
}

function statusVariant(
  row: ManualBackupDialogRow,
  checked: boolean
): "default" | "secondary" | "destructive" {
  if (!checked) return "secondary";
  if (!row.selectable) return "default";
  return row.item.kind === "upload-delete-cloud" ? "destructive" : "default";
}

function rowStatusLabel(
  row: ManualBackupDialogRow,
  checked: boolean,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (!row.selectable) return t.ui("accountSystem.manualChoice.included");
  if (!checked) return t.ui("accountSystem.manualChoice.keepBothStatus");
  switch (row.item.kind) {
    case "upload-overwrite-cloud":
      return t.ui("accountSystem.manualChoice.overwriteCloudStatus");
    case "upload-delete-cloud":
      return t.ui("accountSystem.manualChoice.deleteCloudStatus");
    case "download-overwrite-local":
      return t.ui("accountSystem.manualChoice.overwriteLocalStatus");
  }
}
