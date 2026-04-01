import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGreetingStore } from "@/stores/useGreetingStore";

export default function WelcomeGuide({
  latestDate,
  onDismiss,
}: {
  latestDate: string;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const completeOnboarding = useGreetingStore((s) => s.completeOnboarding);

  const handleClose = () => {
    completeOnboarding(latestDate);
    onDismiss();
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("greeting.welcomeTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <p className="p-4 text-sm text-muted-foreground">
          {t.ui("greeting.welcomeSubtitle")}
        </p>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
