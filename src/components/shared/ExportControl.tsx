import { Download } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

import type { ControlHandle } from "@/components/layout/AppBar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

type ExportVariant = "default" | "tier-list";

interface ExportControlProps {
  onExport: (author: string, description: string) => void;
  variant?: ExportVariant;
  defaultAuthor?: string;
  defaultDescription?: string;
}

/**
 * ExportControl - A dialog-only control for exporting data with author/description metadata.
 *
 * Usage with ref pattern:
 * ```tsx
 * const exportRef = useRef<ControlHandle>(null);
 *
 * const actions: ActionConfig[] = [
 *   { key: "export", icon: Download, label: "Export", onTrigger: () => exportRef.current?.open() },
 * ];
 *
 * <ExportControl ref={exportRef} onExport={handleExport} />
 * <AppBar actions={actions} />
 * ```
 */
export const ExportControl = forwardRef<ControlHandle, ExportControlProps>(
  function ExportControl(
    {
      onExport,
      variant = "default",
      defaultAuthor = "",
      defaultDescription = "",
    },
    ref
  ) {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const [author, setAuthor] = useState(defaultAuthor);
    const [description, setDescription] = useState(defaultDescription);
    const [errors, setErrors] = useState<{
      author?: string;
      description?: string;
    }>({});

    // Expose open() method via ref
    useImperativeHandle(ref, () => ({
      open: () => {
        // Reset form to defaults when opening
        setAuthor(defaultAuthor);
        setDescription(defaultDescription);
        setErrors({});
        setIsOpen(true);
      },
    }));

    // Explicitly map keys to avoid dynamic construction for static analysis
    const messages =
      variant === "tier-list"
        ? {
            dialogTitle: t.ui("tierList.exportDialogTitle"),
            dialogDescription: t.ui("tierList.exportDialogDescription"),
            authorLabel: t.ui("tierList.exportAuthorLabel"),
            authorPlaceholder: t.ui("tierList.exportAuthorPlaceholder"),
            descriptionLabel: t.ui("tierList.exportDescriptionLabel"),
            descriptionPlaceholder: t.ui(
              "tierList.exportDescriptionPlaceholder"
            ),
            authorRequiredError: t.ui("tierList.exportAuthorRequired"),
            descriptionRequiredError: t.ui(
              "tierList.exportDescriptionRequired"
            ),
            confirmAction: t.ui("tierList.exportConfirmAction"),
          }
        : {
            dialogTitle: t.ui("configure.exportDialogTitle"),
            dialogDescription: t.ui("configure.exportDialogDescription"),
            authorLabel: t.ui("configure.exportAuthorLabel"),
            authorPlaceholder: t.ui("configure.exportAuthorPlaceholder"),
            descriptionLabel: t.ui("configure.exportDescriptionLabel"),
            descriptionPlaceholder: t.ui(
              "configure.exportDescriptionPlaceholder"
            ),
            authorRequiredError: t.ui("configure.exportAuthorRequired"),
            descriptionRequiredError: t.ui(
              "configure.exportDescriptionRequired"
            ),
            confirmAction: t.ui("configure.exportConfirmAction"),
          };

    const handleClose = () => {
      setIsOpen(false);
      setErrors({});
    };

    const handleExport = () => {
      // Validate
      const newErrors: { author?: string; description?: string } = {};
      if (!author.trim()) {
        newErrors.author = messages.authorRequiredError;
      }
      if (!description.trim()) {
        newErrors.description = messages.descriptionRequiredError;
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Valid - call onExport
      onExport(author.trim(), description.trim());
      handleClose();
    };

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.dialogTitle}</DialogTitle>
            <DialogDescription>{messages.dialogDescription}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="export-author">{messages.authorLabel}</Label>
              <Input
                id="export-author"
                placeholder={messages.authorPlaceholder}
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  if (errors.author) {
                    setErrors({ ...errors, author: undefined });
                  }
                }}
              />
              {errors.author && (
                <div className="text-sm text-destructive">{errors.author}</div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="export-description">
                {messages.descriptionLabel}
              </Label>
              <Input
                id="export-description"
                placeholder={messages.descriptionPlaceholder}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) {
                    setErrors({ ...errors, description: undefined });
                  }
                }}
              />
              {errors.description && (
                <div className="text-sm text-destructive">
                  {errors.description}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t.ui("common.cancel")}
            </Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              {messages.confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
