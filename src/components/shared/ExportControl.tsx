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

    // Variant-based i18n keys
    const prefix = variant === "tier-list" ? "tierList" : "configure";
    const messages = {
      dialogTitle: t.ui(`${prefix}.exportDialogTitle`),
      dialogDescription: t.ui(`${prefix}.exportDialogDescription`),
      authorLabel: t.ui(`${prefix}.exportAuthorLabel`),
      authorPlaceholder: t.ui(`${prefix}.exportAuthorPlaceholder`),
      descriptionLabel: t.ui(`${prefix}.exportDescriptionLabel`),
      descriptionPlaceholder: t.ui(`${prefix}.exportDescriptionPlaceholder`),
      authorRequiredError: t.ui(`${prefix}.exportAuthorRequired`),
      descriptionRequiredError: t.ui(`${prefix}.exportDescriptionRequired`),
      confirmAction: t.ui(`${prefix}.exportConfirmAction`),
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
