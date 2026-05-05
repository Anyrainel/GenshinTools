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
import { categoryList, profileDisplayName } from "./cloudBackupLabels";

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
  const actionLabel = isUpload
    ? t.ui("accountSystem.manualChoice.useLocalData")
    : t.ui("accountSystem.manualChoice.useCloudData");
  const rows: ManualBackupDialogRow[] = [
    ...action.plan.automaticItems.map((item) => ({
      item,
      selectable: false as const,
    })),
    ...action.plan.choices.map((item) => ({
      item,
      selectable: true as const,
    })),
  ];

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isUpload
              ? t.ui("accountSystem.manualChoice.uploadTitle")
              : t.ui("accountSystem.manualChoice.downloadTitle")}
          </DialogTitle>
          <DialogDescription>
            {isUpload
              ? t.ui("accountSystem.manualChoice.uploadDescription")
              : t.ui("accountSystem.manualChoice.downloadDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map(({ item, selectable }) => {
            const checked = selectable ? selectedChoiceIds.has(item.id) : true;
            const checkboxId = `manual-backup-choice-${item.id.replace(
              /[^a-zA-Z0-9_-]/g,
              "-"
            )}`;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    onBooleanChange={(next) =>
                      selectable && onToggleChoice(item.id, next)
                    }
                    disabled={busy || !selectable}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={checkboxId}
                      className={cn(
                        "block text-sm font-medium",
                        selectable && "cursor-pointer"
                      )}
                    >
                      {choiceTitle(item, t)}
                    </label>
                    <div className="text-xs text-muted-foreground">
                      {selectable
                        ? choiceDescription(item, t)
                        : automaticDescription(item, t)}
                    </div>
                    {item.recordKinds.length > 1 && (
                      <div className="text-xs text-muted-foreground">
                        {t
                          .ui("accountSystem.manualChoice.includedCategories")
                          .replace("{0}", categoryList(item.recordKinds, t))}
                      </div>
                    )}
                  </div>
                  <Badge variant={checked ? "default" : "secondary"}>
                    {!selectable
                      ? t.ui("accountSystem.manualChoice.included")
                      : checked
                        ? actionLabel
                        : t.ui("accountSystem.manualChoice.skip")}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.ui("common.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {isUpload
              ? t.ui("accountSystem.manualChoice.confirmUpload")
              : t.ui("accountSystem.manualChoice.confirmDownload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function choiceTitle(
  choice: ManualBackupActionItemBase,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  const categoryText = categoryList(choice.recordKinds, t);
  if (!choice.namespace.startsWith("profile.")) return categoryText;
  return t
    .ui("accountSystem.profileDataLabel")
    .replace("{0}", categoryText)
    .replace("{1}", profileDisplayName(choice.partitionKey, t));
}

function automaticDescription(
  item: ManualBackupAutomaticItem,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  const title = choiceTitle(item, t);
  if (item.kind === "upload-local") {
    return t
      .ui("accountSystem.manualChoice.automaticUpload")
      .replace("{0}", title);
  }
  return t
    .ui("accountSystem.manualChoice.automaticDownload")
    .replace("{0}", title);
}

function choiceDescription(
  choice: ManualBackupChoice,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  const title = choiceTitle(choice, t);
  switch (choice.kind) {
    case "upload-overwrite-cloud":
      return t
        .ui("accountSystem.manualChoice.uploadOverwriteCloud")
        .replace("{0}", title);
    case "upload-delete-cloud":
      return t
        .ui("accountSystem.manualChoice.uploadDeleteCloud")
        .replace("{0}", title);
    case "download-overwrite-local":
      return t
        .ui("accountSystem.manualChoice.downloadOverwriteLocal")
        .replace("{0}", title);
  }
}
