import { Upload } from "lucide-react";
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

type ExportVariant = "default" | "tier-list" | "team-comp";

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
    const [validationInfo, setValidationInfo] = useState<{
      warnings: string[];
      count: number;
    }>({ warnings: [], count: 0 });
    const [errors, setErrors] = useState<{
      author?: string;
      description?: string;
    }>({});

    // Expose open() method via ref
    useImperativeHandle(ref, () => ({
      // biome-ignore lint/suspicious/noExplicitAny: Options are loosely typed
      open: (options?: any) => {
        // Reset form to defaults when opening
        setAuthor(defaultAuthor);
        setDescription(defaultDescription);
        setErrors({});

        if (options && typeof options === "object") {
          setValidationInfo({
            warnings: Array.isArray(options.warnings) ? options.warnings : [],
            count: typeof options.count === "number" ? options.count : 0,
          });
        } else {
          setValidationInfo({ warnings: [], count: 0 });
        }

        setIsOpen(true);
      },
    }));

    // Explicitly map keys to avoid dynamic construction for static analysis
    const messages =
      variant === "tier-list"
        ? {
            dialogTitle: t.ui("export.titleTierList"),
            dialogDescription: t.ui("export.descTierList"),
          }
        : variant === "team-comp"
          ? {
              dialogTitle: t.ui("export.titleTeamComp"),
              dialogDescription: t.ui("export.descTeamComp"),
            }
          : {
              dialogTitle: t.ui("export.titleBuilds"),
              dialogDescription: t.ui("export.descBuilds"),
            };

    const shared = {
      authorLabel: t.ui("export.authorLabel"),
      authorPlaceholder: t.ui("export.authorPlaceholder"),
      descriptionLabel: t.ui("export.descLabel"),
      descriptionPlaceholder: t.ui("export.descPlaceholder"),
      authorRequiredError: t.ui("export.authorRequired"),
      descriptionRequiredError: t.ui("export.descRequired"),
      confirmAction: t.ui("export.action"),
    };

    const handleClose = () => {
      setIsOpen(false);
      setErrors({});
    };

    const handleExport = () => {
      // Validate
      const newErrors: { author?: string; description?: string } = {};
      if (!author.trim()) {
        newErrors.author = shared.authorRequiredError;
      }
      if (!description.trim()) {
        newErrors.description = shared.descriptionRequiredError;
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
            {validationInfo.count > 0 && (
              <div className="rounded-md bg-destructive/15 p-3 text-destructive text-sm border border-destructive/20">
                <p className="font-semibold mb-2">
                  Validation Warnings ({validationInfo.count} builds):
                </p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {validationInfo.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="export-author">{shared.authorLabel}</Label>
              <Input
                id="export-author"
                placeholder={shared.authorPlaceholder}
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
                {shared.descriptionLabel}
              </Label>
              <Input
                id="export-description"
                placeholder={shared.descriptionPlaceholder}
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
              <Upload className="w-4 h-4" />
              {shared.confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
