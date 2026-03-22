import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PendingImport } from "@/lib/account-data/importRouting";
import { cn } from "@/lib/utils";
import { useAccountStore } from "@/stores/useAccountStore";
import { Check, Download, Edit2, Plus, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";

export type { PendingImport };

interface AccountManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingImport: PendingImport | null;
  onResolveImport: (
    action: "overwrite" | "merge" | "create",
    targetId: string,
    renamedName?: string
  ) => void;
  onOpenImportControl?: () => void;
}

export function AccountManagerDialog({
  isOpen,
  onClose,
  pendingImport,
  onResolveImport,
  onOpenImportControl,
}: AccountManagerDialogProps) {
  const { t } = useLanguage();
  const {
    accounts,
    activeAccountId,
    setActiveAccount,
    deleteAccount,
    promoteToUid,
  } = useAccountStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUid, setEditUid] = useState("");

  const isValidUid = (uid: string) => /^\d{9,10}$/.test(uid.trim());

  // For "create new profile" in JSON import mode — UID is required
  const [newProfileUid, setNewProfileUid] = useState("");

  // Track selected target for import action
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (pendingImport) {
        setSelectedTarget(activeAccountId || "default");
        setNewProfileUid("");
      } else {
        setSelectedTarget(null);
        setEditingId(null);
        setNewProfileUid("");
      }
    }
  }, [isOpen, pendingImport, activeAccountId]);

  const handleUidSave = (id: string) => {
    const trimmed = editUid.trim();
    if (trimmed && isValidUid(trimmed) && id === "default") {
      // Rename the storage key from "default" to the UID, keeping id === uid
      promoteToUid("default", trimmed);
    }
    setEditingId(null);
  };

  const handleResolve = () => {
    if (!pendingImport || !selectedTarget) return;

    if (selectedTarget === "create_new") {
      if (pendingImport.type === "uid") {
        // UID is already known from the import
        onResolveImport(
          "create",
          pendingImport.uid,
          pendingImport.nickname || pendingImport.uid
        );
      } else {
        // JSON import — user must have provided a UID
        const finalUid = newProfileUid.trim();
        if (!finalUid) return; // blocked by disabled button
        onResolveImport("create", finalUid, finalUid);
      }
      return;
    }

    // Targeting an existing profile
    if (pendingImport.type === "uid") {
      const action = pendingImport.clearBeforeImport ? "overwrite" : "merge";
      // Pass nickname so the profile name is updated; promotion of the key
      // to the UID is handled automatically in handleResolveImport.
      onResolveImport(
        action,
        selectedTarget,
        pendingImport.nickname || undefined
      );
    } else {
      // JSON import into an existing profile: overwrite data only
      onResolveImport("overwrite", selectedTarget);
    }
  };

  const isImportMode = !!pendingImport;
  const isUidImport = pendingImport?.type === "uid";

  // For UID imports, only show the "default" profile as a merge target.
  // Merging one UID's data into a different UID's profile is never meaningful.
  const displayedAccounts =
    isImportMode && isUidImport
      ? Object.values(accounts).filter((acc) => acc.id === "default")
      : Object.values(accounts);

  // "create_new" in JSON import mode requires a valid UID
  const createNewNeedsUid =
    selectedTarget === "create_new" &&
    !isUidImport &&
    !isValidUid(newProfileUid);
  const canSubmit = !!selectedTarget && !createNewNeedsUid;

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <ResponsiveDialogContent className="md:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isImportMode
              ? t.ui("accountData.profileSelect")
              : t.ui("accountData.manageProfiles")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isImportMode
              ? t.ui("accountData.profileSelectDesc")
              : t.ui("accountData.manageProfilesDesc")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-2 pt-2 max-h-[60vh] overflow-y-auto pr-1">
          {displayedAccounts.map((acc) => {
            const isActive = acc.id === activeAccountId;
            const isEditing = editingId === acc.id;
            const isSelectedTarget = selectedTarget === acc.id;

            return (
              <div
                key={acc.id}
                className={cn(
                  "flex flex-col rounded-lg border p-3 transition-colors",
                  isImportMode && isSelectedTarget
                    ? "border-primary bg-primary/10"
                    : isActive && !isImportMode
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  isImportMode ? "cursor-pointer" : ""
                )}
                onClick={() => {
                  if (isImportMode) setSelectedTarget(acc.id);
                  else if (!isActive && !isEditing) {
                    setActiveAccount(acc.id);
                    setTimeout(onClose, 150);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "p-1.5 rounded-full shrink-0",
                        (isImportMode && isSelectedTarget) ||
                          (!isImportMode && isActive)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <User className="w-5 h-5" />
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            // biome-ignore lint/a11y/noAutofocus: edit mode starts here explicitly
                            autoFocus
                            value={editUid}
                            onChange={(e) => setEditUid(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUidSave(acc.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            placeholder="UID"
                            className="flex h-8 w-32 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={!!editUid.trim() && !isValidUid(editUid)}
                            onClick={() => handleUidSave(acc.id)}
                          >
                            <Check className="w-4 h-4 text-green-500" />
                          </Button>
                        </div>
                        {editUid.trim() && !isValidUid(editUid) && (
                          <span className="text-xs text-destructive">
                            {t.ui("import.uidInvalid")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0 flex flex-col">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          <span className="truncate">
                            {acc.id === "default"
                              ? `<${t.ui("accountData.defaultAccount")}>`
                              : acc.name}
                          </span>
                          {!isImportMode && isActive && (
                            <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm shrink-0">
                              {t.ui("common.active")}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-1 items-center">
                          <span>
                            {acc.id === "default" ? "No UID" : acc.id}
                          </span>
                          <span className="opacity-50">•</span>
                          <span>
                            {new Date(acc.lastUpdate).toLocaleDateString()}
                          </span>
                        </div>
                        {/* Show UID assignment hint for UID imports targeting this profile */}
                        {isImportMode &&
                          isUidImport &&
                          isSelectedTarget &&
                          pendingImport.uid && (
                            <div className="mt-1 text-xs text-primary">
                              UID {pendingImport.uid}
                              {pendingImport.nickname
                                ? ` · ${pendingImport.nickname}`
                                : ""}{" "}
                              {t.ui("accountData.willBeAssigned")}
                            </div>
                          )}
                      </div>
                    )}
                  </div>

                  {!isImportMode && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      {acc.id === "default" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={t.ui("import.optionalUid")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditUid("");
                            setEditingId(acc.id);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t.ui("common.confirmDelete"))) {
                            deleteAccount(acc.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {isImportMode && isSelectedTarget && (
                    <Check className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>
              </div>
            );
          })}

          {isImportMode && (
            <div
              className={cn(
                "flex flex-col rounded-lg border p-3 cursor-pointer transition-colors mt-2",
                selectedTarget === "create_new"
                  ? "border-primary bg-primary/10"
                  : "border-dashed border-border hover:bg-muted/50 hover:border-primary/50"
              )}
              onClick={() => setSelectedTarget("create_new")}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-1.5 rounded-full shrink-0 border border-current",
                    selectedTarget === "create_new"
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-medium text-foreground">
                  {t.ui("accountData.createNewProfile")}
                  {isUidImport && pendingImport.uid && (
                    <span className="text-muted-foreground font-normal ml-2">
                      UID: {pendingImport.uid}
                    </span>
                  )}
                </div>
              </div>

              {/* JSON import: require UID to create a new profile */}
              {selectedTarget === "create_new" && !isUidImport && (
                <div
                  className="mt-3 pt-3 border-t flex flex-col gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-muted-foreground">
                    {t.ui("import.uidRequired")}
                  </span>
                  <input
                    // biome-ignore lint/a11y/noAutofocus: UID entry needed to proceed
                    autoFocus
                    type="text"
                    placeholder="UID"
                    value={newProfileUid}
                    onChange={(e) => setNewProfileUid(e.target.value)}
                    className="flex h-8 w-40 rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                  {newProfileUid.trim() && !isValidUid(newProfileUid) && (
                    <span className="text-xs text-destructive">
                      {t.ui("import.uidInvalid")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {!isImportMode && onOpenImportControl && (
            <Button
              variant="outline"
              className="mt-2 w-full gap-2 border-dashed h-12"
              onClick={() => {
                onClose();
                onOpenImportControl();
              }}
            >
              <Download className="w-4 h-4" />
              {t.ui("accountData.addProfile")}
            </Button>
          )}
        </div>

        {isImportMode && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              {t.ui("common.cancel")}
            </Button>
            <Button onClick={handleResolve} disabled={!canSubmit}>
              {selectedTarget === "create_new"
                ? t.ui("accountData.createProfile")
                : t.ui("import.action")}
            </Button>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
