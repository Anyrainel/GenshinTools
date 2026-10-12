import { Download, HelpCircle, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";

interface BuildsEmptyStateProps {
  onOpenImport?: () => void;
  onShowTour?: () => void;
}

export function BuildsEmptyState({
  onOpenImport,
  onShowTour,
}: BuildsEmptyStateProps) {
  const { t } = useLanguage();

  return (
    <EmptyState
      icon={SlidersHorizontal}
      title={t.ui("computeFilters.noConfig")}
      description={t.ui("computeFilters.noConfigDesc")}
      action={
        onOpenImport
          ? {
              label: t.ui("computeFilters.importPreset"),
              icon: Download,
              onClick: onOpenImport,
            }
          : undefined
      }
      helpAction={
        onShowTour
          ? {
              label: t.ui("buttons.help"),
              icon: HelpCircle,
              onClick: onShowTour,
            }
          : undefined
      }
    />
  );
}
