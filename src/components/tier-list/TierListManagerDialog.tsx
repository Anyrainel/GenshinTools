import { Check, Edit2, Layers, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { useTierStore } from "@/stores/useTierStore";

interface TierListManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TierListManagerDialog({
  isOpen,
  onClose,
}: TierListManagerDialogProps) {
  const { t } = useLanguage();
  const tierLists = useTierStore((s) => s.tierLists);
  const activeTierListId = useTierStore((s) => s.activeTierListId);
  const setActiveTierList = useTierStore((s) => s.setActiveTierList);
  const createTierList = useTierStore((s) => s.createTierList);
  const deleteTierList = useTierStore((s) => s.deleteTierList);
  const renameTierList = useTierStore((s) => s.renameTierList);
  const linkAccount = useTierStore((s) => s.linkAccount);

  const accounts = useAccountStore((s) => s.accounts);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEditingId(null);
      setEditName("");
    }
  }, [isOpen]);

  const sortedTierLists = Object.values(tierLists).sort((a, b) => a.id - b.id);

  // Build a set of account IDs already linked to other tier lists
  const linkedAccountIds = new Map<string, number>();
  for (const tl of sortedTierLists) {
    if (tl.linkedAccountId) {
      linkedAccountIds.set(tl.linkedAccountId, tl.id);
    }
  }

  const handleRenameSave = (id: number) => {
    const trimmed = editName.trim();
    if (trimmed) {
      renameTierList(id, trimmed);
    }
    setEditingId(null);
  };

  const handleCreate = () => {
    createTierList();
    onClose();
  };

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <ResponsiveDialogContent className="md:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("tierList.manageLists")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t.ui("tierList.manageListsDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-2 pt-2 max-h-[60vh] overflow-y-auto pr-1">
          {sortedTierLists.map((tl) => {
            const isActive = tl.id === activeTierListId;
            const isEditing = editingId === tl.id;

            return (
              <div
                key={tl.id}
                className={cn(
                  "flex flex-col rounded-lg border p-3 transition-colors",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                  !isEditing && "cursor-pointer"
                )}
                onClick={() => {
                  if (!isEditing && !isActive) {
                    setActiveTierList(tl.id);
                    setTimeout(onClose, 150);
                  }
                }}
              >
                {/* Row 1: Icon + name + active badge + action buttons */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "p-1.5 rounded-full shrink-0",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Layers className="w-5 h-5" />
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          // biome-ignore lint/a11y/noAutofocus: edit mode starts here explicitly
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameSave(tl.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex h-8 w-40 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={!editName.trim()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameSave(tl.id);
                          }}
                        >
                          <Check className="w-4 h-4 text-green-500" />
                        </Button>
                      </div>
                    ) : (
                      <div className="font-medium text-foreground flex items-center gap-2 min-w-0">
                        <span className="truncate">{tl.customTitle}</span>
                        {isActive && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm shrink-0">
                            {t.ui("common.active")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditName(tl.customTitle);
                          setEditingId(tl.id);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {sortedTierLists.length >= 2 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(tl.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Account linking */}
                <div
                  className="flex items-center gap-2 mt-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-muted-foreground shrink-0">
                    {t.ui("tierList.linkedAccount")}
                  </span>
                  <Select
                    value={tl.linkedAccountId ?? "none"}
                    onValueChange={(val) => {
                      linkAccount(tl.id, val === "none" ? null : val);
                    }}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        {t.ui("computeFilters.any")}
                      </SelectItem>
                      {Object.values(accounts).map((acc) => {
                        const linkedTo = linkedAccountIds.get(acc.id);
                        const isLinkedElsewhere =
                          linkedTo !== undefined && linkedTo !== tl.id;
                        return (
                          <SelectItem
                            key={acc.id}
                            value={acc.id}
                            disabled={isLinkedElsewhere}
                          >
                            {acc.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}

          {/* Create new tier list card */}
          <div
            className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50 mt-2"
            onClick={handleCreate}
          >
            <div className="p-1.5 rounded-full shrink-0 border border-current text-muted-foreground">
              <Plus className="w-5 h-5" />
            </div>
            <span className="font-medium text-foreground">
              {t.ui("tierList.createNew")}
            </span>
          </div>
        </div>
      </ResponsiveDialogContent>
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(v) => !v && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.ui("common.deleteTitle") || "Delete?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.ui("common.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.ui("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTargetId !== null) deleteTierList(deleteTargetId);
                setDeleteTargetId(null);
              }}
            >
              {t.ui("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveDialog>
  );
}
