import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TierCustomization } from "@/data/types";
import { tiers } from "@/data/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { THEME } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface TierCustomizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customization: TierCustomization, customTitle?: string) => void;
  initialCustomization: TierCustomization;
  initialCustomTitle?: string;
}

const TierCustomizationDialog: React.FC<TierCustomizationDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCustomization,
  initialCustomTitle,
}) => {
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
    value: string | boolean,
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
      <DialogContent
        className={cn(
          "sm:max-w-[700px]",
          THEME.colors.darkBg,
          THEME.colors.darkBorder,
        )}
      >
        <DialogHeader>
          <DialogTitle className={THEME.colors.textWhite}>
            {t.ui("customizeDialog.title")}
          </DialogTitle>
          <DialogDescription className={THEME.colors.textGray}>
            {t.ui("customizeDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            className={cn(
              "p-4 border rounded-lg",
              THEME.colors.darkBorderSecondary,
              THEME.colors.darkBgSecondary,
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-24">
                <Label
                  htmlFor="custom-title"
                  className={cn("text-sm font-medium", THEME.colors.textGray)}
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
                  className={cn(
                    "w-full",
                    THEME.colors.darkBgSecondary,
                    THEME.colors.darkBorderSecondary,
                    THEME.colors.textWhite,
                    THEME.colors.textGrayPlaceholder,
                    "focus-visible:ring-1 focus-visible:ring-blue-800 focus-visible:border-blue-800 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
                  )}
                />
              </div>
            </div>
          </div>
          {tiers.map((tier) => (
            <div
              key={tier}
              className={cn(
                "p-4 border rounded-lg",
                THEME.colors.darkBorderSecondary,
                THEME.colors.darkBgSecondary,
              )}
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-24">
                  <Label
                    htmlFor={`${tier}-name`}
                    className={cn("text-sm font-medium", THEME.colors.textGray)}
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
                    className={cn(
                      "w-full",
                      THEME.colors.darkBgSecondary,
                      THEME.colors.darkBorderSecondary,
                      THEME.colors.textWhite,
                      THEME.colors.textGrayPlaceholder,
                      "focus-visible:ring-1 focus-visible:ring-blue-800 focus-visible:border-blue-800 focus-visible:ring-offset-1 focus-visible:ring-offset-gray-900",
                    )}
                  />
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <Checkbox
                    id={`${tier}-hidden`}
                    checked={customization[tier]?.hidden || false}
                    onCheckedChange={(checked) =>
                      handleTierChange(tier, "hidden", checked as boolean)
                    }
                    className="border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label
                    htmlFor={`${tier}-hidden`}
                    className={cn(
                      "text-sm whitespace-nowrap",
                      THEME.colors.textGray,
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
          <Button
            variant="destructive"
            onClick={handleReset}
            className={THEME.button.destructive}
          >
            {t.ui("customizeDialog.reset")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleCancel}
            className={THEME.button.secondary}
          >
            {t.ui("customizeDialog.cancel")}
          </Button>
          <Button onClick={handleSave} className={THEME.button.primary}>
            {t.ui("customizeDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TierCustomizationDialog;
