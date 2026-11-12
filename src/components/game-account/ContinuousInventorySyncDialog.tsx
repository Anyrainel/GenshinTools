import { ContinuousInventorySync } from "@/components/game-account/ContinuousInventorySync";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";

export function ContinuousInventorySyncDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        className="gap-4 md:max-w-md"
        closeLabel={t.ui("manager.close")}
      >
        <ResponsiveDialogHeader className="pr-8 text-left">
          <ResponsiveDialogTitle>
            {t.ui("continuous.title")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>GGScanner</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ContinuousInventorySync />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
