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
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { TierListInstanceBase } from "@/stores/createTierStore";

interface SimpleTierListManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tierLists: Record<number, TierListInstanceBase>;
  activeTierListId: number;
  createTierList: (title?: string) => number;
  deleteTierList: (id: number) => void;
  renameTierList: (id: number, title: string) => void;
  setActiveTierList: (id: number) => void;
}

export function SimpleTierListManagerDialog({
  isOpen,
  onClose,
  tierLists,
  activeTierListId,
  createTierList,
  deleteTierList,
  renameTierList,
  setActiveTierList,
}: SimpleTierListManagerDialogProps) {
  const { t } = useLanguage();
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

  const getListTitle = (list: TierListInstanceBase) =>
    list.customTitle || t.ui("tierList.untitledList");

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
                  "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
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
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "p-1.5 rounded-full shrink-0",
                      isActive
                        ? "bg-primary/80 text-primary-foreground"
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
                      <span className="truncate">{getListTitle(tl)}</span>
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
            );
          })}

          <Button
            type="button"
            variant="soft"
            className="mt-2 h-auto w-full justify-start gap-3 rounded-lg p-3"
            onClick={handleCreate}
          >
            <span className="shrink-0 rounded-full border border-primary/50 p-1.5 text-primary">
              <Plus className="w-5 h-5" />
            </span>
            <span className="font-medium text-foreground">
              {t.ui("tierList.createNew")}
            </span>
          </Button>
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
              onClick={() => {
                if (deleteTargetId !== null) {
                  deleteTierList(deleteTargetId);
                  setDeleteTargetId(null);
                }
              }}
            >
              {t.ui("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveDialog>
  );
}
