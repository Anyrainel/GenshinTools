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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TierCustomization } from "@/data/types";
import { tiers } from "@/data/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TierCustomizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customization: TierCustomization, customTitle?: string) => void;
  initialCustomization: TierCustomization;
  initialCustomTitle?: string;
}

export function TierCustomizationDialog({
  isOpen,
  onClose,
  onSave,
  initialCustomization,
  initialCustomTitle,
}: TierCustomizationDialogProps) {
  const { t } = useLanguage();
  const [customization, setCustomization] = useState<TierCustomization>({});
  const [customTitle, setCustomTitle] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setCustomization(initialCustomization);
      setCustomTitle(initialCustomTitle || "");
    }
  }, [isOpen, initialCustomization, initialCustomTitle]);

  const handleTierChange = (
    tier: string,
    field: "displayName" | "hidden",
    value: string | boolean
  ) => {
    setCustomization((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(customization, customTitle);
    onClose();
  };

  const handleCancel = () => {
    setCustomization(initialCustomization);
    setCustomTitle(initialCustomTitle || "");
    onClose();
  };

  const handleReset = () => {
    setCustomization({});
    setCustomTitle("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t.ui("customizeDialog.title")}</DialogTitle>
          <DialogDescription>
            {t.ui("customizeDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-24">
                <Label
                  htmlFor="custom-title"
                  className="text-sm font-medium text-muted-foreground"
                >
                  {t.ui("customizeDialog.customTitle")}
                </Label>
              </div>
              <div className="flex-1">
                <Input
                  id="custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={t.ui("app.title")}
                  className="w-full"
                />
              </div>
            </div>
          </div>
          {tiers.map((tier) => (
            <div
              key={tier}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-24">
                  <Label
                    htmlFor={`${tier}-name`}
                    className="text-sm font-medium text-muted-foreground"
                  >
                    {tier} {t.ui("customizeDialog.tierName")}
                  </Label>
                </div>
                <div className="flex-1">
                  <Input
                    id={`${tier}-name`}
                    value={customization[tier]?.displayName || ""}
                    onChange={(e) =>
                      handleTierChange(tier, "displayName", e.target.value)
                    }
                    placeholder={`${t.ui("customizeDialog.defaultPrefix")}${tier}`}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Checkbox
                    id={`${tier}-hidden`}
                    checked={customization[tier]?.hidden || false}
                    onCheckedChange={(checked) =>
                      handleTierChange(tier, "hidden", checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`${tier}-hidden`}
                    className={cn(
                      "text-sm whitespace-nowrap text-muted-foreground"
                    )}
                  >
                    {t.ui("customizeDialog.hideTier")}
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="destructive" onClick={handleReset}>
            {t.ui("customizeDialog.reset")}
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            {t.ui("customizeDialog.cancel")}
          </Button>
          <Button onClick={handleSave}>{t.ui("customizeDialog.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
