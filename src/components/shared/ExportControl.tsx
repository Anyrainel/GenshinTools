import { useState } from "react";
import { Download } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExportControlProps {
  onExport: (author: string, description: string) => void;
  disabled?: boolean;
  dialogTitle?: string;
  dialogDescription?: string;
  authorLabel?: string;
  authorPlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  authorRequiredError?: string;
  descriptionRequiredError?: string;
  confirmActionLabel?: string;
  defaultAuthor?: string;
  defaultDescription?: string;
}

export function ExportControl({
  onExport,
  disabled = false,
  dialogTitle,
  dialogDescription,
  authorLabel,
  authorPlaceholder,
  descriptionLabel,
  descriptionPlaceholder,
  authorRequiredError,
  descriptionRequiredError,
  confirmActionLabel,
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
      newErrors.author =
        authorRequiredError || t.ui("configure.exportAuthorRequired");
    }
    if (!description.trim()) {
      newErrors.description =
        descriptionRequiredError || t.ui("configure.exportDescriptionRequired");
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
            <DialogTitle>
              {dialogTitle || t.ui("configure.exportDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {dialogDescription || t.ui("configure.exportDialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="export-author">
                {authorLabel || t.ui("configure.exportAuthorLabel")}
              </Label>
              <Input
                id="export-author"
                placeholder={
                  authorPlaceholder || t.ui("configure.exportAuthorPlaceholder")
                }
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
                {descriptionLabel || t.ui("configure.exportDescriptionLabel")}
              </Label>
              <Input
                id="export-description"
                placeholder={
                  descriptionPlaceholder ||
                  t.ui("configure.exportDescriptionPlaceholder")
                }
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
              {confirmActionLabel || t.ui("configure.exportConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
