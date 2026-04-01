import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGreetingStore } from "@/stores/useGreetingStore";

export default function NewsDialog({
  latestDate,
  onDismiss,
}: {
  latestDate: string;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const dismissNews = useGreetingStore((s) => s.dismissNews);

  const handleClose = () => {
    dismissNews(latestDate);
    onDismiss();
  };

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && handleClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {t.ui("greeting.newsTitle")}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <p className="p-4 text-sm text-muted-foreground">{latestDate}</p>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
