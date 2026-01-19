import { Download } from "lucide-react";
import { useState } from "react";

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
  disabled?: boolean;
  defaultAuthor?: string;
  defaultDescription?: string;
}

export function ExportControl({
  onExport,
  variant = "default",
  disabled = false,
  defaultAuthor = "",
  defaultDescription = "",
}: ExportControlProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState(defaultAuthor);
  const [description, setDescription] = useState(defaultDescription);
  const [errors, setErrors] = useState<{
    author?: string;
    description?: string;
  }>({});

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setAuthor(defaultAuthor);
      setDescription(defaultDescription);
    } else {
      // Reset form when closing (optional, but keeps state clean)
      setErrors({});
    }
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
    handleOpenChange(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Download className="w-4 h-4" />
        {t.ui("app.export")}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
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
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {t.ui("common.cancel")}
            </Button>
            <Button onClick={handleExport} className="gap-2">
              <Download className="w-4 h-4" />
              {messages.confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
